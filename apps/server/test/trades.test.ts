import type { ColyseusTestServer } from "@colyseus/testing";
import { findPath, getWorld } from "@hyvento/map";
import { GIFT, MSG, ROOM_NAME, TRADE, type TradeClosed, type TradeInvite, type TradeProblem, type TradeView } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, tick, TILE, token, walkToTile, type ServerRoom } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;

beforeAll(async () => {
  colyseus = await bootServer(new MemoryRepository());
});
afterAll(async () => {
  await colyseus.shutdown();
});
beforeEach(async () => {
  await colyseus.cleanup();
  repo = new MemoryRepository();
  OfficeRoom.repo = repo;
});

/** Lo que le llega a cada cliente sobre intercambios. */
function inbox(client: ClientRoom) {
  const box = { invites: [] as TradeInvite[], views: [] as TradeView[], closed: [] as TradeClosed[], problems: [] as TradeProblem[] };
  client.onMessage(MSG.tradeInvite, (m: TradeInvite) => box.invites.push(m));
  client.onMessage(MSG.tradeUpdate, (m: TradeView) => box.views.push(m));
  client.onMessage(MSG.tradeClosed, (m: TradeClosed) => box.closed.push(m));
  client.onMessage(MSG.tradeProblem, (m: TradeProblem) => box.problems.push(m));
  return { ...box, get view() {
    return box.views[box.views.length - 1];
  } };
}

async function setup() {
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
  await room.waitForNextPatch();
  return { room, alice, bob, a: inbox(alice), b: inbox(bob) };
}

/** Alice invita a Bob y Bob acepta: queda abierto el intercambio. */
async function openTrade() {
  const s = await setup();
  s.alice.send(MSG.tradeRequest, { sessionId: s.bob.sessionId });
  await tick(80);
  expect(s.b.invites).toHaveLength(1);
  expect(s.b.invites[0]!.fromName).toBe("Alice");
  s.bob.send(MSG.tradeRespond, { requestId: s.b.invites[0]!.requestId, accept: true });
  await tick(80);
  expect(s.a.view?.them.name).toBe("Bob");
  expect(s.b.view?.them.name).toBe("Alice");
  return s;
}

const points = (userId: string) => repo.getPoints(userId);

describe("intercambios", () => {
  it("flujo feliz: cada uno pone lo suyo, listos, confirman y se hace en una transacción", async () => {
    await repo.awardPoints({ userId: "u-alice", amount: 50, reason: "ADMIN" });
    repo.give("u-alice", "plant", 2);
    repo.give("u-bob", "sofa", 1);
    const { alice, bob, a, b, room } = await openTrade();

    alice.send(MSG.tradeOffer, { points: 30, items: [{ itemId: "plant", quantity: 1 }] });
    bob.send(MSG.tradeOffer, { points: 0, items: [{ itemId: "sofa", quantity: 1 }] });
    await tick(80);
    expect(b.view?.them).toMatchObject({ points: 30, items: [{ itemId: "plant", quantity: 1 }] });
    expect(a.view?.them.items).toEqual([{ itemId: "sofa", quantity: 1 }]);

    // Sin los dos listos, confirmar no hace nada.
    alice.send(MSG.tradeConfirm);
    alice.send(MSG.tradeReady, { ready: true });
    await tick(60);
    expect(a.view?.stage).toBe("offer");
    expect(a.view?.you.confirmed).toBe(false);
    bob.send(MSG.tradeReady, { ready: true });
    await tick(60);
    expect(a.view?.stage).toBe("confirm");

    alice.send(MSG.tradeConfirm);
    await tick(60);
    expect(b.view?.them.confirmed).toBe(true);
    expect(await points("u-alice")).toBe(50); // falta Bob: todavía nada
    bob.send(MSG.tradeConfirm);
    await tick(100);

    expect(a.closed.at(-1)).toMatchObject({ reason: "done", with: "Bob", got: { points: 0, items: [{ itemId: "sofa", quantity: 1 }] }, balance: 20 });
    expect(b.closed.at(-1)).toMatchObject({ reason: "done", with: "Alice", got: { points: 30, items: [{ itemId: "plant", quantity: 1 }] }, balance: 30 });
    expect(await points("u-alice")).toBe(20);
    expect(await points("u-bob")).toBe(30);
    expect(repo.held("u-alice", "plant")).toBe(1);
    expect(repo.held("u-bob", "plant")).toBe(1);
    expect(repo.held("u-alice", "sofa")).toBe(1);
    expect(repo.held("u-bob", "sofa")).toBe(0);
    // Los dos movimientos van con motivo GIFT y el mismo refId del intercambio.
    const moves = repo.ledger.filter((m) => m.reason === "GIFT");
    expect(moves.map((m) => m.amount).sort((x, y) => x - y)).toEqual([-30, 30]);
    expect(new Set(moves.map((m) => m.refId)).size).toBe(1);
    expect(moves[0]!.refId).toMatch(/^trade:/);
    // El contador del HUD se actualiza en vivo.
    expect(room.state.players.get(alice.sessionId)!.points).toBe(20);
    expect(room.state.players.get(bob.sessionId)!.points).toBe(30);
  });

  it("no se pueden ofrecer puntos que no se tienen, ni si se gastaron antes de confirmar", async () => {
    await repo.awardPoints({ userId: "u-alice", amount: 20, reason: "ADMIN" });
    repo.give("u-bob", "sofa", 1);
    const { alice, bob, a, b } = await openTrade();

    alice.send(MSG.tradeOffer, { points: 100, items: [] });
    await tick(80);
    expect(a.problems.at(-1)).toEqual({ error: "funds" });
    expect(b.view?.them.points).toBe(0);

    alice.send(MSG.tradeOffer, { points: 20, items: [] });
    bob.send(MSG.tradeOffer, { points: 0, items: [{ itemId: "sofa", quantity: 1 }] });
    await tick(80); // cada oferta desmarca a los dos: se marca "Listo" después
    alice.send(MSG.tradeReady, { ready: true });
    bob.send(MSG.tradeReady, { ready: true });
    await tick(80);
    // Mientras tanto gastó en la cafetería: al confirmar se revalida y no se mueve nada.
    await repo.spendPoints({ userId: "u-alice", amount: 15, reason: "PURCHASE" });
    alice.send(MSG.tradeConfirm);
    bob.send(MSG.tradeConfirm);
    await tick(120);
    expect(a.problems.at(-1)).toEqual({ error: "funds", who: "Alice" });
    expect(b.problems.at(-1)).toEqual({ error: "funds", who: "Alice" });
    expect(a.closed).toEqual([]);
    expect(a.view?.you.ready).toBe(false);
    expect(b.view?.you.ready).toBe(false);
    expect(await points("u-alice")).toBe(5);
    expect(await points("u-bob")).toBe(0);
    expect(repo.held("u-bob", "sofa")).toBe(1);
  });

  it("un objeto que ya no está en la mochila corta la confirmación", async () => {
    repo.give("u-alice", "plant", 1);
    repo.give("u-bob", "piano", 1);
    const { alice, bob, a, b } = await openTrade();

    alice.send(MSG.tradeOffer, { points: 0, items: [{ itemId: "plant", quantity: 2 }] });
    await tick(80);
    expect(a.problems.at(-1)).toEqual({ error: "items" });

    alice.send(MSG.tradeOffer, { points: 0, items: [{ itemId: "plant", quantity: 1 }] });
    bob.send(MSG.tradeOffer, { points: 0, items: [{ itemId: "piano", quantity: 1 }] });
    await tick(80);
    alice.send(MSG.tradeReady, { ready: true });
    bob.send(MSG.tradeReady, { ready: true });
    await tick(80);
    // Puso la planta en su oficina antes de confirmar.
    repo.inventory.set("u-alice:plant", 0);
    alice.send(MSG.tradeConfirm);
    bob.send(MSG.tradeConfirm);
    await tick(120);
    expect(b.problems.at(-1)).toEqual({ error: "items", who: "Alice" });
    expect(a.closed).toEqual([]);
    expect(repo.held("u-bob", "piano")).toBe(1);
    expect(repo.held("u-alice", "piano")).toBe(0);
  });

  it("cualquier cambio desmarca el Listo de los dos", async () => {
    await repo.awardPoints({ userId: "u-alice", amount: 40, reason: "ADMIN" });
    const { alice, bob, a, b } = await openTrade();
    alice.send(MSG.tradeOffer, { points: 10, items: [] });
    alice.send(MSG.tradeReady, { ready: true });
    bob.send(MSG.tradeReady, { ready: true });
    await tick(80);
    expect(b.view).toMatchObject({ stage: "confirm", you: { ready: true }, them: { ready: true } });

    alice.send(MSG.tradeOffer, { points: 15, items: [] });
    await tick(80);
    expect(b.view).toMatchObject({ stage: "offer", you: { ready: false }, them: { ready: false, points: 15 } });
    expect(a.view?.you.ready).toBe(false);

    // Repetir la misma oferta no cambia nada (no desmarca).
    bob.send(MSG.tradeReady, { ready: true });
    await tick(60);
    alice.send(MSG.tradeOffer, { points: 15, items: [] });
    await tick(60);
    expect(a.view?.them.ready).toBe(true);
  });

  it("se cancela si alguien se aleja", async () => {
    const { alice, bob, room, a, b } = await openTrade();
    const map = getWorld().areas.get("jardin")!;
    const me = room.state.players.get(alice.sessionId)!;
    const start = { x: Math.floor(me.x / TILE), y: Math.floor(me.y / TILE) };
    // Un tile al que se llega caminando, a más del alcance.
    let far: { x: number; y: number } | null = null;
    for (let r = Math.ceil(TRADE.reachPx / TILE) + 2; r < 14 && !far; r++)
      for (const [dx, dy] of [[0, -r], [r, 0], [-r, 0], [0, r]] as const) {
        const t = { x: start.x + dx, y: start.y + dy };
        if (findPath(map, start, t)) {
          far = t;
          break;
        }
      }
    expect(far).not.toBeNull();
    await walkToTile(alice, room, far!.x, far!.y);
    await tick(60);
    expect(a.closed.at(-1)).toMatchObject({ reason: "far", with: "Bob" });
    expect(b.closed.at(-1)).toMatchObject({ reason: "far", with: "Alice" });
    // Ya no está abierto: otra oferta no hace nada.
    alice.send(MSG.tradeOffer, { points: 0, items: [] });
    await tick(40);
    expect(a.views.length).toBe(1);
    // Y de lejos tampoco se puede invitar.
    alice.send(MSG.tradeRequest, { sessionId: bob.sessionId });
    await tick(80);
    expect(a.problems.at(-1)).toEqual({ error: "far" });
    expect(b.invites).toHaveLength(1);
  });

  it("se cancela si alguien se desconecta o lo cierra", async () => {
    const first = await openTrade();
    first.bob.send(MSG.tradeCancel);
    await tick(80);
    expect(first.a.closed.at(-1)).toMatchObject({ reason: "cancelled", with: "Bob" });

    first.alice.send(MSG.tradeRequest, { sessionId: first.bob.sessionId });
    await tick(80);
    // Pausa entre invitaciones a la misma persona.
    expect(first.a.problems.at(-1)).toEqual({ error: "too-soon" });

    await colyseus.cleanup();
    const second = await openTrade();
    await second.bob.leave(true);
    await tick(120);
    expect(second.a.closed.at(-1)).toMatchObject({ reason: "left", with: "Bob" });
  });

  it("no se puede con uno mismo ni con alguien ocupado; y se puede rechazar", async () => {
    const { room, alice, bob, a, b } = await setup();
    alice.send(MSG.tradeRequest, { sessionId: alice.sessionId });
    alice.send(MSG.tradeRequest, { sessionId: "nadie" });
    await tick(80);
    expect(a.problems).toEqual([{ error: "self" }, { error: "unknown" }]);

    alice.send(MSG.tradeRequest, { sessionId: bob.sessionId });
    await tick(80);
    bob.send(MSG.tradeRespond, { requestId: b.invites[0]!.requestId, accept: false });
    await tick(80);
    expect(a.closed.at(-1)).toMatchObject({ reason: "declined", with: "Bob" });
    expect(b.views).toEqual([]);

    // Carla ya está intercambiando con Bob: Alice no puede sumarse.
    const carla = await colyseus.connectTo(room, { token: await token("u-carla", "Carla", "carla") });
    const cBox = inbox(carla);
    await room.waitForNextPatch();
    carla.send(MSG.tradeRequest, { sessionId: bob.sessionId });
    await tick(80);
    bob.send(MSG.tradeRespond, { requestId: b.invites.at(-1)!.requestId, accept: true });
    await tick(80);
    expect(cBox.view?.them.name).toBe("Bob");
    await tick(TRADE.requestCooldownMs - 100);
    alice.send(MSG.tradeRequest, { sessionId: bob.sessionId });
    await tick(80);
    expect(a.problems.at(-1)).toEqual({ error: "busy" });
  });
});

describe("intercambios: bordes", () => {
  afterEach(() => {
    OfficeRoom.tradeInviteMs = TRADE.requestTimeoutMs;
    repo.tradeGate = null;
  });

  it("si alguien cancela mientras se guarda, igual termina como hecho y el saldo llega a los dos", async () => {
    await repo.awardPoints({ userId: "u-alice", amount: 40, reason: "ADMIN" });
    repo.give("u-bob", "sofa", 1);
    const { alice, bob, a, b, room } = await openTrade();
    alice.send(MSG.tradeOffer, { points: 25, items: [] });
    bob.send(MSG.tradeOffer, { points: 0, items: [{ itemId: "sofa", quantity: 1 }] });
    await tick(80);
    alice.send(MSG.tradeReady, { ready: true });
    bob.send(MSG.tradeReady, { ready: true });
    await tick(80);

    // La base tarda: el intercambio queda "guardándose" hasta que se suelta la puerta.
    let release!: () => void;
    repo.tradeGate = new Promise<void>((r) => (release = r));
    alice.send(MSG.tradeConfirm);
    bob.send(MSG.tradeConfirm);
    await tick(80);
    bob.send(MSG.tradeCancel);
    await tick(60);
    expect(a.closed).toEqual([]); // el cierre espera a ver cómo sale
    release();
    await tick(100);

    expect(a.closed).toHaveLength(1);
    expect(a.closed[0]).toMatchObject({ reason: "done", balance: 15 });
    expect(b.closed[0]).toMatchObject({ reason: "done", balance: 25 });
    expect(room.state.players.get(alice.sessionId)!.points).toBe(15);
    expect(room.state.players.get(bob.sessionId)!.points).toBe(25);
    expect(repo.held("u-alice", "sofa")).toBe(1);
  });

  it("si no se pudo hacer y alguien había cancelado mientras tanto, se cierra con ese motivo", async () => {
    await repo.awardPoints({ userId: "u-alice", amount: 10, reason: "ADMIN" });
    repo.give("u-bob", "sofa", 1);
    const { alice, bob, a, b } = await openTrade();
    alice.send(MSG.tradeOffer, { points: 10, items: [] });
    bob.send(MSG.tradeOffer, { points: 0, items: [{ itemId: "sofa", quantity: 1 }] });
    await tick(80);
    alice.send(MSG.tradeReady, { ready: true });
    bob.send(MSG.tradeReady, { ready: true });
    await tick(80);
    let release!: () => void;
    repo.tradeGate = new Promise<void>((r) => (release = r));
    alice.send(MSG.tradeConfirm);
    bob.send(MSG.tradeConfirm);
    await tick(80);
    await repo.spendPoints({ userId: "u-alice", amount: 5, reason: "PURCHASE" });
    alice.send(MSG.tradeCancel);
    await tick(40);
    release();
    await tick(100);
    expect(a.closed.at(-1)).toMatchObject({ reason: "cancelled" });
    expect(b.closed.at(-1)).toMatchObject({ reason: "cancelled", with: "Alice" });
    expect(b.problems).toEqual([]);
    expect(await points("u-bob")).toBe(0);
  });

  it("si alguien se desconecta mientras se guarda, se hace igual y una oferta nueva en el medio no cambia nada", async () => {
    await repo.awardPoints({ userId: "u-alice", amount: 40, reason: "ADMIN" });
    repo.give("u-bob", "sofa", 1);
    const { alice, bob, a, room } = await openTrade();
    alice.send(MSG.tradeOffer, { points: 25, items: [] });
    bob.send(MSG.tradeOffer, { points: 0, items: [{ itemId: "sofa", quantity: 1 }] });
    await tick(80);
    alice.send(MSG.tradeReady, { ready: true });
    bob.send(MSG.tradeReady, { ready: true });
    await tick(80);
    let release!: () => void;
    repo.tradeGate = new Promise<void>((r) => (release = r));
    alice.send(MSG.tradeConfirm);
    bob.send(MSG.tradeConfirm);
    await tick(80);
    // Alice cambia la oferta (queda en la cola) y Bob se va: nada de eso corre durante el guardado.
    alice.send(MSG.tradeOffer, { points: 40, items: [] });
    await bob.leave(true);
    await tick(80);
    expect(a.closed).toEqual([]);
    release();
    await tick(120);

    expect(a.closed).toHaveLength(1);
    expect(a.closed[0]).toMatchObject({ reason: "done", with: "Bob", gave: { points: 25 }, balance: 15 });
    expect(await points("u-alice")).toBe(15);
    expect(await points("u-bob")).toBe(25);
    expect(repo.held("u-alice", "sofa")).toBe(1);
    expect(room.state.players.get(alice.sessionId)!.points).toBe(15);
    // El intercambio ya no existe: Alice puede invitar de nuevo sin quedar "ocupada".
    expect(a.problems).toEqual([]);
  });

  it("la invitación vence si nadie responde", async () => {
    OfficeRoom.tradeInviteMs = 150;
    const { alice, bob, a, b } = await setup();
    alice.send(MSG.tradeRequest, { sessionId: bob.sessionId });
    await tick(80);
    expect(b.invites).toHaveLength(1);
    await tick(300);
    expect(a.closed.at(-1)).toMatchObject({ id: b.invites[0]!.requestId, reason: "timeout", with: "Bob" });
    expect(b.invites[0]!.ttlMs).toBe(150);
    // Aceptar tarde no abre nada, y se avisa que venció.
    bob.send(MSG.tradeRespond, { requestId: b.invites[0]!.requestId, accept: true });
    await tick(80);
    expect(a.views).toEqual([]);
    expect(b.views).toEqual([]);
    expect(b.problems.at(-1)).toEqual({ error: "expired" });
  });

  it("no se invita a alguien en No molestar", async () => {
    const { room, alice, bob, a, b } = await setup();
    bob.send(MSG.status, { status: "dnd" });
    await room.waitForNextPatch();
    await tick();
    alice.send(MSG.tradeRequest, { sessionId: bob.sessionId });
    await tick(80);
    expect(a.problems.at(-1)).toEqual({ error: "dnd" });
    expect(b.invites).toEqual([]);
  });

  it("se cancela si alguien cambia de nivel por un portal", async () => {
    const { room, alice, bob, a, b } = await setup();
    const map = getWorld().areas.get("jardin")!;
    const portal = map.portals[0]!;
    const at = portal.tiles[0]!;
    await walkToTile(alice, room, at.x, at.y);
    // Bob se para junto al portal (en un tile al que se llega caminando).
    const me = room.state.players.get(bob.sessionId)!;
    const start = { x: Math.floor(me.x / TILE), y: Math.floor(me.y / TILE) };
    const around = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [0, 2], [-2, 0], [0, -2]] as const;
    const near = around
      .map(([dx, dy]) => ({ x: at.x + dx, y: at.y + dy }))
      .find((t) => !portal.tiles.some((p) => p.x === t.x && p.y === t.y) && findPath(map, start, t));
    expect(near).toBeDefined();
    await walkToTile(bob, room, near!.x, near!.y);
    alice.send(MSG.tradeRequest, { sessionId: bob.sessionId });
    await tick(80);
    bob.send(MSG.tradeRespond, { requestId: b.invites[0]!.requestId, accept: true });
    await tick(80);
    expect(a.view?.them.name).toBe("Bob");

    alice.send(MSG.travel, { portal: portal.id });
    await room.waitForNextPatch();
    await tick(60);
    expect(room.state.players.get(alice.sessionId)!.area).toBe(portal.to.area);
    expect(a.closed.at(-1)).toMatchObject({ reason: "far", with: "Bob" });
    expect(b.closed.at(-1)).toMatchObject({ reason: "far", with: "Alice" });
  });

  it("se cancela si se corta la conexión (sin cerrar la pestaña)", async () => {
    const { bob, a } = await openTrade();
    await bob.leave(false);
    await tick(120);
    expect(a.closed.at(-1)).toMatchObject({ reason: "left", with: "Bob" });
  });

  it("abrir otra pestaña con la misma persona cierra su intercambio", async () => {
    const { room, b } = await openTrade();
    await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    await room.waitForNextPatch();
    await tick(120);
    expect(b.closed.at(-1)).toMatchObject({ reason: "left", with: "Alice" });
    expect([...room.state.players.values()].filter((p) => p.userId === "u-alice")).toHaveLength(1);
  });

  it("una invitación nueva retira la anterior y a quien la tenía le llega el aviso", async () => {
    const { room, alice, bob, b } = await setup();
    const carla = await colyseus.connectTo(room, { token: await token("u-carla", "Carla", "carla") });
    const c = inbox(carla);
    await room.waitForNextPatch();
    alice.send(MSG.tradeRequest, { sessionId: bob.sessionId });
    await tick(80);
    alice.send(MSG.tradeRequest, { sessionId: carla.sessionId });
    await tick(80);
    expect(b.closed.at(-1)).toMatchObject({ id: b.invites[0]!.requestId, reason: "cancelled", with: "Alice" });
    // La de Bob ya no sirve; la de Carla sí.
    bob.send(MSG.tradeRespond, { requestId: b.invites[0]!.requestId, accept: true });
    await tick(80);
    expect(b.views).toEqual([]);
    carla.send(MSG.tradeRespond, { requestId: c.invites[0]!.requestId, accept: true });
    await tick(80);
    expect(c.view?.them.name).toBe("Alice");
  });

  it("al entrar a un intercambio, se avisa a quien esperaba respuesta de esa persona", async () => {
    const { room, alice, bob, a, b } = await setup();
    const carla = await colyseus.connectTo(room, { token: await token("u-carla", "Carla", "carla") });
    const c = inbox(carla);
    await room.waitForNextPatch();
    carla.send(MSG.tradeRequest, { sessionId: bob.sessionId });
    alice.send(MSG.tradeRequest, { sessionId: bob.sessionId });
    await tick(80);
    const fromAlice = b.invites.find((i) => i.fromName === "Alice")!;
    bob.send(MSG.tradeRespond, { requestId: fromAlice.requestId, accept: true });
    await tick(80);
    expect(a.view?.them.name).toBe("Bob");
    expect(c.closed.at(-1)).toMatchObject({ reason: "cancelled", with: "Bob" });
    expect(a.closed).toEqual([]);
    expect(b.closed).toEqual([]);
  });

  it("los puntos que se dan en intercambios cuentan para el tope diario de dar (el de los regalos)", async () => {
    await repo.awardPoints({ userId: "u-alice", amount: 2000, reason: "ADMIN" });
    repo.give("u-bob", "sofa", 1);
    // Ya regaló casi todo el tope hoy.
    repo.ledger.push({ userId: "u-alice", amount: -(GIFT.dailyPoints - 100), reason: "GIFT", at: Date.now(), refId: "gift:x" });
    const { alice, bob, a, b } = await openTrade();
    bob.send(MSG.tradeOffer, { points: 0, items: [{ itemId: "sofa", quantity: 1 }] });
    alice.send(MSG.tradeOffer, { points: 150, items: [] });
    await tick(80);
    expect(a.problems.at(-1)).toEqual({ error: "limit" });
    expect(b.view?.them.points).toBe(0);

    alice.send(MSG.tradeOffer, { points: 100, items: [] });
    await tick(80);
    alice.send(MSG.tradeReady, { ready: true });
    bob.send(MSG.tradeReady, { ready: true });
    await tick(80);
    // Mandó otro regalo antes de confirmar: se revalida y no se mueve nada.
    repo.ledger.push({ userId: "u-alice", amount: -1, reason: "GIFT", at: Date.now(), refId: "gift:y" });
    alice.send(MSG.tradeConfirm);
    bob.send(MSG.tradeConfirm);
    await tick(120);
    expect(b.problems.at(-1)).toEqual({ error: "limit", who: "Alice" });
    expect(a.closed).toEqual([]);
    expect(await points("u-bob")).toBe(0);
  });

  it("un intercambio de un solo lado no se confirma: dar sin recibir es un regalo (con sus topes)", async () => {
    await repo.awardPoints({ userId: "u-alice", amount: 900, reason: "ADMIN" });
    repo.give("u-alice", "sofa", 10);
    const { alice, bob, a, b } = await openTrade();
    alice.send(MSG.tradeOffer, { points: 900, items: [{ itemId: "sofa", quantity: 10 }] });
    await tick(80);
    alice.send(MSG.tradeReady, { ready: true });
    bob.send(MSG.tradeReady, { ready: true });
    await tick(80);
    expect(a.view?.stage).toBe("confirm");
    alice.send(MSG.tradeConfirm);
    bob.send(MSG.tradeConfirm);
    await tick(120);
    expect(a.problems.at(-1)).toEqual({ error: "one-sided" });
    expect(b.problems.at(-1)).toEqual({ error: "one-sided" });
    expect(a.view?.you.confirmed).toBe(false);
    expect(a.closed).toEqual([]);
    expect(await points("u-alice")).toBe(900);
    expect(repo.held("u-bob", "sofa")).toBe(0);

    // Con algo del otro lado, sí.
    repo.give("u-bob", "plant", 1);
    bob.send(MSG.tradeOffer, { points: 0, items: [{ itemId: "plant", quantity: 1 }] });
    await tick(80);
    alice.send(MSG.tradeReady, { ready: true });
    bob.send(MSG.tradeReady, { ready: true });
    await tick(80);
    alice.send(MSG.tradeConfirm);
    bob.send(MSG.tradeConfirm);
    await tick(120);
    expect(a.closed.at(-1)).toMatchObject({ reason: "done" });
    expect(repo.held("u-bob", "sofa")).toBe(10);
  });

  it("el repositorio también rechaza un intercambio de un solo lado (si la sala se equivocara)", async () => {
    await repo.awardPoints({ userId: "u-alice", amount: 100, reason: "ADMIN" });
    const result = await repo.executeTrade({ refId: "trade:x", a: { userId: "u-alice", points: 100, items: [] }, b: { userId: "u-bob", points: 0, items: [] } });
    expect(result).toEqual({ ok: false, error: "one-sided", userId: "u-bob" });
    expect(await points("u-alice")).toBe(100);
  });

  it("las pausas entre invitaciones no se acumulan: se olvidan al irse y al vencer", async () => {
    const { room, alice, bob, b } = await setup();
    const trades = (room as unknown as { trades: { cooldownsTracked(): number } }).trades;
    alice.send(MSG.tradeRequest, { sessionId: bob.sessionId });
    bob.send(MSG.tradeRequest, { sessionId: alice.sessionId });
    await tick(80);
    expect(b.invites).toHaveLength(1);
    expect(trades.cooldownsTracked()).toBe(2);
    await bob.leave(true);
    await tick(120);
    expect(trades.cooldownsTracked()).toBe(0);
  });
});
