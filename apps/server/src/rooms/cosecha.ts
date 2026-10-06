// La Feria de la cosecha en la sala (VIR-169; reglas en cosecha.ts y ahuyama.ts de @hyvento/shared):
// - el mercado: vender lo cosechado a un puesto (junto a su punto o a quien lo atiende) con el precio del
//   día y el tope de la feria (lo ya pagado va en `UserStat`, `ventasKey`), y comprarle lo que vende;
// - la olla del sancocho: se echan ingredientes de la mochila hasta llenarla; llena, hierve un rato y a
//   cada quien que esté cerca le sirve un plato (energía); hasta `COSECHA.ollasMax` ollas por feria;
// - el concurso de la ahuyama: la báscula pesa la de la mano (el peso va en su id) y la inscribe; al
//   cierre gana la más pesada (logro, premio y cinemática);
// - la tómbola: boletas por puntos (pocas por persona; lo comprado va en `UserStat`) y, al cierre, el
//   sorteo con `crypto.randomInt` (los tests lo fijan) de la carreta de la cosecha;
// - el baile del atardecer: con `state.cosecha.baile`, cada "Bailar" en la pista del patio es un paso (en
//   pareja, doble); completo, da el logro y unos puntos una vez por feria (la marca va en `UserStat`).
// El director puede arrancar el baile, llenar la olla y hacer la premiación y el sorteo ya (registerDirector).
// Todo lo de la feria vive en `state.cosecha` (en memoria) y se borra al pasar el día. Este módulo no conoce
// Colyseus: la sala le da el estado, la mochila, los contadores, la base, el reloj y cómo mandar.
import { nearPointOfType, pointsOfType, puestoDePunto, INTERACT_REACH_TILES, type OfficeMap } from "@hyvento/map";
import {
  AportarMessage,
  COSECHA,
  COSECHA_CINE,
  COSECHA_MSG,
  ComprarMessage,
  OLLA_PUNTO,
  OLLA_RECETA,
  SANCOCHO_PLATO,
  STAT_KEYS,
  TOMBOLA_PREMIO,
  VenderMessage,
  ahuyamaDagOf,
  ahuyamaId,
  ahuyamaPrizeRef,
  baileAbierto,
  baileKey,
  baileRef,
  enLaPista,
  valorDelPaso,
  boletaRefId,
  boletasKey,
  cosechaActiva,
  cosechaRefId,
  ganadorAhuyama,
  objItemId,
  ollaFaltan,
  ollaLlena,
  pesoTexto,
  precioDeCompra,
  puestoById,
  rankingAhuyamas,
  sorteoTombola,
  unidadesQueCaben,
  ventasKey,
  type AportarResult,
  type BaileProgreso,
  type BoletaResult,
  type ComprarResult,
  type CosechaMine,
  type PesarResult,
  type SancochoServido,
  type VenderResult,
} from "@hyvento/shared";
import type { GameRepository } from "../repo/types";
import { AhuyamaEntryState, type CosechaState } from "../state";
import type { AchievementTracker } from "./achievements";
import type { Bag } from "./bag";

/** Lo que el módulo necesita de quien juega (el `Player` de la sala). */
export interface CosechaWho {
  userId: string;
  name: string;
  area: string;
  x: number;
  y: number;
}

export interface CosechaTimings {
  hervirMs: number;
  premiacionDelayMs: number;
  tombolaDelayMs: number;
}

export interface CosechaParts {
  state(): CosechaState;
  /** El festival y su fase, el día y el año del juego y el minuto del día. */
  festival(): { id: string; fase: string; day: number; año: number; minute: number };
  player(sessionId: string): CosechaWho | undefined;
  players(): Iterable<[string, CosechaWho]>;
  mapOf(area: string): OfficeMap;
  held: Pick<Bag, "count" | "fits" | "add" | "take" | "hand">;
  stats: Pick<AchievementTracker, "stat" | "max" | "bump" | "isLoaded">;
  repo(): Pick<GameRepository, "spendPoints" | "awardPoints" | "awardPointsOnce">;
  /** ¿Está junto a quien atiende ese puesto? (la gente de la fiesta, con la pose del minuto). */
  nearVendor(who: CosechaWho, puesto: string): boolean;
  online(userId: string): boolean;
  send(sessionId: string, type: string, msg: unknown): void;
  /** Una cinemática para todos, o solo para algunas sesiones. */
  cine(id: string, vars?: Record<string, string | number>, sessions?: readonly string[]): void;
  /** El saldo nuevo de alguien (y el "+N" si ganó algo). */
  paid(userId: string, awarded: number, balance: number, reason: "LEISURE" | "GIFT"): void;
  now(): number;
  /** Un entero de 0 a max - 1 (el sorteo de la tómbola). */
  random(max: number): number;
  timings(): CosechaTimings;
}

type Room = { onMessage(type: string, cb: (client: { sessionId: string }, raw: unknown) => void): unknown };

export class Cosecha {
  private lastAt = new Map<string, number>();
  /** Las boletas de cada quien en esta feria (también van en `UserStat`, para el tope). */
  private boletas = new Map<string, { name: string; n: number }>();
  /** Quiénes ya recibieron plato de cada olla (una vez por olla). */
  private servidos = new Map<number, Set<string>>();
  /** El día del juego de lo que hay (al cambiar, se borra). */
  private day = -1;
  private closedAt: number | null = null;
  private premiadoDay = -1;
  private sorteadoDay = -1;
  /** Premios de quien no estaba al cierre: le llegan al volver. */
  private pendientes = new Map<string, { ahuyama?: true; tombola?: true }>();
  /** El baile: los pasos de cada quien y cuándo contó el último. */
  private pasos = new Map<string, { n: number; at: number | null }>();
  /** El último "Bailar" de cada quien en la pista (para ver si baila en pareja). */
  private bailando = new Map<string, { at: number; x: number; y: number }>();
  /** El director arrancó el baile antes de su hora. */
  private baileForzado = false;

  constructor(private readonly parts: CosechaParts) {}

  active(): boolean {
    const f = this.parts.festival();
    return cosechaActiva(f.id, f.fase);
  }

  private busy(userId: string): boolean {
    const now = this.parts.now();
    if (now - (this.lastAt.get(userId) ?? -Infinity) < COSECHA.cooldownMs) return true;
    this.lastAt.set(userId, now);
    return false;
  }

  private reset() {
    const st = this.parts.state();
    st.olla = 1;
    st.ollaFase = "llenando";
    st.hierveDesde = 0;
    st.aportado.clear();
    st.ahuyamas.clear();
    st.boletas = 0;
    st.ganadorAhuyama = "";
    st.ganadorDag = 0;
    st.ganadorTombola = "";
    this.boletas.clear();
    this.servidos.clear();
    this.closedAt = null;
    st.baile = false;
    this.pasos.clear();
    this.bailando.clear();
    this.baileForzado = false;
  }

  /** Lo de cada quien en esta feria. */
  mine(userId: string): CosechaMine {
    const año = this.parts.festival().año;
    const boletas = Math.max(this.boletas.get(userId)?.n ?? 0, this.parts.stats.stat(userId, boletasKey(año)) ?? 0);
    const bailado = (this.parts.stats.stat(userId, baileKey(año)) ?? 0) > 0;
    return {
      vendido: this.parts.stats.stat(userId, ventasKey(año)) ?? 0,
      boletas,
      dag: this.parts.state().ahuyamas.get(userId)?.dag ?? 0,
      pasos: bailado ? COSECHA.bailePasos : Math.min(COSECHA.bailePasos, this.pasos.get(userId)?.n ?? 0),
      bailado,
    };
  }

  /**
   * Cada tanto (con el reloj de la sala): borra lo de otro día, sirve la olla que terminó de hervir y, ya
   * cerrada la feria, premia la ahuyama más grande y saca la boleta de la tómbola (cada cosa un rato después).
   */
  tick() {
    const f = this.parts.festival();
    if (f.id !== COSECHA.id) {
      if (this.day !== -1) {
        this.reset();
        this.day = -1;
      }
      return;
    }
    if (this.day !== f.day) {
      if (this.day !== -1) this.reset();
      this.day = f.day;
    }
    const st = this.parts.state();
    const now = this.parts.now();
    st.baile = this.active() && (this.baileForzado || baileAbierto(f.minute));
    if (st.ollaFase === "hirviendo" && now - st.hierveDesde >= this.parts.timings().hervirMs) void this.servir();
    if (f.fase === "fin" && this.closedAt === null && (this.premiadoDay !== f.day || this.sorteadoDay !== f.day)) this.closedAt = now;
    if (this.closedAt === null) return;
    const t = this.parts.timings();
    if (this.premiadoDay !== f.day && now - this.closedAt >= t.premiacionDelayMs) {
      this.premiadoDay = f.day;
      void this.premiarAhuyama(f.año);
    }
    if (this.sorteadoDay !== f.day && now - this.closedAt >= t.tombolaDelayMs) {
      this.sorteadoDay = f.day;
      void this.sortearTombola();
    }
  }

  // ---------- El mercado ----------

  /** ¿Está junto al puesto (su punto) o junto a quien lo atiende? */
  private nearPuesto(who: CosechaWho, puesto: string): boolean {
    const map = this.parts.mapOf(who.area);
    const reach = INTERACT_REACH_TILES * map.tileSize;
    const enPunto = pointsOfType(map, "cosecha_puesto").some((p) => puestoDePunto(p) === puesto && Math.hypot(p.x - who.x, p.y - who.y) <= reach);
    return enPunto || this.parts.nearVendor(who, puesto);
  }

  /** Vender lo de la mochila a un puesto, con el precio de ahora y sin pasar el tope de la feria. */
  async vender(who: CosechaWho, raw: unknown): Promise<VenderResult | null> {
    const parsed = VenderMessage.safeParse(raw);
    if (!parsed.success) return null;
    const { puesto, item, n } = parsed.data;
    const fail = (error: Extract<VenderResult, { ok: false }>["error"]): VenderResult => ({ ok: false, puesto, item, error });
    if (!this.active()) return fail("off");
    if (!this.nearPuesto(who, puesto)) return fail("far");
    const f = this.parts.festival();
    const precio = precioDeCompra(puesto, item, f.day, f.minute);
    if (precio === null) return fail("nocompra");
    const itemId = objItemId(item);
    if (this.parts.held.count(who.userId, itemId) < n) return fail("faltan");
    // Sin los contadores leídos no se sabe cuánto lleva vendido.
    if (!this.parts.stats.isLoaded(who.userId)) return fail("busy");
    const key = ventasKey(f.año);
    const ya = this.parts.stats.stat(who.userId, key) ?? 0;
    const k = unidadesQueCaben(precio, n, ya);
    if (k <= 0) return fail("tope");
    if (this.busy(who.userId)) return fail("busy");
    if (!(await this.parts.held.take(who.userId, itemId, k))) return fail("faltan");
    // Lo vendido se anota antes de pagar: dos mensajes seguidos no pasan el tope.
    this.parts.stats.max(who.userId, key, ya + k * precio);
    let r: { awarded: number; balance: number };
    try {
      r = await this.parts.repo().awardPoints({ userId: who.userId, amount: k * precio, reason: "GIFT" });
    } catch (err) {
      console.error("cosecha vender", err);
      await this.parts.held.add(who.userId, itemId, k);
      return fail("failed");
    }
    this.parts.paid(who.userId, r.awarded, r.balance, "GIFT");
    return { ok: true, puesto, item, n: k, puntos: r.awarded, vendido: ya + k * precio, balance: r.balance };
  }

  /** Comprarle algo a un puesto (semillas raras, lo del sancocho, arepas, el canasto). */
  async comprar(who: CosechaWho, raw: unknown): Promise<ComprarResult | null> {
    const parsed = ComprarMessage.safeParse(raw);
    if (!parsed.success) return null;
    const { puesto, item } = parsed.data;
    const fail = (error: Extract<ComprarResult, { ok: false }>["error"]): ComprarResult => ({ ok: false, puesto, item, error });
    const venta = puestoById(puesto)!.vende.find((v) => v.id === item);
    if (!venta) return fail("nada");
    if (!this.active()) return fail("off");
    if (!this.nearPuesto(who, puesto)) return fail("far");
    const itemId = venta.mueble ? venta.id : objItemId(venta.id);
    const fits = this.parts.held.fits(who.userId, [[itemId, 1]]);
    if (fits !== "ok") return fail(fits);
    if (this.busy(who.userId)) return fail("busy");
    let paid: { ok: boolean; balance: number };
    try {
      paid = await this.parts.repo().spendPoints({ userId: who.userId, amount: venta.price, reason: "PURCHASE", refId: cosechaRefId(puesto, item) });
    } catch (err) {
      console.error("cosecha comprar", err);
      return fail("failed");
    }
    if (!paid.ok) return fail("funds");
    this.parts.paid(who.userId, 0, paid.balance, "GIFT");
    await this.parts.held.add(who.userId, itemId, 1);
    return { ok: true, puesto, item, balance: paid.balance };
  }

  // ---------- El sancocho ----------

  /** Echar ingredientes de la mochila a la olla (lo que falta, como mucho). */
  async aportar(who: CosechaWho, raw: unknown): Promise<AportarResult | null> {
    const parsed = AportarMessage.safeParse(raw);
    if (!parsed.success) return null;
    const { item, n } = parsed.data;
    const fail = (error: Extract<AportarResult, { ok: false }>["error"]): AportarResult => ({ ok: false, item, error });
    if (!this.active()) return fail("off");
    if (!nearPointOfType(this.parts.mapOf(who.area), "cosecha_olla", who.x, who.y)) return fail("far");
    const st = this.parts.state();
    if (st.ollaFase === "acabada") return fail("acabada");
    if (st.ollaFase === "hirviendo") return fail("hirviendo");
    const falta = ollaFaltan(Object.fromEntries(st.aportado.entries()))[item] ?? 0;
    if (falta <= 0) return fail("nofalta");
    const itemId = objItemId(item);
    const k = Math.min(n, falta, this.parts.held.count(who.userId, itemId));
    if (k <= 0) return fail("faltan");
    if (this.busy(who.userId)) return fail("busy");
    if (!(await this.parts.held.take(who.userId, itemId, k))) return fail("faltan");
    st.aportado.set(item, (st.aportado.get(item) ?? 0) + k);
    this.parts.stats.bump(who.userId, STAT_KEYS.sancochoAportes, k);
    const llena = ollaLlena(Object.fromEntries(st.aportado.entries()));
    if (llena) {
      st.ollaFase = "hirviendo";
      st.hierveDesde = this.parts.now();
    }
    return { ok: true, item, n: k, llena };
  }

  /** Quiénes están cerca de la olla (en el jardín, a `platoTiles`). */
  private cercaDeLaOlla(): [string, CosechaWho][] {
    const out: [string, CosechaWho][] = [];
    for (const [sid, p] of this.parts.players()) {
      if (p.area !== "jardin") continue;
      const ts = this.parts.mapOf("jardin").tileSize;
      if (Math.hypot(p.x / ts - (OLLA_PUNTO.x + 0.5), p.y / ts - (OLLA_PUNTO.y + 0.5)) <= COSECHA.platoTiles) out.push([sid, p]);
    }
    return out;
  }

  /** La olla hirvió: un plato para cada quien que esté cerca (uno por olla) y la que sigue, si queda. */
  async servir() {
    const st = this.parts.state();
    if (st.ollaFase !== "hirviendo") return;
    const olla = st.olla;
    // Se marca servida primero: el próximo tic no la vuelve a servir mientras se reparte.
    if (olla < COSECHA.ollasMax) {
      st.olla = olla + 1;
      st.ollaFase = "llenando";
    } else st.ollaFase = "acabada";
    st.aportado.clear();
    st.hierveDesde = 0;
    const ya = this.servidos.get(olla) ?? new Set<string>();
    this.servidos.set(olla, ya);
    const cerca = this.cercaDeLaOlla();
    this.parts.cine(COSECHA_CINE.sancocho, { olla }, cerca.map(([sid]) => sid));
    const plato = objItemId(SANCOCHO_PLATO);
    for (const [sid, p] of cerca) {
      if (ya.has(p.userId)) continue;
      ya.add(p.userId);
      const cabe = this.parts.held.fits(p.userId, [[plato, 1]]) === "ok";
      if (cabe) await this.parts.held.add(p.userId, plato, 1, { pick: true });
      this.parts.send(sid, COSECHA_MSG.servido, { olla, plato: cabe } satisfies SancochoServido);
    }
  }

  // ---------- El concurso de la ahuyama ----------

  /** Pesar la ahuyama de la mano e inscribirla (si mejora la que ya tenía, la de antes vuelve a la mochila). */
  async pesar(who: CosechaWho): Promise<PesarResult> {
    if (!this.active()) return { ok: false, error: "off" };
    if (!nearPointOfType(this.parts.mapOf(who.area), "cosecha_bascula", who.x, who.y)) return { ok: false, error: "far" };
    const handId = this.parts.held.hand(who.userId)?.itemId ?? "";
    const dag = ahuyamaDagOf(handId);
    if (dag === null) return { ok: false, error: "none" };
    const st = this.parts.state();
    const antes = st.ahuyamas.get(who.userId);
    if (antes && antes.dag >= dag) return { ok: false, error: "menos", dag };
    if (this.busy(who.userId)) return { ok: false, error: "busy" };
    if (!(await this.parts.held.take(who.userId, handId, 1))) return { ok: false, error: "none" };
    let devuelta: number | null = null;
    if (antes) {
      const old = objItemId(ahuyamaId(antes.dag));
      if ((await this.parts.held.add(who.userId, old, 1)) !== "ok") {
        // No cupo la de antes: la nueva vuelve a la mochila y queda inscrita la de antes.
        await this.parts.held.add(who.userId, handId, 1);
        return { ok: false, error: "full" };
      }
      devuelta = antes.dag;
    }
    const e = new AhuyamaEntryState();
    Object.assign(e, { userId: who.userId, name: who.name, dag, at: this.parts.now() });
    st.ahuyamas.set(who.userId, e);
    const puesto = rankingAhuyamas([...st.ahuyamas.values()]).findIndex((x) => x.userId === who.userId) + 1;
    return { ok: true, dag, puesto, devuelta };
  }

  /** Al cierre: la más pesada gana el logro, el premio (una vez por feria) y su cinemática para todos. */
  async premiarAhuyama(año: number) {
    const st = this.parts.state();
    const best = ganadorAhuyama([...st.ahuyamas.values()]);
    if (!best) return null;
    st.ganadorAhuyama = best.name;
    st.ganadorDag = best.dag;
    this.parts.cine(COSECHA_CINE.premiacion, { ganador: best.name, peso: pesoTexto(best.dag), ahuyama: ahuyamaId(best.dag) });
    if (this.parts.online(best.userId)) this.parts.stats.bump(best.userId, STAT_KEYS.ahuyamaOro);
    else this.pendientes.set(best.userId, { ...this.pendientes.get(best.userId), ahuyama: true });
    const ref = ahuyamaPrizeRef(año);
    try {
      const r = await this.parts.repo().awardPointsOnce({ userId: best.userId, amount: COSECHA.premioAhuyama, reason: "LEISURE", refId: ref, refPrefix: ref, maxPerDay: 1 });
      if (r.status === "ok") this.parts.paid(best.userId, r.awarded, r.balance, "LEISURE");
    } catch (err) {
      console.error("cosecha premio ahuyama", err);
    }
    return best;
  }

  // ---------- El baile ----------

  /**
   * Alguien hizo un emote. Si es "Bailar", en la pista del patio y con el baile andando, es un paso (doble si
   * alguien más bailó al lado hace poco). Al completar los pasos: el logro, la marca y el premio de la feria.
   */
  async emote(sessionId: string, who: CosechaWho, emote: string): Promise<BaileProgreso | null> {
    if (emote !== "dance" || who.area !== "jardin" || !this.parts.state().baile) return null;
    const ts = this.parts.mapOf("jardin").tileSize;
    const x = who.x / ts;
    const y = who.y / ts;
    if (!enLaPista(x, y)) return null;
    const now = this.parts.now();
    let pareja = false;
    for (const [sid, b] of this.bailando)
      if (sid !== sessionId && now - b.at <= COSECHA.parejaMs && Math.hypot(b.x - x, b.y - y) <= COSECHA.parejaTiles && this.parts.player(sid)?.userId !== who.userId) pareja = true;
    this.bailando.set(sessionId, { at: now, x, y });
    // Sin los contadores leídos no se sabe si ya bailó en esta feria.
    if (!this.parts.stats.isLoaded(who.userId)) return null;
    const año = this.parts.festival().año;
    const key = baileKey(año);
    if ((this.parts.stats.stat(who.userId, key) ?? 0) > 0) return null;
    const prev = this.pasos.get(who.userId) ?? { n: 0, at: null };
    const vale = valorDelPaso(now, prev.at, pareja);
    if (vale === 0) return null;
    const n = Math.min(COSECHA.bailePasos, prev.n + vale);
    this.pasos.set(who.userId, { n, at: now });
    const out: BaileProgreso = { pasos: n, meta: COSECHA.bailePasos, pareja };
    if (n < COSECHA.bailePasos) return out;
    // Completo: la marca va antes de pagar (dos pasos seguidos no pagan dos veces).
    this.parts.stats.max(who.userId, key, 1);
    this.parts.stats.bump(who.userId, STAT_KEYS.cosechaBailes);
    out.premio = 0;
    const ref = baileRef(año);
    try {
      const r = await this.parts.repo().awardPointsOnce({ userId: who.userId, amount: COSECHA.premioBaile, reason: "LEISURE", refId: ref, refPrefix: ref, maxPerDay: 1 });
      if (r.status === "ok") {
        out.premio = r.awarded;
        this.parts.paid(who.userId, r.awarded, r.balance, "LEISURE");
      }
    } catch (err) {
      console.error("cosecha baile", err);
    }
    return out;
  }

  // ---------- El director ----------

  /** Arranca ya el baile (la música y la cinemática para los del jardín). */
  arrancarBaile(): "cerrado" | "ocupado" | null {
    if (!this.active()) return "cerrado";
    const st = this.parts.state();
    if (st.baile) return "ocupado";
    this.baileForzado = true;
    st.baile = true;
    const jardin = [...this.parts.players()].filter(([, p]) => p.area === "jardin").map(([sid]) => sid);
    this.parts.cine(COSECHA_CINE.baile, undefined, jardin);
    return null;
  }

  /** Llena la olla de ahora: hierve y sirve como si la hubieran llenado entre todos. */
  llenarOlla(): "cerrado" | "ocupado" | "nada" | null {
    if (!this.active()) return "cerrado";
    const st = this.parts.state();
    if (st.ollaFase === "acabada") return "nada";
    if (st.ollaFase === "hirviendo") return "ocupado";
    for (const [item, n] of Object.entries(OLLA_RECETA)) st.aportado.set(item, n);
    st.ollaFase = "hirviendo";
    st.hierveDesde = this.parts.now();
    return null;
  }

  /** La premiación de la ahuyama y el sorteo de la tómbola, ya (una vez por feria cada uno). */
  cerrarYa(): "cerrado" | "nada" | null {
    const f = this.parts.festival();
    if (f.id !== COSECHA.id) return "cerrado";
    const ahuyamas = this.premiadoDay !== f.day && this.parts.state().ahuyamas.size > 0;
    const tombola = this.sorteadoDay !== f.day && [...this.boletas.values()].some((b) => b.n > 0);
    if (!ahuyamas && !tombola) return "nada";
    if (ahuyamas) {
      this.premiadoDay = f.day;
      void this.premiarAhuyama(f.año);
    }
    if (tombola) {
      this.sorteadoDay = f.day;
      void this.sortearTombola();
    }
    return null;
  }

  // ---------- La tómbola ----------

  /** Comprar una boleta (junto a la tómbola, hasta `boletasMax` por persona por feria). */
  async boleta(who: CosechaWho): Promise<BoletaResult> {
    if (!this.active()) return { ok: false, error: "off" };
    if (!nearPointOfType(this.parts.mapOf(who.area), "cosecha_tombola", who.x, who.y)) return { ok: false, error: "far" };
    // Sin los contadores leídos no se sabe cuántas compró antes de un reinicio.
    if (!this.parts.stats.isLoaded(who.userId)) return { ok: false, error: "busy" };
    const año = this.parts.festival().año;
    const n = this.mine(who.userId).boletas;
    if (n >= COSECHA.boletasMax) return { ok: false, error: "max" };
    if (this.busy(who.userId)) return { ok: false, error: "busy" };
    // La boleta se aparta antes de cobrar (dos mensajes seguidos no pasan el tope).
    this.boletas.set(who.userId, { name: who.name, n: n + 1 });
    let paid: { ok: boolean; balance: number };
    try {
      paid = await this.parts.repo().spendPoints({ userId: who.userId, amount: COSECHA.boletaPrecio, reason: "PURCHASE", refId: boletaRefId(año, n + 1) });
    } catch (err) {
      console.error("cosecha boleta", err);
      paid = { ok: false, balance: -1 };
    }
    if (!paid.ok) {
      this.boletas.set(who.userId, { name: who.name, n });
      return { ok: false, error: paid.balance < 0 ? "failed" : "funds" };
    }
    this.parts.stats.max(who.userId, boletasKey(año), n + 1);
    this.parts.state().boletas += 1;
    this.parts.paid(who.userId, 0, paid.balance, "GIFT");
    return { ok: true, n: n + 1, balance: paid.balance };
  }

  /** Al cierre: la boleta ganadora se lleva la carreta (si no está, al volver). */
  async sortearTombola() {
    const lista = [...this.boletas.entries()].map(([userId, b]) => ({ userId, name: b.name, n: b.n }));
    const g = sorteoTombola(lista, (max) => this.parts.random(max));
    if (!g) return null;
    this.parts.state().ganadorTombola = g.name;
    this.parts.cine(COSECHA_CINE.tombola, { ganador: g.name });
    if (this.parts.online(g.userId)) await this.darCarreta(g.userId);
    else this.pendientes.set(g.userId, { ...this.pendientes.get(g.userId), tombola: true });
    return g;
  }

  private async darCarreta(userId: string) {
    this.parts.stats.bump(userId, STAT_KEYS.tombolaGanada);
    // Si la mochila está llena, queda pendiente para cuando vuelva a entrar.
    if ((await this.parts.held.add(userId, TOMBOLA_PREMIO, 1)) !== "ok") this.pendientes.set(userId, { ...this.pendientes.get(userId), tombola: true });
  }

  /** Entró (con la mochila ya leída): lo que ganó estando afuera. */
  async joined(userId: string) {
    const p = this.pendientes.get(userId);
    if (!p) return;
    this.pendientes.delete(userId);
    if (p.ahuyama) this.parts.stats.bump(userId, STAT_KEYS.ahuyamaOro);
    if (p.tombola) await this.darCarreta(userId);
  }

  forget(userId: string, sessionId?: string) {
    this.lastAt.delete(userId);
    if (sessionId) this.bailando.delete(sessionId);
  }
}

/** Engancha los mensajes de la feria (vender, comprar, aportar, pesar, boleta y lo mío). */
export function registerCosecha(room: Room, parts: CosechaParts, markActive: (client: { sessionId: string }) => void): Cosecha {
  const c = new Cosecha(parts);
  const mine = (sid: string, userId: string) => parts.send(sid, COSECHA_MSG.mine, c.mine(userId) satisfies CosechaMine);
  const on = <R>(type: string, reply: string, run: (who: CosechaWho, raw: unknown) => Promise<R | null>) =>
    room.onMessage(type, (client, raw) => {
      const who = parts.player(client.sessionId);
      if (!who) return;
      markActive(client);
      void run(who, raw).then((r) => {
        if (!r) return;
        parts.send(client.sessionId, reply, r);
        mine(client.sessionId, who.userId);
      });
    });
  on(COSECHA_MSG.vender, COSECHA_MSG.venderResult, (w, raw) => c.vender(w, raw));
  on(COSECHA_MSG.comprar, COSECHA_MSG.comprarResult, (w, raw) => c.comprar(w, raw));
  on(COSECHA_MSG.aportar, COSECHA_MSG.aportarResult, (w, raw) => c.aportar(w, raw));
  on(COSECHA_MSG.pesar, COSECHA_MSG.pesarResult, (w) => c.pesar(w));
  on(COSECHA_MSG.boleta, COSECHA_MSG.boletaResult, (w) => c.boleta(w));
  room.onMessage(COSECHA_MSG.mine, (client) => {
    const who = parts.player(client.sessionId);
    if (who) mine(client.sessionId, who.userId);
  });
  return c;
}

/** Un emote de alguien: si es un paso del baile, le cuenta cómo va (lo llama `handleEmote` de la sala). */
export function cosechaEmote(c: Cosecha, parts: Pick<CosechaParts, "player" | "send">, sessionId: string, emote: string) {
  const who = parts.player(sessionId);
  if (!who) return;
  void c.emote(sessionId, who, emote).then((r) => {
    if (r) parts.send(sessionId, COSECHA_MSG.baile, r satisfies BaileProgreso);
  });
}
