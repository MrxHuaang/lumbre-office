import type { ColyseusTestServer } from "@colyseus/testing";
import { findPath, getWorld, isBlockedTile, pointsOfType, spawnPoint, zoneAt } from "@hyvento/map";
import {
  ESCENARIO,
  ESCENARIO_MSG,
  MSG,
  ROOM_NAME,
  type ApplauseEvent,
  type ChatEvent,
  type EmoteEvent,
  type EscenarioNotice,
} from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, c, tick, token, walkToTile, type ServerRoom } from "./helpers";

// El escenario del jardín: la tarima para dos, la fila de turnos, la palabra y los aplausos. El estudio de
// grabación está en podcast.test.ts.

const jardin = getWorld().areas.get("jardin")!;
const M = jardin.def.playable!.x;
/** Tile del nivel desde coordenadas de la zona jugable. */
const at = (x: number, y: number) => ({ x: x + M, y: y + M });
const zoneOf = (t: { x: number; y: number }) => zoneAt(jardin, c(t.x), c(t.y))?.id;
const stagePoint = pointsOfType(jardin, ESCENARIO.stagePoint)[0]!;
const DECK_A = at(16, 57);
const DECK_B = at(16, 61);
const DECK_C = at(15, 59);
const SEAT_AISLE = at(19, 59);
const BACK_ROW = at(26, 59);
const OUTSIDE = at(33, 61);

let colyseus: ColyseusTestServer;
let room: ServerRoom;

beforeAll(async () => {
  colyseus = await bootServer(new MemoryRepository());
});
afterAll(async () => {
  await colyseus.shutdown();
});
beforeEach(async () => {
  await colyseus.cleanup();
  OfficeRoom.repo = new MemoryRepository();
  room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
});

interface Person {
  client: ClientRoom;
  notices: EscenarioNotice[];
  applause: ApplauseEvent[];
  emotes: EmoteEvent[];
  chat: ChatEvent[];
}

async function join(name: string): Promise<Person> {
  const client = await colyseus.connectTo(room, { token: await token(`u-${name.toLowerCase()}`, name) });
  await room.waitForNextPatch();
  const p: Person = { client, notices: [], applause: [], emotes: [], chat: [] };
  client.onMessage(ESCENARIO_MSG.notice, (n: EscenarioNotice) => p.notices.push(n));
  client.onMessage(ESCENARIO_MSG.applause, (e: ApplauseEvent) => p.applause.push(e));
  client.onMessage(MSG.emoteEvent, (e: EmoteEvent) => p.emotes.push(e));
  client.onMessage(MSG.chatEvent, (e: ChatEvent) => p.chat.push(e));
  return p;
}

const me = (p: Person) => room.state.players.get(p.client.sessionId)!;
const walk = (p: Person, t: { x: number; y: number }) => walkToTile(p.client, room, t.x, t.y);
async function send(p: Person, type: string, raw?: unknown, wait = 60) {
  p.client.send(type, raw);
  await tick(wait);
  await room.waitForNextPatch();
}

describe("escenario (el mapa)", () => {
  it("la tarima y las gradas son zonas aisladas y se llega caminando desde el portón", () => {
    const start = { x: spawnPoint(jardin).tileX, y: spawnPoint(jardin).tileY };
    expect(zoneOf(DECK_A)).toBe(ESCENARIO.stageZone);
    expect(zoneOf(SEAT_AISLE)).toBe(ESCENARIO.seatsZone);
    for (const id of [ESCENARIO.stageZone, ESCENARIO.seatsZone]) expect(jardin.zones.find((z) => z.id === id)?.isolated).toBe(true);
    for (const t of [DECK_A, DECK_B, DECK_C, SEAT_AISLE, BACK_ROW]) {
      expect(isBlockedTile(jardin, t.x, t.y), `${t.x},${t.y}`).toBe(false);
      expect(findPath(jardin, start, t), `${t.x},${t.y}`).not.toBeNull();
    }
    expect(zoneOf({ x: stagePoint.tileX, y: stagePoint.tileY })).toBe(ESCENARIO.seatsZone);
  });

  it("las gradas miran a la tarima y cada asiento está en el anfiteatro", () => {
    const seats = [...jardin.seats.values()].filter((s) => s.type.startsWith("gradas-"));
    expect(seats.length).toBeGreaterThanOrEqual(20);
    for (const s of seats) {
      expect(zoneOf({ x: s.tileX, y: s.tileY })).toBe(ESCENARIO.seatsZone);
      // Hacia el oeste (la tarima) o, en las puntas del semicírculo, hacia el centro.
      expect(["left", "up", "down"]).toContain(s.facing);
      if (s.facing === "left") expect(s.tileX).toBeGreaterThan(DECK_A.x);
    }
  });
});

describe("escenario (en la sala)", () => {
  it("a la tarima suben dos como mucho, caminando o con la escalerita", async () => {
    const [a, b, cc] = [await join("Ana"), await join("Beto"), await join("Caro")];
    await walk(a, DECK_A);
    await walk(b, DECK_B);
    expect(me(a).zoneId).toBe(ESCENARIO.stageZone);
    expect(me(b).zoneId).toBe(ESCENARIO.stageZone);
    await walk(cc, SEAT_AISLE);
    await walk(cc, DECK_C);
    expect(me(cc).zoneId).not.toBe(ESCENARIO.stageZone);
    // La escalerita tampoco deja subir a un tercero.
    await walk(cc, { x: stagePoint.tileX, y: stagePoint.tileY });
    await send(cc, ESCENARIO_MSG.stage, { on: true });
    expect(cc.notices.at(-1)?.code).toBe("full");
    // Ana baja por la escalerita (queda al pie) y ahora sí sube Caro.
    await send(a, ESCENARIO_MSG.stage, { on: false });
    expect(me(a).zoneId).toBe(ESCENARIO.seatsZone);
    await send(cc, ESCENARIO_MSG.stage, { on: true });
    expect(me(cc).zoneId).toBe(ESCENARIO.stageZone);
    expect(me(cc).dir).toBe("right");
  });

  it("la escalerita solo sirve de cerca y sin estar sentado", async () => {
    const a = await join("Ana");
    await walk(a, BACK_ROW);
    await send(a, ESCENARIO_MSG.stage, { on: true });
    expect(a.notices.at(-1)?.code).toBe("far");
    await send(a, ESCENARIO_MSG.stage, { on: false });
    expect(a.notices.at(-1)?.code).toBe("notStage");
  });

  it("las manos hacen fila y quien está en la tarima da la palabra (a quien se va se le quita)", async () => {
    const [a, b, cc] = [await join("Ana"), await join("Beto"), await join("Caro")];
    await walk(a, DECK_A);
    await walk(b, SEAT_AISLE);
    await walk(cc, BACK_ROW);
    await send(b, ESCENARIO_MSG.hand, { up: true });
    await send(cc, ESCENARIO_MSG.hand, { up: true });
    expect(room.state.stage.hands.map((h) => h.name)).toEqual(["Beto", "Caro"]);
    // En la tarima no se levanta la mano, y solo la tarima da la palabra.
    await send(a, ESCENARIO_MSG.hand, { up: true });
    expect(a.notices.at(-1)?.code).toBe("notSeats");
    await send(cc, ESCENARIO_MSG.floor, { userId: me(b).userId });
    expect(cc.notices.at(-1)?.code).toBe("notSpeaker");
    await send(a, ESCENARIO_MSG.floor, { userId: me(b).userId });
    expect(room.state.stage.floor).toBe(me(b).userId);
    expect(room.state.stage.hands.map((h) => h.name)).toEqual(["Caro"]);
    // Caro baja la mano; Beto se va del anfiteatro y pierde la palabra.
    await send(cc, ESCENARIO_MSG.hand, { up: false });
    expect(room.state.stage.hands.length).toBe(0);
    await walk(b, OUTSIDE);
    await tick(600);
    expect(room.state.stage.floor).toBe("");
  });

  it("aplaudir se ve en todo el jardín, cuenta cuántos aplauden y solo vale en el anfiteatro", async () => {
    const [a, b, d] = [await join("Ana"), await join("Beto"), await join("Dani")];
    await walk(a, SEAT_AISLE);
    await walk(b, BACK_ROW);
    await send(a, ESCENARIO_MSG.clap);
    await send(b, ESCENARIO_MSG.clap);
    expect(d.applause.map((e) => e.crowd)).toEqual([1, 2]);
    expect(d.emotes.filter((e) => e.emote === "clap").length).toBe(2);
    // Con pausa entre aplausos, y desde afuera no.
    await send(a, ESCENARIO_MSG.clap);
    await send(d, ESCENARIO_MSG.clap);
    expect(d.applause.length).toBe(2);
  });

  it("el chat del anfiteatro llega a todo el anfiteatro y no afuera", async () => {
    const [a, b, d] = [await join("Ana"), await join("Beto"), await join("Dani")];
    await walk(a, DECK_A);
    await walk(b, BACK_ROW);
    await walk(d, OUTSIDE);
    await send(a, MSG.chatSend, { text: "¿Me oyen atrás?", scope: "proximity" });
    expect(b.chat.map((m) => m.text)).toContain("¿Me oyen atrás?");
    expect(d.chat.map((m) => m.text)).not.toContain("¿Me oyen atrás?");
  });
});
