import type { ColyseusTestServer } from "@colyseus/testing";
import { findPath, getWorld, isBlockedTile, pointsOfType, spawnPoint, zoneAt } from "@hyvento/map";
import {
  ESCENARIO,
  ESCENARIO_MSG,
  MSG,
  PODCAST,
  PODCAST_MSG,
  ROOM_NAME,
  type ApplauseEvent,
  type ChatEvent,
  type EmoteEvent,
  type EscenarioNotice,
  type PodcastNotice,
} from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { Podcast, type Inside } from "../src/rooms/podcast";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import { PodcastState, type OfficeState } from "../src/state";
import { bootServer, c, tick, token, walkToTile, type ServerRoom } from "./helpers";

// El escenario del jardín (la tarima para dos, la fila de turnos, la palabra y los aplausos) y la cabina de
// grabación (grabar solo con el permiso de todos los de adentro; la puerta cerrada mientras tanto).

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
const BOOTH_IN = [at(31, 56), at(33, 57), at(32, 57)];
const BOOTH_DOOR = at(32, 58);

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
  podcast: PodcastNotice[];
  applause: ApplauseEvent[];
  emotes: EmoteEvent[];
  chat: ChatEvent[];
}

async function join(name: string): Promise<Person> {
  const client = await colyseus.connectTo(room, { token: await token(`u-${name.toLowerCase()}`, name) });
  await room.waitForNextPatch();
  const p: Person = { client, notices: [], podcast: [], applause: [], emotes: [], chat: [] };
  client.onMessage(ESCENARIO_MSG.notice, (n: EscenarioNotice) => p.notices.push(n));
  client.onMessage(PODCAST_MSG.notice, (n: PodcastNotice) => p.podcast.push(n));
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
  it("la tarima, las gradas y la cabina son zonas aisladas y se llega caminando desde el portón", () => {
    const start = { x: spawnPoint(jardin).tileX, y: spawnPoint(jardin).tileY };
    expect(zoneOf(DECK_A)).toBe(ESCENARIO.stageZone);
    expect(zoneOf(SEAT_AISLE)).toBe(ESCENARIO.seatsZone);
    expect(zoneOf(BOOTH_IN[0]!)).toBe(PODCAST.zone);
    for (const id of [ESCENARIO.stageZone, ESCENARIO.seatsZone, PODCAST.zone]) expect(jardin.zones.find((z) => z.id === id)?.isolated).toBe(true);
    for (const t of [DECK_A, DECK_B, DECK_C, SEAT_AISLE, BACK_ROW, ...BOOTH_IN, BOOTH_DOOR]) {
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

describe("cabina de grabación (en la sala)", () => {
  it("se graba solo si todos aceptan, y mientras tanto la puerta no deja entrar", async () => {
    const [a, b, cc] = [await join("Ana"), await join("Beto"), await join("Caro")];
    await walk(a, BOOTH_IN[0]!);
    await walk(b, BOOTH_IN[1]!);
    expect(me(a).zoneId).toBe(PODCAST.zone);
    await send(a, PODCAST_MSG.start);
    expect(room.state.podcast.phase).toBe("asking");
    expect(room.state.podcast.host).toBe(me(a).userId);
    expect(room.state.podcast.consents.get(me(a).userId)).toBe(true);
    expect(room.state.podcast.consents.get(me(b).userId)).toBe(false);
    // Pidiendo permiso nadie entra.
    await walk(cc, BOOTH_DOOR);
    await walk(cc, BOOTH_IN[2]!);
    expect(me(cc).zoneId).not.toBe(PODCAST.zone);
    await send(b, PODCAST_MSG.consent, { accept: true });
    expect(room.state.podcast.phase).toBe("recording");
    expect(a.podcast.at(-1)?.code).toBe("started");
    await walk(cc, BOOTH_IN[2]!);
    expect(me(cc).zoneId).not.toBe(PODCAST.zone);
    // Beto retira su permiso: se deja de grabar y se abre la puerta.
    await send(b, PODCAST_MSG.stop);
    expect(room.state.podcast.phase).toBe("idle");
    expect(a.podcast.at(-1)).toEqual({ code: "stopped", name: "Beto" });
    await walk(cc, BOOTH_IN[2]!);
    expect(me(cc).zoneId).toBe(PODCAST.zone);
  });

  it("si alguien dice que no, no se graba; desde afuera no se puede pedir; caben tres", async () => {
    const [a, b, cc, d] = [await join("Ana"), await join("Beto"), await join("Caro"), await join("Dani")];
    await walk(d, BOOTH_DOOR);
    await send(d, PODCAST_MSG.start);
    expect(d.podcast.at(-1)?.code).toBe("outside");
    for (const [p, t] of [
      [a, BOOTH_IN[0]!],
      [b, BOOTH_IN[1]!],
      [cc, BOOTH_IN[2]!],
    ] as const)
      await walk(p, t);
    await walk(d, at(31, 57));
    expect(me(d).zoneId).not.toBe(PODCAST.zone);
    await send(a, PODCAST_MSG.start);
    await send(b, PODCAST_MSG.consent, { accept: true });
    await send(cc, PODCAST_MSG.consent, { accept: false });
    expect(room.state.podcast.phase).toBe("idle");
    expect(b.podcast.at(-1)).toEqual({ code: "declined", name: "Caro" });
  });

  it("si sale quien graba, se detiene", async () => {
    const [a, b] = [await join("Ana"), await join("Beto")];
    await walk(a, BOOTH_IN[0]!);
    await walk(b, BOOTH_IN[1]!);
    await send(a, PODCAST_MSG.start);
    await send(b, PODCAST_MSG.consent, { accept: true });
    expect(room.state.podcast.phase).toBe("recording");
    await walk(a, OUTSIDE);
    await tick(600);
    expect(room.state.podcast.phase).toBe("idle");
    expect(b.podcast.at(-1)).toEqual({ code: "hostLeft", name: "Ana" });
  });
});

describe("cabina de grabación (reglas)", () => {
  const ana: Inside = { sessionId: "s-a", userId: "u-a", name: "Ana" };
  const beto: Inside = { sessionId: "s-b", userId: "u-b", name: "Beto" };
  const caro: Inside = { sessionId: "s-c", userId: "u-c", name: "Caro" };

  it("sola en la cabina graba de una (su pedido ya es su permiso)", () => {
    const state = new PodcastState();
    const p = new Podcast(state);
    expect(p.start(ana, [ana], 1000)).toEqual([{ to: ["s-a"], notice: { code: "started" } }]);
    expect(state.phase).toBe("recording");
    expect(state.startedAt).toBe(1000);
  });

  it("si entra alguien nuevo (por donde sea) se detiene", () => {
    const state = new PodcastState();
    const p = new Podcast(state);
    p.start(ana, [ana, beto], 0);
    p.consent(beto, true, [ana, beto], 10);
    expect(state.phase).toBe("recording");
    expect(p.sync([ana, beto, caro], 20)).toEqual([{ to: ["s-a", "s-b", "s-c"], notice: { code: "joined", name: "Caro" } }]);
    expect(state.phase).toBe("idle");
  });

  it("sin respuesta de todos se desiste, y una grabación se corta sola a la hora", () => {
    const state = new PodcastState();
    const p = new Podcast(state);
    p.start(ana, [ana, beto], 0);
    // Mientras se pide permiso no se puede volver a pedir.
    expect(p.start(beto, [ana, beto], 1)[0]?.notice.code).toBe("busy");
    expect(p.sync([ana, beto], PODCAST.askTimeoutMs - 1)).toEqual([]);
    expect(p.sync([ana, beto], PODCAST.askTimeoutMs)[0]?.notice.code).toBe("timeout");
    expect(state.phase).toBe("idle");
    expect(p.start(ana, [ana, beto], PODCAST.askTimeoutMs + 1)).toEqual([]);
    p.consent(beto, true, [ana, beto], PODCAST.askTimeoutMs + 2);
    expect(state.phase).toBe("recording");
    expect(p.sync([ana, beto], PODCAST.askTimeoutMs + 2 + PODCAST.maxRecordMs)[0]?.notice.code).toBe("tooLong");
  });

  it("hay una pausa entre dos pedidos de la misma persona", () => {
    const p = new Podcast(new PodcastState());
    p.start(ana, [ana, beto], 0);
    p.consent(beto, false, [ana, beto], 10);
    expect(p.start(ana, [ana, beto], 20)[0]?.notice.code).toBe("wait");
    expect(p.start(ana, [ana, beto], PODCAST.askCooldownMs)).toEqual([]);
  });

  it("quien sale deja de contar; si queda solo quien graba, sigue", () => {
    const state = new PodcastState();
    const p = new Podcast(state);
    p.start(ana, [ana, beto], 0);
    p.consent(beto, true, [ana, beto], 1);
    expect(p.sync([ana], 2)).toEqual([]);
    expect(state.phase).toBe("recording");
    expect(state.consents.has("u-b")).toBe(false);
    // Si Beto vuelve a entrar, es alguien nuevo.
    expect(p.sync([ana, beto], 3)[0]?.notice.code).toBe("joined");
  });
});
