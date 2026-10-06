// La piscina del jardín (detrás de la cabaña): nadar, el trampolín, las reposeras al sol y quedar mojado
// al salir. Aquí van las reglas que comparten el servidor (las valida) y el cliente (las anticipa y
// dibuja): tiempos, puntos, mensajes y avisos.
import { z } from "zod";
import { isWet, type Weather } from "./weather";

export const AGUA = {
  /** Cada cuánto dan puntos las reposeras al sol (con el tope diario del ocio). */
  tickMs: 5 * 60_000,
  /** Puntos por cada rato al sol en una reposera (solo despejado y de día). */
  sunPoints: 2,
  /** Cuánto queda mojado quien sale del agua (gotitas). */
  wetMs: 3 * 60_000,
  /** Nadando se va más despacio que caminando. */
  swimSpeedMul: 0.6,
  /** Pausa entre dos chapuzones de la misma persona. */
  diveCooldownMs: 4_000,
  /** Lo que dura el salto del trampolín (del tablón al agua). */
  diveMs: 1_100,
  /** Hasta dónde (tiles) se sale del agua: el borde tiene que quedar al lado. */
  exitReachTiles: 1.3,
  /** Cada cuánto revisa la sala quién está al sol. */
  checkMs: 10_000,
} as const;

/** Reposeras: los puntos del sol. */
export const SUN_SEATS: readonly string[] = ["sun-lounger"];
export const isSunSeat = (type: string) => SUN_SEATS.includes(type);

/** Con lluvia, tormenta o nieve la piscina se tapa con la lona: nadie nada. */
export const poolCovered = (w: Weather) => isWet(w) || w === "nieve";
/** Se toma el sol solo con el cielo despejado y de día (del juego). */
export const sunny = (w: Weather, night: boolean) => w === "despejado" && !night;

// ---------- Mensajes ----------

export const AGUA_MSG = {
  /** Cliente → servidor (`AguaActionMessage`): meterse a la piscina, tirarse del trampolín o salir del agua. */
  action: "agua:action",
  /** Servidor → los del nivel: alguien se tiró del trampolín (`DiveEvent`). */
  dive: "agua:dive",
  /** Servidor → quien lo intentó (o a quien sacó la lluvia): por qué no (`AguaNotice`). */
  notice: "agua:notice",
} as const;

export const AguaAction = z.enum(["swim", "dive", "out"]);
export type AguaAction = z.infer<typeof AguaAction>;
export const AguaActionMessage = z.object({ action: AguaAction });
export type AguaActionMessage = z.infer<typeof AguaActionMessage>;

/** Salto del trampolín: desde la punta del tablón (px de mundo) hasta donde cae al agua. */
export interface DiveEvent {
  sessionId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export const AguaNoticeCode = z.enum(["covered", "far", "busy", "edge", "wait", "rain"]);
export type AguaNoticeCode = z.infer<typeof AguaNoticeCode>;

export interface AguaNotice {
  code: AguaNoticeCode;
}

export const AGUA_NOTICES: Record<AguaNoticeCode, string> = {
  covered: "La piscina está tapada con la lona mientras llueve o nieva.",
  far: "Acércate a la escalera o al trampolín de la piscina.",
  busy: "Primero levántate o sal del agua.",
  edge: "Para salir, acércate nadando al borde.",
  wait: "Toma aire un segundo antes de volver a saltar.",
  rain: "Se dañó el tiempo: todos fuera de la piscina. La taparon con la lona.",
};
