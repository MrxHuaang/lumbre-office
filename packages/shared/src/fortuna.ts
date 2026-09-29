// La rueda de la fortuna del casino: una vuelta gratis al día por persona (día de Bogotá). Los premios son
// chicos: puntos de ocio (LEISURE, con su tope diario) o algo de la cafetería a la mochila. El servidor
// elige el sector con `crypto.randomInt` y guarda el día de la última vuelta en UserStat
// (`last_day:fortuna`, sin migración); el navegador solo anima la rueda hasta ese sector.
import { STAT_PREFIX } from "./achievements";

export interface FortuneSector {
  id: string;
  /** Lo que se lee en la rueda (corto). */
  label: string;
  /** Puntos de ocio (0 si el premio es un objeto o nada). */
  points: number;
  /** Algo de la casa a la mochila (un id de carta o de lo gratis, como `held.give`). */
  item?: string;
  /** Peso del sector (los grandes salen menos). */
  weight: number;
  /** Color del sector en la rueda. */
  color: string;
}

/** Los sectores en el orden en que van en la rueda (en sentido horario desde arriba). */
export const FORTUNE_SECTORS: readonly FortuneSector[] = [
  { id: "p2", label: "2", points: 2, weight: 22, color: "#c8452e" },
  { id: "tinto", label: "Tinto", points: 0, item: "tinto", weight: 12, color: "#e8c46a" },
  { id: "p5", label: "5", points: 5, weight: 16, color: "#3a6fb0" },
  { id: "nada", label: "Mañana", points: 0, weight: 14, color: "#5a4a60" },
  { id: "p3", label: "3", points: 3, weight: 20, color: "#4f8a3c" },
  { id: "bocadillo", label: "Bocadillo", points: 0, item: "bocadillo", weight: 8, color: "#b0508a" },
  { id: "p10", label: "10", points: 10, weight: 6, color: "#e0923e" },
  { id: "p25", label: "25", points: 25, weight: 2, color: "#dcae3f" },
];

export const FORTUNE = {
  /** Clave de UserStat con el último día de Bogotá en que giró (máximo). */
  statKey: `${STAT_PREFIX.lastDay}fortuna`,
  /** Lo que dura el giro en el navegador. */
  spinMs: 4_200,
} as const;

const TOTAL = FORTUNE_SECTORS.reduce((t, s) => t + s.weight, 0);

/** El sector que sale con un entero al azar en [0, total de pesos). */
export function fortuneSectorAt(r: number): number {
  let n = Math.max(0, Math.min(TOTAL - 1, Math.floor(r)));
  for (let i = 0; i < FORTUNE_SECTORS.length; i++) {
    n -= FORTUNE_SECTORS[i]!.weight;
    if (n < 0) return i;
  }
  return 0;
}

export const fortuneTotalWeight = () => TOTAL;

/** ¿Ya giró hoy? (`lastDay` = el día guardado, o undefined si nunca). */
export const spunToday = (lastDay: number | undefined, today: number) => lastDay !== undefined && lastDay >= today;

// ---------- Mensajes ----------

export const FORTUNE_MSG = {
  /** Cliente → servidor: ¿ya giré hoy? (al abrir el panel). */
  status: "fortuna:status",
  /** Cliente → servidor: girar (junto a la rueda). */
  spin: "fortuna:spin",
  /** Servidor → quien preguntó o giró. */
  result: "fortuna:result",
} as const;

export type FortuneError = "far" | "spun" | "loading" | "failed";

export type FortuneResult =
  | { kind: "status"; spun: boolean }
  | { kind: "spin"; sector: number; points: number; item?: string; kept: boolean }
  | { kind: "error"; error: FortuneError };

export const FORTUNE_ERROR_TEXT: Record<FortuneError, string> = {
  far: "Acércate a la rueda para girarla.",
  spun: "Ya giraste hoy. La rueda te espera mañana.",
  loading: "Un segundito, que la rueda está despertando.",
  failed: "La rueda se trabó. Intenta de nuevo.",
};
