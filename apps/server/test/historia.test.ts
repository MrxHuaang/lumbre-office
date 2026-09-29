// El capítulo 1 en la sala: los pasos en orden y entregados junto a Doña Aurora, la historia que paga aparte
// del tope diario, saltarla, la carta del final una sola vez, el prólogo solo para quien recién llegó y los
// pasos que quien ya jugaba tenía hechos.
import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, pointsOfType } from "@hyvento/map";
import {
  HISTORIA_MSG,
  QUEST,
  QUEST_MSG,
  ROOM_NAME,
  STAT_KEYS,
  STORY_PERIOD,
  dailyPeriod,
  questById,
  type ActiveQuest,
  type HistoriaPrologue,
  type QuestClaimResult,
  type QuestListEvent,
} from "@hyvento/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import type { AchievementTracker } from "../src/rooms/achievements";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, goToArea, tick, token, walkToTile, type ServerRoom } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
const MON = Date.UTC(2026, 8, 28, 15, 0);
let now = MON;
const jardin = getWorld().areas.get("jardin")!;
const board = pointsOfType(jardin, "task_board")[0]!;
/** Junto a Doña Aurora (su tile es el 16,16 del recibidor). */
const AURORA_SPOT = { x: 16, y: 17 };
const OLLA = questById("evelio-olla")!;

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
  OfficeRoom.encargosNow = () => now;
  OfficeRoom.encargosPick = (_u, t): ActiveQuest[] => [{ def: OLLA, period: dailyPeriod(t), shared: false }];
});
afterEach(() => {
  OfficeRoom.encargosNow = () => Date.now();
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

async function setup(opts: { onboardedAt?: number; room?: ServerRoom } = {}) {
  const room = opts.room ?? ((await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom);
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice", "ada", "MEMBER", opts.onboardedAt ? { onboardedAt: opts.onboardedAt } : {}) });
  const lists: QuestListEvent[] = [];
  const results: QuestClaimResult[] = [];
  const prologues: HistoriaPrologue[] = [];
  const letters: unknown[] = [];
  alice.onMessage(QUEST_MSG.list, (e: QuestListEvent) => lists.push(e));
  alice.onMessage(QUEST_MSG.progress, () => {});
  alice.onMessage(QUEST_MSG.result, (e: QuestClaimResult) => results.push(e));
  alice.onMessage(HISTORIA_MSG.prologue, (e: HistoriaPrologue) => prologues.push(e));
  alice.onMessage(HISTORIA_MSG.letter, (e: unknown) => letters.push(e));
  await room.waitForNextPatch();
  await waitFor(() => lists[0]);
  const stats = (room as unknown as { achievements: AchievementTracker }).achievements;
  const bump = async (key: string, by = 1) => {
    stats.bump("u-alice", key, by);
    await tick(30);
  };
  const claim = async (questId: string) => {
    const before = results.length;
    alice.send(QUEST_MSG.claim, { questId, period: STORY_PERIOD });
    const r = await waitFor(() => results[before]);
    now += QUEST.claimCooldownMs + 1;
    return r;
  };
  const toAurora = async () => {
    await goToArea(alice, room, "planta-baja");
    await walkToTile(alice, room, AURORA_SPOT.x, AURORA_SPOT.y);
  };
  const story = (id: string) => repo.quest("u-alice", id, STORY_PERIOD);
  return { room, alice, lists, results, prologues, letters, stats, bump, claim, toAurora, story };
}

describe("capítulo 1: los pasos con Doña Aurora", () => {
  it("todos tienen el primer paso; van en orden y se entregan junto a ella (lejos, no)", async () => {
    const s = await setup();
    expect(s.story("llegada-1")).toMatchObject({ status: "ACTIVE", progress: 0 });
    await s.bump(`order:tinto`);
    expect(await s.claim("llegada-1")).toMatchObject({ ok: false, error: "far" });
    await s.toAurora();
    // Uno que todavía no se abrió no se entrega (ni aunque el contador ya esté).
    await s.bump(STAT_KEYS.emotes);
    expect(await s.claim("llegada-3")).toMatchObject({ ok: false, error: "not-done" });
    expect(await s.claim("llegada-1")).toMatchObject({ ok: true, points: 5, skill: "cocina" });
    expect(s.story("llegada-2")).toMatchObject({ status: "ACTIVE" });
    expect(s.story("llegada-3")).toBeUndefined();
  });

  it("la historia paga aparte: con el tope de QUEST lleno igual paga, y no le quita espacio al diario", async () => {
    repo.ledger.push({ userId: "u-alice", amount: 100, reason: "QUEST", at: MON });
    const s = await setup();
    await s.bump("order:tinto");
    await s.toAurora();
    expect(await s.claim("llegada-1")).toMatchObject({ ok: true, points: 5 });
    expect(repo.ledger.at(-1)).toMatchObject({ amount: 5, reason: "QUEST", refId: "encargo:llegada-1:historia" });
  });

  it("al entregar el último paso llega la carta al buzón (una sola vez) y el logro", async () => {
    const s = await setup();
    await s.toAurora();
    const steps: [string, string][] = [
      ["llegada-1", "order:tinto"],
      ["llegada-2", STAT_KEYS.ownOfficeSits],
      ["llegada-3", STAT_KEYS.emotes],
      ["llegada-4", STAT_KEYS.fishCaught],
      ["llegada-5", STAT_KEYS.boardReads],
    ];
    for (const [id, stat] of steps) {
      await s.bump(stat);
      expect(await s.claim(id)).toMatchObject({ ok: true });
    }
    await waitFor(() => s.letters[0]);
    expect(s.stats.stat("u-alice", STAT_KEYS.storyCh1)).toBe(1);
    await waitFor(() => (s.stats.snapshot("u-alice")?.unlocked.includes("recien-llegado") ? true : undefined));
    // Saltar después no manda otra carta.
    s.alice.send(HISTORIA_MSG.skip);
    await tick(150);
    expect(s.letters).toHaveLength(1);
  });

  it("saltar la historia: todo queda entregado sin pagar, llegan el logro y la carta una vez", async () => {
    const s = await setup();
    s.alice.send(HISTORIA_MSG.skip);
    await waitFor(() => s.letters[0]);
    for (const n of [1, 2, 3, 4, 5]) expect(s.story(`llegada-${n}`)).toMatchObject({ status: "CLAIMED" });
    expect(await repo.getPoints("u-alice")).toBe(0);
    s.alice.send(HISTORIA_MSG.skip);
    await tick(150);
    expect(s.letters).toHaveLength(1);
    expect(s.stats.stat("u-alice", STAT_KEYS.storyCh1)).toBe(1);
  });

  it("leer el tablón cuenta solo junto a él", async () => {
    const s = await setup();
    s.alice.send(HISTORIA_MSG.board);
    await tick(80);
    expect(s.stats.stat("u-alice", STAT_KEYS.boardReads)).toBeUndefined();
    await walkToTile(s.alice, s.room, board.tileX, board.tileY);
    s.alice.send(HISTORIA_MSG.board);
    await waitFor(() => (s.stats.stat("u-alice", STAT_KEYS.boardReads) === 1 ? true : undefined));
  });
});

describe("capítulo 1: quién lo ve", () => {
  it("el prólogo sale solo a quien recién llegó, y una sola vez", async () => {
    const old = await setup();
    await tick(100);
    expect(old.prologues).toHaveLength(0);
    await colyseus.cleanup();
    repo = new MemoryRepository();
    OfficeRoom.repo = repo;
    const fresh = await setup({ onboardedAt: Date.now() - 60_000 });
    await waitFor(() => fresh.prologues[0]);
    expect(fresh.prologues[0]).toEqual({ byBus: false });
    await fresh.stats.flush("u-alice");
    await fresh.alice.leave();
    await tick(100);
    const again = await setup({ onboardedAt: Date.now() - 60_000 });
    await tick(150);
    expect(again.prologues).toHaveLength(0);
  });

  it("quien ya jugaba tiene hechos solos los pasos que ya había cumplido", async () => {
    repo.userStats.set(
      "u-alice",
      new Map([
        ["order:tinto", 4],
        [STAT_KEYS.emotes, 30],
        [STAT_KEYS.fishCaught, 12],
      ]),
    );
    const s = await setup();
    await waitFor(() => (s.lists.at(-1)?.quests.find((q) => q.questId === "llegada-1")?.status === "DONE" ? true : undefined));
    await s.toAurora();
    expect(await s.claim("llegada-1")).toMatchObject({ ok: true });
    // El 2 (sentarse en su oficina) no lo tenía: queda abierto.
    expect(s.story("llegada-2")).toMatchObject({ status: "ACTIVE" });
    await s.bump(STAT_KEYS.ownOfficeSits);
    expect(await s.claim("llegada-2")).toMatchObject({ ok: true });
    // El 3 (saludar) ya lo tenía: sale hecho.
    await s.stats.flush("u-alice");
    expect(s.story("llegada-3")).toMatchObject({ status: "DONE" });
  });
});
