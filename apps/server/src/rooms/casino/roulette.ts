// La mesa de ruleta del sótano: rondas compartidas (apostar → girar → pagar) que decide el servidor.
import {
  CASINO,
  casinoRefId,
  rouletteBetLabel,
  RouletteBetMessage,
  roulettePayout,
  rouletteWins,
  type CasinoResult,
  type CasinoSettingsDTO,
  type RouletteBetSpec,
  type RouletteSettled,
} from "@hyvento/shared";
import { ArraySchema } from "@colyseus/schema";
import { randomInt } from "node:crypto";
import type { GameRepository } from "../../repo/types";
import { RouletteBet, type RouletteState } from "../../state";
import { payoutWithRetry, TableQueue } from "./common";
import type { OpenRounds } from "./recovery";

export interface RouletteTimings {
  bettingMs: number;
  spinMs: number;
  resultMs: number;
}

interface Deps {
  state: RouletteState;
  repo: () => GameRepository;
  settings: () => CasinoSettingsDTO;
  /** Programa algo en el reloj de la sala (se cancela sola al cerrar la sala). */
  later: (ms: number, fn: () => void) => void;
  /** Refleja el saldo nuevo de alguien en su jugador (HUD). */
  setPoints: (userId: string, balance: number) => void;
  /** Le manda a alguien lo que ganó al cerrar la ronda (`straight` = acertó un pleno). */
  notify: (userId: string, settled: RouletteSettled, extra: { straight: boolean }) => void;
  timings: () => RouletteTimings;
  /** De dónde sale el número (en los tests, fijo). */
  spin: () => number;
  /** Rondas abiertas (para devolver lo apostado si la sala se cierra antes de pagar). */
  rounds?: OpenRounds;
}

/** Número al azar de la ruleta, con el generador criptográfico (no se puede adivinar). */
export const randomSpin = () => randomInt(0, 37);

/** Reconstruye la apuesta a partir de lo guardado en el estado. */
function specOf(b: RouletteBet): RouletteBetSpec {
  if (b.kind === "number") return { kind: "number", n: b.param };
  if (b.kind === "dozen") return { kind: "dozen", d: b.param as 1 | 2 | 3 };
  if (b.kind === "column") return { kind: "column", c: b.param as 1 | 2 | 3 };
  return { kind: b.kind as Exclude<RouletteBetSpec["kind"], "number" | "dozen" | "column"> };
}

function paramOf(spec: RouletteBetSpec): number {
  if (spec.kind === "number") return spec.n;
  if (spec.kind === "dozen") return spec.d;
  if (spec.kind === "column") return spec.c;
  return -1;
}

export class RouletteTable {
  /** Apuestas de a una: así el tope por ronda se cuenta con las anteriores ya puestas. */
  private readonly queue = new TableQueue();
  /** El pago de la ronda en curso (al cerrar la sala se espera a que termine). */
  private settling: Promise<void> = Promise.resolve();
  private closed = false;

  constructor(private readonly d: Deps) {
    d.rounds?.attach(this);
  }

  private ref(round: number) {
    return this.d.rounds?.ref("ruleta", round) ?? casinoRefId("ruleta", round);
  }

  /** La sala se cierra: no más apuestas; se esperan las que se estaban cobrando y el pago en curso. */
  async close() {
    this.closed = true;
    await this.queue.run(async () => undefined);
    await this.settling;
  }

  /** Arranca el ciclo de rondas. */
  start() {
    this.beginBetting();
  }

  private beginBetting() {
    const s = this.d.state;
    s.round += 1;
    s.phase = "betting";
    s.result = -1;
    s.bets.clear();
    s.endsAt = Date.now() + this.d.timings().bettingMs;
    this.d.later(this.d.timings().bettingMs, () => this.spin());
  }

  private spin() {
    const s = this.d.state;
    s.phase = "spinning";
    // Se decide al empezar a girar para que la rueda se anime hasta ese número; ya no se puede apostar.
    s.result = this.d.spin();
    s.endsAt = Date.now() + this.d.timings().spinMs;
    this.d.later(this.d.timings().spinMs, () => {
      this.settling = this.settle();
    });
  }

  private async settle() {
    const s = this.d.state;
    const round = s.round;
    const result = s.result;
    s.phase = "result";
    // Se reemplaza el arreglo entero: con @colyseus/schema 3, un unshift de un número igual al anterior
    // hace que la copia del cliente pierda entradas (el servidor tiene [7,7,7] y el cliente [7]).
    s.history = new ArraySchema<number>(...[result, ...s.history].slice(0, CASINO.roulette.historySize));
    s.endsAt = Date.now() + this.d.timings().resultMs;
    this.d.later(this.d.timings().resultMs, () => this.beginBetting());

    const byUser = new Map<string, { won: number; staked: number; straight: boolean }>();
    for (const b of s.bets) {
      const t = byUser.get(b.userId) ?? { won: 0, staked: 0, straight: false };
      t.staked += b.amount;
      const spec = specOf(b);
      if (rouletteWins(spec, result)) {
        t.won += b.amount * (roulettePayout(spec) + 1);
        if (spec.kind === "number") t.straight = true;
      }
      byUser.set(b.userId, t);
    }
    for (const [userId, t] of byUser) {
      if (t.won > 0) {
        const paid = await payoutWithRetry(this.d.repo, { userId, amount: t.won, refId: this.ref(round) }, "premio");
        if (paid) this.d.setPoints(userId, paid.balance);
      }
      this.d.notify(userId, { round, result, won: t.won, staked: t.staked }, { straight: t.straight });
    }
    this.d.rounds?.settled(this.ref(round));
  }

  /**
   * Una apuesta. `near` = está junto a la mesa. Si la ronda se cierra mientras se cobraba, se devuelve.
   */
  bet(player: { userId: string; name: string }, raw: unknown, near: boolean): Promise<CasinoResult | null> {
    return this.queue.run(() => this.placeBet(player, raw, near));
  }

  private async placeBet(player: { userId: string; name: string }, raw: unknown, near: boolean): Promise<CasinoResult | null> {
    const parsed = RouletteBetMessage.safeParse(raw);
    if (!parsed.success) return null;
    const s = this.d.state;
    const settings = this.d.settings();
    if (!settings.enabled) return { ok: false, error: "disabled" };
    if (!near) return { ok: false, error: "far" };
    if (s.phase !== "betting" || this.closed) return { ok: false, error: "closed" };
    const mine = s.bets.filter((b) => b.userId === player.userId).length;
    if (mine >= CASINO.roulette.maxBetsPerRound) return { ok: false, error: "max-bets" };

    const round = s.round;
    const { bet, amount } = parsed.data;
    const refId = this.ref(round);
    // La ronda queda anotada antes de cobrar: si el servidor se cae, la próxima corrida la devuelve.
    if (this.d.rounds && !(await this.d.rounds.opening(refId))) return { ok: false, error: this.closed ? "closed" : "failed" };
    let outcome;
    try {
      outcome = await this.d.repo().casinoBet({ userId: player.userId, amount, refId });
    } catch (err) {
      console.error("casinoBet", err);
      return { ok: false, error: "failed" };
    }
    this.d.setPoints(player.userId, outcome.balance);
    if (!outcome.ok) return { ok: false, error: outcome.error };
    if (s.round !== round || s.phase !== "betting" || this.closed) {
      // Se cerró la ronda (o la sala) mientras se cobraba: se devuelve la apuesta.
      const paid = await payoutWithRetry(this.d.repo, { userId: player.userId, amount, refId }, "devolución");
      if (paid) this.d.setPoints(player.userId, paid.balance);
      return { ok: false, error: "closed" };
    }
    const b = new RouletteBet();
    b.userId = player.userId;
    b.name = player.name;
    b.kind = bet.kind;
    b.param = paramOf(bet);
    b.amount = amount;
    s.bets.push(b);
    return { ok: true, balance: outcome.balance };
  }

  /** Texto de una apuesta guardada (para registros). */
  static label(b: RouletteBet) {
    return rouletteBetLabel(specOf(b));
  }
}
