// El editor de la casa (solo admins): quitar, mover, girar y agregar muebles en cualquier nivel, sin
// tocar el código. Los cambios se guardan como una diferencia sobre el plano (qué se quitó del plano y
// qué se agregó) y se aplican encima de él, así el plano puede seguir cambiando en el código. Es código
// puro: el servidor lo usa para decidir y el cliente para anticipar el fantasma verde o rojo.
import { feetTiles, furnitureTiles } from "./decor";
import { buildArea, TILE_SIZE, wallBetween, type OfficeMap } from "./world/build";
import { BLACKJACK_SEATS } from "./world/areas";
import { CATALOG, catalogItem, type CatalogItem } from "./world/catalog";
import type { AreaDef, Facing, Placement } from "./world/types";

/** Mueble agregado con el editor. */
export interface WorldItem {
  id: string;
  type: string;
  x: number;
  y: number;
  facing: Facing;
}

/** Cambios de un nivel: claves de muebles del plano que se quitaron y los agregados. */
export interface WorldEdits {
  removed: string[];
  added: WorldItem[];
}

export const EMPTY_EDITS: WorldEdits = { removed: [], added: [] };

/** Mueble tal como está en el nivel, con la clave que entiende el editor. */
export interface WorldFurniture {
  /** "plano:tipo@x,y" (del código) o "nuevo:id" (agregado con el editor). */
  key: string;
  type: string;
  x: number;
  y: number;
  facing: Facing;
  /** No se mueve ni se quita (escaleras, la casa). */
  fixed: boolean;
}

export type WorldEditOp =
  | { action: "place"; type: string; x: number; y: number; facing: Facing }
  | { action: "move"; key: string; x: number; y: number; facing: Facing }
  | { action: "remove"; key: string };

export type WorldEditProblem = "unknown" | "fixed" | "outside" | "blocked" | "portal" | "point" | "occupied" | "office";

export const WORLD_EDIT_ERRORS: Record<WorldEditProblem, string> = {
  unknown: "Ese mueble ya no está.",
  fixed: "Ese mueble no se mueve con el editor: el juego lo usa desde ahí (escaleras, mesas del casino, barras, mostradores…).",
  outside: "Tiene que quedar sobre el piso del nivel.",
  blocked: "Se encima con otro mueble o cruza una pared.",
  portal: "No puede tapar una puerta ni una escalera.",
  point: "No puede tapar el lugar desde donde se usa algo (una barra, una mesa, un buzón…).",
  occupied: "Hay alguien parado ahí.",
  office: "Las oficinas las decoran sus dueños.",
};

const planKey = (p: Placement) => `plano:${p.type}@${p.x},${p.y}`;

/**
 * Muebles "funcionales": el juego los usa desde puntos del mapa o posiciones fijas (la ruleta y sus
 * puntos, las banquetas del blackjack, las barras, el mostrador, el buzón…). Moverlos dejaría esos
 * puntos huérfanos, así que el editor no los mueve, no los quita ni agrega otros.
 */
export const LOCKED_TYPES: ReadonlySet<string> = new Set([
  "roulette-table",
  "roulette-wheel",
  "blackjack-table",
  "casino-cashier",
  "bar-counter",
  "bar-shelf",
  "bar-taps",
  "cigar-case",
  "counter",
  "counter-coffee",
  "pastry-case",
  "shop-counter",
  "fitting-booth",
  "mailbox",
  "notice-board",
  "photo-board",
  "dance-pole",
  "pole-stage",
  "dj-booth",
  "arcade-cabinet",
  "air-hockey",
  "projector",
  "popcorn-machine",
  "garden-plot",
  "greenhouse-bed",
  // Los fogones de la cocina: se cocina desde los puntos `kitchen_stove` de enfrente.
  "stove",
]);

/** ¿Es un mueble del plano que el editor no toca? (fijo del catálogo, funcional o banqueta del blackjack). */
function isLocked(p: Placement, lockedSpots: ReadonlySet<string>): boolean {
  const item = catalogItem(p.type);
  return Boolean(item.fixed) || LOCKED_TYPES.has(p.type) || lockedSpots.has(`${p.type}@${p.x},${p.y}`);
}

/** ¿Se puede poner este tipo con el editor? Del catálogo, que no sea fijo (escaleras, la casa) ni funcional. */
export function isWorldPlaceable(type: string): boolean {
  if (!Object.hasOwn(CATALOG, type)) return false;
  return !(CATALOG as Record<string, CatalogItem>)[type]!.fixed && !LOCKED_TYPES.has(type);
}

/** Banquetas del blackjack (tiles fijos que usa el servidor): no se tocan. */
const BLACKJACK_STOOLS = new Set(BLACKJACK_SEATS.map((s) => `stool@${s.x},${s.y}`));
const lockedSpotsOf = (def: AreaDef): ReadonlySet<string> => (def.id === "sotano" ? BLACKJACK_STOOLS : new Set());

/** Muebles del nivel con los cambios aplicados, con su clave. */
export function worldFurniture(def: AreaDef, edits: WorldEdits = EMPTY_EDITS): WorldFurniture[] {
  const removed = new Set(edits.removed);
  const spots = lockedSpotsOf(def);
  const out: WorldFurniture[] = [];
  for (const p of def.furniture) {
    const key = planKey(p);
    const fixed = isLocked(p, spots);
    // Un cambio guardado sobre un mueble funcional (de antes de bloquearlos) se ignora: vuelve a su lugar.
    if (removed.has(key) && !fixed) continue;
    out.push({ key, type: p.type, x: p.x, y: p.y, facing: p.facing ?? "right", fixed });
  }
  for (const a of edits.added) if (isWorldPlaceable(a.type)) out.push({ key: `nuevo:${a.id}`, type: a.type, x: a.x, y: a.y, facing: a.facing, fixed: false });
  return out;
}

/** La definición del nivel con los cambios del editor (sin cambios, la misma). */
export function applyWorldEdits(def: AreaDef, edits: WorldEdits | undefined): AreaDef {
  if (!edits || (edits.removed.length === 0 && edits.added.length === 0)) return def;
  const furniture: Placement[] = worldFurniture(def, edits).map(({ type, x, y, facing }) => ({ type, x, y, facing }));
  return { ...def, furniture };
}

export type WorldEditResult = { ok: true; edits: WorldEdits } | { ok: false; error: WorldEditProblem };

/**
 * Valida un cambio del editor y devuelve cómo quedan los cambios del nivel. Reglas: sobre el piso del
 * nivel (dentro de la zona jugable afuera), fuera de las oficinas, sin encimarse con otro mueble de su
 * misma capa (una alfombra sí va debajo de un mueble) ni cruzar paredes; lo sólido no tapa portales,
 * puntos de interacción ni a nadie. Las escaleras y la casa no se tocan.
 */
export function checkWorldEdit(
  def: AreaDef,
  edits: WorldEdits,
  op: WorldEditOp,
  people: readonly { x: number; y: number }[] = [],
  newId = "nuevo",
): WorldEditResult {
  const fail = (error: WorldEditProblem): WorldEditResult => ({ ok: false, error });
  const all = worldFurniture(def, edits);
  let target: WorldFurniture | undefined;
  if (op.action !== "place") {
    target = all.find((f) => f.key === op.key);
    if (!target) return fail("unknown");
    if (target.fixed) return fail("fixed");
  }
  const removeTarget = (e: WorldEdits): WorldEdits => {
    if (!target) return e;
    if (target.key.startsWith("plano:")) return { removed: [...e.removed, target.key], added: e.added };
    const id = target.key.slice("nuevo:".length);
    return { removed: e.removed, added: e.added.filter((a) => a.id !== id) };
  };
  const without = removeTarget(edits);
  if (op.action === "remove") return { ok: true, edits: without };

  const type = op.action === "place" ? op.type : target!.type;
  if (!isWorldPlaceable(type)) return fail("unknown");
  const item = catalogItem(type);
  const candidate = { type, x: op.x, y: op.y, facing: op.facing };
  const tiles = furnitureTiles(candidate);

  // Contra el nivel sin este mueble.
  const map = buildArea(applyWorldEdits(def, without));
  const W = map.width;
  const inPlay = (x: number, y: number) =>
    !def.playable || (x >= def.playable.x && y >= def.playable.y && x < def.playable.x + def.playable.w && y < def.playable.y + def.playable.h);
  for (const t of tiles) {
    if (t.x < 0 || t.y < 0 || t.x >= W || t.y >= map.height) return fail("outside");
    const floor = map.floors[t.y * W + t.x];
    if (!floor || floor === "water" || !inPlay(t.x, t.y)) return fail("outside");
    if (map.zones.some((z) => z.type === "office" && t.x * TILE_SIZE >= z.x && t.y * TILE_SIZE >= z.y && t.x * TILE_SIZE < z.x + z.width && t.y * TILE_SIZE < z.y + z.height))
      return fail("office");
  }
  const mine = new Set(tiles.map((t) => `${t.x},${t.y}`));
  for (const t of tiles) {
    if (mine.has(`${t.x + 1},${t.y}`) && wallBetween(map, t.x, t.y, t.x + 1, t.y)) return fail("blocked");
    if (mine.has(`${t.x},${t.y + 1}`) && wallBetween(map, t.x, t.y, t.x, t.y + 1)) return fail("blocked");
  }
  const flat = item.flat === true;
  for (const f of map.furniture) {
    if ((catalogItem(f.type).flat === true) !== flat) continue;
    if (tiles.some((t) => t.x >= f.x && t.x < f.x + f.w && t.y >= f.y && t.y < f.y + f.d)) return fail("blocked");
  }
  if (item.solid !== false) {
    if (tiles.some((t) => map.portals.some((p) => p.tiles.some((pt) => pt.x === t.x && pt.y === t.y)))) return fail("portal");
    if (map.points.some((p) => p.type !== "spawn" && mine.has(`${p.tileX},${p.tileY}`))) return fail("point");
    const occupied = new Set(people.flatMap((p) => feetTiles(p.x, p.y)).map((t) => `${t.x},${t.y}`));
    if (tiles.some((t) => occupied.has(`${t.x},${t.y}`))) return fail("occupied");
  }

  const id = target && target.key.startsWith("nuevo:") ? target.key.slice("nuevo:".length) : newId;
  return { ok: true, edits: { removed: without.removed, added: [...without.added, { id, ...candidate }] } };
}

/** Lee cambios guardados (JSON de la base) sin romperse si vienen mal. */
export function parseWorldEdits(raw: unknown): WorldEdits {
  const r = raw as Partial<WorldEdits> | null;
  const removed = Array.isArray(r?.removed) ? r!.removed.filter((k): k is string => typeof k === "string") : [];
  const added = Array.isArray(r?.added)
    ? r!.added.filter(
        (a): a is WorldItem =>
          !!a && typeof a.id === "string" && typeof a.type === "string" && Number.isInteger(a.x) && Number.isInteger(a.y) && ["right", "left", "down", "up"].includes(a.facing),
      )
    : [];
  return { removed, added };
}

/** Rearma un nivel del mundo con los cambios del editor (lo usan el servidor y el cliente). */
export function buildEditedArea(def: AreaDef, edits: WorldEdits | undefined): OfficeMap {
  return buildArea(applyWorldEdits(def, edits));
}
