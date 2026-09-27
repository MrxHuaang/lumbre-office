import type { ColyseusTestServer } from "@colyseus/testing";
import { findPath, getWorld, isBlockedTile, pointsOfType } from "@hyvento/map";
import {
  ARCADE,
  ARCADE_MACHINES,
  ARCADE_PRICE,
  ARCADE_RECORD_MIN,
  ARCADE_STEP_MS,
  ArcadeRecorder,
  BloquesSim,
  encodeInput,
  noKeys,
  MSG,
  POINTS,
  ROOM_NAME,
  SNAKE,
  SnakeSim,
  type ArcadeBoard,
  type ArcadeKey,
  type ArcadeResult,
  type ArcadeStarted,
} from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { Arcade, atMachine } from "../src/rooms/arcade";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, goToArea, tick, token, walkToTile, type ServerRoom } from "./helpers";

// ---------- Una partida de verdad ----------

const MOVES: [ArcadeKey, number, number][] = [
  ["right", 1, 0],
  ["left", -1, 0],
  ["down", 0, 1],
  ["up", 0, -1],
];

/**
 * Juega Culebrita como el navegador (grabando las teclas): va a la manzana hasta tener `target` puntos y
 * después se estrella contra la pared o la cola. Devuelve lo que manda el cliente al terminar.
 */
function snakeGame(seed: number, target: number) {
  const sim = new SnakeSim(seed);
  const rec = new ArcadeRecorder();
  let last = "";
  while (!sim.over && rec.steps < 60 * 600) {
    const head = sim.body[0]!;
    const here = `${head.x},${head.y}`;
    if (here !== last) {
      last = here;
      const options = MOVES.filter(([, dx, dy]) => dx !== -sim.dir.x || dy !== -sim.dir.y).map(([k, dx, dy]) => {
        const x = head.x + dx;
        const y = head.y + dy;
        const safe = x >= 0 && y >= 0 && x < SNAKE.cols && y < SNAKE.rows && !sim.body.slice(0, -1).some((b) => b.x === x && b.y === y);
        const apple = x === sim.apple.x && y === sim.apple.y;
        return { k, dx, dy, safe, apple, dist: Math.abs(x - sim.apple.x) + Math.abs(y - sim.apple.y) };
      });
      const straight = (o: { dx: number; dy: number }) => (o.dx === sim.dir.x && o.dy === sim.dir.y ? 0 : 1);
      const pick =
        sim.score < target
          ? options.filter((o) => o.safe).sort((a, b) => a.dist - b.dist)[0]
          : (options.find((o) => !o.safe) ?? options.filter((o) => !o.apple).sort((a, b) => straight(a) - straight(b))[0]);
      if (pick && straight(pick)) {
        sim.press(pick.k);
        rec.press(pick.k);
      }
    }
    sim.step();
    rec.steps++;
  }
  if (sim.score !== target || !sim.over) throw new Error(`la culebrita hizo ${sim.score} y no ${target}`);
  return { score: sim.score, steps: rec.steps, inputs: rec.inputs, ms: rec.steps * ARCADE_STEP_MS };
}

type Played = ReturnType<typeof snakeGame>;
/** Lo que manda el cliente al terminar esa partida (se puede cambiar algo para hacer trampa). */
const finishMsg = (tok: string, g: Played, patch: Partial<{ score: number; steps: number; inputs: number[] }> = {}) => ({
  token: tok,
  score: g.score,
  steps: g.steps,
  inputs: g.inputs,
  ...patch,
});

// ---------- Reglas (sin sala) ----------

const SEED = 1234;
const sotano = () => getWorld().areas.get("sotano")!;
const machinePoint = (i: number) => pointsOfType(sotano(), "arcade")[i]!;
/** Alguien parado delante de la máquina `i`. */
const atM = (i: number, userId = "u-a") => ({ userId, name: userId.slice(2), x: machinePoint(i).x, y: machinePoint(i).y });

/** Saldo con el que arranca cada persona de las pruebas de reglas (alcanza para muchas partidas). */
const FUNDS = 1000;

async function arcade(funded = ["u-a", "u-b", "u-c", "u-d", "u-e"]) {
  const repo = new MemoryRepository();
  for (const userId of funded) await repo.awardPoints({ userId, amount: FUNDS, reason: "ADMIN" });
  const awards: { userId: string; amount: number }[] = [];
  const balances = new Map<string, number>();
  let n = 0;
  const a = new Arcade({
    repo: () => repo,
    seed: () => SEED,
    token: () => `t${++n}`,
    award: async (userId, amount) => {
      const { awarded } = await repo.awardPoints({ userId, amount, reason: "LEISURE" });
      awards.push({ userId, amount: awarded });
      return awarded;
    },
    setPoints: (userId, balance) => balances.set(userId, balance),
  });
  /** Empieza en la máquina 0 (Culebrita), juega hasta `target` y manda el resultado a su hora. */
  const playSnake = async (userId: string, target: number, machine = 0) => {
    const started = await a.start(sotano(), atM(machine, userId), { machine }, 0);
    if ("ok" in started) throw new Error(started.error);
    const g = snakeGame(started.seed, target);
    return a.finish(atM(machine, userId), finishMsg(started.token, g), g.ms + 200);
  };
  return { a, repo, awards, balances, playSnake };
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

  it("se empieza delante de una máquina que funciona, se cobra y el servidor da la semilla", async () => {
    const { a, repo, balances } = await arcade();
    const map = sotano();
    const balance = FUNDS - ARCADE_PRICE.machine;
    expect(await a.start(map, atM(0), { machine: 0 }, 0)).toEqual({ machine: 0, game: "snake", token: "t1", seed: SEED, balance });
    expect(await repo.getPoints("u-a")).toBe(balance);
    expect(balances.get("u-a")).toBe(balance);
    // Las máquinas de al lado quedan al alcance; las de más allá, no (y no se cobra).
    expect(await a.start(map, atM(0), { machine: 5 }, 0)).toEqual({ ok: false, error: "far" });
    const broken = ARCADE_MACHINES.indexOf(null);
    expect(await a.start(map, atM(broken), { machine: broken }, 0)).toEqual({ ok: false, error: "invalid" });
    expect(await repo.getPoints("u-a")).toBe(balance);
    expect(atMachine(map, 2, atM(2).x, atM(2).y)).toBe(true);
  });

  it("sin monedas para la partida no se juega (y no se abre ninguna partida)", async () => {
    const { a, repo } = await arcade([]);
    await repo.awardPoints({ userId: "u-a", amount: ARCADE_PRICE.machine - 1, reason: "ADMIN" });
    expect(await a.start(sotano(), atM(0), { machine: 0 }, 0)).toEqual({ ok: false, error: "funds" });
    expect(a.open).toBe(0);
    expect(await repo.getPoints("u-a")).toBe(ARCADE_PRICE.machine - 1);
    // Con justo lo que cuesta, sí.
    await repo.awardPoints({ userId: "u-a", amount: 1, reason: "ADMIN" });
    expect(await a.start(sotano(), atM(0), { machine: 0 }, 0)).toMatchObject({ game: "snake", balance: 0 });
  });

  it("Bloques también se valida repitiendo la partida con la semilla del servidor", async () => {
    const { a } = await arcade();
    const m = ARCADE_MACHINES.indexOf("bloques");
    expect(m).toBeGreaterThanOrEqual(0);
    const at = atM(m);
    // Sin tocar nada, las piezas se apilan hasta arriba: una partida de 0 filas, pero de verdad.
    const sim = new BloquesSim(SEED);
    let steps = 0;
    while (!sim.over) {
      sim.step(noKeys());
      steps++;
    }
    const played = { score: 0, steps, inputs: [] as number[], ms: steps * ARCADE_STEP_MS };
    const s1 = (await a.start(sotano(), at, { machine: m }, 0)) as ArcadeStarted;
    expect(s1.game).toBe("bloques");
    expect(await a.finish(at, finishMsg(s1.token, played, { score: 3 }), played.ms + 200)).toEqual({ ok: false, error: "implausible" });
    const s2 = (await a.start(sotano(), at, { machine: m }, 0)) as ArcadeStarted;
    expect(await a.finish(at, finishMsg(s2.token, played), played.ms + 200)).toMatchObject({ ok: true, game: "bloques", score: 0 });
  });

  it("una partida muy corta no cuenta (ni por las teclas ni por el reloj del servidor)", async () => {
    const { a, repo } = await arcade();
    // Sin girar, la culebrita se estrella en menos de 3 s.
    const crash = snakeGame(SEED, 0);
    expect(crash.ms).toBeLessThan(ARCADE.minMs);
    await a.start(sotano(), atM(0), { machine: 0 }, 0);
    expect(await a.finish(atM(0), finishMsg("t1", crash), 10_000)).toEqual({ ok: false, error: "short" });
    // Una partida larga que llega al servidor antes de la duración mínima.
    const g = snakeGame(SEED, 4);
    await a.start(sotano(), atM(0), { machine: 0 }, 0);
    expect(await a.finish(atM(0), finishMsg("t2", g), ARCADE.minMs - 1)).toEqual({ ok: false, error: "short" });
    expect(repo.arcade).toEqual([]);
  });

  it("el puntaje tiene que salir de repetir la partida con la semilla del servidor", async () => {
    const { a, repo } = await arcade();
    const g = snakeGame(SEED, 5);
    const tryFinish = async (patch: Parameters<typeof finishMsg>[2], at = g.ms + 200) => {
      const s = (await a.start(sotano(), atM(0), { machine: 0 }, 0)) as ArcadeStarted;
      return a.finish(atM(0), finishMsg(s.token, g, patch), at);
    };
    // Un punto de más.
    expect(await tryFinish({ score: g.score + 1 })).toEqual({ ok: false, error: "implausible" });
    // Esperar y mandar el máximo que antes se aceptaba: sin las teclas no hay partida que lo respalde.
    expect(await tryFinish({ score: 40, steps: 60 * 60, inputs: [] }, 61_000)).toEqual({ ok: false, error: "implausible" });
    // Más tiempo de juego que el que pasó en el servidor.
    expect(await tryFinish({}, g.ms - ARCADE.clockSlackMs - 100)).toEqual({ ok: false, error: "implausible" });
    // Teclas fuera de orden.
    expect(await tryFinish({ inputs: [encodeInput(50, 0, "up"), encodeInput(10, 0, "down")] })).toEqual({ ok: false, error: "implausible" });
    // La partida no terminó (se cortó antes de perder).
    expect(await tryFinish({ steps: g.steps - 30 })).toEqual({ ok: false, error: "implausible" });
    // Con otra semilla las mismas teclas no dan ese puntaje.
    const other = new Arcade({ repo: () => repo, seed: () => SEED + 1, token: () => "x", award: async () => 0, setPoints: () => undefined });
    await other.start(sotano(), atM(0), { machine: 0 }, 0);
    expect(await other.finish(atM(0), finishMsg("x", g), g.ms + 200)).toEqual({ ok: false, error: "implausible" });
    expect(repo.arcade).toEqual([]);
    // La de verdad sí.
    expect(await tryFinish({})).toMatchObject({ ok: true, score: 5 });
  });

  it("el token es de una sola partida y de esa persona; una partida vieja se vence", async () => {
    const { a } = await arcade();
    const g = snakeGame(SEED, 3);
    const at = g.ms + 200;
    await a.start(sotano(), atM(0), { machine: 0 }, 0);
    expect(await a.finish(atM(0, "u-b"), finishMsg("t1", g), at)).toEqual({ ok: false, error: "expired" });
    expect(await a.finish(atM(0), finishMsg("otro", g), at)).toEqual({ ok: false, error: "expired" });
    await a.start(sotano(), atM(0), { machine: 0 }, 0);
    expect((await a.finish(atM(0), finishMsg("t2", g), at)).ok).toBe(true);
    expect(await a.finish(atM(0), finishMsg("t2", g), at + 1000)).toEqual({ ok: false, error: "expired" });
    await a.start(sotano(), atM(0), { machine: 0 }, 0);
    expect(await a.finish(atM(0), finishMsg("t3", g), ARCADE.sessionMs + 1)).toEqual({ ok: false, error: "expired" });
  });

  it("la primera partida del día da premio y el récord solo si le gana al de otra persona", async () => {
    const { playSnake, awards } = await arcade();
    const min = ARCADE_RECORD_MIN.snake;
    // Primera del día y récord, pero muy chico para cobrarlo.
    expect(await playSnake("u-a", 3)).toMatchObject({ ok: true, firstToday: true, record: true, awarded: ARCADE.firstGameReward });
    // Superar el propio récord no paga (ni aunque pase el mínimo).
    expect(await playSnake("u-a", min + 1)).toMatchObject({ ok: true, firstToday: false, record: true, awarded: 0 });
    // Otra persona: su primera del día, pero no le gana al récord.
    expect(await playSnake("u-b", min, 3)).toMatchObject({ firstToday: true, record: false, awarded: ARCADE.firstGameReward });
    // Le gana al récord de otra persona: ahí sí.
    const best = await playSnake("u-b", min + 3, 3);
    expect(best).toMatchObject({ record: true, awarded: ARCADE.recordReward });
    expect(best.ok && best.board).toEqual([
      { name: "b", score: min + 3 },
      { name: "a", score: min + 1 },
    ]);
    // Y la primera persona lo recupera.
    expect(await playSnake("u-a", min + 4)).toMatchObject({ record: true, awarded: ARCADE.recordReward });
    expect(awards.map((w) => w.userId)).toEqual(["u-a", "u-b", "u-b", "u-a"]);
  });

  it("los premios respetan el tope diario de ocio", async () => {
    const { repo, playSnake } = await arcade();
    await repo.awardPoints({ userId: "u-a", amount: POINTS.leisureDailyCap - 2, reason: "LEISURE" });
    expect(await playSnake("u-a", 3)).toMatchObject({ ok: true, awarded: 2 });
    expect(await repo.getPoints("u-a")).toBe(FUNDS - ARCADE_PRICE.machine + POINTS.leisureDailyCap);
  });

  it("la tabla de récords muestra el mejor puntaje de cada persona y se guarda unos segundos", async () => {
    const { a, repo, playSnake } = await arcade();
    const week = 0;
    repo.arcade.push(
      { userId: "u-a", name: "Ana", game: "breakout", score: 30, at: week },
      { userId: "u-a", name: "Ana", game: "breakout", score: 50, at: week },
      { userId: "u-b", name: "Beto", game: "breakout", score: 40, at: week },
      { userId: "u-c", name: "Caro", game: "snake", score: 99, at: week },
    );
    const board = [
      { name: "Ana", score: 50 },
      { name: "Beto", score: 40 },
    ];
    // Todo es del mismo día: la tabla de hoy es igual a la de la semana.
    expect(await a.board({ machine: 1 }, week)).toEqual({ machine: 1, game: "breakout", board, today: board });
    expect(await a.board({ machine: ARCADE_MACHINES.indexOf(null) }, week)).toBeNull();
    // Pedirla otra vez enseguida no vuelve a leer el repositorio.
    repo.arcade.push({ userId: "u-d", name: "Dani", game: "breakout", score: 60, at: week });
    expect((await a.board({ machine: 1 }, week + 1000))?.board).toEqual(board);
    expect((await a.board({ machine: 1 }, week + ARCADE.boardCacheMs))?.board[0]).toEqual({ name: "Dani", score: 60 });
    // Guardar una partida la refresca.
    expect((await a.board({ machine: 0 }, week))?.board).toEqual([{ name: "Caro", score: 99 }]);
    await playSnake("u-e", 3);
    expect((await a.board({ machine: 0 }, week + 10))?.board).toHaveLength(2);
  });
});

// ---------- En la sala ----------

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
let clock = 0;
const defaultSeed = OfficeRoom.arcadeSeed;
const defaultNow = OfficeRoom.arcadeNow;

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
  clock = Date.now();
  OfficeRoom.arcadeNow = () => clock;
});
afterEach(() => {
  OfficeRoom.arcadeSeed = defaultSeed;
  OfficeRoom.arcadeNow = defaultNow;
});

async function setup(points = 100) {
  if (points > 0) await repo.awardPoints({ userId: "u-alice", amount: points, reason: "ADMIN" });
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
  it("sin monedas no se empieza: se avisa y no llega semilla", async () => {
    const { room, alice, got, send } = await setup(0);
    await goToArea(alice, room, "sotano");
    const p = machinePoint(1);
    await walkToTile(alice, room, p.tileX, p.tileY);
    await send(alice, MSG.arcadeStart, { machine: 1 });
    expect(got.results).toEqual([{ ok: false, error: "funds" }]);
    expect(got.started).toEqual([]);
  });

  it("lejos de la máquina no se empieza", async () => {
    const { alice, got, send } = await setup();
    await send(alice, MSG.arcadeStart, { machine: 0 });
    expect(got.results).toEqual([{ ok: false, error: "far" }]);
    expect(got.started).toEqual([]);
  });

  it("delante de la máquina se juega: semilla, partida repetida en el servidor y premio", async () => {
    const { room, alice, got, send } = await setup();
    await goToArea(alice, room, "sotano");
    const p = machinePoint(0);
    await walkToTile(alice, room, p.tileX, p.tileY);
    await send(alice, MSG.arcadeStart, { machine: 0 });
    // Se cobró la partida: el saldo nuevo viene en la respuesta y en el jugador.
    const fee = ARCADE_PRICE.machine;
    expect(got.started).toEqual([{ machine: 0, game: "snake", token: expect.any(String), seed: 777, balance: 100 - fee }]);
    expect(room.state.players.get(alice.sessionId)!.points).toBe(100 - fee);
    const target = ARCADE_RECORD_MIN.snake;
    const g = snakeGame(777, target);
    // Muy rápido para el reloj del servidor.
    clock += 1000;
    await send(alice, MSG.arcadeFinish, finishMsg(got.started[0]!.token, g));
    expect(got.results.at(-1)).toEqual({ ok: false, error: "short" });
    await send(alice, MSG.arcadeStart, { machine: 0 });
    clock += g.ms + 300;
    await send(alice, MSG.arcadeFinish, finishMsg(got.started[1]!.token, g), 120);
    expect(got.results.at(-1)).toMatchObject({ ok: true, score: target, firstToday: true, record: true, board: [{ name: "Alice", score: target }] });
    expect(got.awards).toEqual([ARCADE.firstGameReward + ARCADE.recordReward]);
    expect(await repo.getPoints("u-alice")).toBe(100 - 2 * fee + ARCADE.firstGameReward + ARCADE.recordReward);
    await send(alice, MSG.arcadeBoard, { machine: 3 });
    expect(got.boards.at(-1)).toEqual({ machine: 3, game: "snake", board: [{ name: "Alice", score: target }], today: [{ name: "Alice", score: target }] });
  });
});
