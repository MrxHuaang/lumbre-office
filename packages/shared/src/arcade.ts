// Arcade del sótano: cuatro minijuegos pixel que se juegan en la pantalla de la máquina. El servidor da una
// semilla al empezar (el cliente la usa para su azar) y al terminar el cliente manda el puntaje y las teclas
// que apretó: el servidor repite la partida con su semilla (arcade-sim.ts) y solo la acepta si da lo mismo,
// si duró algo y si no duró más que lo que marca su reloj. Premios chicos de ocio (LEISURE, con su tope).
import { z } from "zod";
import { ARCADE_STEP_MS, BLOQUES, FLAPPY, SCREEN_W, SNAKE } from "./arcade-sim";
import { dayStart } from "./points";

export const ARCADE_GAMES = ["snake", "breakout", "flappy", "bloques"] as const;
export type ArcadeGame = (typeof ARCADE_GAMES)[number];

export const ARCADE_GAME_INFO: Record<ArcadeGame, { name: string; controls: string }> = {
  snake: { name: "Culebrita", controls: "Flechas para girar" },
  breakout: { name: "Rompeladrillos", controls: "Flechas para mover · Espacio para lanzar" },
  flappy: { name: "Aleteo", controls: "Espacio o flecha arriba para aletear" },
  bloques: { name: "Bloques", controls: "Flechas para mover · Arriba gira · Espacio la suelta" },
};

/**
 * Juego de cada máquina, en el orden de ARCADE_CABINETS del sótano (y de sus puntos "arcade"). Las
 * tres primeras tienen un juego cada una, las que siguen los repiten (Bloques, el más nuevo, en dos de
 * la fila del cine) y la última está fuera de servicio.
 */
export const ARCADE_MACHINES: readonly (ArcadeGame | null)[] = [
  "snake",
  "breakout",
  "flappy",
  "snake",
  "breakout",
  "flappy",
  "bloques",
  "snake",
  "breakout",
  "bloques",
  "flappy",
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
  /**
   * Premio por superar el récord de la semana de ese juego. Solo si el récord anterior era de otra persona
   * (subir el propio de a un punto no paga) y con un puntaje mínimo (ARCADE_RECORD_MIN).
   */
  recordReward: 10,
  /** Cuántos puestos muestra la tabla de récords. */
  boardSize: 5,
  /** Tope de puntaje que acepta el mensaje (ningún juego llega a tanto). */
  maxScore: 100_000,
  /** Cuántas teclas se pueden mandar de una partida. */
  maxInputs: 20_000,
  /** Margen entre el reloj del navegador y el del servidor al comparar la duración de la partida. */
  clockSlackMs: 1500,
  /** Cuánto se guarda en memoria la tabla de récords de cada juego antes de volver a leerla. */
  boardCacheMs: 5000,
} as const;

/**
 * Lo que cuesta jugar (monedas = puntos). Se cobra en el servidor al empezar, con `spendPoints` (motivo
 * PURCHASE: se compra la partida); si no alcanza, no se juega. El hockey es una apuesta entre las dos
 * personas: cada una pone su moneda y el ganador se lleva el pozo (motivo CASINO, sin tope diario).
 */
export const ARCADE_PRICE = {
  /** Una partida en una máquina. */
  machine: 5,
  /** Un partido de hockey de mesa (lo pone cada jugador). */
  hockey: 10,
  /** Ganarle a la máquina en el hockey: se devuelve la moneda y esto de premio de ocio (LEISURE, con tope). */
  hockeyBotBonus: 5,
} as const;

/** `refId` del cobro de una partida de máquina (para leer el libro de puntos). */
export const arcadeRefId = (game: string) => `arcade:${game}`;
/** `refId` del cobro y el pago de un partido de hockey. */
export const hockeyRefId = (match: number) => `hockey:${match}`;

/** Pasos que puede tener una partida como mucho (la de `sessionMs`). */
export const ARCADE_MAX_STEPS = Math.ceil(ARCADE.sessionMs / ARCADE_STEP_MS);

/** Puntaje mínimo para cobrar el premio por récord (si no, el primero de la semana lo gana con 1). */
export const ARCADE_RECORD_MIN: Record<ArcadeGame, number> = { snake: 8, breakout: 12, flappy: 5, bloques: 4 };

/**
 * Lo máximo posible de cada juego en `elapsedMs` de partida, sacado de las constantes de cada uno. Es una
 * segunda barrera: la que vale es repetir la partida. Culebrita: una manzana por movimiento como mucho y un
 * movimiento cada `minMs` (y no cabe más culebra que la pantalla). Aleteo: el primer tubo se pasa cuando
 * llega desde la derecha hasta el pajarito y después sale uno cada `spacing` px. Bloques: las piezas que
 * caben en ese tiempo (con la pausa entre una y otra), de a cuatro cuadritos por fila de diez.
 * Rompeladrillos: cota gruesa, dos ladrillos por segundo (un bot que no pierde nunca rompe menos de uno).
 */
export function maxArcadeScore(game: ArcadeGame, elapsedMs: number): number {
  const ms = Math.max(0, elapsedMs);
  if (game === "snake") return Math.min(SNAKE.cols * SNAKE.rows - 4, Math.floor(ms / SNAKE.minMs));
  if (game === "flappy") {
    const firstMs = ((FLAPPY.spawnX - FLAPPY.birdX + FLAPPY.pipeW) / FLAPPY.speed) * 1000;
    const everyMs = ((FLAPPY.spawnX - (SCREEN_W - FLAPPY.spacing)) / FLAPPY.speed) * 1000;
    return ms < firstMs ? 0 : Math.floor((ms - firstMs) / everyMs) + 1;
  }
  if (game === "bloques") {
    // Entre pieza y pieza hay al menos `spawnDelay` pasos, y cada pieza llena 4 de las 10 de una fila.
    const pieces = Math.floor(ms / ARCADE_STEP_MS / BLOQUES.spawnDelay) + 1;
    return Math.floor((pieces * 4) / BLOQUES.cols);
  }
  return 6 + Math.floor((2 * ms) / 1000);
}

/** ¿Es posible ese puntaje en `elapsedMs` de partida? */
export function plausibleScore(game: ArcadeGame, score: number, elapsedMs: number): boolean {
  return Number.isInteger(score) && score >= 0 && score <= maxArcadeScore(game, elapsedMs);
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

/**
 * Cliente → servidor (`MSG.arcadeFinish`): terminó la partida `token` con ese puntaje, después de `steps`
 * pasos fijos y con esas teclas (codificadas con `encodeInput`, en orden), para que el servidor la repita.
 */
export const ArcadeFinishMessage = z.object({
  token: z.string().min(1).max(64),
  score: z.number().int().min(0).max(ARCADE.maxScore),
  steps: z.number().int().min(0).max(ARCADE_MAX_STEPS),
  inputs: z.array(z.number().int().min(0)).max(ARCADE.maxInputs),
});
export type ArcadeFinishMessage = z.infer<typeof ArcadeFinishMessage>;

export interface ArcadeBoardEntry {
  name: string;
  score: number;
}

/** Servidor → cliente (`MSG.arcadeBoardResult`): los récords de la semana (`board`) y los de hoy. */
export interface ArcadeBoard {
  machine: number;
  game: ArcadeGame;
  board: ArcadeBoardEntry[];
  today: ArcadeBoardEntry[];
}

/**
 * Servidor → cliente (`MSG.arcadeStarted`): se cobró la partida y empezó; la semilla es para el azar
 * del juego y `balance` el saldo después de pagar.
 */
export interface ArcadeStarted {
  machine: number;
  game: ArcadeGame;
  token: string;
  seed: number;
  balance: number;
}

export type ArcadeError = "far" | "invalid" | "funds" | "short" | "implausible" | "expired" | "failed";

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
      /** Es lo mejor de hoy en ese juego. */
      bestToday: boolean;
      firstToday: boolean;
      /** Récords de la semana y de hoy, ya con esta partida. */
      board: ArcadeBoardEntry[];
      today: ArcadeBoardEntry[];
    }
  | { ok: false; error: ArcadeError };

export const ARCADE_ERROR_TEXT: Record<ArcadeError, string> = {
  far: "Párate delante de la máquina para jugar.",
  invalid: "Esa máquina está fuera de servicio.",
  funds: `No te alcanzan las monedas: cada partida cuesta ${ARCADE_PRICE.machine}.`,
  short: "La partida fue muy corta: no cuenta.",
  implausible: "Ese puntaje no cuadra con la partida: no se guardó.",
  expired: "La partida se venció. Empieza otra.",
  failed: "No se pudo guardar el puntaje. Intenta de nuevo.",
};
