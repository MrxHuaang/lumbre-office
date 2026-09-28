// Las estaciones del año: salen del mes de Bogotá (como el día de points.ts), así todos están en la misma
// sin guardar nada. Diciembre a febrero es invierno (puede nevar), marzo a mayo primavera (flores), junio
// a agosto verano y septiembre a noviembre otoño (caen hojas). También cambian cómo crece el huerto: cada
// cultivo tiene su temporada (ver `seasonGrowth`).
import { dayStart } from "./points";

export const SEASONS = ["primavera", "verano", "otono", "invierno"] as const;
export type Season = (typeof SEASONS)[number];

export const SEASON_TEXT: Record<Season, string> = {
  primavera: "Primavera",
  verano: "Verano",
  otono: "Otoño",
  invierno: "Invierno",
};

export const isSeason = (x: unknown): x is Season => typeof x === "string" && (SEASONS as readonly string[]).includes(x);

// Bogotá es UTC-5 sin horario de verano: el mes es el de la fecha corrida cinco horas.
const OFFSET_MS = -5 * 3_600_000;

/** Mes de Bogotá (0 = enero … 11 = diciembre) del instante `ts`. */
export function bogotaMonth(ts: number): number {
  return new Date(dayStart(ts) + OFFSET_MS + 12 * 3_600_000).getUTCMonth();
}

/** Estación del instante `ts` (según el mes de Bogotá). */
export function seasonOf(ts: number): Season {
  const m = bogotaMonth(ts);
  if (m === 11 || m <= 1) return "invierno";
  if (m <= 4) return "primavera";
  if (m <= 7) return "verano";
  return "otono";
}

// ---------- El huerto según la estación ----------

/**
 * Ritmo de crecimiento de cada cultivo en cada estación (1 = el de la tabla de CROPS). Más de 1 crece
 * más rápido; menos, más despacio. El cilantro no se queja nunca; el tomate y el maíz son de verano, la
 * papa y el lulo de otoño, la fresa de primavera. Un cultivo sin fila crece igual todo el año.
 */
export const SEASON_GROWTH: Record<string, Record<Season, number>> = {
  cilantro: { primavera: 1.2, verano: 1, otono: 1, invierno: 1 },
  fresa: { primavera: 1.4, verano: 1.1, otono: 0.8, invierno: 0.6 },
  tomate: { primavera: 1, verano: 1.4, otono: 0.8, invierno: 0.5 },
  papa: { primavera: 1, verano: 0.9, otono: 1.3, invierno: 0.8 },
  maiz: { primavera: 1.1, verano: 1.3, otono: 0.9, invierno: 0.5 },
  lulo: { primavera: 0.9, verano: 1, otono: 1.4, invierno: 0.7 },
  // Los del invernadero (van siempre bajo techo: el frío no los castiga, el calor del verano sí ayuda).
  uchuva: { primavera: 1.1, verano: 1.2, otono: 1, invierno: 0.8 },
  pitahaya: { primavera: 1, verano: 1.3, otono: 1, invierno: 0.7 },
  cacao: { primavera: 1.1, verano: 1.2, otono: 1, invierno: 0.8 },
  cafe: { primavera: 1.2, verano: 1, otono: 1, invierno: 0.9 },
};

export interface SeasonGrowthOptions {
  /** Bajo techo (el invernadero): lo bueno de la temporada se queda, el castigo no. */
  greenhouse?: boolean;
}

/** Multiplicador del crecimiento de `crop` (id del cultivo) en `season`. */
export function seasonGrowth(crop: string, season: Season, opts: SeasonGrowthOptions = {}): number {
  const k = SEASON_GROWTH[crop]?.[season] ?? 1;
  return opts.greenhouse ? Math.max(1, k) : k;
}

/** La mejor estación de un cultivo (para la ayuda del cobertizo). */
export function bestSeasonOf(crop: string): Season | undefined {
  const row = SEASON_GROWTH[crop];
  if (!row) return undefined;
  return SEASONS.reduce((best, s) => (row[s] > row[best] ? s : best), SEASONS[0]);
}

/** "Crece mejor", "normal" o "le cuesta" en esta estación (texto corto para la ayuda). */
export function seasonGrowthText(crop: string, season: Season, opts: SeasonGrowthOptions = {}): string {
  const k = seasonGrowth(crop, season, opts);
  if (k > 1.05) return "en su temporada";
  if (k < 0.95) return "fuera de temporada";
  return "crece normal";
}
