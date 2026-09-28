// Los tragamonedas del casino: cada tirada es de una persona (no hay rondas compartidas). Se cobra con
// `casinoBet` (bloquea la fila: solo hace falta el saldo), el servidor tira los tres rodillos con su azar y
// paga el premio con `casinoPayout` (motivo CASINO). Con el casino cerrado desde /admin no se juega.
import {
  casinoRefId,
  slotPayout,
  SLOTS,
  SlotSpinMessage,
  spinReels,
  type CasinoSettingsDTO,
  type SlotResult,
} from "@hyvento/shared";
import type { GameRepository } from "../../repo/types";
import { payoutWithRetry, TableQueue } from "./common";

export interface SlotDeps {
  repo: () => GameRepository;
  settings: () => CasinoSettingsDTO;
  /** Entero al azar en [0, n) (crypto.randomInt en la sala; fijo en los tests). */
  random: (n: number) => number;
  now: () => number;
  /** Refleja el saldo nuevo en el jugador (el contador del HUD). */
  setPoints: (userId: string, balance: number) => void;
  /** Cerró una tirada: lo apostado y lo devuelto (estadísticas del casino) y si fueron tres sietes. */
  settled: (userId: string, staked: number, won: number, jackpot: boolean) => void;
}

export class SlotMachines {
  /** Una tirada a la vez por persona (la sala no procesa los mensajes de a uno). */
  private readonly queues = new Map<string, TableQueue>();
  private nextAt = new Map<string, number>();
  private seq = 0;

  constructor(private readonly d: SlotDeps) {}

  spin(who: { userId: string }, raw: unknown, near: boolean): Promise<SlotResult | null> {
    let q = this.queues.get(who.userId);
    if (!q) {
      q = new TableQueue();
      this.queues.set(who.userId, q);
    }
    return q.run(() => this.play(who.userId, raw, near));
  }

  private async play(userId: string, raw: unknown, near: boolean): Promise<SlotResult | null> {
    const parsed = SlotSpinMessage.safeParse(raw);
    if (!parsed.success) return null;
    if (!this.d.settings().enabled) return { ok: false, error: "disabled" };
    if (!near) return { ok: false, error: "far" };
    const now = this.d.now();
    if (now < (this.nextAt.get(userId) ?? 0)) return { ok: false, error: "busy" };
    this.nextAt.set(userId, now + SLOTS.cooldownMs);
    const { bet } = parsed.data;
    const refId = casinoRefId("tragamonedas", ++this.seq);
    let outcome;
    try {
      outcome = await this.d.repo().casinoBet({ userId, amount: bet, refId });
    } catch (err) {
      console.error("casinoBet (tragamonedas)", err);
      return { ok: false, error: "failed" };
    }
    this.d.setPoints(userId, outcome.balance);
    if (!outcome.ok) return { ok: false, error: "funds" };
    const reels = spinReels((n) => this.d.random(n));
    const { won, line, symbol } = slotPayout(reels, bet);
    let balance = outcome.balance;
    if (won > 0) {
      const paid = await payoutWithRetry(this.d.repo, { userId, amount: won, refId }, "premio");
      if (paid) {
        balance = paid.balance;
        this.d.setPoints(userId, balance);
      }
    }
    this.d.settled(userId, bet, won, line === "three" && symbol === "siete");
    return { ok: true, reels, bet, won, line, balance };
  }

  /** Se fue de la sala: se olvida su cola y su pausa. */
  forget(userId: string) {
    this.queues.delete(userId);
    this.nextAt.delete(userId);
  }
}
