// Los oficios: la experiencia de los veteranos (una sola vez), la de las acciones con su tope diario, la
// subida de nivel (con las chispas para el nivel y el contador del logro legendario) y las ventajas del
// nivel 5 validadas en el servidor: la barra de pesca, la cosecha doble, la porción de más, la receta de
// Cocina 6, el detalle gratis del día y las pistas del diario.
import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, pointsOfType } from "@hyvento/map";
import {
  FISHING,
  LEVEL_XP,
  MSG,
  OFICIO,
  OFICIO_MSG,
  OFICIO_XP,
  ROOM_NAME,
  STAT_KEYS,
  levelOf,
  oficioLevelStat,
  type FishingEvent,
  type OficioGiftResult,
  type OficioHints,
  type OficioLevelUpEvent,
  type OficioStateEvent,
} from "@hyvento/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import type { AchievementTracker } from "../src/rooms/achievements";
import { Cocina } from "../src/rooms/cocina";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { Oficios } from "../src/rooms/oficios";
import type { OfficeState } from "../src/state";
import { bagOf, bootServer, tick, token, walkToTile, type ServerRoom } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
const MON = Date.UTC(2026, 8, 28, 15, 0);
let now = MON;
let roll = 0;

const jardin = getWorld().areas.get("jardin")!;
const plantaBaja = getWorld().areas.get("planta-baja")!;
const spot = pointsOfType(jardin, "fishing_spot")[0]!;
const stove = pointsOfType(plantaBaja, "kitchen_stove")[0]!;

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
  roll = 0;
  OfficeRoom.oficiosNow = () => now;
  OfficeRoom.oficiosRandom = () => roll;
  OfficeRoom.fishingNow = () => MON;
  OfficeRoom.fishingRandom = (n) => (n === 1000 ? 999 : 0);
  OfficeRoom.fishingTimings = { ...FISHING, biteMinMs: 40, biteMaxMs: 60, biteWindowMs: 800, slackMs: 60_000, showMs: 300 };
});
afterEach(() => {
  OfficeRoom.oficiosNow = () => Date.now();
  OfficeRoom.fishingNow = () => Date.now();
  OfficeRoom.fishingTimings = { ...FISHING };
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

/** Le pone experiencia a alguien antes de entrar (como si ya la tuviera guardada). */
function giveXp(userId: string, oficio: string, xp: number) {
  repo.veterans.add(userId);
  repo.skillXp.set(`${userId}:${oficio}`, xp);
}

async function join(room: ServerRoom, id: string, name: string) {
  const client = await colyseus.connectTo(room, { token: await token(id, name) });
  const states: OficioStateEvent[] = [];
  const ups: OficioLevelUpEvent[] = [];
  const gifts: OficioGiftResult[] = [];
  const hints: OficioHints[] = [];
  const fishing: FishingEvent[] = [];
  client.onMessage(OFICIO_MSG.state, (e: OficioStateEvent) => states.push(e));
  client.onMessage(OFICIO_MSG.levelUp, (e: OficioLevelUpEvent) => ups.push(e));
  client.onMessage(OFICIO_MSG.giftResult, (e: OficioGiftResult) => gifts.push(e));
  client.onMessage(OFICIO_MSG.hintsResult, (e: OficioHints) => hints.push(e));
  client.onMessage(MSG.fishEvent, (e: FishingEvent) => fishing.push(e));
  await room.waitForNextPatch();
  await waitFor(() => states[0]);
  return { client, states, ups, gifts, hints, fishing, me: () => room.state.players.get(client.sessionId)! };
}

const parts = (room: ServerRoom) => room as unknown as { achievements: AchievementTracker; oficios: Oficios };

describe("oficios: la experiencia", () => {
  it("un veterano empieza con lo de sus contadores, una sola vez aunque vuelva a entrar", async () => {
    repo.userStats.set("u-alice", new Map([[STAT_KEYS.fishCaught, 10]]));
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const a = await join(room, "u-alice", "Alice");
    expect(a.states.at(-1)!.skills.pesca.xp).toBe(80);
    expect(repo.veteranSeeds).toBe(1);
    await a.client.leave();
    await tick(100);
    const again = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const b = await join(again, "u-alice", "Alice");
    expect(b.states.at(-1)!.skills.pesca.xp).toBe(80);
    expect(repo.veteranSeeds).toBe(1);
  });

  it("las acciones suman experiencia a su oficio con el tope diario; al día siguiente vuelve a haber", async () => {
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    await join(room, "u-alice", "Alice");
    const { achievements, oficios } = parts(room);
    achievements.bump("u-alice", STAT_KEYS.fishCaught, 1000);
    expect(oficios.snapshot("u-alice")!.xp.pesca).toBe(OFICIO.dailyActionCap);
    achievements.bump("u-alice", STAT_KEYS.fishCaught, 5);
    expect(oficios.snapshot("u-alice")!.xp.pesca).toBe(OFICIO.dailyActionCap);
    // Caminar da de a poquito (las fracciones se juntan): 100 baldosas son 2.
    const before = oficios.snapshot("u-alice")!.xp.exploracion;
    for (let i = 0; i < 100; i++) achievements.bump("u-alice", STAT_KEYS.tilesWalked, 1);
    expect(oficios.snapshot("u-alice")!.xp.exploracion - before).toBe(2);
    await oficios.flush("u-alice");
    expect(repo.skillXp.get("u-alice:pesca")).toBe(OFICIO.dailyActionCap);
    now = MON + 86_400_000;
    achievements.bump("u-alice", STAT_KEYS.fishCaught, 1);
    expect(oficios.snapshot("u-alice")!.xp.pesca).toBe(OFICIO.dailyActionCap + 8);
    // La base también aplica el tope (si le llega de más, no entra).
    expect(await repo.addSkillXp("u-bob", { pesca: 999 }, MON)).toEqual({ pesca: OFICIO.dailyActionCap });
  });

  it("al subir de nivel: los del nivel ven las chispas, el nivel de vecino cambia y queda el contador del logro", async () => {
    giveXp("u-alice", "huerta", LEVEL_XP[1]! - 4);
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const a = await join(room, "u-alice", "Alice");
    const b = await join(room, "u-bob", "Bob");
    expect(a.me().vecino).toBe(5);
    parts(room).achievements.bump("u-alice", STAT_KEYS.plantings, 1);
    const up = await waitFor(() => b.ups[0]);
    expect(up).toMatchObject({ sessionId: a.client.sessionId, oficio: "huerta", level: 2 });
    await room.waitForNextPatch();
    expect(a.me().vecino).toBe(6);
    expect(parts(room).achievements.stat("u-alice", oficioLevelStat("huerta"))).toBe(2);
    expect(a.states.at(-1)!.skills.huerta.level).toBe(2);
  });

  it("el nivel 10 destraba el logro legendario de su oficio", async () => {
    giveXp("u-alice", "pesca", LEVEL_XP[9]! - 8);
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    await join(room, "u-alice", "Alice");
    parts(room).achievements.bump("u-alice", STAT_KEYS.fishCaught, 1);
    await waitFor(() => (parts(room).achievements.snapshot("u-alice")?.unlocked.includes("leyenda-del-lago") ? true : undefined));
  });
});

describe("oficios: las ventajas del nivel 5 (validadas en el servidor)", () => {
  async function hooked(s: Awaited<ReturnType<typeof join>>) {
    s.client.send(MSG.fishCast);
    const cast = await waitFor(() => s.fishing.find((e): e is Extract<FishingEvent, { type: "cast" }> => e.type === "cast"));
    await waitFor(() => s.fishing.find((e) => e.type === "bite"));
    s.client.send(MSG.fishHook, { castId: cast.castId });
    return (await waitFor(() => s.fishing.find((e): e is Extract<FishingEvent, { type: "start" }> => e.type === "start"))).challenge;
  }

  it("Pesca 5: el reto trae la barra un 5% más larga; antes, no", async () => {
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const low = await join(room, "u-alice", "Alice");
    await walkToTile(low.client, room, spot.tileX, spot.tileY);
    expect((await hooked(low)).barBonus).toBeUndefined();
    await colyseus.cleanup();
    giveXp("u-bob", "pesca", LEVEL_XP[4]!);
    const room2 = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const pro = await join(room2, "u-bob", "Bob");
    await walkToTile(pro.client, room2, spot.tileX, spot.tileY);
    expect((await hooked(pro)).barBonus).toBe(1.05);
  });

  it("Huerta 5: a veces la cosecha sale doble; Cocina 5: una porción de más", async () => {
    giveXp("u-alice", "huerta", LEVEL_XP[4]!);
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    await join(room, "u-alice", "Alice");
    const { oficios } = parts(room);
    roll = 999; // la tirada que no toca
    expect(await oficios.extraHarvest("u-alice", "tomate")).toBe(false);
    roll = 0;
    expect(await oficios.extraHarvest("u-alice", "tomate")).toBe(true);
    expect(bagOf(room).count("u-alice", "obj:tomate")).toBe(1);
    // Sin el nivel de Cocina no hay porción de más.
    expect(await oficios.extraPortion("u-alice", "chorizo-arepa")).toBe(false);
    expect(await oficios.extraHarvest("u-bob", "tomate")).toBe(false);
  });

  it("Social 5: un detalle gratis al día para alguien de al lado (lejos, sin nivel o repetido, no)", async () => {
    giveXp("u-alice", "social", LEVEL_XP[4]!);
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const a = await join(room, "u-alice", "Alice");
    const b = await join(room, "u-bob", "Bob");
    await waitFor(() => (parts(room).achievements.isLoaded("u-alice") ? true : undefined));
    b.client.send(OFICIO_MSG.gift, { sessionId: a.client.sessionId });
    expect(await waitFor(() => b.gifts[0])).toEqual({ ok: false, error: "level" });
    a.client.send(OFICIO_MSG.gift, { sessionId: a.client.sessionId });
    expect(await waitFor(() => a.gifts[0])).toEqual({ ok: false, error: "self" });
    const socialBefore = parts(room).oficios.snapshot("u-alice")!.xp.social;
    a.client.send(OFICIO_MSG.gift, { sessionId: b.client.sessionId });
    expect(await waitFor(() => a.gifts[1])).toMatchObject({ ok: true, toName: "Bob", item: "obj:bocadillo" });
    await bagOf(room).flush("u-bob");
    expect(bagOf(room).count("u-bob", "obj:bocadillo")).toBe(1);
    // Cuenta como regalo dado (para los encargos) y da su experiencia de Social.
    expect(parts(room).achievements.stat("u-alice", STAT_KEYS.giftsGiven)).toBe(1);
    expect(parts(room).oficios.snapshot("u-alice")!.xp.social - socialBefore).toBe(OFICIO_XP.social[STAT_KEYS.giftsGiven]);
    a.client.send(OFICIO_MSG.gift, { sessionId: b.client.sessionId });
    expect(await waitFor(() => a.gifts[2])).toEqual({ ok: false, error: "used" });
    expect(parts(room).achievements.stat("u-alice", STAT_KEYS.giftsGiven)).toBe(1);
  });

  it("lo que la web sumó (un regalo del buzón) da su experiencia al releer los puntos", async () => {
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    await join(room, "u-alice", "Alice");
    await waitFor(() => (parts(room).achievements.isLoaded("u-alice") ? true : undefined));
    const before = parts(room).oficios.snapshot("u-alice")!.xp.social;
    // Como `sendGiftTx`: el contador sube en la base y la web avisa "points-changed".
    await repo.saveStats("u-alice", [{ key: STAT_KEYS.giftsGiven, op: "inc", value: 2 }]);
    await parts(room).achievements.refresh("u-alice");
    expect(parts(room).achievements.stat("u-alice", STAT_KEYS.giftsGiven)).toBe(2);
    expect(parts(room).oficios.snapshot("u-alice")!.xp.social - before).toBe(2 * OFICIO_XP.social[STAT_KEYS.giftsGiven]!);
  });

  it("Exploración 5: pistas del diario (dónde anda el Man y qué niveles faltan); sin el nivel, nada", async () => {
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const a = await join(room, "u-alice", "Alice");
    a.client.send(OFICIO_MSG.hints);
    expect(await waitFor(() => a.hints[0])).toEqual({ ok: false });
    await colyseus.cleanup();
    giveXp("u-bob", "exploracion", LEVEL_XP[4]!);
    const room2 = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const b = await join(room2, "u-bob", "Bob");
    await waitFor(() => (parts(room2).achievements.isLoaded("u-bob") ? true : undefined));
    b.client.send(OFICIO_MSG.hints);
    const h = await waitFor(() => b.hints[0]);
    expect(h.ok).toBe(true);
    if (h.ok) {
      expect(h.unvisited.length).toBeGreaterThan(0);
      expect(h.unvisited).not.toContain(jardin.name);
    }
  });

  it("Cocina 6: el sancocho de la abuela se cocina solo con el nivel", async () => {
    let level = 5;
    const bag = new Map<string, number>([
      ["obj:papa", 2],
      ["obj:mazorca", 1],
      ["obj:tomate", 1],
      ["obj:cilantro", 1],
    ]);
    const cocina = new Cocina({
      bag: {
        count: (_u, id) => bag.get(id) ?? 0,
        fits: () => "ok",
        take: async (_u, id, n) => (bag.set(id, (bag.get(id) ?? 0) - n), true),
        add: async (_u, id, n) => (bag.set(id, (bag.get(id) ?? 0) + n), "ok"),
      },
      award: async (_u, amount) => amount,
      later: () => ({ clear: () => {} }),
      onBuff: () => {},
      level: () => level,
    });
    const at = { userId: "u", x: stove.x, y: stove.y };
    expect((await cocina.cook(plantaBaja, at, { recipe: "sancocho-abuela" }, MON))?.notice?.code).toBe("level");
    level = 6;
    expect((await cocina.cook(plantaBaja, at, { recipe: "sancocho-abuela" }, MON + 60_000))?.notice?.code).toBe("cooked");
    expect(levelOf(LEVEL_XP[5]!)).toBe(6);
  });
});
