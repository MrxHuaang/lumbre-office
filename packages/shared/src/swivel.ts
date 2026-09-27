// Sillas giratorias: sentado en una silla de oficina con ruedas (las de las oficinas y la sala de
// reuniones) se dan unas vueltas rápidas (R). Lo ven todos los del nivel; girar demasiado marea un poco
// (sin alcohol).
import { z } from "zod";

export const SWIVEL = {
  /** Prefijo de los tipos de asiento que giran: las sillas de oficina de todos los colores. */
  seatPrefix: "office-chair",
  /** Vueltas de cada giro (el servidor elige, así todos ven las mismas). */
  minTurns: 1,
  maxTurns: 3,
  /** Lo que dura una vuelta a toda velocidad, y lo que se suma por arrancar y frenar. */
  turnMs: 480,
  rampMs: 500,
  /** Pausa después de terminar un giro antes del siguiente. */
  restMs: 500,
  /** Girar `dizzyAfter` veces en `dizzyWindowMs` marea. */
  dizzyAfter: 5,
  dizzyWindowMs: 30_000,
  /** Cuánto "mareo" suma (en las mismas unidades que el alcohol) y hasta dónde llega como mucho. */
  dizzyUnits: 2.5,
  /** Debajo de "borracho" (DRUNK.stages[2]): girando se llega a "mareado", nunca a desmayarse. */
  dizzyCap: 5.5,
} as const;

/** ¿Este asiento gira? Solo las sillas de oficina con ruedas, miren o no a un PC. */
export function isSwivelSeat(seat: { type: string }): boolean {
  return seat.type === SWIVEL.seatPrefix || seat.type.startsWith(`${SWIVEL.seatPrefix}-`);
}

/** Lo que dura un giro de `turns` vueltas (arranca despacio, va rápido y frena). */
export const spinMs = (turns: number) => turns * SWIVEL.turnMs + SWIVEL.rampMs;

/**
 * Cuántas vueltas lleva el giro en el momento `t` (de 0 a 1 del total): acelera, va parejo y frena.
 * Devuelve de 0 a `turns`.
 */
export function spinProgress(turns: number, t: number): number {
  const x = Math.min(1, Math.max(0, t));
  // Suavizado "ease in-out" (el mismo que Sine.inOut): lento al principio y al final.
  return turns * (0.5 - Math.cos(Math.PI * x) / 2);
}

/** Cliente → servidor (`MSG.swivel`): girar en la silla. */
export const SwivelMessage = z.object({}).strict().optional();
export type SwivelMessage = z.infer<typeof SwivelMessage>;

/** Servidor → clientes del mismo nivel (`MSG.swivelEvent`): alguien gira en su silla. */
export interface SwivelEvent {
  sessionId: string;
  turns: number;
  /** Giró tanto que quedó mareado (solo le importa a quien giró: el aviso). */
  dizzy: boolean;
}
