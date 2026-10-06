// El Festival de cometas en la sala (ver rooms/cometas.ts): el puesto solo en el festival, armar la cometa
// con los materiales, volarla en el voladero (la sala repite el vuelo y valida los cuadros contra su
// reloj), el viento del clima (con lluvia no se vuela), el récord del día, la votación una vez, la cometa
// del techo del garaje y la premiación al cierre.
import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, pointsOfType } from "@hyvento/map";
import {
  autoVuelo,
  COMETAS,
  COMETAS_CINE,
  COMETAS_MSG,
  COMETA_PERDIDA,
  cometaId,
  cometasShopItem,
  cometasTechoKey,
  cometasVoteKey,
  DIAS_POR_ESTACION,
  FESTIVAL_MSG,
  MATERIAL,
  objItemId,
  ROOM_NAME,
  SEASONS,
  STAT_KEYS,
  vientoDelClima,
  VUELO_FRAME_MS,
  type ArmarResult,
  type CometaConcursoResult,
  type CometasBuyResult,
  type CometasMine,
  type FestivalCineEvent,
  type TechoResult,
  type VolarResult,
  type VueloEnd,
  type VueloStart,
} from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bagOf, bootServer, holdItem, tick, token, walkToTile, type ServerRoom } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
let now = 10_000_000;
let clock = 0;

const NOON = Date.UTC(2026, 8, 26, 17, 0);
const GAME_MINUTE_MS = 2_500;
const dayOf = (season: (typeof SEASONS)[number], dia: number) => SEASONS.indexOf(season) * DIAS_POR_ESTACION + (dia - 1);
const COMETAS_DAY = dayOf("verano", 9);
/** Un tile del voladero, libre. */
const LOMA = { x: 121, y: 57 };

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
  now = 10_000_000;
  clock = NOON;
  OfficeRoom.cometasNow = () => now;
  OfficeRoom.cometasRandom = () => 4242;
  OfficeRoom.cometasPremiacionMs = 0;
  OfficeRoom.gameClockNow = () => clock;
  OfficeRoom.weatherInitial = "nublado";
});
afterEach(() => {
  OfficeRoom.cometasNow = () => Date.now();
  OfficeRoom.cometasPremiacionMs = COMETAS.premiacionDelayMs;
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

type Inner = { festivales: { tick(): void }; cometas: { tick(): void }; achievements: { flushAll(): Promise<void> } };

async function setup(opts: { day?: number; hour?: number } = {}) {
  OfficeRoom.gameClockInitial = { anchorReal: NOON, anchorMinute: (opts.day ?? COMETAS_DAY) * 1440 + (opts.hour ?? 15) * 60 };
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  return { room, inner: room as unknown as Inner };
}

async function join(room: ServerRoom, userId: string, name: string, opts: { points?: number; items?: Record<string, number> } = {}) {
  if (opts.points) await repo.awardPoints({ userId, amount: opts.points, reason: "ADMIN" });
  for (const [item, n] of Object.entries(opts.items ?? {})) await repo.addInventory(userId, objItemId(item), n);
  const client = await colyseus.connectTo(room, { token: await token(userId, name) });
  await room.waitForNextPatch();
  return { client, userId, ...listen(client) };
}

function listen(client: ClientRoom) {
  const lists = {
    armar: [] as ArmarResult[],
    comprar: [] as CometasBuyResult[],
    vuelo: [] as VolarResult[],
    fin: [] as VueloEnd[],
    concurso: [] as CometaConcursoResult[],
    techo: [] as TechoResult[],
    mine: [] as CometasMine[],
    cines: [] as FestivalCineEvent[],
  };
  client.onMessage(COMETAS_MSG.armarResult, (r: ArmarResult) => lists.armar.push(r));
  client.onMessage(COMETAS_MSG.comprarResult, (r: CometasBuyResult) => lists.comprar.push(r));
  client.onMessage(COMETAS_MSG.vuelo, (r: VolarResult) => lists.vuelo.push(r));
  client.onMessage(COMETAS_MSG.fin, (r: VueloEnd) => lists.fin.push(r));
  client.onMessage(COMETAS_MSG.concursoResult, (r: CometaConcursoResult) => lists.concurso.push(r));
  client.onMessage(COMETAS_MSG.techoResult, (r: TechoResult) => lists.techo.push(r));
  client.onMessage(COMETAS_MSG.mine, (r: CometasMine) => lists.mine.push(r));
  client.onMessage(FESTIVAL_MSG.cine, (e: FestivalCineEvent) => lists.cines.push(e));
  const ask = async <T>(list: T[], type: string, msg: unknown = {}) => {
    const before = list.length;
    client.send(type, msg);
    const r = await waitFor(() => list[before]);
    now += COMETAS.cooldownMs + 1;
    return r;
  };
  return {
    ...lists,
    armar: (code: string) => ask(lists.armar, COMETAS_MSG.armar, { code }),
    comprar: (item: string) => ask(lists.comprar, COMETAS_MSG.comprar, { item }),
    volar: () => ask(lists.vuelo, COMETAS_MSG.volar),
    inscribir: () => ask(lists.concurso, COMETAS_MSG.inscribir),
    votar: (owner: string) => ask(lists.concurso, COMETAS_MSG.votar, { owner }),
    techo: () => ask(lists.techo, COMETAS_MSG.techo),
    fines: lists.fin,
    cineList: lists.cines,
    mines: lists.mine,
  };
}

const jardin = () => getWorld().areas.get("jardin")!;
const point = (type: "cometas_taller" | "cometas_concurso" | "cometas_techo" | "festival_shop") => pointsOfType(jardin(), type)[0]!;
const count = (room: ServerRoom, userId: string, itemId: string) => bagOf(room).count(userId, itemId);
const materiales = { [MATERIAL.papel]: 2, [MATERIAL.palitos]: 3, [MATERIAL.hilo]: 1 };

/** Alguien con una cometa ya en la mano, parado en el voladero. */
async function conCometa(room: ServerRoom, userId: string, name: string, code = "rra2") {
  const p = await join(room, userId, name, { items: { [`cometa:${code}`]: 1 } });
  await holdItem(p.client, room, objItemId(cometaId(code)));
  await walkToTile(p.client, room, LOMA.x, LOMA.y);
  return p;
}

describe("el puesto de cometas", () => {
  it("solo vende con el festival abierto; junto al puesto cobra y da a la mochila", async () => {
    const { room } = await setup({ day: COMETAS_DAY - 1 });
    const alice = await join(room, "u-alice", "Alice", { points: 100 });
    expect(await alice.comprar(MATERIAL.papel)).toEqual({ ok: false, item: MATERIAL.papel, error: "off" });
    expect(await repo.getPoints("u-alice")).toBe(100);
  });

  it("en el festival: lejos no; en el puesto sí, con lo que da cada compra", async () => {
    const { room } = await setup();
    const alice = await join(room, "u-alice", "Alice", { points: 100 });
    expect(room.state.festival).toBe(COMETAS.id);
    expect(await alice.comprar(MATERIAL.papel)).toEqual({ ok: false, item: MATERIAL.papel, error: "far" });
    const shop = point("festival_shop");
    await walkToTile(alice.client, room, shop.tileX, shop.tileY);
    const item = cometasShopItem(MATERIAL.papel)!;
    expect(await alice.comprar(MATERIAL.papel)).toEqual({ ok: true, item: MATERIAL.papel, balance: 100 - item.price });
    expect(repo.ledger.at(-1)).toMatchObject({ amount: -item.price, reason: "PURCHASE", refId: `festival:cometas:${MATERIAL.papel}` });
    await bagOf(room).flush("u-alice");
    expect(count(room, "u-alice", objItemId(MATERIAL.papel))).toBe(item.gives);
  });
});

describe("armar la cometa en el taller", () => {
  it("gasta los materiales y la cometa queda en la mano con su código", async () => {
    const { room, inner } = await setup();
    const alice = await join(room, "u-alice", "Alice", { items: materiales });
    expect(await alice.armar("hzb2")).toEqual({ ok: false, error: "far" });
    const t = point("cometas_taller");
    await walkToTile(alice.client, room, t.tileX, t.tileY);
    // La hexagonal lleva tres palitos: con lo que tiene alcanza para una.
    expect(await alice.armar("hzb2")).toEqual({ ok: true, code: "hzb2" });
    await bagOf(room).flush("u-alice");
    expect(count(room, "u-alice", objItemId(MATERIAL.papel))).toBe(0);
    expect(count(room, "u-alice", objItemId(MATERIAL.palitos))).toBe(0);
    expect(count(room, "u-alice", objItemId(cometaId("hzb2")))).toBe(1);
    await room.waitForNextPatch();
    expect(room.state.players.get(alice.client.sessionId)!.held).toBe(cometaId("hzb2"));
    await waitFor(() => (alice.cineList.some((c) => c.id === COMETAS_CINE.armada) ? true : undefined));
    expect(await alice.armar("rra2")).toMatchObject({ ok: false, error: "materiales" });
    await inner.achievements.flushAll();
    expect((await repo.loadAchievements("u-alice")).stats[STAT_KEYS.cometasArmadas]).toBe(1);
  });
});

/** Juega un vuelo como el navegador: los botones de `autoVuelo` mandados por pedazos, con el reloj al día. */
async function volarHasta(p: Awaited<ReturnType<typeof join>>, start: VueloStart, frames: number, recoger = true) {
  const run = autoVuelo({ seed: start.seed, viento: start.viento, code: start.code }, { hasta: frames });
  let sent = 0;
  for (let f = Math.min(300, run.frames); ; f = Math.min(f + 300, run.frames)) {
    now += (f - sent) * VUELO_FRAME_MS;
    p.client.send(f === run.frames && recoger ? COMETAS_MSG.recoger : COMETAS_MSG.paso, { id: start.id, toggles: run.toggles.filter((t) => t >= sent && t < f), frames: f });
    sent = f;
    if (f === run.frames) break;
  }
  return run;
}

describe("volar la cometa", () => {
  it("solo en el voladero, con la cometa en la mano y viento; la sala repite el vuelo y la altura cuenta", async () => {
    const { room, inner } = await setup();
    const sinCometa = await join(room, "u-bob", "Bob");
    expect(await sinCometa.volar()).toEqual({ ok: false, error: "sin-cometa" });
    const alice = await join(room, "u-alice", "Alice", { items: { "cometa:rra2": 1 } });
    await holdItem(alice.client, room, objItemId(cometaId("rra2")));
    expect(await alice.volar()).toEqual({ ok: false, error: "lejos" });
    await walkToTile(alice.client, room, LOMA.x, LOMA.y);
    const start = (await alice.volar()) as VueloStart;
    expect(start).toMatchObject({ ok: true, seed: 4242, viento: vientoDelClima("nublado"), code: "rra2" });
    expect(await alice.volar()).toEqual({ ok: false, error: "ya" });
    expect(room.state.cometas.vuelos.get(alice.client.sessionId)).toMatchObject({ userId: "u-alice", code: "rra2" });
    const run = await volarHasta(alice, start, 1200);
    const fin = await waitFor(() => alice.fines[0]);
    expect(fin).toEqual({ id: start.id, motivo: "recogida", altura: Math.floor(run.sim.altura), record: true });
    expect(fin.altura).toBeGreaterThan(40);
    expect(room.state.cometas.vuelos.size).toBe(0);
    expect(room.state.cometas.recordAltura).toBe(fin.altura);
    expect(room.state.cometas.recordName).toBe("Alice");
    // La primera del día se celebra en la loma.
    await waitFor(() => alice.cineList.find((c) => c.id === COMETAS_CINE.primera));
    await inner.achievements.flushAll();
    expect((await repo.loadAchievements("u-alice")).stats[STAT_KEYS.cometaAltura]).toBe(fin.altura);
  });

  it("los cuadros no pueden ir más rápido que el reloj de la sala", async () => {
    const { room } = await setup();
    const alice = await conCometa(room, "u-alice", "Alice");
    const start = (await alice.volar()) as VueloStart;
    // 20 segundos de vuelo mandados cuando apenas pasó un segundo.
    now += 1000;
    alice.client.send(COMETAS_MSG.recoger, { id: start.id, toggles: [], frames: 600 });
    expect(await waitFor(() => alice.fines[0])).toMatchObject({ motivo: "invalida", altura: 0, record: false });
    expect(room.state.cometas.recordAltura).toBe(0);
  });

  it("sin jalar se cae y no cuenta; moverse la suelta", async () => {
    const { room } = await setup();
    const alice = await conCometa(room, "u-alice", "Alice");
    let start = (await alice.volar()) as VueloStart;
    now += 3000;
    alice.client.send(COMETAS_MSG.paso, { id: start.id, toggles: [], frames: 90 });
    expect(await waitFor(() => alice.fines[0])).toMatchObject({ motivo: "caida", altura: 0 });
    start = (await alice.volar()) as VueloStart;
    await walkToTile(alice.client, room, LOMA.x + 2, LOMA.y);
    expect(await waitFor(() => alice.fines[1])).toMatchObject({ id: start.id, motivo: "cancelada" });
  });

  it("el viento sale del clima: con lluvia no se suelta, y si empieza a llover se recoge la que está en el aire", async () => {
    const { room, inner } = await setup();
    const alice = await conCometa(room, "u-alice", "Alice");
    room.state.weather = "lluvia";
    expect(await alice.volar()).toEqual({ ok: false, error: "lluvia" });
    room.state.weather = "despejado";
    const start = (await alice.volar()) as VueloStart;
    expect(start.viento).toBe(vientoDelClima("despejado"));
    await volarHasta(alice, start, 300, false);
    await tick(60);
    room.state.weather = "tormenta";
    inner.cometas.tick();
    expect(await waitFor(() => alice.fines[0])).toMatchObject({ motivo: "recogida" });
  });

  it("el récord del día es la más alta: una más bajita no lo cambia", async () => {
    const { room } = await setup();
    const alice = await conCometa(room, "u-alice", "Alice");
    const a = (await alice.volar()) as VueloStart;
    await volarHasta(alice, a, 1500);
    const fa = await waitFor(() => alice.fines[0]);
    const bob = await conCometa(room, "u-bob", "Bob", "zza3");
    const b = (await bob.volar()) as VueloStart;
    await volarHasta(bob, b, 300);
    const fb = await waitFor(() => bob.fines[0]);
    expect(fb.altura).toBeLessThan(fa.altura);
    expect(fb.record).toBe(false);
    expect(room.state.cometas.recordName).toBe("Alice");
  });
});

describe("el concurso de la más bonita", () => {
  it("se inscribe la de la mano (una por persona) y se vota una vez, nunca por la propia", async () => {
    const { room, inner } = await setup();
    const alice = await join(room, "u-alice", "Alice", { items: { "cometa:psa1": 1 } });
    await holdItem(alice.client, room, objItemId(cometaId("psa1")));
    expect(await alice.inscribir()).toEqual({ ok: false, error: "far" });
    const board = point("cometas_concurso");
    await walkToTile(alice.client, room, board.tileX, board.tileY);
    expect(await alice.inscribir()).toEqual({ ok: true, accion: "inscribir" });
    expect(await alice.inscribir()).toEqual({ ok: false, error: "ya-inscrita" });
    expect(room.state.cometas.inscritas.get("u-alice")).toMatchObject({ ownerName: "Alice", code: "psa1", votes: 0 });
    expect(await alice.votar("u-alice")).toEqual({ ok: false, error: "propia" });
    const bob = await join(room, "u-bob", "Bob");
    await walkToTile(bob.client, room, board.tileX, board.tileY);
    expect(await bob.inscribir()).toEqual({ ok: false, error: "sin-cometa" });
    expect(await bob.votar("u-nadie")).toEqual({ ok: false, error: "nadie" });
    expect(await bob.votar("u-alice")).toEqual({ ok: true, accion: "votar" });
    expect(await bob.votar("u-alice")).toEqual({ ok: false, error: "votaste" });
    expect(bob.mines.at(-1)).toEqual({ voto: "u-alice", techo: false });
    expect(room.state.cometas.inscritas.get("u-alice")!.votes).toBe(1);
    await inner.achievements.flushAll();
    expect((await repo.loadAchievements("u-bob")).stats[cometasVoteKey(1)]).toBe(1);
  });

  it("al cierre: la más alta y la más bonita, con su cinemática para todos, el logro y el premio", async () => {
    const { room, inner } = await setup();
    const alice = await conCometa(room, "u-alice", "Alice", "hmv2");
    const a = (await alice.volar()) as VueloStart;
    await volarHasta(alice, a, 900);
    const fa = await waitFor(() => alice.fines[0]);
    const board = point("cometas_concurso");
    await walkToTile(alice.client, room, board.tileX, board.tileY);
    expect(await alice.inscribir()).toMatchObject({ ok: true });
    const bob = await join(room, "u-bob", "Bob");
    await walkToTile(bob.client, room, board.tileX, board.tileY);
    expect(await bob.votar("u-alice")).toMatchObject({ ok: true });
    // Las 22:00 del juego: cierra y, sin la espera de los tests, se premia.
    clock = NOON + 7 * 60 * GAME_MINUTE_MS + 1;
    inner.festivales.tick();
    inner.cometas.tick();
    inner.cometas.tick();
    expect(room.state.festivalFase).toBe("fin");
    const cine = await waitFor(() => bob.cineList.find((c) => c.id === COMETAS_CINE.premiacion));
    expect(cine.vars).toMatchObject({ alta: "Alice", altura: fa.altura, bonita: "Alice", votos: 1, codigo: "hmv2" });
    // El premio (ocio, con el tope del día): por lo menos el de la más alta entra.
    await waitFor(() => (repo.ledger.some((m) => m.refId === "festival:cometas:1:alta") ? true : undefined));
    await inner.achievements.flushAll();
    expect((await repo.loadAchievements("u-alice")).stats[STAT_KEYS.cometaPremios]).toBe(2);
  });
});

describe("la cometa del techo del garaje", () => {
  it("junto a la escalera se baja una vez por festival", async () => {
    const { room, inner } = await setup();
    const alice = await join(room, "u-alice", "Alice");
    expect(await alice.techo()).toEqual({ ok: false, error: "far" });
    const t = point("cometas_techo");
    await walkToTile(alice.client, room, t.tileX, t.tileY);
    expect(await alice.techo()).toEqual({ ok: true });
    expect(await alice.techo()).toEqual({ ok: false, error: "ya" });
    await bagOf(room).flush("u-alice");
    expect(count(room, "u-alice", objItemId(COMETA_PERDIDA))).toBe(1);
    expect(alice.mines.at(-1)).toEqual({ voto: null, techo: true });
    await inner.achievements.flushAll();
    expect((await repo.loadAchievements("u-alice")).stats[cometasTechoKey(1)]).toBe(1);
  });
});
