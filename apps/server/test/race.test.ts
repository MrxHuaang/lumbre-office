import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, pointsOfType } from "@hyvento/map";
import { CHAIR_RACE, minRaceMs, MSG, PLAYER_SPEED, ROOM_NAME, type RaceResult } from "@hyvento/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import { ChairRaces, type Racer } from "../src/rooms/races";
import type { OfficeState } from "../src/state";
import { bootServer, c, goToArea, tick, token, walkToTile, type ServerRoom } from "./helpers";

const piso2 = () => getWorld().areas.get("piso-2")!;
const start = () => pointsOfType(piso2(), CHAIR_RACE.point)[0]!;

// ---------- Reglas ----------

describe("carrera de sillas (reglas)", () => {
  const racer = (x: number, y = c(12)): Racer => ({ userId: "u", area: "piso-2", x, y, seated: false, racing: false });

  it("se larga solo junto a la bandera, de pie y sin estar corriendo", () => {
    const races = new ChairRaces();
    const map = piso2();
    expect(races.start(map, "s", racer(c(20)), 0)).toBe("far");
    expect(races.start(map, "s", { ...racer(start().x, start().y), seated: true }, 0)).toBe("seated");
    const p = racer(start().x, start().y);
    expect(races.start(map, "s", p, 0)).toBeNull();
    expect(p.racing).toBe(true);
    expect(races.start(map, "s", p, 10)).toBe("busy");
  });

  it("llega a la meta con el tiempo del servidor; salirse o tardar la anula", () => {
    const map = piso2();
    const ts = map.tileSize;
    const races = new ChairRaces();
    const p = racer(start().x, start().y);
    races.start(map, "s", p, 1000);
    // A mitad de camino no pasa nada.
    p.x = c(20);
    expect(races.moved(map, "s", p, 3000)).toBeNull();
    // Cruza la meta en un tiempo creíble.
    p.x = CHAIR_RACE.finishX * ts + 1;
    const ms = Math.ceil(minRaceMs(start().x, ts, PLAYER_SPEED)) + 500;
    expect(races.moved(map, "s", p, 1000 + ms)).toEqual({ kind: "finish", ms });
    expect(p.racing).toBe(false);

    // Salirse del pasillo.
    const q = racer(start().x, start().y);
    races.start(map, "q", q, 10_000);
    q.y = c(CHAIR_RACE.laneY0 - 2);
    expect(races.moved(map, "q", q, 10_500)).toEqual({ kind: "cancel", problem: "lane" });

    // Demasiado rápido para una silla (un salto con lag).
    const f = racer(start().x, start().y);
    races.start(map, "f", f, 20_000);
    f.x = CHAIR_RACE.finishX * ts + 1;
    expect(races.moved(map, "f", f, 20_100)).toEqual({ kind: "cancel", problem: "fast" });

    // Se pasa de tiempo.
    const t = racer(start().x, start().y);
    races.start(map, "t", t, 30_000);
    expect(races.sweep(30_000 + CHAIR_RACE.maxMs + 1, new Map([["t", t]]))).toEqual([["t", { kind: "cancel", problem: "timeout" }]]);
  });
});

// ---------- En la sala ----------

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

describe("carrera de sillas (en la sala)", () => {
  it("junto a la bandera se larga, se va montado y al salir del pasillo se anula", async () => {
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    const results: RaceResult[] = [];
    alice.onMessage(MSG.raceResult, (r: RaceResult) => results.push(r));
    alice.onMessage(MSG.raceEvent, () => {});
    await room.waitForNextPatch();
    await goToArea(alice, room, "piso-2");
    const me = () => room.state.players.get(alice.sessionId)!;

    await walkToTile(alice, room, 20, 12);
    alice.send(MSG.raceStart, {});
    await tick(60);
    expect(results.at(-1)).toEqual({ ok: false, problem: "far" });

    await walkToTile(alice, room, start().tileX, start().tileY);
    alice.send(MSG.raceStart, {});
    await tick(60);
    await room.waitForNextPatch();
    expect(me().racing).toBe(true);

    // Entra a una oficina del sur: fuera del carril.
    await walkToTile(alice, room, 4, 14);
    await tick(60);
    expect(me().racing).toBe(false);
    expect(results.at(-1)).toEqual({ ok: false, problem: "lane" });
  });

  it("la tabla de la semana ordena por el menor tiempo", async () => {
    await repo.saveRaceTime({ userId: "a", name: "Ana", ms: 9000 });
    await repo.saveRaceTime({ userId: "b", name: "Beto", ms: 7000 });
    await repo.saveRaceTime({ userId: "a", name: "Ana", ms: 6500 });
    const board = await repo.raceBoard({ since: 0, limit: 5, userId: "a" });
    expect(board).toEqual({ entries: [{ name: "Ana", ms: 6500 }, { name: "Beto", ms: 7000 }], myBest: 6500 });
  });
});
