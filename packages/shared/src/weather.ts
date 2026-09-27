// El clima de afuera. Lo decide el servidor (todos ven el mismo) con una cadena de Markov simple: cada
// tanto se sortea el siguiente según el actual. La niebla es más probable temprano en la mañana (hora de
// Bogotá). Todo es puro y el azar entra como parámetro, para poder probarlo.
import { bogotaHour } from "./fishing";

export const WEATHERS = ["despejado", "nublado", "lluvia", "tormenta", "niebla"] as const;
export type Weather = (typeof WEATHERS)[number];

export const WEATHER = {
  /** Con qué clima arranca el servidor si no es de mañana. */
  initial: "despejado" as Weather,
  /** Cuánto dura cada clima (se sortea entre los dos; la tormenta dura menos, ver `weatherDurationMs`). */
  minMs: 10 * 60_000,
  maxMs: 25 * 60_000,
  /** Horas de Bogotá (desde, hasta sin incluir) en las que la niebla es más probable. */
  fogHours: [5, 9] as const,
  /** Cuánto pesa la niebla de mañana (multiplica su peso) y el resto del día. */
  fogMorningBoost: 4,
  fogLaterFactor: 0.25,
} as const;

/** Texto para mostrar (chip del HUD). */
export const WEATHER_TEXT: Record<Weather, string> = {
  despejado: "Despejado",
  nublado: "Nublado",
  lluvia: "Lluvia",
  tormenta: "Tormenta",
  niebla: "Niebla",
};

/**
 * Pesos de la cadena: desde cada clima, qué tan probable es cada siguiente (se normalizan). El mismo
 * clima puede repetirse. La tormenta solo llega desde nubes o lluvia y siempre se calma a lluvia o nubes.
 */
const TRANSITIONS: Record<Weather, Record<Weather, number>> = {
  despejado: { despejado: 5, nublado: 3, lluvia: 0.5, tormenta: 0, niebla: 1 },
  nublado: { despejado: 3, nublado: 2, lluvia: 2.5, tormenta: 0.6, niebla: 0.8 },
  lluvia: { despejado: 1, nublado: 3, lluvia: 2, tormenta: 1, niebla: 0.5 },
  tormenta: { despejado: 0, nublado: 1, lluvia: 3, tormenta: 0.5, niebla: 0 },
  niebla: { despejado: 3, nublado: 2, lluvia: 0.5, tormenta: 0, niebla: 1.5 },
};

export function isWeather(x: unknown): x is Weather {
  return typeof x === "string" && (WEATHERS as readonly string[]).includes(x);
}

/** ¿Llueve? (lluvia o tormenta: la fauna se esconde y la casa se ve un poco más oscura). */
export const isWet = (w: Weather) => w === "lluvia" || w === "tormenta";

/** ¿Es temprano en la mañana (la hora de la niebla)? */
export const isFogHour = (hour: number) => hour >= WEATHER.fogHours[0] && hour < WEATHER.fogHours[1];

/** Pesos (sin normalizar) del siguiente clima desde `from` a la hora `hour` de Bogotá. */
export function transitionWeights(from: Weather, hour: number): Record<Weather, number> {
  const w = { ...TRANSITIONS[from] };
  w.niebla *= isFogHour(hour) ? WEATHER.fogMorningBoost : WEATHER.fogLaterFactor;
  return w;
}

/** Sortea el siguiente clima. `random` devuelve un número en [0, 1). */
export function nextWeather(from: Weather, hour: number, random: () => number): Weather {
  const w = transitionWeights(from, hour);
  const total = WEATHERS.reduce((a, k) => a + w[k], 0);
  let r = random() * total;
  for (const k of WEATHERS) {
    if (w[k] <= 0) continue;
    r -= w[k];
    if (r < 0) return k;
  }
  // Solo por redondeo: el último con peso.
  return [...WEATHERS].reverse().find((k) => w[k] > 0) ?? from;
}

/** Cuánto dura un clima antes de volver a sortear (la tormenta, la mitad: es un chaparrón). */
export function weatherDurationMs(weather: Weather, random: () => number): number {
  const ms = WEATHER.minMs + random() * (WEATHER.maxMs - WEATHER.minMs);
  return Math.round(weather === "tormenta" ? ms / 2 : ms);
}

/** Clima con el que arranca el servidor: de mañana, niebla; si no, el inicial. */
export function initialWeather(ts: number): Weather {
  return isFogHour(bogotaHour(ts)) ? "niebla" : WEATHER.initial;
}
