import type { ColyseusTestServer } from "@colyseus/testing";
import { BLACKJACK_SEATS, getWorld, pointsOfType } from "@hyvento/map";
import { BLACKJACK, CASINO, MESA_POINT, MSG, PARRILLA_MSG, ROOM_NAME, type CasinoResult } from "@hyvento/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { randomShoe } from "../src/rooms/casino/blackjack";
import { DEFAULT_MESA_TIMINGS } from "../src/rooms/casino/mesas";
import { OpenRounds } from "../src/rooms/casino/recovery";
import { randomSpin } from "../src/rooms/casino/roulette";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bagOf, bootServer, c, goToArea, tick, token, walkToTile, type ServerRoom } from "./helpers";

// Cerrar la sala (o apagar el servidor) no se queda con nada: las apuestas de rondas sin pagar se devuelven
// (sin duplicar las que ya se pagaron), lo que estaba en la parrilla vuelve a la mochila y, al arrancar, se
// devuelven las rondas que dejó abiertas una corrida que se cayó.

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
const MIN_AGE = OpenRounds.minAgeMs;

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
  // Rondas largas: la apuesta queda abierta hasta que el test la cierre o cierre la sala.
  OfficeRoom.rouletteTimings = { bettingMs: 60_000, spinMs: 50, resultMs: 50 };
  OfficeRoom.rouletteSpin = () => 1; // rojo
  OfficeRoom.mesaTimings = { bettingMs: 60_000, resultMs: 50, playMs: () => 50 };
  OfficeRoom.blackjackTimings = { bettingMs: 60_000, turnMs: 5_000, dealerStepMs: 30, resultMs: 5_000 };
});
afterEach(() => {
  OfficeRoom.rouletteTimings = { ...CASINO.roulette };
  OfficeRoom.rouletteSpin = randomSpin;
  OfficeRoom.mesaTimings = { ...DEFAULT_MESA_TIMINGS };
  OfficeRoom.blackjackTimings = { ...BLACKJACK };
  OfficeRoom.blackjackShuffle = randomShoe;
  OfficeRoom.parrillaTimeScale = 1;
  OpenRounds.minAgeMs = MIN_AGE; // un test lo baja
});

/** Alice entra al sótano con `points` puntos. */
async function enter(points: number) {
  await repo.awardPoints({ userId: "u-alice", amount: points, reason: "ADMIN" });
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  await room.waitForNextPatch();
  await goToArea(alice, room, "sotano");
  const results: CasinoResult[] = [];
  alice.onMessage(MSG.casinoResult, (r: CasinoResult) => results.push(r));
  const send = async (type: string, msg: unknown) => {
    alice.send(type, msg);
    await tick(80);
    return results.at(-1);
  };
  return { room, alice, send };
}

async function atRoulette(points: number) {
  const e = await enter(points);
  const spot = pointsOfType(getWorld().areas.get("sotano")!, "roulette")[0]!;
  await walkToTile(e.alice, e.room, spot.tileX, spot.tileY);
  return e;
}

const casinoMoves = () => repo.ledger.filter((m) => m.reason === "CASINO");

describe("cierre de la sala: casino", () => {
  it("una apuesta de ruleta abierta se devuelve al cerrar la sala, con el mismo refId", async () => {
    const { room, send } = await atRoulette(50);
    expect(await send(MSG.rouletteBet, { bet: { kind: "red" }, amount: 10 })).toEqual({ ok: true, balance: 40 });
    await send(MSG.rouletteBet, { bet: { kind: "number", n: 7 }, amount: 5 });
    expect(await repo.getPoints("u-alice")).toBe(35);
    // Mientras la ronda está abierta, queda anotada por si el servidor se cae.
    expect([...repo.casinoOpen.values()].flatMap((r) => r.refIds)).toHaveLength(1);

    await room.disconnect();
    expect(await repo.getPoints("u-alice")).toBe(50);
    const moves = casinoMoves();
    expect(moves.map((m) => m.amount)).toEqual([-10, -5, 15]);
    expect(new Set(moves.map((m) => m.refId)).size).toBe(1);
    expect(moves[0]!.refId).toMatch(/^ruleta:\d+:/);
    expect(repo.casinoOpen.size).toBe(0);
  });

  it("una ronda que ya se pagó (o se perdió) no se devuelve al cerrar", async () => {
    const { room, send } = await atRoulette(50);
    await send(MSG.rouletteBet, { bet: { kind: "red" }, amount: 10 }); // gana: +20
    await send(MSG.rouletteBet, { bet: { kind: "black" }, amount: 5 }); // pierde
    (room as unknown as { roulette: { spin(): void } }).roulette.spin();
    await tick(300);
    expect(await repo.getPoints("u-alice")).toBe(55);
    expect(repo.casinoOpen.size).toBe(0);

    await room.disconnect();
    expect(await repo.getPoints("u-alice")).toBe(55);
    expect(casinoMoves().map((m) => m.amount)).toEqual([-10, -5, 20]);
  });

  it("también las mesas (baccarat) y el blackjack devuelven lo apostado sin jugar", async () => {
    const { room, alice, send } = await enter(100);
    const spot = pointsOfType(getWorld().areas.get("sotano")!, MESA_POINT.baccarat)[0]!;
    await walkToTile(alice, room, spot.tileX, spot.tileY);
    expect(await send(MSG.mesaBet, { table: "baccarat", bet: "player", amount: 10 })).toMatchObject({ ok: true });
    const seat = BLACKJACK_SEATS[0]!;
    await walkToTile(alice, room, seat.x, seat.y - 1);
    alice.send(MSG.move, { x: c(seat.x), y: c(seat.y), dir: "down", moving: false, seated: true });
    await room.waitForNextPatch();
    await tick();
    expect(await send(MSG.blackjackBet, { amount: 20 })).toMatchObject({ ok: true });
    expect(await repo.getPoints("u-alice")).toBe(70);

    await room.disconnect();
    expect(await repo.getPoints("u-alice")).toBe(100);
    expect(repo.casinoOpen.size).toBe(0);
  });
});

describe("al arrancar: rondas de una corrida que se cayó", () => {
  it("devuelve lo que quedó sin pagar, sin tocar lo ya devuelto ni las corridas recientes", async () => {
    const old = Date.now() - OpenRounds.minAgeMs - 60_000;
    const at = Date.now() - 20 * 60_000;
    await repo.awardPoints({ userId: "u-alice", amount: 50, reason: "ADMIN" });
    await repo.awardPoints({ userId: "u-bob", amount: 50, reason: "ADMIN" });
    repo.ledger.push(
      // Alice apostó dos veces en la ruleta de la corrida muerta y nunca se pagó.
      { userId: "u-alice", amount: -10, reason: "CASINO", at, refId: "ruleta:3:muerta" },
      { userId: "u-alice", amount: -5, reason: "CASINO", at, refId: "ruleta:3:muerta" },
      // A Bob ya se le devolvió (la ronda se cerró mientras cobraba): no hay nada más que darle.
      { userId: "u-bob", amount: -20, reason: "CASINO", at, refId: "blackjack:2:muerta" },
      { userId: "u-bob", amount: 20, reason: "CASINO", at, refId: "blackjack:2:muerta" },
      // Una ronda de una corrida que sigue viva (o recién caída): todavía no se toca.
      { userId: "u-bob", amount: -7, reason: "CASINO", at: Date.now(), refId: "ruleta:9:viva" },
    );
    repo.casinoOpen.set("muerta", { refIds: ["ruleta:3:muerta", "blackjack:2:muerta"], updatedAt: old });
    repo.casinoOpen.set("viva", { refIds: ["ruleta:9:viva"], updatedAt: Date.now() });

    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    expect(await repo.getPoints("u-alice")).toBe(50);
    expect(await repo.getPoints("u-bob")).toBe(43);
    expect(repo.ledger.filter((m) => m.refId === "ruleta:3:muerta").at(-1)).toMatchObject({ userId: "u-alice", amount: 15 });
    expect([...repo.casinoOpen.keys()]).toEqual(["viva"]);

    // Revisarlo otra vez (el intervalo, u otro servidor) no devuelve de nuevo.
    await (room as unknown as { casinoRounds: OpenRounds }).casinoRounds.recover();
    expect(await repo.getPoints("u-alice")).toBe(50);

    // Pasado el umbral, la corrida que parecía viva también se devuelve.
    OpenRounds.minAgeMs = 0;
    await (room as unknown as { casinoRounds: OpenRounds }).casinoRounds.recover(Date.now() + 1);
    expect(await repo.getPoints("u-bob")).toBe(50);
    expect(repo.casinoOpen.size).toBe(0);
    await room.disconnect();
  });
});

describe("cierre de la sala: parrilla", () => {
  it("los ingredientes de lo que se está cocinando vuelven a la mochila", async () => {
    OfficeRoom.parrillaTimeScale = 1; // tarda de verdad: sigue en el fuego al cerrar
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    await room.waitForNextPatch();
    await bagOf(room).add("u-alice", "obj:harina", 2);
    await bagOf(room).add("u-alice", "obj:queso", 1);
    const grill = pointsOfType(getWorld().areas.get("jardin")!, "grill")[0]!;
    await walkToTile(alice, room, grill.tileX, grill.tileY);
    alice.send(PARRILLA_MSG.cook, { recipe: "arepa-asada" });
    await tick(150);
    await room.waitForNextPatch();
    expect(room.state.granja.grill.get("u-alice")).toMatchObject({ recipe: "arepa-asada" });
    await bagOf(room).flush("u-alice");
    expect(await repo.getInventory("u-alice")).not.toContainEqual(expect.objectContaining({ itemId: "obj:harina", quantity: 2 }));

    await room.disconnect();
    const inv = await repo.getInventory("u-alice");
    expect(inv).toContainEqual(expect.objectContaining({ itemId: "obj:harina", quantity: 2 }));
    expect(inv).toContainEqual(expect.objectContaining({ itemId: "obj:queso", quantity: 1 }));
  });
});
