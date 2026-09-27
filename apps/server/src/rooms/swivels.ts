// Sillas giratorias (ver swivel.ts en @hyvento/shared): solo sentado en la silla de escritorio que mira
// al PC, con una pausa hasta que termina el giro. Muchas vueltas seguidas marean (eso lo aplica la sala
// con `Drunkenness.dizzy`).
import { isSwivelSeat, spinMs, SWIVEL } from "@hyvento/shared";

export interface SwivelTimings {
  /** Lo que dura un giro de tantas vueltas. */
  spinMs: (turns: number) => number;
  restMs: number;
  dizzyAfter: number;
  dizzyWindowMs: number;
}

export const DEFAULT_SWIVEL_TIMINGS: SwivelTimings = {
  spinMs,
  restMs: SWIVEL.restMs,
  dizzyAfter: SWIVEL.dizzyAfter,
  dizzyWindowMs: SWIVEL.dizzyWindowMs,
};

export type SwivelResult = { ok: true; turns: number; dizzy: boolean } | { ok: false; error: "seat" | "busy" };

export class Swivels {
  /** Cuándo puede volver a girar cada persona. */
  private nextAt = new Map<string, number>();
  /** Cuándo giró las últimas veces (para el mareo). */
  private recent = new Map<string, number[]>();

  constructor(
    /** Vueltas del giro (el servidor elige; los tests las fijan). */
    private readonly turns: () => number,
    private readonly timings: () => SwivelTimings = () => DEFAULT_SWIVEL_TIMINGS,
  ) {}

  /** Girar: hace falta estar sentado en una silla que gira y que haya terminado el giro anterior. */
  spin(userId: string, seat: { type: string; computer: boolean } | null | undefined, now: number): SwivelResult {
    if (!seat || !isSwivelSeat(seat)) return { ok: false, error: "seat" };
    if (now < (this.nextAt.get(userId) ?? 0)) return { ok: false, error: "busy" };
    const t = this.timings();
    const turns = Math.min(SWIVEL.maxTurns, Math.max(SWIVEL.minTurns, Math.round(this.turns())));
    this.nextAt.set(userId, now + t.spinMs(turns) + t.restMs);
    const recent = (this.recent.get(userId) ?? []).filter((at) => now - at < t.dizzyWindowMs);
    recent.push(now);
    const dizzy = recent.length >= t.dizzyAfter;
    // Al marearse se empieza a contar de nuevo: otra tanda de vueltas marea otro poco.
    this.recent.set(userId, dizzy ? [] : recent);
    return { ok: true, turns, dizzy };
  }

  forget(userId: string) {
    this.nextAt.delete(userId);
    this.recent.delete(userId);
  }
}
