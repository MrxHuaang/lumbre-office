import type { ColyseusTestServer } from "@colyseus/testing";
import { INTERNAL_ROUTES, MSG, POINTS, ROOM_NAME, type PointsAwarded } from "@hyvento/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, goToArea, SECRET, TEST_PORT, tick, token, walkToTile } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;

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
  // Tics cortos para no esperar 5 minutos.
  OfficeRoom.presenceTickMs = 200;
  OfficeRoom.idleMs = 150;
});
afterEach(() => {
  OfficeRoom.presenceTickMs = POINTS.tickMs;
  OfficeRoom.idleMs = POINTS.idleMs;
});

async function setup() {
  const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
  await room.waitForNextPatch();
  return { room, alice, bob };
}

/** Manda actividad cada poco hasta que pasen `ms` (como un cliente que se está usando). */
async function stayActive(clients: { send: (t: string) => void }[], ms: number) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    for (const c of clients) c.send(MSG.activity);
    await tick(50);
  }
}

describe("puntos de presencia", () => {
  it("se ganan estando activo y le llegan al cliente con el saldo nuevo", async () => {
    const { room, alice } = await setup();
    const got: PointsAwarded[] = [];
    alice.onMessage(MSG.pointsAwarded, (m: PointsAwarded) => got.push(m));
    await stayActive([alice], 500);
    await room.waitForNextPatch();

    const balance = await repo.getPoints("u-alice");
    expect(balance).toBeGreaterThanOrEqual(POINTS.presence);
    expect(got.at(-1)).toMatchObject({ reason: "PRESENCE", balance });
    expect(room.state.players.get(alice.sessionId)!.points).toBe(balance);
  });

  it("no se ganan sin actividad ni estando ausente", async () => {
    const { room, bob, alice } = await setup();
    bob.send(MSG.status, { status: "away" });
    // Entrar cuenta como actividad: si un tic cae justo después de entrar, da puntos. Se mide desde que
    // esa actividad venció (si no, el test fallaba de vez en cuando con la máquina cargada).
    await tick(OfficeRoom.idleMs + OfficeRoom.presenceTickMs);
    const bob0 = await repo.getPoints("u-bob");
    const alice0 = await repo.getPoints("u-alice");
    await stayActive([bob], 500); // ausente aunque se mueva el mouse
    expect(await repo.getPoints("u-bob")).toBe(bob0);
    expect(await repo.getPoints("u-alice")).toBe(alice0); // Alice no hizo nada desde que entró
    expect(room.state.players.get(alice.sessionId)!.points).toBe(alice0);
  });

  it("en la sala de reuniones con alguien más se gana el extra de reunión", async () => {
    const { alice, bob, room } = await setup();
    await goToArea(alice, room, "piso-2");
    await walkToTile(alice, room, 19, 1);
    await goToArea(bob, room, "piso-2");
    await walkToTile(bob, room, 27, 9);
    await stayActive([alice, bob], 500);
    const meeting = repo.ledger.filter((m) => m.userId === "u-alice" && m.reason === "MEETING");
    expect(meeting.length).toBeGreaterThan(0);
  });

  it("respeta el tope diario de presencia", async () => {
    repo.ledger.push({ userId: "u-alice", amount: POINTS.presenceDailyCap, reason: "PRESENCE", at: Date.now() });
    const { alice } = await setup();
    await stayActive([alice], 500);
    expect(await repo.getPoints("u-alice")).toBe(POINTS.presenceDailyCap);
  });
});

describe("aviso de la web: cambió un saldo", () => {
  it("con el secreto, recarga el saldo de esa persona en vivo", async () => {
    const { room, alice } = await setup();
    // Entrar cuenta como actividad y un tic de presencia puede sumar 1: se espera a que venza (como arriba).
    await tick(OfficeRoom.idleMs + OfficeRoom.presenceTickMs);
    const before = await repo.getPoints("u-alice");
    repo.ledger.push({ userId: "u-alice", amount: 25, reason: "DAILY", at: Date.now() });

    const url = `http://localhost:${TEST_PORT}${INTERNAL_ROUTES.pointsChanged}`;
    const denied = await fetch(url, { method: "POST", body: JSON.stringify({ userId: "u-alice" }) });
    expect(denied.status).toBe(401);
    const ok = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ userId: "u-alice" }),
    });
    expect(ok.status).toBe(200);
    await room.waitForNextPatch();
    expect(room.state.players.get(alice.sessionId)!.points).toBe(before + 25);
  });
});
