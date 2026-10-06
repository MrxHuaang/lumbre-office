// Dormir en la cama de la casa hace amanecer (VIR-144): de noche E en la cama acuesta, moverse despierta,
// y con los que tienen que dormir (y nadie en llamada ni en reunión) el reloj pasa a las 06:00.
import type { ColyseusTestServer } from "@colyseus/testing";
import { buildCasaPropia, isBlockedTile, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { DORMIR_MSG, MSG, ROOM_NAME, casaAreaOf, gameTime, type DormirEstado } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState, Player } from "../src/state";
import { bootServer, tick, token, until, type ServerRoom } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
let now = 1_000_000;

beforeAll(async () => {
  repo = new MemoryRepository();
  colyseus = await bootServer(repo);
});
afterAll(async () => {
  await colyseus.shutdown();
});
beforeEach(async () => {
  await colyseus.cleanup();
  repo = new MemoryRepository();
  OfficeRoom.repo = repo;
  now = 1_000_000;
  OfficeRoom.gameClockNow = () => now;
  // El día 2 a las 22:00 (de noche).
  OfficeRoom.gameClockInitial = { anchorReal: now, anchorMinute: 2 * 1440 + 22 * 60 };
  // A la casa se entra con "/ir" en los tests.
  process.env.HYVENTO_DEV_TOOLS = "1";
});
afterEach(() => {
  OfficeRoom.gameClockNow = () => Date.now();
  OfficeRoom.gameClockInitial = null;
  delete process.env.HYVENTO_DEV_TOOLS;
});

const me = (room: ServerRoom, c: ClientRoom): Player => room.state.players.get(c.sessionId)!;
const clockOf = (room: ServerRoom) => gameTime({ anchorReal: room.state.clockAnchorReal, anchorMinute: room.state.clockAnchorMinute }, now);

/** El segundo piso de la casa de alguien, y su cama doble. */
const arriba = (userId: string) => `${casaAreaOf(userId)}:arriba`;
function camaDoble(userId: string): { map: OfficeMap; cama: PlacedFurniture } {
  const map = buildCasaPropia(arriba(userId))!;
  return { map, cama: map.furniture.find((f) => f.type === "cama-doble")! };
}

/** Un tile libre pegado a la cama. */
function junto(map: OfficeMap, f: PlacedFurniture): { x: number; y: number } {
  for (let y = f.y - 1; y <= f.y + f.d; y++)
    for (let x = f.x - 1; x <= f.x + f.w; x++) {
      const inside = x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.d;
      if (!inside && x >= 0 && y >= 0 && x < map.width && y < map.height && !isBlockedTile(map, x, y)) return { x, y };
    }
  throw new Error("No hay dónde pararse junto a la cama");
}

async function setup(names: string[]) {
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const clients: ClientRoom[] = [];
  for (const name of names) clients.push(await colyseus.connectTo(room, { token: await token(`u-${name}`, name) }));
  await room.waitForNextPatch();
  return { room, clients };
}

/** Lleva a alguien al segundo piso de su casa, junto a la cama doble. */
async function alaCama(room: ServerRoom, c: ClientRoom, userId: string) {
  c.send(MSG.chatSend, { text: `/ir ${arriba(userId)}`, scope: "proximity" });
  await until(() => me(room, c).area === arriba(userId), "subir al segundo piso");
  const { map, cama } = camaDoble(userId);
  const t = junto(map, cama);
  me(room, c).x = (t.x + 0.5) * map.tileSize;
  me(room, c).y = (t.y + 0.5) * map.tileSize;
  return cama;
}

const acostarse = (c: ClientRoom, cama: PlacedFurniture) => c.send(MSG.furnitureUse, { type: cama.type, x: cama.x, y: cama.y });

describe("dormir hace amanecer", () => {
  it("solo en la cabaña: se acuesta y amanece a las 06:00, y queda despierto", { timeout: 20000 }, async () => {
    const { room, clients } = await setup(["Ana"]);
    const [ana] = clients as [ClientRoom];
    let amanecio = false;
    ana.onMessage(DORMIR_MSG.amanecio, () => (amanecio = true));
    const cama = await alaCama(room, ana, "u-Ana");
    const dia = clockOf(room).day;
    acostarse(ana, cama);
    await until(() => amanecio, "amanecer");
    expect(clockOf(room)).toMatchObject({ day: dia + 1, hour: 6, minute: 0 });
    expect(me(room, ana).sleeping).toBe("");
  });

  it("de día no se acuesta", { timeout: 20000 }, async () => {
    OfficeRoom.gameClockInitial = { anchorReal: now, anchorMinute: 2 * 1440 + 12 * 60 };
    const { room, clients } = await setup(["Ana"]);
    const [ana] = clients as [ClientRoom];
    const avisos: string[] = [];
    ana.onMessage(DORMIR_MSG.aviso, (a: { code: string }) => avisos.push(a.code));
    const cama = await alaCama(room, ana, "u-Ana");
    acostarse(ana, cama);
    await until(() => avisos.length > 0, "el aviso");
    expect(avisos).toEqual(["dia"]);
    expect(me(room, ana).sleeping).toBe("");
  });

  it("con dos, uno dormido no basta; moverse despierta; en llamada no amanece", { timeout: 30000 }, async () => {
    const { room, clients } = await setup(["Ana", "Beto"]);
    const [ana, beto] = clients as [ClientRoom, ClientRoom];
    const estados: DormirEstado[] = [];
    beto.onMessage(DORMIR_MSG.estado, (e: DormirEstado) => estados.push(e));
    const camaAna = await alaCama(room, ana, "u-Ana");
    const camaBeto = await alaCama(room, beto, "u-Beto");
    const hora = clockOf(room).hour;

    acostarse(ana, camaAna);
    await until(() => estados.some((e) => e.dormidos === 1 && e.total === 2), "Durmiendo 1/2");
    expect(me(room, ana).sleeping).not.toBe("");
    expect(clockOf(room).hour).toBe(hora);

    // Ana da un paso: se despierta.
    const p = me(room, ana);
    ana.send(MSG.move, { x: p.x, y: p.y + 4, dir: "down", moving: true });
    await until(() => me(room, ana).sleeping === "", "despertarse al moverse");

    // Beto en una llamada: aunque duerman los dos, no amanece. (La cama tiene su pausa entre usos.)
    me(room, beto).callId = "llamada-1";
    await tick(1600);
    acostarse(ana, camaAna);
    await tick(80);
    acostarse(beto, camaBeto);
    await tick(200);
    expect(me(room, ana).sleeping).not.toBe("");
    expect(me(room, beto).sleeping).not.toBe("");
    expect(clockOf(room).hour).toBe(hora);

    // Cuelga: a la siguiente revisión, amanece.
    me(room, beto).callId = "";
    await until(() => clockOf(room).hour === 6, "amanecer al colgar", 5000);
    expect(me(room, ana).sleeping).toBe("");
    expect(me(room, beto).sleeping).toBe("");
  });
});
