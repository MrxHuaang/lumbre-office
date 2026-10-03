// Límite de mensajes por cliente en el servidor de juego (balde de fichas). Un cliente honesto manda la
// posición a MOVE_SEND_HZ (15/s), el mazo del hockey cada ~30 ms y algún que otro clic: el balde deja eso
// con aire y descarta solo el exceso de quien inunda la sala, sin sacarlo (un pico de red no lo castiga).
import { MOVE_SEND_HZ } from "./protocol";

export const MSG_RATE = {
  /** Fichas que se recuperan por segundo: el ritmo sostenido que se acepta. */
  perSecond: 60,
  /** Tamaño del balde: la ráfaga que se acepta de una vez (p. ej., lo que se juntó tras un tirón de red). */
  burst: 120,
  /** Cada cuánto, como mucho, se anota en el log que un cliente se pasó (para no llenar el log). */
  logEveryMs: 60_000,
} as const;

// Lo honesto tiene que caber con holgura (el movimiento más el hockey a ~33/s).
if (MSG_RATE.perSecond < MOVE_SEND_HZ * 3) throw new Error("MSG_RATE.perSecond no deja pasar el movimiento");

export interface RateConfig {
  perSecond: number;
  burst: number;
}

export interface TokenBucket {
  tokens: number;
  at: number;
}

/** Balde lleno (al entrar). */
export function newBucket(now: number, cfg: RateConfig = MSG_RATE): TokenBucket {
  return { tokens: cfg.burst, at: now };
}

/** Recarga lo que corresponde desde la última vez y gasta una ficha si hay. Devuelve si el mensaje pasa. */
export function takeToken(b: TokenBucket, now: number, cfg: RateConfig = MSG_RATE): boolean {
  const elapsed = Math.max(0, now - b.at);
  b.tokens = Math.min(cfg.burst, b.tokens + (elapsed * cfg.perSecond) / 1000);
  b.at = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}
