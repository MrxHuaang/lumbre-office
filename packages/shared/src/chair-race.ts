// Carrera de sillas: en el pasillo del piso 2, montado en una silla de oficina, de la línea de salida
// (oeste) a la meta (este). El servidor cuenta el tiempo con su reloj, valida la velocidad (con el
// extra de la silla) y guarda los récords de la semana (en la tabla de récords del arcade, con su propio
// "juego": gana el menor tiempo).
import { z } from "zod";

export const CHAIR_RACE = {
  area: "piso-2",
  /** Punto del mapa donde se arranca (E). */
  point: "chair_race",
  /** El carril: filas del pasillo (tiles). Salirse cancela la carrera. */
  laneY0: 11,
  laneY1: 13,
  /** La meta: borde oeste de este tile (cruzarlo con los pies termina la carrera). */
  finishX: 37,
  /** Cuánto más rápido se va en la silla, a todo impulso (el tope que acepta el servidor). */
  speedMul: 1.7,
  /**
   * El minijuego (solo en el cliente): la silla avanza sola hacia la meta a `baseMul` de la velocidad de
   * caminar; cada clic (o Espacio) suma `pump` de impulso (de 0 a 1) y el impulso se va perdiendo a
   * `decayPerSec`. Con todo el impulso se va a `speedMul`.
   */
  baseMul: 0.55,
  pump: 0.13,
  decayPerSec: 0.5,
  /** Velocidad al cambiar de carril (W/S o flechas), relativa a la de caminar. */
  steerMul: 0.8,
  /** Una carrera abierta más de esto se cancela. */
  maxMs: 60_000,
  /** Pausa entre dos carreras de la misma persona. */
  cooldownMs: 1500,
  /** "Juego" con el que se guardan los tiempos (tabla ArcadeScore; el puntaje son ms). */
  game: "carrera-sillas",
  /** Cuánto vale el tablero guardado en la sala (se borra al terminar una carrera en ella). */
  boardCacheMs: 60_000,
  /** Cuántos salen en la tabla de la semana. */
  boardSize: 8,
} as const;

/** Tiempo mínimo creíble para llegar a la meta desde `fromX` (px de mundo), a toda velocidad de silla. */
export function minRaceMs(fromX: number, tileSize: number, playerSpeed: number): number {
  const dist = Math.max(0, CHAIR_RACE.finishX * tileSize - fromX);
  // Un 15 % de margen por la tolerancia del servidor con los tirones de red.
  return (dist / (playerSpeed * CHAIR_RACE.speedMul)) * 1000 * 0.85;
}

/** ¿Está (x, y) (px de mundo) dentro del carril? */
export function inRaceLane(x: number, y: number, tileSize: number): boolean {
  const ty = Math.floor(y / tileSize);
  return ty >= CHAIR_RACE.laneY0 && ty <= CHAIR_RACE.laneY1 && x >= 0;
}

/** 7,32 s */
export const raceTimeText = (ms: number) => `${(ms / 1000).toFixed(2).replace(".", ",")} s`;

/** Cliente → servidor: largar (`MSG.raceStart`), abandonar (`raceCancel`) o pedir la tabla (`raceBoard`). */
export const RaceStartMessage = z.object({}).strict().optional();

export interface RaceBoardEntry {
  name: string;
  ms: number;
}

/** Servidor → cliente (`MSG.raceBoardResult`): los mejores tiempos de la semana y el mío. */
export interface RaceBoard {
  entries: RaceBoardEntry[];
  myBest: number | null;
}

export type RaceProblem = "far" | "seated" | "busy" | "lane" | "timeout" | "fast";

/** Servidor → cliente (`MSG.raceResult`): cómo terminó mi carrera. */
export type RaceResult =
  | { ok: true; ms: number; best: boolean; board: RaceBoard }
  | { ok: false; problem: RaceProblem };

export const RACE_PROBLEM_TEXT: Record<RaceProblem, string> = {
  far: "La salida es junto a la bandera del pasillo (piso 2, al oeste).",
  seated: "Primero levántate.",
  busy: "Un momento…",
  lane: "Te saliste del pasillo: carrera anulada.",
  timeout: "Se acabó el tiempo: carrera anulada.",
  fast: "Eso fue demasiado rápido para una silla: carrera anulada.",
};

/** Servidor → los del nivel (`MSG.raceEvent`): alguien llegó a la meta. */
export interface RaceEvent {
  sessionId: string;
  name: string;
  ms: number;
  /** Récord de la semana (de todos). */
  record: boolean;
}
