import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, pointsOfType } from "@hyvento/map";
import { CASINO, MSG, ROOM_NAME, type CasinoResult, type RouletteSettled } from "@hyvento/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { randomSpin } from "../src/rooms/casino/roulette";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, goToArea, tick, token, walkToTile } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;

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
  // Rondas largas para apostar con calma; el número que sale lo fija cada test.
  OfficeRoom.rouletteTimings = { bettingMs: 60_000, spinMs: 50, resultMs: 50 };
  OfficeRoom.rouletteSpin = () => 1;
});
afterEach(() => {
  OfficeRoom.rouletteTimings = { ...CASINO.roulette };
  OfficeRoom.rouletteSpin = randomSpin;
});

/** Alice entra con `points` puntos y queda junto a la mesa de ruleta del sótano (o no). */
async function setup(points: number, atTable = true) {
  if (points > 0) await repo.awardPoints({ userId: "u-alice", amount: points, reason: "ADMIN" });
  const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  await room.waitForNextPatch();
  await goToArea(alice, room, "sotano");
  if (atTable) {
    const spot = pointsOfType(getWorld().areas.get("sotano")!, "roulette")[0]!;
    await walkToTile(alice, room, spot.tileX, spot.tileY);
  }
  const results: CasinoResult[] = [];
  const settled: RouletteSettled[] = [];
  alice.onMessage(MSG.casinoResult, (r: CasinoResult) => results.push(r));
  alice.onMessage(MSG.rouletteSettled, (s: RouletteSettled) => settled.push(s));
  const bet = async (bet: unknown, amount: number) => {
    alice.send(MSG.rouletteBet, { bet, amount });
    await tick(80);
    return results.at(-1);
  };
  /** Cierra la ronda ya (como si se acabara el tiempo de apostar) y espera el pago. */
  const finish = async () => {
    // Acortar la ronda en curso: el temporizador ya programado se reemplaza reiniciando la fase.
    (room as unknown as { roulette: { spin(): void } }).roulette.spin();
    await tick(250);
    await room.waitForNextPatch();
  };
  return { room, alice, bet, finish, settled, me: () => room.state.players.get(alice.sessionId)! };
}

describe("ruleta", () => {
  it("una apuesta a rojo que sale roja paga el doble", async () => {
    OfficeRoom.rouletteSpin = () => 1; // el 1 es rojo
    const { bet, finish, settled, me } = await setup(50);
    expect(await bet({ kind: "red" }, 10)).toEqual({ ok: true, balance: 40 });
    await finish();
    expect(settled.at(-1)).toMatchObject({ result: 1, staked: 10, won: 20 });
    expect(await repo.getPoints("u-alice")).toBe(60);
    expect(me().points).toBe(60);
  });

  it("un pleno paga 35 a 1 y lo que pierde se queda en la casa", async () => {
    OfficeRoom.rouletteSpin = () => 17;
    const { bet, finish, settled } = await setup(50);
    await bet({ kind: "number", n: 17 }, 2);
    await bet({ kind: "black" }, 5); // el 17 es negro: también gana
    await bet({ kind: "dozen", d: 3 }, 5); // pierde
    await finish();
    expect(settled.at(-1)).toMatchObject({ result: 17, staked: 12, won: 2 * 36 + 5 * 2 });
    expect(await repo.getPoints("u-alice")).toBe(50 - 12 + 72 + 10);
  });

  it("no se puede apostar lejos de la mesa ni sin saldo", async () => {
    const far = await setup(50, false);
    expect(await far.bet({ kind: "red" }, 10)).toEqual({ ok: false, error: "far" });
    await colyseus.cleanup();
    repo = new MemoryRepository();
    OfficeRoom.repo = repo;
    const poor = await setup(5);
    expect(await poor.bet({ kind: "red" }, 10)).toEqual({ ok: false, error: "funds" });
    expect(await repo.getPoints("u-alice")).toBe(5);
  });

  it("no hay límite diario: se apuesta mientras alcancen los puntos", async () => {
    const { bet } = await setup(300);
    for (let i = 0; i < 6; i++) expect(await bet({ kind: "red" }, 50)).toMatchObject({ ok: true });
    expect(await bet({ kind: "black" }, 1)).toEqual({ ok: false, error: "funds" });
    expect(await repo.getPoints("u-alice")).toBe(0);
  });

  it("con el casino cerrado no se apuesta, y una apuesta inventada se ignora", async () => {
    repo.casinoSettings = { enabled: false };
    const { bet } = await setup(50);
    expect(await bet({ kind: "red" }, 10)).toEqual({ ok: false, error: "disabled" });
    expect(await bet({ kind: "number", n: 40 }, 10)).toEqual({ ok: false, error: "disabled" }); // la última respuesta sigue siendo la anterior
    expect(await repo.getPoints("u-alice")).toBe(50);
  });
});
