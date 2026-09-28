import type { ColyseusTestServer } from "@colyseus/testing";
import { MSG, ROOM_NAME, type KnockResult } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, goToArea, tick, token, toOfficeDoor, until, walkToTile, type ServerRoom } from "./helpers";

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
});

async function setup({ locked = false } = {}) {
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  repo.assign("office-4", "u-alice", "Alice");
  if (locked) await repo.setOfficeLocked("office-4", true);
  await OfficeRoom.reloadOfficesEverywhere();
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
  await room.waitForNextPatch();
  return { room, alice, bob };
}

const statusOf = (room: ServerRoom, client: ClientRoom) => room.state.players.get(client.sessionId)!.status;

describe("ausente automático", () => {
  it("el navegador inactivo pone Ausente y al volver recupera el estado de antes, sin guardarlo", async () => {
    const { room, alice } = await setup();
    alice.send(MSG.status, { status: "busy" });
    await until(() => statusOf(room, alice) === "busy", "Ocupado");
    alice.send(MSG.idle, { idle: true });
    await until(() => statusOf(room, alice) === "away", "el ausente automático");
    expect(repo.statuses.get("u-alice")).toBe("busy"); // lo automático no va a la base
    alice.send(MSG.idle, { idle: false });
    await until(() => statusOf(room, alice) === "busy", "volver a Ocupado");
  });

  it("si lo puso a mano, se respeta; en No molestar no se toca", async () => {
    const { room, alice, bob } = await setup();
    alice.send(MSG.status, { status: "away" });
    await until(() => statusOf(room, alice) === "away", "Ausente a mano");
    alice.send(MSG.idle, { idle: true });
    alice.send(MSG.idle, { idle: false });
    await tick(100);
    expect(statusOf(room, alice)).toBe("away");

    bob.send(MSG.status, { status: "dnd" });
    await until(() => statusOf(room, bob) === "dnd", "No molestar");
    bob.send(MSG.idle, { idle: true });
    await tick(100);
    expect(statusOf(room, bob)).toBe("dnd");
  });

  it("elegir otro estado mientras está inactivo gana al volver", async () => {
    const { room, alice } = await setup();
    alice.send(MSG.idle, { idle: true });
    await until(() => statusOf(room, alice) === "away", "el ausente automático");
    alice.send(MSG.status, { status: "busy" });
    alice.send(MSG.idle, { idle: false });
    await until(() => statusOf(room, alice) === "busy", "Ocupado");
  });
});

describe("en reunión automático", () => {
  it("con alguien más en la sala de reuniones pasa a En reunión y al salir vuelve", async () => {
    const { room, alice, bob } = await setup();
    alice.send(MSG.status, { status: "busy" });
    await goToArea(alice, room, "piso-2");
    await walkToTile(alice, room, 19, 1);
    await tick(100);
    expect(statusOf(room, alice)).toBe("busy"); // sola en la sala: no es reunión

    await goToArea(bob, room, "piso-2");
    await walkToTile(bob, room, 27, 9);
    await until(() => statusOf(room, alice) === "meeting" && statusOf(room, bob) === "meeting", "En reunión");
    expect(repo.statuses.get("u-alice")).toBe("busy");

    // Inactiva en la reunión: sigue en reunión (está con gente).
    alice.send(MSG.idle, { idle: true });
    await tick(100);
    expect(statusOf(room, alice)).toBe("meeting");
    alice.send(MSG.idle, { idle: false });

    // Bob sale de la sala: los dos recuperan lo de antes.
    await walkToTile(bob, room, 23, 13);
    await until(() => statusOf(room, alice) === "busy" && statusOf(room, bob) === "available", "volver al estado de antes");
  });

  it("elegir un estado a mano en la reunión se respeta hasta salir; No molestar gana", async () => {
    const { room, alice, bob } = await setup();
    await goToArea(alice, room, "piso-2");
    await walkToTile(alice, room, 19, 1);
    await goToArea(bob, room, "piso-2");
    await walkToTile(bob, room, 27, 9);
    await until(() => statusOf(room, alice) === "meeting", "En reunión");

    alice.send(MSG.status, { status: "available" });
    await until(() => statusOf(room, alice) === "available", "Disponible a mano");
    await tick(600); // pasa el tic de la sala: no vuelve a "En reunión"
    expect(statusOf(room, alice)).toBe("available");

    bob.send(MSG.status, { status: "dnd" });
    await until(() => statusOf(room, bob) === "dnd", "No molestar");
  });

  it("si el otro se desconecta, deja de estar en reunión", async () => {
    const { room, alice, bob } = await setup();
    await goToArea(alice, room, "piso-2");
    await walkToTile(alice, room, 19, 1);
    await goToArea(bob, room, "piso-2");
    await walkToTile(bob, room, 27, 9);
    await until(() => statusOf(room, alice) === "meeting", "En reunión");
    await bob.leave(true);
    await until(() => statusOf(room, alice) === "available", "Disponible otra vez");
  });
});

describe("no molestar", () => {
  it("rechaza los toques de puerta de su oficina (el que toca se entera)", async () => {
    const { room, alice, bob } = await setup({ locked: true });
    await toOfficeDoor(bob, room, "office-4");
    let requests = 0;
    alice.onMessage(MSG.knockRequest, () => requests++);
    alice.send(MSG.status, { status: "dnd" });
    await until(() => statusOf(room, alice) === "dnd", "No molestar");

    const results: KnockResult[] = [];
    bob.onMessage(MSG.knockResult, (r: KnockResult) => results.push(r));
    bob.send(MSG.knock, { zoneId: "office-4" });
    await until(() => results.length > 0, "la respuesta al toque");
    expect(results[0]).toMatchObject({ outcome: "dnd", ownerName: "Alice" });
    await tick(50);
    expect(requests).toBe(0);
  });
});
