// El Año viejo en la sala (ver ano-viejo.ts de @hyvento/shared). Con la fiesta abierta: el puesto de uvas y
// maletas (lo de los agüeros se regala, lo del muñeco se compra), el muñeco de año viejo que se arma entre
// todos (prendas y relleno, con tope por persona; crece por etapas en `state.anoViejo`), los testamentos del
// cartel (moderados), el relleno que se saca del taller y del gallinero, las doce uvas con las campanadas
// (el servidor lleva la hora de cada campanada y valida el ritmo), la vuelta de la maleta (las paradas en
// orden y en un tiempo razonable, revisado con cada paso), la quema a las 21:30 y, a las 21:59, la cuenta
// regresiva: las lentejas y la ropa amarilla, el abrazo y el resumen del año de cada quien. Además marca en
// `UserStat` a qué festivales fue cada uno (para el resumen). Todo vive en memoria; los agüeros cumplidos van
// a `UserStat` (sin migración). Este módulo no conoce Colyseus: la sala le da el estado, la mochila, los
// contadores, el reloj y cómo mandar.
import { nearPointOfType, type OfficeMap } from "@hyvento/map";
import {
  AGUEROS,
  ANO_VIEJO,
  ANO_VIEJO_CINE,
  ANO_VIEJO_ID,
  ANO_VIEJO_MSG,
  AnoViejoBuyMessage,
  AporteMessage,
  ASERRIN,
  FESTIVAL_IDS,
  FESTIVAL_MSG,
  LENTEJAS,
  MALETA_OBJ,
  MSG,
  MUNECO,
  PAJA,
  STAT_KEYS,
  TESTAMENTO,
  TestamentoMessage,
  TRAJE_AMARILLO,
  UVA,
  UVAS,
  UVAS_VENTANAS,
  agueroStatKey,
  anoViejoRefId,
  anoViejoShopItem,
  aporteDe,
  avanzarMaleta,
  cleanTestamento,
  etapaMuneco,
  festivalFueKey,
  finCampanadas,
  juzgarUva,
  objItemId,
  paradaMaletaEn,
  resumenDelAno,
  type AgueroId,
  type AnoViejoBuyResult,
  type AnoViejoMine,
  type AnoViejoNotice,
  type Campanadas,
  type Direction,
  type EmoteEvent,
  type FestivalCineEvent,
  type MaletaVuelta,
} from "@hyvento/shared";
import type { GameRepository } from "../repo/types";
import type { AchievementTracker } from "./achievements";
import type { Bag } from "./bag";

/** Lo que el módulo necesita de quien juega (el `Player` de la sala). */
export interface AnoViejoPlayer {
  userId: string;
  name: string;
  area: string;
  x: number;
  y: number;
  dir: string;
  /** El Look en JSON (para la ropa amarilla). */
  look: string;
}

export interface TestamentoView {
  name: string;
  text: string;
  at: number;
}

/** El estado que ven todos (`state.anoViejo`: AnoViejoState en la sala, un objeto en los tests). */
export interface AnoViejoView {
  prendas: number;
  rellenos: number;
  etapa: number;
  quemadoAt: number;
  campanadasInicio: number;
  campanadasIntervalo: number;
  campanadasN: number;
  testamentos: {
    get(k: string): TestamentoView | undefined;
    set(k: string, v: TestamentoView): unknown;
    delete(k: string): unknown;
    forEach(cb: (v: TestamentoView, k: string) => void): void;
    clear(): void;
    readonly size: number;
  };
}

export interface AnoViejoDeps<T extends TestamentoView> {
  state(): AnoViejoView;
  /** Un testamento nuevo para el estado (TestamentoState). */
  testamento(): T;
  festival(): { id: string; fase: string; day: number; año: number; minute: number };
  player(sessionId: string): AnoViejoPlayer | undefined;
  players(): Iterable<[string, AnoViejoPlayer]>;
  mapOf(area: string): OfficeMap;
  /** ¿Junto al puesto (su punto o el vendedor)? Lo mide la sala. */
  nearShop(p: AnoViejoPlayer): boolean;
  held: Pick<Bag, "count" | "add" | "take" | "hand" | "fits">;
  stats: Pick<AchievementTracker, "stat" | "max" | "bump" | "isLoaded">;
  repo(): Pick<GameRepository, "spendPoints">;
  /** Se pagó algo: el saldo nuevo. */
  balance(userId: string, balance: number): void;
  send(sessionId: string, type: string, msg: unknown): void;
  now(): number;
  later(ms: number, fn: () => void): void;
}

type Room = { onMessage(type: string, cb: (client: { sessionId: string }, raw: unknown) => void): unknown };

interface UvasDe {
  inicio: number;
  comidas: number;
  fallo: boolean;
}

const DIR_HACIA = (dx: number, dy: number): Direction => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");

export class AnoViejo<T extends TestamentoView> {
  private aportes = new Map<string, number>();
  private uvas = new Map<string, UvasDe>();
  private maletas = new Map<string, MaletaVuelta>();
  private recogido = new Map<string, number>();
  private lastAt = new Map<string, number>();
  /** Marcas de "estuvo en el festival" ya puestas (`userId:festival:día`). */
  private fue = new Set<string>();
  private day = -1;
  private lastMinute: number | null = null;
  /** Hasta cuándo corre la cuenta regresiva (para no largar dos). */
  private cuentaHasta = 0;

  constructor(private readonly d: AnoViejoDeps<T>) {}

  /** ¿Abierto el Año viejo? */
  activo(): boolean {
    const f = this.d.festival();
    return f.id === ANO_VIEJO_ID && f.fase === "fiesta";
  }

  private busy(userId: string): boolean {
    const now = this.d.now();
    if (now - (this.lastAt.get(userId) ?? -Infinity) < ANO_VIEJO.pausaMs) return true;
    this.lastAt.set(userId, now);
    return false;
  }

  private notice(sessionId: string, n: AnoViejoNotice) {
    this.d.send(sessionId, ANO_VIEJO_MSG.notice, n);
  }

  private reset() {
    const st = this.d.state();
    st.prendas = 0;
    st.rellenos = 0;
    st.etapa = 0;
    st.quemadoAt = 0;
    st.campanadasInicio = 0;
    st.campanadasIntervalo = 0;
    st.campanadasN = 0;
    if (st.testamentos.size) st.testamentos.clear();
    this.aportes.clear();
    this.uvas.clear();
    this.maletas.clear();
    this.recogido.clear();
  }

  /** Las campanadas que suenan ahora (o null). */
  campanadas(): Campanadas | null {
    const st = this.d.state();
    if (!st.campanadasN) return null;
    return { inicio: st.campanadasInicio, intervalo: st.campanadasIntervalo, n: st.campanadasN };
  }

  /**
   * Cada tanto (con el reloj de la sala): marca a qué festival fue cada quien, vacía lo de otro día y larga
   * lo que tiene hora: las campanadas, la quema y la cuenta regresiva (solo al cruzar la hora: si la sala
   * arranca después, no).
   */
  tick() {
    const f = this.d.festival();
    if (f.id && f.fase === "fiesta")
      for (const [, p] of this.d.players()) {
        const k = `${p.userId}:${f.id}:${f.day}`;
        if (this.fue.has(k) || !this.d.stats.isLoaded(p.userId)) continue;
        this.fue.add(k);
        this.d.stats.max(p.userId, festivalFueKey(f.id, f.año), 1);
      }
    if (f.id !== ANO_VIEJO_ID) {
      if (this.day !== -1) {
        this.reset();
        this.day = -1;
      }
      this.lastMinute = null;
      return;
    }
    if (this.day !== f.day) {
      if (this.day !== -1) this.reset();
      this.day = f.day;
    }
    const c = this.campanadas();
    if (c && this.d.now() > finCampanadas(c) + 1000) {
      const st = this.d.state();
      st.campanadasInicio = 0;
      st.campanadasIntervalo = 0;
      st.campanadasN = 0;
      this.uvas.clear();
    }
    const before = this.lastMinute;
    this.lastMinute = f.minute;
    if (before === null || f.fase !== "fiesta" || f.minute < before) return;
    const crossed = (m: number) => before < m && f.minute >= m;
    for (const w of UVAS_VENTANAS) if (crossed(w)) this.sonarCampanadas();
    if (crossed(ANO_VIEJO.quemaMinuto)) this.quema();
    if (crossed(ANO_VIEJO.cuentaMinuto)) this.cuenta();
  }

  /** Empiezan las doce campanadas (después del aviso), para todos los del jardín. */
  sonarCampanadas() {
    const st = this.d.state();
    st.campanadasInicio = this.d.now() + UVAS.avisoMs;
    st.campanadasIntervalo = UVAS.intervaloMs;
    st.campanadasN = UVAS.n;
    this.uvas.clear();
  }

  /** La quema del muñeco: el fuego en el brasero y la cinemática para los del jardín. */
  quema() {
    const st = this.d.state();
    if (st.quemadoAt) return;
    st.quemadoAt = this.d.now();
    this.cineAlJardin(ANO_VIEJO_CINE.quema);
  }

  private cineAlJardin(id: string) {
    for (const [sid, p] of this.d.players()) if (p.area === ANO_VIEJO.area) this.d.send(sid, FESTIVAL_MSG.cine, { id } satisfies FestivalCineEvent);
  }

  /**
   * La cuenta regresiva: cuentan las lentejas y la ropa amarilla de todos, la cinemática para los del jardín
   * y, al llegar el año nuevo, el abrazo (los del jardín se miran y hacen el corazón) y el resumen de cada uno.
   */
  cuenta() {
    if (this.enCuenta()) return;
    this.cuentaHasta = this.d.now() + ANO_VIEJO.abrazoMs;
    for (const [sid, p] of this.d.players()) {
      if (this.d.held.count(p.userId, objItemId(LENTEJAS)) > 0) this.aguero(sid, p.userId, "lentejas");
      if (costumeOf(p.look) === TRAJE_AMARILLO) this.aguero(sid, p.userId, "amarillo");
    }
    this.cineAlJardin(ANO_VIEJO_CINE.cuenta);
    this.d.later(ANO_VIEJO.abrazoMs, () => this.anoNuevo());
  }

  /** ¿Está corriendo la cuenta regresiva? */
  enCuenta(): boolean {
    return this.d.now() < this.cuentaHasta;
  }

  /** ¿Están sonando (o por sonar) las campanadas? */
  sonando(): boolean {
    const c = this.campanadas();
    return Boolean(c && this.d.now() <= finCampanadas(c));
  }

  /** ¿Ya se quemó el muñeco? */
  quemado(): boolean {
    return Boolean(this.d.state().quemadoAt);
  }

  /** El año nuevo: el abrazo de los del jardín y el resumen del año de cada quien. */
  anoNuevo() {
    const presentes = [...this.d.players()].filter(([, p]) => p.area === ANO_VIEJO.area);
    if (presentes.length) {
      const cx = presentes.reduce((a, [, p]) => a + p.x, 0) / presentes.length;
      const cy = presentes.reduce((a, [, p]) => a + p.y, 0) / presentes.length;
      for (const [sid, p] of presentes) {
        if (presentes.length > 1) p.dir = DIR_HACIA(cx - p.x, cy - p.y);
        const ev: EmoteEvent = { sessionId: sid, emote: "heart" };
        for (const [other, q] of presentes) if (q.area === p.area) this.d.send(other, MSG.emoteEvent, ev);
      }
    }
    const año = this.d.festival().año;
    for (const [sid, p] of this.d.players()) {
      if (!this.d.stats.isLoaded(p.userId)) continue;
      const { resumen, bases } = resumenDelAno((k) => this.d.stats.stat(p.userId, k), año, FESTIVAL_IDS);
      this.d.send(sid, ANO_VIEJO_MSG.resumen, resumen);
      for (const [k, v] of Object.entries(bases)) this.d.stats.max(p.userId, k, v);
    }
  }

  /** Un agüero cumplido: la marca del año, el contador del logro y el aviso (una vez por año). */
  private aguero(sessionId: string, userId: string, id: AgueroId) {
    const año = this.d.festival().año;
    const key = agueroStatKey(año, id);
    if ((this.d.stats.stat(userId, key) ?? 0) >= 1) return;
    this.d.stats.max(userId, key, 1);
    const hechos = AGUEROS.filter((a) => (this.d.stats.stat(userId, agueroStatKey(año, a)) ?? 0) >= 1).length;
    this.d.stats.max(userId, STAT_KEYS.anoViejoAgueros, hechos);
    this.notice(sessionId, { code: "aguero", aguero: id });
    this.sendMine(sessionId, userId);
  }

  /** Lo de cada quien. */
  mine(userId: string): AnoViejoMine {
    const año = this.d.festival().año;
    const c = this.campanadas();
    const u = this.uvas.get(userId);
    return {
      aportes: this.aportes.get(userId) ?? 0,
      agueros: AGUEROS.filter((a) => (this.d.stats.stat(userId, agueroStatKey(año, a)) ?? 0) >= 1),
      testamento: this.d.state().testamentos.get(userId)?.text ?? null,
      maleta: this.maletas.get(userId)?.siguiente ?? null,
      uvas: c && u && u.inicio === c.inicio ? u.comidas : 0,
    };
  }

  sendMine(sessionId: string, userId: string) {
    this.d.send(sessionId, ANO_VIEJO_MSG.mine, this.mine(userId));
  }

  /** Pedir o comprar en el puesto. Null si el mensaje no sirve. */
  async buy(sessionId: string, raw: unknown): Promise<AnoViejoBuyResult | null> {
    const p = this.d.player(sessionId);
    const parsed = AnoViejoBuyMessage.safeParse(raw);
    if (!p || !parsed.success) return null;
    const item = anoViejoShopItem(parsed.data.item)!;
    const fail = (error: Extract<AnoViejoBuyResult, { ok: false }>["error"]): AnoViejoBuyResult => ({ ok: false, item: item.id, error });
    if (!this.activo()) return fail("off");
    if (!this.d.nearShop(p)) return fail("far");
    const itemId = objItemId(item.id);
    if (item.price === 0 && this.d.held.count(p.userId, itemId) > 0) return fail("tiene");
    const fits = this.d.held.fits(p.userId, [[itemId, item.n]]);
    if (fits !== "ok") return fail(fits);
    if (this.busy(p.userId)) return fail("busy");
    let balance: number | null = null;
    if (item.price > 0) {
      try {
        const paid = await this.d.repo().spendPoints({ userId: p.userId, amount: item.price, reason: "PURCHASE", refId: anoViejoRefId(item.id) });
        if (!paid.ok) return fail("funds");
        balance = paid.balance;
        this.d.balance(p.userId, paid.balance);
      } catch (err) {
        console.error("anoViejo spendPoints", err);
        return fail("failed");
      }
    }
    await this.d.held.add(p.userId, itemId, item.n);
    return { ok: true, item: item.id, balance };
  }

  /** Darle una prenda o relleno al muñeco (junto a él). */
  async aportar(sessionId: string, raw: unknown): Promise<void> {
    const p = this.d.player(sessionId);
    const parsed = AporteMessage.safeParse(raw);
    if (!p || !parsed.success) return;
    const say = (code: AnoViejoNotice["code"], n?: number) => this.notice(sessionId, { code, n });
    if (!this.activo()) return say("cerrado");
    const st = this.d.state();
    if (st.quemadoAt) return say("quemado");
    if (p.area !== ANO_VIEJO.area || !nearPointOfType(this.d.mapOf(p.area), "ano_viejo_muneco", p.x, p.y)) return say("lejos");
    const item = parsed.data.item;
    const tipo = aporteDe(item)!;
    if (this.d.held.count(p.userId, objItemId(item)) < 1) return say("noTiene");
    const dados = this.aportes.get(p.userId) ?? 0;
    if (dados >= MUNECO.porPersona) return say("tope");
    if (this.busy(p.userId)) return;
    // Se cuenta antes de gastar (dos clics seguidos no pasan el tope) y se devuelve si no se pudo gastar.
    this.aportes.set(p.userId, dados + 1);
    if (!(await this.d.held.take(p.userId, objItemId(item), 1).catch(() => false))) {
      this.aportes.set(p.userId, dados);
      return say("noTiene");
    }
    const antes = st.etapa;
    if (tipo === "prenda") st.prendas += 1;
    else st.rellenos += 1;
    st.etapa = etapaMuneco(st.prendas, st.rellenos);
    this.d.stats.bump(p.userId, STAT_KEYS.munecoAportes);
    if (st.etapa > antes) {
      // El muñeco creció: lo ven todos los del jardín.
      for (const [sid, q] of this.d.players()) if (q.area === ANO_VIEJO.area) this.notice(sid, { code: "listo", n: st.etapa });
    } else say("aporte");
    this.sendMine(sessionId, p.userId);
  }

  /** Dejar (o cambiar) el testamento en el cartel, antes de la quema. */
  testamento(sessionId: string, raw: unknown) {
    const p = this.d.player(sessionId);
    const parsed = TestamentoMessage.safeParse(raw);
    if (!p || !parsed.success) return;
    const say = (code: AnoViejoNotice["code"]) => this.notice(sessionId, { code });
    if (!this.activo()) return say("cerrado");
    const st = this.d.state();
    if (st.quemadoAt) return say("quemado");
    if (p.area !== ANO_VIEJO.area || !nearPointOfType(this.d.mapOf(p.area), "ano_viejo_cartel", p.x, p.y)) return say("lejos");
    const clean = cleanTestamento(parsed.data.text);
    if (!clean.ok) return say(clean.error);
    if (this.busy(p.userId)) return;
    const t = this.d.testamento();
    t.name = p.name;
    t.text = clean.text;
    t.at = this.d.now();
    st.testamentos.set(p.userId, t);
    // En el cartel caben los últimos: el más viejo se cae.
    while (st.testamentos.size > TESTAMENTO.mostrar) {
      let oldest: [string, number] | null = null;
      st.testamentos.forEach((v, k) => {
        if (!oldest || v.at < oldest[1]) oldest = [k, v.at];
      });
      if (!oldest) break;
      st.testamentos.delete((oldest as [string, number])[0]);
    }
    say("testamento");
    this.sendMine(sessionId, p.userId);
  }

  /** Sacar relleno: aserrín junto al costal del taller o paja junto a las pacas del gallinero. */
  async recoger(sessionId: string): Promise<void> {
    const p = this.d.player(sessionId);
    if (!p) return;
    const say = (n: AnoViejoNotice) => this.notice(sessionId, n);
    if (!this.activo()) return say({ code: "cerrado" });
    if (!nearPointOfType(this.d.mapOf(p.area), "ano_viejo_relleno", p.x, p.y)) return say({ code: "lejos" });
    const item = p.area === "garaje" ? ASERRIN : PAJA;
    const key = `${p.userId}:${item}`;
    const n = this.recogido.get(key) ?? 0;
    if (n >= ANO_VIEJO.rellenoPorSitio) return say({ code: "rellenoTope" });
    if (this.d.held.fits(p.userId, [[objItemId(item), 1]]) !== "ok") return say({ code: "llena" });
    if (this.busy(p.userId)) return;
    this.recogido.set(key, n + 1);
    await this.d.held.add(p.userId, objItemId(item), 1);
    say({ code: "relleno", item });
  }

  /** Comer una uva (con F) con las campanadas sonando: una por campanada, en orden y a tiempo. */
  async uva(sessionId: string): Promise<void> {
    const p = this.d.player(sessionId);
    if (!p) return;
    const say = (code: AnoViejoNotice["code"], n?: number) => this.notice(sessionId, { code, n });
    const c = this.campanadas();
    if (!this.activo() || !c) return say("uvasNo");
    if (this.d.held.hand(p.userId)?.id !== UVA) return say("noTiene");
    let u = this.uvas.get(p.userId);
    if (!u || u.inicio !== c.inicio) this.uvas.set(p.userId, (u = { inicio: c.inicio, comidas: 0, fallo: false }));
    if (u.fallo) return say("uvaTarde");
    const j = juzgarUva(c, u.comidas, this.d.now());
    if (!j.ok) {
      if (j.error === "tarde") u.fallo = true;
      return say(j.error === "espera" ? "uvaEspera" : j.error === "tarde" ? "uvaTarde" : "uvasNo");
    }
    // La de esta campanada cuenta ya (otra F en la misma campanada espera la siguiente).
    u.comidas += 1;
    if (!(await this.d.held.take(p.userId, objItemId(UVA), 1).catch(() => false))) {
      u.comidas -= 1;
      return say("noTiene");
    }
    if (u.comidas < c.n) return say("uva", u.comidas);
    say("uvasListas");
    this.d.send(sessionId, FESTIVAL_MSG.cine, { id: ANO_VIEJO_CINE.uvas } satisfies FestivalCineEvent);
    this.aguero(sessionId, p.userId, "uvas");
  }

  /** Se movió (paso válido): con la maleta en la mano, la vuelta avanza en sus paradas. */
  moved(sessionId: string) {
    const p = this.d.player(sessionId);
    if (!p || !this.activo() || p.area !== ANO_VIEJO.area) return;
    const tengo = this.d.held.hand(p.userId)?.id === MALETA_OBJ;
    const v = this.maletas.get(p.userId) ?? null;
    if (!tengo) {
      if (v) this.maletas.delete(p.userId);
      return;
    }
    const ts = this.d.mapOf(p.area).tileSize;
    const parada = paradaMaletaEn(p.x / ts, p.y / ts);
    const r = avanzarMaleta(v, parada, this.d.now());
    if (r.v) this.maletas.set(p.userId, r.v);
    else this.maletas.delete(p.userId);
    if (!r.evento) return;
    switch (r.evento) {
      case "salida":
        this.notice(sessionId, { code: "maletaSalida" });
        break;
      case "parada":
        this.notice(sessionId, { code: "maletaParada", n: parada });
        break;
      case "llegada":
        this.notice(sessionId, { code: "maletaLlegada" });
        this.d.send(sessionId, FESTIVAL_MSG.cine, { id: ANO_VIEJO_CINE.maleta } satisfies FestivalCineEvent);
        this.aguero(sessionId, p.userId, "maleta");
        break;
      case "tarde":
        this.notice(sessionId, { code: "maletaTarde" });
        break;
      case "rapido":
        this.notice(sessionId, { code: "maletaRapido" });
        break;
    }
    this.sendMine(sessionId, p.userId);
  }

  /** Entró: lo suyo del festival. */
  joined(sessionId: string, userId: string) {
    if (this.d.festival().id === ANO_VIEJO_ID) this.sendMine(sessionId, userId);
  }

  /** Se fue de la sala: la vuelta de la maleta y las uvas de esa conexión se pierden. */
  forget(userId: string) {
    this.maletas.delete(userId);
    this.uvas.delete(userId);
    this.lastAt.delete(userId);
  }
}

/** El traje del Look en JSON (o null). */
function costumeOf(look: string): string | null {
  try {
    const l = JSON.parse(look) as { costume?: unknown };
    return typeof l.costume === "string" ? l.costume : null;
  } catch {
    return null;
  }
}

/** Engancha los mensajes del Año viejo en la sala (una línea en OfficeRoom). */
export function registerAnoViejo<T extends TestamentoView>(room: Room, deps: AnoViejoDeps<T>, markActive: (client: { sessionId: string }) => void): AnoViejo<T> {
  const av = new AnoViejo(deps);
  room.onMessage(ANO_VIEJO_MSG.buy, async (client, raw) => {
    markActive(client);
    const r = await av.buy(client.sessionId, raw);
    if (r) deps.send(client.sessionId, ANO_VIEJO_MSG.buyResult, r);
  });
  room.onMessage(ANO_VIEJO_MSG.aportar, (client, raw) => {
    markActive(client);
    void av.aportar(client.sessionId, raw);
  });
  room.onMessage(ANO_VIEJO_MSG.testamento, (client, raw) => {
    markActive(client);
    av.testamento(client.sessionId, raw);
  });
  room.onMessage(ANO_VIEJO_MSG.recoger, (client) => {
    markActive(client);
    void av.recoger(client.sessionId);
  });
  room.onMessage(ANO_VIEJO_MSG.uva, (client) => {
    markActive(client);
    void av.uva(client.sessionId);
  });
  room.onMessage(ANO_VIEJO_MSG.mine, (client) => {
    const p = deps.player(client.sessionId);
    if (p) av.sendMine(client.sessionId, p.userId);
  });
  return av;
}
