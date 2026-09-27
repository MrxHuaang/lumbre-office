// Fase 3c: la decoración de las oficinas. Rearma un nivel con los muebles que puso cada dueña o dueño y
// valida cada cambio. Es código puro: el servidor lo usa para decidir y el cliente para anticipar (el
// fantasma verde o rojo del editor), así los dos dicen lo mismo.
import { OFFICE_FLOORS, OFFICE_WALLPAPERS, type OfficeItemDTO } from "@hyvento/shared";
import { findPath, type TilePos } from "./pathfinding";
import { buildArea, FEET_BOX, seatStandSpot, step, TILE_SIZE, wallBetween, type OfficeMap } from "./world/build";
import { CATALOG, catalogItem, footprint, localToWorld, type CatalogItem } from "./world/catalog";
import type { AreaDef, Facing, FloorKind, Placement, Rect, WallpaperKind, ZoneDef } from "./world/types";

/**
 * Decoración de una oficina, como la guarda la base. Los muebles guardados van en coordenadas
 * **relativas a la oficina** (0,0 = su esquina), así un rediseño del nivel que mueva la oficina no corre
 * la decoración de nadie. Adentro de este módulo todo se calcula en tiles del nivel: se convierte al leer
 * (`toLevel`) y al devolver lo que se guarda (`toStored`).
 */
export interface OfficeDecor {
  /** Muebles puestos por la dueña o dueño; `null` = no la ha decorado y quedan los del mapa. */
  items: OfficeItemDTO[] | null;
  /** Piso y papel tapiz elegidos (null o ausente = los del mapa). */
  floor?: string | null;
  wallpaper?: string | null;
}

/** Decoración de las oficinas de un nivel, por id de zona. */
export type AreaDecor = Record<string, OfficeDecor | undefined>;

/** Mueble de una oficina tal como está: los fijos (el escritorio con PC y su silla) no se mueven. */
export interface OfficeFurniture extends OfficeItemDTO {
  fixed: boolean;
}

/**
 * Ids de los muebles del mapa de una oficina sin decorar (el servidor los copia a la base con ids
 * propios la primera vez que se edita) y de los fijos, que no se guardan.
 */
export const MAP_ITEM_PREFIX = "map-";
export const FIXED_ITEM_PREFIX = "fijo-";

export type DecorEdit =
  | { action: "place"; type: string; x: number; y: number; facing: Facing }
  | { action: "move"; itemId: string; x: number; y: number; facing: Facing }
  | { action: "remove"; itemId: string };

/** Por qué no se puede (mismos nombres que `OfficeEditError` de @hyvento/shared). */
export type DecorProblem = "outside" | "blocked" | "door" | "occupied" | "fixed" | "unknown";

export interface DecorContext {
  /** Nivel sin decorar (la definición del mapa). */
  def: AreaDef;
  /** Decoración actual de las oficinas del nivel. */
  decor: AreaDecor;
  zoneId: string;
  /** Posición de los pies (px de mundo) de quienes están en el nivel. */
  people?: readonly { x: number; y: number }[];
}

export type DecorEditResult = { ok: true; items: OfficeItemDTO[] } | { ok: false; error: DecorProblem };

// Tipados con los del mapa: si en @hyvento/shared se agrega un nombre que no es un piso o papel de
// verdad, no compila (en vez de dibujarse como otra cosa).
const OFFICE_FLOOR_KINDS: readonly FloorKind[] = OFFICE_FLOORS;
const OFFICE_WALLPAPER_KINDS: readonly WallpaperKind[] = OFFICE_WALLPAPERS;
const FLOORS: readonly string[] = OFFICE_FLOOR_KINDS;
const WALLPAPERS: readonly string[] = OFFICE_WALLPAPER_KINDS;

const inRect = (r: Rect, x: number, y: number) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

/** Mueble guardado (relativo a la oficina) → tiles del nivel. */
const toLevel = (zone: ZoneDef, item: OfficeItemDTO): OfficeItemDTO => ({ ...item, x: item.x + zone.rect.x, y: item.y + zone.rect.y });
/** Tiles del nivel → como se guarda (relativo a la oficina). */
const toStored = (zone: ZoneDef, item: OfficeItemDTO): OfficeItemDTO => ({ ...item, x: item.x - zone.rect.x, y: item.y - zone.rect.y });

/** La zona de oficina `zoneId` del nivel (o undefined). */
export function officeZoneDef(def: AreaDef, zoneId: string): ZoneDef | undefined {
  return def.zones.find((z) => z.id === zoneId && z.type === "office");
}

/** ¿Se puede poner este tipo con el editor? (del catálogo, que rote y que no sea un escritorio con PC ni un teléfono). */
export function isPlaceable(type: string): boolean {
  // Solo claves propias: "constructor" o "toString" vienen del prototipo y no son muebles.
  if (!Object.hasOwn(CATALOG, type)) return false;
  const item = (CATALOG as Record<string, CatalogItem>)[type]!;
  return !item.fixed && !item.computer && !item.phone;
}

/** Tiles que ocupa un mueble en el nivel. */
export function furnitureTiles(p: { type: string; x: number; y: number; facing?: Facing }): TilePos[] {
  const [w, d] = footprint(catalogItem(p.type), p.facing ?? "right");
  const tiles: TilePos[] = [];
  for (let y = p.y; y < p.y + d; y++) for (let x = p.x; x < p.x + w; x++) tiles.push({ x, y });
  return tiles;
}

/** Tiles que pisa la caja de los pies de alguien parado en (x, y). */
export function feetTiles(x: number, y: number, ts = TILE_SIZE): TilePos[] {
  const tiles: TilePos[] = [];
  const x0 = Math.floor((x - FEET_BOX.halfWidth) / ts);
  const x1 = Math.floor((x + FEET_BOX.halfWidth) / ts);
  const y0 = Math.floor((y + FEET_BOX.top) / ts);
  const y1 = Math.floor((y + FEET_BOX.bottom - 1) / ts);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) tiles.push({ x: tx, y: ty });
  return tiles;
}

/** Un mueble guardado sigue siendo válido (la base puede traer algo viejo: se ignora en vez de romper el nivel). */
function validItem(zone: ZoneDef, item: OfficeItemDTO): boolean {
  if (!isPlaceable(item.type) || !["right", "left", "down", "up"].includes(item.facing)) return false;
  return furnitureTiles(item).every((t) => inRect(zone.rect, t.x, t.y));
}

/** Para cada mueble de la lista: ¿es fijo? (escritorio con PC, su teléfono, o asiento que mira a uno). */
function fixedFlags(list: readonly Placement[]): boolean[] {
  const computers = new Set<string>();
  for (const p of list) {
    if (!catalogItem(p.type).computer) continue;
    for (const t of furnitureTiles(p)) computers.add(`${t.x},${t.y}`);
  }
  return list.map((p) => {
    const item = catalogItem(p.type);
    // El teléfono va encima del escritorio: si se pudiera mover quedaría flotando o en el piso.
    if (item.computer || item.phone) return true;
    const facing = p.facing ?? "right";
    return (item.seats ?? []).some(([lx, ly]) => {
      const [dx, dy] = localToWorld(item, facing, lx, ly);
      const [ax, ay] = step(p.x + dx, p.y + dy, facing);
      return computers.has(`${ax},${ay}`);
    });
  });
}

/** Muebles del mapa que caen en la oficina (por su esquina). */
function mapFurnitureIn(def: AreaDef, zone: ZoneDef): Placement[] {
  return def.furniture.filter((p) => inRect(zone.rect, p.x, p.y));
}

/**
 * Muebles de una oficina: los fijos del mapa (ids "fijo-N") y, según esté decorada o no, los que puso
 * la dueña o dueño o los del mapa (ids "map-N").
 */
export function officeFurniture(def: AreaDef, zoneId: string, decor?: OfficeDecor): OfficeFurniture[] {
  const zone = officeZoneDef(def, zoneId);
  if (!zone) return [];
  const own = mapFurnitureIn(def, zone);
  const fixed = fixedFlags(own);
  const out: OfficeFurniture[] = [];
  let nf = 0;
  let nm = 0;
  own.forEach((p, i) => {
    const base = { type: p.type, x: p.x, y: p.y, facing: p.facing ?? "right" };
    if (fixed[i]) out.push({ ...base, id: `${FIXED_ITEM_PREFIX}${nf++}`, fixed: true });
    else if (!decor?.items) out.push({ ...base, id: `${MAP_ITEM_PREFIX}${nm++}`, fixed: false });
  });
  for (const stored of decor?.items ?? []) {
    const item = toLevel(zone, stored);
    if (validItem(zone, item)) out.push({ ...item, fixed: false });
  }
  return out;
}

/**
 * Muebles del mapa que se pueden mover en una oficina sin decorar (los que se copian a la base), ya
 * en coordenadas relativas a la oficina.
 */
export function defaultOfficeItems(def: AreaDef, zoneId: string): OfficeItemDTO[] {
  const zone = officeZoneDef(def, zoneId);
  if (!zone) return [];
  return officeFurniture(def, zoneId)
    .filter((f) => !f.fixed)
    .map(({ fixed: _fixed, ...item }) => toStored(zone, item));
}

/** La definición del nivel con la decoración aplicada (sin decoración devuelve la misma). */
export function decorateAreaDef(def: AreaDef, decor: AreaDecor): AreaDef {
  const offices = def.zones.filter((z) => z.type === "office" && decor[z.id]);
  if (offices.length === 0) return def;

  const rooms = def.rooms.map((r) => {
    const d = decor[r.id];
    if (!d || !officeZoneDef(def, r.id)) return r;
    const floor = d.floor && FLOORS.includes(d.floor) ? (d.floor as FloorKind) : r.floor;
    const wallpaper = d.wallpaper && WALLPAPERS.includes(d.wallpaper) ? (d.wallpaper as WallpaperKind) : r.wallpaper;
    return floor === r.floor && wallpaper === r.wallpaper ? r : { ...r, floor, wallpaper };
  });

  // En las oficinas decoradas se sacan los muebles del mapa (menos los fijos) y van los guardados.
  const drop = new Set<Placement>();
  const added: Placement[] = [];
  for (const zone of offices) {
    const items = decor[zone.id]!.items;
    if (!items) continue;
    const own = mapFurnitureIn(def, zone);
    const fixed = fixedFlags(own);
    own.forEach((p, i) => !fixed[i] && drop.add(p));
    for (const stored of items) {
      const item = toLevel(zone, stored);
      if (validItem(zone, item)) added.push({ type: item.type, x: item.x, y: item.y, facing: item.facing });
    }
  }
  const furniture = drop.size || added.length ? [...def.furniture.filter((p) => !drop.has(p)), ...added] : def.furniture;
  return { ...def, rooms, furniture };
}

/** Arma el nivel (colisión, asientos, muebles y pisos) con la decoración de cada oficina. */
export function decorateArea(def: AreaDef, decor: AreaDecor): OfficeMap {
  return buildArea(decorateAreaDef(def, decor));
}

/** Tile de adentro de la oficina junto a la puerta (la puerta de la zona es el tile de afuera). */
export function officeDoorTiles(zone: ZoneDef): { outside: TilePos; inside: TilePos } | null {
  if (!zone.door) return null;
  const outside = { x: zone.door.x, y: zone.door.y };
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const inside = { x: outside.x + dx, y: outside.y + dy };
    if (inRect(zone.rect, inside.x, inside.y)) return { outside, inside };
  }
  return null;
}

/** ¿Se llega desde la puerta hasta el lugar para pararse junto a cada silla fija del PC? */
function reachesComputer(map: OfficeMap, zone: ZoneDef, furniture: readonly OfficeFurniture[], door: TilePos): boolean {
  const ts = map.tileSize;
  for (const f of furniture) {
    const item = catalogItem(f.type);
    if (!f.fixed || !item.seats) continue;
    for (const [lx, ly] of item.seats) {
      const [dx, dy] = localToWorld(item, f.facing, lx, ly);
      const seat = map.seats.get((f.y + dy) * map.width + f.x + dx);
      if (!seat) continue;
      // Tiene que ser un tile pegado a la silla: si no, no alcanza para sentarse (SEAT_REACH_TILES).
      const spot = seatStandSpot(map, seat);
      const tile = { x: Math.floor(spot.x / ts), y: Math.floor(spot.y / ts) };
      if (Math.abs(tile.x - seat.tileX) + Math.abs(tile.y - seat.tileY) !== 1 || !inRect(zone.rect, tile.x, tile.y)) return false;
      if (!findPath(map, door, tile)) return false;
    }
  }
  return true;
}

/**
 * Valida un cambio en la decoración de una oficina y devuelve cómo quedan sus muebles (sin los fijos),
 * listos para guardar (relativos a la oficina). El cambio (`edit`) viene en tiles del nivel.
 * Reglas: dentro de la oficina; sin encimarse con otros muebles (una alfombra sí puede ir debajo de un
 * mueble, pero no sobre otra alfombra) ni cruzar paredes; lo sólido no tapa el tile de la puerta, deja
 * camino desde la puerta hasta el escritorio con PC, no encierra a nadie y no cae sobre alguien (ni se
 * mueve o quita con alguien sentado). El escritorio con PC y su silla no se tocan.
 * `newId` es el id que llevará un mueble recién puesto.
 */
export function applyDecorEdit(ctx: DecorContext, edit: DecorEdit, newId = "nuevo"): DecorEditResult {
  const zone = officeZoneDef(ctx.def, ctx.zoneId);
  if (!zone) return { ok: false, error: "unknown" };
  const r = applyInLevel(ctx, zone, edit, newId);
  return r.ok ? { ok: true, items: r.items.map((i) => toStored(zone, i)) } : r;
}

/**
 * Un cambio en tiles del nivel, pasado a como se guarda (relativo a la oficina): lo que recibe el
 * repositorio, que aplica el cambio por su cuenta.
 */
export function storedEdit(def: AreaDef, zoneId: string, edit: DecorEdit): DecorEdit {
  const zone = officeZoneDef(def, zoneId);
  if (!zone || edit.action === "remove") return edit;
  return { ...edit, x: edit.x - zone.rect.x, y: edit.y - zone.rect.y };
}

/** `applyDecorEdit` en tiles del nivel (lo que devuelve también está en tiles del nivel). */
function applyInLevel(ctx: DecorContext, zone: ZoneDef, edit: DecorEdit, newId: string): DecorEditResult {
  const fail = (error: DecorProblem): DecorEditResult => ({ ok: false, error });
  const current = ctx.decor[ctx.zoneId];
  const all = officeFurniture(ctx.def, ctx.zoneId, current);
  const movable: OfficeItemDTO[] = all.filter((f) => !f.fixed).map(({ fixed: _fixed, ...item }) => item);

  let target: OfficeFurniture | undefined;
  if (edit.action !== "place") {
    target = all.find((f) => f.id === edit.itemId);
    if (!target) return fail("unknown");
    if (target.fixed) return fail("fixed");
  }
  const type = edit.action === "place" ? edit.type : target!.type;
  if (!isPlaceable(type)) return fail("unknown");

  const ts = TILE_SIZE;
  const people = ctx.people ?? [];
  const occupiedTiles = new Set(people.flatMap((p) => feetTiles(p.x, p.y, ts)).map((t) => `${t.x},${t.y}`));
  const withItems = (items: OfficeItemDTO[]): AreaDecor => ({ ...ctx.decor, [ctx.zoneId]: { ...current, items: items.map((i) => toStored(zone, i)) } });

  // Lo sólido con alguien encima (sentado en la silla) no se mueve ni se quita.
  if (target && catalogItem(target.type).solid !== false && furnitureTiles(target).some((t) => occupiedTiles.has(`${t.x},${t.y}`))) {
    return fail("occupied");
  }
  if (edit.action === "remove") return { ok: true, items: movable.filter((f) => f.id !== target!.id) };

  const candidate: OfficeItemDTO = { id: target?.id ?? newId, type, x: edit.x, y: edit.y, facing: edit.facing };
  const item = catalogItem(type);
  const solid = item.solid !== false;
  const flat = item.flat === true;
  const tiles = furnitureTiles(candidate);
  if (!tiles.every((t) => inRect(zone.rect, t.x, t.y))) return fail("outside");

  // Contra el nivel sin este mueble: que no cruce paredes ni se encime con otro de su misma capa.
  const rest = movable.filter((f) => f.id !== candidate.id);
  const without = decorateArea(ctx.def, withItems(rest));
  const mine = new Set(tiles.map((t) => `${t.x},${t.y}`));
  for (const t of tiles) {
    if (mine.has(`${t.x + 1},${t.y}`) && wallBetween(without, t.x, t.y, t.x + 1, t.y)) return fail("blocked");
    if (mine.has(`${t.x},${t.y + 1}`) && wallBetween(without, t.x, t.y, t.x, t.y + 1)) return fail("blocked");
  }
  for (const f of without.furniture) {
    if ((catalogItem(f.type).flat === true) !== flat) continue;
    if (tiles.some((t) => t.x >= f.x && t.x < f.x + f.w && t.y >= f.y && t.y < f.y + f.d)) return fail("blocked");
  }

  const items = target ? movable.map((f) => (f.id === target.id ? candidate : f)) : [...movable, candidate];
  if (!solid) return { ok: true, items };

  const door = officeDoorTiles(zone);
  if (door && mine.has(`${door.inside.x},${door.inside.y}`)) return fail("door");
  if (tiles.some((t) => occupiedTiles.has(`${t.x},${t.y}`))) return fail("occupied");

  const after = decorateArea(ctx.def, withItems(items));
  if (door) {
    if (!reachesComputer(after, zone, all, door.outside)) return fail("door");
    // Quien esté adentro tiene que poder salir.
    for (const p of people) {
      const start = { x: Math.floor(p.x / ts), y: Math.floor(p.y / ts) };
      if (inRect(zone.rect, start.x, start.y) && !findPath(after, start, door.outside)) return fail("door");
    }
  }
  return { ok: true, items };
}
