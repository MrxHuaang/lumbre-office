import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, pointsOfType } from "@hyvento/map";
import {
  BAG,
  FISHING,
  MSG,
  PESCA,
  PESCA_MSG,
  ROOM_NAME,
  autoplay,
  pescaItem,
  type FishingEvent,
  type PescaBuyResult,
  type PescaSoldEvent,
} from "@hyvento/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bagOf, bootServer, holdItem, tick, token, walkToTile, type ServerRoom } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
let now = 10_000_000;

const NOON = Date.UTC(2026, 8, 26, 17, 0);
const SEED = 12345;
/** El azar de la pesca: la espera, el pez (0 = el primero que pica), la semilla, el cofre y el tamaño. */
const fixedRandom = (n: number) => (n === 2 ** 31 ? SEED : n === 1000 ? 999 : n === 10_001 ? 0 : 0);

const jardin = getWorld().areas.get("jardin")!;
const shop = pointsOfType(jardin, "fishing_shop")[0]!;
const spot = pointsOfType(jardin, "fishing_spot")[0]!;

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
  now = 10_000_000;
  OfficeRoom.pescaNow = () => now;
  OfficeRoom.fishingNow = () => NOON;
  OfficeRoom.gameClockNow = () => NOON;
  OfficeRoom.gameClockInitial = { anchorReal: NOON, anchorMinute: 3 * 1440 + 12 * 60 };
  OfficeRoom.weatherInitial = "despejado";
  OfficeRoom.fishingRandom = fixedRandom;
  OfficeRoom.fishingTimings = { ...FISHING, biteMinMs: 40, biteMaxMs: 60, biteWindowMs: 800, slackMs: 60_000, showMs: 300 };
});
afterEach(() => {
  OfficeRoom.pescaNow = () => Date.now();
  OfficeRoom.fishingNow = () => Date.now();
  OfficeRoom.gameClockNow = () => Date.now();
  OfficeRoom.gameClockInitial = null;
  OfficeRoom.weatherInitial = null;
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

/** Alice (con `points` y lo que diga `stock` en la mochila) entra al jardín y camina hasta `at`. */
async function setup(points: number, opts: { stock?: Record<string, number>; at?: { tileX: number; tileY: number } | null } = {}) {
  if (points > 0) await repo.awardPoints({ userId: "u-alice", amount: points, reason: "ADMIN" });
  for (const [itemId, n] of Object.entries(opts.stock ?? {})) await repo.addInventory("u-alice", itemId, n);
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  await room.waitForNextPatch();
  const at = opts.at === undefined ? shop : opts.at;
  if (at) await walkToTile(alice, room, at.tileX, at.tileY);
  const results: PescaBuyResult[] = [];
  const sold: PescaSoldEvent[] = [];
  const fishing: FishingEvent[] = [];
  alice.onMessage(PESCA_MSG.result, (r: PescaBuyResult) => results.push(r));
  alice.onMessage(PESCA_MSG.sold, (e: PescaSoldEvent) => sold.push(e));
  alice.onMessage(MSG.fishEvent, (e: FishingEvent) => fishing.push(e));
  const buy = async (item: string) => {
    const before = results.length;
    alice.send(PESCA_MSG.buy, { item });
    const r = await waitFor(() => results[before]);
    await bagOf(room).flush("u-alice");
    await room.waitForNextPatch();
    now += PESCA.buyCooldownMs + 1;
    return r;
  };
  const count = (itemId: string) => bagOf(room).count("u-alice", itemId);
  const me = () => room.state.players.get(alice.sessionId)!;
  return { room, alice, buy, results, sold, fishing, count, me };
}

describe("el puesto de pesca: comprar", () => {
  it("lejos del mostrador no vende (ni cobra)", async () => {
    const { buy, count } = await setup(500, { at: spot });
    expect(await buy("cana-fibra")).toEqual({ ok: false, item: "cana-fibra", error: "far" });
    expect(await repo.getPoints("u-alice")).toBe(500);
    expect(count("obj:cana-fibra")).toBe(0);
  });

  it("junto al mostrador cobra (PURCHASE, pesca:<id>), la caña va a la mochila y a la mano, y Don Evelio lo dice a todos", async () => {
    const { buy, count, me, sold, alice } = await setup(500);
    const fibra = pescaItem("cana-fibra")!;
    expect(await buy("cana-fibra")).toEqual({ ok: true, item: "cana-fibra", balance: 500 - fibra.price });
    expect(repo.ledger.at(-1)).toMatchObject({ amount: -fibra.price, reason: "PURCHASE", refId: "pesca:cana-fibra" });
    expect(count("obj:cana-fibra")).toBe(1);
    expect(me().held).toBe("cana-fibra");
    expect(me().points).toBe(500 - fibra.price);
    await waitFor(() => sold[0]);
    expect(sold[0]).toMatchObject({ sessionId: alice.sessionId, item: "cana-fibra" });
  });

  it("sin saldo no vende; la caña se compra una sola vez; la carnada viene de a 10", async () => {
    const poor = await setup(20);
    expect(await poor.buy("cana-carbono")).toEqual({ ok: false, item: "cana-carbono", error: "funds" });
    expect(poor.count("obj:cana-carbono")).toBe(0);
    expect(await poor.buy("carnada")).toMatchObject({ ok: true, item: "carnada" });
    expect(poor.count("obj:carnada")).toBe(10);
    await colyseus.cleanup();
    repo = new MemoryRepository();
    OfficeRoom.repo = repo;
    const rich = await setup(1000, { stock: { "obj:cana-fibra": 1 } });
    expect(await rich.buy("cana-fibra")).toEqual({ ok: false, item: "cana-fibra", error: "owned" });
    expect(await repo.getPoints("u-alice")).toBe(1000);
  });

  it("de a una compra por vez (la pausa), y avisa si la mochila está llena o la carnada no cabe", async () => {
    const stock: Record<string, number> = { "obj:carnada": PESCA.baitMax - 5 };
    // 35 cosas distintas más la carnada: las 36 casillas llenas.
    for (let i = 0; i < BAG.slots - 1; i++) stock[`obj:cosa-${i}`] = 1;
    const { buy, count } = await setup(1000, { stock });
    expect(await buy("carnada")).toEqual({ ok: false, item: "carnada", error: "stack" });
    expect(await buy("cana-fibra")).toEqual({ ok: false, item: "cana-fibra", error: "full" });
    expect(await repo.getPoints("u-alice")).toBe(1000);
    expect(count("obj:carnada")).toBe(PESCA.baitMax - 5);
    // Dos seguidas sin esperar: la segunda se frena.
    await colyseus.cleanup();
    repo = new MemoryRepository();
    OfficeRoom.repo = repo;
    const s = await setup(1000);
    s.alice.send(PESCA_MSG.buy, { item: "carnada" });
    s.alice.send(PESCA_MSG.buy, { item: "carnada" });
    await waitFor(() => s.results[1]);
    // La segunda responde antes (no espera a la base): llega "busy" y después el "ok" de la primera.
    expect(s.results.map((r) => (r.ok ? "ok" : r.error)).sort()).toEqual(["busy", "ok"]);
    expect(s.count("obj:carnada")).toBe(10);
  });
});

describe("el puesto de pesca: pescar con lo comprado", () => {
  /** Lanza, espera la picada y responde: el minijuego que manda el servidor. */
  async function hooked(s: Awaited<ReturnType<typeof setup>>) {
    const from = s.fishing.length;
    s.alice.send(MSG.fishCast);
    const cast = await waitFor(() => s.fishing.slice(from).find((e): e is Extract<FishingEvent, { type: "cast" }> => e.type === "cast"));
    await waitFor(() => s.fishing.slice(from).find((e) => e.type === "bite"));
    s.alice.send(MSG.fishHook, { castId: cast.castId });
    const start = await waitFor(() => s.fishing.slice(from).find((e): e is Extract<FishingEvent, { type: "start" }> => e.type === "start"));
    return { castId: cast.castId, challenge: start.challenge };
  }

  it("sin nada comprado se pesca con la de bambú (el minijuego de siempre, sin caña en el reto)", async () => {
    const s = await setup(0, { at: spot });
    const { challenge } = await hooked(s);
    expect(challenge.rod).toBeUndefined();
    expect(s.me().fishingRod).toBe("bambu");
  });

  it("con la caña de carbono en la mochila se pesca con ella: todos ven su color y el servidor valida el minijuego con esa caña", async () => {
    const s = await setup(0, { at: spot, stock: { "obj:cana-fibra": 1, "obj:cana-carbono": 1 } });
    const { castId, challenge } = await hooked(s);
    expect(challenge.rod).toBe("carbono");
    await s.room.waitForNextPatch();
    expect(s.me().fishingRod).toBe("carbono");
    const run = autoplay(challenge);
    expect(run.caught).toBe(true);
    const from = s.fishing.length;
    s.alice.send(MSG.fishFinish, { castId, frames: run.frames, inputs: run.inputs });
    const end = await waitFor(() => s.fishing.slice(from).find((e): e is Extract<FishingEvent, { type: "end" }> => e.type === "end"));
    expect(end.outcome).toBe("caught");
  });

  it("con la de fibra en la mano se pesca con esa aunque tenga la de carbono", async () => {
    const s = await setup(0, { at: spot, stock: { "obj:cana-fibra": 1, "obj:cana-carbono": 1 } });
    await holdItem(s.alice, s.room, "obj:cana-fibra");
    const { challenge } = await hooked(s);
    expect(challenge.rod).toBe("fibra");
  });

  it("la carnada se gasta una por lance y hace picar antes", async () => {
    OfficeRoom.fishingTimings = { ...OfficeRoom.fishingTimings, biteMinMs: 1500, biteMaxMs: 1500 };
    const slow = await setup(0, { at: spot });
    const t0 = Date.now();
    slow.alice.send(MSG.fishCast);
    await waitFor(() => slow.fishing.find((e) => e.type === "bite"));
    const plain = Date.now() - t0;
    expect(plain).toBeGreaterThanOrEqual(1400);
    await colyseus.cleanup();
    repo = new MemoryRepository();
    OfficeRoom.repo = repo;

    const s = await setup(0, { at: spot, stock: { "obj:carnada-buena": 3 } });
    const t1 = Date.now();
    s.alice.send(MSG.fishCast);
    await waitFor(() => s.fishing.find((e) => e.type === "bite"));
    expect(Date.now() - t1).toBeLessThan(1100);
    await bagOf(s.room).flush("u-alice");
    expect(s.count("obj:carnada-buena")).toBe(2);
    expect((await repo.getInventory("u-alice")).find((i) => i.itemId === "obj:carnada-buena")?.quantity).toBe(2);
  });

  it("si no se pudo lanzar (lejos del lago) la carnada no se gasta", async () => {
    const s = await setup(0, { at: shop, stock: { "obj:carnada": 4 } });
    s.alice.send(MSG.fishCast);
    await waitFor(() => s.fishing.find((e) => e.type === "refused"));
    await bagOf(s.room).flush("u-alice");
    expect(s.count("obj:carnada")).toBe(4);
  });
});
