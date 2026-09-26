import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { CLOSE_CODE, MSG, ROOM_NAME, signGameToken, type ChatEvent, type GameTokenClaims, type MoveCorrection } from "@hyvento/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createGameServer } from "../src/app";
import type { OfficeState } from "../src/state";

const SECRET = "test-secret-test-secret-test-secret-123";
process.env.GAME_TOKEN_SECRET = SECRET;

let colyseus: ColyseusTestServer;

const token = (sub: string, name: string, avatar: GameTokenClaims["avatar"] = "ada") =>
  signGameToken({ sub, name, avatar, role: "MEMBER" }, SECRET);

beforeAll(async () => {
  colyseus = await boot(createGameServer());
});
afterAll(async () => {
  await colyseus.shutdown();
});
beforeEach(async () => {
  await colyseus.cleanup();
});

const TILE = 32;
const c = (t: number) => t * TILE + TILE / 2;

async function setup() {
  const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
  await room.waitForNextPatch();
  return { room, alice, bob };
}

/** Mueve a un jugador en pasos pequeños (como lo haría el cliente real). */
async function walkTo(client: Awaited<ReturnType<typeof setup>>["alice"], room: Awaited<ReturnType<typeof setup>>["room"], x: number, y: number) {
  const p = room.state.players.get(client.sessionId)!;
  let cx = p.x;
  let cy = p.y;
  while (Math.hypot(x - cx, y - cy) > 1) {
    const d = Math.hypot(x - cx, y - cy);
    const step = Math.min(10, d);
    cx += ((x - cx) / d) * step;
    cy += ((y - cy) / d) * step;
    client.send(MSG.move, { x: cx, y: cy, dir: "down", moving: true });
  }
  await room.waitForNextPatch();
}

function collectChat(client: { onMessage: (t: string, cb: (m: ChatEvent) => void) => void }) {
  const got: ChatEvent[] = [];
  client.onMessage(MSG.chatEvent, (m) => got.push(m));
  return got;
}

describe("OfficeRoom", () => {
  it("rechaza ingresos sin token o con token inválido", async () => {
    const room = await colyseus.createRoom(ROOM_NAME, {});
    await expect(colyseus.connectTo(room, { name: "Alice", avatar: "ada" })).rejects.toThrow();
    await expect(colyseus.connectTo(room, { token: "no-es-un-jwt" })).rejects.toThrow();
    const forged = await signGameToken({ sub: "u-x", name: "X", avatar: "ada", role: "ADMIN" }, "otro-secreto-otro-secreto-otro-secreto");
    await expect(colyseus.connectTo(room, { token: forged })).rejects.toThrow();
  });

  it("una misma persona en otra pestaña reemplaza su sesión anterior", async () => {
    const { room, alice } = await setup();
    const codes: number[] = [];
    alice.onLeave((code) => codes.push(code));
    const alice2 = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    await room.waitForNextPatch();
    await new Promise((r) => setTimeout(r, 50));
    expect(codes).toEqual([CLOSE_CODE.replaced]);
    const alices = [...room.state.players.values()].filter((p) => p.userId === "u-alice");
    expect(alices).toHaveLength(1);
    expect(room.state.players.has(alice2.sessionId)).toBe(true);
  });

  it("crea el jugador en el spawn dentro de la zona común", async () => {
    const { room, alice } = await setup();
    const p = room.state.players.get(alice.sessionId)!;
    expect(p.name).toBe("Alice");
    expect(p.zoneId).toBe("lounge");
    expect(room.state.players.size).toBe(2);
  });

  it("acepta movimientos válidos y actualiza la zona", async () => {
    const { room, alice } = await setup();
    const p = room.state.players.get(alice.sessionId)!;
    await walkTo(alice, room, p.x + 40, p.y);
    expect(p.x).toBeCloseTo(room.state.players.get(alice.sessionId)!.x);
    expect(room.state.players.get(alice.sessionId)!.zoneId).toBe("lounge");
  });

  it("corrige teletransportes y movimientos dentro de muros", async () => {
    const { room, alice } = await setup();
    const corrections: MoveCorrection[] = [];
    alice.onMessage(MSG.moveCorrection, (m: MoveCorrection) => corrections.push(m));
    const before = { ...room.state.players.get(alice.sessionId)!.toJSON() };

    alice.send(MSG.move, { x: before.x + 500, y: before.y, dir: "right", moving: true }); // teletransporte
    alice.send(MSG.move, { x: c(0), y: c(13), dir: "left", moving: true }); // muro
    await room.waitForNextPatch();
    await new Promise((r) => setTimeout(r, 50));

    expect(corrections.length).toBe(2);
    expect(room.state.players.get(alice.sessionId)!.x).toBe(before.x);
  });

  it("el chat global llega a todos", async () => {
    const { room, alice, bob } = await setup();
    const bobGot = collectChat(bob);
    alice.send(MSG.chatSend, { text: "hola a todos", scope: "global" });
    await room.waitForNextPatch();
    await new Promise((r) => setTimeout(r, 50));
    expect(bobGot.map((m) => m.text)).toEqual(["hola a todos"]);
  });

  it("el chat de proximidad solo llega a quien está cerca", async () => {
    const { room, alice, bob } = await setup();
    const bobGot = collectChat(bob);

    alice.send(MSG.chatSend, { text: "cerca", scope: "proximity" });
    await room.waitForNextPatch();

    // Alice camina lejos (extremo este de la zona común, > 5 tiles).
    const p = room.state.players.get(alice.sessionId)!;
    await walkTo(alice, room, c(37), p.y);
    alice.send(MSG.chatSend, { text: "lejos", scope: "proximity" });
    await room.waitForNextPatch();
    await new Promise((r) => setTimeout(r, 50));

    expect(bobGot.map((m) => m.text)).toEqual(["cerca"]);
  });

  it("el chat de proximidad no atraviesa la pared de una oficina", async () => {
    const { room, alice, bob } = await setup();
    const bobGot = collectChat(bob);

    // Alice entra a la oficina 4 (puerta en x=24..25, y=8) y Bob se queda justo afuera de la puerta.
    await walkTo(alice, room, c(24), room.state.players.get(alice.sessionId)!.y);
    await walkTo(alice, room, c(24), c(10));
    await walkTo(alice, room, c(24), c(6));
    await walkTo(bob, room, c(25), room.state.players.get(bob.sessionId)!.y);
    await walkTo(bob, room, c(25), c(10));
    expect(room.state.players.get(alice.sessionId)!.zoneId).toBe("office-4");

    alice.send(MSG.chatSend, { text: "reunión privada", scope: "proximity" });
    await room.waitForNextPatch();
    await new Promise((r) => setTimeout(r, 50));
    expect(bobGot).toHaveLength(0);
  });

  it("limita la tasa de mensajes de chat", async () => {
    const { room, alice, bob } = await setup();
    const bobGot = collectChat(bob);
    for (let i = 0; i < 8; i++) alice.send(MSG.chatSend, { text: `m${i}`, scope: "global" });
    await room.waitForNextPatch();
    await new Promise((r) => setTimeout(r, 50));
    expect(bobGot).toHaveLength(5);
  });
});
