import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, pointsOfType } from "@hyvento/map";
import { CAFE, MSG, ROOM_NAME, cafeItem, usesOf, type CafeOrderResult } from "@hyvento/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, goToArea, tick, token, walkToTile } from "./helpers";

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
});
afterEach(() => {
  OfficeRoom.heldMs = CAFE.heldMs;
});

const TINTO = cafeItem("tinto")!.price;

/** Alice entra con `points` puntos y queda junto a la barra de la planta baja (o no, con `atCounter: false`). */
async function setup(points: number, atCounter = true) {
  if (points > 0) await repo.awardPoints({ userId: "u-alice", amount: points, reason: "ADMIN" });
  const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  await room.waitForNextPatch();
  await goToArea(alice, room, "planta-baja");
  if (atCounter) {
    const barra = pointsOfType(getWorld().areas.get("planta-baja")!, "cafe_counter")[0]!;
    await walkToTile(alice, room, barra.tileX, barra.tileY);
  }
  const results: CafeOrderResult[] = [];
  alice.onMessage(MSG.cafeResult, (r: CafeOrderResult) => results.push(r));
  const order = async (item: string) => {
    alice.send(MSG.cafeOrder, { item });
    await tick(80);
    await room.waitForNextPatch();
    return results.at(-1);
  };
  return { room, alice, order, me: () => room.state.players.get(alice.sessionId)! };
}

describe("cafetería", () => {
  it("pedir en la barra cobra el precio y deja el producto en la mano", async () => {
    const { order, me } = await setup(20);
    expect(await order("tinto")).toEqual({ ok: true, item: "tinto", balance: 20 - TINTO });
    expect(me().held).toBe("tinto");
    expect(me().points).toBe(20 - TINTO);
    expect(repo.ledger.at(-1)).toMatchObject({ amount: -TINTO, reason: "PURCHASE", refId: "cafe:tinto" });
  });

  it("lejos de la barra no se puede pedir ni se cobra", async () => {
    const { order, me } = await setup(20, false);
    expect(await order("tinto")).toEqual({ ok: false, item: "tinto", error: "far" });
    expect(me().held).toBe("");
    expect(await repo.getPoints("u-alice")).toBe(20);
  });

  it("sin saldo suficiente no se cobra nada", async () => {
    const { order, me } = await setup(TINTO - 1);
    expect(await order("tinto")).toEqual({ ok: false, item: "tinto", error: "funds" });
    expect(await repo.getPoints("u-alice")).toBe(TINTO - 1);
    expect(me().held).toBe("");
  });

  it("un doble clic no cobra dos veces", async () => {
    const { alice, room } = await setup(50);
    alice.send(MSG.cafeOrder, { item: "tinto" });
    alice.send(MSG.cafeOrder, { item: "tinto" });
    await tick(120);
    await room.waitForNextPatch();
    expect(await repo.getPoints("u-alice")).toBe(50 - TINTO);
  });

  it("lo que llevas en la mano se acaba solo", async () => {
    OfficeRoom.heldMs = 600;
    const { order, me, room } = await setup(20);
    await order("torta");
    expect(me().held).toBe("torta");
    await tick(700);
    await room.waitForNextPatch();
    expect(me().held).toBe("");
  });

  it("la carta colombiana se pide igual: una arepa de huevo cobra su precio y queda en la mano", async () => {
    const { order, me } = await setup(30);
    const arepa = cafeItem("arepa-huevo")!;
    expect(await order("arepa-huevo")).toEqual({ ok: true, item: "arepa-huevo", balance: 30 - arepa.price });
    expect(me().held).toBe("arepa-huevo");
    expect(me().heldLeft).toBe(String(usesOf("arepa-huevo")));
    expect(repo.ledger.at(-1)).toMatchObject({ amount: -arepa.price, reason: "PURCHASE", refId: "cafe:arepa-huevo" });
  });

  it("un combo nuevo deja una cosa en cada mano, con sus usos", async () => {
    const { order, me } = await setup(30);
    const onces = cafeItem("onces")!;
    expect(await order("onces")).toEqual({ ok: true, item: "onces", balance: 30 - onces.price });
    expect(me().held).toBe("onces");
    expect(me().heldLeft).toBe(`${usesOf("tinto")},${usesOf("pandebono")}`);
  });

  it("un producto que no está en el menú se ignora", async () => {
    const { order, me } = await setup(20);
    expect(await order("cerveza")).toBeUndefined();
    expect(me().held).toBe("");
    expect(await repo.getPoints("u-alice")).toBe(20);
  });
});
