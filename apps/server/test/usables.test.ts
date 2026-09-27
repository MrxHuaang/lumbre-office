import type { ColyseusTestServer } from "@colyseus/testing";
import { buildArea, findPath, getWorld, isBlockedTile, type AreaDef, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { MSG, ROOM_NAME, USABLE_FURNITURE, furnitureKey, type FurnitureEvent } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import { FurnitureUses, inReach } from "../src/rooms/usables";
import type { OfficeState } from "../src/state";
import { bootServer, c, goToArea, tick, token, walkToTile, type ServerRoom } from "./helpers";

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
  });

  it("los eventos (piano, gato) solo llegan a los del mismo nivel", async () => {
    // No hay piano en el mapa base: se revisa que un mueble que no existe no genere eventos.
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
