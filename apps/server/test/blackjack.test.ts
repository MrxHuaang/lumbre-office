import type { ColyseusTestServer } from "@colyseus/testing";
import { BLACKJACK_SEATS } from "@hyvento/map";
import { BLACKJACK, MSG, ROOM_NAME, type BlackjackSettled, type CasinoResult } from "@hyvento/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { randomShoe } from "../src/rooms/casino/blackjack";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, c, goToArea, tick, token, walkToTile } from "./helpers";

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
  OfficeRoom.blackjackTimings = { bettingMs: 100, turnMs: 5_000, dealerStepMs: 30, resultMs: 5_000 };
});
afterEach(() => {
  OfficeRoom.blackjackTimings = { ...BLACKJACK };
  OfficeRoom.blackjackShuffle = randomShoe;
});

/** Carta de picas por valor (1 = as … 13 = rey). */
const card = (rank: number) => rank - 1;
/**
 * Sabot fijo para una persona sola: se reparte en orden (tu primera carta, la del crupier, tu segunda,
 * la tapada del crupier) y después lo que se pida. `pop()` saca del final, así que va al revés.
 */
const shoe = (mine: [number, number], dealer: [number, number], ...then: number[]) => {
  const order = [mine[0], dealer[0], mine[1], dealer[1], ...then].map(card);
  OfficeRoom.blackjackShuffle = () => [...order].reverse();
};

/** Alice entra con `points` y se sienta en la banqueta de la punta de arriba (asiento 1). */
async function setup(points: number, sit = true) {
  await repo.awardPoints({ userId: "u-alice", amount: points, reason: "ADMIN" });
  const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  await room.waitForNextPatch();
  await goToArea(alice, room, "sotano");
  // Se llega por detrás de la banqueta (mira hacia la mesa, abajo) y se sienta.
  const seat = BLACKJACK_SEATS[0]!;
  await walkToTile(alice, room, seat.x, seat.y - 1);
  if (sit) {
    alice.send(MSG.move, { x: c(seat.x), y: c(seat.y), dir: "down", moving: false, seated: true });
    await room.waitForNextPatch();
    await tick();
  }
  const results: CasinoResult[] = [];
  const settled: BlackjackSettled[] = [];
  alice.onMessage(MSG.casinoResult, (r: CasinoResult) => results.push(r));
  alice.onMessage(MSG.blackjackSettled, (s: BlackjackSettled) => settled.push(s));
  const send = async (type: string, msg: unknown, wait = 80) => {
    alice.send(type, msg);
    await tick(wait);
  };
  return { room, alice, send, results, settled, table: () => room.state.blackjack };
}

describe("blackjack", () => {
  it("un blackjack paga 3 a 2", async () => {
    shoe([1, 13], [10, 7]);
    const { send, settled, table } = await setup(50);
    await send(MSG.blackjackBet, { amount: 10 }, 400);
    expect(table().seats[0]!.cards.length).toBe(2);
    expect(settled.at(-1)).toMatchObject({ outcome: "blackjack", staked: 10, won: 25 });
    expect(await repo.getPoints("u-alice")).toBe(65);
  });

  it("pedir y pasarse pierde; la carta del crupier va tapada hasta su turno", async () => {
    shoe([10, 6], [10, 7], 9);
    const { send, settled, table } = await setup(50);
    await send(MSG.blackjackBet, { amount: 10 }, 250);
    expect(table().phase).toBe("playing");
    expect([...table().dealer]).toEqual([card(10), -1]);
    await send(MSG.blackjackAction, { action: "hit" }, 300);
    expect(table().seats[0]!.status).toBe("bust");
    expect([...table().dealer]).toEqual([card(10), card(7)]);
    expect(settled.at(-1)).toMatchObject({ outcome: "lose", won: 0 });
    expect(await repo.getPoints("u-alice")).toBe(40);
  });

  it("doblar cobra otra apuesta, da una sola carta y paga el doble", async () => {
    shoe([5, 6], [10, 8], 10);
    const { send, settled, table } = await setup(50);
    await send(MSG.blackjackBet, { amount: 10 }, 250);
    await send(MSG.blackjackAction, { action: "double" }, 300);
    expect(table().seats[0]!.cards.length).toBe(3);
    expect(settled.at(-1)).toMatchObject({ outcome: "win", staked: 20, won: 40 });
    expect(await repo.getPoints("u-alice")).toBe(70);
  });

  it("varios \"doblar\" a la vez cobran y doblan una sola vez", async () => {
    shoe([5, 6], [10, 8], 10, 10, 10);
    const { alice, send, settled, table } = await setup(1000);
    await send(MSG.blackjackBet, { amount: 50 }, 250);
    // La base tarda en cobrar: sin la cola de la mesa, todos pasaban el chequeo antes del primer cobro.
    const bet = repo.casinoBet.bind(repo);
    repo.casinoBet = async (input) => {
      await tick(20);
      return bet(input);
    };
    for (let i = 0; i < 10; i++) alice.send(MSG.blackjackAction, { action: "double" });
    await tick(800);
    expect(table().seats[0]!.cards.length).toBe(3);
    expect(settled.at(-1)).toMatchObject({ outcome: "win", staked: 100, won: 200 });
    expect(await repo.getPoints("u-alice")).toBe(1100);
  });

  it("si se acaba el tiempo del turno, se planta sola", async () => {
    OfficeRoom.blackjackTimings = { bettingMs: 100, turnMs: 150, dealerStepMs: 30, resultMs: 5_000 };
    shoe([10, 7], [10, 9]);
    const { send, settled } = await setup(50);
    await send(MSG.blackjackBet, { amount: 10 }, 500);
    expect(settled.at(-1)).toMatchObject({ outcome: "lose", staked: 10 });
  });

  it("sin estar sentado a la mesa no se apuesta, ni se juega fuera de turno", async () => {
    shoe([10, 7], [10, 9]);
    const { send, results } = await setup(50, false);
    await send(MSG.blackjackBet, { amount: 10 });
    expect(results.at(-1)).toEqual({ ok: false, error: "seat" });
    await send(MSG.blackjackAction, { action: "hit" });
    expect(results.at(-1)).toEqual({ ok: false, error: "turn" });
    expect(await repo.getPoints("u-alice")).toBe(50);
  });
});
