import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld } from "@hyvento/map";
import {
  ACHIEVEMENTS,
  CAFE,
  CONSUME,
  DRUNK,
  MSG,
  ROOM_NAME,
  STAT_KEYS,
  STAT_PREFIX,
  TOURIST_AREAS,
  type AchievementUnlockedEvent,
  type StatChange,
} from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mergeStatChanges } from "@hyvento/db";
import { MemoryRepository } from "../src/repo/memory";
import { AchievementTracker } from "../src/rooms/achievements";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, goToArea, tick, token, walkToTile, type ServerRoom } from "./helpers";

// ---------- El rastreador (sin sala) ----------

function tracker(repo = new MemoryRepository()) {
  const unlocked: string[] = [];
  const t = new AchievementTracker({ repo: () => repo, onUnlock: (userId, a) => unlocked.push(`${userId}:${a.id}`) });
  return { t, repo, unlocked };
}

describe("rastreador de logros", () => {
  it("suma en memoria, desbloquea al llegar al umbral y guarda todo junto al hacer flush", async () => {
    const { t, repo, unlocked } = tracker();
    await t.load("u");
    for (let i = 0; i < 19; i++) t.bump("u", STAT_KEYS.catPets);
    expect(unlocked).toEqual([]);
    t.bump("u", STAT_KEYS.catPets);
    expect(unlocked).toEqual(["u:amigo-de-los-gatos"]);
    t.bump("u", STAT_KEYS.catPets);
    expect(unlocked).toHaveLength(1); // una sola vez
    expect(repo.savedStat("u", STAT_KEYS.catPets)).toBe(0); // todavía no se guardó
    await t.flush("u");
    expect(repo.savedStat("u", STAT_KEYS.catPets)).toBe(21);
    expect(repo.statSaves).toBe(1);
    await tick(10);
    expect([...repo.achievements.get("u")!]).toEqual(["amigo-de-los-gatos"]);
  });

  it("cuenta cuántos logros tiene y destraba los logros de logros", async () => {
    const repo = new MemoryRepository();
    // Nueve de antes (sin el contador, como quien los ganó antes de que existiera).
    const before = ACHIEVEMENTS.filter((a) => a.stat !== STAT_KEYS.achievementsUnlocked && a.stat !== STAT_KEYS.catPets).slice(0, 9);
    for (const a of before) await repo.unlockAchievement("u", a.id);
    const { t, unlocked } = tracker(repo);
    await t.load("u");
    expect(t.snapshot("u")!.stats[STAT_KEYS.achievementsUnlocked]).toBe(9);
    expect(unlocked).toEqual([]);
    for (let i = 0; i < 20; i++) t.bump("u", STAT_KEYS.catPets);
    expect(unlocked).toEqual(["u:amigo-de-los-gatos", "u:coleccionista-de-logros"]);
    // El décimo más el de logros: once.
    expect(t.snapshot("u")!.stats[STAT_KEYS.achievementsUnlocked]).toBe(11);
  });

  it("lo que ya tenía en la base cuenta, y lo ya desbloqueado no se avisa de nuevo", async () => {
    const repo = new MemoryRepository();
    await repo.saveStats("u", [{ key: STAT_KEYS.pianoPlays, op: "inc", value: 24 }]);
    await repo.unlockAchievement("u", "primera-picada");
    await repo.saveStats("u", [{ key: STAT_KEYS.fishCaught, op: "inc", value: 3 }]);
    const { t, unlocked } = tracker(repo);
    await t.load("u");
    expect(unlocked).toEqual([]);
    t.bump("u", STAT_KEYS.fishCaught);
    t.bump("u", STAT_KEYS.pianoPlays);
    expect(unlocked).toEqual(["u:pianista"]);
  });

  it("lo sumado antes de terminar de leer la base no se pierde y recién ahí se desbloquea", async () => {
    const repo = new MemoryRepository();
    await repo.saveStats("u", [{ key: STAT_KEYS.catPets, op: "inc", value: 19 }]);
    const { t, unlocked } = tracker(repo);
    const loading = t.load("u");
    t.bump("u", STAT_KEYS.catPets);
    expect(unlocked).toEqual([]);
    await loading;
    expect(t.snapshot("u")!.stats[STAT_KEYS.catPets]).toBe(20);
    expect(unlocked).toEqual(["u:amigo-de-los-gatos"]);
  });

  it("los máximos se quedan con el mayor y un guardado fallido se reintenta", async () => {
    const repo = new MemoryRepository();
    const { t } = tracker(repo);
    await t.load("u");
    t.max("u", STAT_KEYS.fishBestCm, 40);
    t.max("u", STAT_KEYS.fishBestCm, 25);
    t.bump("u", STAT_KEYS.sips, 2);
    const save = repo.saveStats.bind(repo);
    repo.saveStats = async () => {
      throw new Error("sin base");
    };
    await t.flush("u");
    t.bump("u", STAT_KEYS.sips);
    repo.saveStats = save;
    await t.flush("u");
    expect(repo.savedStat("u", STAT_KEYS.fishBestCm)).toBe(40);
    expect(repo.savedStat("u", STAT_KEYS.sips)).toBe(3);
  });

  it("los niveles visitados se cuentan una vez cada uno (también los de antes)", async () => {
    const repo = new MemoryRepository();
    await repo.saveStats("u", [
      { key: `${STAT_PREFIX.visit}jardin`, op: "max", value: 1 },
      { key: `${STAT_PREFIX.visit}sotano`, op: "max", value: 1 },
    ]);
    const { t } = tracker(repo);
    await t.load("u");
    t.visit("u", "jardin");
    t.visit("u", "piso-2");
    t.visit("u", "piso-2");
    expect(t.snapshot("u")!.stats[STAT_KEYS.areasVisited]).toBe(3);
  });

  it("Turista pide todos los niveles de la cabaña", () => {
    expect(getWorld().areas.size).toBe(TOURIST_AREAS);
    expect(ACHIEVEMENTS.find((a) => a.id === "turista")!.min).toBe(getWorld().areas.size);
  });

  it("madrugador y búho cuentan una vez por día de Bogotá", async () => {
    const { t, unlocked } = tracker();
    await t.load("u");
    const sixAm = Date.UTC(2026, 8, 27, 11, 0); // 6:00 en Bogotá
    t.activeAt("u", sixAm);
    t.activeAt("u", sixAm + 30 * 60_000);
    t.activeAt("u", Date.UTC(2026, 8, 27, 17, 0)); // mediodía: no cuenta
    expect(t.snapshot("u")!.stats[STAT_KEYS.earlyDays]).toBe(1);
    t.activeAt("u", sixAm + 86_400_000);
    expect(t.snapshot("u")!.stats[STAT_KEYS.earlyDays]).toBe(2);
    t.activeAt("u", Date.UTC(2026, 8, 28, 6, 30)); // 1:30 en Bogotá
    expect(unlocked).toEqual(["u:madrugador", "u:buho"]);
  });

  it("caminar suma tiles enteros (con los decimales guardados para después)", async () => {
    const { t } = tracker();
    await t.load("u");
    for (let i = 0; i < 10; i++) t.walk("u", 0.35);
    expect(t.snapshot("u")!.stats[STAT_KEYS.tilesWalked]).toBe(3);
  });

  it("refresh relee lo que sumó la web (la racha del buzón) y desbloquea", async () => {
    const { t, repo, unlocked } = tracker();
    await t.load("u");
    await repo.saveStats("u", [{ key: STAT_KEYS.streakBest, op: "max", value: 7 }] satisfies StatChange[]);
    await t.refresh("u");
    expect(unlocked).toEqual(["u:siete-de-siete"]);
  });

  it("refresh avisa solo lo que sumó la web (un regalo), no lo propio aunque se esté guardando", async () => {
    const repo = new MemoryRepository();
    const external: string[] = [];
    const t = new AchievementTracker({ repo: () => repo, onUnlock: () => {}, onExternal: (u, key, by) => external.push(`${u}:${key}:${by}`) });
    await t.load("u");
    // Lo propio, pendiente y a medio guardar mientras se relee: no es de la web.
    t.bump("u", STAT_KEYS.toasts, 2);
    const flushing = t.flush("u");
    t.bump("u", STAT_KEYS.toasts);
    // La web mandó un regalo (y sube un máximo, que no cuenta).
    await repo.saveStats("u", [
      { key: STAT_KEYS.giftsGiven, op: "inc", value: 1 },
      { key: STAT_KEYS.streakBest, op: "max", value: 3 },
    ] satisfies StatChange[]);
    await Promise.all([flushing, t.refresh("u")]);
    expect(external).toEqual([`u:${STAT_KEYS.giftsGiven}:1`]);
    expect(t.snapshot("u")!.stats[STAT_KEYS.toasts]).toBe(3);
    expect(t.snapshot("u")!.stats[STAT_KEYS.giftsGiven]).toBe(1);
    // Releer otra vez sin cambios no repite nada.
    await t.refresh("u");
    expect(external).toHaveLength(1);
  });

  it("al irse se guarda lo pendiente y se olvida", async () => {
    const { t, repo } = tracker();
    await t.load("u");
    t.bump("u", STAT_KEYS.emotes, 3);
    await t.forget("u");
    expect(repo.savedStat("u", STAT_KEYS.emotes)).toBe(3);
    expect(t.snapshot("u")).toBeNull();
  });

  it("al cerrar la sala, flushAll espera el guardado de quien se acaba de ir (ya no está en la lista)", async () => {
    const { t, repo } = tracker();
    await t.load("u");
    t.bump("u", STAT_KEYS.emotes, 2);
    const save = repo.saveStats.bind(repo);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    repo.saveStats = async (...args) => {
      await gate; // una base lenta
      return save(...args);
    };
    const leaving = t.forget("u");
    let closed = false;
    const closing = t.flushAll().then(() => (closed = true));
    await tick(10);
    expect(closed).toBe(false); // no termina antes de que se guarde lo de quien se fue
    release();
    await Promise.all([leaving, closing]);
    expect(repo.savedStat("u", STAT_KEYS.emotes)).toBe(2);
  });

  it("los cambios repetidos de un contador se juntan antes de ir a la base", () => {
    const { inc, max } = mergeStatChanges([
      { op: "inc", key: "a", value: 2 },
      { op: "inc", key: "a", value: 3 },
      { op: "inc", key: "b", value: 0 },
      { op: "max", key: "r", value: 5 },
      { op: "max", key: "r", value: 4 },
      { op: "inc", key: "x", value: Number.NaN },
    ]);
    expect(Object.fromEntries(inc)).toEqual({ a: 5 });
    expect(Object.fromEntries(max)).toEqual({ r: 5 });
  });
});

// ---------- Enganches en la sala ----------

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
  OfficeRoom.consumeCooldownMs = 0;
  OfficeRoom.faintMs = 300;
  OfficeRoom.statsFlushMs = 100;
});
afterEach(() => {
  OfficeRoom.consumeCooldownMs = CONSUME.cooldownMs;
  OfficeRoom.faintMs = DRUNK.faintMs;
  OfficeRoom.statsFlushMs = 20_000;
});

async function join(room: ServerRoom, id: string, name: string) {
  const client = await colyseus.connectTo(room, { token: await token(id, name) });
  const events: AchievementUnlockedEvent[] = [];
  client.onMessage(MSG.achievementUnlocked, (e: AchievementUnlockedEvent) => events.push(e));
  await room.waitForNextPatch();
  await tick(30);
  return { client, events };
}

async function order(client: ClientRoom, room: ServerRoom, msg: string, item: string) {
  client.send(msg, { item });
  await tick(80);
  await room.waitForNextPatch();
}

async function sip(client: ClientRoom, room: ServerRoom, n: number) {
  for (let i = 0; i < n; i++) {
    client.send(MSG.useHeld, {});
    await tick(15);
  }
  await room.waitForNextPatch();
}

describe("logros en la cabaña", () => {
  it("pedir un tinto y tomarlo suma pedidos, cafés y sorbos; el logro lo ven los del mismo nivel", async () => {
    await repo.awardPoints({ userId: "u-alice", amount: 50, reason: "ADMIN" });
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const alice = await join(room, "u-alice", "Alice");
    const bob = await join(room, "u-bob", "Bob");
    const carla = await join(room, "u-carla", "Carla");
    await goToArea(alice.client, room, "planta-baja");
    await goToArea(bob.client, room, "planta-baja");
    await walkToTile(alice.client, room, 25, 3);
    await order(alice.client, room, MSG.cafeOrder, "tinto");
    await sip(alice.client, room, 3);
    await tick(200); // guardado agrupado

    expect(repo.savedStat("u-alice", STAT_KEYS.cafeOrders)).toBe(1);
    expect(repo.savedStat("u-alice", STAT_KEYS.coffees)).toBe(1);
    expect(repo.savedStat("u-alice", STAT_KEYS.sips)).toBe(3);
    expect(repo.savedStat("u-alice", `${STAT_PREFIX.use}tinto`)).toBe(3);
    expect(repo.savedStat("u-alice", `${STAT_PREFIX.order}tinto`)).toBe(1);
    expect(repo.savedStat("u-alice", STAT_KEYS.areasVisited)).toBe(2);
    expect(repo.savedStat("u-alice", STAT_KEYS.tilesWalked)).toBeGreaterThan(5);
    expect(repo.achievements.get("u-alice")?.has("buenos-dias")).toBe(true);

    const mine = { sessionId: alice.client.sessionId, name: "Alice", achievementId: "buenos-dias" };
    expect(alice.events).toContainEqual(mine);
    expect(bob.events).toContainEqual(mine); // en la planta baja con ella
    expect(carla.events).toEqual([]); // se quedó en el jardín
  });

  it("desmayarse en el bar cuenta la borrachera y despertar en el sofá", async () => {
    await repo.awardPoints({ userId: "u-alice", amount: 200, reason: "ADMIN" });
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const alice = await join(room, "u-alice", "Alice");
    await goToArea(alice.client, room, "sotano");
    await walkToTile(alice.client, room, 33, 7);
    for (let k = 0; k < 3; k++) {
      await order(alice.client, room, MSG.barOrder, "whisky");
      await sip(alice.client, room, 3);
      if (k < 2) await tick(CAFE.orderCooldownMs);
    }
    await tick(OfficeRoom.faintMs + 300);
    await room.waitForNextPatch();

    const me = room.state.players.get(alice.client.sessionId)!;
    expect(me.area).toBe(DRUNK.restArea);
    expect(alice.events.map((e) => e.achievementId)).toContain("primera-borrachera");
    expect(repo.savedStat("u-alice", STAT_KEYS.blackouts)).toBe(1);
    expect(repo.savedStat("u-alice", STAT_KEYS.sofaNaps)).toBe(1);
    expect(repo.savedStat("u-alice", STAT_KEYS.barOrders)).toBe(3);
    expect(repo.savedStat("u-alice", STAT_KEYS.alcoholSips)).toBeGreaterThanOrEqual(7);
  });

  it("al salir de la cabaña se guarda lo que faltaba", async () => {
    OfficeRoom.statsFlushMs = 60_000;
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const alice = await join(room, "u-alice", "Alice");
    alice.client.send(MSG.emote, { emote: "dance" });
    await tick(50);
    expect(repo.savedStat("u-alice", STAT_KEYS.dances)).toBe(0);
    await alice.client.leave();
    await tick(100);
    expect(repo.savedStat("u-alice", STAT_KEYS.dances)).toBe(1);
    expect(repo.savedStat("u-alice", STAT_KEYS.emotes)).toBe(1);
  });
});
