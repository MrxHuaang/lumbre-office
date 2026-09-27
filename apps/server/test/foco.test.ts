import type { ColyseusTestServer } from "@colyseus/testing";
import { FOCUS, MSG, ROOM_NAME, type FocusEvent, type PointsAwarded } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, intoOffice, officeTiles, tick, token, walkToTile, type ServerRoom } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
const WORK_MS = 250;
const BREAK_MS = 500;

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
  OfficeRoom.focusPhaseMs = (_preset, phase) => (phase === "work" ? WORK_MS : BREAK_MS);
});
afterEach(() => {
  OfficeRoom.focusPhaseMs = (preset, phase) => (phase === "work" ? (preset === "50-10" ? 50 : 25) : preset === "50-10" ? 10 : 5) * 60_000;
});

/** Sala con la oficina 4 de Alice y Bob de visita. */
async function setup() {
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  repo.assign("office-4", "u-alice", "Alice");
  await OfficeRoom.reloadOfficesEverywhere();
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
  await room.waitForNextPatch();
  const events: FocusEvent[] = [];
  alice.onMessage(MSG.focusEvent, (e: FocusEvent) => events.push(e));
  const awards: PointsAwarded[] = [];
  alice.onMessage(MSG.pointsAwarded, (a: PointsAwarded) => awards.push(a));
  const me = () => room.state.players.get(alice.sessionId)!;
  return { room, alice, bob, events, awards, me, office: () => room.state.offices.get("office-4")! };
}

const start = async (client: ClientRoom, room: ServerRoom, preset = "25-5") => {
  client.send(MSG.focusStart, { preset });
  await tick(40);
  await room.waitForNextPatch();
};

describe("modo foco", () => {
  it("en su oficina: no molestar, puerta cerrada y placa; al completar da puntos y devuelve todo", async () => {
    const { room, alice, events, awards, me, office } = await setup();
    await intoOffice(alice, room, "office-4");
    alice.send(MSG.officeNote, { note: "Vuelvo a las 3" });
    await tick(40);
    await start(alice, room);
    expect(me().focus).toBe("work");
    expect(me().focusPreset).toBe("25-5");
    expect(me().status).toBe("dnd");
    expect(office().locked).toBe(true);
    expect(office().note).toBe(FOCUS.note);

    await tick(WORK_MS + 60);
    expect(me().focus).toBe("break");
    expect(me().status).toBe("available");
    expect(office().locked).toBe(false);
    expect(office().note).toBe("Vuelvo a las 3");
    expect(events).toEqual([{ kind: "done", points: FOCUS.points, capped: false }]);
    expect(awards.map((a) => [a.amount, a.reason])).toEqual([[FOCUS.points, "PRESENCE"]]);
    expect(await repo.getPoints("u-alice")).toBe(FOCUS.points);

    await tick(BREAK_MS + 60);
    expect(me().focus).toBe("");
    expect(me().focusEndsAt).toBe(0);
    expect(events.at(-1)).toEqual({ kind: "break-over" });
  });

  it("si sale de su oficina se cancela sin puntos (y la puerta vuelve a abrirse)", async () => {
    const { room, alice, events, me, office } = await setup();
    await intoOffice(alice, room, "office-4");
    await start(alice, room);
    expect(office().locked).toBe(true);
    const { outside } = officeTiles("office-4");
    await walkToTile(alice, room, outside.x, outside.y);
    await tick(40);
    expect(me().focus).toBe("");
    expect(me().status).toBe("available");
    expect(office().locked).toBe(false);
    expect(events).toEqual([{ kind: "cancelled", reason: "left" }]);
    await tick(WORK_MS + 60);
    expect(await repo.getPoints("u-alice")).toBe(0);
  });

  it("dejarlo no da puntos, y un estado puesto a mano no se pisa al terminar", async () => {
    const { room, alice, events, me } = await setup();
    await start(alice, room, "50-10");
    expect(me().status).toBe("dnd");
    alice.send(MSG.focusStop);
    await tick(40);
    expect(me().focus).toBe("");
    expect(me().status).toBe("available");
    expect(events).toEqual([{ kind: "cancelled", reason: "stopped" }]);

    await start(alice, room);
    alice.send(MSG.status, { status: "busy" });
    await tick(WORK_MS + 60);
    expect(me().status).toBe("busy");
    expect(await repo.getPoints("u-alice")).toBe(FOCUS.points);
  });

  it("si se va de la cabaña se corta, y hay tope de bloques con puntos por día", async () => {
    const { room, alice, bob, me } = await setup();
    // Fuera de su oficina se puede empezar; moverse no lo corta.
    for (let i = 0; i < FOCUS.dailyCap + 1; i++) {
      await start(alice, room);
      expect(me().focus).toBe("work");
      await tick(WORK_MS + 50);
    }
    expect(await repo.getPoints("u-alice")).toBe(FOCUS.points * FOCUS.dailyCap);

    await start(bob, room);
    expect(room.state.players.get(bob.sessionId)!.focus).toBe("work");
    await bob.leave(true);
    await tick(WORK_MS + 60);
    expect(await repo.getPoints("u-bob")).toBe(0);
  });

  it("no se empieza con un preset que no existe", async () => {
    const { room, alice, me } = await setup();
    await start(alice, room, "90-1");
    expect(me().focus).toBe("");
  });
});
