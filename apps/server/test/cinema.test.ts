import type { ColyseusTestServer } from "@colyseus/testing";
import { findPath, getWorld, isBlockedTile, pointsOfType, zoneAt } from "@hyvento/map";
import { CINEMA, CINEMA_BILLBOARD, CLUB_VIDEO, MSG, ROOM_NAME, parseYoutubeId, type CinemaResult } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { Cinema, type CinemaWho } from "../src/rooms/cinema";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import { CinemaState, type OfficeState } from "../src/state";
import { bootServer, c, goToArea, tick, token, walkToTile, type ServerRoom } from "./helpers";

const sotano = () => getWorld().areas.get("sotano")!;
const vid = (n: number) => `cine${String(n).padStart(7, "0")}`;

/** La cabina (el punto junto al proyector) y un tile libre de la sala lejos de ella. */
function spots() {
  const map = sotano();
  const booth = pointsOfType(map, CINEMA.boothPoint)[0]!;
  const zone = map.zones.find((z) => z.id === CINEMA.zone)!;
  // El pasillo de la izquierda de las butacas, a media sala.
  const aisle = { x: 3, y: Math.floor((zone.y + zone.height / 2) / map.tileSize) };
  return { map, booth: { x: booth.tileX, y: booth.tileY }, aisle, zone };
}

const who = (tx: number, ty: number, userId = "u-a", area = "sotano"): CinemaWho => ({ userId, area, x: c(tx), y: c(ty) });

describe("cine (la sala)", () => {
  it("la sala tiene audio aislado, la cabina está adentro y se llega a ella y a las butacas", () => {
    const { map, booth, aisle, zone } = spots();
    expect(zone.isolated).toBe(true);
    expect(isBlockedTile(map, booth.x, booth.y)).toBe(false);
    expect(zoneAt(map, c(booth.x), c(booth.y))?.id).toBe(CINEMA.zone);
    expect(zoneAt(map, c(aisle.x), c(aisle.y))?.id).toBe(CINEMA.zone);
    const door = { x: 12, y: 20 };
    expect(findPath(map, door, booth)).not.toBeNull();
    expect(findPath(map, door, aisle)).not.toBeNull();
  });

  it("la pantalla va en la pared oeste de la sala y todas las butacas la miran", () => {
    const { map, zone } = spots();
    const ts = map.tileSize;
    const screen = map.def.features.find((f) => f.kind === "cinema-screen")!;
    expect(screen.edge).toBe("v");
    expect(screen.x * ts).toBe(zone.x);
    const seats = map.furniture.filter((f) => f.type.startsWith("cinema-seat"));
    expect(seats.length).toBeGreaterThan(10);
    for (const s of seats) {
      // Sentado se mira hacia donde mira el asiento: "left" es hacia -x, la pared de la pantalla.
      expect(map.seats.get(s.y * map.width + s.x)?.facing, `${s.x},${s.y}`).toBe("left");
      expect(zoneAt(map, (s.x + 0.5) * ts, (s.y + 0.5) * ts)?.id).toBe(CINEMA.zone);
    }
  });

  it("la cartelera trae ids de YouTube válidos y sin repetir", () => {
    const ids = CINEMA_BILLBOARD.map((m) => m.videoId);
    for (const id of ids) expect(parseYoutubeId(id)).toBe(id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("cine (reglas)", () => {
  const rules = () => {
    const state = new CinemaState();
    return { state, cinema: new Cinema(state), ...spots() };
  };

  it("se programa: la primera arranca ya, las demás esperan y pasan solas al terminar", () => {
    const { state, cinema } = rules();
    const v = cinema.videos;
    expect(v.enqueue({ videoId: vid(1), title: "Uno" }, "Ana", 1000)).toEqual({ ok: true });
    expect(state.video).toMatchObject({ videoId: vid(1), by: "Ana" });
    expect(state.startedAt).toBe(1000);
    v.enqueue({ videoId: vid(2), title: "Dos" }, "Beto", 1100);
    expect(v.enqueue({ videoId: vid(2), title: "Dos" }, "Beto", 1200)).toEqual({ ok: false, error: "queued" });
    v.duration(state.video.id, 60_000);
    cinema.tick(1000 + 60_000 + CLUB_VIDEO.endGraceMs - 1);
    expect(state.video.videoId).toBe(vid(1));
    cinema.tick(1000 + 60_000 + CLUB_VIDEO.endGraceMs);
    expect(state.video).toMatchObject({ videoId: vid(2), by: "Beto" });
    expect(state.history.map((h) => h.videoId)).toEqual([vid(1)]);
    // Saltar la última deja la sala sin función.
    v.skip(state.video.id, 70_000);
    expect(state.video.videoId).toBe("");
    expect(state.startedAt).toBe(0);
  });

  it("se pausa y se sigue solo desde la cabina, en su punto; en pausa no avanza sola", () => {
    const { state, cinema, map, booth, aisle } = rules();
    cinema.videos.enqueue({ videoId: vid(1), title: "Uno" }, "Ana", 1000);
    cinema.videos.duration(state.video.id, 10_000);
    expect(cinema.control(map, who(aisle.x, aisle.y), "pause", 2000)).toEqual({ ok: false, error: "booth" });
    expect(cinema.control(map, who(20, 19), "pause", 2000)).toEqual({ ok: false, error: "far" });
    expect(cinema.control(map, who(booth.x, booth.y), "pause", 4000)).toEqual({ ok: true });
    expect(state).toMatchObject({ paused: true, pausedAt: 3000 });
    // Con una pausa corta entre dos cambios de la misma persona.
    expect(cinema.control(map, who(booth.x, booth.y), "resume", 4100)).toEqual({ ok: false, error: "busy" });
    cinema.tick(60_000);
    expect(state.video.videoId).toBe(vid(1));
    expect(cinema.control(map, who(booth.x, booth.y, "u-b"), "resume", 60_000)).toEqual({ ok: true });
    expect(state).toMatchObject({ paused: false, startedAt: 57_000, pausedAt: 0 });
  });

  it("afuera de la sala (aunque sea en el sótano) no se está en el cine", () => {
    const { cinema, map, aisle } = rules();
    expect(cinema.inCinema(map, who(aisle.x, aisle.y))).toBe(true);
    expect(cinema.inCinema(map, who(20, 19))).toBe(false);
    expect(cinema.inCinema(map, who(aisle.x, aisle.y, "u-a", "planta-baja"))).toBe(false);
  });
});

// ---------- En la sala: todos ven lo mismo ----------

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await bootServer(new MemoryRepository());
});
afterAll(async () => {
  await colyseus.shutdown();
});
beforeEach(async () => {
  await colyseus.cleanup();
  OfficeRoom.repo = new MemoryRepository();
  OfficeRoom.youtubeLookup = async (id) => (id === "bloqueado1x" ? { ok: false, error: "not-embeddable" } : { ok: true, title: `Película ${id}` });
});

async function setup() {
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
  await room.waitForNextPatch();
  const errors: CinemaResult[] = [];
  bob.onMessage(MSG.cinemaResult, (r: CinemaResult) => errors.push(r));
  alice.onMessage(MSG.cinemaResult, () => undefined);
  const send = async (client: ClientRoom, msg: unknown) => {
    client.send(MSG.cinemaQueue, msg);
    await tick(60);
    await room.waitForNextPatch();
  };
  return { room, alice, bob, errors, send };
}

describe("cine (en la sala)", () => {
  it("dentro del cine se programa una película con su título; afuera, no; y la cola es aparte de la del club", async () => {
    const { room, bob, errors, send } = await setup();
    const { aisle } = spots();
    await send(bob, { action: "add", url: "https://youtu.be/YE7VzlLtp-4" });
    expect(errors.at(-1)).toEqual({ ok: false, error: "far" });
    await goToArea(bob, room, "sotano");
    await send(bob, { action: "add", url: "YE7VzlLtp-4" });
    expect(errors.at(-1)).toEqual({ ok: false, error: "far" });
    await walkToTile(bob, room, aisle.x, aisle.y);
    await send(bob, { action: "add", url: "https://vimeo.com/123" });
    expect(errors.at(-1)).toEqual({ ok: false, error: "not-youtube" });
    await send(bob, { action: "add", url: "https://youtu.be/bloqueado1x" });
    expect(errors.at(-1)).toEqual({ ok: false, error: "not-embeddable" });
    await send(bob, { action: "add", url: "YE7VzlLtp-4" });
    expect(room.state.cinema.video).toMatchObject({ videoId: "YE7VzlLtp-4", title: "Película YE7VzlLtp-4", by: "Bob" });
    expect(room.state.club.video.videoId).toBe("");
    // Saltar desde la sala deja la pantalla libre.
    await send(bob, { action: "skip", id: room.state.cinema.video.id });
    expect(room.state.cinema.video.videoId).toBe("");
    expect(room.state.cinema.history.map((v) => v.videoId)).toEqual(["YE7VzlLtp-4"]);
  });

  it("pausar y seguir se hace desde la cabina del proyector", async () => {
    const { room, bob, errors, send } = await setup();
    const { aisle, booth } = spots();
    await goToArea(bob, room, "sotano");
    await walkToTile(bob, room, aisle.x, aisle.y);
    await send(bob, { action: "add", url: "eRsGyueVLvQ" });
    await send(bob, { action: "pause" });
    expect(errors.at(-1)).toEqual({ ok: false, error: "booth" });
    expect(room.state.cinema.paused).toBe(false);
    await walkToTile(bob, room, booth.x, booth.y);
    await send(bob, { action: "pause" });
    expect(room.state.cinema.paused).toBe(true);
    await tick(CINEMA.controlCooldownMs);
    await send(bob, { action: "resume" });
    expect(room.state.cinema.paused).toBe(false);
  });
});
