import type { ColyseusTestServer } from "@colyseus/testing";
import {
  COM_MSG,
  COMUNICACION,
  MSG,
  ROOM_NAME,
  type Announcement,
  type AnnounceResult,
  type BroadcastEvent,
  type PhoneEvent,
  type WaveEvent,
  type WaveResult,
} from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, tick, token, until, type ServerRoom } from "./helpers";

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
  OfficeRoom.callCooldownMs = 0;
});
afterEach(() => {
  OfficeRoom.callCooldownMs = COMUNICACION.callCooldownMs;
  OfficeRoom.waveCooldownMs = COMUNICACION.waveCooldownMs;
  OfficeRoom.broadcastMaxMs = COMUNICACION.broadcastMaxMs;
});

const NAMES = ["Ana", "Bob", "Carla", "Dani", "Eva", "Fede", "Gabo"] as const;

/** Gente conectada sin oficina, todos en el jardín (donde se aparece). `admin` = la primera es admin. */
async function setup(n: number, opts: { admin?: boolean } = {}) {
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const people: ClientRoom[] = [];
  for (let i = 0; i < n; i++) {
    const name = NAMES[i]!;
    const role = opts.admin && i === 0 ? "ADMIN" : "MEMBER";
    people.push(await colyseus.connectTo(room, { token: await token(`u-${name.toLowerCase()}`, name, "ada", role) }));
  }
  await room.waitForNextPatch();
  return { room, people };
}

const uid = (i: number) => `u-${NAMES[i]!.toLowerCase()}`;

function collect<T>(client: ClientRoom, type: string) {
  const list: T[] = [];
  client.onMessage(type, (e: T) => list.push(e));
  return list;
}

const phoneEvents = (client: ClientRoom) => collect<PhoneEvent>(client, MSG.phoneEvent);

async function settle(room: ServerRoom, ms = 60) {
  await tick(ms);
  await room.waitForNextPatch();
}

const player = (room: ServerRoom, client: ClientRoom) => room.state.players.get(client.sessionId)!;

const ringingId = (list: PhoneEvent[]) => {
  const e = [...list].reverse().find((x) => x.kind === "ringing");
  if (!e || e.kind !== "ringing") throw new Error("no le sonó");
  return e.callId;
};

describe("llamar sin teléfono", () => {
  it("a cualquiera conectado, desde donde sea: suena, contesta y se oyen con el mismo callId", async () => {
    const { room, people } = await setup(2);
    const [ana, bob] = people as [ClientRoom, ClientRoom];
    const toBob = phoneEvents(bob);
    const toAna = phoneEvents(ana);
    ana.send(COM_MSG.call, { userId: uid(1) });
    await until(() => toBob.length > 0, "que le suene a Bob");
    expect(toBob[0]).toMatchObject({ kind: "ringing", withName: "Ana", withUserId: uid(0), from: "su celular" });
    expect(toAna.at(-1)).toMatchObject({ kind: "calling", withName: "Bob" });
    expect(player(room, bob)).toMatchObject({ call: "ringing", callWith: uid(0) });

    bob.send(MSG.phoneAnswer, { callId: ringingId(toBob), accept: true });
    await settle(room);
    expect(player(room, ana)).toMatchObject({ call: "talking", callWith: uid(1) });
    expect(player(room, bob).call).toBe("talking");
    expect(player(room, ana).callId).not.toBe("");
    expect(player(room, ana).callId).toBe(player(room, bob).callId);

    bob.send(MSG.phoneHangup);
    await settle(room);
    expect(toAna.at(-1)).toMatchObject({ kind: "ended", reason: "hangup", byMe: false });
    for (const who of [ana, bob]) expect(player(room, who)).toMatchObject({ call: "", callWith: "", callId: "" });
  });

  it("no molestar, desconectado, a sí mismo, ocupado y la pausa entre llamadas", async () => {
    const { room, people } = await setup(3);
    const [ana, bob, carla] = people as [ClientRoom, ClientRoom, ClientRoom];
    const toAna = phoneEvents(ana);
    const toBob = phoneEvents(bob);

    bob.send(MSG.status, { status: "dnd" });
    await settle(room);
    ana.send(COM_MSG.call, { userId: uid(1) });
    await until(() => toAna.length > 0);
    expect(toAna.at(-1)).toMatchObject({ kind: "failed", error: "dnd", withName: "Bob" });
    expect(toBob).toEqual([]);

    ana.send(COM_MSG.call, { userId: "u-nadie" });
    await until(() => toAna.length > 1);
    expect(toAna.at(-1)).toMatchObject({ kind: "failed", error: "offline" });
    ana.send(COM_MSG.call, { userId: uid(0) });
    await until(() => toAna.length > 2);
    expect(toAna.at(-1)).toMatchObject({ kind: "failed", error: "self" });

    // Carla está en una llamada con Ana: Bob (ya disponible) oye ocupado.
    bob.send(MSG.status, { status: "available" });
    carla.send(COM_MSG.call, { userId: uid(0) });
    await settle(room);
    bob.send(COM_MSG.call, { userId: uid(0) });
    await until(() => toBob.some((e) => e.kind === "failed"));
    expect(toBob.at(-1)).toMatchObject({ kind: "failed", error: "busy", withName: "Ana" });

    // La pausa: quien acaba de llamar no puede volver a marcar enseguida.
    OfficeRoom.callCooldownMs = 60_000;
    const toCarla = phoneEvents(carla);
    carla.send(MSG.phoneHangup);
    await settle(room);
    carla.send(COM_MSG.call, { userId: uid(1) });
    await until(() => toCarla.some((e) => e.kind === "failed"));
    expect(toCarla.at(-1)).toMatchObject({ kind: "failed", error: "too-soon" });
    expect(player(room, bob).call).toBe("");
  });
});

describe("llamadas grupales", () => {
  it("se suma gente hasta el cupo, todos quedan en la misma llamada y colgar saca solo a quien cuelga", async () => {
    const { room, people } = await setup(7);
    const [ana, bob, carla, dani, eva, fede, gabo] = people as ClientRoom[] as [ClientRoom, ClientRoom, ClientRoom, ClientRoom, ClientRoom, ClientRoom, ClientRoom];
    const ev = people.map(phoneEvents);

    ana.send(COM_MSG.call, { userId: uid(1) });
    await until(() => ev[1]!.length > 0);
    bob.send(MSG.phoneAnswer, { callId: ringingId(ev[1]!), accept: true });
    await settle(room);

    // Ana suma a Carla: le suena con los que ya están hablando.
    ana.send(COM_MSG.add, { userId: uid(2) });
    await until(() => ev[2]!.length > 0, "que le suene a Carla");
    const ring = ev[2]![0]!;
    expect(ring).toMatchObject({ kind: "ringing", withName: "Ana" });
    expect(ring.kind === "ringing" && ring.members?.map((m) => m.name).sort()).toEqual(["Ana", "Bob"]);
    await until(() => ev[1]!.some((e) => e.kind === "member" && e.change === "invited"), "que Bob sepa que le suena a Carla");
    carla.send(MSG.phoneAnswer, { callId: ringingId(ev[2]!), accept: true });
    await settle(room);
    const callId = player(room, ana).callId;
    for (const who of [ana, bob, carla]) expect(player(room, who)).toMatchObject({ call: "talking", callId });
    expect(ev[1]!.some((e) => e.kind === "member" && e.change === "joined" && e.name === "Carla")).toBe(true);
    const last = ev[0]!.at(-1)!;
    expect(last.kind === "connected" && last.members?.map((m) => m.name).sort()).toEqual(["Bob", "Carla"]);

    // Bob suma a Dani, Eva y Fede (les suena): son 6 con el cupo lleno y Gabo ya no cabe.
    for (const i of [3, 4, 5]) bob.send(COM_MSG.add, { userId: uid(i) });
    await until(() => [3, 4, 5].every((i) => ev[i]!.length > 0), "que les suene a los tres");
    bob.send(COM_MSG.add, { userId: uid(6) });
    await until(() => ev[1]!.some((e) => e.kind === "failed"));
    expect(ev[1]!.at(-1)).toMatchObject({ kind: "failed", error: "full" });
    expect(ev[6]).toEqual([]);
    expect(player(room, gabo).call).toBe("");

    // Sumar sin estar hablando no se puede (Dani todavía no contesta).
    dani.send(COM_MSG.add, { userId: uid(6) });
    await until(() => ev[3]!.some((e) => e.kind === "failed"));
    expect(ev[3]!.at(-1)).toMatchObject({ kind: "failed", error: "not-in-call" });

    // Eva no quiere; Fede contesta.
    eva.send(MSG.phoneAnswer, { callId: ringingId(ev[4]!), accept: false });
    fede.send(MSG.phoneAnswer, { callId: ringingId(ev[5]!), accept: true });
    await settle(room);
    expect(player(room, eva).call).toBe("");
    expect(player(room, fede)).toMatchObject({ call: "talking", callId });

    // Bob cuelga: sale solo él.
    bob.send(MSG.phoneHangup);
    await settle(room);
    expect(player(room, bob)).toMatchObject({ call: "", callId: "" });
    for (const who of [ana, carla, fede]) expect(player(room, who)).toMatchObject({ call: "talking", callId });
    expect(ev[0]!.some((e) => e.kind === "member" && e.change === "left" && e.name === "Bob")).toBe(true);

    // Carla y Fede cuelgan: con Ana sola, la llamada termina (y a Dani, que seguía sonando, se le corta).
    carla.send(MSG.phoneHangup);
    await settle(room);
    expect(player(room, ana).call).toBe("talking");
    fede.send(MSG.phoneHangup);
    await settle(room);
    for (const who of [ana, dani]) expect(player(room, who)).toMatchObject({ call: "", callId: "" });
    expect(ev[0]!.at(-1)).toMatchObject({ kind: "ended", reason: "hangup", withName: "Fede" });
    expect(ev[3]!.at(-1)).toMatchObject({ kind: "ended", reason: "declined" });
  });
});

describe("saludar", () => {
  it("le llega el toque, con pausa por par de personas y sin molestar a quien está en No molestar", async () => {
    OfficeRoom.waveCooldownMs = 200;
    const { room, people } = await setup(3);
    const [ana, bob, carla] = people as [ClientRoom, ClientRoom, ClientRoom];
    const toBob = collect<WaveEvent>(bob, COM_MSG.waved);
    const anaResults = collect<WaveResult>(ana, COM_MSG.waveResult);

    ana.send(COM_MSG.wave, { userId: uid(1) });
    await until(() => toBob.length === 1 && anaResults.length === 1);
    expect(toBob[0]).toMatchObject({ fromUserId: uid(0), fromName: "Ana", fromSessionId: ana.sessionId });
    expect(anaResults[0]).toMatchObject({ outcome: "sent", toName: "Bob" });

    ana.send(COM_MSG.wave, { userId: uid(1) });
    await until(() => anaResults.length === 2);
    expect(anaResults[1]!.outcome).toBe("too-soon");
    expect(toBob).toHaveLength(1);

    // La pausa es por par: a Carla sí la puede saludar ya.
    ana.send(COM_MSG.wave, { userId: uid(2) });
    await until(() => anaResults.length === 3);
    expect(anaResults[2]!.outcome).toBe("sent");

    // Pasada la pausa vuelve a poder, salvo que Bob esté en "No molestar".
    bob.send(MSG.status, { status: "dnd" });
    await settle(room, 250);
    ana.send(COM_MSG.wave, { userId: uid(1) });
    await until(() => anaResults.length === 4);
    expect(anaResults[3]!.outcome).toBe("dnd");
    expect(toBob).toHaveLength(1);

    ana.send(COM_MSG.wave, { userId: uid(0) });
    ana.send(COM_MSG.wave, { userId: "u-nadie" });
    await until(() => anaResults.length === 6);
    expect(anaResults.slice(4).map((r) => r.outcome)).toEqual(["self", "offline"]);
    void carla;
  });
});

describe("anuncio a toda la cabaña", () => {
  it("solo un admin: el aviso de texto le llega a todos", async () => {
    const { room, people } = await setup(3, { admin: true });
    const [admin, bob, carla] = people as [ClientRoom, ClientRoom, ClientRoom];
    const seen = people.map((p) => collect<Announcement>(p, COM_MSG.announcement));
    const bobErrors = collect<AnnounceResult>(bob, COM_MSG.announceResult);
    const adminErrors = collect<AnnounceResult>(admin, COM_MSG.announceResult);

    bob.send(COM_MSG.announce, { text: "Hola a todos" });
    bob.send(COM_MSG.broadcastStart);
    await until(() => bobErrors.length === 2);
    expect(bobErrors.map((e) => e.error)).toEqual(["admin", "admin"]);
    expect(player(room, bob).broadcastUntil).toBe(0);

    admin.send(COM_MSG.announce, { text: "  Reunión general\n en 5 minutos  " });
    await until(() => seen.every((s) => s.length === 1), "que el aviso le llegue a todos");
    expect(seen[2]![0]).toMatchObject({ fromName: "Ana", text: "Reunión general en 5 minutos" });

    admin.send(COM_MSG.announce, { text: "otro" });
    admin.send(COM_MSG.announce, { text: "   " });
    await until(() => adminErrors.length === 2);
    expect(adminErrors.map((e) => e.error).sort()).toEqual(["empty", "too-soon"]);
    void carla;
  });

  it("la voz: todos saben quién anuncia, el papel queda en el estado y se corta solo al llegar al tope", async () => {
    OfficeRoom.broadcastMaxMs = 300;
    const { room, people } = await setup(2, { admin: true });
    const [admin, bob] = people as [ClientRoom, ClientRoom];
    const toBob = collect<BroadcastEvent>(bob, COM_MSG.broadcastEvent);
    const toAdmin = collect<BroadcastEvent>(admin, COM_MSG.broadcastEvent);

    admin.send(COM_MSG.broadcastStart);
    await until(() => toBob.length === 1 && toAdmin.length === 1);
    expect(toBob[0]).toMatchObject({ kind: "start", userId: uid(0), name: "Ana" });
    await room.waitForNextPatch();
    expect(player(room, admin).broadcastUntil).toBeGreaterThan(Date.now());
    expect(player(room, bob).broadcastUntil).toBe(0);

    await until(() => toBob.length === 2, "que se corte al llegar al tope", 2000);
    expect(toBob[1]).toMatchObject({ kind: "end", reason: "timeout", name: "Ana" });
    await room.waitForNextPatch();
    expect(player(room, admin).broadcastUntil).toBe(0);
  });

  it("uno a la vez, terminar a mano y se corta si quien anuncia se va", async () => {
    const { room, people } = await setup(2, { admin: true });
    const [admin, bob] = people as [ClientRoom, ClientRoom];
    const toBob = collect<BroadcastEvent>(bob, COM_MSG.broadcastEvent);
    const other = await colyseus.connectTo(room, { token: await token("u-otra", "Otra", "ada", "ADMIN") });
    const otherErrors = collect<AnnounceResult>(other, COM_MSG.announceResult);

    admin.send(COM_MSG.broadcastStart);
    await until(() => toBob.length === 1);
    other.send(COM_MSG.broadcastStart);
    await until(() => otherErrors.length === 1);
    expect(otherErrors[0]).toMatchObject({ error: "busy", name: "Ana" });

    // Bob no puede terminar el anuncio de otro.
    bob.send(COM_MSG.broadcastStop);
    admin.send(COM_MSG.broadcastStop);
    await until(() => toBob.length === 2);
    expect(toBob[1]).toMatchObject({ kind: "end", reason: "stop" });

    other.send(COM_MSG.broadcastStart);
    await until(() => toBob.length === 3);
    await other.leave(true);
    await until(() => toBob.length === 4);
    expect(toBob[3]).toMatchObject({ kind: "end", reason: "left", name: "Otra" });
  });
});
