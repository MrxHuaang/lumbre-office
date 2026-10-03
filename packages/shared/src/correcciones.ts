import type { MoveCorrection } from "./protocol";

/**
 * Correcciones de posición (VIR-105). El cliente numera cada `MoveMessage` con `seq` y el servidor, al
 * rechazar un paso, devuelve el `seq` de ese paso. Las correcciones que nacen de una acción del servidor
 * (portales, viaje rápido, bus, sentarse al despertar, nadar, bajar del escenario, sacar a alguien de un
 * mueble) no llevan `seq`: esas se aplican siempre.
 */

/** Duración del deslizamiento para saltos chicos, en ms (en vez de teletransportar). */
export const CORRECTION_LERP_MS = 80;
/** Saltos de menos de esto (en tiles) se deslizan; los más grandes se aplican de una. */
export const CORRECTION_LERP_MAX_TILES = 1;
/**
 * Si ya se ignoró una corrección vieja hace menos de esto, la siguiente se aplica igual: si el servidor
 * sigue rechazando pasos nuevos, ignorarlas todas dejaría al cliente para siempre en otro lado.
 */
export const CORRECTION_IGNORE_WINDOW_MS = 1000;

/**
 * La corrección es de un paso ya superado: después se mandaron otros, que el servidor valida desde donde
 * te dejó. Sin `seq` (acción del servidor o servidor viejo) nunca es vieja.
 */
export function correctionIsStale(c: Pick<MoveCorrection, "seq">, lastSentSeq: number): boolean {
  return typeof c.seq === "number" && c.seq < lastSentSeq;
}

/**
 * Cómo se aplica una corrección que sí vale: deslizando (rechazo de un paso con salto chico en el mismo
 * nivel) o de una. Las de acciones del servidor (sin `seq`) van siempre de una, como antes.
 */
export function correctionStyle(c: MoveCorrection, from: { x: number; y: number; area: string }, tileSize: number): "lerp" | "snap" {
  if (typeof c.seq !== "number") return "snap";
  if (c.area && c.area !== from.area) return "snap";
  if (c.seated) return "snap";
  const dist = Math.hypot(c.x - from.x, c.y - from.y);
  return dist > 0 && dist < tileSize * CORRECTION_LERP_MAX_TILES ? "lerp" : "snap";
}

/**
 * Decide si se ignora una corrección: solo las viejas, y nunca dos seguidas dentro de la ventana
 * (`CORRECTION_IGNORE_WINDOW_MS`), para que un cliente desfasado vuelva a coincidir con el servidor.
 */
export class CorrectionGate {
  private lastIgnoredAt = -Infinity;

  shouldIgnore(c: Pick<MoveCorrection, "seq">, lastSentSeq: number, now: number): boolean {
    if (!correctionIsStale(c, lastSentSeq)) return false;
    if (now - this.lastIgnoredAt < CORRECTION_IGNORE_WINDOW_MS) {
      this.lastIgnoredAt = -Infinity;
      return false;
    }
    this.lastIgnoredAt = now;
    return true;
  }

  reset() {
    this.lastIgnoredAt = -Infinity;
  }
}

/** Punto del deslizamiento a los `elapsedMs` (lineal, termina justo en el destino). */
export function lerpCorrection(
  from: { x: number; y: number },
  to: { x: number; y: number },
  elapsedMs: number,
  durationMs = CORRECTION_LERP_MS,
): { x: number; y: number; done: boolean } {
  const t = durationMs <= 0 ? 1 : Math.min(1, Math.max(0, elapsedMs / durationMs));
  if (t >= 1) return { x: to.x, y: to.y, done: true };
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, done: false };
}
