import type { ColyseusTestServer } from "@colyseus/testing";
import { BAG, BAG_MSG, CELULAR_ITEM, ROOM_NAME, type BagNotice, type BagView } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, tick, token, type ServerRoom } from "./helpers";

// El celular de tapa (VIR-125): lo tiene todo el mundo porque el chat vive en él.

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
  OfficeRoom.celularAlEntrar = true;
});
afterEach(() => {
  OfficeRoom.celularAlEntrar = false;
});

async function entrar() {
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  const views: BagView[] = [];
  const notices: BagNotice[] = [];
  alice.onMessage(BAG_MSG.state, (v: BagView) => views.push(v));
  alice.onMessage(BAG_MSG.notice, (n: BagNotice) => notices.push(n));
  await room.waitForNextPatch();
  await tick(40);
  return { room, alice, views, notices };
}

const me = (client: ClientRoom, room: ServerRoom) => room.state.players.get(client.sessionId)!;

describe("celular", () => {
  it("al entrar sin celular se da uno, en la última casilla, y la mano sigue con lo de la primera", async () => {
    repo.give("u-alice", "obj:whisky", 2);
    const { room, alice, views } = await entrar();
    const slots = views.at(-1)!.slots;
    expect(slots[BAG.slots - 1]).toEqual({ itemId: CELULAR_ITEM, quantity: 1 });
    expect(slots[0]).toEqual({ itemId: "obj:whisky", quantity: 2 });
    expect(me(alice, room).held).toBe("whisky");
    expect(repo.held("u-alice", CELULAR_ITEM)).toBe(1);
  });

  it("quien ya tiene uno no recibe otro", async () => {
    repo.give("u-alice", CELULAR_ITEM);
    const { views } = await entrar();
    expect(views.at(-1)!.slots.filter((s) => s?.itemId === CELULAR_ITEM)).toHaveLength(1);
    expect(repo.held("u-alice", CELULAR_ITEM)).toBe(1);
  });

  it("no se puede tirar", async () => {
    const { alice, notices } = await entrar();
    alice.send(BAG_MSG.drop, { itemId: CELULAR_ITEM, quantity: 1 });
    await tick(40);
    expect(notices.at(-1)).toEqual({ code: "keep" });
    expect(repo.held("u-alice", CELULAR_ITEM)).toBe(1);
  });
});
