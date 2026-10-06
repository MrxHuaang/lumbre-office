// La cocina de la planta baja: con lo del huerto y la miel del apiario se cocinan platos en la estufa. La
// despensa de cada persona es su mochila (bolsa.ts): lo cosechado va ahí y de ahí se cocina. El plato va a
// la mochila (y a la mano) como lo de la cafetería y da puntos (motivo LEISURE, con su tope) o, al primer
// bocado, un rato de energía (caminar más rápido).
// Lo valida el servidor (apps/server/src/rooms/cocina.ts); el cliente solo lo muestra.
import { z } from "zod";
import type { ConsumeAction } from "./consumables";
import type { Oficio } from "./oficios";
import { CROPS, HONEY } from "./huerto";
import { CARNADA_E_RECIPE } from "./capitulo3";

/** Lo que se puede guardar en la despensa: lo que se cosecha (menos las flores, que son para las silletas) y la miel. */
export const INGREDIENTS: readonly string[] = [...CROPS.filter((c) => !c.flower).map((c) => c.product), HONEY];
export const isIngredient = (item: string) => INGREDIENTS.includes(item);

/**
 * Lo que hace un plato: puntos al cocinarlo, o energía (velocidad × `mul` durante `ms`) al probarlo. Lo de
 * la historia (`story`) no se come ni da nada: sirve para un paso (la carnada de E., capítulo 3).
 */
export type DishEffect = { kind: "points"; amount: number } | { kind: "speed"; mul: number; ms: number } | { kind: "story" };

export interface Recipe {
  id: string;
  name: string;
  blurb: string;
  /** Ingredientes (id de lo cosechado o "miel") y cuántos de cada uno. */
  needs: Readonly<Record<string, number>>;
  effect: DishEffect;
  /** Cómo se come y cuántos bocados tiene (va a CONSUMABLES). */
  action: ConsumeAction;
  uses: number;
  /** Receta de un oficio: se cocina desde ese nivel (ver OFICIO_REWARDS en oficios.ts). */
  requires?: { oficio: Oficio; level: number };
  /** Receta de la historia: solo se ve y se cocina con alguno de estos pasos abiertos (y una sola en la mochila). */
  story?: readonly string[];
}

const MIN = 60_000;

/** Las recetas, de lo más sencillo a lo más elaborado. Los ids son también lo que queda en la mano. */
export const RECIPES: readonly Recipe[] = [
  {
    id: "pan-miel",
    name: "Pan de maíz con miel",
    blurb: "Arepita dulce recién asada: da energía para un rato.",
    needs: { mazorca: 1, [HONEY]: 1 },
    effect: { kind: "speed", mul: 1.2, ms: 3 * MIN },
    action: "bite",
    uses: 3,
  },
  {
    id: "fresas-miel",
    name: "Fresas con miel",
    blurb: "En platico hondo, bien bañadas. Se come a cucharadas.",
    needs: { fresa: 2, [HONEY]: 1 },
    effect: { kind: "speed", mul: 1.25, ms: 2 * MIN },
    action: "spoon",
    uses: 3,
  },
  {
    id: "lulada",
    name: "Lulada con miel",
    blurb: "Lulo machacado con hielo: despierta a cualquiera.",
    needs: { lulo: 1, [HONEY]: 1 },
    effect: { kind: "speed", mul: 1.3, ms: 90_000 },
    action: "sip",
    uses: 3,
  },
  {
    id: "sopa-verduras",
    name: "Sopa de verduras",
    blurb: "Tomate, papa criolla y cilantro fresco del huerto.",
    needs: { tomate: 1, papa: 1, cilantro: 1 },
    effect: { kind: "points", amount: 8 },
    action: "spoon",
    uses: 4,
  },
  {
    id: "ajiaco",
    name: "Ajiaco de la casa",
    blurb: "Con papa criolla, mazorca y cilantro. Para compartir la mesa.",
    needs: { papa: 2, mazorca: 1, cilantro: 1 },
    effect: { kind: "points", amount: 12 },
    action: "spoon",
    uses: 4,
  },
  {
    id: "tarta-lulo",
    name: "Tarta de lulo y fresa",
    blurb: "Horneada, con miel por encima. Se desmorona un poco.",
    needs: { lulo: 1, fresa: 1, [HONEY]: 1 },
    effect: { kind: "points", amount: 10 },
    action: "bite",
    uses: 4,
  },
  {
    // La de Cocina nivel 6 (oficios.ts): se ve en la estufa desde antes, pero se cocina con el nivel.
    id: "sancocho-abuela",
    name: "Sancocho de la abuela",
    blurb: "Papa, mazorca, tomate y cilantro en olla grande: alcanza para todos.",
    needs: { papa: 2, mazorca: 1, tomate: 1, cilantro: 1 },
    effect: { kind: "points", amount: 16 },
    action: "spoon",
    uses: 5,
    requires: { oficio: "cocina", level: 6 },
  },
];

/**
 * Las recetas de la historia (la carnada de E., capítulo 3): se cocinan en la misma estufa, pero no son
 * platos (no se comen, no dan puntos ni cuentan como plato cocinado) y solo con su paso abierto.
 */
export const STORY_RECIPES: readonly Recipe[] = [CARNADA_E_RECIPE];

const RECIPE_BY_ID = new Map([...RECIPES, ...STORY_RECIPES].map((r) => [r.id, r]));
export const recipeById = (id: string): Recipe | undefined => RECIPE_BY_ID.get(id);
export const isDish = (item: string) => RECIPE_BY_ID.has(item) && !RECIPE_BY_ID.get(item)!.story;
export const RECIPE_IDS = [...RECIPES, ...STORY_RECIPES].map((r) => r.id) as [string, ...string[]];

export const COCINA = {
  /** Cuántos de cada ingrediente caben en la despensa de una persona. */
  pantryMax: 9,
  /** Pausa entre dos platos (evita dobles clics y cocinar en ráfaga). */
  cookCooldownMs: 2000,
  /** Puntos por cocinar al día por persona (además del tope de LEISURE, que comparte con el huerto). */
  pointsDailyCap: 24,
  /** Margen de la energía para el servidor: la última posición que manda el cliente puede llegar tarde. */
  speedGraceMs: 2000,
} as const;

/** Lo que tiene la despensa (ingrediente → cuántos). */
export type Pantry = Readonly<Record<string, number>>;

/** Lo que le falta a la despensa para la receta (ingrediente → cuántos faltan); vacío = se puede. */
export function missingFor(recipe: Recipe, pantry: Pantry): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [item, n] of Object.entries(recipe.needs)) {
    const lack = n - (pantry[item] ?? 0);
    if (lack > 0) out[item] = lack;
  }
  return out;
}

export const canCook = (recipe: Recipe, pantry: Pantry) => Object.keys(missingFor(recipe, pantry)).length === 0;

/** La despensa después de cocinar (sin los ingredientes de la receta). */
export function takeIngredients(recipe: Recipe, pantry: Pantry): Record<string, number> {
  const out: Record<string, number> = { ...pantry };
  for (const [item, n] of Object.entries(recipe.needs)) {
    const left = (out[item] ?? 0) - n;
    if (left > 0) out[item] = left;
    else delete out[item];
  }
  return out;
}

/** Cuánto más rápido se camina con la energía de un plato (1 = normal). */
export const dishSpeedMul = (dish: string): number => {
  const e = recipeById(dish)?.effect;
  return e?.kind === "speed" ? e.mul : 1;
};

/** Los platos se comen con F, como lo de la cafetería (se suma a CONSUMABLES). */
export const COCINA_CONSUMABLES: Record<string, { action: ConsumeAction; uses: number }> = Object.fromEntries(
  RECIPES.map((r) => [r.id, { action: r.action, uses: r.uses }]),
);
/** Nombre de cada plato en la mano (se suma a FREE_NAMES) y qué queda en ella (se suma a FREE_HOLDS). */
export const COCINA_NAMES: Record<string, string> = Object.fromEntries(RECIPES.map((r) => [r.id, r.name]));
export const COCINA_HOLDS: Record<string, readonly string[]> = Object.fromEntries(RECIPES.map((r) => [r.id, [r.id]]));

// ---------- Mensajes ----------

export const COCINA_MSG = {
  /** Cliente → servidor: pedir cómo está mi despensa (al abrir el panel). */
  open: "cocina:open",
  /** Cliente → servidor: guardar en la despensa lo que llevo en la mano (junto al cobertizo o la estufa). */
  store: "cocina:store",
  /** Cliente → servidor: cocinar una receta (junto a la estufa). */
  cook: "cocina:cook",
  /** Servidor → quien preguntó: la despensa y lo de hoy. */
  state: "cocina:state",
  /** Servidor → quien lo intentó: qué pasó (o por qué no se pudo). */
  notice: "cocina:notice",
} as const;

export const CookMessage = z.object({ recipe: z.enum(RECIPE_IDS) });
export type CookMessage = z.infer<typeof CookMessage>;

/** Servidor → cliente: la despensa, los puntos de cocina de hoy y cuánto le queda a la energía. */
export interface CocinaState {
  pantry: Pantry;
  pointsToday: number;
  /** Plato cuya energía está activa ("" = ninguna) y cuánto le queda (ms). */
  buff: string;
  buffLeftMs: number;
}

export const CocinaNoticeCode = z.enum(["far", "nothing", "notIngredient", "full", "stored", "missing", "hands", "busy", "cooked", "capped", "energy", "inBag", "bagFull", "level", "story", "have"]);
export type CocinaNoticeCode = z.infer<typeof CocinaNoticeCode>;

export interface CocinaNotice {
  code: CocinaNoticeCode;
  /** Ingrediente guardado, plato cocinado o que dio energía. */
  item?: string;
  /** Puntos que dio el plato. */
  points?: number;
}

/** Nombre corto de un ingrediente ("Tomate", "Frasco de miel"). */
export function ingredientName(item: string): string {
  if (item === HONEY) return "Miel";
  return CROPS.find((c) => c.product === item)?.productName ?? item;
}

export function cocinaNoticeText(n: CocinaNotice): string {
  const dish = n.item ? recipeById(n.item)?.name : undefined;
  switch (n.code) {
    case "far":
      return "Acércate a la estufa (o al cobertizo, para guardar lo cosechado).";
    case "nothing":
      return "No llevas nada en la mano para guardar.";
    case "notIngredient":
      return "En la despensa solo se guarda lo del huerto y la miel.";
    case "full":
      return `Ya no cabe más ${n.item ? ingredientName(n.item).toLowerCase() : "de eso"} en tu despensa.`;
    case "stored":
      return `${n.item ? ingredientName(n.item) : "Listo"}: guardado en tu despensa de la cocina.`;
    case "missing":
      return "Te faltan ingredientes en la despensa para esa receta.";
    case "level":
      return `${dish ?? "Esa receta"} se aprende con Cocina nivel ${(n.item && recipeById(n.item)?.requires?.level) || 6}.`;
    case "hands":
      return "Tienes las manos ocupadas con algo pagado: termínalo primero.";
    case "busy":
      return "Un momento, que la estufa todavía está caliente.";
    case "cooked":
      if (n.item && recipeById(n.item)?.story) return `${dish ?? "Eso"} está listo: quedó en tu mochila.`;
      return `${dish ?? "El plato"} está listo${n.points ? `: +${n.points} puntos` : ""}.`;
    case "capped":
      return `${dish ?? "El plato"} está listo (por hoy la cocina ya no da más puntos).`;
    case "energy":
      return `${dish ?? "Eso"} te dio energía: caminas más rápido un rato.`;
    case "inBag":
      return "Lo cosechado y la miel ya quedan en tu mochila: la cocina los toma de ahí.";
    case "bagFull":
      return "El plato no te cabe en la mochila: haz espacio primero.";
    case "story":
      return "Esa receta todavía no te la han enseñado.";
    case "have":
      return `Ya tienes ${dish ?? "eso"} en la mochila.`;
  }
}
