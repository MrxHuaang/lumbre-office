import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld } from "@hyvento/map";
import { CASA_ARBOL, CASA_ARBOL_MSG, MSG, ROOM_NAME, type CasaArbolNotice } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import { CasaArbol } from "../src/rooms/casaArbol";
import { Player, TreeHouseState, type OfficeState } from "../src/state";
import { MapSchema } from "@colyseus/schema";
import { bootServer, goToArea, tick, TILE, token, walkToTile, type ServerRoom } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;

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
});

const tileOf = (px: number) => Math.floor(px / TILE);
const jardin = () => getWorld().areas.get("jardin")!;
const subida = () => jardin().portals.find((p) => p.id === CASA_ARBOL.portal)!;

async function setup(names: string[]) {
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const clients: ClientRoom[] = [];
  for (const [i, name] of names.entries()) clients.push(await colyseus.connectTo(room, { token: await token(`u-${name}`, name, i % 2 ? "bruno" : "ada") }));
  await room.waitForNextPatch();
  return { room, clients };
}

/** Camina hasta el pie de la escalera y pide subir; devuelve el aviso si no lo dejaron. */
async function climb(client: ClientRoom, room: ServerRoom): Promise<CasaArbolNotice | null> {
  const portal = subida();
  await walkToTile(client, room, portal.tiles[0]!.x, portal.tiles[0]!.y);
  let notice: CasaArbolNotice | null = null;
  const off = client.onMessage(CASA_ARBOL_MSG.notice, (m: CasaArbolNotice) => (notice = m));
  client.send(MSG.travel, { portal: portal.id });
  await room.waitForNextPatch();
  await tick(40);
  off();
  return notice;
}

const areaOf = (room: ServerRoom, client: ClientRoom) => room.state.players.get(client.sessionId)!.area;

describe("casa del árbol", () => {
  it("se sube por la escalera de cuerda a una sala aislada y se baja por la trampilla al pie del árbol", { timeout: 20000 }, async () => {
    const { room, clients } = await setup(["Alice"]);
    const [alice] = clients as [ClientRoom];
    expect(await climb(alice, room)).toBeNull();
    const me = room.state.players.get(alice.sessionId)!;
    expect(me.area).toBe(CASA_ARBOL.area);
    expect(me.zoneId).toBe(CASA_ARBOL.zone);

    await goToArea(alice, room, "jardin");
    expect(me.area).toBe("jardin");
    const pie = getWorld().areas.get(CASA_ARBOL.area)!.portals[0]!.to;
    expect([tileOf(me.x), tileOf(me.y)]).toEqual([pie.x, pie.y]);
  });

  it("caben tres: el cuarto no sube y se entera de por qué", { timeout: 30000 }, async () => {
    const { room, clients } = await setup(["Alice", "Bob", "Carla", "Dani"]);
    for (const c of clients.slice(0, 3)) expect(await climb(c, room)).toBeNull();
    expect(clients.slice(0, 3).map((c) => areaOf(room, c))).toEqual([CASA_ARBOL.area, CASA_ARBOL.area, CASA_ARBOL.area]);
    const dani = clients[3]!;
    expect(await climb(dani, room)).toEqual({ code: "full" });
    expect(areaOf(room, dani)).toBe("jardin");
    // Baja una y ahora sí hay lugar.
    await goToArea(clients[0]!, room, "jardin");
    expect(await climb(dani, room)).toBeNull();
    expect(areaOf(room, dani)).toBe(CASA_ARBOL.area);
  });

  it("subir la escalera la cierra: nadie más sube hasta que la bajen, y solo se recoge desde adentro", { timeout: 30000 }, async () => {
    const { room, clients } = await setup(["Alice", "Bob"]);
    const [alice, bob] = clients as [ClientRoom, ClientRoom];
    // Desde el jardín no se puede recoger.
    bob.send(CASA_ARBOL_MSG.ladder, { up: true });
    await room.waitForNextPatch();
    expect(room.state.treeHouse.locked).toBe(false);

    expect(await climb(alice, room)).toBeNull();
    alice.send(CASA_ARBOL_MSG.ladder, { up: true });
    await room.waitForNextPatch();
    expect(room.state.treeHouse).toMatchObject({ locked: true, lockedBy: "Alice" });

    expect(await climb(bob, room)).toEqual({ code: "locked" });
    expect(areaOf(room, bob)).toBe("jardin");
    // Tampoco se baja desde abajo.
    bob.send(CASA_ARBOL_MSG.ladder, { up: false });
    await room.waitForNextPatch();
    expect(room.state.treeHouse.locked).toBe(true);

    alice.send(CASA_ARBOL_MSG.ladder, { up: false });
    await room.waitForNextPatch();
    expect(room.state.treeHouse.locked).toBe(false);
    expect(await climb(bob, room)).toBeNull();
    expect(areaOf(room, bob)).toBe(CASA_ARBOL.area);
  });

  it("se abre sola al vaciarse, aunque la última se vaya sin bajar la escalera", { timeout: 30000 }, async () => {
    const { room, clients } = await setup(["Alice", "Bob"]);
    const [alice, bob] = clients as [ClientRoom, ClientRoom];
    expect(await climb(alice, room)).toBeNull();
    expect(await climb(bob, room)).toBeNull();
    alice.send(CASA_ARBOL_MSG.ladder, { up: true });
    await room.waitForNextPatch();
    // Baja Alice: Bob sigue arriba, sigue cerrada.
    await goToArea(alice, room, "jardin");
    expect(room.state.treeHouse.locked).toBe(true);
    expect(await climb(alice, room)).toEqual({ code: "locked" });
    // Bob se desconecta: la casa queda vacía y la escalera se baja sola.
    await bob.leave(true);
    await tick(80);
    expect(room.state.treeHouse).toMatchObject({ locked: false, lockedBy: "" });
    expect(await climb(alice, room)).toBeNull();
  });

  it("el modo foco lo ven los de adentro: foco, descanso y apagado; al vaciarse se apaga", { timeout: 20000 }, async () => {
    const { room, clients } = await setup(["Alice", "Bob"]);
    const [alice, bob] = clients as [ClientRoom, ClientRoom];
    // Desde afuera no se prende.
    bob.send(CASA_ARBOL_MSG.focus, { action: "start" });
    await room.waitForNextPatch();
    expect(room.state.treeHouse.focus).toBe("");

    expect(await climb(alice, room)).toBeNull();
    const before = Date.now();
    alice.send(CASA_ARBOL_MSG.focus, { action: "start" });
    await room.waitForNextPatch();
    expect(room.state.treeHouse.focus).toBe("focus");
    expect(room.state.treeHouse.focusEndsAt).toBeGreaterThanOrEqual(before + CASA_ARBOL.focusMs);
    alice.send(CASA_ARBOL_MSG.focus, { action: "break" });
    await room.waitForNextPatch();
    expect(room.state.treeHouse.focus).toBe("break");
    alice.send(CASA_ARBOL_MSG.focus, { action: "stop" });
    await room.waitForNextPatch();
    expect(room.state.treeHouse).toMatchObject({ focus: "", focusEndsAt: 0 });

    alice.send(CASA_ARBOL_MSG.focus, { action: "start" });
    await room.waitForNextPatch();
    await goToArea(alice, room, "jardin");
    expect(room.state.treeHouse.focus).toBe("");
  });
});

describe("modo foco de la casa del árbol (con reloj falso)", () => {
  it("al terminar el foco viene el descanso, y al terminar el descanso se apaga", () => {
    const state = new TreeHouseState();
    const players = new MapSchema<Player>();
    const alice = new Player();
    alice.userId = "u-alice";
    alice.area = CASA_ARBOL.area;
    players.set("s-alice", alice);
    const casa = new CasaArbol(state, players);
    expect(casa.focus(alice, { action: "start" }, 1000)).toBe(true);
    casa.sweep(1000 + CASA_ARBOL.focusMs - 1);
    expect(state.focus).toBe("focus");
    casa.sweep(1000 + CASA_ARBOL.focusMs);
    expect(state.focus).toBe("break");
    expect(state.focusEndsAt).toBe(1000 + CASA_ARBOL.focusMs + CASA_ARBOL.breakMs);
    casa.sweep(state.focusEndsAt);
    expect(state).toMatchObject({ focus: "", focusEndsAt: 0 });
    // Un mensaje raro no cambia nada.
    expect(casa.focus(alice, { action: "siesta" }, 5)).toBe(false);
    expect(casa.ladder(alice, { up: "sí" })).toBe(false);
  });
});
