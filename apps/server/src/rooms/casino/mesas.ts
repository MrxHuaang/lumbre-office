// Las mesas de rondas compartidas del casino (baccarat, dados y caballitos): cada
// una corre sola como la ruleta (apostar → jugar → pagar) y el servidor decide el resultado.
import {
  casinoRefId,
  drawMesa,
  MESA,
  MesaBetMessage,
  mesaPlayMs,
  mesaReturn,
  mesaSummary,
  validMesaBet,
  type CasinoResult,
  type CasinoSettingsDTO,
  type MesaId,
  type MesaSettled,
} from "@hyvento/shared";
import { ArraySchema } from "@colyseus/schema";
import type { GameRepository } from "../../repo/types";
import { MesaBet, type MesaState } from "../../state";
import { payoutWithRetry, TableQueue } from "./common";

export interface MesaTimings {
  bettingMs: number;
  resultMs: number;
  /** Cuánto dura el juego (repartir, sacudir, correr); en los tests, casi nada. */
  playMs: (table: MesaId, result: readonly number[]) => number;
}

export const DEFAULT_MESA_TIMINGS: MesaTimings = { bettingMs: MESA.bettingMs, resultMs: MESA.resultMs, playMs: mesaPlayMs };

interface Deps {
  id: MesaId;
  state: MesaState;
  repo: () => GameRepository;
  settings: () => CasinoSettingsDTO;
  later: (ms: number, fn: () => void) => void;
  setPoints: (userId: string, balance: number) => void;
  notify: (userId: string, settled: MesaSettled) => void;
  timings: () => MesaTimings;
  /** De dónde sale el resultado (en los tests, fijo). */
  draw: (table: MesaId) => number[];
}

export class MesaTable {
  private readonly queue = new TableQueue();

  constructor(private readonly d: Deps) {}

  start() {
    this.beginBetting();
  }

  private beginBetting() {
    const s = this.d.state;
    s.round += 1;
    s.phase = "betting";
    s.result.clear();
    s.bets.clear();
    const ms = this.d.timings().bettingMs;
    s.endsAt = Date.now() + ms;
    this.d.later(ms, () => this.play());
  }

  /** Se cierra la apuesta y se decide el resultado: el cliente lo anima hasta que termina. */
  private play() {
    const s = this.d.state;
    const result = this.d.draw(this.d.id);
    s.phase = "playing";
    s.result.push(...result);
    const ms = this.d.timings().playMs(this.d.id, result);
    s.endsAt = Date.now() + ms;
    this.d.later(ms, () => void this.settle());
  }

  private async settle() {
    const s = this.d.state;
    const round = s.round;
    const result = [...s.result];
    s.phase = "result";
    // Arreglo nuevo en vez de `unshift`: con `unshift`, Colyseus pierde en el cliente los valores
    // repetidos seguidos (dos "gana la banca" quedaban como uno).
    s.history = new ArraySchema<number>(...[mesaSummary(this.d.id, result), ...s.history].slice(0, MESA.historySize));
    s.endsAt = Date.now() + this.d.timings().resultMs;
    this.d.later(this.d.timings().resultMs, () => this.beginBetting());

    const byUser = new Map<string, { won: number; staked: number }>();
    for (const b of s.bets) {
      const t = byUser.get(b.userId) ?? { won: 0, staked: 0 };
      t.staked += b.amount;
      t.won += mesaReturn(this.d.id, b.bet, result, b.amount);
      byUser.set(b.userId, t);
    }
    for (const [userId, t] of byUser) {
      if (t.won > 0) {
        const paid = await payoutWithRetry(this.d.repo, { userId, amount: t.won, refId: casinoRefId(this.d.id, round) }, "premio");
        if (paid) this.d.setPoints(userId, paid.balance);
      }
      this.d.notify(userId, { table: this.d.id, round, result, won: t.won, staked: t.staked });
    }
  }

  /** Una apuesta ya validada como mensaje. `near` = está junto a la mesa. */
  bet(player: { userId: string; name: string }, msg: MesaBetMessage, near: boolean): Promise<CasinoResult> {
    return this.queue.run(() => this.placeBet(player, msg, near));
  }

  private async placeBet(player: { userId: string; name: string }, msg: MesaBetMessage, near: boolean): Promise<CasinoResult> {
    const s = this.d.state;
    if (!this.d.settings().enabled) return { ok: false, error: "disabled" };
    if (!near) return { ok: false, error: "far" };
    if (s.phase !== "betting") return { ok: false, error: "closed" };
    if (s.bets.filter((b) => b.userId === player.userId).length >= MESA.maxBetsPerRound) return { ok: false, error: "max-bets" };

    const round = s.round;
    const refId = casinoRefId(this.d.id, round);
    let outcome;
    try {
      outcome = await this.d.repo().casinoBet({ userId: player.userId, amount: msg.amount, refId });
    } catch (err) {
      console.error("casinoBet", err);
      return { ok: false, error: "failed" };
    }
    this.d.setPoints(player.userId, outcome.balance);
    if (!outcome.ok) return { ok: false, error: outcome.error };
    if (s.round !== round || s.phase !== "betting") {
      // Se cerró la ronda mientras se cobraba: se devuelve.
      const paid = await payoutWithRetry(this.d.repo, { userId: player.userId, amount: msg.amount, refId }, "devolución");
      if (paid) this.d.setPoints(player.userId, paid.balance);
      return { ok: false, error: "closed" };
    }
    const b = new MesaBet();
    b.userId = player.userId;
    b.name = player.name;
    b.bet = msg.bet;
    b.amount = msg.amount;
    s.bets.push(b);
    return { ok: true, balance: outcome.balance };
  }
}

/** Valida el mensaje de una apuesta (la mesa, la apuesta de esa mesa y el monto). */
export function parseMesaBet(raw: unknown): MesaBetMessage | null {
  const parsed = MesaBetMessage.safeParse(raw);
  if (!parsed.success || !validMesaBet(parsed.data.table, parsed.data.bet)) return null;
  return parsed.data;
}

/** Resultado al azar de una mesa, con el generador criptográfico. */
export const randomMesaDraw =
  (rand: (n: number) => number) =>
  (table: MesaId): number[] =>
    drawMesa(table, rand);
