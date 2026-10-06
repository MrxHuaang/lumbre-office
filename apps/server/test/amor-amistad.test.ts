// Amor y amistad en la sala (ver rooms/amorAmistad.ts): anotarse y el sorteo de las 10:00 (nadie se saca a
// sí mismo; los tardíos entran sin romper parejas), los detalles anónimos al amigo secreto (con notita
// moderada), las cartas que Cupido entrega, la serenata (una a la vez, con propina), el puesto solo en el
// festival y la revelación al cierre con el premio de quien dio algo.
import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, pointsOfType } from "@hyvento/map";
import {
  AMOR,
  AMOR_MSG,
  DIAS_POR_ESTACION,
  DIRECTOR_MSG,
  ROOM_NAME,
  SEASONS,
  SERENATA,
  STAT_KEYS,
  amigosDe,
  objItemId,
  serenataRefId,
  type AmorEstado,
  type AmorResultado,
  type CartaLlega,
  type DirectorResult,
  type RegaloLlego,
  type Revelacion,
  type SerenataEvento,
} from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { AMOR_RELOJ, type AmorAmistad } from "../src/rooms/amorAmistad";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bagOf, bootServer, tick, token, walkToTile, type ServerRoom } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
let now = 10_000_000;
let clock = 0;

const NOON = Date.UTC(2026, 8, 26, 17, 0);
const GAME_MINUTE_MS = 2_500;
const dayOf = (season: (typeof SEASONS)[number], dia: number) => SEASONS.indexOf(season) * DIAS_POR_ESTACION + (dia - 1);
const AMOR_DAY = dayOf("primavera", 7);

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
  AMOR_RELOJ.now = () => now;
  AMOR_RELOJ.revelacionMs = 0;
  let s = 7;
  AMOR_RELOJ.random = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  OfficeRoom.gameClockNow = () => clock;
  OfficeRoom.weatherInitial = "despejado";
});
afterEach(() => {
  AMOR_RELOJ.now = () => Date.now();
  AMOR_RELOJ.random = () => Math.random();
  AMOR_RELOJ.revelacionMs = AMOR.revelacionDelayMs;
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

type Inner = { festivales: { tick(): void }; syncFestival(): void; amor: AmorAmistad; achievements: { flushAll(): Promise<void> } };

/** Una sala del día `day` (por defecto, Amor y amistad) a la hora `hour` del juego. */
async function setup(opts: { day?: number; hour?: number } = {}) {
  OfficeRoom.gameClockInitial = { anchorReal: NOON, anchorMinute: (opts.day ?? AMOR_DAY) * 1440 + (opts.hour ?? 9.5) * 60 };
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const inner = room as unknown as Inner;
  inner.festivales.tick();
  inner.syncFestival();
  return { room, inner };
}

/** Pasa el reloj del juego hasta esa hora (desde la de `setup`) y revisa el festival. */
function hora(inner: Inner, h: number, desde = 9.5) {
  clock = NOON + (h - desde) * 60 * GAME_MINUTE_MS;
  inner.festivales.tick();
  inner.amor.tick();
}

async function join(room: ServerRoom, userId: string, name: string, opts: { points?: number; items?: Record<string, number> } = {}) {
  if (opts.points) await repo.awardPoints({ userId, amount: opts.points, reason: "ADMIN" });
  for (const [id, n] of Object.entries(opts.items ?? {})) await repo.addInventory(userId, objItemId(id), n);
  const client = await colyseus.connectTo(room, { token: await token(userId, name) });
  await room.waitForNextPatch();
  return { client, userId, ...listen(client) };
}

function listen(client: ClientRoom) {
  const resultados: AmorResultado[] = [];
  const estados: AmorEstado[] = [];
  const regalos: RegaloLlego[] = [];
  const cartas: CartaLlega[] = [];
  const serenatas: SerenataEvento[] = [];
  const revelaciones: Revelacion[] = [];
  client.onMessage(AMOR_MSG.resultado, (r: AmorResultado) => resultados.push(r));
  client.onMessage(AMOR_MSG.estado, (r: AmorEstado) => estados.push(r));
  client.onMessage(AMOR_MSG.regaloLlego, (r: RegaloLlego) => regalos.push(r));
  client.onMessage(AMOR_MSG.cupido, (r: CartaLlega) => cartas.push(r));
  client.onMessage(AMOR_MSG.serenataEvento, (r: SerenataEvento) => serenatas.push(r));
  client.onMessage(AMOR_MSG.revelacion, (r: Revelacion) => revelaciones.push(r));
  const ask = async (type: string, msg: unknown = {}) => {
    const before = resultados.length;
    client.send(type, msg);
    const r = await waitFor(() => resultados[before]);
    now += AMOR.pausaMs + 1;
    return r;
  };
  return {
    resultados,
    estados,
    regalos,
    cartas,
    serenatas,
    revelaciones,
    estado: () => estados.at(-1),
    anotar: () => ask(AMOR_MSG.anotar),
    regalo: (para: string, item: string, nota = "") => ask(AMOR_MSG.regalo, { para, item, nota }),
    carta: (para: string, texto: string) => ask(AMOR_MSG.carta, { para, texto }),
    serenata: (para: string, propina: number, anonima = false) => ask(AMOR_MSG.serenata, { para, propina, anonima }),
    comprar: (item: string) => ask(AMOR_MSG.comprar, { item }),
  };
}

const jardin = () => getWorld().areas.get("jardin")!;
const point = (type: "amigo_secreto" | "festival_shop" | "amor_serenata" | "mailbox") => pointsOfType(jardin(), type)[0]!;
type P = Awaited<ReturnType<typeof join>>;
const ir = (room: ServerRoom, p: P, type: Parameters<typeof point>[0]) => walkToTile(p.client, room, point(type).tileX, point(type).tileY);

/** Varios anotados junto al cofre. */
async function anotados(room: ServerRoom, gente: [string, string][], opts: Parameters<typeof join>[3] = {}) {
  const out: P[] = [];
  for (const [id, name] of gente) {
    const p = await join(room, id, name, opts);
    await ir(room, p, "amigo_secreto");
    expect(await p.anotar()).toEqual({ accion: "anotar", ok: true });
    out.push(p);
  }
  return out;
}

const parejasDe = (inner: Inner) => (inner.amor as unknown as { parejas: { de: string; para: string }[] }).parejas;

describe("el amigo secreto: anotarse y el sorteo", () => {
  it("anotarse junto al cofre, una vez; el sorteo es a las 10:00 y nadie se saca a sí mismo", async () => {
    const { room, inner } = await setup();
    expect(room.state.festival).toBe(AMOR.id);
    const alice = await join(room, "u-alice", "Alice");
    expect(await alice.anotar()).toEqual({ accion: "anotar", ok: false, error: "lejos" });
    await ir(room, alice, "amigo_secreto");
    expect(await alice.anotar()).toEqual({ accion: "anotar", ok: true });
    expect(await alice.anotar()).toEqual({ accion: "anotar", ok: false, error: "anotado" });
    const [bob, caro] = await anotados(room, [
      ["u-bob", "Bob"],
      ["u-caro", "Caro"],
    ]);
    inner.amor.tick();
    expect(parejasDe(inner)).toEqual([]);
    expect(alice.estado()).toMatchObject({ anotado: true, sorteado: false, amigos: [] });
    hora(inner, 10.1);
    const parejas = parejasDe(inner);
    expect(parejas).toHaveLength(3);
    expect(parejas.every((p) => p.de !== p.para)).toBe(true);
    for (const p of [alice, bob!, caro!]) {
      const e = await waitFor(() => (p.estado()?.amigos.length ? p.estado() : undefined));
      expect(e.sorteado).toBe(true);
      expect(e.amigos).toHaveLength(1);
      expect(e.amigos[0]!.userId).not.toBe(p.userId);
      expect(e.amigos[0]!.online).toBe(true);
    }
  });

  it("los tardíos entran sin romper las parejas que ya había (dos juntos hacen ronda; uno solo, después de esperar)", async () => {
    const { room, inner } = await setup();
    await anotados(room, [
      ["u-a", "Ana"],
      ["u-b", "Beto"],
      ["u-c", "Caro"],
    ]);
    hora(inner, 10.1);
    const antes = [...parejasDe(inner)];
    expect(antes).toHaveLength(3);
    // Dos tardíos: su propia ronda.
    await anotados(room, [
      ["u-d", "Dani"],
      ["u-e", "Eli"],
    ]);
    inner.amor.tick();
    expect(parejasDe(inner).slice(0, 3)).toEqual(antes);
    expect(amigosDe(parejasDe(inner), "u-d")).toEqual(["u-e"]);
    expect(amigosDe(parejasDe(inner), "u-e")).toEqual(["u-d"]);
    // Uno solo: espera un ratico por si llega otro; después entra con dos parejas nuevas.
    const cinco = [...parejasDe(inner)];
    const [fer] = await anotados(room, [["u-f", "Fer"]]);
    inner.amor.tick();
    expect(amigosDe(parejasDe(inner), "u-f")).toEqual([]);
    now += AMOR.tardioEsperaMs;
    inner.amor.tick();
    expect(parejasDe(inner).slice(0, 5)).toEqual(cinco);
    expect(parejasDe(inner)).toHaveLength(7);
    expect(amigosDe(parejasDe(inner), "u-f")).toHaveLength(1);
    expect(parejasDe(inner).filter((p) => p.para === "u-f")).toHaveLength(1);
    expect(parejasDe(inner).every((p) => p.de !== p.para)).toBe(true);
    await waitFor(() => (fer!.estado()?.amigos.length ? true : undefined));
  });

  it("fuera del festival no se anota nadie", async () => {
    const { room } = await setup({ day: AMOR_DAY - 1 });
    const alice = await join(room, "u-alice", "Alice");
    expect(room.state.festival).toBe("");
    expect(await alice.anotar()).toEqual({ accion: "anotar", ok: false, error: "off" });
  });
});

describe("los detalles anónimos", () => {
  it("se dejan en el cofre al amigo (con notita moderada) y le llegan sin decir de quién", async () => {
    const { room, inner } = await setup();
    const [ana, beto] = await anotados(
      room,
      [
        ["u-a", "Ana"],
        ["u-b", "Beto"],
      ],
      { items: { "chocolatina-corazon": 2, celular: 1 } },
    );
    // Antes del sorteo no hay a quién.
    expect(await ana!.regalo("u-b", objItemId("chocolatina-corazon"))).toMatchObject({ ok: false, error: "sinSorteo" });
    hora(inner, 10.1);
    // Con dos, Ana le regala a Beto.
    expect(amigosDe(parejasDe(inner), "u-a")).toEqual(["u-b"]);
    expect(await ana!.regalo("u-x", objItemId("chocolatina-corazon"))).toMatchObject({ ok: false, error: "noAmigo" });
    expect(await ana!.regalo("u-b", objItemId("celular"))).toMatchObject({ ok: false, error: "item" });
    expect(await ana!.regalo("u-b", objItemId("tinto"))).toMatchObject({ ok: false, error: "item" });
    expect(await ana!.regalo("u-b", objItemId("chocolatina-corazon"), "para el más gonorrea")).toMatchObject({ ok: false, error: "grosero" });
    expect(await ana!.regalo("u-b", objItemId("chocolatina-corazon"), "mire www.algo.com")).toMatchObject({ ok: false, error: "enlace" });
    expect(await ana!.regalo("u-b", objItemId("chocolatina-corazon"), "  Para que endulce el día  ")).toEqual({ accion: "regalo", ok: true, item: objItemId("chocolatina-corazon") });
    const llego = await waitFor(() => beto!.regalos[0]);
    expect(llego).toEqual({ item: objItemId("chocolatina-corazon"), nota: "Para que endulce el día" });
    expect(JSON.stringify(llego)).not.toContain("Ana");
    await bagOf(room).flush("u-a");
    await bagOf(room).flush("u-b");
    expect(bagOf(room).count("u-a", objItemId("chocolatina-corazon"))).toBe(1);
    expect(bagOf(room).count("u-b", objItemId("chocolatina-corazon"))).toBe(3);
    await waitFor(() => (beto!.estado()?.recibidos.length === 1 ? true : undefined));
    expect(beto!.estado()!.recibidos).toEqual([{ item: objItemId("chocolatina-corazon"), nota: "Para que endulce el día" }]);
    await inner.achievements.flushAll();
    expect((await repo.loadAchievements("u-a")).stats[STAT_KEYS.amigoSecretoRegalos]).toBe(1);
  });

  it("si el amigo no está en la cabaña, el detalle no sale (no se pierde nada)", async () => {
    const { room, inner } = await setup();
    const [ana, beto] = await anotados(
      room,
      [
        ["u-a", "Ana"],
        ["u-b", "Beto"],
      ],
      { items: { "chocolatina-corazon": 1 } },
    );
    hora(inner, 10.1);
    await beto!.client.leave();
    await waitFor(() => (room.state.players.size === 1 ? true : undefined));
    expect(await ana!.regalo("u-b", objItemId("chocolatina-corazon"))).toMatchObject({ ok: false, error: "ausente" });
    expect(bagOf(room).count("u-a", objItemId("chocolatina-corazon"))).toBe(1);
  });
});

describe("las cartas de Cupido", () => {
  it("se escriben en el buzón (moderadas, a otro conectado) y Cupido las entrega de a una", async () => {
    const { room } = await setup();
    const ana = await join(room, "u-a", "Ana");
    const beto = await join(room, "u-b", "Beto");
    expect(await ana.carta("u-b", "Hola")).toMatchObject({ ok: false, error: "lejos" });
    await ir(room, ana, "mailbox");
    expect(await ana.carta("u-a", "Hola")).toMatchObject({ ok: false, error: "self" });
    expect(await ana.carta("u-z", "Hola")).toMatchObject({ ok: false, error: "nadie" });
    expect(await ana.carta("u-b", "   ")).toMatchObject({ ok: false, error: "vacio" });
    expect(await ana.carta("u-b", "entre a https://algo.co")).toMatchObject({ ok: false, error: "enlace" });
    expect(await ana.carta("u-b", "Usted es una persona muy especial.")).toEqual({ accion: "carta", ok: true });
    const carta = await waitFor(() => beto.cartas[0]);
    expect(carta.texto).toBe("Usted es una persona muy especial.");
    expect(JSON.stringify(carta)).not.toContain("Ana");
    // La segunda espera la pausa de Cupido.
    expect(await ana.carta("u-b", "Y otra cosita.")).toEqual({ accion: "carta", ok: true });
    await tick(60);
    expect(beto.cartas).toHaveLength(1);
    now += AMOR.cupidoPausaMs;
    (room as unknown as Inner).amor.tick();
    await waitFor(() => beto.cartas[1]);
    // Con el tope, no más.
    for (let i = 2; i < AMOR.cartasMax; i++) expect(await ana.carta("u-b", `Carta ${i}`)).toMatchObject({ ok: true });
    expect(await ana.carta("u-b", "Una más")).toMatchObject({ ok: false, error: "tope" });
  });
});

describe("la serenata", () => {
  it("junto al trío, a otro conectado: cobra la propina, sale para todos y es una a la vez", async () => {
    const { room } = await setup();
    const ana = await join(room, "u-a", "Ana", { points: 100 });
    const beto = await join(room, "u-b", "Beto");
    const caro = await join(room, "u-c", "Caro", { points: 100 });
    expect(await ana.serenata("u-b", SERENATA.propinas[0])).toMatchObject({ ok: false, error: "lejos" });
    await ir(room, ana, "amor_serenata");
    expect(await ana.serenata("u-a", SERENATA.propinas[0])).toMatchObject({ ok: false, error: "self" });
    const r = await ana.serenata("u-b", SERENATA.propinas[1]);
    expect(r).toEqual({ accion: "serenata", ok: true, balance: 100 - SERENATA.propinas[1] });
    expect(repo.ledger.at(-1)).toMatchObject({ userId: "u-a", amount: -SERENATA.propinas[1], reason: "PURCHASE", refId: serenataRefId() });
    const ev = await waitFor(() => caro.serenatas[0]);
    expect(ev).toMatchObject({ area: "jardin", paraId: "u-b", para: "Beto", de: "Ana", ms: SERENATA.duracionMs });
    expect(beto.serenatas).toHaveLength(1);
    // Otra mientras el trío toca (o descansa): no.
    await ir(room, caro, "amor_serenata");
    expect(await caro.serenata("u-b", SERENATA.propinas[0])).toMatchObject({ ok: false, error: "ocupada" });
    // Después de la pausa sí, y anónima no dice de quién.
    now += SERENATA.duracionMs + SERENATA.pausaMs;
    expect(await caro.serenata("u-a", SERENATA.propinas[0], true)).toMatchObject({ ok: true });
    expect((await waitFor(() => ana.serenatas[1])).de).toBe("");
    await (room as unknown as Inner).achievements.flushAll();
    expect((await repo.loadAchievements("u-a")).stats[STAT_KEYS.serenatasDadas]).toBe(1);
  });

  it("sin puntos no hay serenata (y el trío queda libre)", async () => {
    const { room } = await setup();
    const ana = await join(room, "u-a", "Ana");
    await join(room, "u-b", "Beto");
    await ir(room, ana, "amor_serenata");
    expect(await ana.serenata("u-b", SERENATA.propinas[0])).toMatchObject({ ok: false, error: "fondos" });
    await repo.awardPoints({ userId: "u-a", amount: 50, reason: "ADMIN" });
    expect(await ana.serenata("u-b", SERENATA.propinas[0])).toMatchObject({ ok: true });
  });
});

describe("el puesto de chocolates y flores", () => {
  it("solo vende con la fiesta abierta y junto al puesto (PURCHASE, festival:amor-amistad:<id>)", async () => {
    const off = await setup({ day: AMOR_DAY - 1 });
    const x = await join(off.room, "u-x", "Xime", { points: 100 });
    expect(await x.comprar("rosa-roja")).toMatchObject({ ok: false, error: "off" });
    await colyseus.cleanup();
    const { room } = await setup();
    const ana = await join(room, "u-a", "Ana", { points: 100 });
    expect(await ana.comprar("rosa-roja")).toMatchObject({ ok: false, error: "lejos" });
    await ir(room, ana, "festival_shop");
    expect(await ana.comprar("rosa-roja")).toMatchObject({ ok: true, item: "rosa-roja", balance: 90 });
    expect(repo.ledger.at(-1)).toMatchObject({ amount: -10, reason: "PURCHASE", refId: "festival:amor-amistad:rosa-roja" });
    await bagOf(room).flush("u-a");
    expect(bagOf(room).count("u-a", objItemId("rosa-roja"))).toBe(1);
  });
});

describe("la revelación al cierre", () => {
  it("todas las parejas con nombre, para todos, una vez; y el premio a quien dio algo", async () => {
    const { room, inner } = await setup();
    const [ana, beto] = await anotados(
      room,
      [
        ["u-a", "Ana"],
        ["u-b", "Beto"],
      ],
      { items: { "rosa-roja": 1 } },
    );
    const mirona = await join(room, "u-m", "Mirona");
    hora(inner, 10.1);
    expect(await ana!.regalo("u-b", objItemId("rosa-roja"), "Con cariño")).toMatchObject({ ok: true });
    hora(inner, 22.1);
    expect(room.state.festivalFase).toBe("fin");
    inner.amor.tick();
    const r = await waitFor(() => mirona.revelaciones[0]);
    expect(r.pares).toEqual(expect.arrayContaining([expect.objectContaining({ de: "Ana", para: "Beto" }), expect.objectContaining({ de: "Beto", para: "Ana" })]));
    expect(beto!.revelaciones).toHaveLength(1);
    await waitFor(() => (repo.ledger.some((m) => m.userId === "u-a" && m.reason === "LEISURE") ? true : undefined));
    expect(repo.ledger.find((m) => m.userId === "u-a" && m.reason === "LEISURE")).toMatchObject({ amount: AMOR.premio });
    expect(repo.ledger.some((m) => m.userId === "u-b" && m.reason === "LEISURE")).toBe(false);
    inner.amor.tick();
    await tick(60);
    expect(mirona.revelaciones).toHaveLength(1);
  });
});

describe("el panel del director", () => {
  it("sortea y revela el amigo secreto sin esperar la hora, una vez cada cosa", async () => {
    const { room, inner } = await setup();
    const admin = await colyseus.connectTo(room, { token: await token("u-dir", "Directora", "ada", "ADMIN") });
    const res: DirectorResult[] = [];
    admin.onMessage(DIRECTOR_MSG.result, (r: DirectorResult) => res.push(r));
    await room.waitForNextPatch();
    const momento = async (id: string) => {
      const n = res.length;
      admin.send(DIRECTOR_MSG.action, { kind: "momento", id });
      return waitFor(() => res[n]);
    };
    expect(await momento("amor-sorteo")).toMatchObject({ ok: false, error: "nada" });
    const [ana, beto] = await anotados(room, [
      ["u-a", "Ana"],
      ["u-b", "Beto"],
    ]);
    expect(await momento("amor-revelacion")).toMatchObject({ ok: false, error: "nada" });
    expect(await momento("amor-sorteo")).toMatchObject({ ok: true });
    expect(parejasDe(inner)).toHaveLength(2);
    await waitFor(() => (ana!.estado()?.amigos.length ? true : undefined));
    expect(beto!.estado()).toMatchObject({ sorteado: true });
    expect(await momento("amor-sorteo")).toMatchObject({ ok: false, error: "nada" });
    expect(await momento("amor-revelacion")).toMatchObject({ ok: true });
    const r = await waitFor(() => ana!.revelaciones[0]);
    expect(r.pares).toHaveLength(2);
    expect(await momento("amor-revelacion")).toMatchObject({ ok: false, error: "nada" });
    // Al cierre ya no se repite.
    hora(inner, 22.1);
    inner.amor.tick();
    await tick(60);
    expect(ana!.revelaciones).toHaveLength(1);
  });
});
