// Fase 4: el casino del sótano. Se apuesta con puntos (sin fichas). Todo lo decide el servidor: aquí
// solo están las reglas, los pagos y los mensajes, para que servidor y cliente digan lo mismo.
import { z } from "zod";

export const CASINO = {
  /** Límite diario de pérdidas por defecto (el admin lo cambia en /admin). */
  defaultDailyLossLimit: 150,
  /** Apuesta mínima y máxima de una ficha (una apuesta de la ruleta, una mano de blackjack). */
  minBet: 1,
  maxBet: 50,
  /** Ranking del casino: ganancia neta de los últimos N días. */
  rankingDays: 7,
  roulette: {
    /** Tiempo para apostar, lo que dura el giro y cuánto se muestra el resultado. */
    bettingMs: 20_000,
    spinMs: 6_000,
    resultMs: 5_000,
    /** Apuestas por persona y ronda. */
    maxBetsPerRound: 12,
    /** Últimos resultados que se muestran. */
    historySize: 12,
  },
} as const;

/** Por qué no se aceptó una apuesta. */
export const CASINO_ERRORS = ["far", "closed", "limit", "funds", "max-bets", "disabled", "failed"] as const;
export type CasinoError = (typeof CASINO_ERRORS)[number];

export const CASINO_ERROR_TEXT: Record<CasinoError, string> = {
  far: "Acércate a la mesa para apostar.",
  closed: "Ya no se puede apostar en esta ronda.",
  limit: "Llegaste a tu límite de pérdidas de hoy. Vuelve mañana.",
  funds: "No te alcanzan los puntos.",
  "max-bets": "Ya hiciste todas las apuestas que se permiten en esta ronda.",
  disabled: "El casino está cerrado por ahora.",
  failed: "No se pudo hacer la apuesta. Intenta de nuevo.",
};

/**
 * Cuánto más se puede apostar hoy sin pasar el límite de pérdidas. `todayNet` es la suma de los
 * movimientos del casino de hoy (las apuestas abiertas ya están descontadas, así que cuentan).
 */
export function remainingToday(limit: number, todayNet: number): number {
  return Math.max(0, limit + todayNet);
}

/** `refId` de un movimiento de puntos del casino (p. ej. "ruleta:12"). */
export const casinoRefId = (game: "ruleta" | "blackjack", round: number) => `${game}:${round}`;

// ---------- Ruleta (europea: un solo cero) ----------

export const RED_NUMBERS: readonly number[] = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
/** Orden de los números en la rueda, en sentido horario desde el cero. */
export const WHEEL_ORDER: readonly number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3,
  26,
];

export function colorOf(n: number): "red" | "black" | "green" {
  if (n === 0) return "green";
  return RED_NUMBERS.includes(n) ? "red" : "black";
}

/** A qué se apuesta. */
export const RouletteBetSpec = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("number"), n: z.number().int().min(0).max(36) }),
  z.object({ kind: z.literal("red") }),
  z.object({ kind: z.literal("black") }),
  z.object({ kind: z.literal("even") }),
  z.object({ kind: z.literal("odd") }),
  z.object({ kind: z.literal("low") }),
  z.object({ kind: z.literal("high") }),
  z.object({ kind: z.literal("dozen"), d: z.union([z.literal(1), z.literal(2), z.literal(3)]) }),
  z.object({ kind: z.literal("column"), c: z.union([z.literal(1), z.literal(2), z.literal(3)]) }),
]);
export type RouletteBetSpec = z.infer<typeof RouletteBetSpec>;

/** ¿Gana esta apuesta si sale `n`? (El cero solo lo gana quien apostó al cero.) */
export function rouletteWins(bet: RouletteBetSpec, n: number): boolean {
  if (bet.kind === "number") return bet.n === n;
  if (n === 0) return false;
  switch (bet.kind) {
    case "red":
      return colorOf(n) === "red";
    case "black":
      return colorOf(n) === "black";
    case "even":
      return n % 2 === 0;
    case "odd":
      return n % 2 === 1;
    case "low":
      return n <= 18;
    case "high":
      return n >= 19;
    case "dozen":
      return Math.ceil(n / 12) === bet.d;
    case "column":
      return ((n - 1) % 3) + 1 === bet.c;
  }
}

/** Cuántas veces la apuesta se gana además de recuperarla (pleno 35, docena y columna 2, el resto 1). */
export function roulettePayout(bet: RouletteBetSpec): number {
  if (bet.kind === "number") return 35;
  if (bet.kind === "dozen" || bet.kind === "column") return 2;
  return 1;
}

/** Nombre corto de una apuesta ("Rojo", "Pleno 17", "2.ª docena"…). */
export function rouletteBetLabel(bet: RouletteBetSpec): string {
  switch (bet.kind) {
    case "number":
      return `Pleno ${bet.n}`;
    case "red":
      return "Rojo";
    case "black":
      return "Negro";
    case "even":
      return "Par";
    case "odd":
      return "Impar";
    case "low":
      return "1 a 18";
    case "high":
      return "19 a 36";
    case "dozen":
      return `${bet.d}.ª docena`;
    case "column":
      return `${bet.c}.ª columna`;
  }
}

export type RoulettePhase = "betting" | "spinning" | "result";

/** Cliente → servidor (`MSG.rouletteBet`): una apuesta (hay que estar junto a la mesa). */
export const RouletteBetMessage = z.object({
  bet: RouletteBetSpec,
  amount: z.number().int().min(CASINO.minBet).max(CASINO.maxBet),
});
export type RouletteBetMessage = z.infer<typeof RouletteBetMessage>;

/** Servidor → cliente (`MSG.casinoResult`): resultado de una apuesta o de una jugada. */
export type CasinoResult = { ok: true; balance: number } | { ok: false; error: CasinoError };

/** Servidor → cliente al terminar una ronda de ruleta (`MSG.rouletteSettled`): lo que ganaste. */
export interface RouletteSettled {
  round: number;
  result: number;
  /** Puntos devueltos (apuesta + ganancia) en esta ronda; 0 si no ganó nada. */
  won: number;
  /** Lo que apostó en la ronda. */
  staked: number;
}

/** Ajustes del casino que se cambian en /admin. */
export interface CasinoSettingsDTO {
  enabled: boolean;
  dailyLossLimit: number;
}

export const CasinoSettingsBody = z.object({
  enabled: z.boolean(),
  dailyLossLimit: z.number().int().min(0).max(100_000),
});
