import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { CLOSE_CODE, MSG, ROOM_NAME, signGameToken, type ChatEvent, type MoveCorrection } from "@hyvento/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createGameServer } from "../src/app";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { FakeAgentQueue, c, TILE, tick, token, walkPath, walkTo } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;

beforeAll(async () => {
  repo = new MemoryRepository();
  colyseus = await boot(createGameServer({ repo, agentQueue: new FakeAgentQueue() }));
});
afterAll(async () => {
  await colyseus.shutdown();
});
beforeEach(async () => {
  await colyseus.cleanup();
  repo = new MemoryRepository();
  OfficeRoom.repo = repo;
});

async function setup() {
  const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
  await room.waitForNextPatch();
  return { room, alice, bob };
}

function collectChat(client: { onMessage: (t: string, cb: (m: ChatEvent) => void) => void }) {
  const got: ChatEvent[] = [];
  client.onMessage(MSG.chatEvent, (m) => got.push(m));
  return got;
}

describe("OfficeRoom: ingreso y sesiones", () => {
  it("rechaza ingresos sin token o con token inválido", async () => {
    const room = await colyseus.createRoom(ROOM_NAME, {});
    await expect(colyseus.connectTo(room, { name: "Alice", avatar: "ada" })).rejects.toThrow();
    await expect(colyseus.connectTo(room, { token: "no-es-un-jwt" })).rejects.toThrow();
    const forged = await signGameToken(
      { sub: "u-x", name: "X", avatar: "ada", role: "ADMIN" },
      "otro-secreto-otro-secreto-otro-secreto",
    );
    await expect(colyseus.connectTo(room, { token: forged })).rejects.toThrow();
  });

  it("crea el jugador en el spawn dentro de la zona común", async () => {
    const { room, alice } = await setup();
    const p = room.state.players.get(alice.sessionId)!;
    expect(p.name).toBe("Alice");
    expect(p.userId).toBe("u-alice");
    expect(p.zoneId).toBe("lounge");
    expect(room.state.players.size).toBe(2);
  });

  it("una misma persona en otra pestaña reemplaza su sesión anterior", async () => {
    const { room, alice } = await setup();
    const codes: number[] = [];
    alice.onLeave((code) => codes.push(code));
    const alice2 = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    await room.waitForNextPatch();
    await tick();
    expect(codes).toEqual([CLOSE_CODE.replaced]);
    const alices = [...room.state.players.values()].filter((p) => p.userId === "u-alice");
    expect(alices).toHaveLength(1);
    expect(room.state.players.has(alice2.sessionId)).toBe(true);
  });

  it("al recargar la página no queda un avatar duplicado esperando reconexión", async () => {
    const { room, alice } = await setup();
    await alice.leave(false); // cierre sin consentimiento (recarga)
    await tick();
    expect([...room.state.players.values()].filter((p) => p.userId === "u-alice")).toHaveLength(1);

    const alice2 = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    await room.waitForNextPatch();
    await tick();
    const alices = [...room.state.players.entries()].filter(([, p]) => p.userId === "u-alice");
    expect(alices.map(([id]) => id)).toEqual([alice2.sessionId]);
  });
});

describe("OfficeRoom: movimiento", () => {
  it("acepta movimientos válidos", async () => {
    const { room, alice } = await setup();
    const p = room.state.players.get(alice.sessionId)!;
    const startX = p.x;
    await walkTo(alice, room, p.x + 40, p.y);
    expect(room.state.players.get(alice.sessionId)!.x).toBeCloseTo(startX + 40, 0);
    expect(room.state.players.get(alice.sessionId)!.zoneId).toBe("lounge");
  });

  it("publica el lugar de cada jugador, incluida la entrada de una oficina", async () => {
    const { room, alice } = await setup();
    const me = () => room.state.players.get(alice.sessionId)!;
    expect(me().place).toBe("lounge");
    await walkTo(alice, room, c(24), me().y);
    await walkTo(alice, room, c(24), c(8)); // umbral de la puerta de la oficina 4
    expect(me().place).toBe("door:office-4");
    expect(me().zoneId).toBe(""); // el umbral no aísla el audio
    await walkTo(alice, room, c(24), c(6));
    expect(me().place).toBe("office-4");
  });

  it("corrige teletransportes y movimientos dentro de muros", async () => {
    const { room, alice } = await setup();
    const corrections: MoveCorrection[] = [];
    alice.onMessage(MSG.moveCorrection, (m: MoveCorrection) => corrections.push(m));
    const before = { ...room.state.players.get(alice.sessionId)!.toJSON() };

    alice.send(MSG.move, { x: before.x + 500, y: before.y, dir: "right", moving: true });
    alice.send(MSG.move, { x: c(0), y: c(13), dir: "left", moving: true });
    await room.waitForNextPatch();
    await tick();

    expect(corrections.length).toBe(2);
    expect(room.state.players.get(alice.sessionId)!.x).toBe(before.x);
  });
});

describe("OfficeRoom: chat y estado", () => {
  it("el chat global llega a todos y se persiste", async () => {
    const { room, alice, bob } = await setup();
    const bobGot = collectChat(bob);
    alice.send(MSG.chatSend, { text: "hola a todos", scope: "global" });
    await room.waitForNextPatch();
    await tick();
    expect(bobGot.map((m) => m.text)).toEqual(["hola a todos"]);
    expect(repo.chat.map((m) => m.text)).toEqual(["hola a todos"]);
  });

  it("una sala nueva carga el historial global guardado", async () => {
    repo.chat.push({ id: "m1", fromId: "user:u-x", fromName: "X", text: "de ayer", scope: "global", zoneId: null, ts: 1 });
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    const history = await new Promise<ChatEvent[]>((resolve) => alice.onMessage(MSG.chatHistory, resolve));
    expect(history.map((m) => m.text)).toEqual(["de ayer"]);
  });

  it("el chat de proximidad solo llega a quien está cerca", async () => {
    const { room, alice, bob } = await setup();
    const bobGot = collectChat(bob);

    alice.send(MSG.chatSend, { text: "cerca", scope: "proximity" });
    await room.waitForNextPatch();

    const p = room.state.players.get(alice.sessionId)!;
    await walkTo(alice, room, c(37), p.y);
    alice.send(MSG.chatSend, { text: "lejos", scope: "proximity" });
    await room.waitForNextPatch();
    await tick();

    expect(bobGot.map((m) => m.text)).toEqual(["cerca"]);
    expect(repo.chat).toHaveLength(0); // la proximidad no se persiste
  });

  it("el chat de proximidad no atraviesa la pared de una oficina", async () => {
    const { room, alice, bob } = await setup();
    const bobGot = collectChat(bob);

    await walkTo(alice, room, c(24), room.state.players.get(alice.sessionId)!.y);
    await walkTo(alice, room, c(24), c(10));
    await walkTo(alice, room, c(24), c(6));
    await walkTo(bob, room, c(25), room.state.players.get(bob.sessionId)!.y);
    await walkTo(bob, room, c(25), c(10));
    expect(room.state.players.get(alice.sessionId)!.zoneId).toBe("office-4");

    alice.send(MSG.chatSend, { text: "reunión privada", scope: "proximity" });
    await room.waitForNextPatch();
    await tick();
    expect(bobGot).toHaveLength(0);
  });

  it("dentro de una sala se oye a todos aunque estén lejos (sin proximidad)", async () => {
    const { room, alice, bob } = await setup();
    const bobGot = collectChat(bob);
    // Esquinas opuestas de la sala de reuniones: ~9 tiles de distancia (> radio de 5 tiles).
    await walkTo(alice, room, c(33), room.state.players.get(alice.sessionId)!.y);
    await walkPath(alice, room, [[33, 10], [30, 10], [30, 3]]);
    await walkTo(bob, room, c(34), room.state.players.get(bob.sessionId)!.y);
    await walkPath(bob, room, [[34, 10], [37, 10], [37, 9]]);
    const a = room.state.players.get(alice.sessionId)!;
    const b = room.state.players.get(bob.sessionId)!;
    expect([a.zoneId, b.zoneId]).toEqual(["meeting-main", "meeting-main"]);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(5 * TILE);

    alice.send(MSG.chatSend, { text: "¿me oyes desde allá?", scope: "proximity" });
    await room.waitForNextPatch();
    await tick();
    expect(bobGot.map((m) => m.text)).toEqual(["¿me oyes desde allá?"]);
  });

  it("limita la tasa de mensajes de chat", async () => {
    const { room, alice, bob } = await setup();
    const bobGot = collectChat(bob);
    for (let i = 0; i < 8; i++) alice.send(MSG.chatSend, { text: `m${i}`, scope: "global" });
    await room.waitForNextPatch();
    await tick();
    expect(bobGot).toHaveLength(5);
  });

  it("el estado de presencia se guarda y se restaura al volver", async () => {
    const { room, bob } = await setup();
    bob.send(MSG.status, { status: "busy" });
    await room.waitForNextPatch();
    await tick();
    expect(repo.statuses.get("u-bob")).toBe("busy");

    await bob.leave(true);
    const bob2 = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
    await room.waitForNextPatch();
    expect(room.state.players.get(bob2.sessionId)!.status).toBe("busy");
  });
});
