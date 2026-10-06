// El Festival de cometas en la sala (ver cometas.ts, cometa.ts y cometa-vuelo.ts de @hyvento/shared): el
// puesto (materiales, gancho, raspao), armar la cometa en el taller con los materiales de la mochila,
// volarla en el voladero de la loma (la sala repite el vuelo con los botones que manda el navegador, así
// la altura que ven todos y el récord son de verdad), el concurso de la más bonita (un voto por persona por
// festival, marcado en `UserStat`), la cometa del techo del garaje y, al cierre, la premiación. Lo que
// vuela y lo inscrito vive en `state.cometas` (en memoria). Este módulo no conoce Colyseus: la sala le da
// el estado, la mochila, los contadores, la base, el reloj y cómo mandar.
import { enVoladero, nearPointOfType, type OfficeMap } from "@hyvento/map";
import {
  advanceVuelo,
  alturaDe,
  cometaCodeOf,
  cometaGanadora,
  cometaId,
  cometaMateriales,
  cometaName,
  COMETA_PERDIDA,
  COMETAS,
  COMETAS_CINE,
  COMETAS_MSG,
  CometaArmarMessage,
  CometaPasoMessage,
  CometaSim,
  cometasActiva,
  CometasBuyMessage,
  cometasPrizeRef,
  cometasRefId,
  cometasShopItem,
  cometasTechoKey,
  cometasVoteKey,
  CometaVotoMessage,
  faltanMateriales,
  FESTIVAL_MSG,
  objItemId,
  sePuedeVolar,
  STAT_KEYS,
  VUELO,
  VUELO_FRAME_MS,
  vientoDelClima,
  vueloCuenta,
  type ArmarResult,
  type CometaConcursoResult,
  type CometasBuyResult,
  type CometasMine,
  type FestivalCineEvent,
  type TechoResult,
  type VolarResult,
  type VueloEnd,
  type VueloMotivo,
  type Weather,
} from "@hyvento/shared";
import type { GameRepository } from "../repo/types";
import type { AchievementTracker } from "./achievements";
import type { Bag } from "./bag";
import { CometaInscritaState, CometaVueloState, type CometasState } from "../state";

/** Quien juega (el `Player` de la sala). */
export interface CometasPlayer {
  userId: string;
  name: string;
  area: string;
  x: number;
  y: number;
  seated: boolean;
  swimming?: boolean;
}

export interface CometasParts {
  state(): CometasState;
  /** El festival de ahora (`state.festival`, su fase), la fecha y la hora del juego. */
  festival(): { id: string; fase: string; day: number; año: number };
  weather(): Weather;
  player(sessionId: string): CometasPlayer | undefined;
  players(): Iterable<[string, CometasPlayer]>;
  mapOf(area: string): OfficeMap;
  /** ¿Junto al puesto del festival (su punto o un vendedor de la fiesta)? */
  nearShop(sessionId: string): boolean;
  held: Pick<Bag, "count" | "fits" | "add" | "take" | "hand">;
  stats: Pick<AchievementTracker, "stat" | "max" | "bump" | "isLoaded">;
  repo(): Pick<GameRepository, "spendPoints" | "awardPointsOnce">;
  send(sessionId: string, type: string, msg: unknown): void;
  /** Una cinemática para todos o solo para los de un nivel. */
  cine(id: string, vars?: Record<string, string | number>, area?: string): void;
  /** El saldo nuevo (y el "+N" si se ganó algo). */
  points(userId: string, balance: number, awarded?: number): void;
  now(): number;
  random(n: number): number;
  premiacionDelayMs(): number;
}

interface Vuelo {
  id: number;
  sessionId: string;
  userId: string;
  sim: CometaSim;
  hold: { hold: boolean };
  startAt: number;
  x: number;
  y: number;
}

/** Cuánto se puede mover (px) quien sostiene la cometa sin soltarla (lo que se corre al quedarse quieto). */
const MOVE_TOLERANCE_PX = 6;

type Room = { onMessage(type: string, cb: (client: { sessionId: string }, raw: unknown) => void): unknown };

export class Cometas {
  private lastAt = new Map<string, number>();
  private vuelos = new Map<string, Vuelo>();
  private seq = 0;
  /** Por quién votó cada uno en este festival (lo de `UserStat` dice solo que votó). */
  private votedFor = new Map<string, string>();
  /** El día del juego de lo que hay (al cambiar se vacía) y el de la primera cometa ya celebrada. */
  private day = -1;
  private primeraDay = -1;
  private closedAt: number | null = null;
  private awardedDay = -1;
  /** Ganadores que no estaban al premiar: el logro les llega al volver. */
  private pendientes = new Set<string>();

  constructor(private readonly parts: CometasParts) {}

  active(): boolean {
    const f = this.parts.festival();
    return cometasActiva(f.id, f.fase);
  }

  private busy(userId: string): boolean {
    const now = this.parts.now();
    if (now - (this.lastAt.get(userId) ?? -Infinity) < COMETAS.cooldownMs) return true;
    this.lastAt.set(userId, now);
    return false;
  }

  private near(sessionId: string, point: "cometas_taller" | "cometas_concurso" | "cometas_techo"): CometasPlayer | null {
    const p = this.parts.player(sessionId);
    return p && nearPointOfType(this.parts.mapOf(p.area), point, p.x, p.y) ? p : null;
  }

  // ---------- El reloj ----------

  /** Cada tanto: vacía lo de otro día, termina los vuelos vencidos o con lluvia y premia tras el cierre. */
  tick() {
    const f = this.parts.festival();
    const now = this.parts.now();
    if (f.id !== COMETAS.id) {
      if (this.day !== -1) this.clear();
      this.day = -1;
      return;
    }
    if (this.day !== f.day) {
      if (this.day !== -1) this.clear();
      this.day = f.day;
    }
    const lluvia = !sePuedeVolar(this.parts.weather());
    for (const v of [...this.vuelos.values()]) {
      // Con aguacero se recoge lo que haya; si el navegador dejó de mandar, se acaba el tiempo.
      if (lluvia || f.fase !== "fiesta") this.end(v, "recogida");
      else if (now - v.startAt > VUELO.maxFrames * VUELO_FRAME_MS + COMETAS.holguraMs * 2) this.end(v, "tiempo");
    }
    if (f.fase === "fin" && this.closedAt === null && this.awardedDay !== f.day) this.closedAt = now;
    if (this.closedAt !== null && this.awardedDay !== f.day && now - this.closedAt >= this.parts.premiacionDelayMs()) {
      this.awardedDay = f.day;
      void this.award(f.año);
    }
  }

  private clear() {
    for (const v of [...this.vuelos.values()]) this.end(v, "cancelada");
    const st = this.parts.state();
    st.inscritas.clear();
    st.recordAltura = 0;
    st.recordId = "";
    st.recordName = "";
    this.votedFor.clear();
    this.closedAt = null;
  }

  /** La premiación: la más alta del día y la más bonita, con su cinemática para todos y su premio. */
  async award(año: number): Promise<void> {
    const g = this.ganadores();
    if (!g) return;
    this.cinePremiacion(g);
    const { alta, bonita } = g;
    const premios: [string, "alta" | "bonita", number][] = [];
    if (alta) premios.push([alta.id, "alta", COMETAS.premioAlta]);
    if (bonita) premios.push([bonita.ownerId, "bonita", COMETAS.premioBonita]);
    for (const [userId, premio, amount] of premios) {
      if (this.online(userId)) this.parts.stats.bump(userId, STAT_KEYS.cometaPremios);
      else this.pendientes.add(userId);
      const ref = cometasPrizeRef(año, premio);
      try {
        const r = await this.parts.repo().awardPointsOnce({ userId, amount, reason: "LEISURE", refId: ref, refPrefix: ref, maxPerDay: 1 });
        if (r.status === "ok") this.parts.points(userId, r.balance, r.awarded);
      } catch (err) {
        console.error("cometas awardPointsOnce", err);
      }
    }
  }

  /** La más alta del día y la más bonita de ahora (null si todavía no hay ninguna). */
  private ganadores() {
    const st = this.parts.state();
    const alta = st.recordAltura > 0 && st.recordId ? { id: st.recordId, name: st.recordName, altura: st.recordAltura } : null;
    const bonita = cometaGanadora([...st.inscritas.values()]);
    return alta || bonita ? { alta, bonita } : null;
  }

  /** La cinemática de la premiación para todos, con los dos premios o con el que haya. */
  private cinePremiacion({ alta, bonita }: NonNullable<ReturnType<Cometas["ganadores"]>>) {
    const id = alta && bonita ? COMETAS_CINE.premiacion : alta ? COMETAS_CINE.premiacionAlta : COMETAS_CINE.premiacionBonita;
    this.parts.cine(id, {
      ...(alta ? { alta: alta.name, altura: alta.altura } : {}),
      ...(bonita ? { bonita: bonita.ownerName, votos: bonita.votes, codigo: bonita.code } : {}),
    });
  }

  /** El panel del director: la premiación con lo de ahora, sin premios (esos se pagan al cierre). False si no hay nada. */
  premiacionYa(): boolean {
    const g = this.ganadores();
    if (g) this.cinePremiacion(g);
    return Boolean(g);
  }

  /** El panel del director: la celebración de la primera cometa, para los del jardín. */
  primeraYa(nombre: string) {
    this.parts.cine(COMETAS_CINE.primera, { nombre }, "jardin");
  }

  private online(userId: string): boolean {
    for (const [, p] of this.parts.players()) if (p.userId === userId) return true;
    return false;
  }

  /** Entró: lo suyo de este festival y, si ganó estando afuera, el logro. */
  joined(sessionId: string, userId: string) {
    if (this.pendientes.delete(userId)) this.parts.stats.bump(userId, STAT_KEYS.cometaPremios);
    this.parts.send(sessionId, COMETAS_MSG.mine, this.mine(userId));
  }

  mine(userId: string): CometasMine {
    const año = this.parts.festival().año;
    const voted = (this.parts.stats.stat(userId, cometasVoteKey(año)) ?? 0) >= 1;
    return { voto: this.votedFor.get(userId) ?? (voted ? "?" : null), techo: (this.parts.stats.stat(userId, cometasTechoKey(año)) ?? 0) >= 1 };
  }

  // ---------- El puesto ----------

  async comprar(sessionId: string, raw: unknown): Promise<CometasBuyResult | null> {
    const p = this.parts.player(sessionId);
    const parsed = CometasBuyMessage.safeParse(raw);
    if (!p || !parsed.success) return null;
    const item = cometasShopItem(parsed.data.item)!;
    const fail = (error: Extract<CometasBuyResult, { ok: false }>["error"]): CometasBuyResult => ({ ok: false, item: item.id, error });
    if (!this.active()) return fail("off");
    if (!this.parts.nearShop(sessionId)) return fail("far");
    const itemId = objItemId(item.id);
    const fits = this.parts.held.fits(p.userId, [[itemId, item.gives]]);
    if (fits !== "ok") return fail(fits);
    if (this.busy(p.userId)) return fail("busy");
    let paid: { ok: boolean; balance: number };
    try {
      paid = await this.parts.repo().spendPoints({ userId: p.userId, amount: item.price, reason: "PURCHASE", refId: cometasRefId(item.id) });
    } catch (err) {
      console.error("cometas spendPoints", err);
      return fail("failed");
    }
    if (!paid.ok) return fail("funds");
    await this.parts.held.add(p.userId, itemId, item.gives);
    this.parts.points(p.userId, paid.balance);
    return { ok: true, item: item.id, balance: paid.balance };
  }

  // ---------- El taller ----------

  async armar(sessionId: string, raw: unknown): Promise<ArmarResult | null> {
    const parsed = CometaArmarMessage.safeParse(raw);
    const p0 = this.parts.player(sessionId);
    if (!parsed.success || !p0) return null;
    const code = parsed.data.code;
    if (!this.active()) return { ok: false, error: "off" };
    const p = this.near(sessionId, "cometas_taller");
    if (!p) return { ok: false, error: "far" };
    const held = this.parts.held;
    const faltan = faltanMateriales(code, (item) => held.count(p.userId, objItemId(item)));
    if (Object.keys(faltan).length) return { ok: false, error: "materiales", faltan };
    const itemId = objItemId(cometaId(code));
    if (held.fits(p.userId, [[itemId, 1]]) !== "ok") return { ok: false, error: "full" };
    if (this.busy(p.userId)) return { ok: false, error: "busy" };
    const taken: [string, number][] = [];
    for (const [item, n] of Object.entries(cometaMateriales(code))) {
      if (!(await held.take(p.userId, objItemId(item), n))) {
        for (const [t, k] of taken) await held.add(p.userId, objItemId(t), k);
        return { ok: false, error: "materiales" };
      }
      taken.push([item, n]);
    }
    await held.add(p.userId, itemId, 1, { pick: true });
    this.parts.stats.bump(p.userId, STAT_KEYS.cometasArmadas);
    this.parts.send(sessionId, FESTIVAL_MSG.cine, { id: COMETAS_CINE.armada, vars: { nombre: cometaName(code) } } satisfies FestivalCineEvent);
    return { ok: true, code };
  }

  // ---------- Volar ----------

  /** Soltar la cometa de la mano en el voladero: la sala sortea las ráfagas y le manda el vuelo al navegador. */
  volar(sessionId: string): VolarResult | null {
    const p = this.parts.player(sessionId);
    if (!p) return null;
    const fail = (error: Extract<VolarResult, { ok: false }>["error"]): VolarResult => ({ ok: false, error });
    if (!this.active()) return fail("off");
    if (this.vuelos.has(sessionId)) return fail("ya");
    const code = cometaCodeOf(this.parts.held.hand(p.userId)?.id ?? "");
    if (!code) return fail("sin-cometa");
    const ts = this.parts.mapOf(p.area).tileSize;
    if (p.area !== "jardin" || !enVoladero(Math.floor(p.x / ts), Math.floor(p.y / ts))) return fail("lejos");
    if (p.seated || p.swimming) return fail("ocupado");
    const viento = vientoDelClima(this.parts.weather());
    if (viento <= 0) return fail("lluvia");
    if (this.busy(p.userId)) return fail("busy");
    const seed = this.parts.random(2 ** 31);
    const v: Vuelo = { id: ++this.seq, sessionId, userId: p.userId, sim: new CometaSim({ seed, viento, code }), hold: { hold: false }, startAt: this.parts.now(), x: p.x, y: p.y };
    this.vuelos.set(sessionId, v);
    const s = new CometaVueloState();
    Object.assign(s, { userId: p.userId, name: p.name, code, altura: alturaDe(v.sim), tenso: false });
    this.parts.state().vuelos.set(sessionId, s);
    return { ok: true, id: v.id, seed, viento, code };
  }

  /**
   * Los botones del vuelo hasta un cuadro (cada poquito, y al recoger con `fin`). Los cuadros no pueden ir
   * más rápido que el reloj de la sala; si el vuelo terminó solo (rota o caída), se cierra con eso.
   */
  paso(sessionId: string, raw: unknown, fin: boolean) {
    const parsed = CometaPasoMessage.safeParse(raw);
    const v = this.vuelos.get(sessionId);
    if (!parsed.success || !v || parsed.data.id !== v.id) return;
    const { toggles, frames } = parsed.data;
    const elapsed = this.parts.now() - v.startAt;
    if (frames * VUELO_FRAME_MS > elapsed + COMETAS.holguraMs) return this.end(v, "invalida");
    if (!advanceVuelo(v.sim, v.hold, toggles, frames)) return this.end(v, "invalida");
    const s = this.parts.state().vuelos.get(sessionId);
    if (s) {
      s.altura = alturaDe(v.sim);
      s.tenso = v.sim.tenso;
    }
    // La primera del día que se eleva de verdad: la loma la celebra.
    const f = this.parts.festival();
    if (this.primeraDay !== f.day && v.sim.altura >= COMETAS.primeraAltura) {
      this.primeraDay = f.day;
      this.parts.cine(COMETAS_CINE.primera, { nombre: this.parts.player(sessionId)?.name ?? "" }, "jardin");
    }
    if (v.sim.done) return this.end(v, v.sim.fin ?? "caida");
    if (fin) this.end(v, "recogida");
  }

  /** Se movió (o se sentó): la cometa se suelta. */
  moved(sessionId: string, x: number, y: number) {
    const v = this.vuelos.get(sessionId);
    if (v && Math.hypot(x - v.x, y - v.y) > MOVE_TOLERANCE_PX) this.end(v, "cancelada");
  }

  /** Se fue (o cambió de nivel). */
  left(sessionId: string) {
    const v = this.vuelos.get(sessionId);
    if (v) this.end(v, "cancelada");
  }

  private end(v: Vuelo, motivo: VueloMotivo) {
    if (this.vuelos.get(v.sessionId) !== v) return;
    this.vuelos.delete(v.sessionId);
    this.parts.state().vuelos.delete(v.sessionId);
    const cuenta = vueloCuenta(motivo);
    const altura = cuenta ? alturaDe(v.sim) : 0;
    let record = false;
    if (altura > 0) {
      this.parts.stats.max(v.userId, STAT_KEYS.cometaAltura, altura);
      const st = this.parts.state();
      if (altura > st.recordAltura) {
        st.recordAltura = altura;
        st.recordId = v.userId;
        st.recordName = this.parts.player(v.sessionId)?.name ?? st.recordName;
        record = true;
      }
    }
    this.parts.send(v.sessionId, COMETAS_MSG.fin, { id: v.id, motivo, altura, record } satisfies VueloEnd);
  }

  /** ¿Tiene una cometa en el aire? */
  flying(sessionId: string): boolean {
    return this.vuelos.has(sessionId);
  }

  // ---------- El concurso ----------

  inscribir(sessionId: string): CometaConcursoResult | null {
    const p0 = this.parts.player(sessionId);
    if (!p0) return null;
    if (!this.active()) return { ok: false, error: "off" };
    const p = this.near(sessionId, "cometas_concurso");
    if (!p) return { ok: false, error: "far" };
    const code = cometaCodeOf(this.parts.held.hand(p.userId)?.id ?? "");
    if (!code) return { ok: false, error: "sin-cometa" };
    const st = this.parts.state();
    if (st.inscritas.has(p.userId)) return { ok: false, error: "ya-inscrita" };
    if (this.busy(p.userId)) return { ok: false, error: "busy" };
    const e = new CometaInscritaState();
    Object.assign(e, { ownerId: p.userId, ownerName: p.name, code, votes: 0, at: this.parts.now() });
    st.inscritas.set(p.userId, e);
    return { ok: true, accion: "inscribir" };
  }

  votar(sessionId: string, raw: unknown): CometaConcursoResult | null {
    const parsed = CometaVotoMessage.safeParse(raw);
    const p0 = this.parts.player(sessionId);
    if (!parsed.success || !p0) return null;
    if (!this.active()) return { ok: false, error: "off" };
    const p = this.near(sessionId, "cometas_concurso");
    if (!p) return { ok: false, error: "far" };
    const e = this.parts.state().inscritas.get(parsed.data.owner);
    if (!e) return { ok: false, error: "nadie" };
    if (e.ownerId === p.userId) return { ok: false, error: "propia" };
    // Sin los contadores leídos no se sabe si ya votó (de otra conexión o antes de un reinicio).
    if (!this.parts.stats.isLoaded(p.userId)) return { ok: false, error: "busy" };
    if (this.mine(p.userId).voto) return { ok: false, error: "votaste" };
    if (this.busy(p.userId)) return { ok: false, error: "busy" };
    this.parts.stats.max(p.userId, cometasVoteKey(this.parts.festival().año), 1);
    this.votedFor.set(p.userId, e.ownerId);
    e.votes += 1;
    return { ok: true, accion: "votar" };
  }

  // ---------- El techo del garaje ----------

  async techo(sessionId: string): Promise<TechoResult | null> {
    const p0 = this.parts.player(sessionId);
    if (!p0) return null;
    if (!this.active()) return { ok: false, error: "off" };
    const p = this.near(sessionId, "cometas_techo");
    if (!p) return { ok: false, error: "far" };
    if (!this.parts.stats.isLoaded(p.userId)) return { ok: false, error: "busy" };
    const key = cometasTechoKey(this.parts.festival().año);
    if ((this.parts.stats.stat(p.userId, key) ?? 0) >= 1) return { ok: false, error: "ya" };
    const item = objItemId(COMETA_PERDIDA);
    if (this.parts.held.fits(p.userId, [[item, 1]]) !== "ok") return { ok: false, error: "full" };
    if (this.busy(p.userId)) return { ok: false, error: "busy" };
    // La marca va antes de dar: dos mensajes seguidos no dan dos.
    this.parts.stats.max(p.userId, key, 1);
    await this.parts.held.add(p.userId, item, 1, { pick: true });
    return { ok: true };
  }

  forget(userId: string) {
    this.lastAt.delete(userId);
  }
}

/** Engancha los mensajes del Festival de cometas en la sala (una línea en OfficeRoom). */
export function registerCometas(room: Room, parts: CometasParts, markActive: (client: { sessionId: string }) => void): Cometas {
  const c = new Cometas(parts);
  const reply = (sessionId: string, type: string, r: unknown) => r && parts.send(sessionId, type, r);
  room.onMessage(COMETAS_MSG.comprar, (client, raw) => {
    markActive(client);
    void c.comprar(client.sessionId, raw).then((r) => reply(client.sessionId, COMETAS_MSG.comprarResult, r));
  });
  room.onMessage(COMETAS_MSG.armar, (client, raw) => {
    markActive(client);
    void c.armar(client.sessionId, raw).then((r) => reply(client.sessionId, COMETAS_MSG.armarResult, r));
  });
  room.onMessage(COMETAS_MSG.volar, (client) => {
    markActive(client);
    reply(client.sessionId, COMETAS_MSG.vuelo, c.volar(client.sessionId));
  });
  room.onMessage(COMETAS_MSG.paso, (client, raw) => {
    markActive(client);
    c.paso(client.sessionId, raw, false);
  });
  room.onMessage(COMETAS_MSG.recoger, (client, raw) => {
    markActive(client);
    c.paso(client.sessionId, raw, true);
  });
  room.onMessage(COMETAS_MSG.inscribir, (client) => {
    markActive(client);
    reply(client.sessionId, COMETAS_MSG.concursoResult, c.inscribir(client.sessionId));
  });
  room.onMessage(COMETAS_MSG.votar, (client, raw) => {
    markActive(client);
    const r = c.votar(client.sessionId, raw);
    reply(client.sessionId, COMETAS_MSG.concursoResult, r);
    const p = parts.player(client.sessionId);
    if (r && p) parts.send(client.sessionId, COMETAS_MSG.mine, c.mine(p.userId));
  });
  room.onMessage(COMETAS_MSG.techo, (client) => {
    markActive(client);
    void c.techo(client.sessionId).then((r) => {
      reply(client.sessionId, COMETAS_MSG.techoResult, r);
      const p = parts.player(client.sessionId);
      if (r?.ok && p) parts.send(client.sessionId, COMETAS_MSG.mine, c.mine(p.userId));
    });
  });
  return c;
}
