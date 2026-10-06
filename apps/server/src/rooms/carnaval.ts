// El Carnaval de Negros y Blancos en la sala (ver carnaval.ts de @hyvento/shared y de @hyvento/map): el
// desfile que sale a las 11, 15 y 19 del juego por la calle del Megabús (mientras pasa, el bus no sale),
// la comparsa de la cabaña (quien se suma desde la vereda baila detrás del Megabús de la alegría y lo
// mueve la sala, como el viaje del bus: la calle no se camina), la maicena y las serpentinas (con F sobre
// alguien de al lado, nunca a quien está en "No molestar" o no quiere), el concurso de disfraces (se
// postula la pinta de ahora y se vota una vez; a las 21:00 se premia) y el puesto del carnaval. La sala le
// da la mochila, los contadores, los puntos, el reloj y cómo mover a alguien; este módulo no conoce Colyseus.
import { bajadaMs, cabanaPuesto, cabanaX, desfileEstado, DESFILE_BAJADA_X, type DesfileTiming } from "@hyvento/map";
import {
  CARNAVAL,
  CARNAVAL_CINE,
  CARNAVAL_MSG,
  COMPARSA_CABANA_EMOTES,
  CarnavalBuyMessage,
  FESTIVAL_MSG,
  LanzarMessage,
  MSG,
  STAT_KEYS,
  TalcoPrefMessage,
  VotarMessage,
  carnavalActivo,
  carnavalRefId,
  carnavalShopItem,
  concursoAbierto,
  desfileDeLaHora,
  desfilesStatKey,
  ganadorDelConcurso,
  isCarnavalSouvenir,
  isLanzable,
  objItemId,
  type CarnavalBuyResult,
  type ConcursoResult,
  type EmoteEvent,
  type FestivalCineEvent,
  type JoinResult,
  type LanzadoEvent,
  type LanzarResult,
} from "@hyvento/shared";
import type { GameRepository } from "../repo/types";
import type { AchievementTracker } from "./achievements";
import type { Bag } from "./bag";
import { CandidatoState, type CarnavalState, type Player } from "../state";

/** El área del desfile (la calle del Megabús está en el jardín). */
const AREA = "jardin";

export interface CarnavalDeps {
  /** El festival de ahora (`state.festival`, su fase) y la fecha y hora del juego. */
  festival(): { id: string; fase: string; day: number; año: number; minuteOfDay: number };
  state(): CarnavalState;
  player(sessionId: string): Player | undefined;
  players(): Iterable<[string, Player]>;
  tileSize(): number;
  held: Pick<Bag, "count" | "fits" | "add" | "hand" | "take">;
  stats: Pick<AchievementTracker, "stat" | "bump">;
  repo(): Pick<GameRepository, "spendPoints">;
  /** Puntos de ocio (con su tope del día); devuelve cuántos dio. */
  award(userId: string, amount: number): Promise<number>;
  now(): number;
  timing(): DesfileTiming;
  /** ¿Sale solo a su hora? (los tests de otras cosas lo apagan: el reloj real puede caer en el Carnaval). */
  autoDesfile(): boolean;
  later(ms: number, fn: () => void): { clear(): void };
  send(sessionId: string, type: string, msg: unknown): void;
  toArea(area: string, type: string, msg: unknown): void;
  broadcast(type: string, msg: unknown): void;
  /** ¿El bus está fuera de la calle (no viene, no está en la estación)? */
  busAway(): boolean;
  /** La calle ocupada: el bus espera (también el de refuerzo) hasta que pase el desfile. */
  holdBus(on: boolean): void;
  /** ¿Está ocupado en otra cosa (sentado, nadando, pescando, desmayado, corriendo…)? Entonces no se suma. */
  busy(sessionId: string, p: Player): boolean;
  /** La sala lo pone en la calle (bailando): sin validar el paso, como el viaje del bus. */
  place(sessionId: string, x: number, y: number, moving: boolean): void;
  /** La sala lo baja a la vereda (al tile caminable más cercano a x) y le avisa al navegador. */
  drop(sessionId: string, xTiles: number): void;
}

export class Carnaval {
  /** La comparsa de la cabaña, en orden de llegada (sessionIds): de ahí sale el puesto de cada uno. */
  private miembros: string[] = [];
  /** La hora del desfile que ya salió (`día:hora`) y el último emote mandado en una parada. */
  private salio = "";
  private emoteTick = "";
  /** El concurso de cada día del juego: quién votó (User.id → por quién). */
  private concursoDia = -1;
  private votos = new Map<string, string>();
  /** Quién pidió no recibir maicena ni serpentinas (User.id). */
  private noTalco = new Set<string>();
  private talcoTimers = new Map<string, { clear(): void }>();
  private lastAt = new Map<string, number>();
  private lastBuyAt = new Map<string, number>();

  constructor(private readonly d: CarnavalDeps) {}

  active(): boolean {
    const f = this.d.festival();
    return carnavalActivo(f.id, f.fase);
  }

  /** ¿Va en la comparsa? */
  enComparsa(sessionId: string) {
    return this.miembros.includes(sessionId);
  }

  // ---------- El reloj ----------

  /** Cada tanto (unas 10 veces por segundo): el concurso, la hora del desfile y la comparsa en la calle. */
  tick() {
    const f = this.d.festival();
    const st = this.d.state();
    const carnaval = f.id === CARNAVAL.id;
    if (carnaval && f.day !== this.concursoDia) this.resetConcurso(f.day);
    if (carnaval && !st.concursoCerrado && (f.fase === "fin" || (f.fase === "fiesta" && !concursoAbierto(f.minuteOfDay)))) void this.cerrarConcurso();
    if (st.fase === "desfile") return this.mover();
    const hora = this.active() && this.d.autoDesfile() ? desfileDeLaHora(f.minuteOfDay) : null;
    const key = hora === null ? "" : `${f.day}:${hora}`;
    if (st.fase === "" && key && key !== this.salio) {
      this.salio = key;
      st.fase = "espera";
      this.d.holdBus(true);
    }
    if (st.fase === "espera") {
      if (!this.active()) {
        st.fase = "";
        this.d.holdBus(false);
      } else if (this.d.busAway()) this.empezar();
    }
  }

  /** Sale el desfile ya (lo usan el reloj y, en desarrollo, `/desfile`). */
  empezar() {
    const st = this.d.state();
    const t = this.d.timing();
    st.fase = "desfile";
    st.inicio = this.d.now();
    st.corrida++;
    st.velocidad = t.velocidad;
    st.paradaMs = t.paradaMs;
    this.d.holdBus(true);
    this.emoteTick = "";
    this.d.toArea(AREA, FESTIVAL_MSG.cine, { id: CARNAVAL_CINE.salida } satisfies FestivalCineEvent);
  }

  /** Mueve la comparsa de la cabaña con la fila; al llegar a la bajada se baja cada uno, y al final se acaba. */
  private mover() {
    const st = this.d.state();
    const t = this.d.timing();
    const ms = this.d.now() - st.inicio;
    const e = desfileEstado(ms, t);
    // Si el festival se apagó (o cerró) en plena calle, el desfile se acaba y todos a la vereda.
    if (!this.active()) {
      for (const id of [...this.miembros]) this.bajar(id, false);
      return this.terminar();
    }
    if (ms >= bajadaMs(t)) for (const id of [...this.miembros]) this.bajar(id, true);
    const ts = this.d.tileSize();
    this.miembros.forEach((id, i) => {
      const p = cabanaPuesto(i, e.cabeza);
      this.d.place(id, p.x * ts, p.y * ts, e.parada === null);
    });
    // En las paradas, la comparsa de la cabaña repite su frase (los emotes, para que todos la vean).
    if (e.parada !== null && this.miembros.length) {
      const beat = Math.floor(e.paradaMs / (CARNAVAL.beatMs * 3));
      const key = `${st.corrida}:${e.parada}:${beat}`;
      if (key !== this.emoteTick) {
        this.emoteTick = key;
        const emote = COMPARSA_CABANA_EMOTES[beat % COMPARSA_CABANA_EMOTES.length]!;
        for (const id of this.miembros) this.d.toArea(AREA, MSG.emoteEvent, { sessionId: id, emote } satisfies EmoteEvent);
      }
    }
    if (e.fin) this.terminar();
  }

  private terminar() {
    const st = this.d.state();
    st.fase = "";
    this.d.holdBus(false);
  }

  // ---------- La comparsa de la cabaña ----------

  /** Sumarse (desde la vereda, cerca de la comparsa de la cabaña que pasa por la calle). */
  join(sessionId: string): JoinResult {
    const p = this.d.player(sessionId);
    if (!p) return { ok: false, error: "far" };
    if (!this.active()) return { ok: false, error: "off" };
    if (this.enComparsa(sessionId)) return { ok: false, error: "already" };
    const st = this.d.state();
    const t = this.d.timing();
    const ms = this.d.now() - st.inicio;
    if (st.fase !== "desfile" || ms >= bajadaMs(t) - 3000) return { ok: false, error: "noDesfile" };
    if (this.d.busy(sessionId, p)) return { ok: false, error: "busy" };
    const ts = this.d.tileSize();
    const x = cabanaX(desfileEstado(ms, t).cabeza);
    const near = p.area === AREA && p.y >= CARNAVAL.veredaDesdeY * ts && Math.abs(p.x / ts - x) <= CARNAVAL.joinReachTiles && x < DESFILE_BAJADA_X;
    if (!near) return { ok: false, error: "far" };
    this.miembros.push(sessionId);
    p.comparsa = true;
    const slot = cabanaPuesto(this.miembros.length - 1, desfileEstado(ms, t).cabeza);
    this.d.place(sessionId, slot.x * ts, slot.y * ts, false);
    this.d.send(sessionId, FESTIVAL_MSG.cine, { id: CARNAVAL_CINE.sumarse } satisfies FestivalCineEvent);
    return { ok: true, joined: true };
  }

  /** Salirse: a la vereda, sin los puntos del final. */
  leave(sessionId: string): JoinResult {
    if (!this.enComparsa(sessionId)) return { ok: false, error: "noDesfile" };
    this.bajar(sessionId, false);
    return { ok: true, joined: false };
  }

  /** Baja a alguien de la calle a la vereda; con `completo`, bailó hasta el final: puntos y su cinemática. */
  private bajar(sessionId: string, completo: boolean) {
    const i = this.miembros.indexOf(sessionId);
    if (i < 0) return;
    this.miembros.splice(i, 1);
    const p = this.d.player(sessionId);
    if (!p) return;
    const ts = this.d.tileSize();
    p.comparsa = false;
    this.d.drop(sessionId, Math.min(p.x / ts, DESFILE_BAJADA_X));
    if (completo) void this.premiarDesfile(sessionId, p.userId);
  }

  private async premiarDesfile(sessionId: string, userId: string) {
    const f = this.d.festival();
    const key = desfilesStatKey(f.año);
    this.d.stats.bump(userId, key);
    this.d.stats.bump(userId, STAT_KEYS.comparsaParades);
    const n = this.d.stats.stat(userId, key) ?? 1;
    const pts = n <= CARNAVAL.desfilesConPuntos ? await this.d.award(userId, CARNAVAL.puntosDesfile).catch(() => 0) : 0;
    const puntos = pts > 0 ? `+${pts} puntos de ocio` : "Bailaste todo el recorrido";
    this.d.send(sessionId, FESTIVAL_MSG.cine, { id: CARNAVAL_CINE.final, vars: { puntos } } satisfies FestivalCineEvent);
  }

  // ---------- Maicena y serpentinas ----------

  /** No quiero recibir (o sí). */
  talcoPref(userId: string, raw: unknown) {
    const parsed = TalcoPrefMessage.safeParse(raw);
    if (!parsed.success) return;
    if (parsed.data.off) this.noTalco.add(userId);
    else this.noTalco.delete(userId);
  }

  /** Echarle lo de la mano a alguien de al lado. Null si el mensaje no sirve. */
  async lanzar(sessionId: string, raw: unknown): Promise<LanzarResult | null> {
    const parsed = LanzarMessage.safeParse(raw);
    const p = this.d.player(sessionId);
    if (!parsed.success || !p) return null;
    const to = this.d.player(parsed.data.to);
    const name = to?.name;
    if (!this.active()) return { ok: false, error: "off" };
    const kind = this.d.held.hand(p.userId)?.id ?? "";
    if (!isLanzable(kind)) return { ok: false, error: "nothing" };
    if (!to || to.area !== p.area) return { ok: false, error: "far" };
    if (to.userId === p.userId) return { ok: false, error: "self" };
    const ts = this.d.tileSize();
    if (Math.hypot(to.x - p.x, to.y - p.y) > CARNAVAL.lanzarReachTiles * ts) return { ok: false, error: "far", name };
    if (to.status === "dnd") return { ok: false, error: "dnd", name };
    if (this.noTalco.has(to.userId)) return { ok: false, error: "noTalco", name };
    const now = this.d.now();
    if (now - (this.lastAt.get(p.userId) ?? -Infinity) < CARNAVAL.lanzarPausaMs) return { ok: false, error: "busy", name };
    this.lastAt.set(p.userId, now);
    if (!(await this.d.held.take(p.userId, objItemId(kind), 1))) return { ok: false, error: "nothing" };
    if (kind === "maicena") {
      to.talco = true;
      this.talcoTimers.get(to.userId)?.clear();
      this.talcoTimers.set(
        to.userId,
        this.d.later(CARNAVAL.talcoMs, () => {
          this.talcoTimers.delete(to.userId);
          for (const [, q] of this.d.players()) if (q.userId === to.userId) q.talco = false;
        }),
      );
    }
    this.d.toArea(p.area, CARNAVAL_MSG.lanzado, { from: sessionId, to: parsed.data.to, kind } satisfies LanzadoEvent);
    return { ok: true, kind, to: parsed.data.to, name: to.name };
  }

  // ---------- El concurso de disfraces ----------

  private resetConcurso(day: number) {
    const st = this.d.state();
    this.concursoDia = day;
    this.votos.clear();
    st.candidatos.clear();
    st.ganador = "";
    st.concursoCerrado = false;
  }

  /** Postular la pinta de ahora (otra vez: se actualiza la pinta y se quedan los votos). */
  postular(sessionId: string): ConcursoResult {
    const p = this.d.player(sessionId);
    const st = this.d.state();
    if (!p || !this.active()) return { ok: false, error: "off" };
    if (st.concursoCerrado || !concursoAbierto(this.d.festival().minuteOfDay)) return { ok: false, error: "closed" };
    let c = st.candidatos.get(p.userId);
    if (!c) {
      if (st.candidatos.size >= CARNAVAL.maxCandidatos) return { ok: false, error: "full" };
      c = new CandidatoState();
      c.userId = p.userId;
      c.at = this.d.now();
      st.candidatos.set(p.userId, c);
    }
    c.name = p.name;
    c.look = p.look;
    c.avatar = p.avatar;
    return { ok: true, kind: "postulado" };
  }

  /** Votar por alguien postulado: una vez por persona en el carnaval. */
  votar(userId: string, raw: unknown): ConcursoResult | null {
    const parsed = VotarMessage.safeParse(raw);
    if (!parsed.success) return null;
    const st = this.d.state();
    if (!this.active()) return { ok: false, error: "off" };
    if (st.concursoCerrado || !concursoAbierto(this.d.festival().minuteOfDay)) return { ok: false, error: "closed" };
    const c = st.candidatos.get(parsed.data.userId);
    if (!c) return { ok: false, error: "unknown" };
    if (c.userId === userId) return { ok: false, error: "self" };
    if (this.votos.has(userId)) return { ok: false, error: "voted" };
    this.votos.set(userId, c.userId);
    c.votos++;
    return { ok: true, kind: "votado", name: c.name };
  }

  /** ¿Ya votó? (para el panel). */
  votoDe(userId: string): string | null {
    return this.votos.get(userId) ?? null;
  }

  /** Cierra el concurso: el más votado gana el logro, el premio y la cinemática de premiación para todos. */
  private async cerrarConcurso() {
    const st = this.d.state();
    st.concursoCerrado = true;
    const best = ganadorDelConcurso([...st.candidatos.values()].map((c) => ({ userId: c.userId, votos: c.votos, at: c.at })));
    if (!best) return;
    const c = st.candidatos.get(best.userId)!;
    st.ganador = c.userId;
    this.d.stats.bump(c.userId, STAT_KEYS.carnavalCrowns);
    await this.d.award(c.userId, CARNAVAL.premioPuntos).catch(() => 0);
    const votos = c.votos === 1 ? "1 voto" : `${c.votos} votos`;
    this.d.broadcast(FESTIVAL_MSG.cine, { id: CARNAVAL_CINE.premiacion, vars: { nombre: c.name, votos } } satisfies FestivalCineEvent);
  }

  // ---------- El puesto ----------

  /** Comprar en el puesto. `near`: si está junto al puesto (lo mide la sala). Null si el mensaje no sirve. */
  async buy(userId: string, raw: unknown, near: boolean): Promise<CarnavalBuyResult | null> {
    const parsed = CarnavalBuyMessage.safeParse(raw);
    if (!parsed.success) return null;
    const item = carnavalShopItem(parsed.data.item)!;
    const fail = (error: Extract<CarnavalBuyResult, { ok: false }>["error"]): CarnavalBuyResult => ({ ok: false, item: item.id, error });
    if (!this.active()) return fail("off");
    if (!near) return fail("far");
    const itemId = objItemId(item.id);
    if (isCarnavalSouvenir(item.id) && this.d.held.count(userId, itemId) > 0) return fail("owned");
    const fits = this.d.held.fits(userId, [[itemId, item.gives]]);
    if (fits !== "ok") return fail(fits);
    const now = this.d.now();
    if (now - (this.lastBuyAt.get(userId) ?? -Infinity) < CARNAVAL.compraPausaMs) return fail("busy");
    this.lastBuyAt.set(userId, now);
    let paid: { ok: boolean; balance: number };
    try {
      paid = await this.d.repo().spendPoints({ userId, amount: item.price, reason: "PURCHASE", refId: carnavalRefId(item.id) });
    } catch (err) {
      console.error("carnaval spendPoints", err);
      return fail("failed");
    }
    if (!paid.ok) return fail("funds");
    await this.d.held.add(userId, itemId, item.gives);
    return { ok: true, item: item.id, balance: paid.balance };
  }

  /** Se fue de la sala. */
  forget(sessionId: string, userId: string) {
    const i = this.miembros.indexOf(sessionId);
    if (i >= 0) this.miembros.splice(i, 1);
    this.lastAt.delete(userId);
    this.lastBuyAt.delete(userId);
  }

  dispose() {
    for (const t of this.talcoTimers.values()) t.clear();
    this.talcoTimers.clear();
  }
}
