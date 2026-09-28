import type { ColyseusTestServer } from "@colyseus/testing";
import { findPath, getWorld } from "@hyvento/map";
import { GIFT, MSG, ROOM_NAME, TRADE, type TradeClosed, type TradeInvite, type TradeProblem, type TradeView } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { Trades } from "../src/rooms/trades";
import type { OfficeState } from "../src/state";
import { bootServer, tick, TILE, token, until, walkToTile, type ServerRoom } from "./helpers";

// Nada de esperas fijas: con la máquina cargada 80 ms no alcanzan, y lo que mandan dos clientes distintos
// no llega en un orden fijo (el "Listo" de Bob puede ganarle a la oferta de Alice). Cada paso espera a ver
// su efecto (`until`); lo que no deja rastro (una oferta repetida, cancelar mientras se guarda) se
// confirma con algo que el servidor procesa después o espiando el método de la sala.

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
afterEach(() => {
  vi.restoreAllMocks();
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
type Inbox = ReturnType<typeof inbox>;

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
  await until(() => s.b.invites.length, "la invitación");
  expect(s.b.invites).toHaveLength(1);
  expect(s.b.invites[0]!.fromName).toBe("Alice");
  s.bob.send(MSG.tradeRespond, { requestId: s.b.invites[0]!.requestId, accept: true });
  await until(() => s.a.view && s.b.view, "el intercambio abierto");
  expect(s.a.view?.them.name).toBe("Bob");
  expect(s.b.view?.them.name).toBe("Alice");
  return s;
}

/** Los dos marcan "Listo" y se espera a que los dos lo vean. */
async function bothReady({ alice, bob, a, b }: { alice: ClientRoom; bob: ClientRoom; a: Inbox; b: Inbox }) {
  alice.send(MSG.tradeReady, { ready: true });
  bob.send(MSG.tradeReady, { ready: true });
  await until(() => a.view?.stage === "confirm" && b.view?.stage === "confirm", "los dos listos");
}

/** Espía un método de los intercambios de la sala (para saber cuándo lo procesó el servidor). */
const spyTrades = (room: ServerRoom, method: "cancel" | "left") => vi.spyOn((room as unknown as { trades: Trades }).trades, method);

const points = (userId: string) => repo.getPoints(userId);

describe("intercambios", () => {
  it("flujo feliz: cada uno pone lo suyo, listos, confirman y se hace en una transacción", async () => {
    await repo.awardPoints({ userId: "u-alice", amount: 50, reason: "ADMIN" });
    repo.give("u-alice", "plant", 2);
    repo.give("u-bob", "sofa", 1);
    const { alice, bob, a, b, room } = await openTrade();

    alice.send(MSG.tradeOffer, { points: 30, items: [{ itemId: "plant", quantity: 1 }] });
    bob.send(MSG.tradeOffer, { points: 0, items: [{ itemId: "sofa", quantity: 1 }] });
    await until(() => b.view?.them.points === 30 && a.view?.them.items.length && a.view.you.points === 30, "las dos ofertas");
    expect(b.view?.them).toMatchObject({ points: 30, items: [{ itemId: "plant", quantity: 1 }] });
    expect(a.view?.them.items).toEqual([{ itemId: "sofa", quantity: 1 }]);

    // Sin los dos listos, confirmar no hace nada (el "Listo" de Alice se procesa después de su confirmar).
    alice.send(MSG.tradeConfirm);
    alice.send(MSG.tradeReady, { ready: true });
    await until(() => a.view?.you.ready, "el Listo de Alice");
    expect(a.view?.stage).toBe("offer");
    expect(a.view?.you.confirmed).toBe(false);
    bob.send(MSG.tradeReady, { ready: true });
    await until(() => a.view?.stage === "confirm" && b.view?.stage === "confirm", "los dos listos");

    alice.send(MSG.tradeConfirm);
    await until(() => b.view?.them.confirmed, "el confirmar de Alice");
    expect(await points("u-alice")).toBe(50); // falta Bob: todavía nada
    bob.send(MSG.tradeConfirm);
    await until(() => a.closed.length && b.closed.length, "el cierre");

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
    await until(() => a.problems.length, "el aviso de fondos");
    expect(a.problems.at(-1)).toEqual({ error: "funds" });
    expect(b.view?.them.points).toBe(0);

    alice.send(MSG.tradeOffer, { points: 20, items: [] });
    bob.send(MSG.tradeOffer, { points: 0, items: [{ itemId: "sofa", quantity: 1 }] });
    // Cada oferta desmarca a los dos: se marca "Listo" cuando ya llegaron las dos.
    await until(() => b.view?.them.points === 20 && a.view?.them.items.length, "las dos ofertas");
    await bothReady({ alice, bob, a, b });
    // Mientras tanto gastó en la cafetería: al confirmar se revalida y no se mueve nada.
    await repo.spendPoints({ userId: "u-alice", amount: 15, reason: "PURCHASE" });
    alice.send(MSG.tradeConfirm);
    bob.send(MSG.tradeConfirm);
    await until(() => a.problems.length === 2 && b.problems.length && a.view?.stage === "offer" && b.view?.stage === "offer", "el rechazo");
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
    await until(() => a.problems.length, "el aviso de objetos");
    expect(a.problems.at(-1)).toEqual({ error: "items" });

    alice.send(MSG.tradeOffer, { points: 0, items: [{ itemId: "plant", quantity: 1 }] });
    bob.send(MSG.tradeOffer, { points: 0, items: [{ itemId: "piano", quantity: 1 }] });
    await until(() => b.view?.them.items.length && a.view?.them.items.length, "las dos ofertas");
    await bothReady({ alice, bob, a, b });
    // Puso la planta en su oficina antes de confirmar.
    repo.inventory.set("u-alice:plant", 0);
    alice.send(MSG.tradeConfirm);
    bob.send(MSG.tradeConfirm);
    await until(() => a.problems.length === 2 && b.problems.length, "el rechazo");
    expect(b.problems.at(-1)).toEqual({ error: "items", who: "Alice" });
    expect(a.closed).toEqual([]);
    expect(repo.held("u-bob", "piano")).toBe(1);
    expect(repo.held("u-alice", "piano")).toBe(0);
  });

  it("cualquier cambio desmarca el Listo de los dos", async () => {
    await repo.awardPoints({ userId: "u-alice", amount: 40, reason: "ADMIN" });
    const { alice, bob, a, b } = await openTrade();
    alice.send(MSG.tradeOffer, { points: 10, items: [] });
    // El "Listo" de Bob va después de ver la oferta: si no, podía llegar antes y la oferta lo desmarcaba.
    await until(() => b.view?.them.points === 10, "la oferta de Alice");
    await bothReady({ alice, bob, a, b });
    expect(b.view).toMatchObject({ stage: "confirm", you: { ready: true }, them: { ready: true } });

    alice.send(MSG.tradeOffer, { points: 15, items: [] });
    await until(() => b.view?.them.points === 15 && a.view?.you.points === 15, "la oferta nueva");
    expect(b.view).toMatchObject({ stage: "offer", you: { ready: false }, them: { ready: false, points: 15 } });
    expect(a.view?.you.ready).toBe(false);

    // Repetir la misma oferta no cambia nada (no desmarca).
    bob.send(MSG.tradeReady, { ready: true });
    await until(() => a.view?.them.ready, "el Listo de Bob");
    alice.send(MSG.tradeOffer, { points: 15, items: [] });
    // El "Listo" de Alice se procesa después de la oferta repetida: si esta hubiera desmarcado a Bob, se vería.
    alice.send(MSG.tradeReady, { ready: true });
    await until(() => a.view?.you.ready, "el Listo de Alice");
    expect(a.view?.them.ready).toBe(true);
    expect(a.view?.stage).toBe("confirm");
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
    await until(() => a.closed.length && b.closed.length, "el cierre");
    expect(a.closed.at(-1)).toMatchObject({ reason: "far", with: "Bob" });
    expect(b.closed.at(-1)).toMatchObject({ reason: "far", with: "Alice" });
    // Ya no está abierto: otra oferta no hace nada. Y de lejos tampoco se puede invitar.
    alice.send(MSG.tradeOffer, { points: 0, items: [] });
    alice.send(MSG.tradeRequest, { sessionId: bob.sessionId });
    await until(() => a.problems.length, "el aviso de lejos");
    expect(a.views.length).toBe(1);
    expect(a.problems.at(-1)).toEqual({ error: "far" });
    expect(b.invites).toHaveLength(1);
  });

  it("se cancela si alguien se desconecta o lo cierra", async () => {
    const first = await openTrade();
    first.bob.send(MSG.tradeCancel);
    await until(() => first.a.closed.length, "el cierre");
    expect(first.a.closed.at(-1)).toMatchObject({ reason: "cancelled", with: "Bob" });

    first.alice.send(MSG.tradeRequest, { sessionId: first.bob.sessionId });
    await until(() => first.a.problems.length, "el aviso");
    // Pausa entre invitaciones a la misma persona.
    expect(first.a.problems.at(-1)).toEqual({ error: "too-soon" });

    await colyseus.cleanup();
    const second = await openTrade();
    await second.bob.leave(true);
    await until(() => second.a.closed.length, "el cierre");
    expect(second.a.closed.at(-1)).toMatchObject({ reason: "left", with: "Bob" });
  });

  it("no se puede con uno mismo ni con alguien ocupado; y se puede rechazar", async () => {
    const { room, alice, bob, a, b } = await setup();
    alice.send(MSG.tradeRequest, { sessionId: alice.sessionId });
    alice.send(MSG.tradeRequest, { sessionId: "nadie" });
    await until(() => a.problems.length === 2, "los dos avisos");
    expect(a.problems).toEqual([{ error: "self" }, { error: "unknown" }]);

    alice.send(MSG.tradeRequest, { sessionId: bob.sessionId });
    await until(() => b.invites.length, "la invitación");
    bob.send(MSG.tradeRespond, { requestId: b.invites[0]!.requestId, accept: false });
    await until(() => a.closed.length, "el rechazo");
    expect(a.closed.at(-1)).toMatchObject({ reason: "declined", with: "Bob" });
    expect(b.views).toEqual([]);

    // Carla ya está intercambiando con Bob: Alice no puede sumarse.
    const carla = await colyseus.connectTo(room, { token: await token("u-carla", "Carla", "carla") });
    const cBox = inbox(carla);
    await room.waitForNextPatch();
    carla.send(MSG.tradeRequest, { sessionId: bob.sessionId });
    await until(() => b.invites.length === 2, "la invitación de Carla");
    bob.send(MSG.tradeRespond, { requestId: b.invites.at(-1)!.requestId, accept: true });
    await until(() => cBox.view, "el intercambio con Carla");
    expect(cBox.view?.them.name).toBe("Bob");
    await tick(TRADE.requestCooldownMs - 100);
    alice.send(MSG.tradeRequest, { sessionId: bob.sessionId });
    await until(() => a.problems.length === 3, "el aviso de ocupado");
    expect(a.problems.at(-1)).toEqual({ error: "busy" });
  });
});

describe("intercambios: bordes", () => {
  afterEach(() => {
    OfficeRoom.tradeInviteMs = TRADE.requestTimeoutMs;
    repo.tradeGate = null;
  });

  /** Confirman los dos con la base trabada: vuelve cuando el servidor ya empezó a guardar. */
  async function confirmWhileSaving({ alice, bob, b }: { alice: ClientRoom; bob: ClientRoom; b: Inbox }) {
    let release!: () => void;
    repo.tradeGate = new Promise<void>((r) => (release = r));
    const saving = vi.spyOn(repo, "executeTrade");
    // Primero el de Alice: si el de Bob (y lo que manda después) llegaba antes, se cerraba sin guardar.
    alice.send(MSG.tradeConfirm);
    await until(() => b.view?.them.confirmed, "el confirmar de Alice");
    bob.send(MSG.tradeConfirm);
    await until(() => saving.mock.calls.length, "que empiece a guardarse");
    return release;
  }

  it("si alguien cancela mientras se guarda, igual termina como hecho y el saldo llega a los dos", async () => {
    await repo.awardPoints({ userId: "u-alice", amount: 40, reason: "ADMIN" });
    repo.give("u-bob", "sofa", 1);
    const s = await openTrade();
    const { alice, bob, a, b, room } = s;
    alice.send(MSG.tradeOffer, { points: 25, items: [] });
    bob.send(MSG.tradeOffer, { points: 0, items: [{ itemId: "sofa", quantity: 1 }] });
    await until(() => b.view?.them.points === 25 && a.view?.them.items.length, "las dos ofertas");
    await bothReady(s);

    // La base tarda: el intercambio queda "guardándose" hasta que se suelta la puerta.
    const release = await confirmWhileSaving(s);
    const cancels = spyTrades(room, "cancel");
    bob.send(MSG.tradeCancel);
    await until(() => cancels.mock.calls.length, "que el servidor lea el cancelar");
    expect(a.closed).toEqual([]); // el cierre espera a ver cómo sale
    release();
    await until(() => a.closed.length && b.closed.length, "el cierre");

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
    const s = await openTrade();
    const { alice, bob, a, b, room } = s;
    alice.send(MSG.tradeOffer, { points: 10, items: [] });
    bob.send(MSG.tradeOffer, { points: 0, items: [{ itemId: "sofa", quantity: 1 }] });
    await until(() => b.view?.them.points === 10 && a.view?.them.items.length, "las dos ofertas");
    await bothReady(s);
    const release = await confirmWhileSaving(s);
    await repo.spendPoints({ userId: "u-alice", amount: 5, reason: "PURCHASE" });
    const cancels = spyTrades(room, "cancel");
    alice.send(MSG.tradeCancel);
    await until(() => cancels.mock.calls.length, "que el servidor lea el cancelar");
    release();
    await until(() => a.closed.length && b.closed.length, "el cierre");
    expect(a.closed.at(-1)).toMatchObject({ reason: "cancelled" });
    expect(b.closed.at(-1)).toMatchObject({ reason: "cancelled", with: "Alice" });
    expect(b.problems).toEqual([]);
    expect(await points("u-bob")).toBe(0);
  });

  it("si alguien se desconecta mientras se guarda, se hace igual y una oferta nueva en el medio no cambia nada", async () => {
    await repo.awardPoints({ userId: "u-alice", amount: 40, reason: "ADMIN" });
    repo.give("u-bob", "sofa", 1);
    const s = await openTrade();
    const { alice, bob, a, b, room } = s;
    alice.send(MSG.tradeOffer, { points: 25, items: [] });
    bob.send(MSG.tradeOffer, { points: 0, items: [{ itemId: "sofa", quantity: 1 }] });
    await until(() => b.view?.them.points === 25 && a.view?.them.items.length, "las dos ofertas");
    await bothReady(s);
    const release = await confirmWhileSaving(s);
    const lefts = spyTrades(room, "left");
    // Alice cambia la oferta (queda en la cola) y Bob se va: nada de eso corre durante el guardado.
    alice.send(MSG.tradeOffer, { points: 40, items: [] });
    await bob.leave(true);
    await until(() => lefts.mock.calls.length, "que el servidor vea que Bob se fue");
    expect(a.closed).toEqual([]);
    release();
    await until(() => a.closed.length, "el cierre");

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
    await until(() => b.invites.length, "la invitación");
    expect(b.invites).toHaveLength(1);
    await until(() => a.closed.length, "el vencimiento");
    expect(a.closed.at(-1)).toMatchObject({ id: b.invites[0]!.requestId, reason: "timeout", with: "Bob" });
    expect(b.invites[0]!.ttlMs).toBe(150);
    // Aceptar tarde no abre nada, y se avisa que venció.
    bob.send(MSG.tradeRespond, { requestId: b.invites[0]!.requestId, accept: true });
    await until(() => b.problems.length, "el aviso de vencida");
    expect(a.views).toEqual([]);
    expect(b.views).toEqual([]);
    expect(b.problems.at(-1)).toEqual({ error: "expired" });
  });

  it("no se invita a alguien en No molestar", async () => {
    const { room, alice, bob, a, b } = await setup();
    bob.send(MSG.status, { status: "dnd" });
    await until(() => room.state.players.get(bob.sessionId)?.status === "dnd", "el No molestar");
    alice.send(MSG.tradeRequest, { sessionId: bob.sessionId });
    await until(() => a.problems.length, "el aviso");
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
    await until(() => b.invites.length, "la invitación");
    bob.send(MSG.tradeRespond, { requestId: b.invites[0]!.requestId, accept: true });
    await until(() => a.view, "el intercambio abierto");
    expect(a.view?.them.name).toBe("Bob");

    alice.send(MSG.travel, { portal: portal.id });
    await until(() => a.closed.length && b.closed.length, "el cierre");
    expect(room.state.players.get(alice.sessionId)!.area).toBe(portal.to.area);
    expect(a.closed.at(-1)).toMatchObject({ reason: "far", with: "Bob" });
    expect(b.closed.at(-1)).toMatchObject({ reason: "far", with: "Alice" });
  });

  it("se cancela si se corta la conexión (sin cerrar la pestaña)", async () => {
    const { bob, a } = await openTrade();
    await bob.leave(false);
    await until(() => a.closed.length, "el cierre");
    expect(a.closed.at(-1)).toMatchObject({ reason: "left", with: "Bob" });
  });

  it("abrir otra pestaña con la misma persona cierra su intercambio", async () => {
    const { room, b } = await openTrade();
    await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    await until(() => b.closed.length, "el cierre");
    expect(b.closed.at(-1)).toMatchObject({ reason: "left", with: "Alice" });
    await until(() => [...room.state.players.values()].filter((p) => p.userId === "u-alice").length === 1, "que se vaya la pestaña vieja");
  });

  it("una invitación nueva retira la anterior y a quien la tenía le llega el aviso", async () => {
    const { room, alice, bob, b } = await setup();
    const carla = await colyseus.connectTo(room, { token: await token("u-carla", "Carla", "carla") });
    const c = inbox(carla);
    await room.waitForNextPatch();
    alice.send(MSG.tradeRequest, { sessionId: bob.sessionId });
    await until(() => b.invites.length, "la invitación a Bob");
    alice.send(MSG.tradeRequest, { sessionId: carla.sessionId });
    await until(() => b.closed.length && c.invites.length, "la invitación a Carla");
    expect(b.closed.at(-1)).toMatchObject({ id: b.invites[0]!.requestId, reason: "cancelled", with: "Alice" });
    // La de Bob ya no sirve (se avisa que venció); la de Carla sí.
    bob.send(MSG.tradeRespond, { requestId: b.invites[0]!.requestId, accept: true });
    await until(() => b.problems.length, "el aviso de vencida");
    expect(b.views).toEqual([]);
    carla.send(MSG.tradeRespond, { requestId: c.invites[0]!.requestId, accept: true });
    await until(() => c.view, "el intercambio con Carla");
    expect(c.view?.them.name).toBe("Alice");
  });

  it("al entrar a un intercambio, se avisa a quien esperaba respuesta de esa persona", async () => {
    const { room, alice, bob, a, b } = await setup();
    const carla = await colyseus.connectTo(room, { token: await token("u-carla", "Carla", "carla") });
    const c = inbox(carla);
    await room.waitForNextPatch();
    carla.send(MSG.tradeRequest, { sessionId: bob.sessionId });
    alice.send(MSG.tradeRequest, { sessionId: bob.sessionId });
    await until(() => b.invites.length === 2, "las dos invitaciones");
    const fromAlice = b.invites.find((i) => i.fromName === "Alice")!;
    bob.send(MSG.tradeRespond, { requestId: fromAlice.requestId, accept: true });
    await until(() => a.view && b.view && c.closed.length, "el intercambio y el aviso a Carla");
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
    const s = await openTrade();
    const { alice, bob, a, b } = s;
    bob.send(MSG.tradeOffer, { points: 0, items: [{ itemId: "sofa", quantity: 1 }] });
    alice.send(MSG.tradeOffer, { points: 150, items: [] });
    await until(() => a.problems.length && b.view?.you.items.length, "el aviso del tope");
    expect(a.problems.at(-1)).toEqual({ error: "limit" });
    expect(b.view?.them.points).toBe(0);

    alice.send(MSG.tradeOffer, { points: 100, items: [] });
    await until(() => b.view?.them.points === 100 && a.view?.you.points === 100, "la oferta");
    await bothReady(s);
    // Mandó otro regalo antes de confirmar: se revalida y no se mueve nada.
    repo.ledger.push({ userId: "u-alice", amount: -1, reason: "GIFT", at: Date.now(), refId: "gift:y" });
    alice.send(MSG.tradeConfirm);
    bob.send(MSG.tradeConfirm);
    await until(() => a.problems.length === 2 && b.problems.length, "el rechazo");
    expect(b.problems.at(-1)).toEqual({ error: "limit", who: "Alice" });
    expect(a.closed).toEqual([]);
    expect(await points("u-bob")).toBe(0);
  });

  it("los muebles tienen tope: hasta TRADE.maxUnits por lado y GIFT.dailyItems al día (con los ya dados)", async () => {
    repo.give("u-alice", "sofa", 30);
    await repo.awardPoints({ userId: "u-bob", amount: 10, reason: "ADMIN" });
    // Ya dio 15 muebles hoy en otro intercambio.
    repo.itemTransfers.push({ fromId: "u-alice", toId: "u-carla", itemId: "sofa", quantity: GIFT.dailyItems - 5, at: Date.now() });
    const s = await openTrade();
    const { alice, bob, a, b } = s;
    bob.send(MSG.tradeOffer, { points: 1, items: [] });
    // Más de TRADE.maxUnits no pasa ni la validación del mensaje (se ignora): lo muestra la oferta que va
    // detrás (el servidor las lee en orden), que se rechaza por el tope del día y deja todo vacío.
    alice.send(MSG.tradeOffer, { points: 0, items: [{ itemId: "sofa", quantity: TRADE.maxUnits + 1 }] });
    alice.send(MSG.tradeOffer, { points: 0, items: [{ itemId: "sofa", quantity: 6 }] });
    await until(() => a.problems.length && b.view?.you.points === 1, "el aviso del tope");
    expect(a.problems.at(-1)).toEqual({ error: "limit-items" });
    expect(b.view?.them.items).toEqual([]);

    alice.send(MSG.tradeOffer, { points: 0, items: [{ itemId: "sofa", quantity: 5 }] });
    await until(() => b.view?.them.items.length && a.view?.you.items.length, "la oferta");
    await bothReady(s);
    alice.send(MSG.tradeConfirm);
    bob.send(MSG.tradeConfirm);
    await until(() => a.closed.length, "el cierre");
    expect(a.closed.at(-1)?.reason).toBe("done");
    expect(repo.itemTransfers.at(-1)).toMatchObject({ fromId: "u-alice", toId: "u-bob", itemId: "sofa", quantity: 5 });
    expect(await repo.givenToday("u-alice")).toMatchObject({ items: GIFT.dailyItems });
  });

  it("un intercambio de un solo lado no se confirma: dar sin recibir es un regalo (con sus topes)", async () => {
    await repo.awardPoints({ userId: "u-alice", amount: 900, reason: "ADMIN" });
    repo.give("u-alice", "sofa", 10);
    const s = await openTrade();
    const { alice, bob, a, b } = s;
    alice.send(MSG.tradeOffer, { points: 900, items: [{ itemId: "sofa", quantity: 10 }] });
    await until(() => b.view?.them.points === 900, "la oferta");
    await bothReady(s);
    expect(a.view?.stage).toBe("confirm");
    alice.send(MSG.tradeConfirm);
    bob.send(MSG.tradeConfirm);
    await until(() => a.problems.length && b.problems.length, "el rechazo");
    expect(a.problems.at(-1)).toEqual({ error: "one-sided" });
    expect(b.problems.at(-1)).toEqual({ error: "one-sided" });
    expect(a.view?.you.confirmed).toBe(false);
    expect(a.closed).toEqual([]);
    expect(await points("u-alice")).toBe(900);
    expect(repo.held("u-bob", "sofa")).toBe(0);

    // Con algo del otro lado, sí.
    repo.give("u-bob", "plant", 1);
    bob.send(MSG.tradeOffer, { points: 0, items: [{ itemId: "plant", quantity: 1 }] });
    await until(() => a.view?.them.items.length && b.view?.you.items.length, "la oferta de Bob");
    await bothReady(s);
    alice.send(MSG.tradeConfirm);
    bob.send(MSG.tradeConfirm);
    await until(() => a.closed.length, "el cierre");
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
    await until(() => trades.cooldownsTracked() === 2 && b.invites.length, "las dos invitaciones");
    expect(b.invites).toHaveLength(1);
    await bob.leave(true);
    await until(() => trades.cooldownsTracked() === 0, "que se olviden las pausas");
  });
});
