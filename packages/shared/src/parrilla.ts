// La parrilla y el horno de barro del jardín, junto al patio: se cocina con lo de la mochila (los huevos
// del gallinero, la harina del molino, lo del huerto y el queso y el chorizo que se traen de la
// cafetería). Cocinar tarda, con una barra sobre el horno, y va más rápido si hay más gente cocinando.
// El plato va a la mochila (y a la mano, si estaban libres) y se comparte por porciones: quien está
// cerca hace E y se lleva una. No repite nada de la cocina de la planta baja (cocina.ts): otras recetas,
// otros ids y otro lugar (el fuego de leña del jardín, con tiempo y en grupo).
// Las reglas las valida el servidor (apps/server/src/rooms/parrilla.ts); el cliente solo las muestra.
//
// Esta es también la lista de los objetos nuevos de la granja (`GRANJA_OBJECTS`), para la mochila.
import { z } from "zod";
import type { ConsumeAction } from "./consumables";
import { CHEESE, CHORIZO, CORN, EGG, FLOUR } from "./granja";
import { HUERTO_NAMES } from "./huerto";

/** Cómo se registra un objeto en la mochila (la forma de BagObject de bolsa.ts, sin importarla: sin ciclos). */
interface BagEntry {
  name: string;
  blurb?: string;
  kind: "comida" | "cosecha" | "objeto";
  max?: number;
}

export type GrillStation = "horno" | "parrilla";

export interface GrillRecipe {
  id: string;
  name: string;
  blurb: string;
  /** Dónde se hace: el horno de barro o la parrilla de ladrillo (ahí sale la barra de progreso). */
  station: GrillStation;
  /** Ingredientes de la mochila (id del objeto) y cuántos de cada uno. */
  needs: Readonly<Record<string, number>>;
  /** Lo que tarda una persona sola. */
  cookMs: number;
  /** Porciones (usos en la mano): se comen con F o se comparten. */
  portions: number;
  /** Puntos (LEISURE, con el tope diario) al sacarlo. */
  points: number;
}

const S = 1000;

export const GRILL_RECIPES: readonly GrillRecipe[] = [
  {
    id: "mazorca-asada",
    name: "Mazorca asada",
    blurb: "Directo a la brasa, con mantequilla y sal. Lo más sencillo del huerto.",
    station: "parrilla",
    needs: { [CORN]: 1 },
    cookMs: 30 * S,
    portions: 3,
    points: 3,
  },
  {
    id: "arepa-asada",
    name: "Arepa asada con queso",
    blurb: "Masa de la harina del molino, a la parrilla y rellena de queso campesino.",
    station: "parrilla",
    needs: { [FLOUR]: 2, [CHEESE]: 1 },
    cookMs: 40 * S,
    portions: 4,
    points: 4,
  },
  {
    id: "chorizo-asado",
    name: "Chorizo con papa criolla",
    blurb: "Chorizo santarrosano a la brasa y papas criollas del huerto.",
    station: "parrilla",
    needs: { [CHORIZO]: 1, papa: 1 },
    cookMs: 45 * S,
    portions: 3,
    points: 4,
  },
  {
    id: "pan-bono-horno",
    name: "Pandebono de horno",
    blurb: "Harina, queso y huevo criollo: salen doraditos del horno de barro.",
    station: "horno",
    needs: { [FLOUR]: 1, [CHEESE]: 1, [EGG]: 1 },
    cookMs: 55 * S,
    portions: 4,
    points: 5,
  },
  {
    id: "pizza-horno",
    name: "Pizza al horno de barro",
    blurb: "Masa de harina y huevo, tomate del huerto y queso. Para toda la mesa.",
    station: "horno",
    needs: { [FLOUR]: 2, [EGG]: 1, tomate: 1, [CHEESE]: 1 },
    cookMs: 75 * S,
    portions: 6,
    points: 7,
  },
];

const RECIPE_BY_ID = new Map(GRILL_RECIPES.map((r) => [r.id, r]));
export const grillRecipe = (id: string): GrillRecipe | undefined => RECIPE_BY_ID.get(id);
export const isGrillDish = (item: string) => RECIPE_BY_ID.has(item);
export const GRILL_RECIPE_IDS = GRILL_RECIPES.map((r) => r.id) as [string, ...string[]];

/** Una porción de un plato de la parrilla (lo que se lleva quien pide): dos mordiscos. */
export const portionOf = (dish: string) => `porcion-${dish}`;
export const dishOfPortion = (item: string): string | undefined =>
  item.startsWith("porcion-") && isGrillDish(item.slice(8)) ? item.slice(8) : undefined;

/** Lo que se trae de la cafetería (se paga con puntos y va a la mochila). */
export const PANTRY_SHOP: readonly { id: string; name: string; price: number; blurb: string }[] = [
  { id: CHEESE, name: "Queso campesino", price: 3, blurb: "Para las arepas, el pandebono y la pizza." },
  { id: CHORIZO, name: "Chorizo santarrosano", price: 4, blurb: "Para la parrilla, con papa criolla." },
];
export const pantryItem = (id: string) => PANTRY_SHOP.find((p) => p.id === id);

export const PARRILLA = {
  /** Cuánto más rápido va con cada persona más cocinando a la vez (y con cuántas deja de subir). */
  boostPerCook: 0.5,
  maxCooks: 3,
  /** Bono de puntos si se cocinó con alguien más al lado. */
  togetherBonus: 2,
  /** Al terminar, el plato queda en la mano (si estaban libres) si sigue a esta distancia del horno (tiles). */
  handReachTiles: 5,
  /** Desde dónde se pide una porción (tiles, pies a pies). */
  shareReachTiles: 1.8,
  /** Pausa entre dos porciones que pide la misma persona. */
  shareCooldownMs: 2_000,
  /** Puntos para quien comparte (LEISURE, con el tope diario). */
  sharePoints: 1,
  /** Pausa entre dos cosas del panel (cocinar, guardar, traer). */
  actionCooldownMs: 700,
  /** Cuánto se trae de una vez de la cafetería (tope por pedido). */
  buyMax: 5,
} as const;

/** Qué tan rápido avanza cada plato con `cooks` personas cocinando a la vez (1 = una sola). */
export const grillRate = (cooks: number) => 1 + PARRILLA.boostPerCook * (Math.min(Math.max(1, cooks), PARRILLA.maxCooks) - 1);

/** Lo que va cocinado (0 a 1): `progress` hasta `at`, y desde ahí a ritmo `rate`. Lo mismo en servidor y cliente. */
export function grillProgress(job: { progress: number; rate: number; at: number; cookMs: number }, now: number): number {
  if (job.cookMs <= 0) return 1;
  return Math.min(1, job.progress + (Math.max(0, now - job.at) * job.rate) / job.cookMs);
}

/** Lo que le falta a la mochila para la receta (ingrediente → cuántos faltan); vacío = se puede. */
export function grillMissing(recipe: GrillRecipe, pantry: Readonly<Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [item, n] of Object.entries(recipe.needs)) {
    const lack = n - (pantry[item] ?? 0);
    if (lack > 0) out[item] = lack;
  }
  return out;
}

// ---------- En la mano ----------

/** Los platos y las porciones se comen con F (se suma a CONSUMABLES). */
export const PARRILLA_CONSUMABLES: Record<string, { action: ConsumeAction; uses: number }> = Object.fromEntries(
  GRILL_RECIPES.flatMap((r) => [
    [r.id, { action: "bite" as const, uses: r.portions }],
    [portionOf(r.id), { action: "bite" as const, uses: 2 }],
  ]),
);

/** Nombre de cada plato y porción en la mano (se suma a FREE_NAMES). */
export const PARRILLA_NAMES: Record<string, string> = Object.fromEntries(
  GRILL_RECIPES.flatMap((r) => [
    [r.id, r.name],
    [portionOf(r.id), `Porción de ${r.name.charAt(0).toLowerCase()}${r.name.slice(1)}`],
  ]),
);

/** Qué queda en la mano (una sola parte): se suma a FREE_HOLDS. */
export const PARRILLA_HOLDS: Record<string, readonly string[]> = Object.fromEntries(Object.keys(PARRILLA_NAMES).map((id) => [id, [id]]));

// ---------- Objetos de la mochila ----------

export type GranjaObjectKind = "ingrediente" | "plato";

/**
 * Los objetos nuevos de la granja que van a la mochila (`InventoryItem.itemId = "obj:<id>"`), con su
 * nombre. Lo del huerto que también se usa (la mazorca, el tomate…) tiene su nombre en HUERTO_NAMES.
 */
export const GRANJA_OBJECTS: readonly { id: string; name: string; kind: GranjaObjectKind }[] = [
  { id: EGG, name: "Huevo criollo", kind: "ingrediente" },
  { id: FLOUR, name: "Harina de maíz", kind: "ingrediente" },
  { id: CHEESE, name: "Queso campesino", kind: "ingrediente" },
  { id: CHORIZO, name: "Chorizo santarrosano", kind: "ingrediente" },
  ...GRILL_RECIPES.map((r) => ({ id: r.id, name: r.name, kind: "plato" as const })),
];

const INGREDIENT_BLURB: Record<string, string> = {
  [EGG]: "Del nido del gallinero. Para el pandebono y la pizza.",
  [FLOUR]: "Molida en el molino del arroyo. Para arepas, pandebono y pizza.",
  [CHEESE]: "Traído de la cafetería. Para arepas, pandebono y pizza.",
  [CHORIZO]: "Traído de la cafetería. Para la parrilla.",
};

/** Las entradas de la granja en la mochila (se suman a BAG_OBJECTS de bolsa.ts). */
export const GRANJA_BAG_OBJECTS: Record<string, BagEntry> = {
  ...Object.fromEntries(
    GRANJA_OBJECTS.filter((o) => o.kind === "ingrediente").map((o) => [o.id, { name: o.name, blurb: INGREDIENT_BLURB[o.id], kind: "cosecha" as const, max: 30 }]),
  ),
  ...Object.fromEntries(
    GRILL_RECIPES.flatMap((r) => [
      [r.id, { name: r.name, blurb: `${r.blurb} ${r.portions} porciones: compártelas con E.`, kind: "comida" as const }],
      [portionOf(r.id), { name: PARRILLA_NAMES[portionOf(r.id)]!, blurb: "Una porción que te compartieron en la parrilla.", kind: "comida" as const }],
    ]),
  ),
};

/** Nombre de un objeto de la granja o de lo del huerto que se guarda ("Huevo criollo", "Mazorca"). */
export function granjaObjectName(id: string): string {
  return GRANJA_OBJECTS.find((o) => o.id === id)?.name ?? HUERTO_NAMES[id] ?? id;
}

// ---------- Mensajes ----------

export const PARRILLA_MSG = {
  /** Cliente → servidor: pedir la despensa (al abrir el panel). */
  open: "parrilla:open",
  /** Servidor → quien preguntó: lo que hay en la mochila para cocinar y lo que está cocinando. */
  state: "parrilla:state",
  /** Cliente → servidor: cocinar una receta (junto al horno o la parrilla). */
  cook: "parrilla:cook",
  /** Cliente → servidor: traer queso o chorizo de la cafetería (se paga con puntos). */
  buy: "parrilla:buy",
  /** Cliente → servidor: pedir una porción del plato que lleva otra persona. */
  portion: "parrilla:portion",
  /** Servidor → los del nivel: alguien le dio una porción a otro. */
  shared: "parrilla:shared",
  /** Servidor → quien lo intentó: qué pasó (o por qué no se pudo). */
  notice: "parrilla:notice",
} as const;

export const GrillCookMessage = z.object({ recipe: z.enum(GRILL_RECIPE_IDS) });
export type GrillCookMessage = z.infer<typeof GrillCookMessage>;
export const GrillBuyMessage = z.object({ item: z.enum([CHEESE, CHORIZO]), quantity: z.number().int().min(1).max(PARRILLA.buyMax) });
export type GrillBuyMessage = z.infer<typeof GrillBuyMessage>;
export const PortionMessage = z.object({ sessionId: z.string().min(1).max(64) });
export type PortionMessage = z.infer<typeof PortionMessage>;

/** Servidor → cliente: lo de la mochila que sirve en la parrilla y si estoy cocinando algo. */
export interface GrillState {
  pantry: Record<string, number>;
  /** Receta que estoy cocinando ("" = nada). */
  cooking: string;
}

/** Servidor → los del nivel: `from` le dio una porción de `dish` a `to` (sessionIds). */
export interface PortionShared {
  from: string;
  to: string;
  dish: string;
}

export const GrillNoticeCode = z.enum([
  "far",
  "busy",
  "missing",
  "cooking",
  "done",
  "doneBag",
  "bought",
  "funds",
  "noPortion",
  "gotPortion",
  "gavePortion",
  "bagFull",
  "failed",
]);
export type GrillNoticeCode = z.infer<typeof GrillNoticeCode>;

export interface GrillNotice {
  code: GrillNoticeCode;
  /** Receta, ingrediente o plato. */
  item?: string;
  points?: number;
  count?: number;
  /** Con quién (la porción). */
  name?: string;
}

export function grillNoticeText(n: GrillNotice): string {
  const dish = n.item ? (grillRecipe(n.item)?.name ?? granjaObjectName(n.item)) : "El plato";
  const low = dish.charAt(0).toLowerCase() + dish.slice(1);
  switch (n.code) {
    case "far":
      return "Acércate al horno de barro o a la parrilla.";
    case "busy":
      return "Ya tienes algo en el fuego: espera a que salga.";
    case "missing":
      return "Te faltan ingredientes en la mochila para esa receta.";
    case "cooking":
      return `Al fuego: ${low}. Si alguien más cocina al lado, sale más rápido.`;
    case "done":
      return `¡Listo! Salió del fuego: ${low}${n.points ? ` (+${n.points} puntos)` : ""}. Mientras lo tengas en la mano, quien esté cerca te puede pedir una porción con E.`;
    case "doneBag":
      return `Salió del fuego mientras no estabas: ${low}. Quedó en tu mochila${n.points ? ` (+${n.points} puntos)` : ""}.`;
    case "bought":
      return `Compraste en la cafetería: ${low} (${n.count ?? 1}).`;
    case "funds":
      return "No te alcanzan los puntos para eso.";
    case "noPortion":
      return "Ese plato ya no tiene porciones para compartir.";
    case "gotPortion":
      return `${n.name ?? "Alguien"} te dio una porción de ${low}.`;
    case "gavePortion":
      return `Le diste una porción de ${low} a ${n.name ?? "alguien"}${n.points ? `: +${n.points}` : ""}.`;
    case "bagFull":
      return "No te cabe en la mochila: haz espacio primero.";
    case "failed":
      return "No se pudo. Intenta de nuevo en un momento.";
  }
}
