// El Año viejo en la sala (ver rooms/anoViejo.ts): el muñeco por etapas con los aportes, los testamentos
// moderados, el relleno, la quema a su hora, las doce uvas al ritmo de las campanadas, la vuelta de la maleta
// (paradas en orden y tiempo), la cuenta regresiva con los agüeros y el resumen del año. Primero con la clase
// sola (rápido, con el reloj en la mano) y después en la sala.
import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, pointsOfType, setFestivalDecor, type OfficeMap } from "@hyvento/map";
import {
  ANO_VIEJO,
  ANO_VIEJO_CINE,
  ANO_VIEJO_MSG,
  ASERRIN,
  CARETA,
  DIAS_POR_ESTACION,
  FESTIVAL_MSG,
  LENTEJAS,
  MALETA,
  MALETA_OBJ,
  MALETA_RUTA,
  MSG,
  MUNECO,
  PAJA,
  ROOM_NAME,
  ROPA_VIEJA,
  SEASONS,
  STAT_KEYS,
  TESTAMENTO,
  TRAJE_AMARILLO,
  UVA,
  UVAS,
  UVAS_VENTANAS,
  agueroStatKey,
  festivalFueKey,
  objItemId,
  resumenBaseKey,
  type AnoViejoBuyResult,
  type AnoViejoNotice,
  type FestivalCineEvent,
  type ResumenAno,
} from "@hyvento/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { AnoViejo, type AnoViejoPlayer, type TestamentoView } from "../src/rooms/anoViejo";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bagOf, bootServer, tick, token, walkToTile, type ServerRoom } from "./helpers";

const DAY = SEASONS.indexOf("invierno") * DIAS_POR_ESTACION + 20;

// ---------- La clase sola ----------

function fake() {
  setFestivalDecor("ano-viejo", DAY);
  const jardin = getWorld().areas.get("jardin")!;
  const garaje = getWorld().areas.get("garaje")!;
  const TS = jardin.tileSize;
  const festival = { id: "ano-viejo", fase: "fiesta", day: DAY, año: 1, minute: 12 * 60 };
  const testamentos = new Map<string, TestamentoView>();
  const state = { prendas: 0, rellenos: 0, etapa: 0, quemadoAt: 0, campanadasInicio: 0, campanadasIntervalo: 0, campanadasN: 0, testamentos };
  const players = new Map<string, AnoViejoPlayer>();
  const bags = new Map<string, Map<string, number>>();
  const hands = new Map<string, string>();
  const stats = new Map<string, Map<string, number>>();
  const sent: { to: string; type: string; msg: unknown }[] = [];
  const later: (() => void)[] = [];
  const clock = { now: 1_000_000 };
  const bag = (u: string) => bags.get(u) ?? bags.set(u, new Map()).get(u)!;
  const st = (u: string) => stats.get(u) ?? stats.set(u, new Map()).get(u)!;
  const av = new AnoViejo({
    state: () => state,
    testamento: () => ({ name: "", text: "", at: 0 }),
    festival: () => festival,
    player: (id) => players.get(id),
    players: () => players.entries(),
    mapOf: (a): OfficeMap => (a === "garaje" ? garaje : jardin),
    nearShop: () => true,
    held: {
      count: (u, item) => bag(u).get(item) ?? 0,
      fits: () => "ok",
      add: async (u, item, n = 1) => {
        bag(u).set(item, (bag(u).get(item) ?? 0) + n);
        return "ok";
      },
      take: async (u, item, n = 1) => {
        const have = bag(u).get(item) ?? 0;
        if (have < n) return false;
        bag(u).set(item, have - n);
        return true;
      },
      hand: (u) => (hands.get(u) ? { itemId: `obj:${hands.get(u)}`, id: hands.get(u)!, art: hands.get(u)!, left: 1 } : null),
    },
    stats: {
      stat: (u, k) => st(u).get(k),
      max: (u, k, v) => void st(u).set(k, Math.max(st(u).get(k) ?? -Infinity, v)),
      bump: (u, k, by = 1) => void st(u).set(k, (st(u).get(k) ?? 0) + by),
      isLoaded: () => true,
    },
    repo: () => ({ spendPoints: async () => ({ ok: true, balance: 90 }) }),
    balance: () => {},
    send: (to, type, msg) => sent.push({ to, type, msg }),
    now: () => clock.now,
    later: (_ms, fn) => void later.push(fn),
  });
  const at = (type: string, area = "jardin") => {
    const p = pointsOfType(area === "garaje" ? garaje : jardin, type as never)[0]!;
    return { x: p.x, y: p.y };
  };
  const join = (n: number, where = at("ano_viejo_muneco"), extra: Partial<AnoViejoPlayer> = {}) => {
    const p: AnoViejoPlayer = { userId: `u${n}`, name: `P${n}`, area: "jardin", dir: "down", look: "{}", ...where, ...extra };
    players.set(`s${n}`, p);
    return { sid: `s${n}`, p };
  };
  const notices = (sid: string) => sent.filter((s) => s.to === sid && s.type === ANO_VIEJO_MSG.notice).map((s) => (s.msg as AnoViejoNotice).code);
  const cines = (sid: string) => sent.filter((s) => s.to === sid && s.type === FESTIVAL_MSG.cine).map((s) => (s.msg as FestivalCineEvent).id);
  /** Avanza el reloj (para pasar la pausa entre acciones). */
  const pasa = (ms = ANO_VIEJO.pausaMs + 1) => (clock.now += ms);
  return { av, state, festival, players, bag, hands, st, sent, later, clock, at, join, notices, cines, pasa, TS };
}

afterEach(() => {
  setFestivalDecor(null);
});

describe("año viejo: el muñeco entre todos", () => {
  it("crece por etapas con prendas y relleno, con tope por persona; quemado ya no recibe", async () => {
    const f = fake();
    const a = f.join(1);
    f.bag("u1").set(objItemId(ROPA_VIEJA), 10);
    f.bag("u1").set(objItemId(PAJA), 10);
    await f.av.aportar(a.sid, { item: ROPA_VIEJA });
    expect(f.state).toMatchObject({ prendas: 1, rellenos: 0, etapa: 0 });
    f.pasa();
    await f.av.aportar(a.sid, { item: PAJA });
    expect(f.state.etapa).toBe(1);
    expect(f.notices(a.sid)).toContain("listo");
    for (let k = 0; k < MUNECO.porPersona; k++) {
      f.pasa();
      await f.av.aportar(a.sid, { item: k % 2 ? ROPA_VIEJA : PAJA });
    }
    expect(f.state.prendas + f.state.rellenos).toBe(MUNECO.porPersona);
    expect(f.notices(a.sid).at(-1)).toBe("tope");
    expect(f.st("u1").get(STAT_KEYS.munecoAportes)).toBe(MUNECO.porPersona);
    // Lo que no le sirve no se acepta (ni se gasta), y lejos tampoco.
    const b = f.join(2);
    f.bag("u2").set(objItemId(CARETA), 1);
    f.pasa();
    await f.av.aportar(b.sid, { item: "tinto" });
    expect(f.state.prendas + f.state.rellenos).toBe(MUNECO.porPersona);
    const lejos = f.join(3, { x: 10, y: 10 });
    f.bag("u3").set(objItemId(CARETA), 1);
    await f.av.aportar(lejos.sid, { item: CARETA });
    expect(f.notices(lejos.sid)).toEqual(["lejos"]);
    // Con otros dos, llega a la última etapa.
    f.bag("u2").set(objItemId(CARETA), 6);
    f.bag("u2").set(objItemId(ASERRIN), 6);
    for (let k = 0; k < MUNECO.porPersona; k++) {
      f.pasa();
      await f.av.aportar(b.sid, { item: k % 2 ? ASERRIN : CARETA });
    }
    expect(f.state.etapa).toBe(MUNECO.etapas.length - 1);
    f.av.quema();
    f.pasa();
    await f.av.aportar(b.sid, { item: CARETA });
    expect(f.notices(b.sid).at(-1)).toBe("quemado");
  });

  it("el relleno sale del taller y del gallinero, con tope por sitio", async () => {
    const f = fake();
    const g = f.join(1, f.at("ano_viejo_relleno", "garaje"), { area: "garaje" });
    for (let k = 0; k < ANO_VIEJO.rellenoPorSitio + 1; k++) {
      f.pasa();
      await f.av.recoger(g.sid);
    }
    expect(f.bag("u1").get(objItemId(ASERRIN))).toBe(ANO_VIEJO.rellenoPorSitio);
    expect(f.notices(g.sid).at(-1)).toBe("rellenoTope");
    const j = f.join(2, f.at("ano_viejo_relleno"));
    await f.av.recoger(j.sid);
    expect(f.bag("u2").get(objItemId(PAJA))).toBe(1);
  });
});

describe("año viejo: los testamentos", () => {
  it("junto al cartel, moderados, uno por persona y los últimos en el cartel", () => {
    const f = fake();
    const a = f.join(1, f.at("ano_viejo_cartel"));
    f.av.testamento(a.sid, { text: "Dejo  mi trancón de los lunes" });
    expect(f.state.testamentos.get("u1")).toMatchObject({ name: "P1", text: "Dejo mi trancón de los lunes" });
    f.pasa();
    f.av.testamento(a.sid, { text: "Le dejo al jefe un malparido informe" });
    expect(f.notices(a.sid).at(-1)).toBe("grosero");
    f.pasa();
    f.av.testamento(a.sid, { text: "visiten www.cosas.com" });
    expect(f.notices(a.sid).at(-1)).toBe("enlace");
    expect(f.state.testamentos.get("u1")!.text).toBe("Dejo mi trancón de los lunes");
    for (let k = 2; k < TESTAMENTO.mostrar + 5; k++) {
      const p = f.join(k, f.at("ano_viejo_cartel"));
      f.pasa();
      f.av.testamento(p.sid, { text: `Dejo la tarea ${k}` });
    }
    expect(f.state.testamentos.size).toBe(TESTAMENTO.mostrar);
    // El más viejo se cayó del cartel.
    expect(f.state.testamentos.has("u1")).toBe(false);
  });
});

describe("año viejo: la quema y la cuenta regresiva", () => {
  it("la quema sale al cruzar las 21:30 (no si la sala arranca después) y solo para los del jardín", () => {
    const f = fake();
    const a = f.join(1);
    const adentro = f.join(2, { x: 100, y: 100 }, { area: "planta-baja" });
    f.festival.minute = ANO_VIEJO.quemaMinuto + 2;
    f.av.tick();
    expect(f.state.quemadoAt).toBe(0);
    const g = fake();
    const b = g.join(1);
    g.festival.minute = ANO_VIEJO.quemaMinuto - 1;
    g.av.tick();
    g.festival.minute = ANO_VIEJO.quemaMinuto;
    g.av.tick();
    expect(g.state.quemadoAt).toBe(g.clock.now);
    expect(g.cines(b.sid)).toEqual([ANO_VIEJO_CINE.quema]);
    expect(f.cines(adentro.sid)).toEqual([]);
    expect(f.cines(a.sid)).toEqual([]);
  });

  it("la cuenta regresiva: lentejas y ropa amarilla cuentan, el abrazo y el resumen del año de cada uno", () => {
    const f = fake();
    const a = f.join(1, { x: 70 * f.TS, y: 34 * f.TS }, { look: JSON.stringify({ costume: TRAJE_AMARILLO }) });
    const b = f.join(2, { x: 76 * f.TS, y: 34 * f.TS });
    f.bag("u1").set(objItemId(LENTEJAS), 1);
    f.st("u1").set(STAT_KEYS.fishCaught, 12);
    f.st("u1").set(resumenBaseKey("peces"), 5);
    f.st("u1").set(festivalFueKey("velitas", 1), 1);
    f.festival.minute = ANO_VIEJO.cuentaMinuto - 1;
    f.av.tick();
    f.festival.minute = ANO_VIEJO.cuentaMinuto;
    f.av.tick();
    expect(f.cines(a.sid)).toContain(ANO_VIEJO_CINE.cuenta);
    expect(f.st("u1").get(agueroStatKey(1, "lentejas"))).toBe(1);
    expect(f.st("u1").get(agueroStatKey(1, "amarillo"))).toBe(1);
    expect(f.st("u1").get(STAT_KEYS.anoViejoAgueros)).toBe(2);
    expect(f.st("u2").get(agueroStatKey(1, "lentejas"))).toBeUndefined();
    // El año nuevo (lo que la sala programa para después de la cuenta).
    expect(f.later).toHaveLength(1);
    f.later[0]!();
    const corazones = f.sent.filter((s) => s.type === MSG.emoteEvent);
    expect(corazones.length).toBe(4);
    // Se miran: el de la izquierda mira a la derecha y al revés.
    expect([a.p.dir, b.p.dir]).toEqual(["right", "left"]);
    const resumen = f.sent.find((s) => s.to === a.sid && s.type === ANO_VIEJO_MSG.resumen)!.msg as ResumenAno;
    expect(resumen.filas).toEqual([{ id: "peces", label: "Peces sacados", n: 7 }]);
    // Fue a las velitas y, con el tick de la fiesta, también al año viejo.
    expect(resumen.festivales).toBe(2);
    expect(resumen.agueros).toEqual(["lentejas", "amarillo"]);
    expect(f.st("u1").get(resumenBaseKey("peces"))).toBe(12);
  });
});

describe("año viejo: las doce uvas", () => {
  it("una uva con cada campanada da el agüero; saltarse una lo pierde hasta la próxima tanda", async () => {
    const f = fake();
    const a = f.join(1);
    const b = f.join(2);
    for (const u of ["u1", "u2"]) {
      f.bag(u).set(objItemId(UVA), 24);
      f.hands.set(u, UVA);
    }
    await f.av.uva(a.sid);
    expect(f.notices(a.sid)).toEqual(["uvasNo"]);
    // La de las 18:00: al cruzar la hora empiezan (después del aviso).
    f.festival.minute = UVAS_VENTANAS[0] - 1;
    f.av.tick();
    f.festival.minute = UVAS_VENTANAS[0];
    f.av.tick();
    const c = f.av.campanadas()!;
    expect(c.inicio).toBe(f.clock.now + UVAS.avisoMs);
    // Antes de la primera campanada: espera (no se gasta).
    await f.av.uva(a.sid);
    expect(f.notices(a.sid).at(-1)).toBe("uvaEspera");
    expect(f.bag("u1").get(objItemId(UVA))).toBe(24);
    for (let k = 0; k < UVAS.n; k++) {
      f.clock.now = c.inicio + k * c.intervalo + 300;
      await f.av.uva(a.sid);
      // Dos seguidas en la misma campanada: la segunda espera.
      await f.av.uva(a.sid);
      if (k === 4) continue;
      await f.av.uva(b.sid);
    }
    expect(f.notices(a.sid)).toContain("uvasListas");
    expect(f.cines(a.sid)).toContain(ANO_VIEJO_CINE.uvas);
    expect(f.st("u1").get(agueroStatKey(1, "uvas"))).toBe(1);
    expect(f.bag("u1").get(objItemId(UVA))).toBe(12);
    // A Bea se le pasó la quinta: no le sale.
    expect(f.notices(b.sid)).toContain("uvaTarde");
    expect(f.st("u2").get(agueroStatKey(1, "uvas"))).toBeUndefined();
    // Sin la uva en la mano, no.
    f.hands.delete("u2");
    await f.av.uva(b.sid);
    expect(f.notices(b.sid).at(-1)).toBe("noTiene");
  });
});

describe("año viejo: la maleta", () => {
  const en = (f: ReturnType<typeof fake>, i: number) => ({ x: (MALETA_RUTA[i]!.x + 0.5) * f.TS, y: (MALETA_RUTA[i]!.y + 0.5) * f.TS });

  it("con la maleta en la mano, las paradas en orden y de vuelta a la plaza dan el agüero", () => {
    const f = fake();
    const a = f.join(1, en(f, 0));
    f.hands.set("u1", MALETA_OBJ);
    f.av.moved(a.sid);
    expect(f.notices(a.sid)).toEqual(["maletaSalida"]);
    // Saltarse la parada que sigue no cuenta.
    Object.assign(a.p, en(f, 2));
    f.av.moved(a.sid);
    expect(f.notices(a.sid)).toHaveLength(1);
    for (let i = 1; i < MALETA_RUTA.length; i++) {
      f.clock.now += 10_000;
      Object.assign(a.p, en(f, i));
      f.av.moved(a.sid);
    }
    f.clock.now += 10_000;
    Object.assign(a.p, en(f, 0));
    f.av.moved(a.sid);
    expect(f.notices(a.sid)).toContain("maletaLlegada");
    expect(f.cines(a.sid)).toContain(ANO_VIEJO_CINE.maleta);
    expect(f.st("u1").get(agueroStatKey(1, "maleta"))).toBe(1);
  });

  it("volando no cuenta, demorada se pierde y sin la maleta en la mano no hay vuelta", () => {
    const f = fake();
    const a = f.join(1, en(f, 0));
    f.hands.set("u1", MALETA_OBJ);
    f.av.moved(a.sid);
    for (let i = 1; i < MALETA_RUTA.length; i++) {
      f.clock.now += 100;
      Object.assign(a.p, en(f, i));
      f.av.moved(a.sid);
    }
    Object.assign(a.p, en(f, 0));
    f.av.moved(a.sid);
    expect(f.notices(a.sid).at(-1)).toBe("maletaRapido");
    f.av.moved(a.sid);
    f.clock.now += MALETA.maxMs + 1;
    Object.assign(a.p, en(f, 1));
    f.av.moved(a.sid);
    expect(f.notices(a.sid).at(-1)).toBe("maletaTarde");
    f.hands.delete("u1");
    Object.assign(a.p, en(f, 0));
    f.av.moved(a.sid);
    expect(f.av.mine("u1").maleta).toBeNull();
  });
});

describe("año viejo: el puesto", () => {
  it("lo de los agüeros se regala (mientras no se tenga) y lo del muñeco se paga", async () => {
    const f = fake();
    const a = f.join(1, f.at("festival_shop"));
    expect(await f.av.buy(a.sid, { item: UVA })).toEqual({ ok: true, item: UVA, balance: null });
    expect(f.bag("u1").get(objItemId(UVA))).toBe(UVAS.n);
    f.pasa();
    expect(await f.av.buy(a.sid, { item: UVA })).toMatchObject({ ok: false, error: "tiene" });
    f.pasa();
    expect(await f.av.buy(a.sid, { item: CARETA })).toEqual({ ok: true, item: CARETA, balance: 90 });
    f.festival.fase = "fin";
    f.pasa();
    expect(await f.av.buy(a.sid, { item: ROPA_VIEJA })).toMatchObject({ ok: false, error: "off" });
  });
});

// ---------- En la sala ----------

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
const NOON = Date.UTC(2026, 8, 26, 17, 0);

describe("año viejo en la sala", () => {
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
    OfficeRoom.gameClockNow = () => NOON;
    OfficeRoom.weatherInitial = "despejado";
    // Cada pregunta al reloj pasa un segundo: la pausa entre acciones no estorba.
    let t = 1_000_000;
    OfficeRoom.anoViejoNow = () => (t += 1000);
  });
  afterEach(() => {
    OfficeRoom.gameClockNow = () => Date.now();
    OfficeRoom.gameClockInitial = null;
    OfficeRoom.weatherInitial = null;
    OfficeRoom.anoViejoNow = () => Date.now();
  });

  it("en el puesto se compra la ropa vieja y, junto a la silla, el muñeco la recibe para todos", async () => {
    OfficeRoom.gameClockInitial = { anchorReal: NOON, anchorMinute: DAY * 1440 + 12 * 60 };
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    await repo.awardPoints({ userId: "u-ana", amount: 100, reason: "ADMIN" });
    const client = await colyseus.connectTo(room, { token: await token("u-ana", "Ana") });
    await room.waitForNextPatch();
    expect([room.state.festival, room.state.festivalFase]).toEqual(["ano-viejo", "fiesta"]);
    const buys: AnoViejoBuyResult[] = [];
    client.onMessage(ANO_VIEJO_MSG.buyResult, (r: AnoViejoBuyResult) => buys.push(r));
    const avisos: AnoViejoNotice[] = [];
    client.onMessage(ANO_VIEJO_MSG.notice, (n: AnoViejoNotice) => avisos.push(n));
    client.onMessage(ANO_VIEJO_MSG.mine, () => {});
    const jardin = getWorld().areas.get("jardin")!;
    const shop = pointsOfType(jardin, "festival_shop")[0]!;
    await walkToTile(client, room, shop.tileX, shop.tileY);
    client.send(ANO_VIEJO_MSG.buy, { item: ROPA_VIEJA });
    for (let i = 0; i < 60 && !buys.length; i++) await tick(30);
    expect(buys[0]).toMatchObject({ ok: true, item: ROPA_VIEJA });
    expect(await repo.getPoints("u-ana")).toBe(96);
    const muneco = pointsOfType(jardin, "ano_viejo_muneco")[0]!;
    await walkToTile(client, room, muneco.tileX, muneco.tileY);
    client.send(ANO_VIEJO_MSG.aportar, { item: ROPA_VIEJA });
    for (let i = 0; i < 60 && room.state.anoViejo.prendas === 0; i++) await tick(30);
    expect(avisos.map((a) => a.code)).toEqual(["aporte"]);
    expect(room.state.anoViejo.prendas).toBe(1);
    expect(bagOf(room).count("u-ana", objItemId(ROPA_VIEJA))).toBe(0);
  });
});
