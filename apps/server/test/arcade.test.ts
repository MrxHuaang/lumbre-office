import type { ColyseusTestServer } from "@colyseus/testing";
import { findPath, getWorld, isBlockedTile, pointsOfType } from "@hyvento/map";
import { ARCADE, ARCADE_MACHINES, MSG, POINTS, ROOM_NAME, type ArcadeBoard, type ArcadeResult, type ArcadeStarted } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { Arcade, atMachine } from "../src/rooms/arcade";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, goToArea, tick, token, walkToTile, type ServerRoom } from "./helpers";

// ---------- Reglas (sin sala) ----------

const sotano = () => getWorld().areas.get("sotano")!;
const machinePoint = (i: number) => pointsOfType(sotano(), "arcade")[i]!;
/** Alguien parado delante de la máquina `i`. */
const atM = (i: number, userId = "u-a") => ({ userId, name: userId.slice(2), x: machinePoint(i).x, y: machinePoint(i).y });

function arcade() {
  const repo = new MemoryRepository();
  const awards: { userId: string; amount: number }[] = [];
  let n = 0;
  const a = new Arcade({
    repo: () => repo,
    seed: () => 1234,
    token: () => `t${++n}`,
    award: async (userId, amount) => {
      const { awarded } = await repo.awardPoints({ userId, amount, reason: "LEISURE" });
      awards.push({ userId, amount: awarded });
      return awarded;
    },
  });
  return { a, repo, awards };
}

describe("arcade (reglas)", () => {
  it("hay un punto delante de cada máquina, se llega a todos y las primeras tienen los tres juegos", () => {
    const map = sotano();
    const points = pointsOfType(map, "arcade");
    expect(points.length).toBe(ARCADE_MACHINES.length);
    const spawn = pointsOfType(map, "spawn")[0] ?? points[0]!;
    for (const p of points) {
      expect(isBlockedTile(map, p.tileX, p.tileY), p.name).toBe(false);
      expect(findPath(map, { x: spawn.tileX, y: spawn.tileY }, { x: p.tileX, y: p.tileY }), p.name).not.toBeNull();
    }
    expect(ARCADE_MACHINES.slice(0, 3)).toEqual(["snake", "breakout", "flappy"]);
  });

  it("se empieza delante de una máquina que funciona y el servidor da la semilla", () => {
    const { a } = arcade();
    const map = sotano();
    expect(a.start(map, atM(0), { machine: 0 }, 0)).toEqual({ machine: 0, game: "snake", token: "t1", seed: 1234 });
    // Las máquinas de al lado quedan al alcance; las de más allá, no.
    expect(a.start(map, atM(0), { machine: 5 }, 0)).toEqual({ ok: false, error: "far" });
    const broken = ARCADE_MACHINES.indexOf(null);
    expect(a.start(map, atM(broken), { machine: broken }, 0)).toEqual({ ok: false, error: "invalid" });
    expect(atMachine(map, 2, atM(2).x, atM(2).y)).toBe(true);
  });

  it("una partida muy corta o con un puntaje imposible no se guarda", async () => {
    const { a, repo } = arcade();
    a.start(sotano(), atM(2), { machine: 2 }, 0);
    expect(await a.finish(atM(2), { token: "t1", score: 0 }, ARCADE.minMs - 1)).toEqual({ ok: false, error: "short" });
    a.start(sotano(), atM(2), { machine: 2 }, 0);
    // Aleteo: un tubo por segundo como mucho (más dos de margen).
    expect(await a.finish(atM(2), { token: "t2", score: 13 }, 10_000)).toEqual({ ok: false, error: "implausible" });
    expect(repo.arcade).toEqual([]);
  });

  it("el token es de una sola partida y de esa persona; una partida vieja se vence", async () => {
    const { a } = arcade();
    a.start(sotano(), atM(0), { machine: 0 }, 0);
    expect(await a.finish(atM(0, "u-b"), { token: "t1", score: 1 }, 5000)).toEqual({ ok: false, error: "expired" });
    expect(await a.finish(atM(0), { token: "otro", score: 1 }, 5000)).toEqual({ ok: false, error: "expired" });
    a.start(sotano(), atM(0), { machine: 0 }, 0);
    expect((await a.finish(atM(0), { token: "t2", score: 1 }, 5000)).ok).toBe(true);
    expect(await a.finish(atM(0), { token: "t2", score: 1 }, 6000)).toEqual({ ok: false, error: "expired" });
    a.start(sotano(), atM(0), { machine: 0 }, 0);
    expect(await a.finish(atM(0), { token: "t3", score: 1 }, ARCADE.sessionMs + 1)).toEqual({ ok: false, error: "expired" });
  });

  it("la primera partida del día y el récord de la semana dan premio de ocio; las demás no", async () => {
    const { a, awards } = arcade();
    const map = sotano();
    a.start(map, atM(0), { machine: 0 }, 0);
    const first = await a.finish(atM(0), { token: "t1", score: 8 }, 10_000);
    // Primera del día y además récord (no había nada esta semana).
    expect(first).toMatchObject({ ok: true, game: "snake", score: 8, firstToday: true, record: true, awarded: ARCADE.firstGameReward + ARCADE.recordReward });
    a.start(map, atM(0), { machine: 0 }, 0);
    expect(await a.finish(atM(0), { token: "t2", score: 5 }, 10_000)).toMatchObject({ ok: true, firstToday: false, record: false, awarded: 0 });
    // Otra persona: su primera del día, pero no le gana al récord.
    a.start(map, atM(3, "u-b"), { machine: 3 }, 0);
    expect(await a.finish(atM(3, "u-b"), { token: "t3", score: 7 }, 10_000)).toMatchObject({ firstToday: true, record: false, awarded: ARCADE.firstGameReward });
    // Récord nuevo de la semana.
    a.start(map, atM(0), { machine: 0 }, 0);
    const best = await a.finish(atM(0), { token: "t4", score: 12 }, 10_000);
    expect(best).toMatchObject({ record: true, awarded: ARCADE.recordReward });
    expect(best.ok && best.board).toEqual([
      { name: "a", score: 12 },
      { name: "b", score: 7 },
    ]);
    expect(awards.map((w) => w.userId)).toEqual(["u-a", "u-b", "u-a"]);
  });

  it("los premios respetan el tope diario de ocio", async () => {
    const { a, repo } = arcade();
    await repo.awardPoints({ userId: "u-a", amount: POINTS.leisureDailyCap - 2, reason: "LEISURE" });
    a.start(sotano(), atM(1), { machine: 1 }, 0);
    expect(await a.finish(atM(1), { token: "t1", score: 3 }, 10_000)).toMatchObject({ ok: true, awarded: 2 });
    expect(await repo.getPoints("u-a")).toBe(POINTS.leisureDailyCap);
  });

  it("la tabla de récords muestra el mejor puntaje de cada persona en ese juego", async () => {
    const { a, repo } = arcade();
    const week = Date.now();
    repo.arcade.push(
      { userId: "u-a", name: "Ana", game: "breakout", score: 30, at: week },
      { userId: "u-a", name: "Ana", game: "breakout", score: 50, at: week },
      { userId: "u-b", name: "Beto", game: "breakout", score: 40, at: week },
      { userId: "u-c", name: "Caro", game: "snake", score: 99, at: week },
    );
    expect(await a.board({ machine: 1 }, week)).toEqual({
      machine: 1,
      game: "breakout",
      board: [
        { name: "Ana", score: 50 },
        { name: "Beto", score: 40 },
      ],
    });
    expect(await a.board({ machine: ARCADE_MACHINES.indexOf(null) }, week)).toBeNull();
  });
});

// ---------- En la sala ----------

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
const defaultSeed = OfficeRoom.arcadeSeed;

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
  OfficeRoom.arcadeSeed = () => 777;
});
afterEach(() => {
  OfficeRoom.arcadeSeed = defaultSeed;
});

async function setup() {
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  await room.waitForNextPatch();
  const got = { started: [] as ArcadeStarted[], results: [] as ArcadeResult[], boards: [] as ArcadeBoard[], awards: [] as number[] };
  alice.onMessage(MSG.arcadeStarted, (s: ArcadeStarted) => got.started.push(s));
  alice.onMessage(MSG.arcadeResult, (r: ArcadeResult) => got.results.push(r));
  alice.onMessage(MSG.arcadeBoardResult, (b: ArcadeBoard) => got.boards.push(b));
  alice.onMessage(MSG.pointsAwarded, (a: { amount: number }) => got.awards.push(a.amount));
  const send = async (client: ClientRoom, type: string, msg: unknown, wait = 60) => {
    client.send(type, msg);
    await tick(wait);
  };
  return { room, alice, got, send };
}

describe("arcade (en la sala)", () => {
  it("lejos de la máquina no se empieza", async () => {
    const { alice, got, send } = await setup();
    await send(alice, MSG.arcadeStart, { machine: 0 });
    expect(got.results).toEqual([{ ok: false, error: "far" }]);
    expect(got.started).toEqual([]);
  });

  it("delante de la máquina se juega: semilla, puntaje validado con el reloj del servidor y premio", async () => {
    const { room, alice, got, send } = await setup();
    await goToArea(alice, room, "sotano");
    const p = machinePoint(0);
    await walkToTile(alice, room, p.tileX, p.tileY);
    await send(alice, MSG.arcadeStart, { machine: 0 });
    expect(got.started).toEqual([{ machine: 0, game: "snake", token: expect.any(String), seed: 777 }]);
    // Muy rápido: el servidor mide la partida con su propio reloj.
    await send(alice, MSG.arcadeFinish, { token: got.started[0]!.token, score: 1 });
    expect(got.results.at(-1)).toEqual({ ok: false, error: "short" });
    await send(alice, MSG.arcadeStart, { machine: 0 });
    await tick(ARCADE.minMs);
    await send(alice, MSG.arcadeFinish, { token: got.started[1]!.token, score: 4 }, 120);
    expect(got.results.at(-1)).toMatchObject({ ok: true, score: 4, firstToday: true, record: true, board: [{ name: "Alice", score: 4 }] });
    expect(got.awards).toEqual([ARCADE.firstGameReward + ARCADE.recordReward]);
    expect(await repo.getPoints("u-alice")).toBe(ARCADE.firstGameReward + ARCADE.recordReward);
    await send(alice, MSG.arcadeBoard, { machine: 3 });
    expect(got.boards.at(-1)).toEqual({ machine: 3, game: "snake", board: [{ name: "Alice", score: 4 }] });
  }, 15_000);
});
