// Propinas en el tubo: quien mira desde el escenario le tira billetes a quien baila. El servidor valida
// todo (que baile, la distancia, el saldo, la pausa y los topes) y mueve los puntos de los dos juntos.
import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, isBlockedTile, pointsOfType } from "@hyvento/map";
import { CLUB_TIP, GIFT, MSG, ROOM_NAME, type ClubTipEvent, type ClubTipResult } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { inTipReach, poleByKey } from "../src/rooms/clubTips";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, c, goToArea, tick, token, walkToTile, type ServerRoom } from "./helpers";

const sotano = () => getWorld().areas.get("sotano")!;

/** Tiles libres de la tarima (junto al tubo), un tile de la pista de baile (lejos del tubo) y el tubo. */
function spots() {
  const map = sotano();
  const stage = pointsOfType(map, "pole_stage")
    .filter((p) => !isBlockedTile(map, p.tileX, p.tileY))
    .map((p) => ({ x: p.tileX, y: p.tileY }));
  const floor = map.furniture.find((f) => f.type === "dance-floor")!;
  const pole = map.furniture.find((f) => f.type === "dance-pole")!;
  return { stage, floor: { x: floor.x + 1, y: floor.y + floor.d - 1 }, pole };
}

describe("propinas (reglas)", () => {
  it("desde la tarima se llega al tubo; desde la otra punta de la pista, no", () => {
    const map = sotano();
    const { stage, floor, pole } = spots();
    expect(poleByKey(map, `${pole.x},${pole.y}`)).toBe(pole);
    for (const s of stage) expect(inTipReach(map, pole, c(s.x), c(s.y)), `${s.x},${s.y}`).toBe(true);
    expect(inTipReach(map, pole, c(floor.x), c(floor.y))).toBe(false);
    // Fuera del sótano no hay tubo con esa llave.
    expect(poleByKey(getWorld().areas.get("jardin")!, `${pole.x},${pole.y}`)).toBeUndefined();
  });
});

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
});

/** Lo que le llega a cada cliente sobre propinas. */
function inbox(client: ClientRoom) {
  const box = { tips: [] as ClubTipEvent[], errors: [] as ClubTipResult[] };
  client.onMessage(MSG.clubTipped, (e: ClubTipEvent) => box.tips.push(e));
  client.onMessage(MSG.clubTipResult, (r: ClubTipResult) => box.errors.push(r));
  client.onMessage(MSG.clubResult, () => undefined);
  return box;
}

/** Alice baila en el tubo (si `dance`) y Bob mira desde la tarima, cada uno con su saldo. */
async function setup({ alice: aliceCoins = 0, bob: bobCoins = 100, dance = true } = {}) {
  if (aliceCoins) await repo.awardPoints({ userId: "u-alice", amount: aliceCoins, reason: "ADMIN" });
  if (bobCoins) await repo.awardPoints({ userId: "u-bob", amount: bobCoins, reason: "ADMIN" });
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
  await room.waitForNextPatch();
  const a = inbox(alice);
  const b = inbox(bob);
  const { stage } = spots();
  await goToArea(alice, room, "sotano");
  await walkToTile(alice, room, stage[0]!.x, stage[0]!.y);
  if (dance) {
    alice.send(MSG.clubPole, { on: true });
    await tick(60);
    expect(room.state.club.dancers.get(alice.sessionId)?.kind).toBe("pole");
  }
  await goToArea(bob, room, "sotano");
  await walkToTile(bob, room, stage[stage.length - 1]!.x, stage[stage.length - 1]!.y);
  const tip = async (from: ClientRoom, to: string, amount: number) => {
    from.send(MSG.clubTip, { to, amount });
    await tick(80);
  };
  return { room, alice, bob, a, b, tip };
}

const points = (userId: string) => repo.getPoints(userId);

describe("propinas (en la sala)", () => {
  it("una propina válida: Bob paga, Alice la recibe entera, los dos ven su saldo y todos la animación", async () => {
    const { room, alice, bob, a, b, tip } = await setup({ alice: 10, bob: 100 });
    await tip(bob, alice.sessionId, 5);
    expect(b.errors).toEqual([]);
    expect(await points("u-bob")).toBe(95);
    expect(await points("u-alice")).toBe(15);
    await room.waitForNextPatch();
    expect(room.state.players.get(bob.sessionId)!.points).toBe(95);
    expect(room.state.players.get(alice.sessionId)!.points).toBe(15);
    const event = { fromSessionId: bob.sessionId, fromName: "Bob", toSessionId: alice.sessionId, toName: "Alice", amount: 5 };
    expect(a.tips).toEqual([expect.objectContaining(event)]);
    expect(b.tips).toEqual([expect.objectContaining(event)]);
    // Los dos movimientos van con motivo GIFT y el mismo refId de propina.
    const moves = repo.ledger.filter((m) => m.reason === "GIFT");
    expect(moves.map((m) => [m.userId, m.amount])).toEqual([
      ["u-bob", -5],
      ["u-alice", 5],
    ]);
    expect(moves[0]!.refId).toMatch(new RegExp(`^${CLUB_TIP.refPrefix}`));
    expect(moves[1]!.refId).toBe(moves[0]!.refId);
    // La marca del día queda en el estado del club.
    expect(room.state.club.tips.toJSON()).toMatchObject({ best: 5, bestFrom: "Bob", bestTo: "Alice", topName: "Alice", topTotal: 5 });
  });

  it("a quien no está bailando en el tubo no se le tira nada", async () => {
    const { alice, bob, b, tip } = await setup({ dance: false });
    await tip(bob, alice.sessionId, 5);
    expect(b.errors).toEqual([{ ok: false, error: "not-dancing" }]);
    // Ni a una sesión que no existe.
    await tip(bob, "nadie", 5);
    expect(b.errors.at(-1)).toEqual({ ok: false, error: "not-dancing" });
    expect(await points("u-bob")).toBe(100);
    expect(b.tips).toEqual([]);
  });

  it("de lejos (en la otra punta de la pista) no llega", async () => {
    const { room, alice, bob, b, tip } = await setup();
    const { floor } = spots();
    await walkToTile(bob, room, floor.x, floor.y);
    await tip(bob, alice.sessionId, 5);
    expect(b.errors).toEqual([{ ok: false, error: "far" }]);
    expect(await points("u-bob")).toBe(100);
    expect(await points("u-alice")).toBe(0);
  });

  it("sin saldo no se cobra ni se paga nada", async () => {
    const { alice, bob, b, tip } = await setup({ bob: 3 });
    await tip(bob, alice.sessionId, 5);
    expect(b.errors).toEqual([{ ok: false, error: "funds" }]);
    expect(await points("u-bob")).toBe(3);
    expect(await points("u-alice")).toBe(0);
    expect(b.tips).toEqual([]);
  });

  it("quien baila no se tira a sí misma, y los montos son los fijos", async () => {
    const { alice, bob, a, b, tip } = await setup({ alice: 50 });
    await tip(alice, alice.sessionId, 5);
    expect(a.errors).toEqual([{ ok: false, error: "self" }]);
    expect(await points("u-alice")).toBe(50);
    await tip(bob, alice.sessionId, 7);
    expect(b.errors).toEqual([{ ok: false, error: "invalid" }]);
    expect(await points("u-bob")).toBe(100);
  });

  it("entre dos propinas hay una pausa corta (el clic repetido pasa, la ráfaga no)", async () => {
    const { alice, bob, b, tip } = await setup();
    bob.send(MSG.clubTip, { to: alice.sessionId, amount: 1 });
    bob.send(MSG.clubTip, { to: alice.sessionId, amount: 1 });
    await tick(80);
    expect(b.errors).toEqual([{ ok: false, error: "busy" }]);
    expect(await points("u-alice")).toBe(1);
    await tick(CLUB_TIP.cooldownMs);
    await tip(bob, alice.sessionId, 1);
    expect(await points("u-alice")).toBe(2);
    expect(await points("u-bob")).toBe(98);
  });

  it("tope diario: de propinas por persona, y el de dar de los regalos también cuenta", async () => {
    const { alice, bob, b, tip } = await setup({ bob: 2000 });
    // Bob ya tiró casi todo el tope hoy.
    repo.ledger.push({ userId: "u-bob", amount: -(CLUB_TIP.dailyMax - 5), reason: "GIFT", at: Date.now(), refId: "tip:antes" });
    await tip(bob, alice.sessionId, 10);
    expect(b.errors).toEqual([{ ok: false, error: "limit-tips" }]);
    await tick(CLUB_TIP.cooldownMs);
    await tip(bob, alice.sessionId, 5);
    expect(b.errors).toHaveLength(1);
    expect(await points("u-alice")).toBe(5);
    await tick(CLUB_TIP.cooldownMs);
    await tip(bob, alice.sessionId, 1);
    expect(b.errors.at(-1)).toEqual({ ok: false, error: "limit-tips" });
    // Lo tirado otro día no cuenta: con las propinas de hoy fuera del libro, vuelve a poder.
    repo.ledger = repo.ledger.filter((m) => m.reason !== "GIFT");
    repo.ledger.push({ userId: "u-bob", amount: -CLUB_TIP.dailyMax, reason: "GIFT", at: Date.now() - 2 * 86_400_000, refId: "tip:anteayer" });
    await tick(CLUB_TIP.cooldownMs);
    await tip(bob, alice.sessionId, 1);
    expect(b.errors).toHaveLength(2);
    // Los regalos de hoy sí suman al tope común de dar.
    repo.ledger.push({ userId: "u-bob", amount: -(GIFT.dailyPoints - 3), reason: "GIFT", at: Date.now(), refId: "gift:x" });
    await tick(CLUB_TIP.cooldownMs);
    await tip(bob, alice.sessionId, 5);
    expect(b.errors.at(-1)).toEqual({ ok: false, error: "limit" });
  });
});
