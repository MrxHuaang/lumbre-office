// La máquina de peluches del arcade (ver garra.ts de @hyvento/shared). Al empezar se cobra el intento
// (`spendPoints`, PURCHASE), se sortea la vitrina (una semilla) y se anota la hora; al soltar, el servidor
// revisa que haya pasado lo que tarda la garra en bajar (y que no se venció el intento) y decide con su azar
// si agarra, según qué tan centrada cayó. El peluche va a la mochila. Este módulo no conoce Colyseus.
import {
  clawGrip,
  clawLayout,
  ClawDropMessage,
  GARRA,
  objItemId,
  STAT_KEYS,
  type ClawEvent,
} from "@hyvento/shared";
import type { GameRepository } from "../repo/types";

export interface ClawDeps {
  repo: () => Pick<GameRepository, "spendPoints">;
  now: () => number;
  /** Entero al azar en [0, n) (crypto.randomInt en la sala; fijo en los tests). */
  random: (n: number) => number;
  token: () => string;
  setPoints: (userId: string, balance: number) => void;
  bag: {
    fits(userId: string, items: readonly (readonly [string, number])[]): "ok" | "full" | "stack";
    add(userId: string, itemId: string, quantity: number): Promise<"ok" | "full" | "stack">;
  };
  bump: (userId: string, key: string) => void;
}

interface Attempt {
  token: string;
  seed: number;
  layout: string[];
  startedAt: number;
}

export class ClawMachines {
  private attempts = new Map<string, Attempt>();
  private nextAt = new Map<string, number>();
  /** Cobros en curso (dos "empezar" seguidos no cobran dos veces). */
  private paying = new Set<string>();

  constructor(private readonly d: ClawDeps) {}

  /** Empezar un intento junto a la máquina: se cobra y se arma la vitrina. */
  async start(userId: string, near: boolean): Promise<ClawEvent> {
    if (!near) return { kind: "error", error: "far" };
    const now = this.d.now();
    if (this.paying.has(userId) || now < (this.nextAt.get(userId) ?? 0)) return { kind: "error", error: "busy" };
    const seed = this.d.random(2 ** 31);
    const layout = clawLayout(seed);
    // Lo que se puede sacar tiene que caber (cualquiera de los de la vitrina).
    if (layout.some((id) => this.d.bag.fits(userId, [[objItemId(id), 1]]) !== "ok")) return { kind: "error", error: "full" };
    this.paying.add(userId);
    let paid: { ok: boolean; balance: number };
    try {
      paid = await this.d.repo().spendPoints({ userId, amount: GARRA.price, reason: "PURCHASE", refId: "garra" });
    } catch (err) {
      console.error("garra spendPoints", err);
      return { kind: "error", error: "failed" };
    } finally {
      this.paying.delete(userId);
    }
    this.d.setPoints(userId, paid.balance);
    if (!paid.ok) return { kind: "error", error: "funds" };
    const attempt: Attempt = { token: this.d.token(), seed, layout, startedAt: this.d.now() };
    this.attempts.set(userId, attempt);
    this.d.bump(userId, STAT_KEYS.clawPlays);
    return { kind: "started", token: attempt.token, seed, balance: paid.balance };
  }

  /** Soltar la garra: el servidor decide si agarra. El intento se cierra pase lo que pase. */
  async drop(userId: string, raw: unknown): Promise<ClawEvent | null> {
    const parsed = ClawDropMessage.safeParse(raw);
    if (!parsed.success) return null;
    const a = this.attempts.get(userId);
    if (!a || a.token !== parsed.data.token) return { kind: "error", error: "expired" };
    this.attempts.delete(userId);
    const now = this.d.now();
    this.nextAt.set(userId, now + GARRA.cooldownMs);
    const elapsed = now - a.startedAt;
    // Soltar antes de lo que tarda en bajar no vale; después del tiempo, bajó sola (se acepta con margen).
    if (elapsed < GARRA.minMs || elapsed > GARRA.maxMs + 2_000) return { kind: "error", error: "expired" };
    const x = parsed.data.x;
    const grip = clawGrip(a.layout, x);
    const won = this.d.random(1000) < grip.perMil;
    if (won) {
      const added = await this.d.bag.add(userId, objItemId(grip.plush), 1);
      if (added !== "ok") return { kind: "error", error: "full" };
      this.d.bump(userId, STAT_KEYS.clawWins);
    }
    return { kind: "result", token: a.token, slot: grip.slot, plush: grip.plush, won, x };
  }

  /** Se fue: se olvida su intento. */
  forget(userId: string) {
    this.attempts.delete(userId);
    this.nextAt.delete(userId);
  }

  /** Para los tests: el intento abierto de alguien. */
  attemptOf(userId: string) {
    return this.attempts.get(userId);
  }
}
