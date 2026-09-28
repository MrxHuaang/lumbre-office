import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, pointsOfType } from "@hyvento/map";
import {
  BAG,
  QUEST,
  QUEST_MSG,
  ROOM_NAME,
  STAT_KEYS,
  currentQuests,
  dailyPeriod,
  questById,
  weeklyPeriod,
  type ActiveQuest,
  type QuestClaimResult,
  type QuestDoneEvent,
  type QuestListEvent,
} from "@hyvento/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import type { AchievementTracker } from "../src/rooms/achievements";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bagOf, bootServer, tick, token, walkToTile, type ServerRoom } from "./helpers";

// Los encargos en la sala: avanzan con los contadores de siempre (y se guardan con ellos), se avisan al
// cumplirse y se entregan junto a quien los dio, una sola vez, dentro del período (o con un día de gracia),
// con el tope diario de QUEST y solo si la recompensa cabe en la mochila.

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
const DAY = 86_400_000;
/** Lunes 28 de septiembre de 2026, 10:00 en Bogotá. */
const MON = Date.UTC(2026, 8, 28, 15, 0);
let now = MON;
/** Lo que le toca a cada quien (fijo, para no depender del sorteo del día). */
let picks: string[] = [];

const jardin = getWorld().areas.get("jardin")!;
const shop = pointsOfType(jardin, "fishing_shop")[0]!;
const board = pointsOfType(jardin, "task_board")[0]!;

const OLLA = questById("evelio-olla")!; // 3 pescados, 18 puntos, 3 de carnada
const PACIENCIA = questById("evelio-paciencia")!; // 5 pescados, 25 puntos
const LAGO = questById("semana-lago")!; // 20 pescados en la semana, 60 puntos
const LUNA = questById("evelio-luna")!; // 2 pescados de noche

const pickFixed = (_userId: string, t: number): ActiveQuest[] =>
  picks.map((id) => {
    const def = questById(id)!;
    return { def, period: def.kind === "weekly" ? weeklyPeriod(t) : dailyPeriod(t), shared: false };
  });

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
  now = MON;
  picks = [OLLA.id];
  OfficeRoom.encargosNow = () => now;
  OfficeRoom.encargosPick = pickFixed;
  // Mediodía del juego, despejado (lo de noche no cuenta).
  OfficeRoom.gameClockNow = () => MON;
  OfficeRoom.gameClockInitial = { anchorReal: MON, anchorMinute: 1440 + 12 * 60 };
  OfficeRoom.weatherInitial = "despejado";
});
afterEach(() => {
  OfficeRoom.encargosNow = () => Date.now();
  OfficeRoom.encargosPick = currentQuests;
  OfficeRoom.gameClockNow = () => Date.now();
  OfficeRoom.gameClockInitial = null;
  OfficeRoom.weatherInitial = null;
});

async function waitFor<T>(fn: () => T | undefined, ms = 4000): Promise<T> {
  const until = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v !== undefined) return v;
    if (Date.now() > until) throw new Error("No llegó a tiempo");
    await tick(15);
  }
}

/** Alice entra (con lo que diga `stock` en la mochila) y, si se pide, camina hasta `at`. */
async function setup(opts: { stock?: Record<string, number>; at?: { tileX: number; tileY: number } } = {}) {
  for (const [itemId, n] of Object.entries(opts.stock ?? {})) await repo.addInventory("u-alice", itemId, n);
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  const lists: QuestListEvent[] = [];
  const done: QuestDoneEvent[] = [];
  const results: QuestClaimResult[] = [];
  alice.onMessage(QUEST_MSG.list, (e: QuestListEvent) => lists.push(e));
  alice.onMessage(QUEST_MSG.done, (e: QuestDoneEvent) => done.push(e));
  alice.onMessage(QUEST_MSG.result, (e: QuestClaimResult) => results.push(e));
  await room.waitForNextPatch();
  await waitFor(() => lists[0]);
  if (opts.at) await walkToTile(alice, room, opts.at.tileX, opts.at.tileY);
  const stats = (room as unknown as { achievements: AchievementTracker }).achievements;
  /** Suma a un contador como lo haría el juego (pescar, sembrar…). */
  const bump = async (key: string, by = 1) => {
    stats.bump("u-alice", key, by);
    await tick(20);
  };
  const claim = async (questId: string, period: string) => {
    const before = results.length;
    alice.send(QUEST_MSG.claim, { questId, period });
    const r = await waitFor(() => results[before]);
    now += QUEST.claimCooldownMs + 1;
    return r;
  };
  const me = () => room.state.players.get(alice.sessionId)!;
  const latest = () => lists.at(-1)!.quests;
  return { room, alice, lists, done, results, bump, claim, me, latest, stats };
}

describe("encargos: avanzar", () => {
  it("la libreta llega al entrar, con lo asignado en cero (y queda asignado en la base)", async () => {
    const s = await setup();
    expect(s.latest()).toEqual([{ questId: OLLA.id, period: dailyPeriod(MON), progress: 0, goal: 3, status: "ACTIVE", shared: false, late: false }]);
    expect(repo.quest("u-alice", OLLA.id, dailyPeriod(MON))).toMatchObject({ progress: 0, status: "ACTIVE" });
  });

  it("subir el contador lo avanza, avisa al cumplirlo y se guarda junto con los contadores", async () => {
    const s = await setup();
    await s.bump(STAT_KEYS.fishCaught);
    await waitFor(() => (s.latest()[0]!.progress === 1 ? true : undefined));
    expect(s.done).toHaveLength(0);
    await s.bump(STAT_KEYS.fishCaught, 2);
    await waitFor(() => s.done[0]);
    expect(s.done[0]).toEqual({ questId: OLLA.id, period: dailyPeriod(MON) });
    await waitFor(() => (s.latest()[0]!.status === "DONE" ? true : undefined));
    // Otro contador no lo mueve, y pasarse no suma de más.
    await s.bump(STAT_KEYS.plantings, 4);
    await s.bump(STAT_KEYS.fishCaught, 5);
    await s.stats.flush("u-alice");
    expect(repo.quest("u-alice", OLLA.id, dailyPeriod(MON))).toMatchObject({ progress: 3, goal: 3, status: "DONE" });
    expect(repo.savedStat("u-alice", STAT_KEYS.fishCaught)).toBe(8);
    expect(s.done).toHaveLength(1);
  });

  it("lo de noche solo cuenta de noche (en el reloj del juego)", async () => {
    picks = [LUNA.id];
    const s = await setup();
    await s.bump(STAT_KEYS.fishCaught, 5);
    await s.stats.flush("u-alice");
    expect(repo.quest("u-alice", LUNA.id, dailyPeriod(MON))).toMatchObject({ progress: 0 });
    await colyseus.cleanup();
    OfficeRoom.gameClockInitial = { anchorReal: MON, anchorMinute: 1440 + 22 * 60 };
    const n = await setup();
    await n.bump(STAT_KEYS.fishCaught, 2);
    await waitFor(() => n.done[0]);
    await n.stats.flush("u-alice");
    expect(repo.quest("u-alice", LUNA.id, dailyPeriod(MON))).toMatchObject({ progress: 2, status: "DONE" });
  });
});

describe("encargos: entregar", () => {
  it("sin cumplir no se entrega; lejos de quien lo dio tampoco", async () => {
    const s = await setup({ at: shop });
    expect(await s.claim(OLLA.id, dailyPeriod(MON))).toEqual({ ok: false, questId: OLLA.id, period: dailyPeriod(MON), error: "not-done" });
    await s.bump(STAT_KEYS.fishCaught, 3);
    // Al tablón no: el de la olla es de Don Evelio.
    await walkToTile(s.alice, s.room, board.tileX, board.tileY);
    expect(await s.claim(OLLA.id, dailyPeriod(MON))).toMatchObject({ ok: false, error: "far" });
    expect(await repo.getPoints("u-alice")).toBe(0);
  });

  it("junto a Don Evelio paga (QUEST), suma la experiencia y da la carnada; dos veces, no", async () => {
    const s = await setup({ at: shop });
    await s.bump(STAT_KEYS.fishCaught, 3);
    const r = await s.claim(OLLA.id, dailyPeriod(MON));
    expect(r).toEqual({ ok: true, questId: OLLA.id, period: dailyPeriod(MON), points: 18, capped: false, skill: "pesca", xp: 25, item: "obj:carnada", balance: 18 });
    expect(repo.ledger.at(-1)).toMatchObject({ amount: 18, reason: "QUEST", refId: `encargo:${OLLA.id}:${dailyPeriod(MON)}` });
    expect(repo.skillXp.get("u-alice:pesca")).toBe(25);
    expect(bagOf(s.room).count("u-alice", "obj:carnada")).toBe(3);
    await s.room.waitForNextPatch();
    expect(s.me().points).toBe(18);
    await waitFor(() => (s.latest()[0]!.status === "CLAIMED" ? true : undefined));
    expect(await s.claim(OLLA.id, dailyPeriod(MON))).toMatchObject({ ok: false, error: "claimed" });
    expect(await repo.getPoints("u-alice")).toBe(18);
    expect(repo.skillXp.get("u-alice:pesca")).toBe(25);
  });

  it("dos pedidos seguidos pagan una sola vez", async () => {
    const s = await setup({ at: shop });
    await s.bump(STAT_KEYS.fishCaught, 3);
    s.alice.send(QUEST_MSG.claim, { questId: OLLA.id, period: dailyPeriod(MON) });
    s.alice.send(QUEST_MSG.claim, { questId: OLLA.id, period: dailyPeriod(MON) });
    await waitFor(() => s.results[1]);
    expect(s.results.filter((x) => x.ok)).toHaveLength(1);
    expect(await repo.getPoints("u-alice")).toBe(18);
  });

  it("los encargos pagan hasta 100 puntos por día (QUEST); lo que pasa, no", async () => {
    picks = [LAGO.id, PACIENCIA.id, OLLA.id];
    const s = await setup({ at: shop });
    await s.bump(STAT_KEYS.fishCaught, 20);
    await waitFor(() => (s.done.length === 3 ? true : undefined));
    expect(await s.claim(LAGO.id, weeklyPeriod(MON))).toMatchObject({ ok: true, points: 60, capped: false });
    expect(await s.claim(PACIENCIA.id, dailyPeriod(MON))).toMatchObject({ ok: true, points: 25, capped: false });
    // 60 + 25 = 85: de los 18 de la olla solo caben 15.
    expect(await s.claim(OLLA.id, dailyPeriod(MON))).toMatchObject({ ok: true, points: 15, capped: true, balance: 100 });
    expect(await repo.getPoints("u-alice")).toBe(100);
  });

  it("si la carnada no cabe en la mochila no se entrega (ni se paga) y queda para después", async () => {
    // 36 cosas distintas: la mochila llena.
    const stock: Record<string, number> = {};
    for (let i = 0; i < BAG.slots; i++) stock[`obj:cosa-${i}`] = 1;
    const s = await setup({ stock, at: shop });
    await s.bump(STAT_KEYS.fishCaught, 3);
    expect(await s.claim(OLLA.id, dailyPeriod(MON))).toMatchObject({ ok: false, error: "full" });
    expect(await repo.getPoints("u-alice")).toBe(0);
    await s.stats.flush("u-alice");
    expect(repo.quest("u-alice", OLLA.id, dailyPeriod(MON))).toMatchObject({ status: "DONE" });
  });
});

describe("encargos: el cambio de día", () => {
  it("el de ayer cumplido se entrega hoy (un día de gracia); lo de hoy empieza de cero; pasado mañana, vencido", async () => {
    const s = await setup({ at: shop });
    await s.bump(STAT_KEYS.fishCaught, 3);
    await waitFor(() => s.done[0]);
    now = MON + DAY;
    await s.bump(STAT_KEYS.fishCaught, 1);
    await s.stats.flush("u-alice");
    // Lo nuevo del martes cuenta en su propio encargo; el del lunes no se toca.
    expect(repo.quest("u-alice", OLLA.id, dailyPeriod(MON + DAY))).toMatchObject({ progress: 1, status: "ACTIVE" });
    expect(repo.quest("u-alice", OLLA.id, dailyPeriod(MON))).toMatchObject({ progress: 3, status: "DONE" });
    // La libreta muestra los dos: el de hoy y el de ayer, marcado "de ayer".
    await waitFor(() => (s.latest().some((q) => q.late) ? true : undefined));
    expect(s.latest().map((q) => [q.period, q.status, q.late])).toEqual([
      [dailyPeriod(MON + DAY), "ACTIVE", false],
      [dailyPeriod(MON), "DONE", true],
    ]);
    expect(await s.claim(OLLA.id, dailyPeriod(MON))).toMatchObject({ ok: true, points: 18 });

    // Otra persona que lo dejó para pasado mañana: ya venció.
    await colyseus.cleanup();
    repo = new MemoryRepository();
    OfficeRoom.repo = repo;
    now = MON;
    const late = await setup({ at: shop });
    await late.bump(STAT_KEYS.fishCaught, 3);
    now = MON + 2 * DAY;
    expect(await late.claim(OLLA.id, dailyPeriod(MON))).toMatchObject({ ok: false, error: "expired" });
    expect(await repo.getPoints("u-alice")).toBe(0);
  });

  it("un encargo que no existe o con un período raro no se entrega", async () => {
    const s = await setup({ at: shop });
    expect(await s.claim("no-existe", dailyPeriod(MON))).toMatchObject({ ok: false, error: "unknown" });
    expect(await s.claim(OLLA.id, "historia")).toMatchObject({ ok: false, error: "unknown" });
    expect(await s.claim(OLLA.id, "d:2020-01-01")).toMatchObject({ ok: false, error: "expired" });
  });
});
