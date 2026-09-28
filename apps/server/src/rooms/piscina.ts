// La piscina del jardín en el servidor: meterse por las escaleras, tirarse del trampolín (lo ven todos),
// salir por el borde (y quedar mojado un rato), sacar a todos cuando llueve (la piscina se tapa con la
// lona) y los puntos de las reposeras al sol. Nadando, la sala valida el movimiento contra el agua
// (`canSwimAt`) en vez de contra el piso. Este módulo no conoce Colyseus: la sala le da a la gente, el
// mapa, el clima y la hora, y hace lo que devuelve (mover, avisar, dar puntos).
import { diveLine, nearPointOfType, pointsOfType, poolEntrySpot, poolExitSpot, seatAtPoint, type OfficeMap } from "@hyvento/map";
import { AGUA, AGUA_MSG, AguaActionMessage, isSunSeat, poolCovered, sunny, type AguaNoticeCode, type DiveEvent, type Weather } from "@hyvento/shared";
import type { HeldClock } from "./consumables";

/** Lo que el módulo necesita de cada persona (un `Player` de la sala). */
export interface Bather {
  userId: string;
  area: string;
  x: number;
  y: number;
  seated: boolean;
  swimming: boolean;
  status: string;
}

export interface PiscinaDeps {
  clock: HeldClock;
  now(): number;
  map(area: string): OfficeMap;
  weather(): Weather;
  /** ¿Es de noche en el reloj del juego? (de noche no hay sol). */
  night(): boolean;
  /** La gente de la sala, por sessionId. */
  people(): Iterable<[string, Bather]>;
  /** Pone a alguien en (x, y) de su nivel, nadando o de pie, y le corrige la posición al cliente. */
  place(sessionId: string, x: number, y: number, swimming: boolean): void;
  /** Cambió si alguien está mojado (la sala lo copia a sus `Player`). */
  setWet(userId: string, wet: boolean): void;
  toArea(area: string, type: string, message: unknown): void;
  notice(sessionId: string, code: AguaNoticeCode): void;
  /** Premio de ocio (LEISURE, con el tope diario). */
  award(userId: string, amount: number): Promise<number>;
  /** ¿Tuvo actividad reciente? (sin ella no se ganan puntos, como la presencia). */
  active(sessionId: string): boolean;
  /** Lugar libre cerca (de pie), para sacar a alguien si el borde está lleno. */
  freeSpot(map: OfficeMap, x: number, y: number): { x: number; y: number };
  /** Tiempos (los tests los acortan). */
  timings(): { wetMs: number; tickMs: number; diveCooldownMs: number };
}

export class Piscina {
  private wet = new Map<string, { clear(): void }>();
  private lastDive = new Map<string, number>();
  /** Desde cuándo cuenta el sol de cada persona en su reposera (se reinicia al pararse o si se nubla). */
  private sunSince = new Map<string, number>();

  constructor(private readonly deps: PiscinaDeps) {}

  isWet(userId: string) {
    return this.wet.has(userId);
  }

  /** Queda mojado un rato (si ya lo estaba, vuelve a contar). */
  soak(userId: string) {
    this.wet.get(userId)?.clear();
    const timer = this.deps.clock.setTimeout(() => {
      this.wet.delete(userId);
      this.deps.setWet(userId, false);
    }, this.deps.timings().wetMs);
    const was = this.wet.has(userId);
    this.wet.set(userId, timer);
    if (!was) this.deps.setWet(userId, true);
  }

  /** ¿Hay otra persona (de pie o nadando) en ese lugar? */
  private taken(sessionId: string, area: string) {
    const ts = this.deps.map(area).tileSize;
    return (x: number, y: number) => {
      for (const [id, p] of this.deps.people()) if (id !== sessionId && p.area === area && Math.hypot(p.x - x, p.y - y) < ts * 0.6) return true;
      return false;
    };
  }

  /** E junto a la piscina: meterse, tirarse o salir. Devuelve el porqué si no se pudo (y lo avisa). */
  action(sessionId: string, p: Bather, raw: unknown): AguaNoticeCode | null {
    const parsed = AguaActionMessage.safeParse(raw);
    if (!parsed.success) return null;
    const problem = parsed.data.action === "swim" ? this.enter(sessionId, p) : parsed.data.action === "dive" ? this.dive(sessionId, p) : this.out(sessionId, p);
    if (problem) this.deps.notice(sessionId, problem);
    return problem;
  }

  private enter(sessionId: string, p: Bather): AguaNoticeCode | null {
    if (p.swimming) return null;
    if (p.seated) return "busy";
    const map = this.deps.map(p.area);
    if (!nearPointOfType(map, "pool_steps", p.x, p.y)) return "far";
    if (poolCovered(this.deps.weather())) return "covered";
    const spot = poolEntrySpot(map, p.x, p.y, this.taken(sessionId, p.area));
    if (!spot) return "far";
    this.deps.place(sessionId, spot.x, spot.y, true);
    return null;
  }

  private dive(sessionId: string, p: Bather): AguaNoticeCode | null {
    if (p.seated || p.swimming) return "busy";
    const map = this.deps.map(p.area);
    if (!nearPointOfType(map, "diving_board", p.x, p.y)) return "far";
    if (poolCovered(this.deps.weather())) return "covered";
    const now = this.deps.now();
    if (now - (this.lastDive.get(p.userId) ?? -Infinity) < this.deps.timings().diveCooldownMs) return "wait";
    // El trampolín más cercano a quien salta.
    const ts = map.tileSize;
    const board = map.furniture
      .filter((f) => f.type === "diving-board")
      .sort((a, b) => Math.hypot((a.x + 0.5) * ts - p.x, (a.y + 0.5) * ts - p.y) - Math.hypot((b.x + 0.5) * ts - p.x, (b.y + 0.5) * ts - p.y))[0];
    const line = board && diveLine(map, board);
    if (!line) return "far";
    const taken = this.taken(sessionId, p.area);
    const landing = taken(line.toX, line.toY) ? poolEntrySpot(map, line.toX, line.toY, taken) : { x: line.toX, y: line.toY };
    if (!landing) return "far";
    this.lastDive.set(p.userId, now);
    const event: DiveEvent = { sessionId, fromX: line.fromX, fromY: line.fromY, toX: landing.x, toY: landing.y };
    this.deps.toArea(p.area, AGUA_MSG.dive, event);
    this.deps.place(sessionId, landing.x, landing.y, true);
    return null;
  }

  private out(sessionId: string, p: Bather): AguaNoticeCode | null {
    if (!p.swimming) return null;
    const map = this.deps.map(p.area);
    const spot = poolExitSpot(map, p.x, p.y, AGUA.exitReachTiles, this.taken(sessionId, p.area));
    if (!spot) return "edge";
    this.deps.place(sessionId, spot.x, spot.y, false);
    this.soak(p.userId);
    return null;
  }

  /** Cambió el clima: con lluvia o tormenta se tapa la piscina y todos salen al deck (mojados). */
  weatherChanged(w: Weather) {
    if (!poolCovered(w)) return;
    for (const [sessionId, p] of [...this.deps.people()]) {
      if (!p.swimming) continue;
      const map = this.deps.map(p.area);
      const spot =
        poolExitSpot(map, p.x, p.y, AGUA.exitReachTiles, this.taken(sessionId, p.area)) ??
        this.nearestSteps(map, p.x, p.y) ??
        this.deps.freeSpot(map, p.x, p.y);
      this.deps.place(sessionId, spot.x, spot.y, false);
      this.soak(p.userId);
      this.deps.notice(sessionId, "rain");
    }
  }

  /** Junto a la escalera más cercana (para sacar a quien está en el medio de la pileta). */
  private nearestSteps(map: OfficeMap, x: number, y: number) {
    const steps = pointsOfType(map, "pool_steps").sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    return steps ? this.deps.freeSpot(map, steps.x, steps.y) : null;
  }

  /**
   * Los puntos del sol: a quien está en una reposera con el cielo despejado, de día y con actividad
   * reciente, cada `tickMs`. Pararse, nublarse o anochecer vuelven a empezar la cuenta.
   */
  async sunTick() {
    const now = this.deps.now();
    const shining = sunny(this.deps.weather(), this.deps.night());
    const seen = new Set<string>();
    for (const [sessionId, p] of [...this.deps.people()]) {
      const seat = p.seated ? seatAtPoint(this.deps.map(p.area), p.x, p.y) : undefined;
      if (!seat || !isSunSeat(seat.type) || !shining || p.status === "away" || !this.deps.active(sessionId)) continue;
      seen.add(p.userId);
      const since = this.sunSince.get(p.userId);
      if (since === undefined) {
        this.sunSince.set(p.userId, now);
        continue;
      }
      if (now - since < this.deps.timings().tickMs) continue;
      this.sunSince.set(p.userId, now);
      await this.deps.award(p.userId, AGUA.sunPoints);
    }
    for (const userId of [...this.sunSince.keys()]) if (!seen.has(userId)) this.sunSince.delete(userId);
  }

  /** Se fue de la sala: se olvida el sol (lo mojado sigue: recargar no seca). */
  forget(userId: string) {
    this.sunSince.delete(userId);
    this.lastDive.delete(userId);
  }

  dispose() {
    for (const t of this.wet.values()) t.clear();
    this.wet.clear();
  }
}
