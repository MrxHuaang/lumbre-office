// El observatorio del jardín: la fogata de malvaviscos (el minijuego se valida por tiempos medidos aquí,
// con un calor sorteado por malvavisco y un tope diario de puntos) y el telescopio (quién está mirando,
// las estrellas fugaces que decide el servidor de noche y quién dice primero "¡la vi!"). La noche es la
// del reloj del juego. Adentro, la astrónoma contesta con E lo que se ve del cielo a esa hora y con ese
// clima: la frase la elige el servidor y la oyen todos los del nivel. Este módulo no conoce Colyseus: la sala le da el reloj, el azar y cómo avisar.
import { nearPointOfType, type OfficeMap } from "@hyvento/map";
import {
  ASTRONOMA,
  astronomerLine,
  bogotaDay,
  doneness,
  isFreeHold,
  MARSHMALLOW,
  OBS_MSG,
  rollHeat,
  rollStar,
  StarSpotMessage,
  STAT_KEYS,
  type AstronomerSay,
  type MarshmallowEvent,
  type SkyContext,
  type MarshmallowTimings,
  type ShootingStar,
  type SkyEvent,
  type SkyTimings,
} from "@hyvento/shared";

export interface ObsPlayer {
  userId: string;
  name: string;
  area: string;
  x: number;
  y: number;
  seated: boolean;
}

export interface ObservatorioDeps {
  now(): number;
  /** Entero al azar en [0, n) (crypto.randomInt en la sala; fijo en los tests). */
  random(n: number): number;
  marshmallowTimings(): MarshmallowTimings;
  skyTimings(): SkyTimings;
  isNight(): boolean;
  /** La hora del juego y el clima de afuera (lo que la astrónoma mira para hablar del cielo). */
  sky(): SkyContext;
  player(sessionId: string): ObsPlayer | undefined;
  map(area: string): OfficeMap;
  toSession(sessionId: string, type: string, message: unknown): void;
  toArea(area: string, type: string, message: unknown): void;
  later(ms: number, fn: () => void): { clear(): void };
  award(userId: string, amount: number): Promise<number>;
  bump(userId: string, key: string, by?: number): void;
  held: { get(userId: string): { item: string } | undefined; give(userId: string, item: string): void };
}

interface Roast {
  startedAt: number;
  heat: number;
  timer: { clear(): void };
}

interface LiveStar extends ShootingStar {
  /** userIds que ya dijeron "¡la vi!" (el primero se lleva el logro). */
  spotted: Set<string>;
  /** sessionIds que la estaban mirando cuando apareció (solo ellos pueden verla). */
  watchers: Set<string>;
}

export class Observatorio {
  private roasts = new Map<string, Roast>();
  private cooldownUntil = new Map<string, number>();
  /** Puntos de malvavisco ganados hoy por persona (día de Bogotá). */
  private pointsToday = new Map<string, { day: number; points: number }>();
  private watchers = new Set<string>();
  private star: LiveStar | null = null;
  private nextStarAt: number | null = null;
  private starSeq = 0;
  /** Hasta cuándo cada sesión espera para volver a preguntarle a la astrónoma. */
  private askUntil = new Map<string, number>();

  constructor(private readonly deps: ObservatorioDeps) {}

  // ---------- Fogata de malvaviscos ----------

  private nearFire(p: ObsPlayer) {
    return !p.seated && nearPointOfType(this.deps.map(p.area), "marshmallow_fire", p.x, p.y);
  }

  private fail(sessionId: string, reason: Extract<MarshmallowEvent, { kind: "error" }>["reason"]) {
    this.deps.toSession(sessionId, OBS_MSG.marshmallowEvent, { kind: "error", sessionId, reason } satisfies MarshmallowEvent);
  }

  /** "E" junto a la fogata: mete un malvavisco al fuego (con un calor sorteado). */
  start(sessionId: string) {
    const p = this.deps.player(sessionId);
    if (!p) return;
    if (!this.nearFire(p)) return this.fail(sessionId, "far");
    if (this.roasts.has(sessionId)) return this.fail(sessionId, "busy");
    const now = this.deps.now();
    if (now < (this.cooldownUntil.get(sessionId) ?? 0)) return this.fail(sessionId, "cooldown");
    const heat = rollHeat((n) => this.deps.random(n));
    const t = this.deps.marshmallowTimings();
    // Si nadie lo saca, se cae al fuego (se cuenta como quemado).
    const timer = this.deps.later((t.dropAtMs * 100) / heat, () => void this.finish(sessionId, true));
    this.roasts.set(sessionId, { startedAt: now, heat, timer });
    this.deps.toArea(p.area, OBS_MSG.marshmallowEvent, { kind: "started", sessionId, heat } satisfies MarshmallowEvent);
  }

  /** "E" otra vez: lo saca. El tiempo lo mide el servidor (lo que dice el cliente no cuenta). */
  pull(sessionId: string) {
    if (!this.roasts.has(sessionId)) return;
    void this.finish(sessionId, false);
  }

  private async finish(sessionId: string, dropped: boolean) {
    const roast = this.roasts.get(sessionId);
    if (!roast) return;
    this.roasts.delete(sessionId);
    roast.timer.clear();
    const now = this.deps.now();
    this.cooldownUntil.set(sessionId, now + this.deps.marshmallowTimings().cooldownMs);
    const p = this.deps.player(sessionId);
    if (!p) return;
    // Si se alejó del fuego con el palito, se le cae (quemado).
    const d = dropped || !this.nearFire(p) ? "quemado" : doneness(now - roast.startedAt, roast.heat, this.deps.marshmallowTimings());
    const want = MARSHMALLOW.points[d];
    const day = bogotaDay(now);
    const today = this.pointsToday.get(p.userId);
    const used = today?.day === day ? today.points : 0;
    const amount = Math.max(0, Math.min(want, MARSHMALLOW.dailyPoints - used));
    this.pointsToday.set(p.userId, { day, points: used + amount });
    this.deps.bump(p.userId, STAT_KEYS.marshmallows);
    if (d === "dorado") this.deps.bump(p.userId, STAT_KEYS.goldenMarshmallows);
    if (d === "quemado") this.deps.bump(p.userId, STAT_KEYS.burntMarshmallows);
    // El bueno queda en la mano, si la tiene libre (no se pisa algo pagado de la cafetería o el bar).
    const hand = this.deps.held.get(p.userId);
    const kept = (d === "dorado" || d === "tostado") && (!hand || isFreeHold(hand.item));
    if (kept) this.deps.held.give(p.userId, "malvavisco");
    const points = amount > 0 ? await this.deps.award(p.userId, amount) : 0;
    this.deps.toArea(p.area, OBS_MSG.marshmallowEvent, { kind: "result", sessionId, doneness: d, points, kept } satisfies MarshmallowEvent);
  }

  /** Para los tests: los puntos de malvavisco que lleva hoy alguien. */
  pointsOf(userId: string): number {
    return this.pointsToday.get(userId)?.points ?? 0;
  }

  // ---------- Telescopio ----------

  private nearTelescope(p: ObsPlayer) {
    return nearPointOfType(this.deps.map(p.area), "telescope", p.x, p.y);
  }

  private sky(sessionId: string, e: SkyEvent) {
    this.deps.toSession(sessionId, OBS_MSG.sky, e);
  }

  /** "E" en el telescopio: de noche queda mirando (y le llegan las estrellas); de día, "vuelve de noche". */
  look(sessionId: string) {
    const p = this.deps.player(sessionId);
    if (!p || !this.nearTelescope(p)) return;
    const night = this.deps.isNight();
    if (!night) {
      this.watchers.delete(sessionId);
      return this.sky(sessionId, { kind: "sky", night: false, star: null });
    }
    if (!this.watchers.has(sessionId)) this.deps.bump(p.userId, STAT_KEYS.stargazing);
    this.watchers.add(sessionId);
    const live = this.star && this.deps.now() < this.star.at + this.star.flightMs ? this.star : null;
    this.sky(sessionId, { kind: "sky", night: true, star: live && this.publicStar(live) });
  }

  close(sessionId: string) {
    this.watchers.delete(sessionId);
  }

  private publicStar(s: LiveStar): ShootingStar {
    const { spotted: _s, watchers: _w, ...star } = s;
    return star;
  }

  /** Cada tanto: de noche sortea cuándo pasa la próxima estrella y la lanza; saca a quien dejó de mirar. */
  tick() {
    const now = this.deps.now();
    for (const id of this.watchers) {
      const p = this.deps.player(id);
      if (!p || !this.nearTelescope(p)) this.watchers.delete(id);
    }
    const t = this.deps.skyTimings();
    if (!this.deps.isNight()) {
      this.nextStarAt = null;
      if (this.star && now > this.star.at + this.star.flightMs + t.starGraceMs) this.star = null;
      if (this.watchers.size) for (const id of this.watchers) this.sky(id, { kind: "sky", night: false, star: null });
      this.watchers.clear();
      return;
    }
    this.nextStarAt ??= now + this.gap(t);
    if (now < this.nextStarAt) return;
    this.nextStarAt = now + this.gap(t);
    const star = rollStar(`e${++this.starSeq}`, now, (n) => this.deps.random(n), t.starFlightMs);
    this.star = { ...star, spotted: new Set(), watchers: new Set(this.watchers) };
    for (const id of this.watchers) this.sky(id, { kind: "star", star });
  }

  private gap(t: SkyTimings) {
    return t.starMinGapMs + this.deps.random(Math.max(1, t.starMaxGapMs - t.starMinGapMs + 1));
  }

  /** "¡La vi!": vale si la estaba mirando cuando pasó y todavía no se fue del todo. El primero gana el logro. */
  spot(sessionId: string, raw: unknown) {
    const parsed = StarSpotMessage.safeParse(raw);
    const p = this.deps.player(sessionId);
    if (!parsed.success || !p) return;
    const s = this.star;
    const now = this.deps.now();
    const t = this.deps.skyTimings();
    const inTime = s && s.id === parsed.data.starId && now >= s.at && now <= s.at + s.flightMs + t.starGraceMs;
    if (!s || !inTime || !s.watchers.has(sessionId) || !this.watchers.has(sessionId)) return this.sky(sessionId, { kind: "missed", starId: parsed.data.starId });
    if (s.spotted.has(p.userId)) return;
    const first = s.spotted.size === 0;
    s.spotted.add(p.userId);
    this.deps.bump(p.userId, STAT_KEYS.shootingStars);
    if (first) this.deps.bump(p.userId, STAT_KEYS.shootingStarsFirst);
    for (const id of s.watchers)
      if (this.watchers.has(id)) this.sky(id, { kind: "spotted", starId: s.id, name: p.name, first, mine: id === sessionId });
  }

  // ---------- La astrónoma ----------

  /** E junto a la astrónoma: contesta algo del cielo de ahora (lo oyen todos los del nivel). */
  ask(sessionId: string) {
    const p = this.deps.player(sessionId);
    if (!p || !nearPointOfType(this.deps.map(p.area), "astronomer", p.x, p.y)) return;
    const now = this.deps.now();
    if (now < (this.askUntil.get(sessionId) ?? 0)) return;
    this.askUntil.set(sessionId, now + ASTRONOMA.cooldownMs);
    const text = astronomerLine(this.deps.sky(), this.deps.random(1_000_000));
    this.deps.toArea(p.area, OBS_MSG.astronomerSay, { sessionId, text } satisfies AstronomerSay);
  }

  /** Se fue de la sala o cambió de nivel: se le apaga el fuego y deja de mirar. */
  forget(sessionId: string) {
    this.roasts.get(sessionId)?.timer.clear();
    this.roasts.delete(sessionId);
    this.watchers.delete(sessionId);
    this.cooldownUntil.delete(sessionId);
    this.askUntil.delete(sessionId);
  }

}
