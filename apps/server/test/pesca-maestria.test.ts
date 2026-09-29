import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, pointsOfType } from "@hyvento/map";
import {
  BAIT_TUNING,
  FISHING,
  GROUP_FISHING,
  MSG,
  NIBBLES,
  ROD_MASTERY,
  ROOM_NAME,
  autoplay,
  rodCatchesKey,
  type FishingEvent,
  type FishingPhase,
  type FishingRod,
} from "@hyvento/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { Fishery } from "../src/rooms/fishing";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, tick, token, walkToTile, type ServerRoom } from "./helpers";

const SEED = 777;

/** Azar fijo según qué se sortea: la semilla, el cofre (nunca), el tamaño (el menor) y el resto en 0. */
function baseRandom(n: number) {
  if (n === 2 ** 31) return SEED;
  if (n === 1000) return 999;
  return 0;
}

/**
 * Una pesca con reloj de mentira: `later` guarda los avisos y `advance` los dispara en orden. Así se ven los
 * mordisqueos, la picada y la compañía sin esperar de verdad.
 */
function fakeFishery(o: { random?: (n: number) => number; rodCatches?: (userId: string, rod: FishingRod) => number; wait?: number } = {}) {
  let now = 0;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const events: { userId: string; e: FishingEvent }[] = [];
  const phases: { userId: string; phase: FishingPhase }[] = [];
  const caught: { userId: string; rod: FishingRod }[] = [];
  const wait = o.wait ?? 6_000;
  const fishery = new Fishery({
    later: (ms, fn) => {
      const id = ++seq;
      timers.set(id, { at: now + ms, fn });
      return { clear: () => timers.delete(id) };
    },
    now: () => now,
    random: o.random ?? baseRandom,
    timings: () => ({ ...FISHING, biteMinMs: wait, biteMaxMs: wait, slackMs: 120_000 }),
    hour: () => 12,
    repo: () => ({ saveFishCatch: async () => ({ previousBest: null, awarded: 1, balance: 1 }) }),
    newId: () => `lance-${++seq}`,
    setPhase: (userId, phase) => phases.push({ userId, phase }),
    send: (userId, e) => events.push({ userId, e }),
    points: () => {},
    rodCatches: o.rodCatches,
    caught: (userId, _fish, _size, _first, _treasure, rod) => caught.push({ userId, rod }),
  });
  const advance = (ms: number) => {
    const until = now + ms;
    for (;;) {
      const next = [...timers.entries()].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      timers.delete(next[0]);
      now = next[1].at;
      next[1].fn();
    }
    now = until;
  };
  const of = <K extends FishingEvent["type"]>(userId: string, type: K) =>
    events.filter((x) => x.userId === userId && x.e.type === type).map((x) => x.e as Extract<FishingEvent, { type: K }>);
  return { fishery, advance, events, phases, caught, of, now: () => now };
}

/** Dos mordisqueos: el primer sorteo (cuántos) da 2 y cada uno cae al principio de la franja. */
const twoNibbles = (n: number) => (n === NIBBLES.max + 1 ? 2 : baseRandom(n));
const at = (userId: string, x = 100, y = 100, area = "jardin") => ({ userId, x, y, seated: false, area });

describe("pesca: mordisqueos", () => {
  it("la boya tiembla antes de la picada (fase nibble para todos) y vuelve a esperar", () => {
    const f = fakeFishery({ random: twoNibbles });
    f.fishery.cast(at("a"), true);
    f.advance(NIBBLES.marginMs);
    expect(f.of("a", "nibble")).toHaveLength(2);
    expect(f.phases.at(-1)).toEqual({ userId: "a", phase: "nibble" });
    f.advance(NIBBLES.showMs);
    expect(f.phases.at(-1)).toEqual({ userId: "a", phase: "wait" });
    expect(f.fishery.phaseOf("a")).toBe("wait");
    // La picada de verdad llega igual después.
    f.advance(6_000);
    expect(f.of("a", "bite")).toHaveLength(1);
  });

  it("responder a un mordisqueo con carnada: el pez se la lleva (stolen)", () => {
    const f = fakeFishery({ random: twoNibbles });
    const cast = f.fishery.cast(at("a"), true, { rod: "bambu", bait: "carnada" });
    expect(cast).toBe(true);
    f.advance(NIBBLES.marginMs + 100);
    const { castId } = f.of("a", "cast")[0]!;
    f.fishery.hook("a", { castId });
    expect(f.of("a", "end")[0]).toMatchObject({ outcome: "stolen" });
    expect(f.fishery.phaseOf("a")).toBeNull();
  });

  it("sin carnada, responder al mordisqueo solo asusta al pez (early)", () => {
    const f = fakeFishery({ random: twoNibbles });
    f.fishery.cast(at("a"), true);
    f.advance(NIBBLES.marginMs + 100);
    f.fishery.hook("a", { castId: f.of("a", "cast")[0]!.castId });
    expect(f.of("a", "end")[0]).toMatchObject({ outcome: "early" });
  });

  it("responder mucho después del mordisqueo es un apuro común (early), no un robo", () => {
    const f = fakeFishery({ random: (n) => (n === NIBBLES.max + 1 ? 1 : baseRandom(n)) });
    f.fishery.cast(at("a"), true, { rod: "bambu", bait: "carnada" });
    f.advance(NIBBLES.marginMs + NIBBLES.trapMs + 200);
    f.fishery.hook("a", { castId: f.of("a", "cast")[0]!.castId });
    expect(f.of("a", "end")[0]).toMatchObject({ outcome: "early" });
  });

  it("con una espera corta no hay mordisqueos, y recoger el sedal los borra", () => {
    const short = fakeFishery({ random: twoNibbles, wait: NIBBLES.minWaitMs - 1 });
    short.fishery.cast(at("a"), true);
    short.advance(NIBBLES.minWaitMs);
    expect(short.of("a", "nibble")).toHaveLength(0);

    const f = fakeFishery({ random: twoNibbles });
    f.fishery.cast(at("a"), true);
    f.fishery.cancel("a");
    f.advance(10_000);
    expect(f.of("a", "nibble")).toHaveLength(0);
    expect(f.of("a", "bite")).toHaveLength(0);
  });
});

describe("pesca: en grupo", () => {
  it("con otra caña en el agua cerca y en el mismo nivel, el minijuego y la captura lo dicen", async () => {
    const f = fakeFishery({ wait: 500 });
    f.fishery.cast(at("a", 100, 100), true);
    f.fishery.cast(at("b", 100 + GROUP_FISHING.radius, 100), true);
    f.advance(500);
    f.fishery.hook("a", { castId: f.of("a", "cast")[0]!.castId });
    const start = f.of("a", "start")[0]!;
    expect(start.group).toBe(true);
    const run = autoplay(start.challenge);
    await f.fishery.finish("a", { castId: start.castId, frames: run.frames, inputs: run.inputs });
    expect(f.of("a", "end")[0]!.catch).toMatchObject({ group: true });
  });

  it("lejos, en otro nivel o sin nadie pescando, no cuenta", () => {
    for (const other of [at("b", 100 + GROUP_FISHING.radius + 1, 100), at("b", 100, 100, "sotano"), null]) {
      const f = fakeFishery({ wait: 500 });
      f.fishery.cast(at("a", 100, 100), true);
      if (other) f.fishery.cast(other, true);
      f.advance(500);
      f.fishery.hook("a", { castId: f.of("a", "cast")[0]!.castId });
      expect(f.of("a", "start")[0]!.group).toBeUndefined();
    }
  });

  it("la compañía sube los raros: el mismo sorteo saca otro pez", () => {
    // El sorteo del pez cae en el último peso posible: con más suerte, el total crece y cambia lo que sale.
    const totals: number[] = [];
    const spy = (n: number) => {
      if (n > 1000 && n !== 10_001 && n !== 2 ** 31) totals.push(n);
      return baseRandom(n);
    };
    const solo = fakeFishery({ wait: 500, random: spy });
    solo.fishery.cast(at("a"), true, { rod: "bambu", bait: "carnada" });
    solo.advance(500);
    solo.fishery.hook("a", { castId: solo.of("a", "cast")[0]!.castId });
    const together = fakeFishery({ wait: 500, random: spy });
    together.fishery.cast(at("a"), true, { rod: "bambu", bait: "carnada" });
    together.fishery.cast(at("b", 110, 100), true);
    together.advance(500);
    together.fishery.hook("a", { castId: together.of("a", "cast")[0]!.castId });
    expect(totals).toHaveLength(2);
    // Con carnada (1,3) y compañía (×1,25) los raros pesan más: el total del sorteo es mayor.
    expect(totals[1]!).toBeGreaterThan(totals[0]!);
    expect(BAIT_TUNING.carnada.luck).toBeGreaterThan(1);
  });
});

describe("pesca: maestría de la caña", () => {
  it("el lance dice el nivel de la caña y el minijuego lo lleva (la barra es más larga)", () => {
    const f = fakeFishery({ wait: 500, rodCatches: (_u, rod) => (rod === "fibra" ? ROD_MASTERY.levels[1]! : 0) });
    f.fishery.cast(at("a"), true, { rod: "fibra", bait: null });
    expect(f.of("a", "cast")[0]!.mastery).toEqual({ rod: "fibra", level: 2, next: ROD_MASTERY.levels[2]! - ROD_MASTERY.levels[1]! });
    f.advance(500);
    f.fishery.hook("a", { castId: f.of("a", "cast")[0]!.castId });
    expect(f.of("a", "start")[0]!.challenge).toMatchObject({ rod: "fibra", mastery: 2 });
  });

  it("sin peces con esa caña el minijuego no cambia (sin `mastery`)", () => {
    const f = fakeFishery({ wait: 500, rodCatches: () => 0 });
    f.fishery.cast(at("a"), true);
    expect(f.of("a", "cast")[0]!.mastery).toEqual({ rod: "bambu", level: 0, next: ROD_MASTERY.levels[0] });
    f.advance(500);
    f.fishery.hook("a", { castId: f.of("a", "cast")[0]!.castId });
    expect(f.of("a", "start")[0]!.challenge.mastery).toBeUndefined();
  });

  it("el pez que completa el nivel lo anuncia y la validación repite con esa barra", async () => {
    const f = fakeFishery({ wait: 500, rodCatches: () => ROD_MASTERY.levels[0]! - 1 });
    f.fishery.cast(at("a"), true);
    f.advance(500);
    f.fishery.hook("a", { castId: f.of("a", "cast")[0]!.castId });
    const start = f.of("a", "start")[0]!;
    const run = autoplay(start.challenge);
    await f.fishery.finish("a", { castId: start.castId, frames: run.frames, inputs: run.inputs });
    expect(f.of("a", "end")[0]).toMatchObject({ outcome: "caught", catch: { masteryUp: 1 } });
    expect(f.caught).toEqual([{ userId: "a", rod: "bambu" }]);
  });
});

// ---------- En la sala ----------

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
const NOON = Date.UTC(2026, 8, 26, 17, 0);
const jardin = getWorld().areas.get("jardin")!;
const spot = pointsOfType(jardin, "fishing_spot")[0]!;

describe("pesca: maestría en la sala", () => {
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
    OfficeRoom.gameClockInitial = { anchorReal: NOON, anchorMinute: 3 * 1440 + 12 * 60 };
    OfficeRoom.weatherInitial = "despejado";
    OfficeRoom.fishingRandom = baseRandom;
    OfficeRoom.fishingTimings = { ...FISHING, biteMinMs: 40, biteMaxMs: 60, biteWindowMs: 500, slackMs: 60_000, showMs: 300 };
  });
  afterEach(() => {
    OfficeRoom.fishingNow = () => Date.now();
    OfficeRoom.gameClockNow = () => Date.now();
    OfficeRoom.gameClockInitial = null;
    OfficeRoom.fishingTimings = { ...FISHING };
  });

  async function waitFor<T>(fn: () => T | undefined, ms = 3000): Promise<T> {
    const until = Date.now() + ms;
    for (;;) {
      const v = fn();
      if (v !== undefined) return v;
      if (Date.now() > until) throw new Error("No llegó a tiempo");
      await tick(15);
    }
  }

  it("la caña guarda sus peces en las estadísticas (UserStat) y con eso sube de nivel", async () => {
    // Le falta un pez para el nivel 1 con la de bambú.
    repo.userStats.set("u-alice", new Map([[rodCatchesKey("bambu"), ROD_MASTERY.levels[0]! - 1]]));
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    await room.waitForNextPatch();
    await walkToTile(alice, room, spot.tileX, spot.tileY);
    const events: FishingEvent[] = [];
    alice.onMessage(MSG.fishEvent, (e: FishingEvent) => events.push(e));
    const next = <K extends FishingEvent["type"]>(type: K) =>
      waitFor(() => events.find((e): e is Extract<FishingEvent, { type: K }> => e.type === type));

    alice.send(MSG.fishCast);
    const cast = await next("cast");
    expect(cast.mastery).toEqual({ rod: "bambu", level: 0, next: 1 });
    await next("bite");
    alice.send(MSG.fishHook, { castId: cast.castId });
    const { challenge } = await next("start");
    const run = autoplay(challenge);
    alice.send(MSG.fishFinish, { castId: cast.castId, frames: run.frames, inputs: run.inputs });
    const end = await next("end");
    expect(end.catch).toMatchObject({ masteryUp: 1 });

    // El siguiente lance ya sale con el nivel 1 y la barra más larga.
    events.length = 0;
    await tick(350);
    alice.send(MSG.fishCast);
    const again = await next("cast");
    expect(again.mastery).toMatchObject({ rod: "bambu", level: 1 });
    await next("bite");
    alice.send(MSG.fishHook, { castId: again.castId });
    expect((await next("start")).challenge.mastery).toBe(1);
  });
});
