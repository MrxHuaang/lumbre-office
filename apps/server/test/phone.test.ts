import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, phoneInReach } from "@hyvento/map";
import { COMUNICACION, MSG, PHONE, ROOM_NAME, type PhoneEvent } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import { COM_TIMINGS } from "../src/rooms/comunicacion";
import type { OfficeState } from "../src/state";
import { bootServer, c, intoOffice, tick, token, walkToTile, type ServerRoom } from "./helpers";

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
afterEach(() => {
  OfficeRoom.phoneRingMs = PHONE.ringMs;
  COM_TIMINGS.callCooldownMs = COMUNICACION.callCooldownMs;
});

/** Junto al teléfono del escritorio de la oficina 1 (el escritorio va en x 12..13 de la pared norte). */
const PHONE_SPOT = { x: 13, y: 1 };

/** Bob es dueño de la oficina 1 y Alice de la 4; la 2 es de Dora, que no está conectada. */
async function setup() {
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  repo.assign("office-1", "u-bob", "Bob");
  repo.assign("office-4", "u-alice", "Alice");
  repo.assign("office-2", "u-dora", "Dora");
  await OfficeRoom.reloadOfficesEverywhere();
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
  await room.waitForNextPatch();
  return { room, alice, bob };
}

/** Lleva a Bob hasta el teléfono de su oficina. */
async function toPhone(bob: ClientRoom, room: ServerRoom) {
  await intoOffice(bob, room, "office-1");
  await walkToTile(bob, room, PHONE_SPOT.x, PHONE_SPOT.y);
}

/** Junta los avisos del teléfono que le llegan a un cliente. */
function events(client: ClientRoom) {
  const list: PhoneEvent[] = [];
  client.onMessage(MSG.phoneEvent, (e: PhoneEvent) => list.push(e));
  return list;
}

async function settle(room: ServerRoom, ms = 60) {
  await tick(ms);
  await room.waitForNextPatch();
}

const player = (room: ServerRoom, client: ClientRoom) => room.state.players.get(client.sessionId)!;

describe("teléfono entre oficinas", () => {
  it("el teléfono de la oficina está sobre el escritorio y se alcanza desde la silla, no desde el pasillo", () => {
    const piso2 = getWorld().areas.get("piso-2")!;
    const phones = piso2.furniture.filter((f) => f.type === "desk-phone");
    expect(phones).toHaveLength(4);
    expect(phoneInReach(piso2, c(12), c(1))?.x).toBe(13); // la silla del escritorio de la oficina 1
    // La oficina 3 tiene el escritorio pegado a la pared del pasillo: desde afuera no se alcanza.
    const office3 = phones.find((f) => f.y === 14 && f.x < 10)!;
    expect(phoneInReach(piso2, c(office3.x), c(13))).toBeUndefined();
    expect(phoneInReach(getWorld().areas.get("planta-baja")!, c(15), c(22))?.type).toBe("desk-phone-counter");
  });

  it("llamar, sonar, contestar y colgar", async () => {
    const { room, alice, bob } = await setup();
    const toAlice = events(alice);
    const toBob = events(bob);
    await toPhone(bob, room);

    bob.send(MSG.phoneCall, { zoneId: "office-4" });
    await settle(room);
    expect(toAlice).toEqual([expect.objectContaining({ kind: "ringing", withName: "Bob", withUserId: "u-bob", from: "su oficina" })]);
    expect(toBob).toEqual([expect.objectContaining({ kind: "calling", withName: "Alice" })]);
    expect(player(room, alice)).toMatchObject({ call: "ringing", callWith: "u-bob" });
    expect(player(room, bob)).toMatchObject({ call: "calling", callWith: "u-alice" });

    const callId = (toAlice[0] as Extract<PhoneEvent, { kind: "ringing" }>).callId;
    bob.send(MSG.phoneAnswer, { callId, accept: true }); // no es a Bob a quien le suena
    await settle(room);
    expect(player(room, alice).call).toBe("ringing");

    alice.send(MSG.phoneAnswer, { callId, accept: true });
    await settle(room);
    expect(toAlice.at(-1)).toMatchObject({ kind: "connected", withName: "Bob" });
    expect(toBob.at(-1)).toMatchObject({ kind: "connected", withName: "Alice" });
    expect(player(room, alice)).toMatchObject({ call: "talking", callWith: "u-bob" });
    expect(player(room, bob)).toMatchObject({ call: "talking", callWith: "u-alice" });
    expect(player(room, bob).callSince).toBeGreaterThan(0);

    // Hablando, Bob se puede ir del teléfono: la llamada sigue (y Alice cuelga desde donde esté).
    await walkToTile(bob, room, 12, 4);
    expect(player(room, bob).call).toBe("talking");
    alice.send(MSG.phoneHangup);
    await settle(room);
    expect(toBob.at(-1)).toMatchObject({ kind: "ended", reason: "hangup", byMe: false, caller: true });
    expect(toAlice.at(-1)).toMatchObject({ kind: "ended", reason: "hangup", byMe: true, caller: false });
    for (const who of [alice, bob]) expect(player(room, who)).toMatchObject({ call: "", callWith: "", callSince: 0 });
  });

  it("rechazar la llamada: a quien llama le queda que no contestó", async () => {
    const { room, alice, bob } = await setup();
    const toAlice = events(alice);
    const toBob = events(bob);
    await toPhone(bob, room);
    bob.send(MSG.phoneCall, { zoneId: "office-4" });
    await settle(room);
    const callId = (toAlice[0] as Extract<PhoneEvent, { kind: "ringing" }>).callId;
    alice.send(MSG.phoneAnswer, { callId, accept: false });
    await settle(room);
    expect(toBob.at(-1)).toMatchObject({ kind: "ended", reason: "declined", byMe: false });
    expect(player(room, alice).call).toBe("");
  });

  it("si nadie contesta, deja de sonar solo", async () => {
    OfficeRoom.phoneRingMs = 150;
    const { room, alice, bob } = await setup();
    const toAlice = events(alice);
    const toBob = events(bob);
    await toPhone(bob, room);
    bob.send(MSG.phoneCall, { zoneId: "office-4" });
    await settle(room);
    expect(player(room, alice).call).toBe("ringing");
    await settle(room, 250);
    expect(toBob.at(-1)).toMatchObject({ kind: "ended", reason: "timeout", caller: true });
    expect(toAlice.at(-1)).toMatchObject({ kind: "ended", reason: "timeout", caller: false });
    expect(player(room, alice).call).toBe("");
    expect(player(room, bob).call).toBe("");
  });

  it("ocupado: a quien ya está en una llamada no le suena otra, y quien llama no puede llamar dos veces", async () => {
    const { room, alice, bob } = await setup();
    repo.assign("office-3", "u-carol", "Carol");
    await OfficeRoom.reloadOfficesEverywhere();
    const carol = await colyseus.connectTo(room, { token: await token("u-carol", "Carol", "carla") });
    const toCarol = events(carol);
    const toBob = events(bob);
    await toPhone(bob, room);
    bob.send(MSG.phoneCall, { zoneId: "office-4" });
    await settle(room);
    bob.send(MSG.phoneCall, { zoneId: "office-3" });
    await settle(room);
    expect(toBob.at(-1)).toMatchObject({ kind: "failed", error: "in-call" });
    expect(toCarol).toEqual([]);

    // Carol llama a Alice desde la recepción: suena ocupado.
    await intoOffice(carol, room, "office-3"); // pasa por el piso 2: en la planta baja está la recepción
    const piso2 = getWorld().areas.get("piso-2")!;
    const phone3 = piso2.furniture.find((f) => f.type === "desk-phone" && f.y === 14 && f.x < 10)!;
    await walkToTile(carol, room, phone3.x, phone3.y + 1);
    carol.send(MSG.phoneCall, { zoneId: "office-4" });
    await settle(room);
    expect(toCarol.at(-1)).toMatchObject({ kind: "failed", error: "busy", withName: "Alice" });
    expect(player(room, alice).callWith).toBe("u-bob");
  });

  it("no molestar, desconectado, oficina propia y lejos del teléfono", async () => {
    const { room, alice, bob } = await setup();
    const toBob = events(bob);
    const toAlice = events(alice);
    // Lejos de un teléfono (en el jardín, donde se aparece).
    bob.send(MSG.phoneCall, { zoneId: "office-4" });
    await settle(room);
    expect(toBob.at(-1)).toMatchObject({ kind: "failed", error: "far" });

    await toPhone(bob, room);
    alice.send(MSG.status, { status: "dnd" });
    await settle(room);
    bob.send(MSG.phoneCall, { zoneId: "office-4" });
    await settle(room);
    expect(toBob.at(-1)).toMatchObject({ kind: "failed", error: "dnd" });
    expect(toAlice).toEqual([]);

    bob.send(MSG.phoneCall, { zoneId: "office-2" }); // Dora no está conectada
    await settle(room);
    expect(toBob.at(-1)).toMatchObject({ kind: "failed", error: "offline", withName: "Dora" });
    bob.send(MSG.phoneCall, { zoneId: "office-1" });
    await settle(room);
    expect(toBob.at(-1)).toMatchObject({ kind: "failed", error: "self" });
    expect(player(room, bob).call).toBe("");
  });

  it("si una de las dos personas se va, la llamada se corta", async () => {
    const { room, alice, bob } = await setup();
    const toBob = events(bob);
    const toAlice = events(alice);
    await toPhone(bob, room);
    bob.send(MSG.phoneCall, { zoneId: "office-4" });
    await settle(room);
    const callId = (toAlice[0] as Extract<PhoneEvent, { kind: "ringing" }>).callId;
    alice.send(MSG.phoneAnswer, { callId, accept: true });
    await settle(room);
    await alice.leave(true);
    await settle(room);
    expect(toBob.at(-1)).toMatchObject({ kind: "ended", reason: "left" });
    expect(player(room, bob).call).toBe("");
  });

  it("desde el teléfono se llama también a quien no tiene oficina (con las mismas reglas y la pausa)", async () => {
    const { room, alice, bob } = await setup();
    const carol = await colyseus.connectTo(room, { token: await token("u-carol", "Carol", "carla") });
    await room.waitForNextPatch();
    const toBob = events(bob);
    const toCarol = events(carol);
    const toAlice = events(alice);

    // Lejos de un teléfono no se puede.
    alice.send(MSG.phoneCall, { userId: "u-carol" });
    await settle(room);
    expect(toAlice.at(-1)).toMatchObject({ kind: "failed", error: "far" });

    await toPhone(bob, room);
    COM_TIMINGS.callCooldownMs = 0;
    bob.send(MSG.phoneCall, { userId: "u-bob" });
    await settle(room);
    expect(toBob.at(-1)).toMatchObject({ kind: "failed", error: "self" });

    carol.send(MSG.status, { status: "dnd" });
    await settle(room);
    bob.send(MSG.phoneCall, { userId: "u-carol" });
    await settle(room);
    expect(toBob.at(-1)).toMatchObject({ kind: "failed", error: "dnd", withName: "Carol" });
    bob.send(MSG.phoneCall, { userId: "u-nadie" });
    await settle(room);
    expect(toBob.at(-1)).toMatchObject({ kind: "failed", error: "offline" });

    carol.send(MSG.status, { status: "available" });
    await settle(room);
    bob.send(MSG.phoneCall, { userId: "u-carol" });
    await settle(room);
    expect(toCarol.at(-1)).toMatchObject({ kind: "ringing", withName: "Bob", from: "su oficina" });
    expect(player(room, carol)).toMatchObject({ call: "ringing", callWith: "u-bob" });

    // La pausa: Bob cuelga y vuelve a marcar enseguida.
    COM_TIMINGS.callCooldownMs = 60_000;
    bob.send(MSG.phoneHangup);
    await settle(room);
    bob.send(MSG.phoneCall, { userId: "u-carol" });
    await settle(room);
    expect(toBob.at(-1)).toMatchObject({ kind: "failed", error: "too-soon" });
  });
});
