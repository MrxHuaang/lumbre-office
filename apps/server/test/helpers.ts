import { ColyseusTestServer } from "@colyseus/testing";
import { findPath, getWorld, officeDoor } from "@hyvento/map";
import { BAG_MSG, MSG, signGameToken, type GameTokenClaims } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { createGameServer } from "../src/app";
import type { GameRepository } from "../src/repo/types";
import type { Bag } from "../src/rooms/bag";
import type { OfficeState } from "../src/state";

export const SECRET = "test-secret-test-secret-test-secret-123";
process.env.GAME_TOKEN_SECRET = SECRET;

/**
 * Puerto del servidor de prueba. `boot()` de @colyseus/testing ignora el puerto si le pasas un Server ya
 * creado (siempre usa 2568), así que se levanta a mano: con HYVENTO_TEST_PORT distintos se pueden correr
 * los tests de varias copias del repo a la vez.
 */
export const TEST_PORT = Number(process.env.HYVENTO_TEST_PORT) || 2568;

/** Levanta el servidor de juego de prueba en `TEST_PORT`. */
export async function bootServer(repo: GameRepository): Promise<ColyseusTestServer> {
  const server = createGameServer({ repo });
  await server.listen(TEST_PORT);
  return new ColyseusTestServer(server);
}

export const TILE = 32;
/** Centro de un tile en píxeles. */
export const c = (t: number) => t * TILE + TILE / 2;
const tileOf = (px: number) => Math.floor(px / TILE);

export const token = (
  sub: string,
  name: string,
  avatar: GameTokenClaims["avatar"] = "ada",
  role: GameTokenClaims["role"] = "MEMBER",
  extra: Partial<GameTokenClaims> = {},
) => signGameToken({ sub, name, avatar, role, ...extra }, SECRET);

export const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));

export type ServerRoom = Awaited<ReturnType<ColyseusTestServer["createRoom"]>> & { state: OfficeState };

const me = (client: ClientRoom, room: ServerRoom) => room.state.players.get(client.sessionId)!;

/** Envía pasos pequeños en línea recta desde (fromX, fromY) (como lo haría el cliente real). */
function sendSteps(client: ClientRoom, from: { x: number; y: number }, x: number, y: number) {
  let cx = from.x;
  let cy = from.y;
  while (Math.hypot(x - cx, y - cy) > 1) {
    const d = Math.hypot(x - cx, y - cy);
    const step = Math.min(10, d);
    cx += ((x - cx) / d) * step;
    cy += ((y - cy) / d) * step;
    client.send(MSG.move, { x: cx, y: cy, dir: "down", moving: true });
  }
  return { x: cx, y: cy };
}

/** Camina en línea recta hasta (x, y) en px. */
export async function walkTo(client: ClientRoom, room: ServerRoom, x: number, y: number) {
  sendSteps(client, me(client, room), x, y);
  await room.waitForNextPatch();
  await tick(20);
}

/**
 * Camina hasta un tile siguiendo la ruta del A* del nivel actual (respeta paredes y muebles, no las
 * oficinas cerradas: esas las rechaza el servidor).
 */
export async function walkToTile(client: ClientRoom, room: ServerRoom, tx: number, ty: number) {
  const p = me(client, room);
  const map = getWorld().areas.get(p.area)!;
  const start = { x: tileOf(p.x), y: tileOf(p.y) };
  const path = findPath(map, start, { x: tx, y: ty });
  if (!path) throw new Error(`Sin ruta a (${tx}, ${ty}) en ${p.area}`);
  let pos = sendSteps(client, p, c(start.x), c(start.y));
  for (const t of path) pos = sendSteps(client, pos, c(t.x), c(t.y));
  await room.waitForNextPatch();
  await tick(20);
}

/** Va de nivel en nivel por los portales hasta llegar a `area`. */
export async function goToArea(client: ClientRoom, room: ServerRoom, area: string) {
  const world = getWorld();
  for (let hops = 0; hops < 5 && me(client, room).area !== area; hops++) {
    const current = world.areas.get(me(client, room).area)!;
    // Siguiente salto por el grafo de portales (BFS).
    const prev = new Map<string, { from: string; portal: string } | null>([[current.id, null]]);
    const queue = [current.id];
    while (queue.length) {
      const id = queue.shift()!;
      for (const portal of world.areas.get(id)!.portals)
        if (!prev.has(portal.to.area)) {
          prev.set(portal.to.area, { from: id, portal: portal.id });
          queue.push(portal.to.area);
        }
    }
    let step = prev.get(area);
    while (step && step.from !== current.id) step = prev.get(step.from);
    if (!step) throw new Error(`No hay camino a ${area}`);
    const portal = current.portals.find((p) => p.id === step!.portal)!;
    await walkToTile(client, room, portal.tiles[0]!.x, portal.tiles[0]!.y);
    client.send(MSG.travel, { portal: portal.id });
    await room.waitForNextPatch();
    await tick(20);
  }
}

/** Tile de la puerta (afuera) y uno adentro de una oficina del piso 2 (dos pasos hacia adentro). */
export function officeTiles(zoneId: string) {
  const map = getWorld().areas.get("piso-2")!;
  const zone = map.zones.find((z) => z.id === zoneId)!;
  const door = officeDoor(zone);
  const outside = { x: tileOf(door.x), y: tileOf(door.y) };
  const inZone = (x: number, y: number) =>
    x * TILE >= zone.x && x * TILE < zone.x + zone.width && y * TILE >= zone.y && y * TILE < zone.y + zone.height;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  const [dx, dy] = dirs.find(([dx, dy]) => inZone(outside.x + dx, outside.y + dy))!;
  return { outside, inside: { x: outside.x + dx * 2, y: outside.y + dy * 2 } };
}

/** Lleva al jugador a la puerta de una oficina (afuera). */
export async function toOfficeDoor(client: ClientRoom, room: ServerRoom, zoneId: string) {
  await goToArea(client, room, "piso-2");
  const { outside } = officeTiles(zoneId);
  await walkToTile(client, room, outside.x, outside.y);
}

/** Lleva al jugador adentro de una oficina (si puede entrar). */
export async function intoOffice(client: ClientRoom, room: ServerRoom, zoneId: string) {
  await toOfficeDoor(client, room, zoneId);
  const { inside } = officeTiles(zoneId);
  await walkToTile(client, room, inside.x, inside.y);
}

/** La mochila de la sala por dentro (para que los tests elijan casillas como lo haría la barra). */
export const bagOf = (room: ServerRoom) => (room as unknown as { held: Bag }).held;

/** Elige en la barra la casilla de esa cosa de la mochila (queda en la mano). */
export async function holdItem(client: ClientRoom, room: ServerRoom, itemId: string) {
  const userId = me(client, room).userId;
  await bagOf(room).flush(userId);
  const slot = bagOf(room).view(userId).slots.findIndex((s) => s?.itemId === itemId);
  if (slot < 0) throw new Error(`No tiene ${itemId} en la mochila`);
  client.send(BAG_MSG.select, { slot });
  await room.waitForNextPatch();
  await tick(20);
}
