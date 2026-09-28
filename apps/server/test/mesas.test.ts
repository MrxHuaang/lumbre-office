import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, pointsOfType } from "@hyvento/map";
import { MESA, MESA_POINT, MSG, NO_CARD, ROOM_NAME, type CasinoResult, type MesaId, type MesaSettled } from "@hyvento/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { CASINO_BURST } from "../src/rooms/casino/common";
import { DEFAULT_MESA_TIMINGS, randomMesaDraw } from "../src/rooms/casino/mesas";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, goToArea, tick, token, walkToTile } from "./helpers";
import { randomInt } from "node:crypto";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;

/** Cartas: palo 0, valor r (1 = as, 13 = rey). */
const card = (r: number) => r - 1;
const draws: Record<MesaId, number[]> = {
  // Jugador 9 (natural) contra banca 5.
  baccarat: [card(9), card(3), card(13), card(2), NO_CARD, NO_CARD],
  dados: [4, 4, 2],
  caballos: [2, 0, 1, 3, 4, 5],
};

beforeAll(async () => {
  colyseus = await bootServer(new MemoryRepository());
});
afterAll(async () => {
  await colyseus.shutdown();
});
beforeEach(async () => {
  await colyseus.cleanup();
  repo = new MemoryRepository();
  OfficeRoom.repo = repo;
  OfficeRoom.mesaTimings = { bettingMs: 60_000, resultMs: 50, playMs: () => 50 };
  OfficeRoom.mesaDraw = (t) => [...draws[t]];
});
afterEach(() => {
  OfficeRoom.mesaTimings = { ...DEFAULT_MESA_TIMINGS };
  OfficeRoom.mesaDraw = randomMesaDraw((n) => randomInt(n));
});

/** Alice entra con `points` puntos y queda junto a la mesa `table` (o lejos). */
async function setup(table: MesaId, points: number, atTable = true) {
  if (points > 0) await repo.awardPoints({ userId: "u-alice", amount: points, reason: "ADMIN" });
  const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  await room.waitForNextPatch();
  await goToArea(alice, room, "sotano");
  if (atTable) {
    const spot = pointsOfType(getWorld().areas.get("sotano")!, MESA_POINT[table])[0]!;
    await walkToTile(alice, room, spot.tileX, spot.tileY);
  }
  const results: CasinoResult[] = [];
  const settled: MesaSettled[] = [];
  alice.onMessage(MSG.casinoResult, (r: CasinoResult) => results.push(r));
  alice.onMessage(MSG.mesaSettled, (s: MesaSettled) => settled.push(s));
  const bet = async (bet: string, amount: number, t: string = table) => {
    alice.send(MSG.mesaBet, { table: t, bet, amount });
    await tick(80);
    return results.at(-1);
  };
  /** Cierra la ronda ya (como si se acabara el tiempo de apostar) y espera el pago. */
  const finish = async () => {
    (room as unknown as { mesas: Map<MesaId, { play(): void }> }).mesas.get(table)!.play();
    await tick(300);
    await room.waitForNextPatch();
  };
  return { room, bet, finish, settled, results, me: () => room.state.players.get(alice.sessionId)! };
}

describe("mesas de rondas compartidas", () => {
  it("el baccarat paga al jugador 1 a 1 y se queda con lo de la banca", async () => {
    const { bet, finish, settled, room } = await setup("baccarat", 50);
    expect(await bet("player", 10)).toEqual({ ok: true, balance: 40 });
    expect(await bet("banker", 5)).toEqual({ ok: true, balance: 35 });
    expect(room.state.mesas.get("baccarat")!.bets.length).toBe(2);
    await finish();
    expect(settled.at(-1)).toMatchObject({ table: "baccarat", staked: 15, won: 20 });
    expect(await repo.getPoints("u-alice")).toBe(55);
    // En el historial queda que ganó el jugador (0).
    expect(room.state.mesas.get("baccarat")!.history[0]).toBe(0);
  });

  it("los dados pagan la suma y cada número por dado", async () => {
    const { bet, finish, settled } = await setup("dados", 50);
    await bet("t10", 2); // suma 10: 6 a 1
    await bet("d4", 3); // dos cuatros: 2 a 1
    await bet("big", 5); // pierde
    await finish();
    expect(settled.at(-1)).toMatchObject({ table: "dados", result: [4, 4, 2], staked: 10, won: 2 * 7 + 3 * 3 });
    expect(await repo.getPoints("u-alice")).toBe(50 - 10 + 23);
  });

  it("en los caballitos gana quien apostó al que llegó primero", async () => {
    const { bet, finish, settled } = await setup("caballos", 50);
    await bet("h2", 4);
    await bet("h0", 4);
    await finish();
    expect(settled.at(-1)).toMatchObject({ table: "caballos", staked: 8, won: 4 * 5 });
  });

  it("hay que estar junto a la mesa de esa apuesta", async () => {
    const far = await setup("dados", 50, false);
    expect(await far.bet("big", 10)).toEqual({ ok: false, error: "far" });
    // Junto a los dados no se apuesta en el baccarat.
    await colyseus.cleanup();
    repo = new MemoryRepository();
    OfficeRoom.repo = repo;
    const near = await setup("dados", 50);
    expect(await near.bet("banker", 10, "baccarat")).toEqual({ ok: false, error: "far" });
    expect(await repo.getPoints("u-alice")).toBe(50);
  });

  it("una apuesta inventada se ignora y no se apuesta sin saldo", async () => {
    const { bet, results } = await setup("caballos", 5);
    await bet("h9", 1);
    expect(results).toHaveLength(0);
    expect(await bet("h1", 10)).toEqual({ ok: false, error: "funds" });
    expect(await repo.getPoints("u-alice")).toBe(5);
  });

  it("el historial llega entero al cliente aunque el resultado se repita", async () => {
    OfficeRoom.mesaTimings = { bettingMs: 100, resultMs: 100, playMs: () => 100 };
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    await tick(1_500);
    const server = [...room.state.mesas.get("dados")!.history];
    expect(server.length).toBeGreaterThan(2);
    expect(new Set(server).size).toBe(1);
    expect([...(alice.state as unknown as OfficeState).mesas.get("dados")!.history]).toEqual(server);
  });

  it("no pasa el tope de apuestas por ronda y con el juego andando no se apuesta", async () => {
    const { bet, room } = await setup("dados", 1000);
    const burst = CASINO_BURST.max;
    CASINO_BURST.max = 100; // acá se prueba el tope de la mesa, no el de ráfagas
    try {
      for (let i = 0; i < MESA.maxBetsPerRound; i++) expect(await bet("small", 1)).toMatchObject({ ok: true });
      expect(await bet("small", 1)).toEqual({ ok: false, error: "max-bets" });
    } finally {
      CASINO_BURST.max = burst;
    }
    OfficeRoom.mesaTimings = { bettingMs: 60_000, resultMs: 60_000, playMs: () => 60_000 };
    (room as unknown as { mesas: Map<MesaId, { play(): void }> }).mesas.get("dados")!.play();
    // Se espera a que pase la ventana del tope de ráfagas.
    await tick(1_100);
    expect(room.state.mesas.get("dados")!.phase).toBe("playing");
    expect(await bet("big", 1)).toEqual({ ok: false, error: "closed" });
  });
});
