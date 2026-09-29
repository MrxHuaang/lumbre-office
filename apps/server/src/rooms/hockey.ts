// Hockey de mesa del arcade: un partido a la vez, entre dos personas (una en cada punta de la mesa) o
// contra la máquina. El servidor es la cancha: cobra la entrada, corre la física con el reloj de la sala
// (pasos fijos: el mismo partido da siempre lo mismo), recibe a dónde quiere ir cada mazo (limitado a su
// mitad y a su velocidad), cuenta los goles y reparte cuadros a los del sótano. Quien se va o deja de
// jugar pierde; el ganador se lleva el pozo.
import { INTERACT_REACH_TILES, pointsOfType, type OfficeMap } from "@hyvento/map";
import {
  aimMallet,
  ARCADE_PRICE,
  botAim,
  HOCKEY,
  HockeyJoinMessage,
  HockeyMoveMessage,
  hockeyRefId,
  hockeyRound,
  newHockeyWorld,
  serveSpot,
  stepHockey,
  type HockeyFrame,
  type HockeyPhase,
  type HockeyResult,
  type HockeySettled,
  type HockeySide,
  type HockeyWorld,
} from "@hyvento/shared";
import type { GameRepository } from "../repo/types";
import { orElse } from "../log";
import type { HockeyState } from "../state";

export interface Timer {
  clear(): void;
}

export interface HockeyWho {
  userId: string;
  name: string;
  area: string;
  x: number;
  y: number;
}

export interface HockeyDeps {
  state: HockeyState;
  repo: () => GameRepository;
  /** El sótano (donde está la mesa). */
  map: () => OfficeMap;
  /** Reloj de la sala: algo cada `ms` y algo una vez dentro de `ms` (se cancelan solos al cerrar la sala). */
  every: (ms: number, fn: () => void) => Timer;
  later: (ms: number, fn: () => void) => Timer;
  now: () => number;
  /** Dónde está ahora esa persona (null = ya no está en la sala). */
  where: (userId: string) => { area: string; x: number; y: number } | null;
  setPoints: (userId: string, balance: number) => void;
  /** Un cuadro del partido para los del sótano. */
  frame: (frame: HockeyFrame) => void;
  /** Cómo le fue a esa persona al terminar. */
  settled: (userId: string, s: HockeySettled) => void;
  /** Premio de ocio por ganarle a la máquina (con el tope del día); devuelve lo sumado. */
  bonus: (userId: string, amount: number) => Promise<number>;
}

const STEPS_PER_TICK = Math.round(HOCKEY.tickMs / HOCKEY.stepMs);
const BOT_EVERY = Math.max(1, Math.round(HOCKEY.botReactMs / HOCKEY.stepMs));
/** Margen al revisar si sigue en su punta (moverse un poco en el lugar no es irse). */
const STAY_SLACK = 1.6;

export class HockeyTable {
  private world: HockeyWorld | null = null;
  private ticker: Timer | null = null;
  /** Lo que termina la fase (espera, cuenta regresiva, pausa del gol, fin) y el partido (maxMs). */
  private phaseTimer: Timer | null = null;
  private matchTimer: Timer | null = null;
  /** Cuándo movió su mazo cada lado por última vez. */
  private lastMove: [number, number] = [0, 0];
  /** Lados que se están cobrando (para que dos no paguen el mismo lugar). */
  private charging = new Set<HockeySide>();
  private events: ("hit" | "wall" | "goal")[] = [];
  private steps = 0;

  constructor(private readonly d: HockeyDeps) {}

  get phase(): HockeyPhase {
    return this.d.state.phase as HockeyPhase;
  }

  /** Punta de la mesa donde está parado (0 = norte, 1 = sur), o null si no está en ninguna. */
  sideAt(map: OfficeMap, x: number, y: number, slack = 1): HockeySide | null {
    const reach = INTERACT_REACH_TILES * map.tileSize * slack;
    const ends = pointsOfType(map, "air_hockey");
    let best: { side: HockeySide; d: number } | null = null;
    ends.slice(0, 2).forEach((p, i) => {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= reach && (!best || d < best.d)) best = { side: i as HockeySide, d };
    });
    return (best as { side: HockeySide } | null)?.side ?? null;
  }

  /** Lado donde juega esa persona en el partido de ahora (o null). */
  sideOf(userId: string): HockeySide | null {
    const s = this.d.state.sides;
    if (s[0]!.userId === userId && !s[0]!.bot) return 0;
    if (s[1]!.userId === userId && !s[1]!.bot) return 1;
    return null;
  }

  /**
   * Sumarse en la punta donde está parado: cobra la entrada. Si la mesa estaba libre queda esperando
   * rival (o arranca contra la máquina si `bot`); si alguien esperaba en la otra punta, empieza el
   * partido. Quien ya espera puede pedir la máquina sin volver a pagar.
   */
  async join(who: HockeyWho, raw: unknown): Promise<HockeyResult | null> {
    const parsed = HockeyJoinMessage.safeParse(raw);
    if (!parsed.success) return null;
    const s = this.d.state;
    const map = this.d.map();
    const side = who.area === map.id ? this.sideAt(map, who.x, who.y) : null;
    if (side === null) return { ok: false, error: "far" };
    const bot = parsed.data.bot === true;
    const mine = this.sideOf(who.userId);
    if (mine !== null) {
      // Ya estaba esperando: pedir la máquina la pone del otro lado.
      if (this.phase === "waiting" && bot) this.seatBot(mine === 0 ? 1 : 0);
      return { ok: true, balance: await this.d.repo().getPoints(who.userId).catch(orElse("hockey.getPoints", 0, { userId: who.userId })) };
    }
    if (!this.canTake(side)) return { ok: false, error: "busy" };

    const match = this.phase === "idle" ? s.match + 1 : s.match;
    const fee = ARCADE_PRICE.hockey;
    this.charging.add(side);
    let paid: Awaited<ReturnType<GameRepository["casinoBet"]>>;
    try {
      paid = await this.d.repo().casinoBet({ userId: who.userId, amount: fee, refId: hockeyRefId(match) });
    } catch (err) {
      console.error("hockey casinoBet", err);
      return { ok: false, error: "failed" };
    } finally {
      this.charging.delete(side);
    }
    this.d.setPoints(who.userId, paid.balance);
    if (!paid.ok) return { ok: false, error: "funds" };
    // Mientras se cobraba la mesa pudo cambiar (otro partido, se fue quien esperaba): se devuelve.
    const stillIdle = this.phase === "idle" && s.match + 1 === match;
    const stillWaiting = this.phase === "waiting" && s.match === match;
    if ((!stillIdle && !stillWaiting) || !this.free(side)) {
      await this.refund(who.userId, match);
      return { ok: false, error: "closed" };
    }
    const p = s.sides[side]!;
    p.userId = who.userId;
    p.name = who.name;
    p.score = 0;
    p.bot = false;
    if (stillIdle) {
      s.match = match;
      s.winner = -1;
      s.forfeit = false;
      const other = s.sides[side === 0 ? 1 : 0]!;
      other.userId = "";
      other.name = "";
      other.score = 0;
      other.bot = false;
      if (bot) {
        this.seatBot(side === 0 ? 1 : 0);
      } else {
        this.setPhase("waiting", HOCKEY.waitMs, () => void this.cancelWaiting());
      }
    } else {
      this.countdown();
    }
    return { ok: true, balance: paid.balance };
  }

  /** ¿Se puede ocupar esa punta ahora? (mesa libre, o alguien esperando en la otra). */
  private canTake(side: HockeySide): boolean {
    if (this.phase === "idle") return !this.charging.size;
    if (this.phase === "waiting") return this.free(side) && !this.charging.has(side);
    return false;
  }

  private free(side: HockeySide) {
    const p = this.d.state.sides[side]!;
    return !p.userId && !p.bot;
  }

  private seatBot(side: HockeySide) {
    const p = this.d.state.sides[side]!;
    p.userId = "";
    p.name = "La máquina";
    p.score = 0;
    p.bot = true;
    this.countdown();
  }

  /** Mover el mazo: a dónde quiere ir (el servidor lo limita a su mitad y lo lleva a su velocidad). */
  move(userId: string, raw: unknown) {
    const side = this.sideOf(userId);
    const parsed = HockeyMoveMessage.safeParse(raw);
    if (side === null || !parsed.success || !this.world) return;
    aimMallet(this.world, side, parsed.data.x, parsed.data.y);
    this.lastMove[side] = this.d.now();
  }

  /** Dejó la mesa (Esc, se alejó, se fue de la sala): esperando, se le devuelve; jugando, pierde. */
  leave(userId: string) {
    const side = this.sideOf(userId);
    if (side === null) return;
    if (this.phase === "waiting") void this.cancelWaiting();
    else if (this.phase === "countdown" || this.phase === "playing" || this.phase === "goal") void this.finish(side === 0 ? 1 : 0, true);
  }

  // ---------- Fases ----------

  private setPhase(phase: HockeyPhase, ms: number, then: () => void) {
    this.phaseTimer?.clear();
    this.d.state.phase = phase;
    this.d.state.endsAt = this.d.now() + ms;
    this.phaseTimer = this.d.later(ms, then);
  }

  private countdown() {
    const s = this.d.state;
    this.world = newHockeyWorld((s.match % 2) as HockeySide);
    this.steps = 0;
    this.events = [];
    const now = this.d.now();
    this.lastMove = [now, now];
    this.ticker?.clear();
    this.ticker = this.d.every(HOCKEY.tickMs, () => this.tick());
    this.setPhase("countdown", HOCKEY.countdownMs, () => this.play());
  }

  private play() {
    const now = this.d.now();
    this.lastMove = [now, now];
    this.d.state.phase = "playing";
    this.d.state.endsAt = now + HOCKEY.maxMs;
    this.phaseTimer = null;
    this.matchTimer?.clear();
    this.matchTimer = this.d.later(HOCKEY.maxMs, () => this.timeUp());
  }

  private timeUp() {
    if (this.phase !== "playing" && this.phase !== "goal") return;
    const [a, b] = this.d.state.sides.map((p) => p.score) as [number, number];
    void this.finish(a > b ? 0 : b > a ? 1 : -1, false);
  }

  /** Nadie vino: se devuelve la moneda y la mesa queda libre. */
  private async cancelWaiting() {
    if (this.phase !== "waiting") return;
    const s = this.d.state;
    const match = s.match;
    // El id se copia antes de vaciar la mesa (los lados son los mismos objetos del estado).
    const userId = s.sides.find((p) => p.userId !== "" && !p.bot)?.userId;
    this.reset();
    if (!userId) return;
    const back = await this.refund(userId, match);
    this.d.settled(userId, { match, outcome: "refund", won: back, bonus: 0, forfeit: false });
  }

  /** Un paso del reloj de la sala: la física, la máquina, quién sigue en su punta y el cuadro. */
  private tick() {
    const w = this.world;
    if (!w) return;
    const s = this.d.state;
    const speeds: [number, number] = [s.sides[0]!.bot ? HOCKEY.botSpeed : HOCKEY.malletSpeed, s.sides[1]!.bot ? HOCKEY.botSpeed : HOCKEY.malletSpeed];
    for (let i = 0; i < STEPS_PER_TICK; i++) {
      if (this.steps++ % BOT_EVERY === 0)
        for (const side of [0, 1] as const) {
          if (!s.sides[side]!.bot) continue;
          const t = botAim(w, side);
          aimMallet(w, side, t.x, t.y);
        }
      for (const e of stepHockey(w, this.phase === "playing", speeds)) {
        if (typeof e === "object") {
          this.goal(e.goal);
          break;
        }
        if (!this.events.includes(e)) this.events.push(e);
      }
      if (!this.world) break;
    }
    if (!this.world) return;
    this.d.frame(this.snapshot());
    this.events = [];
    this.checkPlayers();
  }

  /** Quien se alejó de su punta o no movió el mazo en `idleMs` pierde por abandono. */
  private checkPlayers() {
    const now = this.d.now();
    const map = this.d.map();
    for (const side of [0, 1] as const) {
      const p = this.d.state.sides[side]!;
      if (p.bot || !p.userId) continue;
      const at = this.d.where(p.userId);
      const away = !at || at.area !== map.id || this.sideAt(map, at.x, at.y, STAY_SLACK) !== side;
      const idle = this.phase === "playing" && now - this.lastMove[side] > HOCKEY.idleMs;
      if (away || idle) {
        void this.finish(side === 0 ? 1 : 0, true);
        return;
      }
    }
  }

  private goal(scorer: HockeySide) {
    const s = this.d.state;
    const p = s.sides[scorer]!;
    p.score += 1;
    this.events.push("goal");
    if (p.score >= HOCKEY.toWin) {
      void this.finish(scorer, false);
      return;
    }
    // Saca quien recibió el gol, desde su mitad.
    const serve = serveSpot(scorer === 0 ? 1 : 0);
    this.world!.puck = { x: serve.x, y: serve.y, vx: 0, vy: 0 };
    const back = s.endsAt;
    this.setPhase("goal", HOCKEY.goalPauseMs, () => {
      this.phaseTimer = null;
      if (this.phase !== "goal") return;
      s.phase = "playing";
      s.endsAt = back;
      this.lastMove = [this.d.now(), this.d.now()];
    });
  }

  /**
   * Fin del partido: gana `winner` (-1 = empate). Paga el pozo (o devuelve la moneda contra la máquina,
   * más el premio de ocio) y le avisa a cada jugador. La mesa queda mostrando el resultado un rato.
   */
  private async finish(winner: HockeySide | -1, forfeit: boolean) {
    if (this.phase === "idle" || this.phase === "waiting" || this.phase === "over") return;
    const s = this.d.state;
    this.ticker?.clear();
    this.ticker = null;
    this.matchTimer?.clear();
    this.matchTimer = null;
    if (this.world) {
      this.d.frame(this.snapshot());
      this.events = [];
    }
    this.world = null;
    s.winner = winner;
    s.forfeit = forfeit;
    this.setPhase("over", HOCKEY.overMs, () => this.reset());
    const match = s.match;
    const fee = ARCADE_PRICE.hockey;
    const players = s.sides.map((p, i) => ({ side: i as HockeySide, userId: p.userId, bot: p.bot }));
    const vsBot = players.some((p) => p.bot);
    for (const p of players) {
      if (p.bot || !p.userId) continue;
      let outcome: HockeySettled["outcome"];
      let won = 0;
      let bonus = 0;
      if (winner === -1) {
        outcome = "tie";
        won = await this.refund(p.userId, match);
      } else if (winner === p.side) {
        outcome = "win";
        won = await this.pay(p.userId, vsBot ? fee : fee * 2, match);
        if (vsBot && won > 0) bonus = await this.d.bonus(p.userId, ARCADE_PRICE.hockeyBotBonus).catch(orElse("hockey.bonus", 0, { userId: p.userId, match }));
      } else {
        outcome = "lose";
      }
      this.d.settled(p.userId, { match, outcome, won, bonus, forfeit: forfeit && outcome !== "tie" });
    }
  }

  private reset() {
    this.phaseTimer?.clear();
    this.phaseTimer = null;
    this.ticker?.clear();
    this.ticker = null;
    this.matchTimer?.clear();
    this.matchTimer = null;
    this.world = null;
    const s = this.d.state;
    s.phase = "idle";
    s.endsAt = 0;
    for (const p of s.sides) {
      p.userId = "";
      p.name = "";
      p.score = 0;
      p.bot = false;
    }
  }

  private refund(userId: string, match: number) {
    return this.pay(userId, ARCADE_PRICE.hockey, match);
  }

  /** Paga (o devuelve) por el libro del casino: sin tope. Devuelve lo pagado (0 si falló). */
  private async pay(userId: string, amount: number, match: number): Promise<number> {
    try {
      const { balance } = await this.d.repo().casinoPayout({ userId, amount, refId: hockeyRefId(match) });
      this.d.setPoints(userId, balance);
      return amount;
    } catch (err) {
      console.error("hockey casinoPayout", err);
      return 0;
    }
  }

  private snapshot(): HockeyFrame {
    const w = this.world!;
    const [a, b] = w.mallets;
    const frame: HockeyFrame = {
      t: this.d.now(),
      p: [hockeyRound(w.puck.x), hockeyRound(w.puck.y), hockeyRound(w.puck.vx), hockeyRound(w.puck.vy)],
      m: [hockeyRound(a.x), hockeyRound(a.y), hockeyRound(b.x), hockeyRound(b.y)],
    };
    if (this.events.length) frame.ev = [...this.events];
    return frame;
  }

  /** Para los tests: el mundo del partido de ahora (o null). */
  get debugWorld(): HockeyWorld | null {
    return this.world;
  }
}
