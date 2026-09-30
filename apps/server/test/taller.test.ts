import type { ColyseusTestServer } from "@colyseus/testing";
import { findPath, getWorld, isBlockedTile, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { MSG, RECHAZO_MSG, ROOM_NAME, TALLER, TALLER_USABLES, type FurnitureEvent, type RechazoNotice } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import { FurnitureUses } from "../src/rooms/usables";
import type { OfficeState } from "../src/state";
import { bootServer, c, goToArea, tick, token, walkToTile, type ServerRoom } from "./helpers";

const garaje = () => getWorld().areas.get("garaje")!;

/** El mueble del taller de ese tipo (en el garaje hay uno de cada uno). */
const piece = (map: OfficeMap, type: string) => map.furniture.find((f) => f.type === type)!;

/** Un tile libre pegado al mueble al que se llega caminando desde la puerta del garaje. */
function standNear(map: OfficeMap, f: PlacedFurniture) {
  const from = [...getWorld().areas.values()].flatMap((m) => m.portals).find((p) => p.to.area === map.id)!.to;
  for (let y = f.y - 1; y <= f.y + f.d; y++)
    for (let x = f.x - 1; x <= f.x + f.w; x++) {
      const inside = x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.d;
      if (inside || x < 0 || y < 0 || x >= map.width || y >= map.height || isBlockedTile(map, x, y)) continue;
      if (findPath(map, { x: from.x, y: from.y }, { x, y })) return { x, y };
    }
  throw new Error(`No se llega al ${f.type}`);
}

describe("el taller del garaje (reglas)", () => {
  it("cada cosa del taller es un evento con su acción, sin nada en la mano ni contadores", () => {
    const map = garaje();
    const uses = new FurnitureUses(new Map());
    const actions: Record<string, string> = { compressor: "inflate", "tarp-car": "drive", workbench: "sand", "tool-chest": "rattle" };
    for (const [type, action] of Object.entries(actions)) {
      const f = piece(map, type);
      const t = standNear(map, f);
      const r = uses.use(map, { userId: `u-${type}`, x: c(t.x), y: c(t.y) }, { type, x: f.x, y: f.y }, 0, 7);
      expect(r).toEqual({ ok: true, kind: "event", event: { type, x: f.x, y: f.y, action, seed: 7 } });
    }
  });

  it("de lejos no se usa", () => {
    const map = garaje();
    const f = piece(map, "compressor");
    const uses = new FurnitureUses(new Map());
    // Desde la otra punta del taller (el rincón sureste).
    expect(uses.use(map, { userId: "u", x: c(14), y: c(9) }, { type: "compressor", x: f.x, y: f.y }, 0)).toEqual({ ok: false, error: "far" });
  });

  it("al carro se sube una persona a la vez; al bajarse, puede otra", () => {
    const map = garaje();
    const f = piece(map, "tarp-car");
    const t = standNear(map, f);
    const uses = new FurnitureUses(new Map());
    const use = (userId: string, now: number) => uses.use(map, { userId, x: c(t.x), y: c(t.y) }, { type: "tarp-car", x: f.x, y: f.y }, now);
    expect(use("u-ana", 0)).toMatchObject({ ok: true, event: { action: "drive" } });
    expect(use("u-bruno", 1000)).toEqual({ ok: false, error: "taken" });
    expect(use("u-bruno", TALLER.driveMs - 1)).toEqual({ ok: false, error: "taken" });
    expect(use("u-bruno", TALLER.driveMs)).toMatchObject({ ok: true, event: { action: "drive" } });
    // Quien va al volante tiene su pausa normal (no le dice "ocupado").
    expect(use("u-bruno", TALLER.driveMs + 10)).toEqual({ ok: false, error: "busy" });
  });

  it("el compresor tiene su pausa y los demás lo usan a la vez", () => {
    const map = garaje();
    const f = piece(map, "compressor");
    const t = standNear(map, f);
    const uses = new FurnitureUses(new Map());
    const use = (userId: string, now: number) => uses.use(map, { userId, x: c(t.x), y: c(t.y) }, { type: "compressor", x: f.x, y: f.y }, now);
    expect(use("u-ana", 0).ok).toBe(true);
    expect(use("u-ana", 100)).toEqual({ ok: false, error: "busy" });
    expect(use("u-bruno", 100).ok).toBe(true);
    expect(use("u-ana", TALLER_USABLES.compressor!.cooldownMs).ok).toBe(true);
  });
});

// ---------- En la sala ----------

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

const me = (client: ClientRoom, room: ServerRoom) => room.state.players.get(client.sessionId)!;

describe("el taller del garaje (en la sala)", () => {
  it("manejar el carro lo ven los del garaje, nadie más se sube (con aviso) y no cambia los puntos", async () => {
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
    await room.waitForNextPatch();
    const events = { alice: [] as FurnitureEvent[], bob: [] as FurnitureEvent[] };
    alice.onMessage(MSG.furnitureEvent, (e: FurnitureEvent) => events.alice.push(e));
    bob.onMessage(MSG.furnitureEvent, (e: FurnitureEvent) => events.bob.push(e));
    const notices: RechazoNotice[] = [];
    bob.onMessage(RECHAZO_MSG.notice, (n: RechazoNotice) => notices.push(n));

    const map = garaje();
    const car = piece(map, "tarp-car");
    const t = standNear(map, car);
    for (const client of [alice, bob]) {
      await goToArea(client, room, "garaje");
      await walkToTile(client, room, t.x, t.y);
    }
    expect(me(alice, room).area).toBe("garaje");
    const points = { alice: me(alice, room).points, bob: me(bob, room).points };

    alice.send(MSG.furnitureUse, { type: "tarp-car", x: car.x, y: car.y });
    await tick(80);
    bob.send(MSG.furnitureUse, { type: "tarp-car", x: car.x, y: car.y });
    await tick(80);

    const drives = (list: FurnitureEvent[]) => list.filter((e) => e.action === "drive").map((e) => e.sessionId);
    expect(drives(events.alice)).toEqual([alice.sessionId]);
    expect(drives(events.bob)).toEqual([alice.sessionId]);
    // A Bob le dicen por qué no se pudo subir.
    expect(notices).toEqual([{ code: "carTaken" }]);
    await room.waitForNextPatch();
    expect({ alice: me(alice, room).points, bob: me(bob, room).points }).toEqual(points);
  });
});
