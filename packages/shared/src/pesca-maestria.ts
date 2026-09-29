// Lo que hace la pesca más que tirar y esperar: la maestría (cada caña mejora con los peces que se sacan
// con ella), la pesca en grupo (con alguien más pescando cerca pican más raros) y los mordisqueos (la boya
// tiembla antes de la picada de verdad: el que responde ahí asusta al pez y, con carnada, se la roba). Todo
// es puro: el servidor lo aplica (rooms/fishing.ts) y el cliente lo muestra.
import type { FishingRod } from "./fishing-sim";

// ---------- Maestría de la caña ----------

export const ROD_MASTERY = {
  /** Peces (sin contar la basura) sacados con esa caña para llegar a cada nivel (1 a 5). */
  levels: [10, 30, 60, 100, 160],
  /** Cuánto se alarga la barra verde por nivel (se suma al `bar` de la caña en `ROD_TUNING`). */
  barPerLevel: 0.04,
  /** Con el último nivel, los raros y lo de más arriba pesan esto más (como la carnada, ver `fishPool`). */
  maxLevelLuck: 1.2,
} as const;

export const MAX_ROD_MASTERY = ROD_MASTERY.levels.length;

/** Contador de `UserStat` con los peces sacados con cada caña (la maestría se cuenta por caña). */
export const rodCatchesKey = (rod: FishingRod) => `rod_catches:${rod}`;

/** Nivel de maestría con esta cantidad de peces y cuántos faltan para el siguiente (null = el máximo). */
export function rodMastery(catches: number): { level: number; next: number | null } {
  const { levels } = ROD_MASTERY;
  let level = 0;
  while (level < levels.length && catches >= levels[level]!) level++;
  return { level, next: level < levels.length ? levels[level]! - catches : null };
}

/** Cuánto más larga es la barra por la maestría (0 sin nivel). */
export const masteryBar = (level: number) => Math.max(0, Math.min(MAX_ROD_MASTERY, Math.floor(level))) * ROD_MASTERY.barPerLevel;

// ---------- Pesca en grupo ----------

export const GROUP_FISHING = {
  /** Distancia (px de mundo) a la que otra caña en el agua cuenta como compañía: 5 tiles. */
  radius: 5 * 32,
  /** Con compañía, los raros y lo de más arriba pesan esto más (no se suma por persona). */
  luck: 1.25,
} as const;

/** ¿Estas dos cañas pescan juntas? (mismo nivel y cerca). */
export function fishingTogether(a: { area: string; x: number; y: number }, b: { area: string; x: number; y: number }): boolean {
  return a.area === b.area && Math.hypot(a.x - b.x, a.y - b.y) <= GROUP_FISHING.radius;
}

// ---------- Mordisqueos ----------

export const NIBBLES = {
  /** Hasta cuántos mordisqueos antes de la picada de verdad (de 0 a este número, al azar). */
  max: 2,
  /** Solo hay mordisqueos si la espera es al menos esta (con esperas cortas no caben). */
  minWaitMs: 1_500,
  /** Ni muy al principio ni pegado a la picada de verdad. */
  marginMs: 500,
  /** Cuánto tiembla la boya. */
  showMs: 380,
  /** Responder hasta este tiempo después de un mordisqueo es caer en la trampa. */
  trapMs: 900,
} as const;

/**
 * Cuándo caen los mordisqueos (ms desde el lance) para una espera: `count` al azar entre 0 y `NIBBLES.max`
 * y cada uno entre los márgenes. `random(n)` da un entero en [0, n).
 */
export function nibbleTimes(waitMs: number, random: (n: number) => number): number[] {
  if (waitMs < NIBBLES.minWaitMs) return [];
  const count = random(NIBBLES.max + 1);
  const span = Math.max(1, waitMs - 2 * NIBBLES.marginMs);
  const times: number[] = [];
  for (let i = 0; i < count; i++) times.push(NIBBLES.marginMs + random(span));
  return times.sort((a, b) => a - b);
}

// ---------- La suerte de un lance ----------

/**
 * La suerte con que pica (multiplica el peso de los raros, ver `fishPool`): la de la carnada, por la
 * compañía y por la maestría al máximo. Sin nada de eso, 1 (los pesos de siempre).
 */
export function castLuck(o: { bait: number; group: boolean; mastery: number }): number {
  return o.bait * (o.group ? GROUP_FISHING.luck : 1) * (o.mastery >= MAX_ROD_MASTERY ? ROD_MASTERY.maxLevelLuck : 1);
}
