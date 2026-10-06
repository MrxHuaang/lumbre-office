// La Feria de la cosecha en la sala (ver rooms/cosecha.ts): el mercado (precios del día, tope de ventas,
// lo que venden los puestos), la olla del sancocho (aportes, se llena, hierve y sirve a los de cerca), el
// concurso de la ahuyama (la báscula, el ranking y la premiación al cierre), la tómbola (boletas y el sorteo
// fijado) y la ahuyama pesada que sale del huerto.
import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, pointsOfType, puestoDePunto } from "@hyvento/map";
import {
  CANASTO,
  COSECHA,
  COSECHA_SITIOS,
  DIRECTOR_MSG,
  MSG,
  COSECHA_CINE,
  COSECHA_MSG,
  DIAS_POR_ESTACION,
  FESTIVAL_MSG,
  OLLA_RECETA,
  ROOM_NAME,
  SANCOCHO_PLATO,
  SEASONS,
  STAT_KEYS,
  TOMBOLA_PREMIO,
  ahuyamaId,
  baileKey,
  boletasKey,
  cropById,
  objItemId,
  pesoAhuyama,
  plotReadyAt,
  precioDeCompra,
  seedsOf,
  ventasKey,
  type AportarResult,
  type BaileProgreso,
  type DirectorResult,
  type BoletaResult,
  type ComprarResult,
  type CosechaMine,
  type FestivalCineEvent,
  type PesarResult,
  type PlotState,
  type SancochoServido,
  type VenderResult,
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
const COSECHA_DAY = SEASONS.indexOf("otono") * DIAS_POR_ESTACION + (10 - 1);

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
  OfficeRoom.cosechaNow = () => now;
  OfficeRoom.cosechaTimings = { hervirMs: 0, premiacionDelayMs: 0, tombolaDelayMs: 0 };
  OfficeRoom.gameClockNow = () => clock;
  OfficeRoom.weatherInitial = "despejado";
});
afterEach(() => {
  OfficeRoom.cosechaNow = () => Date.now();
  OfficeRoom.cosechaRandom = (max) => Math.floor(Math.random() * max);
  OfficeRoom.cosechaTimings = { hervirMs: COSECHA.hervirMs, premiacionDelayMs: COSECHA.premiacionDelayMs, tombolaDelayMs: COSECHA.tombolaDelayMs };
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

type Inner = { festivales: { tick(): void }; syncFestival(): void; cosecha: { tick(): void }; achievements: { flushAll(): Promise<void> } };

async function setup(opts: { day?: number; hour?: number } = {}) {
  OfficeRoom.gameClockInitial = { anchorReal: NOON, anchorMinute: (opts.day ?? COSECHA_DAY) * 1440 + (opts.hour ?? 12) * 60 };
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  return { room, inner: room as unknown as Inner };
}

async function join(room: ServerRoom, userId: string, name: string, opts: { points?: number; items?: Record<string, number>; admin?: boolean } = {}) {
  if (opts.points) await repo.awardPoints({ userId, amount: opts.points, reason: "ADMIN" });
  for (const [item, n] of Object.entries(opts.items ?? {})) await repo.addInventory(userId, item, n);
  const client = await colyseus.connectTo(room, { token: await token(userId, name, "ada", opts.admin ? "ADMIN" : "MEMBER") });
  await room.waitForNextPatch();
  return { client, userId, ...listen(client) };
}

function listen(client: ClientRoom) {
  const lists = { vender: [] as VenderResult[], comprar: [] as ComprarResult[], aportar: [] as AportarResult[], pesar: [] as PesarResult[], boleta: [] as BoletaResult[] };
  const mine: CosechaMine[] = [];
  const cines: FestivalCineEvent[] = [];
  const servidos: SancochoServido[] = [];
  const bailes: BaileProgreso[] = [];
  const director: DirectorResult[] = [];
  client.onMessage(COSECHA_MSG.baile, (r: BaileProgreso) => bailes.push(r));
  client.onMessage(DIRECTOR_MSG.result, (r: DirectorResult) => director.push(r));
  client.onMessage(COSECHA_MSG.venderResult, (r: VenderResult) => lists.vender.push(r));
  client.onMessage(COSECHA_MSG.comprarResult, (r: ComprarResult) => lists.comprar.push(r));
  client.onMessage(COSECHA_MSG.aportarResult, (r: AportarResult) => lists.aportar.push(r));
  client.onMessage(COSECHA_MSG.pesarResult, (r: PesarResult) => lists.pesar.push(r));
  client.onMessage(COSECHA_MSG.boletaResult, (r: BoletaResult) => lists.boleta.push(r));
  client.onMessage(COSECHA_MSG.mine, (r: CosechaMine) => mine.push(r));
  client.onMessage(COSECHA_MSG.servido, (r: SancochoServido) => servidos.push(r));
  client.onMessage(FESTIVAL_MSG.cine, (e: FestivalCineEvent) => cines.push(e));
  const ask = async <T>(list: T[], type: string, msg: unknown) => {
    const before = list.length;
    client.send(type, msg);
    const r = await waitFor(() => list[before]);
    now += COSECHA.cooldownMs + 1;
    return r;
  };
  return {
    cines,
    mine,
    servidos,
    bailes,
    /** Un momento del director (con el permiso: admin). */
    momento: (id: string) => ask(director, DIRECTOR_MSG.action, { kind: "momento", id }),
    vender: (puesto: string, item: string, n: number) => ask(lists.vender, COSECHA_MSG.vender, { puesto, item, n }),
    comprar: (puesto: string, item: string) => ask(lists.comprar, COSECHA_MSG.comprar, { puesto, item }),
    aportar: (item: string, n: number) => ask(lists.aportar, COSECHA_MSG.aportar, { item, n }),
    pesar: () => ask(lists.pesar, COSECHA_MSG.pesar, {}),
    boleta: () => ask(lists.boleta, COSECHA_MSG.boleta, {}),
  };
}

const jardin = () => getWorld().areas.get("jardin")!;
const point = (type: "cosecha_olla" | "cosecha_bascula" | "cosecha_tombola") => pointsOfType(jardin(), type)[0]!;
const puestoPt = (id: string) => pointsOfType(jardin(), "cosecha_puesto").find((p) => puestoDePunto(p) === id)!;
const count = (room: ServerRoom, userId: string, itemId: string) => bagOf(room).count(userId, itemId);

describe("el mercado campesino", () => {
  it("compra lo cosechado con el precio del día (GIFT), lejos no y en otro puesto no, y fuera de la feria tampoco", async () => {
    const { room } = await setup();
    const alice = await join(room, "u-alice", "Alice", { items: { [objItemId("papa")]: 5, [objItemId("fresa")]: 2 } });
    expect([room.state.festival, room.state.festivalFase]).toEqual([COSECHA.id, "fiesta"]);
    expect(await alice.vender("tuberculos", "papa", 2)).toEqual({ ok: false, puesto: "tuberculos", item: "papa", error: "far" });
    const p = puestoPt("tuberculos");
    await walkToTile(alice.client, room, p.tileX, p.tileY);
    const precio = precioDeCompra("tuberculos", "papa", COSECHA_DAY, 12 * 60)!;
    expect(await alice.vender("tuberculos", "papa", 2)).toMatchObject({ ok: true, n: 2, puntos: 2 * precio, vendido: 2 * precio });
    expect(repo.ledger.at(-1)).toMatchObject({ userId: "u-alice", amount: 2 * precio, reason: "GIFT" });
    await bagOf(room).flush("u-alice");
    expect(count(room, "u-alice", objItemId("papa"))).toBe(3);
    // Las fresas no las compra el de los tubérculos; más de lo que tiene, tampoco.
    expect(await alice.vender("tuberculos", "fresa", 1)).toMatchObject({ ok: false, error: "nocompra" });
    expect(await alice.vender("tuberculos", "papa", 9)).toMatchObject({ ok: false, error: "faltan" });
    expect(alice.mine.at(-1)?.vendido).toBe(2 * precio);
  });

  it("el tope de la feria: vende hasta donde alcanza y después ya no paga", async () => {
    const { room, inner } = await setup();
    await repo.awardPoints({ userId: "u-bob", amount: 1, reason: "ADMIN" });
    const bob = await join(room, "u-bob", "Bob", { items: { [objItemId("papa")]: 10 } });
    // Ya vendió casi todo lo que el mercado paga en esta feria.
    const p = puestoPt("tuberculos");
    await walkToTile(bob.client, room, p.tileX, p.tileY);
    const precio = precioDeCompra("tuberculos", "papa", COSECHA_DAY, 12 * 60)!;
    (room as unknown as { achievements: { max(u: string, k: string, v: number): void } }).achievements.max("u-bob", ventasKey(1), COSECHA.topeVentas - precio);
    const r = await bob.vender("tuberculos", "papa", 5);
    expect(r).toMatchObject({ ok: true, n: 1, vendido: COSECHA.topeVentas });
    expect(await bob.vender("tuberculos", "papa", 1)).toMatchObject({ ok: false, error: "tope" });
    await inner.achievements.flushAll();
    expect((await repo.loadAchievements("u-bob")).stats[ventasKey(1)]).toBe(COSECHA.topeVentas);
  });

  it("los puestos venden semillas raras y canastos (PURCHASE) solo con la feria", async () => {
    const { room } = await setup();
    const alice = await join(room, "u-alice", "Alice", { points: 200 });
    const g = puestoPt("granos");
    await walkToTile(alice.client, room, g.tileX, g.tileY);
    const semilla = seedsOf("frijol");
    expect(await alice.comprar("granos", semilla)).toMatchObject({ ok: true, item: semilla });
    expect(repo.ledger.at(-1)).toMatchObject({ reason: "PURCHASE", refId: `festival:cosecha:granos:${semilla}` });
    expect(await alice.comprar("granos", "arepa-choclo")).toMatchObject({ ok: false, error: "nada" });
    const a = puestoPt("ahuyamas");
    await walkToTile(alice.client, room, a.tileX, a.tileY);
    expect(await alice.comprar("ahuyamas", CANASTO)).toMatchObject({ ok: true });
    await bagOf(room).flush("u-alice");
    expect(count(room, "u-alice", objItemId(semilla))).toBe(1);
    expect(count(room, "u-alice", CANASTO)).toBe(1);
  });

  it("fuera de la feria el mercado está cerrado", async () => {
    const { room } = await setup({ day: COSECHA_DAY - 1 });
    const alice = await join(room, "u-alice", "Alice", { items: { [objItemId("papa")]: 2 } });
    expect(await alice.vender("tuberculos", "papa", 1)).toMatchObject({ ok: false, error: "off" });
  });
});

describe("la olla del sancocho", () => {
  it("se llena entre todos, hierve y sirve un plato a cada quien que esté cerca; después empieza otra olla", async () => {
    const { room, inner } = await setup();
    const items = Object.fromEntries(Object.entries(OLLA_RECETA).map(([k, n]) => [objItemId(k), n]));
    const alice = await join(room, "u-alice", "Alice", { items });
    const bob = await join(room, "u-bob", "Bob", { items: { [objItemId("papa")]: 2 } });
    expect(await alice.aportar("papa", 2)).toMatchObject({ ok: false, error: "far" });
    const o = point("cosecha_olla");
    await walkToTile(alice.client, room, o.tileX, o.tileY);
    await walkToTile(bob.client, room, o.tileX, o.tileY);
    expect(await bob.aportar("papa", 2)).toEqual({ ok: true, item: "papa", n: 2, llena: false });
    // Echa lo que falta (de la papa, solo lo que queda) y nada de más.
    expect(await alice.aportar("papa", 20)).toEqual({ ok: true, item: "papa", n: OLLA_RECETA.papa! - 2, llena: false });
    expect(await alice.aportar("papa", 1)).toMatchObject({ ok: false, error: "nofalta" });
    const resto = Object.keys(OLLA_RECETA).filter((k) => k !== "papa");
    for (const [i, item] of resto.entries()) expect(await alice.aportar(item, 20)).toMatchObject({ ok: true, llena: i === resto.length - 1 });
    expect(room.state.cosecha.ollaFase).toBe("hirviendo");
    expect(await bob.aportar("papa", 1)).toMatchObject({ ok: false, error: "hirviendo" });
    // Sin la espera de los tests, el próximo tic la sirve.
    inner.cosecha.tick();
    await waitFor(() => (alice.servidos.length && bob.servidos.length ? true : undefined));
    expect(alice.servidos[0]).toEqual({ olla: 1, plato: true });
    await waitFor(() => (alice.cines.some((c) => c.id === COSECHA_CINE.sancocho) ? true : undefined));
    await bagOf(room).flush("u-alice");
    await bagOf(room).flush("u-bob");
    expect(count(room, "u-alice", objItemId(SANCOCHO_PLATO))).toBe(1);
    expect(count(room, "u-bob", objItemId(SANCOCHO_PLATO))).toBe(1);
    await room.waitForNextPatch();
    expect([room.state.cosecha.olla, room.state.cosecha.ollaFase, room.state.cosecha.aportado.size]).toEqual([2, "llenando", 0]);
    await inner.achievements.flushAll();
    expect((await repo.loadAchievements("u-alice")).stats[STAT_KEYS.sancochoAportes]).toBe(Object.values(OLLA_RECETA).reduce((a, b) => a + b, 0) - 2);
  });
});

describe("el concurso de la ahuyama más grande", () => {
  it("la báscula pesa la de la mano; una más pesada reemplaza a la de antes (que vuelve) y una más liviana no", async () => {
    const { room } = await setup();
    const alice = await join(room, "u-alice", "Alice", { items: { [objItemId(ahuyamaId(600))]: 1, [objItemId(ahuyamaId(900))]: 1, [objItemId(ahuyamaId(400))]: 1 } });
    const b = point("cosecha_bascula");
    await holdItem(alice.client, room, objItemId(ahuyamaId(600)));
    expect(await alice.pesar()).toEqual({ ok: false, error: "far" });
    await walkToTile(alice.client, room, b.tileX, b.tileY);
    expect(await alice.pesar()).toEqual({ ok: true, dag: 600, puesto: 1, devuelta: null });
    await holdItem(alice.client, room, objItemId(ahuyamaId(400)));
    expect(await alice.pesar()).toEqual({ ok: false, error: "menos", dag: 400 });
    await holdItem(alice.client, room, objItemId(ahuyamaId(900)));
    expect(await alice.pesar()).toEqual({ ok: true, dag: 900, puesto: 1, devuelta: 600 });
    await bagOf(room).flush("u-alice");
    expect(count(room, "u-alice", objItemId(ahuyamaId(600)))).toBe(1);
    expect(count(room, "u-alice", objItemId(ahuyamaId(900)))).toBe(0);
    expect(room.state.cosecha.ahuyamas.get("u-alice")).toMatchObject({ name: "Alice", dag: 900 });
    // Sin ahuyama en la mano no se pesa nada.
    await holdItem(alice.client, room, objItemId(ahuyamaId(400)));
    const bob = await join(room, "u-bob", "Bob");
    await walkToTile(bob.client, room, b.tileX, b.tileY);
    expect(await bob.pesar()).toEqual({ ok: false, error: "none" });
  });

  it("al cierre gana la más pesada: cinemática, premio una vez y el logro", async () => {
    const { room, inner } = await setup();
    const alice = await join(room, "u-alice", "Alice", { items: { [objItemId(ahuyamaId(700))]: 1 } });
    const bob = await join(room, "u-bob", "Bob", { items: { [objItemId(ahuyamaId(1100))]: 1 } });
    const b = point("cosecha_bascula");
    for (const [p, dag] of [[alice, 700], [bob, 1100]] as const) {
      await holdItem(p.client, room, objItemId(ahuyamaId(dag)));
      await walkToTile(p.client, room, b.tileX, b.tileY);
      expect(await p.pesar()).toMatchObject({ ok: true, dag });
    }
    clock = NOON + 10 * 60 * GAME_MINUTE_MS + 1;
    inner.festivales.tick();
    inner.cosecha.tick();
    inner.cosecha.tick();
    const cine = await waitFor(() => alice.cines.find((c) => c.id === COSECHA_CINE.premiacion));
    expect(cine.vars).toMatchObject({ ganador: "Bob", peso: "11,00 kg", ahuyama: ahuyamaId(1100) });
    await waitFor(() => (repo.ledger.some((m) => m.userId === "u-bob" && m.reason === "LEISURE") ? true : undefined));
    expect(repo.ledger.find((m) => m.userId === "u-bob" && m.reason === "LEISURE")).toMatchObject({ amount: COSECHA.premioAhuyama });
    await inner.achievements.flushAll();
    expect((await repo.loadAchievements("u-bob")).unlocked).toContain("ahuyama-de-oro");
    inner.cosecha.tick();
    await tick(60);
    expect(alice.cines.filter((c) => c.id === COSECHA_CINE.premiacion)).toHaveLength(1);
  });

  it("la ahuyama sale del huerto con el peso de su cuidado", async () => {
    const { room } = await setup();
    const alice = await join(room, "u-alice", "Alice", { items: { [objItemId(seedsOf("ahuyama"))]: 1 } });
    await holdItem(alice.client, room, objItemId(seedsOf("ahuyama")));
    const plot = pointsOfType(jardin(), "garden_plot")[0]!;
    const huerto = (room as unknown as { huerto: { use(map: unknown, who: unknown, e: unknown, now: number): Promise<unknown>; plot(id: number): PlotState | undefined } }).huerto;
    const who = { userId: "u-alice", name: "Alice", x: (plot.tileX + 0.5) * 32, y: (plot.tileY + 0.5) * 32 };
    const e = { type: "garden-plot", x: plot.tileX, y: plot.tileY, action: "plot", seed: 1 };
    const t0 = Date.now();
    expect(await huerto.use(jardin(), who, e, t0)).toMatchObject({ ok: true, event: { garden: "plant" } });
    const sembrada = huerto.plot(0)!;
    const dag = pesoAhuyama({ growMs: cropById("ahuyama")!.growMs, plantedAt: sembrada.plantedAt, readyAt: plotReadyAt(sembrada), plantedBy: "u-alice" });
    expect(await huerto.use(jardin(), who, e, t0 + 10 * 60 * 60_000)).toMatchObject({ ok: true, event: { garden: "harvest" } });
    await bagOf(room).flush("u-alice");
    expect(count(room, "u-alice", objItemId(ahuyamaId(dag)))).toBe(1);
  });
});

describe("la tómbola de la junta", () => {
  it("pocas boletas por persona (PURCHASE) y al cierre el sorteo fijado da la carreta y el logro", async () => {
    const { room, inner } = await setup();
    OfficeRoom.cosechaRandom = () => COSECHA.boletasMax; // la primera boleta de Bob
    const alice = await join(room, "u-alice", "Alice", { points: 100 });
    const bob = await join(room, "u-bob", "Bob", { points: COSECHA.boletaPrecio });
    const t = point("cosecha_tombola");
    expect(await alice.boleta()).toEqual({ ok: false, error: "far" });
    await walkToTile(alice.client, room, t.tileX, t.tileY);
    for (let i = 1; i <= COSECHA.boletasMax; i++) expect(await alice.boleta()).toMatchObject({ ok: true, n: i });
    expect(await alice.boleta()).toEqual({ ok: false, error: "max" });
    expect(repo.ledger.at(-1)).toMatchObject({ amount: -COSECHA.boletaPrecio, reason: "PURCHASE", refId: `festival:cosecha:1:boleta:${COSECHA.boletasMax}` });
    await walkToTile(bob.client, room, t.tileX, t.tileY);
    expect(await bob.boleta()).toMatchObject({ ok: true, n: 1 });
    expect(await bob.boleta()).toEqual({ ok: false, error: "funds" });
    expect(room.state.cosecha.boletas).toBe(COSECHA.boletasMax + 1);
    clock = NOON + 10 * 60 * GAME_MINUTE_MS + 1;
    inner.festivales.tick();
    inner.cosecha.tick();
    inner.cosecha.tick();
    const cine = await waitFor(() => alice.cines.find((c) => c.id === COSECHA_CINE.tombola));
    expect(cine.vars).toMatchObject({ ganador: "Bob" });
    await bagOf(room).flush("u-bob");
    expect(count(room, "u-bob", TOMBOLA_PREMIO)).toBe(1);
    await inner.achievements.flushAll();
    const a = await repo.loadAchievements("u-alice");
    expect(a.stats[boletasKey(1)]).toBe(COSECHA.boletasMax);
    expect((await repo.loadAchievements("u-bob")).unlocked).toContain("suerte-de-tombola");
  });
});

/** Baila (el emote "Bailar") sin la pausa de los emotes: los tests corren el reloj de la feria a mano. */
async function bailar(room: ServerRoom, p: { client: ClientRoom }) {
  const c = room.clients.find((x) => x.sessionId === p.client.sessionId) as unknown as { userData?: { emoteTimes?: number[] } };
  if (c.userData) c.userData.emoteTimes = [];
  p.client.send(MSG.emote, { emote: "dance" });
  await tick(40);
}

describe("el baile de la cosecha", () => {
  it("solo cuenta bailando en la pista del patio con el baile andando; en pareja vale doble y completo da el logro y el premio una vez", async () => {
    const { room, inner } = await setup({ hour: 17 });
    const alice = await join(room, "u-alice", "Alice");
    const bob = await join(room, "u-bob", "Bob");
    // A las 17:00 suena la música pero el baile no ha empezado.
    inner.cosecha.tick();
    expect(room.state.cosecha.baile).toBe(false);
    await walkToTile(alice.client, room, COSECHA_SITIOS.patio.x, COSECHA_SITIOS.patio.y);
    await bailar(room, alice);
    expect(alice.bailes).toHaveLength(0);
    // 17:30: arranca el baile.
    clock = NOON + 30 * GAME_MINUTE_MS + 1;
    inner.cosecha.tick();
    expect(room.state.cosecha.baile).toBe(true);
    // Bob baila lejos de la pista: no cuenta.
    await bailar(room, bob);
    expect(bob.bailes).toHaveLength(0);
    await bailar(room, alice);
    expect(await waitFor(() => alice.bailes[0])).toEqual({ pasos: 1, meta: COSECHA.bailePasos, pareja: false });
    // Repetir el botón seguido no cuenta.
    now += 500;
    await bailar(room, alice);
    expect(alice.bailes).toHaveLength(1);
    // Bob llega al lado: los dos bailan en pareja y cada paso vale doble.
    await walkToTile(bob.client, room, COSECHA_SITIOS.patio.x + 1, COSECHA_SITIOS.patio.y);
    now += COSECHA.bailePasoMs;
    await bailar(room, bob);
    expect(await waitFor(() => bob.bailes[0])).toEqual({ pasos: 2, meta: COSECHA.bailePasos, pareja: true });
    for (let i = 0; i < 3; i++) {
      now += COSECHA.bailePasoMs;
      await bailar(room, bob);
      await bailar(room, alice);
    }
    const fin = await waitFor(() => alice.bailes.find((b) => b.pasos === COSECHA.bailePasos));
    expect(fin).toMatchObject({ pareja: true, premio: COSECHA.premioBaile });
    expect(repo.ledger.filter((m) => m.userId === "u-alice" && m.reason === "LEISURE")).toHaveLength(1);
    // Ya bailó en esta feria: más pasos no cuentan ni pagan.
    now += COSECHA.bailePasoMs;
    const n = alice.bailes.length;
    await bailar(room, alice);
    await tick(80);
    expect(alice.bailes).toHaveLength(n);
    await inner.achievements.flushAll();
    const a = await repo.loadAchievements("u-alice");
    expect(a.unlocked).toContain("bambuquero");
    expect(a.stats[baileKey(1)]).toBe(1);
    // Al cierre, el baile se acaba.
    clock = NOON + (4 * 60 + 30) * GAME_MINUTE_MS + 1;
    inner.cosecha.tick();
    expect(room.state.cosecha.baile).toBe(false);
  });
});

describe("el director en la Feria de la cosecha", () => {
  it("arranca el baile, llena la olla y hace la premiación con el sorteo ya; sin la feria, no", async () => {
    const { room, inner } = await setup({ day: COSECHA_DAY - 1 });
    const ana = await join(room, "u-ana", "Ana", { admin: true, points: 100, items: { [objItemId(ahuyamaId(800))]: 1 } });
    expect(await ana.momento("cosecha-baile")).toMatchObject({ ok: false, error: "festival", festival: "cosecha" });
    // Ya en la feria (al mediodía, sin baile todavía).
    clock = NOON + 24 * 60 * GAME_MINUTE_MS;
    inner.festivales.tick();
    inner.syncFestival();
    inner.cosecha.tick();
    await room.waitForNextPatch();
    expect([room.state.festival, room.state.cosecha.baile]).toEqual([COSECHA.id, false]);
    await walkToTile(ana.client, room, COSECHA_SITIOS.patio.x, COSECHA_SITIOS.patio.y);
    expect(await ana.momento("cosecha-baile")).toMatchObject({ ok: true });
    expect(room.state.cosecha.baile).toBe(true);
    await waitFor(() => ana.cines.find((c) => c.id === COSECHA_CINE.baile));
    inner.cosecha.tick();
    expect(room.state.cosecha.baile).toBe(true);
    expect(await ana.momento("cosecha-baile")).toMatchObject({ ok: false, error: "ocupado" });
    // La olla: se llena sola y sirve a los de cerca.
    expect(await ana.momento("cosecha-olla")).toMatchObject({ ok: true });
    expect(room.state.cosecha.ollaFase).toBe("hirviendo");
    expect(await ana.momento("cosecha-olla")).toMatchObject({ ok: false, error: "ocupado" });
    inner.cosecha.tick();
    expect(await waitFor(() => ana.servidos[0])).toEqual({ olla: 1, plato: true });
    // Sin ahuyamas ni boletas no hay nada que premiar; con una, sí (una vez).
    expect(await ana.momento("cosecha-cierre")).toMatchObject({ ok: false, error: "nada" });
    const b = point("cosecha_bascula");
    await holdItem(ana.client, room, objItemId(ahuyamaId(800)));
    await walkToTile(ana.client, room, b.tileX, b.tileY);
    expect(await ana.pesar()).toMatchObject({ ok: true, dag: 800 });
    expect(await ana.momento("cosecha-cierre")).toMatchObject({ ok: true });
    expect((await waitFor(() => ana.cines.find((c) => c.id === COSECHA_CINE.premiacion))).vars).toMatchObject({ ganador: "Ana" });
    expect(await ana.momento("cosecha-cierre")).toMatchObject({ ok: false, error: "nada" });
  });
});
