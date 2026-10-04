import type { ColyseusTestServer } from "@colyseus/testing";
import { MSG, MSG_RATE, ROOM_NAME } from "@hyvento/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, tick, token, until } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;

beforeAll(async () => {
  repo = new MemoryRepository();
  colyseus = await bootServer(repo);
});
afterAll(async () => {
  await colyseus.shutdown();
});
afterEach(() => {
  OfficeRoom.msgRate = null; // como lo deja test/setup.ts
});

describe("límite de mensajes por cliente", () => {
  it("descarta el exceso de quien inunda la sala sin sacarlo, y lo deja seguir después", async () => {
    OfficeRoom.repo = repo;
    OfficeRoom.msgRate = { perSecond: 20, burst: 10 };
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    const ana = await colyseus.connectTo(room, { token: await token("u-ana", "Ana") });
    const bruno = await colyseus.connectTo(room, { token: await token("u-bruno", "Bruno") });
    await room.waitForNextPatch();
    let anaPongs = 0;
    let brunoPongs = 0;
    let left = false;
    ana.onMessage(MSG.clockPong, () => anaPongs++);
    bruno.onMessage(MSG.clockPong, () => brunoPongs++);
    ana.onLeave(() => (left = true));

    // Ana manda 200 de golpe: pasan las del balde (y alguna que se recargó mientras llegaban).
    for (let i = 0; i < 200; i++) ana.send(MSG.clockPing, { id: i });
    // Bruno, al mismo tiempo, manda pocos: su balde es otro.
    for (let i = 0; i < 5; i++) bruno.send(MSG.clockPing, { id: i });
    await until(() => brunoPongs === 5, "las respuestas de Bruno");
    await tick(200);
    expect(anaPongs).toBeGreaterThanOrEqual(10);
    expect(anaPongs).toBeLessThan(60);
    expect(left).toBe(false);

    // Pasado un rato el balde se recargó y vuelve a contestarle.
    const before = anaPongs;
    await tick(600);
    ana.send(MSG.clockPing, { id: 999 });
    await until(() => anaPongs === before + 1, "la respuesta después de la pausa");
    expect(room.state.players.has(ana.sessionId)).toBe(true);
  });

  it("el ritmo de un cliente honesto entra con holgura", () => {
    // El movimiento (15/s) y el mazo del hockey (~33/s) juntos.
    expect(MSG_RATE.perSecond).toBeGreaterThan(15 + 34);
  });
});
