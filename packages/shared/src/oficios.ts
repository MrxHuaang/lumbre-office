// Oficios: pesca, huerta, cocina, social y exploración. Cada uno tiene experiencia (tabla SkillXp) y un
// nivel del 1 al 10, que dan los encargos (encargos.ts) y lo que uno hace (cada contador de achievements.ts
// da su experiencia, con tope diario). Cada nivel desbloquea algo: ropa (trajes del editor), un mueble de
// la tienda, una receta, una ventajita (nivel 5) y, en el 10, un título, un logro legendario y su insignia.
// Quien ya tenía historia en la cabaña empieza con la experiencia de sus contadores (`veteranXp`, una vez).
// Es puro: lo usan el servidor de juego (suma, sube de nivel y valida las ventajas), la base (guarda), la
// web (valida la ropa y la tienda) y el navegador (la pestaña de oficios).
import { z } from "zod";
import { STAT_KEYS, STAT_PREFIX } from "./achievements";
import type { CostumeId } from "./costume-ids";
import { QUEST_SKILLS, QUEST_SKILL_TEXT, type QuestSkill } from "./encargos";
import { GRANJA_STATS } from "./granja";

export const OFICIOS = QUEST_SKILLS;
export type Oficio = QuestSkill;
export const isOficio = (x: unknown): x is Oficio => typeof x === "string" && (OFICIOS as readonly string[]).includes(x);

export const OFICIO_INFO: Record<Oficio, { name: string; title: string; color: string }> = {
  pesca: { name: QUEST_SKILL_TEXT.pesca, title: "Leyenda del lago", color: "#4a70a0" },
  huerta: { name: QUEST_SKILL_TEXT.huerta, title: "Mano verde de la cabaña", color: "#5a9a3e" },
  cocina: { name: QUEST_SKILL_TEXT.cocina, title: "Sazón de la casa", color: "#c0602e" },
  social: { name: QUEST_SKILL_TEXT.social, title: "Alma de la cabaña", color: "#b0467a" },
  exploracion: { name: QUEST_SKILL_TEXT.exploracion, title: "Trotamundos de la cabaña", color: "#7a5aa8" },
};

// ---------- La curva ----------

export const MAX_LEVEL = 10;

/**
 * Experiencia total para llegar a cada nivel (índice = nivel − 1): 80·(n−1)^2,1, redondeado a decenas. Con
 * un uso normal (unos 60 de experiencia al día en un oficio) el 2 sale el primer día, el 5 en unas semanas
 * y el 10 en unos cuatro meses y medio.
 */
export const LEVEL_XP: readonly number[] = Array.from({ length: MAX_LEVEL }, (_, i) => (i === 0 ? 0 : Math.round((80 * i ** 2.1) / 10) * 10));

/** Nivel con esa experiencia (1 a 10). */
export function levelOf(xp: number): number {
  let level = 1;
  for (let l = 2; l <= MAX_LEVEL; l++) if (xp >= LEVEL_XP[l - 1]!) level = l;
  return level;
}

/** Cuánto lleva dentro del nivel y cuánto le falta para el siguiente (null en el 10). */
export function levelProgress(xp: number): { level: number; from: number; to: number | null; into: number; need: number | null } {
  const level = levelOf(xp);
  const from = LEVEL_XP[level - 1]!;
  const to = level >= MAX_LEVEL ? null : LEVEL_XP[level]!;
  return { level, from, to, into: xp - from, need: to === null ? null : to - xp };
}

/** "Nivel de vecino": la suma de los niveles de los cinco oficios (5 a 50). */
export function neighborLevel(levels: Partial<Record<Oficio, number>>): number {
  return OFICIOS.reduce((t, o) => t + Math.max(1, levels[o] ?? 1), 0);
}

// ---------- La experiencia de cada cosa ----------

/** Cuánta experiencia da cada unidad de un contador, y de qué oficio. Los de prefijo van aparte. */
export const OFICIO_XP: Record<Oficio, Readonly<Record<string, number>>> = {
  pesca: {
    [STAT_KEYS.fishCaught]: 8,
    [STAT_KEYS.fishSpecies]: 25,
    [STAT_KEYS.fishTrash]: 3,
    [STAT_KEYS.fishTreasures]: 30,
    [STAT_KEYS.legendaryFish]: 150,
    [STAT_KEYS.mythicFish]: 300,
  },
  huerta: {
    [STAT_KEYS.plantings]: 4,
    [STAT_KEYS.harvests]: 8,
    [GRANJA_STATS.feeds]: 10,
    [GRANJA_STATS.eggs]: 4,
    [GRANJA_STATS.grinds]: 8,
    [STAT_KEYS.petCares]: 1,
  },
  cocina: {
    [STAT_KEYS.dishesCooked]: 15,
    [GRANJA_STATS.dishes]: 15,
    [STAT_KEYS.marshmallows]: 3,
    [STAT_KEYS.goldenMarshmallows]: 10,
    [STAT_KEYS.coffees]: 1,
  },
  social: {
    [STAT_KEYS.toasts]: 5,
    [STAT_KEYS.dances]: 1,
    [STAT_KEYS.emotes]: 0.5,
    [STAT_KEYS.chatMessages]: 0.25,
    [STAT_KEYS.knocks]: 3,
    [STAT_KEYS.phoneCalls]: 5,
    [STAT_KEYS.giftsGiven]: 15,
    [STAT_KEYS.photosTaken]: 6,
    [STAT_KEYS.missionsDone]: 30,
    [STAT_KEYS.boardWins]: 20,
    [STAT_KEYS.focusBlocks]: 10,
  },
  exploracion: {
    [STAT_KEYS.tilesWalked]: 0.02,
    [STAT_KEYS.stargazing]: 10,
    [STAT_KEYS.shootingStars]: 25,
    [STAT_KEYS.racesFinished]: 10,
    [STAT_KEYS.spaRests]: 5,
    [STAT_KEYS.arcadeGames]: 3,
  },
};

/** Cada visita a un nivel (`visit:<nivel>`) da algo de exploración; al calcular lo de antes, cada nivel conocido. */
export const VISIT_XP = 2;
export const VISITED_AREA_XP = 30;

/** Qué oficio y cuánta experiencia por unidad da un contador (null si ninguno). */
export function statOficio(key: string): { oficio: Oficio; xp: number } | null {
  if (key.startsWith(STAT_PREFIX.visit)) return { oficio: "exploracion", xp: VISIT_XP };
  for (const o of OFICIOS) {
    const xp = OFICIO_XP[o][key];
    if (xp) return { oficio: o, xp };
  }
  return null;
}

export const OFICIO = {
  /** Lo más que dan las acciones en un día por oficio (los encargos van aparte: ya tienen su tope de puntos). */
  dailyActionCap: 200,
  /** Quien ya tenía historia empieza, como mucho, justo antes del nivel 8 (el resto hay que jugarlo). */
  veteranMaxLevel: 7,
  /** Nivel de la ventajita de cada oficio. */
  perkLevel: 5,
} as const;

/** La experiencia inicial de alguien que ya jugaba, sacada de sus contadores (sin pasarse del nivel 7). */
export function veteranXp(stats: Readonly<Record<string, number>>): Record<Oficio, number> {
  const out = Object.fromEntries(OFICIOS.map((o) => [o, 0])) as Record<Oficio, number>;
  for (const [key, value] of Object.entries(stats)) {
    if (!(value > 0)) continue;
    if (key.startsWith(STAT_PREFIX.visit)) {
      out.exploracion += VISITED_AREA_XP;
      continue;
    }
    const hit = statOficio(key);
    if (hit) out[hit.oficio] += hit.xp * value;
  }
  const cap = LEVEL_XP[OFICIO.veteranMaxLevel]! - 1;
  for (const o of OFICIOS) out[o] = Math.min(cap, Math.floor(out[o]));
  return out;
}

// ---------- Lo que da cada nivel ----------

export type OficioRewardKind = "costume" | "furniture" | "recipe" | "perk" | "title";

export interface OficioReward {
  oficio: Oficio;
  level: number;
  kind: OficioRewardKind;
  /** El id de lo que se desbloquea: traje, tipo de mueble o receta (vacío en ventajas y título). */
  id: string;
  label: string;
  text: string;
}

const reward = (oficio: Oficio, level: number, kind: OficioRewardKind, id: string, label: string, text: string): OficioReward => ({ oficio, level, kind, id, label, text });

export const OFICIO_REWARDS: readonly OficioReward[] = [
  reward("pesca", 2, "costume", "pescador-lago", "Traje de pescador del lago", "Ruana, botas y el sombrero de pesca de Don Evelio."),
  reward("pesca", 4, "furniture", "dock-lamp", "Farol del muelle", "En la tienda: el farol que alumbra el muelle, para tu oficina."),
  reward("pesca", 5, "perk", "", "Pulso firme", "La barra verde del minijuego sale un 5% más larga."),
  reward("pesca", 6, "costume", "lobo-lago", "Traje de lobo de lago", "Impermeable azul noche, pañoleta y chaleco de pescador."),
  reward("pesca", 8, "furniture", "rowboat", "Bote de madera", "En la tienda: un bote de verdad (no flota en la oficina)."),
  reward("pesca", 10, "title", "", OFICIO_INFO.pesca.title, "Título del perfil, logro legendario e insignia."),
  reward("huerta", 2, "costume", "hortelano", "Traje de hortelano", "Overol, sombrero de paja y guantes de tierra."),
  reward("huerta", 4, "furniture", "wheelbarrow", "Carretilla", "En la tienda: la carretilla del huerto."),
  reward("huerta", 5, "perk", "", "Buena mano", "Una de cada cuatro cosechas sale doble."),
  reward("huerta", 6, "costume", "maestro-huerta", "Traje de maestro de la huerta", "Ruana verde, sombrero vueltiao y bolsa de semillas."),
  reward("huerta", 8, "furniture", "planter", "Jardinera", "En la tienda: una jardinera con flores."),
  reward("huerta", 10, "title", "", OFICIO_INFO.huerta.title, "Título del perfil, logro legendario e insignia."),
  reward("cocina", 2, "costume", "cocinero", "Delantal de la casa", "Delantal a cuadros y pañoleta, para la estufa."),
  reward("cocina", 4, "furniture", "dish-hutch", "Alacena", "En la tienda: la alacena de la vajilla buena."),
  reward("cocina", 5, "perk", "", "Rinde más", "Cada plato de la parrilla o del horno trae una porción de más."),
  reward("cocina", 6, "recipe", "sancocho-abuela", "Sancocho de la abuela", "Receta nueva en la estufa."),
  reward("cocina", 8, "costume", "chef-mayor", "Traje de chef mayor", "Filipina, gorro alto y corbatín: la cocina es tuya."),
  reward("cocina", 10, "title", "", OFICIO_INFO.cocina.title, "Título del perfil, logro legendario e insignia."),
  reward("social", 2, "costume", "anfitrion", "Traje de anfitrión", "Camisa hawaiana y collar: se te nota el parche."),
  reward("social", 4, "furniture", "hammock", "Hamaca", "En la tienda: una hamaca para dos."),
  reward("social", 5, "perk", "", "Detallista", "Un detalle gratis al día para alguien que tengas cerca."),
  reward("social", 6, "costume", "alma-fiesta", "Traje de alma de la fiesta", "Saco brillante, corbatín y gafas de estrella."),
  reward("social", 8, "furniture", "puzzle-table", "Mesa con puzle", "En la tienda: para armar entre varios."),
  reward("social", 10, "title", "", OFICIO_INFO.social.title, "Título del perfil, logro legendario e insignia."),
  reward("exploracion", 2, "costume", "explorador", "Traje de explorador", "Pantalón de bolsillos, mochila y sombrero de ala."),
  reward("exploracion", 4, "furniture", "celestial-globe", "Globo celeste", "En la tienda: el globo de las constelaciones."),
  reward("exploracion", 5, "perk", "", "Olfato", "Pistas en el diario del observatorio: dónde anda el Man del Sombrero y qué te falta conocer."),
  reward("exploracion", 6, "costume", "cartografo", "Traje de cartógrafo", "Abrigo largo, bufanda y monóculo."),
  reward("exploracion", 8, "furniture", "stargazer-scope", "Telescopio de trípode", "En la tienda: tu propio telescopio."),
  reward("exploracion", 10, "title", "", OFICIO_INFO.exploracion.title, "Título del perfil, logro legendario e insignia."),
];

export const rewardsOf = (oficio: Oficio) => OFICIO_REWARDS.filter((r) => r.oficio === oficio);

const unlockOf = (kind: OficioRewardKind, id: string) => OFICIO_REWARDS.find((r) => r.kind === kind && r.id === id);

/** Los trajes de los oficios (el resto de la ropa es gratis). */
export const OFICIO_COSTUMES = OFICIO_REWARDS.filter((r) => r.kind === "costume").map((r) => r.id as CostumeId);

/** Qué pide un traje, un mueble o una receta (undefined = nada: es libre). */
export const costumeUnlock = (id: string | null | undefined) => (id ? unlockOf("costume", id) : undefined);
export const furnitureUnlock = (id: string) => unlockOf("furniture", id);
export const recipeUnlock = (id: string) => unlockOf("recipe", id);

export type OficioLevels = Partial<Record<Oficio, number>>;

/** ¿Tiene el nivel que pide eso? (lo que no pide nada, siempre). */
export function unlocked(r: Pick<OficioReward, "oficio" | "level"> | undefined, levels: OficioLevels): boolean {
  return !r || (levels[r.oficio] ?? 1) >= r.level;
}

/** ¿Tiene la ventajita de ese oficio (nivel 5)? */
export const hasPerk = (oficio: Oficio, levels: OficioLevels) => (levels[oficio] ?? 1) >= OFICIO.perkLevel;

/** El traje de un oficio que alguien todavía no tiene (null = el look se puede guardar). Lo valida la web al guardar. */
export function lockedCostume(look: { costume?: string | null } | null | undefined, levels: OficioLevels): OficioReward | null {
  const r = costumeUnlock(look?.costume);
  return r && !unlocked(r, levels) ? r : null;
}

/** ¿Puede comprar ese mueble (los exclusivos piden su nivel)? */
export const canBuyExclusive = (item: { requires?: { oficio: Oficio; level: number } }, levels: OficioLevels) => unlocked(item.requires, levels);

/** "Pesca nivel 2": lo que falta, dicho corto. */
export const unlockText = (r: Pick<OficioReward, "oficio" | "level">) => `${OFICIO_INFO[r.oficio].name} nivel ${r.level}`;

// ---------- Ventajas (nivel 5) ----------

export const OFICIO_PERKS = {
  /** La barra del minijuego de pesca (se multiplica sobre la de la caña). */
  pesca: { barBonus: 1.05 },
  /** Probabilidad (por mil) de que una cosecha salga doble. */
  huerta: { extraHarvestPerMil: 250 },
  /** Porciones de más por plato de la parrilla o el horno. */
  cocina: { extraPortions: 1 },
  /** El detalle gratis del día: qué se regala y a qué distancia (tiles). */
  social: { giftsPerDay: 1, giftItem: "bocadillo", reachTiles: 3 },
} as const;

// ---------- Los contadores de nivel (para los logros y el título) ----------

/** Contador de máximo con el nivel de cada oficio (así los logros legendarios salen solos). */
export const oficioLevelStat = (o: Oficio) => `oficio_nivel:${o}`;
/** Último día (de Bogotá) en que alguien regaló su detalle gratis (contador de máximo). */
export const OFICIO_GIFT_DAY_STAT = STAT_KEYS.oficioGiftDay;

// ---------- Mensajes ----------

export interface OficioSkillView {
  xp: number;
  level: number;
  /** Lo que ya ganó hoy con acciones (para el tope diario). */
  today: number;
}

/** Servidor → cliente: mis oficios. */
export interface OficioStateEvent {
  skills: Record<Oficio, OficioSkillView>;
  neighbor: number;
}

/** Servidor → los del nivel: alguien subió de nivel en un oficio (las chispas y, a él, la fanfarria). */
export interface OficioLevelUpEvent {
  sessionId: string;
  name: string;
  oficio: Oficio;
  level: number;
}

export const OFICIO_MSG = {
  state: "oficios:state",
  levelUp: "oficios:levelUp",
  /** Cliente → servidor: el detalle gratis del día para alguien de al lado (`{ sessionId }`). */
  gift: "oficios:gift",
  giftResult: "oficios:giftResult",
  /** Servidor → quien lo recibe: le dieron un detalle. */
  gifted: "oficios:gifted",
  /** Cliente → servidor: las pistas del diario (exploración 5). */
  hints: "oficios:hints",
  hintsResult: "oficios:hintsResult",
  /** Servidor → quien la tuvo: una ventaja que salió (cosecha doble, porción de más). */
  notice: "oficios:notice",
} as const;

export interface OficioNotice {
  code: "harvest" | "portion";
  item: string;
}

export const OficioGiftMessage = z.object({ sessionId: z.string().min(1).max(64) });

export type OficioGiftError = "level" | "used" | "far" | "self" | "full" | "stack" | "unknown" | "busy";
export type OficioGiftResult = { ok: true; toName: string; item: string } | { ok: false; error: OficioGiftError };
export interface OficioGiftedEvent {
  fromName: string;
  item: string;
}

export const OFICIO_GIFT_ERROR_TEXT: Record<OficioGiftError, string> = {
  level: `El detalle gratis es de Social nivel ${OFICIO.perkLevel}.`,
  used: "Ya diste tu detalle de hoy. Mañana hay otro.",
  far: "Acércate a esa persona para darle el detalle.",
  self: "Los detalles son para los demás (aunque te lo merezcas).",
  full: "A esa persona no le cabe nada más en la mochila.",
  stack: "Esa persona ya tiene demasiados de esos.",
  unknown: "Esa persona ya no está por aquí.",
  busy: "Un momentico…",
};

export type OficioHints = { ok: true; hideout: string | null; unvisited: string[] } | { ok: false };
