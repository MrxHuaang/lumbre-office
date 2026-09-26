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
import { randomInt } from "node:crypto";
import type { GameRepository } from "../../repo/types";
import { RouletteBet, type RouletteState } from "../../state";

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
  /** Le manda a alguien lo que ganó al cerrar la ronda. */
  notify: (userId: string, settled: RouletteSettled) => void;
  timings: () => RouletteTimings;
  /** De dónde sale el número (en los tests, fijo). */
  spin: () => number;
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
  constructor(private readonly d: Deps) {}

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
    this.d.later(this.d.timings().spinMs, () => void this.settle());
  }

  private async settle() {
    const s = this.d.state;
    const round = s.round;
    const result = s.result;
    s.phase = "result";
    s.history.unshift(result);
    while (s.history.length > CASINO.roulette.historySize) s.history.pop();
    s.endsAt = Date.now() + this.d.timings().resultMs;
    this.d.later(this.d.timings().resultMs, () => this.beginBetting());

    const byUser = new Map<string, { won: number; staked: number }>();
    for (const b of s.bets) {
      const t = byUser.get(b.userId) ?? { won: 0, staked: 0 };
      t.staked += b.amount;
      const spec = specOf(b);
      if (rouletteWins(spec, result)) t.won += b.amount * (roulettePayout(spec) + 1);
      byUser.set(b.userId, t);
    }
    for (const [userId, t] of byUser) {
      if (t.won > 0) {
        try {
          const { balance } = await this.d.repo().casinoPayout({ userId, amount: t.won, refId: casinoRefId("ruleta", round) });
          this.d.setPoints(userId, balance);
        } catch (err) {
          console.error("casinoPayout", err);
        }
      }
      this.d.notify(userId, { round, result, won: t.won, staked: t.staked });
    }
  }

  /**
   * Una apuesta. `near` = está junto a la mesa. Si la ronda se cierra mientras se cobraba, se devuelve.
   */
  async bet(player: { userId: string; name: string }, raw: unknown, near: boolean): Promise<CasinoResult | null> {
    const parsed = RouletteBetMessage.safeParse(raw);
    if (!parsed.success) return null;
    const s = this.d.state;
    const settings = this.d.settings();
    if (!settings.enabled) return { ok: false, error: "disabled" };
    if (!near) return { ok: false, error: "far" };
    if (s.phase !== "betting") return { ok: false, error: "closed" };
    const mine = s.bets.filter((b) => b.userId === player.userId).length;
    if (mine >= CASINO.roulette.maxBetsPerRound) return { ok: false, error: "max-bets" };

    const round = s.round;
    const { bet, amount } = parsed.data;
    const refId = casinoRefId("ruleta", round);
    let outcome;
    try {
      outcome = await this.d.repo().casinoBet({ userId: player.userId, amount, refId, limit: settings.dailyLossLimit });
    } catch (err) {
      console.error("casinoBet", err);
      return { ok: false, error: "failed" };
    }
    this.d.setPoints(player.userId, outcome.balance);
    if (!outcome.ok) return { ok: false, error: outcome.error };
    if (s.round !== round || s.phase !== "betting") {
      // Se cerró la ronda mientras se cobraba: se devuelve la apuesta.
      const { balance } = await this.d.repo().casinoPayout({ userId: player.userId, amount, refId });
      this.d.setPoints(player.userId, balance);
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
