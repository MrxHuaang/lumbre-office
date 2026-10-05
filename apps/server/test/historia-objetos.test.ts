// Los objetos de historia (VIR-150): no se tiran ni se intercambian. El catálogo real todavía no trae
// ninguno, así que la prueba registra uno de mentiras en BAG_OBJECTS (y lo quita al final).
import type { ColyseusTestServer } from "@colyseus/testing";
import { BAG_MSG, BAG_OBJECTS, MSG, ROOM_NAME, isStoryItem, type BagNotice, type TradeProblem, type TradeView } from "@hyvento/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, tick, token, until, type ServerRoom } from "./helpers";

const LLAVE = "obj:llave-prueba";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;

beforeAll(async () => {
  BAG_OBJECTS["llave-prueba"] = { name: "Llave de prueba", kind: "objeto", story: true };
  colyseus = await bootServer(new MemoryRepository());
});
afterAll(async () => {
  delete BAG_OBJECTS["llave-prueba"];
  await colyseus.shutdown();
});
beforeEach(async () => {
  await colyseus.cleanup();
  repo = new MemoryRepository();
  OfficeRoom.repo = repo;
});

describe("objetos de historia", () => {
  it("se marcan como de historia", () => {
    expect(isStoryItem(LLAVE)).toBe(true);
    expect(isStoryItem("obj:tinto")).toBe(false);
  });

  it("no se tiran: llega el aviso y siguen en la mochila", async () => {
    repo.give("u-alice", LLAVE, 1);
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    const notices: BagNotice[] = [];
    alice.onMessage(BAG_MSG.state, () => {});
    alice.onMessage(BAG_MSG.notice, (n: BagNotice) => notices.push(n));
    await room.waitForNextPatch();
    await tick(40);
    alice.send(BAG_MSG.drop, { itemId: LLAVE, quantity: 1 });
    await until(() => notices.length, "el aviso");
    expect(notices.at(-1)).toEqual({ code: "story" });
    expect(repo.held("u-alice", LLAVE)).toBe(1);
  });

  it("no se ponen en un intercambio", async () => {
    repo.give("u-alice", LLAVE, 1);
    repo.give("u-bob", "sofa", 1);
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
    const problems: TradeProblem[] = [];
    const views: TradeView[] = [];
    let invite: string | undefined;
    alice.onMessage(MSG.tradeProblem, (p: TradeProblem) => problems.push(p));
    alice.onMessage(MSG.tradeUpdate, (v: TradeView) => views.push(v));
    bob.onMessage(MSG.tradeInvite, (i: { requestId: string }) => (invite = i.requestId));
    bob.onMessage(MSG.tradeUpdate, () => {});
    await room.waitForNextPatch();
    alice.send(MSG.tradeRequest, { sessionId: bob.sessionId });
    await until(() => invite, "la invitación");
    bob.send(MSG.tradeRespond, { requestId: invite, accept: true });
    await until(() => views.length, "el intercambio abierto");
    alice.send(MSG.tradeOffer, { points: 0, items: [{ itemId: LLAVE, quantity: 1 }] });
    await until(() => problems.length, "el rechazo");
    expect(problems.at(-1)).toEqual({ error: "story" });
    expect(views.at(-1)?.you.items).toEqual([]);
  });
});
