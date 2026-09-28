import type { ColyseusTestServer } from "@colyseus/testing";
import { MSG, OFFICE_NOTE_MAX, ROOM_NAME, type KnockRequest, type KnockResult, type MoveCorrection, type OfficeRadioResult } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, intoOffice, officeTiles, tick, token, toOfficeDoor, walkToTile } from "./helpers";

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

/** Sala con la oficina 4 asignada a Alice (opcionalmente cerrada) y Bob como visitante. */
async function setup({ locked = false } = {}) {
  const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
  repo.assign("office-4", "u-alice", "Alice");
  if (locked) await repo.setOfficeLocked("office-4", true);
  await OfficeRoom.reloadOfficesEverywhere();
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
  await room.waitForNextPatch();
  return { room, alice, bob };
}

function next<T>(client: ClientRoom, type: string): Promise<T> {
  return new Promise((resolve) => {
    const off = client.onMessage(type, (m: T) => {
      off();
      resolve(m);
    });
  });
}

const zoneOf = (room: { state: OfficeState }, client: ClientRoom) => room.state.players.get(client.sessionId)!.zoneId;

describe("oficinas personales", () => {
  it("crea las oficinas de la cabaña y publica dueño y nombre en el estado", async () => {
    const { room } = await setup();
    // Las cuatro del piso 2 y la del garaje.
    expect([...room.state.offices.keys()].sort()).toEqual(["office-1", "office-2", "office-3", "office-4", "office-5"]);
    const office = room.state.offices.get("office-4")!;
    expect(office.ownerId).toBe("u-alice");
    expect(office.ownerName).toBe("Alice");
    expect(office.locked).toBe(false);
  });

  it("una oficina cerrada bloquea a los visitantes pero no a su dueña", async () => {
    const { room, alice, bob } = await setup({ locked: true });
    const corrections: MoveCorrection[] = [];
    bob.onMessage(MSG.moveCorrection, (m: MoveCorrection) => corrections.push(m));

    await intoOffice(bob, room, "office-4");
    expect(zoneOf(room, bob)).not.toBe("office-4");
    expect(corrections.some((m) => m.area === undefined)).toBe(true);

    await intoOffice(alice, room, "office-4");
    expect(zoneOf(room, alice)).toBe("office-4");
  });

  it("solo la dueña puede cerrar su oficina y quien ya estaba adentro queda como invitado", async () => {
    const { room, alice, bob } = await setup();
    await intoOffice(bob, room, "office-4");
    expect(zoneOf(room, bob)).toBe("office-4");

    bob.send(MSG.officeLock, { locked: true }); // Bob no es dueño de ninguna oficina
    await room.waitForNextPatch();
    expect(room.state.offices.get("office-4")!.locked).toBe(false);

    alice.send(MSG.officeLock, { locked: true });
    await room.waitForNextPatch();
    await tick();
    const office = room.state.offices.get("office-4")!;
    expect(office.locked).toBe(true);
    expect([...office.guests]).toEqual(["u-bob"]);
    expect(repo.offices.get("office-4")!.locked).toBe(true);
  });

  it("la radio de la oficina la pone la dueña; la duración la informa quien está adentro", async () => {
    OfficeRoom.youtubeLookup = async (id) => ({ ok: true, title: `Radio ${id}` });
    const { room, alice, bob } = await setup();
    const errors: OfficeRadioResult[] = [];
    bob.onMessage(MSG.officeRadioResult, (r: OfficeRadioResult) => errors.push(r));
    const office = () => room.state.offices.get("office-4")!;
    bob.send(MSG.officeRadio, { action: "set", url: "https://youtu.be/jfKfPfyJRdk" });
    await tick(60);
    expect(errors).toEqual([{ ok: false, error: "not-owner" }]);
    alice.send(MSG.officeRadio, { action: "set", url: "https://youtu.be/jfKfPfyJRdk" });
    await tick(60);
    await room.waitForNextPatch();
    expect(office()).toMatchObject({ radioVideo: "jfKfPfyJRdk", radioTitle: "Radio jfKfPfyJRdk", radioPaused: false, radioDurationMs: 0 });
    // Desde el pasillo no vale la duración; desde adentro sí (la primera).
    bob.send(MSG.officeRadio, { action: "duration", videoId: "jfKfPfyJRdk", ms: 90_000 });
    await tick(60);
    expect(office().radioDurationMs).toBe(0);
    await intoOffice(bob, room, "office-4");
    bob.send(MSG.officeRadio, { action: "duration", videoId: "jfKfPfyJRdk", ms: 90_000 });
    bob.send(MSG.officeRadio, { action: "duration", videoId: "jfKfPfyJRdk", ms: 5 });
    await tick(60);
    await room.waitForNextPatch();
    expect(office().radioDurationMs).toBe(90_000);
    alice.send(MSG.officeRadio, { action: "pause" });
    await tick(60);
    await room.waitForNextPatch();
    expect(office().radioPaused).toBe(true);
    alice.send(MSG.officeRadio, { action: "stop" });
    await tick(60);
    await room.waitForNextPatch();
    expect(office().radioVideo).toBe("");
  });

  it("la nota de la placa la pone solo la dueña, en una línea corta", async () => {
    const { room, alice, bob } = await setup();
    bob.send(MSG.officeNote, { note: "Pasen" });
    await room.waitForNextPatch();
    expect(room.state.offices.get("office-4")!.note).toBe("");
    alice.send(MSG.officeNote, { note: "  Vuelvo   a las\n3  " });
    await room.waitForNextPatch();
    expect(room.state.offices.get("office-4")!.note).toBe("Vuelvo a las 3");
    alice.send(MSG.officeNote, { note: "x".repeat(OFFICE_NOTE_MAX + 20) });
    await room.waitForNextPatch();
    expect(room.state.offices.get("office-4")!.note).toHaveLength(OFFICE_NOTE_MAX);
    alice.send(MSG.officeNote, { note: "" });
    await room.waitForNextPatch();
    expect(room.state.offices.get("office-4")!.note).toBe("");
  });

  it("tocar la puerta: si la dueña acepta, el visitante entra; al salir pierde el permiso", async () => {
    const { room, alice, bob } = await setup({ locked: true });
    await toOfficeDoor(bob, room, "office-4");

    const requestP = next<KnockRequest>(alice, MSG.knockRequest);
    bob.send(MSG.knock, { zoneId: "office-4" });
    const request = await requestP;
    expect(request.fromName).toBe("Bob");

    const resultP = next<KnockResult>(bob, MSG.knockResult);
    alice.send(MSG.knockRespond, { requestId: request.requestId, accept: true });
    expect((await resultP).outcome).toBe("accepted");

    const { inside, outside } = officeTiles("office-4");
    await walkToTile(bob, room, inside.x, inside.y);
    expect(zoneOf(room, bob)).toBe("office-4");

    // Dos pasos hacia el pasillo, alejándose de la puerta.
    await walkToTile(bob, room, 2 * outside.x - inside.x, 2 * outside.y - inside.y);
    expect([...room.state.offices.get("office-4")!.guests]).toEqual([]);
    await walkToTile(bob, room, inside.x, inside.y);
    expect(zoneOf(room, bob)).not.toBe("office-4");
  });

  it("tocar la puerta: rechazo, dueña ausente y oficina abierta", async () => {
    const { room, alice, bob } = await setup({ locked: true });

    const requestP = next<KnockRequest>(alice, MSG.knockRequest);
    bob.send(MSG.knock, { zoneId: "office-4" });
    const request = await requestP;
    const declinedP = next<KnockResult>(bob, MSG.knockResult);
    alice.send(MSG.knockRespond, { requestId: request.requestId, accept: false });
    expect((await declinedP).outcome).toBe("declined");

    // Tocar de nuevo enseguida: demasiado pronto.
    const tooSoonP = next<KnockResult>(bob, MSG.knockResult);
    bob.send(MSG.knock, { zoneId: "office-4" });
    expect((await tooSoonP).outcome).toBe("too-soon");

    // Oficina de alguien que no está conectado.
    repo.assign("office-1", "u-carol", "Carol");
    await repo.setOfficeLocked("office-1", true);
    await OfficeRoom.reloadOfficesEverywhere();
    const awayP = next<KnockResult>(bob, MSG.knockResult);
    bob.send(MSG.knock, { zoneId: "office-1" });
    expect((await awayP).outcome).toBe("owner-away");

    // Oficina abierta: no hace falta tocar.
    alice.send(MSG.officeLock, { locked: false });
    await room.waitForNextPatch();
    repo.assign("office-2", "u-alice-2", "Otra");
    const openP = next<KnockResult>(bob, MSG.knockResult);
    bob.send(MSG.knock, { zoneId: "office-4" });
    await tick(10);
    expect((await openP).outcome).toBe("not-locked");
  });

  it("solo la dueña puede responder un toque", async () => {
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    repo.assign("office-4", "u-alice", "Alice");
    await repo.setOfficeLocked("office-4", true);
    await OfficeRoom.reloadOfficesEverywhere();
    const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob") });
    const eve = await colyseus.connectTo(room, { token: await token("u-eve", "Eve") });

    const requestP = next<KnockRequest>(alice, MSG.knockRequest);
    bob.send(MSG.knock, { zoneId: "office-4" });
    const request = await requestP;
    eve.send(MSG.knockRespond, { requestId: request.requestId, accept: true }); // no es la dueña
    await room.waitForNextPatch();
    await tick();
    expect([...room.state.offices.get("office-4")!.guests]).toEqual([]);
  });

  it("los cambios de dueño hechos desde la web se reflejan al recargar las oficinas", async () => {
    const { room } = await setup({ locked: true });
    repo.assign("office-4", "u-bob", "Bob");
    await OfficeRoom.reloadOfficesEverywhere();
    await room.waitForNextPatch();
    const office = room.state.offices.get("office-4")!;
    expect(office.ownerName).toBe("Bob");
    expect([...office.guests]).toEqual([]);

    repo.assign("office-4", null, null);
    await OfficeRoom.reloadOfficesEverywhere();
    expect(room.state.offices.get("office-4")!.locked).toBe(false); // sin dueño no puede estar cerrada
  });
});
