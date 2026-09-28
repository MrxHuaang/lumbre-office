import type { ColyseusTestServer } from "@colyseus/testing";
import { canSwimAt, diveLine, getWorld, isBlockedTile, isSwimTile, pointsOfType, poolExitSpot, type OfficeMap } from "@hyvento/map";
import { AGUA, AGUA_MSG, MSG, POINTS, ROOM_NAME, type AguaNotice, type DiveEvent, type MoveCorrection } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, tick, token, walkToTile, type ServerRoom } from "./helpers";

// La piscina del jardín en la sala: meterse por la escalera, nadar solo por el agua, salir por el borde
// (mojado un rato), el chapuzón del trampolín que ven todos, la lluvia que saca a todos y tapa la
// piscina, y los puntos de las reposeras, que solo da el sol.

const jardin = getWorld().areas.get("jardin") as OfficeMap;
const ts = jardin.tileSize;
const steps = pointsOfType(jardin, "pool_steps")[0]!;
const boardPoint = pointsOfType(jardin, "diving_board")[0]!;
const board = jardin.furniture.find((f) => f.type === "diving-board")!;
const pool = jardin.furniture.find((f) => f.type === "pool")!;
const center = (tx: number, ty: number) => ({ x: tx * ts + ts / 2, y: ty * ts + ts / 2 });
/** Agua de la pileta: la fila del medio, de oeste a este. */
const water: { x: number; y: number }[] = [];
for (let y = pool.y; y < pool.y + pool.d; y++) for (let x = pool.x; x < pool.x + pool.w; x++) if (isSwimTile(jardin, x, y)) water.push({ x, y });
const midRow = water[Math.floor(water.length / 2)]!.y;

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
const TIMINGS = OfficeRoom.aguaTimings;

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
  OfficeRoom.weatherInitial = "despejado";
  // Mediodía en el reloj del juego (hay sol).
  OfficeRoom.gameClockInitial = { anchorReal: Date.now(), anchorMinute: 12 * 60 };
  OfficeRoom.aguaTimings = { wetMs: 400, tickMs: 250, diveCooldownMs: 300, checkMs: 60 };
  process.env.HYVENTO_DEV_TOOLS = "1";
});
afterEach(() => {
  OfficeRoom.weatherInitial = null;
  OfficeRoom.gameClockInitial = null;
  OfficeRoom.aguaTimings = TIMINGS;
  OfficeRoom.idleMs = POINTS.idleMs;
  delete process.env.HYVENTO_DEV_TOOLS;
});

const me = (client: ClientRoom, room: ServerRoom) => room.state.players.get(client.sessionId)!;

async function join(name = "Alice") {
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const client = await connect(room, name);
  return { room, ...client };
}

async function connect(room: ServerRoom, name: string) {
  const client = await colyseus.connectTo(room, { token: await token(`u-${name.toLowerCase()}`, name) });
  await room.waitForNextPatch();
  const notices: AguaNotice[] = [];
  const dives: DiveEvent[] = [];
  const corrections: MoveCorrection[] = [];
  client.onMessage(AGUA_MSG.notice, (n: AguaNotice) => notices.push(n));
  client.onMessage(AGUA_MSG.dive, (e: DiveEvent) => dives.push(e));
  client.onMessage(MSG.moveCorrection, (c: MoveCorrection) => corrections.push(c));
  return { client, notices, dives, corrections };
}

async function send(client: ClientRoom, room: ServerRoom, type: string, raw: unknown, wait = 80) {
  client.send(type, raw);
  await room.waitForNextPatch();
  await tick(wait);
}

/** Nada en pasos cortos hasta (x, y) (como el cliente). */
async function swimTo(client: ClientRoom, room: ServerRoom, x: number, y: number) {
  let { x: cx, y: cy } = me(client, room);
  while (Math.hypot(x - cx, y - cy) > 1) {
    const d = Math.hypot(x - cx, y - cy);
    const step = Math.min(6, d);
    cx += ((x - cx) / d) * step;
    cy += ((y - cy) / d) * step;
    client.send(MSG.move, { x: cx, y: cy, dir: "right", moving: true });
    await tick(12);
  }
  await room.waitForNextPatch();
  await tick(20);
}

/** Se mete a la piscina por la escalera del suroeste. */
async function intoPool(client: ClientRoom, room: ServerRoom) {
  await walkToTile(client, room, steps.tileX, steps.tileY);
  await send(client, room, AGUA_MSG.action, { action: "swim" });
}

describe("la piscina", () => {
  it("se entra por la escalera y adentro solo se nada por el agua", async () => {
    const { room, client, notices } = await join();
    // Lejos de la escalera no se entra.
    await send(client, room, AGUA_MSG.action, { action: "swim" });
    expect(me(client, room).swimming).toBe(false);
    expect(notices.at(-1)?.code).toBe("far");

    await intoPool(client, room);
    const p = me(client, room);
    expect(p.swimming).toBe(true);
    expect(canSwimAt(jardin, p.x, p.y)).toBe(true);
    expect(p.zoneId).toBe("piscina");

    // Se nada a lo largo de la pileta.
    const target = center(water.filter((t) => t.y === midRow).at(-2)!.x, midRow);
    await swimTo(client, room, p.x, target.y);
    await swimTo(client, room, target.x, target.y);
    expect(Math.hypot(me(client, room).x - target.x, me(client, room).y - target.y)).toBeLessThan(2);

    // Nadando no se pisa el deck: el servidor lo devuelve al agua.
    const before = { x: me(client, room).x, y: me(client, room).y };
    const deck = center(pool.x + pool.w - 1, midRow);
    await swimTo(client, room, deck.x, deck.y);
    expect(canSwimAt(jardin, me(client, room).x, me(client, room).y)).toBe(true);
    expect(me(client, room).x).toBeLessThan(deck.x - ts / 2);
    expect(me(client, room).x).toBeGreaterThanOrEqual(before.x - 1);
  });

  it("caminando no se entra al agua", async () => {
    const { room, client } = await join();
    await walkToTile(client, room, steps.tileX, steps.tileY);
    const start = { x: me(client, room).x, y: me(client, room).y };
    // Un paso hacia el agua de al lado se rechaza.
    const into = water.find((t) => Math.hypot(t.x - steps.tileX, t.y - steps.tileY) <= 1)!;
    const goal = center(into.x, into.y);
    for (let k = 1; k <= 5; k++) client.send(MSG.move, { x: start.x + ((goal.x - start.x) * k) / 5, y: start.y + ((goal.y - start.y) * k) / 5, dir: "up", moving: true });
    await room.waitForNextPatch();
    await tick(40);
    const p = me(client, room);
    expect(isBlockedTile(jardin, Math.floor(p.x / ts), Math.floor(p.y / ts))).toBe(false);
    expect(p.swimming).toBe(false);
  });

  it("se sale por el borde (no desde el medio) y se queda mojado un rato", async () => {
    const { room, client, notices } = await join();
    await intoPool(client, room);
    // Al medio de la pileta: el borde queda lejos.
    const mid = water.find((t) => poolExitSpot(jardin, center(t.x, t.y).x, center(t.x, t.y).y, AGUA.exitReachTiles) === null)!;
    await swimTo(client, room, center(mid.x, mid.y).x, me(client, room).y);
    await swimTo(client, room, center(mid.x, mid.y).x, center(mid.x, mid.y).y);
    await send(client, room, AGUA_MSG.action, { action: "out" });
    expect(me(client, room).swimming).toBe(true);
    expect(notices.at(-1)?.code).toBe("edge");

    // Vuelve a la escalera y sale.
    await swimTo(client, room, center(steps.tileX, steps.tileY - 1).x, center(steps.tileX, steps.tileY - 1).y);
    await send(client, room, AGUA_MSG.action, { action: "out" });
    const p = me(client, room);
    expect(p.swimming).toBe(false);
    expect(isBlockedTile(jardin, Math.floor(p.x / ts), Math.floor(p.y / ts))).toBe(false);
    expect(p.wet).toBe(true);
    await tick(OfficeRoom.aguaTimings.wetMs + 150);
    expect(me(client, room).wet).toBe(false);
  });

  it("el chapuzón del trampolín lo ven todos los del jardín y cae en el agua", async () => {
    const { room, client } = await join("Alice");
    const bob = await connect(room, "Bob");
    await walkToTile(client, room, boardPoint.tileX, boardPoint.tileY);
    await send(client, room, AGUA_MSG.action, { action: "dive" });
    const line = diveLine(jardin, board)!;
    expect(bob.dives).toHaveLength(1);
    expect(bob.dives[0]).toMatchObject({ sessionId: client.sessionId, fromX: line.fromX, fromY: line.fromY });
    const p = me(client, room);
    expect(p.swimming).toBe(true);
    expect(canSwimAt(jardin, p.x, p.y)).toBe(true);
    expect(Math.hypot(p.x - line.toX, p.y - line.toY)).toBeLessThan(1);
  });

  it("no se salta dos veces seguidas sin tomar aire", async () => {
    const { room, client, notices } = await join();
    OfficeRoom.aguaTimings = { ...OfficeRoom.aguaTimings, diveCooldownMs: 60_000 };
    await walkToTile(client, room, boardPoint.tileX, boardPoint.tileY);
    await send(client, room, AGUA_MSG.action, { action: "dive" });
    expect(me(client, room).swimming).toBe(true);
    // Nadando no se salta.
    await send(client, room, AGUA_MSG.action, { action: "dive" });
    expect(notices.at(-1)?.code).toBe("busy");
    // Sale por el borde del oeste (junto al trampolín), vuelve al trampolín y ya no puede saltar.
    await swimTo(client, room, center(board.x + 1, board.y + 1).x, center(board.x + 1, board.y + 1).y);
    await send(client, room, AGUA_MSG.action, { action: "out" });
    expect(me(client, room).swimming).toBe(false);
    await walkToTile(client, room, boardPoint.tileX, boardPoint.tileY);
    await send(client, room, AGUA_MSG.action, { action: "dive" });
    expect(me(client, room).swimming).toBe(false);
    expect(notices.at(-1)?.code).toBe("wait");
  });

  it("con lluvia salen todos del agua (mojados) y la piscina queda tapada", async () => {
    const { room, client, notices } = await join();
    await intoPool(client, room);
    await swimTo(client, room, center(water[Math.floor(water.length / 2)]!.x, midRow).x, me(client, room).y);
    await send(client, room, MSG.chatSend, { text: "/clima lluvia", scope: "proximity" });
    const p = me(client, room);
    expect(room.state.weather).toBe("lluvia");
    expect(p.swimming).toBe(false);
    expect(p.wet).toBe(true);
    expect(isBlockedTile(jardin, Math.floor(p.x / ts), Math.floor(p.y / ts))).toBe(false);
    expect(notices.map((n) => n.code)).toContain("rain");
    // Tapada: no se entra ni se salta.
    await walkToTile(client, room, steps.tileX, steps.tileY);
    await send(client, room, AGUA_MSG.action, { action: "swim" });
    expect(me(client, room).swimming).toBe(false);
    expect(notices.at(-1)?.code).toBe("covered");
    // Sale el sol: se puede volver a nadar.
    await send(client, room, MSG.chatSend, { text: "/clima despejado", scope: "proximity" });
    await send(client, room, AGUA_MSG.action, { action: "swim" });
    expect(me(client, room).swimming).toBe(true);
  });
});

describe("la piscina con nieve", () => {
  it("también se tapa y saca a todos", async () => {
    const { room, client, notices } = await join();
    await intoPool(client, room);
    await send(client, room, MSG.chatSend, { text: "/clima nieve", scope: "proximity" });
    expect(room.state.weather).toBe("nieve");
    expect(me(client, room).swimming).toBe(false);
    expect(notices.map((n) => n.code)).toContain("rain");
  });
});

describe("las reposeras", () => {
  const lounger = [...jardin.seats.values()].find((s) => s.type === "sun-lounger")!;

  /** Se sienta en la reposera y se queda un rato con actividad (mueve el mouse). */
  async function sunbathe(weather: string, night = false) {
    if (night) OfficeRoom.gameClockInitial = { anchorReal: Date.now(), anchorMinute: 22 * 60 };
    const { room, client } = await join();
    if (weather !== "despejado") await send(client, room, MSG.chatSend, { text: `/clima ${weather}`, scope: "proximity" });
    const near = [...[[1, 0], [-1, 0], [0, 1], [0, -1]]].map(([dx, dy]) => ({ x: lounger.tileX + dx!, y: lounger.tileY + dy! })).find((t) => !isBlockedTile(jardin, t.x, t.y))!;
    await walkToTile(client, room, near.x, near.y);
    await send(client, room, MSG.move, { x: lounger.x, y: lounger.y, dir: lounger.facing, moving: false, seated: true });
    expect(me(client, room).seated).toBe(true);
    const before = await repo.getPoints("u-alice");
    const end = Date.now() + OfficeRoom.aguaTimings.tickMs * 3 + 200;
    while (Date.now() < end) {
      client.send(MSG.activity);
      await tick(40);
    }
    return (await repo.getPoints("u-alice")) - before;
  }

  it("al sol dan puntos de ocio", async () => {
    expect(await sunbathe("despejado")).toBeGreaterThanOrEqual(AGUA.sunPoints);
    expect(repo.ledger.filter((m) => m.userId === "u-alice" && m.reason === "LEISURE").length).toBeGreaterThan(0);
  });

  it("nublado no", async () => {
    expect(await sunbathe("nublado")).toBe(0);
  });

  it("de noche tampoco", async () => {
    expect(await sunbathe("despejado", true)).toBe(0);
  });

  it("sin actividad no hay puntos", async () => {
    OfficeRoom.idleMs = 50;
    const { room, client } = await join();
    const near = [...[[1, 0], [-1, 0], [0, 1], [0, -1]]].map(([dx, dy]) => ({ x: lounger.tileX + dx!, y: lounger.tileY + dy! })).find((t) => !isBlockedTile(jardin, t.x, t.y))!;
    await walkToTile(client, room, near.x, near.y);
    await send(client, room, MSG.move, { x: lounger.x, y: lounger.y, dir: lounger.facing, moving: false, seated: true });
    await tick(120);
    const before = await repo.getPoints("u-alice");
    await tick(OfficeRoom.aguaTimings.tickMs * 3);
    expect(await repo.getPoints("u-alice")).toBe(before);
  });
});
