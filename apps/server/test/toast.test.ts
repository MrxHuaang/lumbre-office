import type { ColyseusTestServer } from "@colyseus/testing";
import { drinkPart, MSG, ROOM_NAME, TOAST, usesOf, type ToastEvent, type ToastResult, type ToastSip } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import type { HeldItems } from "../src/rooms/consumables";
import type { Drunkenness } from "../src/rooms/drunk";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import { Toasts, type Toaster } from "../src/rooms/toasts";
import type { OfficeState } from "../src/state";
import { bootServer, c, tick, token, type ServerRoom } from "./helpers";

// ---------- Reglas (sin sala) ----------

/** Reloj falso: la hora avanza a mano y los temporizadores se disparan cuando les toca. */
function fakeTime() {
  let now = 1_000_000;
  const timers: { at: number; fn: () => void; cleared: boolean }[] = [];
  return {
    now: () => now,
    clock: {
      setTimeout(fn: () => void, ms: number) {
        const t = { at: now + ms, fn, cleared: false };
        timers.push(t);
        return { clear: () => void (t.cleared = true) };
      },
    },
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const next = timers.filter((t) => !t.cleared && t.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        next.cleared = true;
        now = next.at;
        next.fn();
      }
      now = end;
    },
  };
}

/** Gente en tiles (x, y) del nivel "club"; `drink` si lleva una bebida. */
function setup() {
  const time = fakeTime();
  const people = new Map<string, Toaster>();
  const events: ToastEvent[] = [];
  const sips: string[] = [];
  const toasts = new Toasts(time.clock, time.now, {
    person: (u) => people.get(u),
    people: (area) => [...people.values()].filter((p) => p.area === area),
    send: (_area, e) => events.push(e),
    sip: (u): ToastSip => {
      sips.push(u);
      return { sessionId: `s-${u}`, part: 0, left: 2 };
    },
  });
  const put = (userId: string, tx: number, ty: number, drink = true, area = "club") =>
    people.set(userId, { userId, sessionId: `s-${userId}`, area, x: c(tx), y: c(ty), drink });
  return { time, toasts, people, events, sips, put };
}

describe("brindis (reglas)", () => {
  it("la mano de la bebida: en un combo, la del tinto y no la del cigarro", () => {
    expect(drinkPart("cerveza", [5])).toBe(0);
    expect(drinkPart("desayuno-tinto", [3, 5])).toBe(0);
    expect(drinkPart("desayuno-tinto", [0, 5])).toBe(-1); // se acabó el tinto: queda el cigarro
    expect(drinkPart("pandebono", [3])).toBe(-1);
    expect(drinkPart("", [])).toBe(-1);
  });

  it("sin bebida no se brinda, y hace falta alguien cerca con otra", () => {
    const { toasts, put, events } = setup();
    put("a", 5, 5, false);
    put("b", 6, 5);
    expect(toasts.raise("a")).toEqual({ ok: false, error: "no-drink" });
    put("a", 5, 5);
    put("b", 6, 5, false); // cerca pero sin bebida
    expect(toasts.raise("a")).toEqual({ ok: false, error: "alone" });
    put("b", 5 + TOAST.reachTiles + 1, 5); // con bebida pero lejos
    expect(toasts.raise("a")).toEqual({ ok: false, error: "alone" });
    put("b", 5, 6, true, "otro-nivel"); // al lado, pero en otro nivel
    expect(toasts.raise("a")).toEqual({ ok: false, error: "alone" });
    expect(events).toEqual([]);
  });

  it("si el otro también brinda, chocan los vasos y cada uno toma un sorbo", () => {
    const { toasts, put, events, sips, time } = setup();
    put("a", 5, 5);
    put("b", 7, 5);
    expect(toasts.raise("a")).toMatchObject({ ok: true, kind: "invite" });
    expect(events.at(-1)).toMatchObject({ kind: "invite", sessionId: "s-a", expiresInMs: TOAST.windowMs });
    time.advance(2000);
    expect(toasts.raise("b")).toMatchObject({ ok: true, kind: "join" });
    expect(events.at(-1)).toMatchObject({ kind: "join", sessionId: "s-b" });
    // Se espera un poco por si alguien más se suma, y chocan.
    time.advance(TOAST.joinGraceMs);
    expect(events.at(-1)).toMatchObject({ kind: "clink", sips: [{ sessionId: "s-a" }, { sessionId: "s-b" }] });
    expect(sips.sort()).toEqual(["a", "b"]);
    // Nadie queda en un brindis y no se repite enseguida.
    expect(toasts.toastOf("a")).toBeUndefined();
    expect(toasts.raise("a")).toEqual({ ok: false, error: "busy" });
    expect(toasts.raise("b")).toEqual({ ok: false, error: "busy" });
  });

  it("si nadie responde se vence y el que invitó brinda solo", () => {
    const { toasts, put, events, sips, time } = setup();
    put("a", 5, 5);
    put("b", 6, 5);
    toasts.raise("a");
    time.advance(TOAST.windowMs - 1);
    expect(events.map((e) => e.kind)).toEqual(["invite"]);
    time.advance(1);
    expect(events.at(-1)).toEqual({ kind: "solo", id: expect.any(String), sessionId: "s-a" });
    expect(sips).toEqual([]); // brindar solo no gasta el sorbo
  });

  it("hay una pausa entre invitaciones de la misma persona (~20 s)", () => {
    const { toasts, put, time } = setup();
    put("a", 5, 5);
    put("b", 6, 5);
    toasts.raise("a");
    expect(toasts.raise("a")).toEqual({ ok: false, error: "busy" }); // ya está brindando
    time.advance(TOAST.windowMs);
    expect(toasts.raise("a")).toEqual({ ok: false, error: "busy" });
    time.advance(TOAST.cooldownMs - TOAST.windowMs);
    expect(toasts.raise("a")).toMatchObject({ ok: true, kind: "invite" });
  });

  it("brindis de grupo: los de al lado que se suman a tiempo brindan todos", () => {
    const { toasts, put, events, sips, time } = setup();
    put("a", 5, 5);
    put("b", 6, 5);
    put("c", 5, 7);
    put("d", 7, 7);
    put("lejos", 15, 15);
    toasts.raise("a");
    toasts.raise("b");
    time.advance(TOAST.joinGraceMs / 2);
    // Se suma quien esté cerca de cualquiera del grupo: d está lejos de a y de b, pero a 2 de c.
    expect(toasts.raise("c")).toMatchObject({ kind: "join" });
    expect(toasts.raise("d")).toMatchObject({ kind: "join" });
    // El que está lejos no se suma: invita (y no hay nadie cerca de él).
    expect(toasts.raise("lejos")).toEqual({ ok: false, error: "alone" });
    time.advance(TOAST.joinGraceMs);
    const clink = events.find((e) => e.kind === "clink");
    expect(clink && clink.kind === "clink" && clink.sips.map((s) => s.sessionId).sort()).toEqual(["s-a", "s-b", "s-c", "s-d"]);
    expect(sips).toHaveLength(4);
  });

  it("quien se quedó sin bebida o se alejó no choca; si queda uno solo, brinda solo", () => {
    const { toasts, put, events, sips, time } = setup();
    put("a", 5, 5);
    put("b", 6, 5);
    toasts.raise("a");
    toasts.raise("b");
    put("b", 20, 20); // se fue
    time.advance(TOAST.windowMs);
    expect(events.at(-1)).toMatchObject({ kind: "solo", sessionId: "s-a" });
    expect(sips).toEqual([]);
  });
});

// ---------- En la sala: el sorbo sale de la mano y suma alcohol ----------

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
  OfficeRoom.toastTimings = { windowMs: 400, joinGraceMs: 100, cooldownMs: 1000 };
});
afterEach(() => {
  OfficeRoom.toastTimings = { ...TOAST };
});

/** Lo de la sala que el test toca por dentro (dar algo en la mano, mirar la borrachera). */
type RoomInside = { held: HeldItems; drunk: Drunkenness };

async function inRoom() {
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
  await room.waitForNextPatch();
  const inside = room as unknown as RoomInside;
  const events: ToastEvent[] = [];
  const results: ToastResult[] = [];
  bob.onMessage(MSG.toastEvent, (e: ToastEvent) => events.push(e));
  alice.onMessage(MSG.toastEvent, () => {});
  alice.onMessage(MSG.toastResult, (r: ToastResult) => results.push(r));
  bob.onMessage(MSG.toastResult, () => {});
  // Los dos juntos en el jardín (donde aparecen), uno al lado del otro.
  const place = (client: ClientRoom, dx: number) => {
    const p = room.state.players.get(client.sessionId)!;
    const a = room.state.players.get(alice.sessionId)!;
    p.x = a.x + dx;
    p.y = a.y;
  };
  place(bob, 32);
  return { room, alice, bob, inside, events, results };
}

describe("brindis en la sala", () => {
  it("sin bebida responde por qué no", async () => {
    const { room, alice, results } = await inRoom();
    alice.send(MSG.toast);
    await tick(60);
    await room.waitForNextPatch();
    expect(results).toEqual([{ ok: false, error: "no-drink" }]);
  });

  it("brindan los dos: cada uno toma un sorbo de su vaso y el alcohol cuenta", async () => {
    const { room, alice, bob, inside, events } = await inRoom();
    inside.held.give("u-alice", "whisky");
    inside.held.give("u-bob", "desayuno-tinto"); // en el combo, brinda con el tinto
    await room.waitForNextPatch();
    alice.send(MSG.toast);
    await tick(40);
    bob.send(MSG.toast);
    await tick(250);
    await room.waitForNextPatch();
    expect(events.map((e) => e.kind)).toEqual(["invite", "join", "clink"]);
    const clink = events.at(-1)!;
    expect(clink.kind === "clink" && clink.sips).toEqual([
      { sessionId: alice.sessionId, part: 0, left: usesOf("whisky") - 1 },
      { sessionId: bob.sessionId, part: 0, left: usesOf("tinto") - 1 },
    ]);
    expect(room.state.players.get(alice.sessionId)!.heldLeft).toBe(String(usesOf("whisky") - 1));
    expect(room.state.players.get(bob.sessionId)!.heldLeft).toBe(`${usesOf("tinto") - 1},${usesOf("cigarro")}`);
    // Un sorbo de whisky no alcanza para "alegre", pero quedó anotado.
    expect(inside.drunk.stage("u-alice")).toBe(0);
    inside.drunk.consumed("u-alice", "whisky");
    expect(inside.drunk.stage("u-alice")).toBe(1); // dos sorbos (2,4): el del brindis contó
  });

  it("si el otro no responde, se vence solo", async () => {
    const { room, alice, inside, events } = await inRoom();
    inside.held.give("u-alice", "cerveza");
    inside.held.give("u-bob", "cerveza");
    await room.waitForNextPatch();
    alice.send(MSG.toast);
    await tick(550);
    expect(events.map((e) => e.kind)).toEqual(["invite", "solo"]);
    expect(room.state.players.get(alice.sessionId)!.heldLeft).toBe(String(usesOf("cerveza")));
  });
});
