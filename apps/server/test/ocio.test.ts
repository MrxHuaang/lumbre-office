import type { ColyseusTestServer } from "@colyseus/testing";
import { LEISURE_MSG, POINTS, ROOM_NAME, type LeisureState } from "@hyvento/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, tick, token, type ServerRoom } from "./helpers";

// El tope diario de ocio: el servidor dice cuánto lleva y cuándo se llenó.

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

async function join() {
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  const states: LeisureState[] = [];
  alice.onMessage(LEISURE_MSG.state, (s: LeisureState) => states.push(s));
  await room.waitForNextPatch();
  await tick(80);
  const award = (n: number) => (room as unknown as { awardLeisure(u: string, n: number): Promise<number> }).awardLeisure("u-alice", n);
  return { room, states, award };
}

describe("tope de ocio del día", () => {
  it("al ganar ocio dice cuánto lleva hoy", async () => {
    const { states, award } = await join();
    await award(12);
    await tick(50);
    expect(states.at(-1)).toEqual({ today: 12, cap: POINTS.leisureDailyCap });
  });

  it("al llenarse (o pasarse del tope) avisa 'capped'", async () => {
    const { states, award } = await join();
    await award(POINTS.leisureDailyCap - 2);
    expect(await award(5)).toBe(2);
    await tick(50);
    expect(states.at(-1)).toEqual({ today: POINTS.leisureDailyCap, cap: POINTS.leisureDailyCap, capped: true });
    // Ya lleno, otro intento sigue avisando.
    expect(await award(5)).toBe(0);
    await tick(50);
    expect(states.at(-1)?.capped).toBe(true);
  });
});
