import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, isBlockedTile, seatStandSpot, zoneAt, type OfficeMap, type Seat } from "@hyvento/map";
import { MSG, POINTS, ROOM_NAME, TINA, type AchievementUnlockedEvent, type ChatEvent } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, tick, token, until, walkToTile, type ServerRoom } from "./helpers";

// La tina caliente y la sauna del lago en la sala: se entra sentándose (asientos del catálogo), adentro la
// charla es privada, cada rato de descanso da puntos de ocio (solo con actividad) y el logro "Relajado", y
// al salir se queda mojado un rato.

const jardin = getWorld().areas.get("jardin") as OfficeMap;
const ts = jardin.tileSize;
const tubSeats = [...jardin.seats.values()].filter((s) => s.type === "hot-tub");
const saunaSeats = [...jardin.seats.values()].filter((s) => s.type === "sauna");
/** La banca del deck (en la zona de la tina, pero no adentro). */
const bench = [...jardin.seats.values()].find((s) => s.type === "bench" && zoneAt(jardin, s.x, s.y)?.id === "tina")!;

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
const TIMINGS = OfficeRoom.tinaTimings;
const AGUA_TIMINGS = OfficeRoom.aguaTimings;

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
  OfficeRoom.tinaTimings = { tickMs: 250, checkMs: 60 };
  OfficeRoom.aguaTimings = { ...AGUA_TIMINGS, wetMs: 400 };
});
afterEach(() => {
  OfficeRoom.tinaTimings = TIMINGS;
  OfficeRoom.aguaTimings = AGUA_TIMINGS;
  OfficeRoom.idleMs = POINTS.idleMs;
});

const me = (client: ClientRoom, room: ServerRoom) => room.state.players.get(client.sessionId)!;

async function join(room: ServerRoom, name: string) {
  const client = await colyseus.connectTo(room, { token: await token(`u-${name.toLowerCase()}`, name) });
  await room.waitForNextPatch();
  const chat: ChatEvent[] = [];
  const unlocked: AchievementUnlockedEvent[] = [];
  client.onMessage(MSG.chatEvent, (m: ChatEvent) => chat.push(m));
  client.onMessage(MSG.achievementUnlocked, (e: AchievementUnlockedEvent) => unlocked.push(e));
  return { client, chat, unlocked };
}

async function newRoom() {
  return (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
}

/** Camina hasta al lado del asiento (donde se para al levantarse) y se sienta. */
async function sitIn(client: ClientRoom, room: ServerRoom, seat: Seat) {
  const spot = seatStandSpot(jardin, seat);
  await walkToTile(client, room, Math.floor(spot.x / ts), Math.floor(spot.y / ts));
  client.send(MSG.move, { x: seat.x, y: seat.y, dir: seat.facing, moving: false, seated: true });
  await room.waitForNextPatch();
  await tick(30);
}

/** Se levanta hacia donde se para quien deja ese asiento. */
async function standUp(client: ClientRoom, room: ServerRoom, seat: Seat) {
  const spot = seatStandSpot(jardin, seat);
  client.send(MSG.move, { x: spot.x, y: spot.y, dir: "down", moving: false, seated: false });
  await room.waitForNextPatch();
  await tick(30);
}

/** Se queda adentro `ms` con actividad (mueve el mouse) y devuelve los puntos que ganó. */
async function restWithActivity(client: ClientRoom, userId: string, ms: number) {
  const before = await repo.getPoints(userId);
  const end = Date.now() + ms;
  while (Date.now() < end) {
    client.send(MSG.activity);
    await tick(40);
  }
  return (await repo.getPoints(userId)) - before;
}

describe("la tina y la sauna", () => {
  it("la tina tiene cuatro asientos y la sauna dos, todos en la zona aislada del deck", async () => {
    expect(tubSeats).toHaveLength(4);
    expect(saunaSeats).toHaveLength(2);
    const room = await newRoom();
    const { client } = await join(room, "Alice");
    for (const seat of [...tubSeats, ...saunaSeats]) {
      await sitIn(client, room, seat);
      const p = me(client, room);
      expect(p.seated, `${seat.type} ${seat.tileX},${seat.tileY}`).toBe(true);
      expect(p.x).toBe(seat.x);
      expect(p.y).toBe(seat.y);
      expect(p.dir).toBe(seat.facing);
      expect(p.zoneId).toBe("tina");
      await standUp(client, room, seat);
      expect(me(client, room).seated).toBe(false);
      expect(isBlockedTile(jardin, Math.floor(me(client, room).x / ts), Math.floor(me(client, room).y / ts))).toBe(false);
    }
  });

  it("un asiento ocupado no se le quita a nadie", async () => {
    const room = await newRoom();
    const alice = await join(room, "Alice");
    const bob = await join(room, "Bob");
    const seat = tubSeats[0]!;
    await sitIn(alice.client, room, seat);
    await sitIn(bob.client, room, seat);
    expect(me(alice.client, room).seated).toBe(true);
    expect(me(bob.client, room).seated).toBe(false);
  });

  it("adentro, con actividad, cada rato da puntos de ocio y el logro Relajado", async () => {
    const room = await newRoom();
    const alice = await join(room, "Alice");
    await sitIn(alice.client, room, tubSeats[1]!);
    const won = await restWithActivity(alice.client, "u-alice", OfficeRoom.tinaTimings.tickMs * 3 + 200);
    expect(won).toBeGreaterThanOrEqual(TINA.points);
    expect(repo.ledger.filter((m) => m.userId === "u-alice" && m.reason === "LEISURE").length).toBeGreaterThan(0);
    await until(() => alice.unlocked.some((e) => e.achievementId === "relajado"), "el logro Relajado");
  });

  it("en la sauna también", async () => {
    const room = await newRoom();
    const alice = await join(room, "Alice");
    await sitIn(alice.client, room, saunaSeats[0]!);
    expect(await restWithActivity(alice.client, "u-alice", OfficeRoom.tinaTimings.tickMs * 3 + 200)).toBeGreaterThanOrEqual(TINA.points);
  });

  it("sin actividad reciente no hay puntos", async () => {
    OfficeRoom.idleMs = 50;
    const room = await newRoom();
    const alice = await join(room, "Alice");
    await sitIn(alice.client, room, tubSeats[0]!);
    await tick(120);
    const before = await repo.getPoints("u-alice");
    await tick(OfficeRoom.tinaTimings.tickMs * 3);
    expect(await repo.getPoints("u-alice")).toBe(before);
    expect(alice.unlocked.some((e) => e.achievementId === "relajado")).toBe(false);
  });

  it("estando Ausente tampoco", async () => {
    const room = await newRoom();
    const alice = await join(room, "Alice");
    await sitIn(alice.client, room, tubSeats[2]!);
    alice.client.send(MSG.status, { status: "away" });
    await room.waitForNextPatch();
    expect(await restWithActivity(alice.client, "u-alice", OfficeRoom.tinaTimings.tickMs * 3)).toBe(0);
  });

  it("sentado en otra parte del jardín no da puntos del descanso", async () => {
    const room = await newRoom();
    const alice = await join(room, "Alice");
    await sitIn(alice.client, room, bench);
    expect(me(alice.client, room).seated).toBe(true);
    expect(await restWithActivity(alice.client, "u-alice", OfficeRoom.tinaTimings.tickMs * 3)).toBe(0);
  });

  it("al salir de la tina (o de la sauna) se queda mojado un rato", async () => {
    const room = await newRoom();
    const alice = await join(room, "Alice");
    const seat = tubSeats[3]!;
    await sitIn(alice.client, room, seat);
    expect(me(alice.client, room).wet).toBe(false);
    await standUp(alice.client, room, seat);
    expect(me(alice.client, room).seated).toBe(false);
    expect(me(alice.client, room).wet).toBe(true);
    await tick(OfficeRoom.aguaTimings.wetMs + 150);
    expect(me(alice.client, room).wet).toBe(false);
    await sitIn(alice.client, room, saunaSeats[1]!);
    await standUp(alice.client, room, saunaSeats[1]!);
    expect(me(alice.client, room).wet).toBe(true);
  });

  it("pararse de la banca no moja a nadie", async () => {
    const room = await newRoom();
    const alice = await join(room, "Alice");
    await sitIn(alice.client, room, bench);
    await standUp(alice.client, room, bench);
    expect(me(alice.client, room).wet).toBe(false);
  });

  it("la charla del deck es privada: se oyen los de adentro, no los de afuera aunque estén cerca", async () => {
    const room = await newRoom();
    const alice = await join(room, "Alice");
    const bob = await join(room, "Bob");
    const carol = await join(room, "Carol");
    const north = tubSeats.find((s) => s.facing === "down")!;
    await sitIn(alice.client, room, north);
    await sitIn(carol.client, room, saunaSeats[0]!);
    // Bob, en el pasto al norte del deck, a tres tiles de Alice (dentro del radio de proximidad).
    await walkToTile(bob.client, room, north.tileX, north.tileY - 3);
    const b = me(bob.client, room);
    expect(b.zoneId).toBe("jardin");
    expect(Math.hypot(b.x - north.x, b.y - north.y)).toBeLessThan(5 * ts);

    alice.client.send(MSG.chatSend, { text: "qué rico este vapor", scope: "proximity" });
    bob.client.send(MSG.chatSend, { text: "¿hay campo?", scope: "proximity" });
    await room.waitForNextPatch();
    await tick(80);
    expect(carol.chat.map((m) => m.text)).toContain("qué rico este vapor");
    expect(bob.chat.map((m) => m.text)).not.toContain("qué rico este vapor");
    expect(alice.chat.map((m) => m.text)).not.toContain("¿hay campo?");
  });
});
