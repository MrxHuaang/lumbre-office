import type { ColyseusTestServer } from "@colyseus/testing";
import { DOOR_NOTES, INTERNAL_ROUTES, MSG, ROOM_NAME, type DoorNoteResult } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, SECRET, TEST_PORT, tick, token, toOfficeDoor } from "./helpers";

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

/** Sala con la oficina 4 de Alice (y la 3 sin dueño); Bob viene de visita. */
async function setup() {
  const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
  repo.assign("office-4", "u-alice", "Alice");
  await OfficeRoom.reloadOfficesEverywhere();
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
  await room.waitForNextPatch();
  return { room, alice, bob };
}

/** Deja una nota y espera la respuesta del servidor. */
function leave(client: ClientRoom, zoneId: string, text: string): Promise<DoorNoteResult> {
  return new Promise((resolve) => {
    const off = client.onMessage(MSG.doorNoteResult, (r: DoorNoteResult) => {
      off();
      resolve(r);
    });
    client.send(MSG.doorNote, { zoneId, text });
  });
}

describe("notas en la puerta", () => {
  it("frente a la puerta se deja una nota para la dueña y la puerta cuenta las sin leer", async () => {
    const { room, bob } = await setup();
    await toOfficeDoor(bob, room, "office-4");
    const res = await leave(bob, "office-4", "  Pasé a devolverte   el libro  ");
    expect(res).toEqual({ ok: true, zoneId: "office-4", ownerName: "Alice", left: DOOR_NOTES.perDay - 1 });
    expect(repo.doorNotes).toMatchObject([{ fromId: "u-bob", toId: "u-alice", zoneId: "office-4", text: "Pasé a devolverte el libro", read: false }]);
    await room.waitForNextPatch();
    expect(room.state.offices.get("office-4")!.notes).toBe(1);
  });

  it("lejos de la puerta, sin texto, en tu propia oficina o en una sin dueño no se deja", async () => {
    const { room, alice, bob } = await setup();
    expect(await leave(bob, "office-4", "Hola")).toEqual({ ok: false, zoneId: "office-4", error: "far" });
    await toOfficeDoor(bob, room, "office-4");
    expect(await leave(bob, "office-4", "   \n  ")).toEqual({ ok: false, zoneId: "office-4", error: "empty" });
    expect(await leave(bob, "office-3", "Hola")).toEqual({ ok: false, zoneId: "office-3", error: "no-owner" });
    await toOfficeDoor(alice, room, "office-4");
    expect(await leave(alice, "office-4", "Nota para mí")).toEqual({ ok: false, zoneId: "office-4", error: "own" });
    expect(repo.doorNotes).toHaveLength(0);
  });

  it("hay un tope de notas por persona y por día", async () => {
    const { room, bob } = await setup();
    for (let i = 0; i < DOOR_NOTES.perDay - 1; i++)
      repo.doorNotes.push({ id: `vieja-${i}`, fromId: "u-bob", toId: "u-otra", zoneId: "office-1", text: "x", at: Date.now(), read: false });
    // Una de ayer no cuenta.
    repo.doorNotes.push({ id: "ayer", fromId: "u-bob", toId: "u-otra", zoneId: "office-1", text: "x", at: Date.now() - 2 * 86_400_000, read: false });
    await toOfficeDoor(bob, room, "office-4");
    expect(await leave(bob, "office-4", "La última de hoy")).toMatchObject({ ok: true, left: 0 });
    expect(await leave(bob, "office-4", "Una más")).toEqual({ ok: false, zoneId: "office-4", error: "limit" });
    expect(repo.doorNotes.filter((n) => n.toId === "u-alice")).toHaveLength(1);
  });

  it("al cargar las oficinas cuenta las notas sin leer, y el aviso de la web las vuelve a contar", async () => {
    repo.doorNotes.push({ id: "n1", fromId: "u-bob", toId: "u-alice", zoneId: "office-4", text: "a", at: Date.now(), read: false });
    repo.doorNotes.push({ id: "n2", fromId: "u-bob", toId: "u-alice", zoneId: "office-4", text: "b", at: Date.now(), read: true });
    const { room } = await setup();
    expect(room.state.offices.get("office-4")!.notes).toBe(1);

    // Alice las leyó desde la web.
    for (const n of repo.doorNotes) n.read = true;
    const post = (secret: string) =>
      fetch(`http://localhost:${TEST_PORT}${INTERNAL_ROUTES.doorNotesChanged}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "u-alice" }),
      });
    expect((await post("otro")).status).toBe(401);
    expect(room.state.offices.get("office-4")!.notes).toBe(1);
    expect((await post(SECRET)).status).toBe(200);
    await tick();
    expect(room.state.offices.get("office-4")!.notes).toBe(0);
  });
});
