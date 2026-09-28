import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, pointsOfType } from "@hyvento/map";
import {
  MARSHMALLOW,
  OBS_MSG,
  ROOM_NAME,
  SKY,
  STAT_KEYS,
  TOURIST_AREAS,
  type MarshmallowEvent,
  type SkyEvent,
} from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, goToArea, tick, token, walkToTile, type ServerRoom } from "./helpers";

// El observatorio en la sala: la fogata de malvaviscos (se valida por tiempos medidos en el servidor, con
// tope diario de puntos) y el telescopio (de día "vuelve de noche"; de noche, las estrellas fugaces que
// decide el servidor y el primero que la ve se lleva el logro).

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
let now = 1_000_000;

const jardin = getWorld().areas.get("jardin")!;
const obs = getWorld().areas.get("observatorio")!;
const firePoint = pointsOfType(jardin, "marshmallow_fire")[0]!;
const telescope = pointsOfType(obs, "telescope")[0]!;

/** Hora del juego del primer día a las `h` en punto (el reloj queda quieto: `now` no avanza solo). */
const clockAt = (h: number) => ({ anchorReal: now, anchorMinute: 1440 + h * 60 });

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
  now = 1_000_000;
  OfficeRoom.observatorioNow = () => now;
  OfficeRoom.gameClockNow = () => now;
  // Calor 100 (20 sobre el mínimo de 80) y la estrella siempre en el mismo lugar.
  OfficeRoom.observatorioRandom = (n) => Math.min(20, n - 1);
  OfficeRoom.marshmallowTimings = { ...MARSHMALLOW, cooldownMs: 0 };
  OfficeRoom.skyTimings = { ...SKY, tickMs: 20, starMinGapMs: 5, starMaxGapMs: 5 };
  OfficeRoom.gameClockInitial = clockAt(12);
});
afterEach(() => {
  OfficeRoom.observatorioNow = () => Date.now();
  OfficeRoom.gameClockNow = () => Date.now();
  OfficeRoom.observatorioRandom = (n) => Math.floor(Math.random() * n);
  OfficeRoom.marshmallowTimings = { ...MARSHMALLOW };
  OfficeRoom.skyTimings = { ...SKY };
  OfficeRoom.gameClockInitial = null;
});

async function join(room: ServerRoom, id: string, name: string) {
  const client = await colyseus.connectTo(room, { token: await token(id, name) });
  const roast: MarshmallowEvent[] = [];
  const sky: SkyEvent[] = [];
  client.onMessage(OBS_MSG.marshmallowEvent, (e: MarshmallowEvent) => roast.push(e));
  client.onMessage(OBS_MSG.sky, (e: SkyEvent) => sky.push(e));
  await room.waitForNextPatch();
  return { client, roast, sky };
}

const toFire = (client: ClientRoom, room: ServerRoom) => walkToTile(client, room, firePoint.tileX, firePoint.tileY);
async function toTelescope(client: ClientRoom, room: ServerRoom) {
  await goToArea(client, room, "observatorio");
  await walkToTile(client, room, telescope.tileX, telescope.tileY);
}

async function roastFor(client: ClientRoom, room: ServerRoom, ms: number) {
  client.send(OBS_MSG.marshmallowStart);
  await tick(40);
  now += ms;
  client.send(OBS_MSG.marshmallowPull);
  await tick(60);
  await room.waitForNextPatch();
}

describe("observatorio", () => {
  it("es un nivel más para el logro Turista", () => {
    expect(getWorld().areas.size).toBe(TOURIST_AREAS);
  });

  it("el malvavisco sacado en su punto sale dorado: da puntos, queda en la mano y cuenta para el logro", async () => {
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    const alice = await join(room, "u-alice", "Alice");
    await toFire(alice.client, room);
    const before = room.state.players.get(alice.client.sessionId)!.points;
    await roastFor(alice.client, room, MARSHMALLOW.goldenAtMs + 300);
    expect(alice.roast.find((e) => e.kind === "started")).toMatchObject({ heat: 100 });
    expect(alice.roast.find((e) => e.kind === "result")).toMatchObject({ doneness: "dorado", points: MARSHMALLOW.points.dorado, kept: true });
    const me = room.state.players.get(alice.client.sessionId)!;
    expect(me.points).toBe(before + MARSHMALLOW.points.dorado);
    expect(me.held).toBe("malvavisco");
    const stats = (room as unknown as OfficeRoom).statsOf("u-alice")!.stats;
    expect(stats[STAT_KEYS.goldenMarshmallows]).toBe(1);
  });

  it("crudo o quemado no da nada; lejos del fuego no se puede; si nadie lo saca, se cae al fuego", async () => {
    OfficeRoom.marshmallowTimings = { ...MARSHMALLOW, cooldownMs: 0, dropAtMs: 120 };
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    const alice = await join(room, "u-alice", "Alice");
    alice.client.send(OBS_MSG.marshmallowStart);
    await tick(60);
    expect(alice.roast.at(-1)).toMatchObject({ kind: "error", reason: "far" });
    await toFire(alice.client, room);
    await roastFor(alice.client, room, 500);
    expect(alice.roast.at(-1)).toMatchObject({ kind: "result", doneness: "crudo", points: 0 });
    await roastFor(alice.client, room, MARSHMALLOW.burntAtMs + 100);
    expect(alice.roast.at(-1)).toMatchObject({ kind: "result", doneness: "quemado", points: 0, kept: false });
    // El que se deja solo se cae al fuego.
    alice.client.send(OBS_MSG.marshmallowStart);
    await tick(300);
    expect(alice.roast.at(-1)).toMatchObject({ kind: "result", doneness: "quemado" });
  });

  it("los puntos del malvavisco tienen tope diario", async () => {
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    const alice = await join(room, "u-alice", "Alice");
    await toFire(alice.client, room);
    const rounds = Math.ceil(MARSHMALLOW.dailyPoints / MARSHMALLOW.points.dorado) + 1;
    for (let i = 0; i < rounds; i++) await roastFor(alice.client, room, MARSHMALLOW.goldenAtMs + 300);
    const results = alice.roast.filter((e) => e.kind === "result");
    expect(results).toHaveLength(rounds);
    expect(results.reduce((t, e) => t + (e.kind === "result" ? e.points : 0), 0)).toBe(MARSHMALLOW.dailyPoints);
    expect(results.at(-1)).toMatchObject({ doneness: "dorado", points: 0 });
    expect((room as unknown as OfficeRoom).observatorioState()!.pointsOf("u-alice")).toBe(MARSHMALLOW.dailyPoints);
  });

  it("de día el telescopio dice que vuelvas de noche", async () => {
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    const alice = await join(room, "u-alice", "Alice");
    await toTelescope(alice.client, room);
    alice.client.send(OBS_MSG.telescopeLook);
    await tick(80);
    expect(alice.sky.at(-1)).toMatchObject({ kind: "sky", night: false });
    expect(alice.sky.some((e) => e.kind === "star")).toBe(false);
  });

  it("de noche pasa la estrella fugaz que decide el servidor y el primero que la ve se lleva el logro", async () => {
    OfficeRoom.gameClockInitial = clockAt(22);
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    const alice = await join(room, "u-alice", "Alice");
    const bob = await join(room, "u-bob", "Bob");
    const carol = await join(room, "u-carol", "Carol");
    await toTelescope(alice.client, room);
    await toTelescope(bob.client, room);
    for (const c of [alice, bob]) c.client.send(OBS_MSG.telescopeLook);
    await tick(80);
    expect(alice.sky[0]).toMatchObject({ kind: "sky", night: true });
    // Pasa una estrella (con el azar fijo: siempre en el mismo lugar).
    now += 10;
    await tick(120);
    const seen = alice.sky.find((e) => e.kind === "star");
    expect(seen).toBeTruthy();
    const star = seen!.kind === "star" ? seen!.star : null!;
    expect(bob.sky.some((e) => e.kind === "star" && e.star.id === star.id)).toBe(true);
    // Carol no estaba mirando: no le llega ni le vale.
    expect(carol.sky.some((e) => e.kind === "star")).toBe(false);
    carol.client.send(OBS_MSG.starSpot, { starId: star.id });
    await tick(60);
    expect(carol.sky.at(-1)).toMatchObject({ kind: "missed" });
    bob.client.send(OBS_MSG.starSpot, { starId: star.id });
    await tick(60);
    alice.client.send(OBS_MSG.starSpot, { starId: star.id });
    await tick(80);
    expect(bob.sky.find((e) => e.kind === "spotted" && e.mine)).toMatchObject({ first: true, name: "Bob" });
    expect(alice.sky.find((e) => e.kind === "spotted" && e.mine)).toMatchObject({ first: false, name: "Alice" });
    const r = room as unknown as OfficeRoom;
    expect(r.statsOf("u-bob")!.stats[STAT_KEYS.shootingStarsFirst]).toBe(1);
    expect(r.statsOf("u-alice")!.stats[STAT_KEYS.shootingStarsFirst]).toBeUndefined();
    expect(r.statsOf("u-alice")!.stats[STAT_KEYS.shootingStars]).toBe(1);
    expect(r.statsOf("u-alice")!.stats[STAT_KEYS.stargazing]).toBe(1);
    // Pasado el vuelo y la gracia, esa ya no vale.
    now += SKY.starFlightMs + SKY.starGraceMs + 100;
    await tick(60);
    const bobSpots = bob.sky.filter((e) => e.kind === "spotted").length;
    bob.client.send(OBS_MSG.starSpot, { starId: star.id });
    await tick(60);
    expect(bob.sky.filter((e) => e.kind === "spotted")).toHaveLength(bobSpots);
    expect(bob.sky.at(-1)?.kind === "missed" || bob.sky.at(-1)?.kind === "star").toBe(true);
  });
});
