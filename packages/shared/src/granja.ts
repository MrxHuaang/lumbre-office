// La granja del jardín: el gallinero con el corral de la cabra, el molino de agua del arroyo y los
// ingredientes que salen de ahí para la parrilla (parrilla.ts). Lo usan el servidor (las reglas, en
// apps/server/src/rooms/granja.ts) y el cliente (qué dibujar y qué ofrecer con E).
//
// Los ingredientes y la comida van a la mochila (bolsa.ts: InventoryItem con `itemId = "obj:<id>"`, donde
// `<id>` tiene dibujo en packages/map/src/art/items.ts); lo que se lleva en la mano es la casilla elegida.
//
// Qué día cuenta:
// - Dar de comer (una vez por persona) y la racha de cuidar los animales van por el día real de Bogotá:
//   son una rutina de la vida real ("pasar por el gallinero cada mañana"); con el día del juego (una hora)
//   "una vez al día" dejaría de significar algo y la racha se volvería una carrera de horas.
// - Los huevos van por el día del juego: las gallinas ponen al amanecer del juego (06:00), así hay huevos
//   para cocinar varias veces al día y se ve cuándo aparecen (con el sol del jardín).
import { z } from "zod";
import type { UsableSpec } from "./consumables";
import { GAME_MINUTES_PER_DAY, gameMinutes, type GameClockState } from "./clock";

// ---------- Ingredientes nuevos ----------

export const EGG = "huevo";
export const FLOUR = "harina";
export const CHEESE = "queso";
export const CHORIZO = "chorizo";
/** Lo que se muele en el molino (la mazorca del huerto). */
export const CORN = "mazorca";

// ---------- Gallinero ----------

export type FarmAnimalKind = "gallina" | "cabra";

export interface FarmAnimalDef {
  id: string;
  kind: FarmAnimalKind;
  /** Plumaje o pelaje: los colores del dibujo (packages/map/src/art/granja.ts). */
  coat: string;
  /**
   * Nombres entre los que vota el equipo (el primero manda mientras nadie vote). Son fijos: una lista
   * cerrada se guarda como un número por persona (ver `voteValue`) sin tabla nueva.
   */
  names: readonly string[];
  /** Zona del jardín donde anda (el patio del gallinero o el corral): nunca sale de ella. */
  zone: "gallinero" | "corral";
}

export const FARM_ANIMALS: readonly FarmAnimalDef[] = [
  { id: "gallina-colorada", kind: "gallina", coat: "colorada", zone: "gallinero", names: ["Clementina", "Petronila", "Rosaura", "Doña Pepa"] },
  { id: "gallina-blanca", kind: "gallina", coat: "blanca", zone: "gallinero", names: ["Azucena", "Motica", "Nieves", "Blanquita"] },
  { id: "gallina-pinta", kind: "gallina", coat: "pinta", zone: "gallinero", names: ["Pintica", "Lucrecia", "Mariposa", "Chispita"] },
  { id: "gallina-negra", kind: "gallina", coat: "negra", zone: "gallinero", names: ["Tomasa", "Carbonera", "Morena", "Brujita"] },
  { id: "cabra", kind: "cabra", coat: "cafe", zone: "corral", names: ["Pimienta", "Tulia", "Manchas", "Rumba"] },
];

export const farmAnimalDef = (id: string) => FARM_ANIMALS.find((a) => a.id === id);

export const GALLINERO = {
  /** Huevos que ponen entre todas cada día del juego (se los lleva el primero que los busca). */
  eggsPerDay: 4,
  /** Minuto del día del juego en que ponen (el amanecer). */
  layMinute: 6 * 60,
  /** Puntos (LEISURE) por dar de comer, y cuánto suma la racha encima (uno por día seguido, con tope). */
  feedPoints: 2,
  streakBonusMax: 5,
  /** Cuánto se quedan comiendo en el comedero. */
  eatMs: 7_000,
  /** Pausa entre dos votos de la misma persona. */
  voteCooldownMs: 800,
  /** Paso de las gallinas y de la cabra (px de mundo por segundo; las personas caminan a 150). */
  henSpeed: 34,
  goatSpeed: 26,
  /** Cada cuánto las mueve el servidor. */
  tickMs: 200,
  /** Cuánto se quedan quietas (picoteando o mirando) entre un paseo y otro. */
  idleMs: [1_500, 6_000] as const,
  /** Hasta dónde pasean desde donde están (tiles). */
  wanderTiles: 4,
} as const;

/** Día del juego de los huevos: cambia al amanecer (06:00), no a la medianoche. */
export function eggDayOf(clock: GameClockState, now: number): number {
  return Math.floor((gameMinutes(clock, now) - GALLINERO.layMinute) / GAME_MINUTES_PER_DAY);
}

/**
 * La racha de cuidar los animales (días de Bogotá seguidos dando de comer). Se guarda en dos contadores
 * que solo suben (UserStat con `max`): el último día y desde qué día va la racha; así no hace falta tabla.
 * `null` = hoy ya les dio de comer.
 */
export function careStreak(lastDay: number | undefined, since: number | undefined, today: number): { since: number; streak: number } | null {
  if (lastDay !== undefined && lastDay >= today) return null;
  const from = lastDay === today - 1 && since !== undefined && since <= lastDay ? since : today;
  return { since: from, streak: today - from + 1 };
}

/** Puntos por dar de comer con esa racha. */
export const feedPointsFor = (streak: number) => GALLINERO.feedPoints + Math.min(Math.max(0, streak - 1), GALLINERO.streakBonusMax);

/** Claves de los contadores (UserStat) del gallinero. */
export const GRANJA_STATS = {
  /** Máximo: último día de Bogotá en que dio de comer. */
  lastDay: "gallinero_dia",
  /** Máximo: desde qué día va la racha. */
  since: "gallinero_racha_desde",
  /** Máximo: la racha más larga. */
  best: "gallinero_racha_mejor",
  /** Veces que dio de comer, huevos recogidos, maíz molido y platos de la parrilla (se suman). */
  feeds: "gallinero_comidas",
  eggs: "gallinero_huevos",
  grinds: "molino_moliendas",
  dishes: "parrilla_platos",
  /** Máximo, uno por animal: el voto (ver `voteValue`). */
  votePrefix: "gallinero_voto:",
} as const;

/** Minutos desde el 1 de enero de 2026: el voto más nuevo es el número más grande. */
const VOTE_EPOCH = Date.UTC(2026, 0, 1);
const VOTE_SLOTS = 8;

/**
 * El voto como un número que solo sube (UserStat con `max`): el minuto del voto por 8 más la opción. Así
 * cambiar de voto es guardar un número mayor, y se lee la opción con `voteOption`.
 */
export function voteValue(option: number, now: number): number {
  return Math.max(0, Math.floor((now - VOTE_EPOCH) / 60_000)) * VOTE_SLOTS + option;
}
export const voteOption = (value: number) => ((value % VOTE_SLOTS) + VOTE_SLOTS) % VOTE_SLOTS;

/** Votos por opción de cada animal (animal → cuántos votos tiene cada nombre). */
export type VoteTally = Record<string, number[]>;

/** Cuenta los votos: `votes` es userId → (animal → opción). */
export function tallyVotes(votes: Iterable<Map<string, number> | Record<string, number>>): VoteTally {
  const out: VoteTally = Object.fromEntries(FARM_ANIMALS.map((a) => [a.id, a.names.map(() => 0)]));
  for (const v of votes) {
    const entries = v instanceof Map ? [...v.entries()] : Object.entries(v);
    for (const [animal, option] of entries) {
      const row = out[animal];
      if (row && option >= 0 && option < row.length) row[option]! += 1;
    }
  }
  return out;
}

/** El nombre que ganó (el más votado; en un empate, el primero de la lista). */
export function winningName(def: FarmAnimalDef, counts: readonly number[] | undefined): string {
  let best = 0;
  (counts ?? []).forEach((n, i) => {
    if (n > (counts![best] ?? 0)) best = i;
  });
  return def.names[best] ?? def.names[0]!;
}

// ---------- Molino ----------

export const MOLINO = {
  /** Lo que tarda en moler una mazorca, y con lluvia (el arroyo crece y la rueda va más rápido). */
  grindMs: 6_000,
  grindWetMs: 3_000,
  /** Harina que sale de cada mazorca. */
  flourPerCorn: 2,
  /** Vueltas por segundo de la rueda: normal y con lluvia (el cliente la anima con esto). */
  wheelTurnsPerSec: 0.25,
  wheelWetTurnsPerSec: 0.6,
} as const;

// ---------- Muebles que se usan con E ----------

/**
 * - `feed`: dar de comer a los animales (el comedero del gallinero);
 * - `eggs`: buscar huevos en el nido (el gallinero);
 * - `grind`: moler maíz en el molino.
 */
export type GranjaAction = "feed" | "eggs" | "grind";
export const GRANJA_ACTIONS: readonly string[] = ["feed", "eggs", "grind"];
export const isGranjaAction = (a: string): a is GranjaAction => GRANJA_ACTIONS.includes(a);

export const GRANJA_USABLES: Record<string, UsableSpec> = {
  "chicken-feeder": { action: "feed", label: "Dar de comer a los animales", cooldownMs: 1500 },
  "chicken-coop": { action: "eggs", label: "Buscar huevos", cooldownMs: 1500 },
  "water-mill": { action: "grind", label: "Moler maíz", cooldownMs: 1200 },
};

// ---------- Mensajes ----------

export const GRANJA_MSG = {
  /** Cliente → servidor: abrir el panel del gallinero (el letrero de los nombres). */
  coopOpen: "granja:coop-open",
  /** Servidor → quien preguntó: cómo está el gallinero hoy y los votos. */
  coopState: "granja:coop-state",
  /** Cliente → servidor: votar un nombre. */
  vote: "granja:vote",
  /** Servidor → quien lo intentó: qué pasó (o por qué no se pudo). */
  notice: "granja:notice",
} as const;

export const VoteMessage = z.object({ animal: z.string().min(1).max(40), option: z.number().int().min(0).max(7) });
export type VoteMessage = z.infer<typeof VoteMessage>;

export interface CoopAnimalView {
  id: string;
  kind: FarmAnimalKind;
  names: readonly string[];
  votes: number[];
  /** Mi voto (-1 = todavía no voté). */
  mine: number;
  /** El nombre que va ganando. */
  name: string;
}

/** Servidor → cliente: el gallinero hoy. */
export interface CoopState {
  animals: CoopAnimalView[];
  /** ¿Ya les di de comer hoy (día de Bogotá)? */
  fedToday: boolean;
  /** Mi racha (0 = ninguna viva) y la mejor. */
  streak: number;
  best: number;
  /** Quiénes les dieron de comer hoy. */
  feeders: string[];
  /** Huevos que quedan en el nido y quién se los llevó hoy (del juego). */
  eggsLeft: number;
  eggsBy: string;
}

export const GranjaNoticeCode = z.enum([
  "fed",
  "alreadyFed",
  "wait",
  "eggs",
  "noEggs",
  "grinding",
  "busy",
  "noCorn",
  "flour",
  "bagFull",
  "voted",
  "failed",
]);
export type GranjaNoticeCode = z.infer<typeof GranjaNoticeCode>;

export interface GranjaNotice {
  code: GranjaNoticeCode;
  /** Puntos que dio, racha, cuántos huevos o cuánta harina, de quién eran los huevos. */
  points?: number;
  streak?: number;
  count?: number;
  name?: string;
  waitMs?: number;
}

export function granjaNoticeText(n: GranjaNotice): string {
  switch (n.code) {
    case "fed":
      return `Las gallinas y la cabra corren a comer${n.points ? `: +${n.points} puntos` : ""}${n.streak && n.streak > 1 ? ` (racha de ${n.streak} días)` : ""}.`;
    case "alreadyFed":
      return "Hoy ya les diste de comer: vuelve mañana para seguir la racha.";
    case "wait":
      return "Un momento, que las gallinas todavía no te reconocen. Intenta de nuevo.";
    case "eggs":
      return `Encontraste ${n.count ?? 0} huevos en el nido: van a tu mochila.`;
    case "noEggs":
      return n.name
        ? `${n.name} ya recogió los huevos de hoy. Las gallinas vuelven a poner al amanecer (06:00).`
        : "El nido está vacío. Las gallinas vuelven a poner al amanecer (06:00).";
    case "grinding":
      return "Las piedras del molino empiezan a moler la mazorca…";
    case "busy":
      return "El molino todavía está moliendo lo tuyo.";
    case "noCorn":
      return "Para moler hace falta una mazorca del huerto en la mochila.";
    case "flour":
      return `Salieron ${n.count ?? MOLINO.flourPerCorn} bolsas de harina de maíz: van a tu mochila.`;
    case "bagFull":
      return "No te cabe en la mochila: haz espacio primero.";
    case "voted":
      return "Voto guardado. ¡Gracias por bautizar a los animales!";
    case "failed":
      return "No se pudo guardar. Intenta de nuevo en un momento.";
  }
}
