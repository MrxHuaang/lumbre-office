// Jardín vivo: el huerto compartido (qué se siembra, cómo crece, qué da), las herramientas del
// cobertizo, la miel del apiario y la campanita de la glorieta. Lo usan el servidor (las reglas) y el
// cliente (qué dibujar y qué ofrecer con E). Todo se hace con E sobre los muebles (`MSG.furnitureUse`);
// solo el cobertizo tiene su panel (`HUERTO_MSG.shedTake`).
import { z } from "zod";
import type { ConsumeAction, UsableSpec } from "./consumables";
import { seasonGrowth, type Season } from "./estaciones";

// ---------- Cultivos ----------

export interface Crop {
  id: string;
  name: string;
  /** Lo que tarda en crecer con la tierra húmeda todo el tiempo (seca crece más despacio, ver HUERTO.dryRate). */
  growMs: number;
  /** Puntos (motivo LEISURE, con el tope diario) al cosecharlo. */
  points: number;
  /** Lo que queda en la mano al cosechar y cómo se llama. */
  product: string;
  productName: string;
  /**
   * Del invernadero: solo se siembra en sus bancales (afuera no se da) y allá adentro la tierra siempre
   * está húmeda, así que crece a ritmo completo sin regar.
   */
  indoor?: true;
  /**
   * Flor (la Feria de las flores, feria-flores.ts): no se come; se usa para armar silletas. Sus semillas no
   * salen del cobertizo: se compran en la feria.
   */
  flower?: true;
  /** Cuántas unidades da cada cosecha (si no, una): las flores salen de a ramito. */
  yield?: number;
}

const MIN = 60_000;

/** Lo que se siembra en el huerto: de lo más rápido a lo que más se hace esperar (y más da). */
export const CROPS: readonly Crop[] = [
  { id: "cilantro", name: "Cilantro", growMs: 8 * MIN, points: 2, product: "cilantro", productName: "Manojo de cilantro" },
  { id: "fresa", name: "Fresa", growMs: 20 * MIN, points: 3, product: "fresa", productName: "Fresas" },
  { id: "tomate", name: "Tomate", growMs: 35 * MIN, points: 4, product: "tomate", productName: "Tomate" },
  { id: "papa", name: "Papa criolla", growMs: 60 * MIN, points: 6, product: "papa", productName: "Papas criollas" },
  { id: "maiz", name: "Maíz", growMs: 90 * MIN, points: 8, product: "mazorca", productName: "Mazorca" },
  { id: "lulo", name: "Lulo", growMs: 150 * MIN, points: 10, product: "lulo", productName: "Lulo" },
  // Flores de la Feria de las flores: rápidas (caben en una feria) y de a ramito, para las silletas.
  { id: "clavel", name: "Clavel", growMs: 9 * MIN, points: 2, product: "clavel", productName: "Clavel", flower: true, yield: 3 },
  { id: "astromelia", name: "Astromelia", growMs: 12 * MIN, points: 3, product: "astromelia", productName: "Astromelia", flower: true, yield: 3 },
  { id: "girasol", name: "Girasol", growMs: 15 * MIN, points: 3, product: "girasol", productName: "Girasol", flower: true, yield: 3 },
  { id: "hortensia", name: "Hortensia", growMs: 20 * MIN, points: 4, product: "hortensia", productName: "Hortensia", flower: true, yield: 3 },
  // Invernadero: lo de tierra caliente, que en el frío del jardín no se da.
  { id: "uchuva", name: "Uchuva", growMs: 15 * MIN, points: 3, product: "uchuva", productName: "Uchuvas", indoor: true },
  { id: "pitahaya", name: "Pitahaya", growMs: 40 * MIN, points: 6, product: "pitahaya", productName: "Pitahaya", indoor: true },
  { id: "cacao", name: "Cacao", growMs: 70 * MIN, points: 9, product: "chocolatina", productName: "Chocolatina de la casa", indoor: true },
  { id: "cafe", name: "Café", growMs: 100 * MIN, points: 12, product: "cafe-casa", productName: "Tinto de la cosecha", indoor: true },
];

const CROP_BY_ID = new Map(CROPS.map((c) => [c.id, c]));
export const cropById = (id: string): Crop | undefined => CROP_BY_ID.get(id);

/** Las flores del huerto (para las silletas de la Feria de las flores). */
export const FLOWER_CROPS: readonly Crop[] = CROPS.filter((c) => c.flower);
/** ¿Lo cosechado es una flor? */
export const isFlowerProduct = (item: string) => FLOWER_CROPS.some((c) => c.product === item);

export const HUERTO = {
  /** Con la tierra seca crece a este ritmo (regar la deja al 100 %). */
  dryRate: 0.25,
  /** Cuánto dura húmeda la tierra al regar: la mitad del cultivo, entre estos topes. */
  wetShare: 0.5,
  wetMinMs: 10 * MIN,
  wetMaxMs: 45 * MIN,
  /** No se riega otra vez mientras le quede más de esta parte de la humedad (no se malgasta el agua). */
  rewaterShare: 0.5,
  /** Riegos que trae la regadera llena. */
  canUses: 5,
  /** Parcelas que siembra cada bolsa de semillas. */
  seedUses: 3,
  /** Parcelas sembradas a la vez por persona (que alcance para todos). */
  maxPlotsPerPerson: 5,
  /** Lo que ya está listo lo cosecha quien lo sembró; pasado este rato, cualquiera (para que no se pierda). */
  ownerHarvestMs: 60 * MIN,
  /** Miel: una vez cada tanto por persona (las abejas tardan en hacerla). */
  honeyCooldownMs: 4 * 60 * MIN,
  /** Pausa entre dos cosas del huerto (sembrar, regar, cosechar) de la misma persona. */
  plotCooldownMs: 700,
} as const;

/** Cuánto queda húmeda la tierra al regar ese cultivo. */
export const wetMsOf = (crop: Crop) => Math.min(HUERTO.wetMaxMs, Math.max(HUERTO.wetMinMs, crop.growMs * HUERTO.wetShare));

// ---------- Parcelas ----------

/** Una parcela sembrada, como la guarda el servidor (tiempos en ms de época). */
export interface PlotState {
  crop: string;
  /** userId de quien sembró y su nombre (para el aviso "esto lo sembró…"). */
  plantedBy: string;
  plantedByName: string;
  plantedAt: number;
  /** Crecimiento acumulado (ms "a ritmo de tierra húmeda") hasta `growthAt`. */
  growthMs: number;
  growthAt: number;
  /** Hasta cuándo está húmeda la tierra (0 = nunca se regó). */
  wateredUntil: number;
  /**
   * Bajo techo (el invernadero): la estación no la castiga (ver `seasonGrowth`). Sin el campo se deduce
   * del cultivo: lo `indoor` solo se siembra en los bancales. Así no hace falta guardarlo ni sincronizarlo.
   */
  greenhouse?: boolean;
  /**
   * La estación del juego en que arrancó el tramo (`growthAt`). La pone el servidor al sembrar, al regar
   * y al cambiar de estación (`reseasonPlot`); no se guarda en la base: al arrancar es la de ese momento,
   * que es la misma porque el reloj del juego no corre sin gente. Sin estación (o vacía), el ritmo es 1.
   */
  season?: Season | "";
}

/** ¿Está bajo techo? (el campo si lo trae; si no, los cultivos del invernadero). */
export const plotUnderRoof = (p: PlotState): boolean => p.greenhouse ?? Boolean(cropById(p.crop)?.indoor);

/**
 * Ritmo de la estación para la parcela: el de la estación en que arrancó el tramo (`growthAt`). Cada
 * riego abre un tramo nuevo y el cambio de estación también (`reseasonPlot`), así que la cuenta sigue
 * siendo exacta y la misma en el servidor y en el cliente.
 */
export const plotSeasonRate = (p: PlotState): number => (p.season ? seasonGrowth(p.crop, p.season, { greenhouse: plotUnderRoof(p) }) : 1);

/**
 * Crecimiento (ms) de la parcela en `now`: húmeda a ritmo 1 hasta `wateredUntil`, seca a `dryRate`, y
 * todo por el ritmo de la estación. En el invernadero la tierra siempre está húmeda (y la estación no
 * castiga).
 */
export function plotGrowth(p: PlotState, now: number): number {
  const crop = cropById(p.crop);
  if (!crop) return 0;
  const t = Math.max(now, p.growthAt);
  if (crop.indoor) return Math.min(crop.growMs, p.growthMs + (t - p.growthAt) * plotSeasonRate(p));
  const wetEnd = Math.min(t, Math.max(p.growthAt, p.wateredUntil));
  const wet = wetEnd - p.growthAt;
  const dry = t - wetEnd;
  return Math.min(crop.growMs, p.growthMs + (wet + dry * HUERTO.dryRate) * plotSeasonRate(p));
}

/** Qué tanto creció (0 a 1). */
export function plotProgress(p: PlotState, now: number): number {
  const crop = cropById(p.crop);
  return crop ? plotGrowth(p, now) / crop.growMs : 0;
}

/**
 * Cuándo queda lista si nadie la riega más. Es una cuenta exacta (no depende de cuándo se mire), así el
 * servidor sabe desde cuándo está lista sin tener que revisar las parcelas cada tanto.
 */
export function plotReadyAt(p: PlotState): number {
  const crop = cropById(p.crop);
  if (!crop) return Infinity;
  // Lo que falta, en tiempo "a ritmo de tierra húmeda" de esta estación.
  const need = (crop.growMs - p.growthMs) / plotSeasonRate(p);
  if (need <= 0) return p.growthAt;
  if (crop.indoor) return p.growthAt + need;
  const wetWindow = Math.max(0, p.wateredUntil - p.growthAt);
  if (need <= wetWindow) return p.growthAt + need;
  return p.growthAt + wetWindow + (need - wetWindow) / HUERTO.dryRate;
}

export const plotReady = (p: PlotState, now: number) => now >= plotReadyAt(p);
export const plotWet = (p: PlotState, now: number) => now < p.wateredUntil;

/** Las parcelas del invernadero (bancales) tienen ids desde aquí; las del huerto, 0..19. */
export const GREENHOUSE_PLOT_BASE = 100;
export const isGreenhousePlot = (id: number) => id >= GREENHOUSE_PLOT_BASE;

/** Etapa del dibujo: 0 recién sembrada, 1 brote, 2 creciendo, 3 lista para cosechar. */
export type PlotStage = 0 | 1 | 2 | 3;
export function plotStage(p: PlotState, now: number): PlotStage {
  if (plotReady(p, now)) return 3;
  const k = plotProgress(p, now);
  return k < 0.25 ? 0 : k < 0.6 ? 1 : 2;
}

/** Sembrar: la parcela arranca en cero, seca. */
export function plantPlot(crop: string, who: { userId: string; name: string }, now: number, season?: Season): PlotState {
  return { crop, plantedBy: who.userId, plantedByName: who.name, plantedAt: now, growthMs: 0, growthAt: now, wateredUntil: 0, ...(season && { season }) };
}

/** ¿Tiene sentido regar ahora? No si está lista o si todavía le queda buena parte de la humedad. */
export function canWater(p: PlotState, now: number): boolean {
  const crop = cropById(p.crop);
  // En el invernadero no hace falta regar.
  if (!crop || crop.indoor || plotReady(p, now)) return false;
  return p.wateredUntil - now <= wetMsOf(crop) * HUERTO.rewaterShare;
}

/** Regar: se guarda lo que creció hasta ahora y la tierra queda húmeda un rato (con la estación de ahora). */
export function waterPlot(p: PlotState, now: number, season: Season | "" | undefined = p.season): PlotState {
  const crop = cropById(p.crop)!;
  return { ...p, growthMs: plotGrowth(p, now), growthAt: now, wateredUntil: now + wetMsOf(crop), ...(season && { season }) };
}

/**
 * Cambió la estación del juego: lo que creció hasta ahora queda guardado con la de antes y desde acá
 * crece con la nueva (sin que la planta salte para atrás). Lo que ya está listo no se toca (no le corre la
 * hora en que quedó lista). Devuelve null si no hay nada que cambiar.
 */
export function reseasonPlot(p: PlotState, now: number, season: Season): PlotState | null {
  if (p.season === season || plotReady(p, now)) return null;
  return { ...p, growthMs: plotGrowth(p, now), growthAt: now, season };
}

/** ¿Puede cosecharla esta persona? Quien sembró, siempre; el resto, pasada la hora de gracia. */
export function canHarvest(p: PlotState, userId: string, now: number): boolean {
  if (!plotReady(p, now)) return false;
  return p.plantedBy === userId || now >= plotReadyAt(p) + HUERTO.ownerHarvestMs;
}

/** "12 min", "1 h 20 min": cuánto falta, para los avisos. */
export function durationText(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / MIN));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// ---------- Herramientas y lo que se cosecha (van en la mano) ----------

export const WATERING_CAN = "regadera";
export const EMPTY_CAN = "regadera-vacia";
export const HONEY = "miel";
const SEEDS_PREFIX = "semillas-";
export const seedsOf = (crop: string) => `${SEEDS_PREFIX}${crop}`;
/** El cultivo de una bolsa de semillas (o undefined si no es una). */
export const cropOfSeeds = (item: string): Crop | undefined => (item.startsWith(SEEDS_PREFIX) ? cropById(item.slice(SEEDS_PREFIX.length)) : undefined);

/**
 * Herramientas del huerto: no se consumen con F; sus usos los gasta el huerto (riegos, bolsas). La
 * regadera vacía tiene un "uso" solo para que se vea en la mano: se llena en el barril o el pozo.
 */
export const HUERTO_TOOLS: Record<string, { uses: number }> = {
  [WATERING_CAN]: { uses: HUERTO.canUses },
  [EMPTY_CAN]: { uses: 1 },
  ...Object.fromEntries(CROPS.map((c) => [seedsOf(c.id), { uses: HUERTO.seedUses }])),
};
export const isHuertoTool = (item: string) => Object.hasOwn(HUERTO_TOOLS, item);

/** Lo cosechado y la miel: se comen con F, como lo gratis de la casa (se suma a CONSUMABLES). */
export const HUERTO_CONSUMABLES: Record<string, { action: ConsumeAction; uses: number }> = {
  cilantro: { action: "bite", uses: 2 },
  fresa: { action: "bite", uses: 3 },
  tomate: { action: "bite", uses: 3 },
  papa: { action: "bite", uses: 3 },
  mazorca: { action: "bite", uses: 4 },
  lulo: { action: "bite", uses: 3 },
  uchuva: { action: "bite", uses: 3 },
  pitahaya: { action: "bite", uses: 4 },
  chocolatina: { action: "bite", uses: 3 },
  "cafe-casa": { action: "sip", uses: 3 },
  [HONEY]: { action: "spoon", uses: 3 },
};

/** Cómo se llama cada cosa del huerto que se lleva en la mano. */
export const HUERTO_NAMES: Record<string, string> = {
  [WATERING_CAN]: "Regadera",
  [EMPTY_CAN]: "Regadera vacía",
  [HONEY]: "Frasco de miel",
  ...Object.fromEntries(CROPS.map((c) => [seedsOf(c.id), `Semillas de ${c.name.toLowerCase()}`])),
  ...Object.fromEntries(CROPS.map((c) => [c.product, c.productName])),
};

/** Qué queda en la mano (una sola parte): se suma a FREE_HOLDS de casa.ts. */
export const HUERTO_HOLDS: Record<string, readonly string[]> = Object.fromEntries(Object.keys(HUERTO_NAMES).map((id) => [id, [id]]));

// ---------- Cobertizo ----------

/** Lo que se saca del cobertizo: la regadera (vacía) y una bolsa de semillas de cada cultivo (las flores, no: son de la feria). */
export const SHED_ITEMS: readonly string[] = [EMPTY_CAN, ...CROPS.filter((c) => !c.flower).map((c) => seedsOf(c.id))];

/** Cliente → servidor (`HUERTO_MSG.shedTake`): sacar algo del cobertizo (hay que estar junto a él). */
export const ShedTakeMessage = z.object({ item: z.string().min(1).max(40).refine((v) => SHED_ITEMS.includes(v)) });
export type ShedTakeMessage = z.infer<typeof ShedTakeMessage>;

// ---------- Muebles del jardín que se usan con E ----------

/**
 * - `plot`: la parcela (sembrar con semillas en la mano, regar con la regadera, cosechar si está lista);
 * - `fill`: llenar la regadera en el barril de agua o el pozo;
 * - `honey`: sacar miel de una colmena (una vez cada tanto; las abejas se alborotan);
 * - `ring`: tocar la campanita de la glorieta.
 */
export type JardinAction = "plot" | "fill" | "honey" | "ring";

/** Lo que pasó en una parcela (va en `FurnitureEvent.garden`; `item` dice el cultivo o lo cosechado). */
export type GardenStep = "plant" | "water" | "harvest";

const fill: UsableSpec = { action: "fill", label: "Llenar la regadera", cooldownMs: 1200, marker: false };

export const JARDIN_USABLES: Record<string, UsableSpec> = {
  // La ayuda de la parcela cambia según lo que tengas en la mano y cómo esté (ver el cliente).
  "garden-plot": { action: "plot", label: "Parcela del huerto", cooldownMs: HUERTO.plotCooldownMs, marker: false },
  // Los bancales del invernadero son parcelas más (con sus propios ids, ver GREENHOUSE_PLOT_BASE).
  "greenhouse-bed": { action: "plot", label: "Bancal del invernadero", cooldownMs: HUERTO.plotCooldownMs, marker: false },
  "water-barrel": fill,
  well: fill,
  beehive: { action: "honey", label: "Sacar miel", cooldownMs: 1500 },
  "gazebo-roof": { action: "ring", label: "Tocar la campanita", cooldownMs: 2600 },
};

// ---------- Avisos ----------

export const HUERTO_MSG = { shedTake: "huerto:shed", notice: "huerto:notice" } as const;

export const HuertoNoticeCode = z.enum(["seeds", "noCan", "emptyCan", "wet", "growing", "notYours", "tooMany", "honeyWait", "hands", "far", "indoor", "outdoor", "noWater", "inside", "full", "haveCan"]);
export type HuertoNoticeCode = z.infer<typeof HuertoNoticeCode>;

/** Servidor → quien lo intentó: por qué no se pudo (con cuánto falta o de quién es, si aplica). */
export interface HuertoNotice {
  code: HuertoNoticeCode;
  waitMs?: number;
  name?: string;
  crop?: string;
}

export function huertoNoticeText(n: HuertoNotice): string {
  const crop = n.crop ? cropById(n.crop)?.name.toLowerCase() : undefined;
  const wait = n.waitMs !== undefined ? durationText(n.waitMs) : "";
  switch (n.code) {
    case "seeds":
      return "La parcela está vacía: elige unas semillas en la barra (se sacan del cobertizo) para sembrar.";
    case "noCan":
      return "Para llenarla, elige en la barra la regadera del cobertizo.";
    case "emptyCan":
      return "La regadera está vacía: llénala en el barril de agua o en el pozo.";
    case "wet":
      return "La tierra todavía está húmeda: riégala más tarde.";
    case "growing":
      return `${crop ? `La mata de ${crop}` : "Lo sembrado"} todavía está creciendo${wait ? `: falta ${wait}` : ""}.`;
    case "notYours":
      return `Esto lo sembró ${n.name ?? "alguien más"}${wait ? `: si no viene, podrás cosecharlo en ${wait}` : ""}.`;
    case "tooMany":
      return `Ya tienes ${HUERTO.maxPlotsPerPerson} parcelas sembradas: deja algunas para los demás.`;
    case "honeyWait":
      return `Las abejas todavía están haciendo miel${wait ? `: vuelve en ${wait}` : ""}.`;
    case "hands":
      return "Tienes las manos ocupadas: termina primero lo que llevas.";
    case "far":
      return "Acércate un poco más.";
    case "inside":
      return "A los bancales se llega desde adentro: entra al invernadero por la puerta.";
    case "indoor":
      return `${(n.crop && cropById(n.crop)?.name) || "Eso"} no se da afuera: va en los bancales del invernadero.`;
    case "outdoor":
      return "En los bancales del invernadero va lo de tierra caliente (uchuva, pitahaya, cacao, café).";
    case "noWater":
      return "En el invernadero la tierra siempre está húmeda: no hace falta regar.";
    case "full":
      return "No te cabe en la mochila: haz espacio (tira algo o pon un mueble en tu oficina).";
    case "haveCan":
      return "Ya tienes una regadera en la mochila.";
  }
}
