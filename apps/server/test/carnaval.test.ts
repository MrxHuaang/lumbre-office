// El Carnaval de Negros y Blancos en la sala (ver rooms/carnaval.ts): el desfile por la calle del Megabús
// (y el bus que espera), sumarse a la comparsa desde la vereda y que la sala lo lleve, la maicena y las
// serpentinas con su validación, el concurso de disfraces (un voto por persona y el ganador) y el puesto.
import type { ColyseusTestServer } from "@colyseus/testing";
import { desfileDuracionMs, desfileEstado, getWorld, pointsOfType, ROAD, type DesfileTiming } from "@hyvento/map";
import {
  CARNAVAL,
  CARNAVAL_CINE,
  CARNAVAL_MSG,
  DIAS_POR_ESTACION,
  FESTIVAL_MSG,
  MSG,
  ROOM_NAME,
  SEASONS,
  STAT_KEYS,
  carnavalShopItem,
  objItemId,
  type CarnavalBuyResult,
  type ConcursoResult,
  type FestivalCineEvent,
  type JoinResult,
  type LanzarResult,
} from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bagOf, bootServer, c, holdItem, tick, token, walkToTile, type ServerRoom } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
/** El reloj del Carnaval (pausas y desfile): los tests lo corren a mano. */
let now = 50_000_000;
/** Un desfile cortito: rápido y con paradas de segundo y medio. */
const T: DesfileTiming = { velocidad: 40, paradaMs: 1500 };

const NOON = Date.UTC(2026, 8, 26, 17, 0);
/** Un minuto del juego son 2,5 s reales. */
const GAME_MIN_MS = 2500;
const dayOf = (season: (typeof SEASONS)[number], dia: number) => SEASONS.indexOf(season) * DIAS_POR_ESTACION + (dia - 1);
const CARNAVAL_DAY = dayOf("verano", 18);

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
  now = 50_000_000;
  OfficeRoom.carnavalNow = () => now;
  OfficeRoom.carnavalTiming = T;
  OfficeRoom.carnavalDesfile = true;
  OfficeRoom.gameClockNow = () => NOON;
  OfficeRoom.weatherInitial = "despejado";
});
afterEach(() => {
  OfficeRoom.carnavalNow = () => Date.now();
  OfficeRoom.carnavalDesfile = false;
  OfficeRoom.gameClockNow = () => Date.now();
  OfficeRoom.gameClockInitial = null;
  OfficeRoom.weatherInitial = null;
});

async function waitFor<T>(fn: () => T | undefined, ms = 4000): Promise<T> {
  const until = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v !== undefined) return v;
    if (Date.now() > until) throw new Error("No llegó a tiempo");
    await tick(15);
  }
}

/** Una sala a la hora `minute` del juego del día `day` (por defecto el Carnaval a mediodía). */
async function setup(opts: { day?: number; minute?: number; points?: number } = {}) {
  OfficeRoom.gameClockInitial = { anchorReal: NOON, anchorMinute: (opts.day ?? CARNAVAL_DAY) * 1440 + (opts.minute ?? 12 * 60) };
  if (opts.points) await repo.awardPoints({ userId: "u-alice", amount: opts.points, reason: "ADMIN" });
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  await room.waitForNextPatch();
  return { room, alice, ...listen(alice), me: () => room.state.players.get(alice.sessionId)! };
}

async function join(room: ServerRoom, userId: string, name: string) {
  const client = await colyseus.connectTo(room, { token: await token(userId, name) });
  await room.waitForNextPatch();
  return { client, ...listen(client), me: () => room.state.players.get(client.sessionId)! };
}

function listen(client: ClientRoom) {
  const joins: JoinResult[] = [];
  const throws: LanzarResult[] = [];
  const contest: ConcursoResult[] = [];
  const buys: CarnavalBuyResult[] = [];
  const cines: FestivalCineEvent[] = [];
  client.onMessage(CARNAVAL_MSG.joinResult, (r: JoinResult) => joins.push(r));
  client.onMessage(CARNAVAL_MSG.lanzarResult, (r: LanzarResult) => throws.push(r));
  client.onMessage(CARNAVAL_MSG.concursoResult, (r: ConcursoResult) => contest.push(r));
  client.onMessage(CARNAVAL_MSG.buyResult, (r: CarnavalBuyResult) => buys.push(r));
  client.onMessage(FESTIVAL_MSG.cine, (e: FestivalCineEvent) => cines.push(e));
  client.onMessage(CARNAVAL_MSG.lanzado, () => {});
  // Las pausas (echar maicena, comprar) corren con el reloj del Carnaval; sumarse no lo mueve (es el del desfile).
  const ask = async <T>(list: T[], type: string, msg: unknown = {}, pause = true) => {
    const before = list.length;
    client.send(type, msg);
    const r = await waitFor(() => list[before]);
    if (pause) now += 2500;
    return r;
  };
  return {
    cines,
    sumarse: () => ask(joins, CARNAVAL_MSG.join, {}, false),
    salirse: () => ask(joins, CARNAVAL_MSG.leave, {}, false),
    lanzar: (to: string) => ask(throws, CARNAVAL_MSG.lanzar, { to }),
    postular: () => ask(contest, CARNAVAL_MSG.postular),
    votar: (userId: string) => ask(contest, CARNAVAL_MSG.votar, { userId }),
    buy: (item: string) => ask(buys, CARNAVAL_MSG.buy, { item }),
  };
}

type Inner = { carnaval: { empezar(): void; tick(): void }; streetHeld: boolean; bus: { phase: string; dispatch(): void } };
const inner = (room: ServerRoom) => room as unknown as Inner;

/** El primer ms del desfile en que va por la parada `i`. */
function msDeParada(i: number) {
  for (let ms = 0; ms < desfileDuracionMs(T); ms += 20) if (desfileEstado(ms, T).parada === i) return ms + 100;
  throw new Error("sin parada");
}

/** Mueve el reloj del Carnaval a `ms` del desfile y espera a que la sala lo note. */
async function irA(room: ServerRoom, ms: number) {
  now = room.state.carnaval.inicio + ms;
  inner(room).carnaval.tick();
  await room.waitForNextPatch();
}

async function give(room: ServerRoom, client: ClientRoom, userId: string, id: string, n = 1) {
  await repo.addInventory(userId, objItemId(id), n);
  await bagOf(room).load(userId);
  await holdItem(client, room, objItemId(id));
}

describe("el desfile por la calle del Megabús", () => {
  it("el Desfile Magno sale solo a su hora (una vez) y el bus no sale mientras pasa", async () => {
    const { room } = await setup({ minute: 10 * 60 + 2 });
    await waitFor(() => (room.state.carnaval.fase === "desfile" ? true : undefined));
    expect(inner(room).streetHeld).toBe(true);
    // El de refuerzo también espera.
    inner(room).bus.dispatch();
    expect(inner(room).bus.phase).toBe("away");
    await irA(room, desfileDuracionMs(T) + 50);
    expect(room.state.carnaval.fase).toBe("");
    expect(inner(room).streetHeld).toBe(false);
  });

  it("fuera del Carnaval no sale (ni a la hora)", async () => {
    const { room } = await setup({ day: CARNAVAL_DAY - 1, minute: 10 * 60 + 1 });
    await tick(300);
    expect(room.state.carnaval.fase).toBe("");
  });

  it("quien se suma desde la vereda baila en la fila donde pasa: la sala lo mueve y al final lo baja con puntos", async () => {
    const { room, alice, me, sumarse, cines } = await setup();
    expect(await sumarse()).toEqual({ ok: false, error: "noDesfile" });
    inner(room).carnaval.empezar();
    // Los del jardín ven la cinemática de la salida.
    await waitFor(() => (cines.some((e) => e.id === CARNAVAL_CINE.salida) ? true : undefined));
    // Donde la fila todavía no llega, no; donde va pasando, sí (en cualquier momento del desfile).
    let llega = 0;
    while (desfileEstado(llega, T).cabeza < 30) llega += 20;
    await irA(room, llega);
    await walkToTile(alice, room, 59, 131);
    expect(await sumarse()).toEqual({ ok: false, error: "far" });
    await irA(room, msDeParada(0));
    expect(await sumarse()).toEqual({ ok: true, joined: true });
    await room.waitForNextPatch();
    expect(me().comparsa).toBe(true);
    expect(me().y).toBeGreaterThan(ROAD.y0 * 32);
    expect(await sumarse()).toEqual({ ok: false, error: "already" });
    await waitFor(() => (cines.some((e) => e.id === CARNAVAL_CINE.sumarse) ? true : undefined));
    // Lo que mande el cliente no lo mueve, ni sale por un portal.
    const before = { x: me().x, y: me().y };
    alice.send(MSG.move, { x: c(59), y: c(131), dir: "down", moving: true });
    await tick(60);
    expect({ x: me().x, y: me().y }).toEqual(before);
    // Avanza con la fila (un buen trecho después de la parada, antes de llegar a la bajada: con más
    // carrozas la fila es más larga y en la parada de adelante ya iría bajándose).
    const cabeza0 = desfileEstado(msDeParada(0), T).cabeza;
    let luego = msDeParada(0);
    while (desfileEstado(luego, T).cabeza < cabeza0 + 25) luego += 20;
    await irA(room, luego);
    expect(me().x).toBeGreaterThan(before.x + 20 * 32);
    expect(me().comparsa).toBe(true);
    // Al llegar a la bajada, a la vereda, con los puntos de ocio y la cinemática del final.
    await irA(room, desfileDuracionMs(T) - 200);
    expect(me().comparsa).toBe(false);
    expect(Math.floor(me().y / 32)).toBeLessThanOrEqual(131);
    await waitFor(() => (repo.ledger.some((m) => m.userId === "u-alice" && m.reason === "LEISURE" && m.amount === CARNAVAL.puntosDesfile) ? true : undefined));
    const fin = await waitFor(() => cines.find((e) => e.id === CARNAVAL_CINE.final));
    expect(fin.vars?.puntos).toContain(String(CARNAVAL.puntosDesfile));
    // Ya en la vereda vuelve a caminar como siempre.
    await walkToTile(alice, room, Math.floor(me().x / 32) - 3, 131);
    expect(Math.floor(me().x / 32)).toBeLessThan(140);
    await (room as unknown as { achievements: { flushAll(): Promise<void> } }).achievements.flushAll();
    expect((await repo.loadAchievements("u-alice")).stats[STAT_KEYS.comparsaParades]).toBe(1);
  });

  it("salirse a mitad lo deja en la vereda, sin los puntos", async () => {
    const { room, alice, me, sumarse, salirse } = await setup();
    inner(room).carnaval.empezar();
    await irA(room, msDeParada(0));
    await walkToTile(alice, room, 59, 131);
    expect(await sumarse()).toMatchObject({ ok: true });
    await irA(room, msDeParada(0) + 300);
    expect(await salirse()).toEqual({ ok: true, joined: false });
    await room.waitForNextPatch();
    expect(me().comparsa).toBe(false);
    expect(me().y).toBeLessThan(ROAD.y0 * 32);
    expect(repo.ledger.some((m) => m.reason === "LEISURE")).toBe(false);
  });
});

describe("la maicena y las serpentinas", () => {
  it("a alguien de al lado: le empolva la cara y gasta una; con pausa, lejos no, a uno mismo no", async () => {
    const { room, alice, lanzar } = await setup();
    const bob = await join(room, "u-bob", "Bob");
    await walkToTile(alice, room, 59, 131);
    await walkToTile(bob.client, room, 60, 131);
    expect(await lanzar(bob.client.sessionId)).toEqual({ ok: false, error: "nothing" });
    await give(room, alice, "u-alice", "maicena", 3);
    expect(await lanzar(alice.sessionId)).toEqual({ ok: false, error: "self" });
    expect(await lanzar(bob.client.sessionId)).toMatchObject({ ok: true, kind: "maicena", name: "Bob" });
    await room.waitForNextPatch();
    expect(bob.me().talco).toBe(true);
    await bagOf(room).flush("u-alice");
    expect(bagOf(room).count("u-alice", objItemId("maicena"))).toBe(2);
    // La pausa: dos seguidas no.
    alice.send(CARNAVAL_MSG.lanzar, { to: bob.client.sessionId });
    now += 100;
    await tick(60);
    // Lejos no.
    await walkToTile(bob.client, room, 70, 131);
    now += 5000;
    expect(await lanzar(bob.client.sessionId)).toMatchObject({ ok: false, error: "far" });
  });

  it("nunca a quien está en «No molestar» ni a quien pidió no recibir; las serpentinas no empolvan", async () => {
    const { room, alice, lanzar } = await setup();
    const bob = await join(room, "u-bob", "Bob");
    await walkToTile(alice, room, 59, 131);
    await walkToTile(bob.client, room, 60, 131);
    await give(room, alice, "u-alice", "maicena", 3);
    bob.me().status = "dnd";
    expect(await lanzar(bob.client.sessionId)).toMatchObject({ ok: false, error: "dnd" });
    bob.me().status = "available";
    bob.client.send(CARNAVAL_MSG.talcoPref, { off: true });
    await tick(60);
    expect(await lanzar(bob.client.sessionId)).toMatchObject({ ok: false, error: "noTalco" });
    bob.client.send(CARNAVAL_MSG.talcoPref, { off: false });
    await tick(60);
    await give(room, alice, "u-alice", "serpentinas", 2);
    expect(await lanzar(bob.client.sessionId)).toMatchObject({ ok: true, kind: "serpentinas" });
    await room.waitForNextPatch();
    expect(bob.me().talco).toBe(false);
  });

  it("fuera del Carnaval no se echa nada", async () => {
    const { room, alice, lanzar } = await setup({ day: CARNAVAL_DAY - 1 });
    const bob = await join(room, "u-bob", "Bob");
    await walkToTile(alice, room, 59, 131);
    await walkToTile(bob.client, room, 60, 131);
    await give(room, alice, "u-alice", "maicena", 1);
    expect(await lanzar(bob.client.sessionId)).toEqual({ ok: false, error: "off" });
  });
});

describe("el concurso de disfraces", () => {
  it("se postula la pinta, se vota una vez (no por uno mismo) y a las 18:00 gana el más votado", async () => {
    const { room, alice, postular, votar, cines } = await setup();
    const bob = await join(room, "u-bob", "Bob");
    const caro = await join(room, "u-caro", "Caro");
    expect(await postular()).toEqual({ ok: true, kind: "postulado" });
    expect(await bob.postular()).toEqual({ ok: true, kind: "postulado" });
    expect(room.state.carnaval.candidatos.get("u-alice")).toMatchObject({ name: "Alice", votos: 0 });
    expect(await votar("u-alice")).toEqual({ ok: false, error: "self" });
    expect(await bob.votar("u-alice")).toEqual({ ok: true, kind: "votado", name: "Alice" });
    expect(await bob.votar("u-bob")).toEqual({ ok: false, error: "self" });
    expect(await caro.votar("u-alice")).toMatchObject({ ok: true });
    expect(await caro.votar("u-bob")).toEqual({ ok: false, error: "voted" });
    expect(await votar("u-bob")).toMatchObject({ ok: true });
    expect(await caro.votar("u-nadie")).toEqual({ ok: false, error: "unknown" });
    expect(room.state.carnaval.candidatos.get("u-alice")!.votos).toBe(2);
    // Las 18:00 del juego (de día): se cierra y se premia, para todos.
    OfficeRoom.gameClockNow = () => NOON + 6 * 60 * GAME_MIN_MS;
    await waitFor(() => (room.state.carnaval.concursoCerrado ? true : undefined));
    expect(room.state.carnaval.ganador).toBe("u-alice");
    for (const list of [cines, bob.cines, caro.cines]) {
      const e = await waitFor(() => list.find((x) => x.id === CARNAVAL_CINE.premiacion));
      expect(e.vars).toEqual({ nombre: "Alice", votos: "2 votos" });
    }
    expect(await caro.postular()).toEqual({ ok: false, error: "closed" });
    await waitFor(() => (repo.ledger.some((m) => m.userId === "u-alice" && m.reason === "LEISURE" && m.amount === CARNAVAL.premioPuntos) ? true : undefined));
    await (room as unknown as { achievements: { flushAll(): Promise<void> } }).achievements.flushAll();
    const rec = await repo.loadAchievements("u-alice");
    expect(rec.stats[STAT_KEYS.carnavalCrowns]).toBe(1);
    expect(rec.unlocked).toContain("rey-del-carnaval");
    void alice;
  });
});

describe("el puesto del carnaval", () => {
  it("solo con el festival: junto al puesto cobra con PURCHASE y festival:carnaval:<id>; la máscara, una sola", async () => {
    const { room, alice, buy, me } = await setup({ points: 300 });
    expect(await buy("maicena")).toEqual({ ok: false, item: "maicena", error: "far" });
    const stand = pointsOfType(getWorld().areas.get("jardin")!, "festival_shop")[0]!;
    await walkToTile(alice, room, stand.tileX, stand.tileY);
    const maicena = carnavalShopItem("maicena")!;
    expect(await buy("maicena")).toEqual({ ok: true, item: "maicena", balance: 300 - maicena.price });
    expect(repo.ledger.at(-1)).toMatchObject({ amount: -maicena.price, reason: "PURCHASE", refId: "festival:carnaval:maicena" });
    await room.waitForNextPatch();
    expect(me().points).toBe(300 - maicena.price);
    expect(await buy("antifaz-carnaval")).toMatchObject({ ok: true });
    expect(await buy("antifaz-carnaval")).toEqual({ ok: false, item: "antifaz-carnaval", error: "owned" });
    await bagOf(room).flush("u-alice");
    expect(bagOf(room).count("u-alice", objItemId("maicena"))).toBe(maicena.gives);
  });

  it("fuera del Carnaval está cerrado", async () => {
    const { buy } = await setup({ day: CARNAVAL_DAY - 1, points: 300 });
    expect(await buy("serpentinas")).toEqual({ ok: false, item: "serpentinas", error: "off" });
    expect(await repo.getPoints("u-alice")).toBe(300);
  });
});
