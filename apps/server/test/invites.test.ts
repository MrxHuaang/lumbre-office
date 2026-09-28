import type { ColyseusTestServer } from "@colyseus/testing";
import { MSG, ROOM_NAME, type Invitation, type InviteResult } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, intoOffice, officeTiles, tick, token, until } from "./helpers";

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

/** Alice tiene la oficina 4; Bob y Carla andan por ahí. */
async function setup() {
  const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
  repo.assign("office-4", "u-alice", "Alice");
  await OfficeRoom.reloadOfficesEverywhere();
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
  const carla = await colyseus.connectTo(room, { token: await token("u-carla", "Carla") });
  await room.waitForNextPatch();
  return { room, alice, bob, carla };
}

/** Junta lo que le llega a un cliente de un tipo de mensaje. */
function inbox<T>(client: ClientRoom, type: string): T[] {
  const got: T[] = [];
  client.onMessage(type, (m: T) => got.push(m));
  return got;
}

/** Invita y espera la respuesta del servidor. */
async function invite(from: ClientRoom, results: InviteResult[], toUserId: string): Promise<InviteResult> {
  const before = results.length;
  from.send(MSG.invite, { toUserId });
  await until(() => results.length > before, "la respuesta a la invitación");
  return results.at(-1)!;
}

describe("invitaciones desde Conectados", () => {
  it("Alice invita a Bob a su oficina cerrada: a Bob le llega el aviso y al aceptar lo dejan pasar", async () => {
    const { room, alice, bob } = await setup();
    await intoOffice(alice, room, "office-4");
    alice.send(MSG.officeLock, { locked: true });
    await room.waitForNextPatch();
    const aliceResults = inbox<InviteResult>(alice, MSG.inviteResult);
    const bobInvites = inbox<Invitation>(bob, MSG.inviteRequest);

    expect(await invite(alice, aliceResults, "u-bob")).toEqual({ toUserId: "u-bob", toName: "Bob", outcome: "sent" });
    await until(() => bobInvites.length === 1, "la invitación de Bob");
    const inv = bobInvites[0]!;
    expect(inv).toMatchObject({ fromUserId: "u-alice", fromSessionId: alice.sessionId, fromName: "Alice", place: "office" });
    expect(inv.placeName).not.toBe("");

    // Antes de aceptar, Bob todavía no puede pasar a la oficina cerrada.
    expect(room.state.offices.get("office-4")!.guests.includes("u-bob")).toBe(false);
    bob.send(MSG.inviteRespond, { inviteId: inv.inviteId, accept: true });
    await until(() => aliceResults.length === 2, "el aviso de que Bob aceptó");
    expect(aliceResults[1]).toEqual({ toUserId: "u-bob", toName: "Bob", outcome: "accepted" });
    expect(room.state.offices.get("office-4")!.guests.includes("u-bob")).toBe(true);

    // Ya invitado, Bob entra caminando.
    await intoOffice(bob, room, "office-4");
    const { inside } = officeTiles("office-4");
    const p = room.state.players.get(bob.sessionId)!;
    expect([Math.floor(p.x / 32), Math.floor(p.y / 32)]).toEqual([inside.x, inside.y]);
  });

  it("una invitación por persona cada 30 s, y otra persona sí puede recibir la suya", async () => {
    const { alice } = await setup();
    const results = inbox<InviteResult>(alice, MSG.inviteResult);
    expect((await invite(alice, results, "u-bob")).outcome).toBe("sent");
    expect((await invite(alice, results, "u-bob")).outcome).toBe("too-soon");
    expect((await invite(alice, results, "u-carla")).outcome).toBe("sent");
  });

  it("no se invita a quien no está conectado, ni a uno mismo, ni a quien está en No molestar", async () => {
    const { room, alice, bob } = await setup();
    const results = inbox<InviteResult>(alice, MSG.inviteResult);
    const bobInvites = inbox<Invitation>(bob, MSG.inviteRequest);
    expect(await invite(alice, results, "u-nadie")).toEqual({ toUserId: "u-nadie", toName: "", outcome: "offline" });

    alice.send(MSG.invite, { toUserId: "u-alice" });
    await tick(80);
    expect(results).toHaveLength(1);

    bob.send(MSG.status, { status: "dnd" });
    await until(() => room.state.players.get(bob.sessionId)!.status === "dnd", "el No molestar de Bob");
    expect((await invite(alice, results, "u-bob")).outcome).toBe("dnd");
    expect(bobInvites).toHaveLength(0);
  });

  it("'Ahora no' avisa a quien invitó; fuera de su oficina la invitación es a la sala o a donde está", async () => {
    const { alice, bob, carla } = await setup();
    const results = inbox<InviteResult>(alice, MSG.inviteResult);
    const bobInvites = inbox<Invitation>(bob, MSG.inviteRequest);
    await invite(alice, results, "u-bob");
    await until(() => bobInvites.length === 1, "la invitación");
    expect(["zone", "here"]).toContain(bobInvites[0]!.place);

    // Carla no puede responder por Bob.
    carla.send(MSG.inviteRespond, { inviteId: bobInvites[0]!.inviteId, accept: true });
    await tick(80);
    expect(results).toHaveLength(1);

    bob.send(MSG.inviteRespond, { inviteId: bobInvites[0]!.inviteId, accept: false });
    await until(() => results.length === 2, "el 'Ahora no'");
    expect(results[1]!.outcome).toBe("declined");
    // Una respuesta repetida ya no hace nada.
    bob.send(MSG.inviteRespond, { inviteId: bobInvites[0]!.inviteId, accept: true });
    await tick(80);
    expect(results).toHaveLength(2);
  });
});
