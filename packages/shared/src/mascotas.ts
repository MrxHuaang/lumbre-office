// Casa viva: las mascotas de la casa. Las mueve el servidor (deambulan a paso lento por su nivel, con
// rutas del A* del mundo, y a veces duermen en su cama); todos las ven por el estado de la sala. Se les
// hace clic para llamarlas, y de cerca se acarician, se alimentan o se adoptan (una por persona): la
// adoptada sigue a su dueño por la casa, también de un nivel a otro.
import { z } from "zod";
import { heldParts } from "./cafe";
import { consumeActionOf } from "./consumables";

export type PetKind = "gato" | "perro";
/** Pelaje: define los colores del dibujo (packages/map/src/art/mascotas.ts). */
export type PetCoat = "naranja" | "gris" | "cafe";

export interface PetDef {
  id: string;
  name: string;
  kind: PetKind;
  coat: PetCoat;
  /** Nivel donde vive: nunca sale de él. */
  area: string;
  /**
   * Tile de su cama (un mueble "pet-bed" del nivel). Si la cama se movió o se quitó, duerme en la
   * "pet-bed" más cercana a este tile (ver `bedTile` en el servidor).
   */
  bed: { x: number; y: number };
  /** Por dónde deambula (tiles del nivel): los destinos al azar se eligen adentro. */
  roam: { x: number; y: number; w: number; h: number };
}

export const PETS: readonly PetDef[] = [
  // Canela, la gata atigrada del salón: la chimenea, el pasillo y el recibidor (es café, para no
  // confundirla con el gato naranja de la cesta de al lado).
  { id: "canela", name: "Canela", kind: "gato", coat: "cafe", area: "planta-baja", bed: { x: 10, y: 2 }, roam: { x: 0, y: 0, w: 24, h: 26 } },
  // Tobi, el perro del jardín: frente a la casa, entre el camino, la fogata y el lago.
  { id: "tobi", name: "Tobi", kind: "perro", coat: "cafe", area: "jardin", bed: { x: 72, y: 51 }, roam: { x: 28, y: 36, w: 60, h: 50 } },
  // Nube, el gato gris del piso 3: la sala de estar, el rincón de lectura y el pasillo.
  { id: "nube", name: "Nube", kind: "gato", coat: "gris", area: "piso-3", bed: { x: 9, y: 16 }, roam: { x: 0, y: 8, w: 32, h: 13 } },
];

export const petDef = (id: string) => PETS.find((p) => p.id === id);

export const PET = {
  /** Paso lento (px de mundo por segundo): las personas caminan a 150. */
  speed: 40,
  /** Cada cuánto las mueve el servidor. */
  tickMs: 150,
  /** Cuánto se queda quieta entre un paseo y otro. */
  idleMs: [3_000, 9_000] as const,
  /** Cuánto duerme cuando va a su cama, y la probabilidad de ir a dormir en vez de pasear. */
  sleepMs: [18_000, 40_000] as const,
  sleepChance: 0.2,
  /** Hasta dónde va a pasear desde donde está (tiles). */
  wanderTiles: 9,
  /** Desde qué distancia se la llama con un clic (tiles) y cuánto se queda mirándote. */
  callTiles: 14,
  followMs: 9_000,
  /** Desde dónde se acaricia o se le da un premio (tiles). */
  reachTiles: 1.8,
  petCooldownMs: 1_500,
  /** Pausa entre dos llamadas de la misma persona (cada una recalcula la ruta y suena en todo el nivel). */
  callCooldownMs: 2_000,
  /** Hasta dónde busca su cama si la movieron (tiles). */
  bedSearchTiles: 12,
  /** Pausa entre dos premios de la misma persona. */
  treatCooldownMs: 20_000,
  /** Cuánto dura comerse el premio. */
  eatMs: 2_500,
} as const;

/** Qué está haciendo (viaja en el estado): de pie, caminando, sentada, durmiendo o comiendo. */
export type PetPose = "stand" | "walk" | "sit" | "sleep" | "eat";

/** Nombres de los mensajes de las mascotas (aparte de MSG para no pisarse con lo demás). */
export const PET_MSG = {
  /** Cliente → servidor: "ven" (clic en la mascota). */
  call: "pet:call",
  /** Cliente → servidor: acariciar o dar un premio. */
  action: "pet:action",
  /** Servidor → clientes del nivel: alguien acarició, dio un premio o llamó a una mascota. */
  event: "pet:event",
  /** Servidor → quien lo intentó: por qué no se pudo (sin comida en la mano, ya tiene mascota…). */
  notice: "pet:notice",
} as const;

export const PetCallMessage = z.object({ pet: z.string().min(1).max(24) });
export type PetCallMessage = z.infer<typeof PetCallMessage>;

/**
 * Lo que se hace de cerca: acariciar, darle el plato de croquetas (`treat`), darle la comida que se tiene
 * en la mano (`feed`), adoptarla o dejarla volver a la casa (`release`, solo su dueño).
 */
export const PET_ACTIONS = ["pet", "treat", "feed", "adopt", "release"] as const;
export type PetAction = (typeof PET_ACTIONS)[number];

export const PetActionMessage = z.object({ pet: z.string().min(1).max(24), action: z.enum(PET_ACTIONS) });
export type PetActionMessage = z.infer<typeof PetActionMessage>;

export interface PetEvent {
  pet: string;
  sessionId: string;
  action: PetAction | "call";
  /** Lo que se comió (el dibujo de lo que se tenía en la mano), si fue `feed`. */
  food?: string;
}

// ---------- Cariño y dueños ----------

export const PET_BOND = {
  /** El cariño va de 0 a `max` (viaja redondeado en el estado). */
  max: 100,
  /** Cuánto sube con cada cosa. */
  gain: { pet: 2, treat: 4, feed: 8 },
  /** Cuánto cariño le puede dar una misma persona a una mascota en un día (Bogotá): lo demás no suma. */
  dailyGainPerUser: 30,
  /** Cuánto baja por hora (extraña a la gente). */
  decayPerHour: 1,
  /** Puntos (LEISURE) por cuidarla y cuántas veces al día le dan puntos a una persona. */
  careReward: 1,
  careRewardsPerDay: 5,
  /** La adoptada se queda a esta distancia del dueño (tiles) y arranca a caminar si se aleja más de `catchUpTiles`. */
  followTiles: 1.6,
  catchUpTiles: 2.6,
  /** Más lejos que esto (o sin ruta) aparece al lado del dueño. */
  teleportTiles: 16,
  /** Paso cuando sigue a su dueño (px de mundo por segundo): trota casi como una persona. */
  followSpeed: 135,
  /** Cada cuánto vuelve a calcular la ruta mientras el dueño camina. */
  repathMs: 450,
  /** El dueño lleva este rato quieto: se echa a dormir a su lado. */
  napAfterMs: 45_000,
  /** Cada cuánto se guarda el cariño que cambió. */
  saveMs: 30_000,
} as const;

/** Dueño y cariño de una mascota, como los guarda la base (`PetBond`). */
export interface PetBondRecord {
  petId: string;
  /** User.id del dueño (null = de la casa: se puede adoptar). */
  ownerId: string | null;
  ownerName: string;
  love: number;
  /** Hasta cuándo se contó la baja del cariño (ms). */
  loveAt: number;
}

/** Cariño después de `ms` sin que nadie la cuide (baja de a poco, nunca menos de 0). */
export function decayedLove(love: number, ms: number): number {
  return Math.max(0, love - (Math.max(0, ms) / 3_600_000) * PET_BOND.decayPerHour);
}

/** ¿Este dibujo de lo que se lleva en la mano es comida? (se muerde o va con cuchara; no bebidas ni habanos). */
export function isFoodArt(art: string): boolean {
  const action = consumeActionOf(art);
  return action === "bite" || action === "spoon";
}

/**
 * La comida de lo que alguien lleva en la mano (la primera mano con comida y, si se dan los usos que le
 * quedan a cada mano, que no esté vacía), o null.
 */
export function petFoodIn(held: string, left?: readonly number[]): { part: number; art: string } | null {
  const parts = heldParts(held);
  const part = parts.findIndex((art, i) => isFoodArt(art) && (!left || (left[i] ?? 0) > 0));
  return part < 0 ? null : { part, art: parts[part]! };
}

/** Por qué no se pudo: sin comida en la mano, ya tiene una mascota, esta ya tiene dueño o no es suya. */
export const PetNoticeCode = z.enum(["noFood", "hasPet", "taken", "notOwner"]);
export type PetNoticeCode = z.infer<typeof PetNoticeCode>;

/** Qué dice el aviso (con el nombre de la mascota). */
export const PET_NOTICES: Record<PetNoticeCode, (pet: string) => string> = {
  noFood: (pet) => `No tienes comida en la mano. Pide algo en la cafetería o saca algo de la nevera para ${pet}.`,
  hasPet: () => "Ya tienes una mascota. Para adoptar otra, primero deja que la tuya vuelva a la casa.",
  taken: (pet) => `${pet} ya tiene dueño.`,
  notOwner: (pet) => `${pet} no es tu mascota.`,
};

/** Servidor → quien lo intentó (`PET_MSG.notice`). */
export interface PetNotice {
  code: PetNoticeCode;
  /** Nombre de la mascota (para el aviso). */
  pet: string;
}
