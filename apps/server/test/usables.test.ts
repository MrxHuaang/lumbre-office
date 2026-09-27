import type { ColyseusTestServer } from "@colyseus/testing";
import { buildArea, findPath, getWorld, isBlockedTile, type AreaDef, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { MSG, ROOM_NAME, USABLE_FURNITURE, furnitureKey, type FurnitureEvent } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import { FurnitureUses, inReach, noWallBetween } from "../src/rooms/usables";
import type { OfficeState } from "../src/state";
import { bootServer, c, goToArea, intoOffice, tick, toOfficeDoor, token, walkToTile, type ServerRoom } from "./helpers";

// ---------- Reglas (con un nivel de prueba) ----------

/** Una sala de 10x6 con piano (2 de largo), lámpara, tele y gato. */
const TEST_AREA: AreaDef = {
  id: "prueba",
  name: "Prueba",
  width: 10,
  height: 6,
  rooms: [{ id: "sala", rect: { x: 0, y: 0, w: 10, h: 6 }, floor: "wood", wallpaper: "cream" }],
  doors: [],
  // La tele queda dentro de una oficina (x 7..9, y 0..2).
  zones: [{ id: "oficina-prueba", name: "Oficina", type: "office", rect: { x: 7, y: 0, w: 3, h: 3 }, isolated: true }],
  features: [],
  furniture: [
    { type: "piano", x: 0, y: 0 },
    { type: "lamp", x: 4, y: 0 },
    { type: "tv-retro", x: 7, y: 0 },
    { type: "cat-bed", x: 9, y: 5 },
  ],
  portals: [],
  points: [{ type: "spawn", name: "Inicio", x: 5, y: 3 }],
};

function rules() {
  const map: OfficeMap = buildArea(TEST_AREA);
  const switches = new Map<string, boolean>();
  return { map, switches, uses: new FurnitureUses(switches) };
}

const at = (tx: number, ty: number, userId = "u") => ({ userId, x: c(tx), y: c(ty) });

describe("muebles que se usan (reglas)", () => {
  it("la lámpara arranca prendida: usarla la apaga y otra vez la prende", () => {
    const { map, switches, uses } = rules();
    const key = furnitureKey("prueba", "lamp", 4, 0);
    expect(uses.use(map, at(4, 1), { type: "lamp", x: 4, y: 0 }, 0)).toEqual({ ok: true, kind: "toggle", key, on: false });
    expect(switches.get(key)).toBe(false);
    expect(uses.use(map, at(4, 1), { type: "lamp", x: 4, y: 0 }, 1000)).toMatchObject({ on: true });
  });

  it("la tele arranca apagada", () => {
    const { map, uses } = rules();
    expect(uses.use(map, at(7, 1), { type: "tv-retro", x: 7, y: 0 }, 0)).toMatchObject({ kind: "toggle", on: true });
  });

  it("el piano y el gato son un evento con la semilla de la melodía", () => {
    const { map, switches, uses } = rules();
    expect(uses.use(map, at(1, 1), { type: "piano", x: 0, y: 0 }, 0, 42)).toEqual({
      ok: true,
      kind: "event",
      event: { type: "piano", x: 0, y: 0, action: "play", seed: 42 },
    });
    expect(uses.use(map, at(8, 5, "v"), { type: "cat-bed", x: 9, y: 5 }, 0, 7)).toMatchObject({ event: { action: "pet" } });
    expect(switches.size).toBe(0);
  });

  it("el alcance se mide al borde del mueble: el piano (dos tiles) se toca desde su otra punta", () => {
    const { map } = rules();
    const piano = map.furniture.find((f) => f.type === "piano") as PlacedFurniture;
    expect(inReach(map, piano, c(1), c(1))).toBe(true);
    expect(inReach(map, piano, c(1), c(piano.d))).toBe(true);
    expect(inReach(map, piano, c(4), c(4))).toBe(false);
  });

  it("de lejos, en otro tile o con un tipo que no se usa, no pasa nada", () => {
    const { map, switches, uses } = rules();
    expect(uses.use(map, at(8, 5), { type: "lamp", x: 4, y: 0 }, 0)).toEqual({ ok: false, error: "far" });
    expect(uses.use(map, at(4, 1), { type: "lamp", x: 5, y: 0 }, 0)).toEqual({ ok: false, error: "invalid" });
    expect(uses.use(map, at(4, 1), { type: "sofa", x: 4, y: 0 }, 0)).toEqual({ ok: false, error: "invalid" });
    expect(uses.use(map, at(4, 1), { type: "lamp", x: -3 }, 0)).toEqual({ ok: false, error: "invalid" });
    expect(switches.size).toBe(0);
  });

  it("lo de una oficina no se usa desde afuera aunque quede al alcance", () => {
    const { map, uses } = rules();
    expect(uses.use(map, at(6, 1), { type: "tv-retro", x: 7, y: 0 }, 0)).toEqual({ ok: false, error: "far" });
    expect(uses.use(map, at(7, 1), { type: "tv-retro", x: 7, y: 0 }, 0).ok).toBe(true);
  });

  it("a través de una pared no se usa, aunque en línea recta quede al alcance", () => {
    // Dos salas (x 0..4 y 5..9) con la pared en x = 5 y una puerta abajo (y = 5); la lámpara, pegada a la pared.
    const map = buildArea({
      ...TEST_AREA,
      rooms: [
        { id: "sala", rect: { x: 0, y: 0, w: 5, h: 6 }, floor: "wood", wallpaper: "cream" },
        { id: "cocina", rect: { x: 5, y: 0, w: 5, h: 6 }, floor: "tiles", wallpaper: "cream" },
      ],
      doors: [{ edge: "v", x: 5, y: 5 }],
      zones: [],
      furniture: [{ type: "lamp", x: 5, y: 0 }],
    });
    const uses = new FurnitureUses(new Map());
    const lamp = map.furniture[0]!;
    expect(inReach(map, lamp, c(4), c(0))).toBe(true);
    expect(noWallBetween(map, lamp, c(4), c(0))).toBe(false);
    expect(uses.use(map, at(4, 0), { type: "lamp", x: 5, y: 0 }, 0)).toEqual({ ok: false, error: "far" });
    expect(uses.use(map, at(4, 1), { type: "lamp", x: 5, y: 0 }, 0)).toEqual({ ok: false, error: "far" });
    // Del mismo lado, sí.
    expect(uses.use(map, at(5, 1), { type: "lamp", x: 5, y: 0 }, 0)).toMatchObject({ ok: true, on: false });
  });

  it("las pausas vencidas se olvidan (no se acumula una por cada persona que pasó)", () => {
    const { map, uses } = rules();
    // Cien personas, una por segundo: la pausa de cada una ya venció cuando llega la siguiente.
    for (let k = 0; k < 100; k++) uses.use(map, at(4, 1, `u${k}`), { type: "lamp", x: 4, y: 0 }, k * 1000);
    expect(uses.pending).toBeLessThanOrEqual(64);
  });

  it("hay una pausa entre usos de la misma persona (otra persona no espera)", () => {
    const { map, uses } = rules();
    const cool = USABLE_FURNITURE.lamp!.cooldownMs;
    expect(uses.use(map, at(4, 1), { type: "lamp", x: 4, y: 0 }, 0).ok).toBe(true);
    expect(uses.use(map, at(4, 1), { type: "lamp", x: 4, y: 0 }, cool - 1)).toEqual({ ok: false, error: "busy" });
    expect(uses.use(map, at(4, 1, "otra"), { type: "lamp", x: 4, y: 0 }, cool - 1).ok).toBe(true);
    expect(uses.use(map, at(4, 1), { type: "lamp", x: 4, y: 0 }, cool).ok).toBe(true);
  });

  it("al rearmar el nivel se olvidan los muebles que ya no están", () => {
    const { map, switches, uses } = rules();
    uses.use(map, at(4, 1), { type: "lamp", x: 4, y: 0 }, 0);
    switches.set("otro-nivel:lamp:1,1", false);
    uses.prune(buildArea({ ...TEST_AREA, furniture: TEST_AREA.furniture.filter((f) => f.type !== "lamp") }));
    expect([...switches.keys()]).toEqual(["otro-nivel:lamp:1,1"]);
  });
});

// ---------- En la sala: prender y apagar una lámpara del mapa ----------

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await bootServer(new MemoryRepository());
});
afterAll(async () => {
  await colyseus.shutdown();
});
beforeEach(async () => {
  await colyseus.cleanup();
  OfficeRoom.repo = new MemoryRepository();
});

/** Una lámpara del mapa y un tile libre junto a ella al que se llega desde donde se entra al nivel. */
function reachableLamp() {
  const world = getWorld();
  for (const map of world.areas.values()) {
    const arrival = [...world.areas.values()].flatMap((m) => m.portals).find((p) => p.to.area === map.id)?.to;
    const spawn = map.points.find((p) => p.type === "spawn");
    const from = map.id === world.spawnArea && spawn ? { x: spawn.tileX, y: spawn.tileY } : arrival;
    if (!from) continue;
    for (const f of map.furniture.filter((f) => f.type === "lamp" || f.type === "lamp-mushroom")) {
      for (const [dx, dy] of [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ] as const) {
        const t = { x: f.x + dx, y: f.y + dy };
        if (t.x < 0 || t.y < 0 || t.x >= map.width || t.y >= map.height || isBlockedTile(map, t.x, t.y)) continue;
        if (findPath(map, { x: from.x, y: from.y }, t)) return { area: map.id, f, tile: t };
      }
    }
  }
  throw new Error("No hay ninguna lámpara alcanzable en el mapa");
}

const me = (client: ClientRoom, room: ServerRoom) => room.state.players.get(client.sessionId)!;

describe("muebles que se usan (en la sala)", () => {
  it("prender o apagar una lámpara lo ven todos, y de lejos no se puede", async () => {
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
    await room.waitForNextPatch();
    const { area, f, tile } = reachableLamp();
    const key = furnitureKey(area, f.type, f.x, f.y);

    // Bob, en el jardín (u otro nivel), no alcanza.
    bob.send(MSG.furnitureUse, { type: f.type, x: f.x, y: f.y });
    await tick(60);
    await room.waitForNextPatch();
    expect(room.state.switches.get(key)).toBeUndefined();

    await goToArea(alice, room, area);
    await walkToTile(alice, room, tile.x, tile.y);
    expect(me(alice, room).area).toBe(area);
    alice.send(MSG.furnitureUse, { type: f.type, x: f.x, y: f.y });
    await tick(60);
    await room.waitForNextPatch();
    expect(room.state.switches.get(key)).toBe(false);
    // Lo ven los demás: el cambio llega al estado de cada cliente, aunque esté en otro nivel.
    await tick(60);
    const seen = (client: ClientRoom) => (client.state as OfficeState).switches.get(key);
    expect(seen(bob)).toBe(false);
    expect(seen(alice)).toBe(false);
  });

  it("un tipo que no se usa o un mueble que no existe no genera eventos", async () => {
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    const events: FurnitureEvent[] = [];
    alice.onMessage(MSG.furnitureEvent, (e: FurnitureEvent) => events.push(e));
    await room.waitForNextPatch();
    alice.send(MSG.furnitureUse, { type: "piano", x: 1, y: 1 });
    alice.send(MSG.furnitureUse, { type: "nada", x: 1, y: 1 });
    await tick(60);
    expect(events).toEqual([]);
  });
});

// ---------- En la sala: una oficina decorada con piano y gato ----------

describe("muebles que se usan en una oficina decorada", () => {
  // Oficina 2 (x 11..18, y 0..8): puerta afuera en (10, 6) y adentro en (11, 6); se entra hasta (12, 6).
  const ZONE = "office-2";
  const PIANO = { type: "piano", x: 13, y: 7 };
  const CAT = { type: "cat-bed", x: 11, y: 5 };

  async function setup() {
    const repo = new MemoryRepository();
    OfficeRoom.repo = repo;
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    repo.assign(ZONE, "u-alice", "Alice");
    // Lo guardado es relativo a la oficina (la 2 empieza en x = 11).
    repo.decorate(ZONE, [
      { id: "piano", type: "piano", x: PIANO.x - 11, y: PIANO.y, facing: "right" },
      { id: "gato", type: "cat-bed", x: CAT.x - 11, y: CAT.y, facing: "right" },
    ]);
    await OfficeRoom.reloadOfficesEverywhere();
    const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
    const carol = await colyseus.connectTo(room, { token: await token("u-carol", "Carol", "carla") });
    await room.waitForNextPatch();
    const events = { alice: [] as FurnitureEvent[], bob: [] as FurnitureEvent[], carol: [] as FurnitureEvent[] };
    alice.onMessage(MSG.furnitureEvent, (e: FurnitureEvent) => events.alice.push(e));
    bob.onMessage(MSG.furnitureEvent, (e: FurnitureEvent) => events.bob.push(e));
    carol.onMessage(MSG.furnitureEvent, (e: FurnitureEvent) => events.carol.push(e));
    await intoOffice(alice, room, ZONE);
    return { room, alice, bob, carol, events };
  }

  it("tocar el piano llega con la misma semilla a los del nivel, y no a quien está en otro", async () => {
    const { room, alice, bob, carol, events } = await setup();
    // Bob en el piso 2 (afuera de la oficina); Carol se queda en el nivel donde se entra.
    await toOfficeDoor(bob, room, ZONE);
    expect(me(bob, room).area).toBe("piso-2");
    expect(me(carol, room).area).not.toBe("piso-2");

    alice.send(MSG.furnitureUse, PIANO);
    await tick(80);
    expect(events.alice).toHaveLength(1);
    expect(events.alice[0]).toMatchObject({ ...PIANO, action: "play", sessionId: alice.sessionId });
    expect(events.bob).toEqual(events.alice);
    expect(events.carol).toEqual([]);

    // Acariciar al gato también es un evento (después de la pausa del piano).
    await tick(USABLE_FURNITURE.piano!.cooldownMs);
    alice.send(MSG.furnitureUse, CAT);
    await tick(80);
    expect(events.bob.at(-1)).toMatchObject({ ...CAT, action: "pet" });
    expect(events.carol).toEqual([]);
  });

  it("desde la puerta de la oficina no se acaricia al gato de adentro, aunque quede al alcance", async () => {
    const { room, bob, events } = await setup();
    await toOfficeDoor(bob, room, ZONE);
    bob.send(MSG.furnitureUse, CAT);
    await tick(80);
    expect(events.alice).toEqual([]);
    expect(events.bob).toEqual([]);
  });
});
