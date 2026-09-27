// Arcade del sótano: tres minijuegos pixel que se juegan en la pantalla de la máquina. El servidor da una
// semilla al empezar (el cliente la usa para su azar) y al terminar valida el puntaje: que la partida haya
// durado algo y que el puntaje sea posible en ese tiempo. Premios chicos de ocio (LEISURE, con su tope).
import { z } from "zod";
import { dayStart } from "./points";

export const ARCADE_GAMES = ["snake", "breakout", "flappy"] as const;
export type ArcadeGame = (typeof ARCADE_GAMES)[number];

export const ARCADE_GAME_INFO: Record<ArcadeGame, { name: string; controls: string }> = {
  snake: { name: "Culebrita", controls: "Flechas para girar" },
  breakout: { name: "Rompeladrillos", controls: "Flechas para mover · Espacio para lanzar" },
  flappy: { name: "Aleteo", controls: "Espacio o flecha arriba para aletear" },
};

/**
 * Juego de cada máquina, en el orden de ARCADE_CABINETS del sótano (y de sus puntos "arcade"). Las
 * tres primeras tienen un juego cada una, las que siguen los repiten y las últimas están fuera de servicio.
 */
export const ARCADE_MACHINES: readonly (ArcadeGame | null)[] = [
  "snake",
  "breakout",
  "flappy",
  "snake",
  "breakout",
  "flappy",
  "flappy",
  "snake",
  "breakout",
  null,
  "snake",
  null,
];

/** Juego de la máquina `i` (null = fuera de servicio o no existe). */
export const arcadeGameOf = (machine: number): ArcadeGame | null => ARCADE_MACHINES[machine] ?? null;

export const ARCADE = {
  /** Una partida que dura menos que esto no cuenta (ni se guarda ni da premio). */
  minMs: 3000,
  /** Una partida abierta más de esto ya no se acepta (hay que empezar otra). */
  sessionMs: 20 * 60_000,
  /** Premio por la primera partida del día (cualquier juego). */
  firstGameReward: 5,
  /** Premio por superar el récord de la semana de ese juego. */
  recordReward: 10,
  /** Cuántos puestos muestra la tabla de récords. */
  boardSize: 5,
  /** Tope de puntaje que acepta el mensaje (ningún juego llega a tanto). */
  maxScore: 100_000,
} as const;

/**
 * Lo máximo posible de cada juego: `base` más `perSecond` por cada segundo de partida. Culebrita: una
 * manzana por punto (la serpiente más rápida come como mucho unas dos por segundo). Rompeladrillos: un
 * ladrillo por punto (en los rebotes buenos caen varios seguidos). Aleteo: un tubo por punto (sale uno
 * cada segundo y medio).
 */
export const ARCADE_LIMITS: Record<ArcadeGame, { base: number; perSecond: number }> = {
  snake: { base: 3, perSecond: 2 },
  breakout: { base: 6, perSecond: 4 },
  flappy: { base: 2, perSecond: 1 },
};

/** ¿Es posible ese puntaje en `elapsedMs` de partida? */
export function plausibleScore(game: ArcadeGame, score: number, elapsedMs: number): boolean {
  const lim = ARCADE_LIMITS[game];
  return Number.isInteger(score) && score >= 0 && score <= lim.base + (lim.perSecond * elapsedMs) / 1000;
}

const DAY_MS = 86_400_000;
const OFFSET_MS = -5 * 3_600_000;

/** Inicio (ms UTC) de la semana de Bogotá que contiene `ts`: el lunes a la medianoche. */
export function weekStart(ts: number): number {
  const day = dayStart(ts);
  const localDays = Math.round((day + OFFSET_MS) / DAY_MS);
  // El 1 de enero de 1970 fue jueves: con lunes = 0, ese día es el 3.
  const sinceMonday = (((localDays + 3) % 7) + 7) % 7;
  return day - sinceMonday * DAY_MS;
}

// ---------- Mensajes ----------

/** Cliente → servidor (`MSG.arcadeBoard`): la tabla de récords de la semana de una máquina. */
export const ArcadeBoardMessage = z.object({ machine: z.number().int().min(0).max(63) });
export type ArcadeBoardMessage = z.infer<typeof ArcadeBoardMessage>;

/** Cliente → servidor (`MSG.arcadeStart`): empezar una partida en la máquina (hay que estar delante). */
export const ArcadeStartMessage = z.object({ machine: z.number().int().min(0).max(63) });
export type ArcadeStartMessage = z.infer<typeof ArcadeStartMessage>;

/** Cliente → servidor (`MSG.arcadeFinish`): terminó la partida `token` con ese puntaje. */
export const ArcadeFinishMessage = z.object({
  token: z.string().min(1).max(64),
  score: z.number().int().min(0).max(ARCADE.maxScore),
});
export type ArcadeFinishMessage = z.infer<typeof ArcadeFinishMessage>;

export interface ArcadeBoardEntry {
  name: string;
  score: number;
}

/** Servidor → cliente (`MSG.arcadeBoardResult`). */
export interface ArcadeBoard {
  machine: number;
  game: ArcadeGame;
  board: ArcadeBoardEntry[];
}

/** Servidor → cliente (`MSG.arcadeStarted`): la partida empezó; la semilla es para el azar del juego. */
export interface ArcadeStarted {
  machine: number;
  game: ArcadeGame;
  token: string;
  seed: number;
}

export type ArcadeError = "far" | "invalid" | "short" | "implausible" | "expired" | "failed";

/** Servidor → cliente (`MSG.arcadeResult`). */
export type ArcadeResult =
  | {
      ok: true;
      game: ArcadeGame;
      score: number;
      /** Puntos de ocio ganados (0 si no hubo premio o se llegó al tope del día). */
      awarded: number;
      /** Superó el récord de la semana de ese juego. */
      record: boolean;
      firstToday: boolean;
      board: ArcadeBoardEntry[];
    }
  | { ok: false; error: ArcadeError };

export const ARCADE_ERROR_TEXT: Record<ArcadeError, string> = {
  far: "Párate delante de la máquina para jugar.",
  invalid: "Esa máquina está fuera de servicio.",
  short: "La partida fue muy corta: no cuenta.",
  implausible: "Ese puntaje no cuadra con la partida: no se guardó.",
  expired: "La partida se venció. Empieza otra.",
  failed: "No se pudo guardar el puntaje. Intenta de nuevo.",
};
