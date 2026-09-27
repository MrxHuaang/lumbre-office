import type { ColyseusTestServer } from "@colyseus/testing";
import { ROOM_NAME } from "@hyvento/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, token } from "./helpers";

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
  repo.welcomeBonus = 1000;
  OfficeRoom.repo = repo;
});

describe("bono de bienvenida", () => {
  it("se da al entrar por primera vez, y una sola vez aunque se vuelva a entrar", async () => {
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    // Bob se queda para que la sala no se cierre cuando Alice sale.
    await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
    await room.waitForNextPatch();
    expect(room.state.players.get(alice.sessionId)!.points).toBe(1000);
    await alice.leave();
    const again = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    await room.waitForNextPatch();
    expect(room.state.players.get(again.sessionId)!.points).toBe(1000);
    expect(repo.ledger.filter((m) => m.userId === "u-alice" && m.refId === "bienvenida")).toHaveLength(1);
    expect(repo.ledger.filter((m) => m.userId === "u-bob" && m.refId === "bienvenida")).toHaveLength(1);
  });
});
