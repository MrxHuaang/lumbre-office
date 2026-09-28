import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, pointsOfType } from "@hyvento/map";
import {
  FISHING,
  MSG,
  POINTS,
  RARITY,
  ROOM_NAME,
  FishingSim,
  autoplay,
  fishById,
  fishPool,
  type FishingChallenge,
  type FishingEvent,
  type PointsAwarded,
} from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, c, tick, token, walkTo, walkToTile, type ServerRoom } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;

// Reloj real fijo (para los tiempos del minijuego). La hora de los peces es la del juego: mediodía.
const NOON = Date.UTC(2026, 8, 26, 17, 0);
const gameAt = (hour: number) => ({ anchorReal: NOON, anchorMinute: 3 * 1440 + hour * 60 });
const SEED = 12345;

/**
 * Azar de los tests, según qué se sortea (el tamaño de `n` lo delata): la espera, el pez (`pick`: 0 es el
 * primero que pica a esa hora), la semilla, el cofre y el tamaño (`size` de 0 a 10000).
 */
function fixedRandom(o: { pick?: number; treasure?: boolean; size?: number } = {}) {
  return (n: number) => {
    if (n === 2 ** 31) return SEED;
    if (n === 1000) return o.treasure ? 0 : 999;
    if (n === 10_001) return o.size ?? 0;
    if (n <= 100) return 0; // la espera
    return Math.min(n - 1, o.pick ?? 0);
  };
}

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
  OfficeRoom.fishingNow = () => NOON;
  OfficeRoom.gameClockNow = () => NOON;
  OfficeRoom.gameClockInitial = gameAt(12);
  OfficeRoom.weatherInitial = "despejado";
  OfficeRoom.fishingRandom = fixedRandom();
  // Tiempos cortos y margen amplio: el minijuego se "juega" al instante con el jugador automático.
  OfficeRoom.fishingTimings = { ...FISHING, biteMinMs: 40, biteMaxMs: 60, biteWindowMs: 500, slackMs: 60_000, showMs: 300 };
});
afterEach(() => {
  OfficeRoom.fishingNow = () => Date.now();
  OfficeRoom.gameClockNow = () => Date.now();
  OfficeRoom.gameClockInitial = null;
  OfficeRoom.fishingTimings = { ...FISHING };
});

const jardin = getWorld().areas.get("jardin")!;
const spot = pointsOfType(jardin, "fishing_spot")[0]!;

async function waitFor<T>(fn: () => T | undefined, ms = 3000): Promise<T> {
  const until = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v !== undefined) return v;
    if (Date.now() > until) throw new Error("No llegó a tiempo");
    await tick(15);
  }
}

/** Alice entra al jardín y (salvo `atSpot: false`) camina hasta la punta del muelle. */
async function setup(atSpot = true) {
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  await room.waitForNextPatch();
  if (atSpot) await walkToTile(alice, room, spot.tileX, spot.tileY);
  const events: FishingEvent[] = [];
  const awards: PointsAwarded[] = [];
  alice.onMessage(MSG.fishEvent, (e: FishingEvent) => events.push(e));
  alice.onMessage(MSG.pointsAwarded, (a: PointsAwarded) => awards.push(a));
  const me = () => room.state.players.get(alice.sessionId)!;
  const next = <K extends FishingEvent["type"]>(type: K) =>
    waitFor(() => events.find((e): e is Extract<FishingEvent, { type: K }> => e.type === type));
  return { room, alice, events, awards, me, next };
}

/** Lanza, espera la picada, responde y devuelve el minijuego. */
async function hooked(s: Awaited<ReturnType<typeof setup>>) {
  s.alice.send(MSG.fishCast);
  const cast = await s.next("cast");
  await s.next("bite");
  s.alice.send(MSG.fishHook, { castId: cast.castId });
  const start = await s.next("start");
  return { castId: cast.castId, challenge: start.challenge };
}

function play(challenge: FishingChallenge, chaseTreasure = false) {
  return autoplay(challenge, { chaseTreasure });
}

describe("pesca", () => {
  it("lejos del lago no se puede lanzar", async () => {
    const s = await setup(false);
    s.alice.send(MSG.fishCast);
    expect(await s.next("refused")).toEqual({ type: "refused", error: "far" });
    expect(s.me().fishing).toBe("");
  });

  it("lanzar, esperar la picada, sacar el pez: se guarda con su tamaño y da puntos de ocio", async () => {
    OfficeRoom.fishingTimings = { ...OfficeRoom.fishingTimings, biteMinMs: 300, biteMaxMs: 300 };
    const s = await setup();
    s.alice.send(MSG.fishCast);
    const cast = await s.next("cast");
    await s.room.waitForNextPatch();
    expect(s.me().fishing).toBe("wait");
    const bite = await s.next("bite");
    expect(bite.windowMs).toBe(500);
    await s.room.waitForNextPatch();
    expect(s.me().fishing).toBe("bite");

    s.alice.send(MSG.fishHook, { castId: cast.castId });
    const { challenge } = await s.next("start");
    const mojarra = fishById("mojarra")!;
    // El primero que pica al mediodía es la mojarra; el minijuego trae su dificultad, no su nombre.
    expect(challenge).toEqual({ seed: SEED, difficulty: mojarra.difficulty, behavior: mojarra.behavior, rarity: "comun", treasure: false });
    await s.room.waitForNextPatch();
    expect(s.me().fishing).toBe("reel");

    const run = play(challenge);
    expect(run.caught).toBe(true);
    s.alice.send(MSG.fishFinish, { castId: cast.castId, frames: run.frames, inputs: run.inputs });
    const end = await s.next("end");
    expect(end).toEqual({
      type: "end",
      castId: cast.castId,
      outcome: "caught",
      catch: { species: "mojarra", size: mojarra.size[0], record: true, first: true, points: RARITY.comun.points, treasure: false },
    });
    expect(repo.catches).toEqual([expect.objectContaining({ userId: "u-alice", species: "mojarra", size: mojarra.size[0] })]);
    expect(repo.ledger.at(-1)).toMatchObject({ userId: "u-alice", amount: RARITY.comun.points, reason: "LEISURE" });
    expect(await waitFor(() => s.awards.at(-1))).toEqual({ amount: RARITY.comun.points, reason: "LEISURE", balance: RARITY.comun.points });
    await s.room.waitForNextPatch();
    // Lo levanta para que lo vean todos, y al rato lo baja.
    expect(s.me().fishing).toBe("show:mojarra");
    expect(s.me().points).toBe(RARITY.comun.points);
    await tick(400);
    await s.room.waitForNextPatch();
    expect(s.me().fishing).toBe("");
  });

  it("los peces siguen la hora del juego, no la real: a medianoche del juego pican los de noche", async () => {
    OfficeRoom.gameClockInitial = gameAt(0);
    // El azar cae justo en el primer pez que solo pica de noche (el reloj real sigue en el mediodía).
    const pool = fishPool(0);
    const i = pool.findIndex((p) => p.fish.time === "noche");
    const night = pool[i]!.fish;
    OfficeRoom.fishingRandom = fixedRandom({ pick: pool.slice(0, i).reduce((a, p) => a + p.weight, 0) });
    expect(fishPool(12).some((p) => p.fish.id === night.id)).toBe(false);
    const s = await setup();
    const h = await hooked(s);
    expect(h.challenge.difficulty).toBe(night.difficulty);
    const run = play(h.challenge);
    s.alice.send(MSG.fishFinish, { castId: h.castId, frames: run.frames, inputs: run.inputs });
    const end = await s.next("end");
    expect(end.catch?.species).toBe(night.id);
  });

  it("un pez más grande que el anterior es récord; uno más chico no", async () => {
    const s = await setup();
    OfficeRoom.fishingRandom = fixedRandom({ size: 5000 });
    let h = await hooked(s);
    let run = play(h.challenge);
    s.alice.send(MSG.fishFinish, { castId: h.castId, frames: run.frames, inputs: run.inputs });
    await waitFor(() => (s.events.some((e) => e.type === "end") ? true : undefined));
    s.events.length = 0;
    await tick(350);

    OfficeRoom.fishingRandom = fixedRandom({ size: 0 });
    h = await hooked(s);
    run = play(h.challenge);
    s.alice.send(MSG.fishFinish, { castId: h.castId, frames: run.frames, inputs: run.inputs });
    const end = await s.next("end");
    expect(end.catch).toMatchObject({ species: "mojarra", record: false, first: false });
  });

  it("si no respondes a la picada, el pez se va", async () => {
    const s = await setup();
    s.alice.send(MSG.fishCast);
    await s.next("bite");
    const end = await s.next("end");
    expect(end.outcome).toBe("missed");
    await s.room.waitForNextPatch();
    expect(s.me().fishing).toBe("");
    expect(repo.catches).toHaveLength(0);
  });

  it("responder antes de que pique asusta al pez", async () => {
    OfficeRoom.fishingTimings = { ...OfficeRoom.fishingTimings, biteMinMs: 5000, biteMaxMs: 5000 };
    const s = await setup();
    s.alice.send(MSG.fishCast);
    const cast = await s.next("cast");
    s.alice.send(MSG.fishHook, { castId: cast.castId });
    expect((await s.next("end")).outcome).toBe("early");
  });

  it("terminar sin picada, o con otro id, no da nada", async () => {
    const s = await setup();
    s.alice.send(MSG.fishFinish, { castId: "inventado", frames: 400, inputs: [] });
    expect((await s.next("end")).outcome).toBe("invalid");
    s.events.length = 0;

    const h = await hooked(s);
    const run = play(h.challenge);
    s.alice.send(MSG.fishFinish, { castId: "otro", frames: run.frames, inputs: run.inputs });
    expect(await s.next("end")).toMatchObject({ castId: "otro", outcome: "invalid" });
    expect(repo.catches).toHaveLength(0);
    // El minijuego verdadero sigue en pie.
    expect(s.me().fishing).toBe("reel");
  });

  it("un tiempo imposible (terminar enseguida) se rechaza", async () => {
    OfficeRoom.fishingTimings = { ...OfficeRoom.fishingTimings, slackMs: 200 };
    const s = await setup();
    const h = await hooked(s);
    const run = play(h.challenge);
    s.alice.send(MSG.fishFinish, { castId: h.castId, frames: run.frames, inputs: run.inputs });
    expect((await s.next("end")).outcome).toBe("invalid");
    expect(repo.catches).toHaveLength(0);
    expect(await repo.getPoints("u-alice")).toBe(0);
  });

  it("botones que no terminan la partida como dice el cliente se rechazan", async () => {
    const s = await setup();
    const h = await hooked(s);
    // Sin apretar nunca, el pez no se saca en 400 frames: no cuadra.
    s.alice.send(MSG.fishFinish, { castId: h.castId, frames: 400, inputs: [] });
    expect((await s.next("end")).outcome).toBe("invalid");
    expect(repo.catches).toHaveLength(0);
  });

  it("si el pez se escapa en el minijuego, no hay captura", async () => {
    const s = await setup();
    const h = await hooked(s);
    // Apretar todo el tiempo: la barra se queda arriba y el pez (abajo) se escapa.
    let frames = 0;
    const sim = new FishingSim(h.challenge);
    while (!sim.done) {
      sim.step(true);
      frames++;
    }
    expect(sim.caught).toBe(false);
    s.alice.send(MSG.fishFinish, { castId: h.castId, frames, inputs: [0] });
    expect((await s.next("end")).outcome).toBe("escaped");
    expect(repo.catches).toHaveLength(0);
  });

  it("mandar el resultado dos veces solo cuenta una", async () => {
    const s = await setup();
    const h = await hooked(s);
    const run = play(h.challenge);
    const msg = { castId: h.castId, frames: run.frames, inputs: run.inputs };
    s.alice.send(MSG.fishFinish, msg);
    s.alice.send(MSG.fishFinish, msg);
    await waitFor(() => (s.events.filter((e) => e.type === "end").length >= 2 ? true : undefined));
    const ends = s.events.filter((e) => e.type === "end");
    expect(ends.map((e) => e.outcome).sort()).toEqual(["caught", "invalid"]);
    expect(repo.catches).toHaveLength(1);
    expect(repo.ledger.filter((m) => m.reason === "LEISURE")).toHaveLength(1);
  });

  it("moverse recoge el sedal", async () => {
    const s = await setup();
    s.alice.send(MSG.fishCast);
    await s.next("cast");
    const p = s.me();
    await walkTo(s.alice, s.room, p.x - 20, p.y);
    expect((await s.next("end")).outcome).toBe("cancelled");
    expect(s.me().fishing).toBe("");
  });

  it("Esc (cancelar) recoge el sedal y se puede volver a lanzar", async () => {
    const s = await setup();
    s.alice.send(MSG.fishCast);
    await s.next("cast");
    s.alice.send(MSG.fishCast);
    expect(await s.next("refused")).toEqual({ type: "refused", error: "busy" });
    s.alice.send(MSG.fishCancel);
    expect((await s.next("end")).outcome).toBe("cancelled");
    s.events.length = 0;
    s.alice.send(MSG.fishCast);
    await s.next("cast");
  });

  it("los puntos de la pesca respetan el tope diario de ocio", async () => {
    await repo.awardPoints({ userId: "u-alice", amount: POINTS.leisureDailyCap - 1, reason: "LEISURE" });
    const s = await setup();
    const h = await hooked(s);
    const run = play(h.challenge);
    s.alice.send(MSG.fishFinish, { castId: h.castId, frames: run.frames, inputs: run.inputs });
    const end = await s.next("end");
    // La mojarra da 2, pero solo quedaba 1 para hoy. El pez igual se guarda.
    expect(end.catch?.points).toBe(1);
    expect(repo.catches).toHaveLength(1);
    const leisure = repo.ledger.filter((m) => m.reason === "LEISURE").reduce((a, m) => a + m.amount, 0);
    expect(leisure).toBe(POINTS.leisureDailyCap);
  });

  it("el tamaño lo sortea el servidor dentro del rango del pez", async () => {
    OfficeRoom.fishingRandom = fixedRandom({ size: 10_000 });
    const s = await setup();
    const h = await hooked(s);
    const run = play(h.challenge);
    s.alice.send(MSG.fishFinish, { castId: h.castId, frames: run.frames, inputs: run.inputs });
    const end = await s.next("end");
    expect(end.catch?.size).toBe(fishById("mojarra")!.size[1]);
  });

  it("el cofre de tesoro da puntos extra si se saca", async () => {
    OfficeRoom.fishingRandom = fixedRandom({ treasure: true });
    const s = await setup();
    const h = await hooked(s);
    expect(h.challenge.treasure).toBe(true);
    const run = play(h.challenge, true);
    expect(run.treasure).toBe(true);
    s.alice.send(MSG.fishFinish, { castId: h.castId, frames: run.frames, inputs: run.inputs });
    const end = await s.next("end");
    expect(end.catch).toMatchObject({ treasure: true, points: RARITY.comun.points + FISHING.treasureBonus });
  });

  it("la basura sale sin minijuego y sin puntos", async () => {
    const pool = fishPool(12);
    const total = pool.reduce((a, p) => a + p.weight, 0);
    expect(pool.at(-1)!.fish.id).toBe("lata");
    OfficeRoom.fishingRandom = fixedRandom({ pick: total - 1 });
    const s = await setup();
    s.alice.send(MSG.fishCast);
    const cast = await s.next("cast");
    await s.next("bite");
    s.alice.send(MSG.fishHook, { castId: cast.castId });
    const end = await s.next("end");
    expect(end).toMatchObject({ outcome: "caught", catch: { species: "lata", points: 0 } });
    expect(s.events.some((e) => e.type === "start")).toBe(false);
    expect(repo.catches.map((x) => x.species)).toEqual(["lata"]);
    expect(await repo.getPoints("u-alice")).toBe(0);
  });

  it("los demás ven el estado de la caña", async () => {
    const s = await setup();
    const bob = await colyseus.connectTo(s.room, { token: await token("u-bob", "Bob") });
    await s.room.waitForNextPatch();
    s.alice.send(MSG.fishCast);
    await s.next("cast");
    await s.room.waitForNextPatch();
    await tick(30);
    const seen = (bob as ClientRoom<OfficeState>).state.players.get(s.alice.sessionId)?.fishing;
    expect(["wait", "bite"]).toContain(seen);
  });
});

// El punto de pesca queda junto al agua: con `c` se revisa que el helper del tile sea el esperado.
it("el punto de pesca de los tests es la punta del muelle", () => {
  expect(spot.name).toBe("Muelle");
  expect(spot.x).toBe(c(spot.tileX));
});
