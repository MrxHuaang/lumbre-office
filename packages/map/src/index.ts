import { AREAS, SPAWN_AREA } from "./world/areas";
import { catalogItem } from "./world/catalog";
import type { AreaDef } from "./world/types";
import { applyWorldEdits, type WorldEdits } from "./worldEdits";
import { applyFestivalDecor, festivalDecorAreas, festivalDecorOf } from "./festival-decor";
import {
  buildArea,
  FEET_BOX,
  isBlockedTile,
  wallAbove,
  wallLeftOf,
  type OfficeMap,
  type PlacedFurniture,
  type PointType,
  type Portal,
  type Seat,
  type Zone,
} from "./world/build";

export * from "./pathfinding";
export * from "./decor";
export * from "./worldEdits";
export * from "./festival-decor";
export { LABERINTO, LABERINTO_ENTRADA, PUMPKIN_SPOTS, pumpkinSpotOf, type PumpkinSpot } from "./world/festivales/brujas";
export * from "./casa";
export * from "./casa-propia";
export * from "./mundo";
export * from "./footsteps";
export * from "./agua";
export * from "./lago";
export * from "./radar";
export * from "./viaje";
export * from "./velitas";
export * from "./world/build";
export * from "./world/catalog";
export { GRADAS, GRADAS_ROWS } from "./world/catalog-escenario";
export * from "./world/seats";
export { SPA, TUB_WATER_Z } from "./world/catalog-tina";
export { NOVENAS_PIEZAS, type NovenaPieza } from "./world/festivales/novenas";
export type * from "./world/types";
export { BUS_DOOR_X, BUS_ROUTE, BUS_STOP, CURB_DROP, ROAD, STATION } from "./world/areas/parada";
export { CASA_CONEXIONES } from "./world/areas/casa-propia-conexiones";
export { casaPropiaDefs } from "./world/areas/casa-propia";
export { FIESTAS as CASA_SALA_FIESTAS } from "./world/areas/casa-propia-abajo";
export { AREAS, BLACKJACK_SEATS, BOARD_TABLES, CONEXIONES, GRANJA_LAYOUT, OFFICE_COUNT, SPAWN_AREA } from "./world/areas";

/** Todos los niveles de la cabaña, ya construidos. */
export interface World {
  areas: Map<string, OfficeMap>;
  spawnArea: string;
}

let world: World | undefined;
export function getWorld(): World {
  world ??= { areas: new Map(AREAS.map((a) => [a.id, buildArea(a)])), spawnArea: SPAWN_AREA };
  return world;
}

/** Definición de un nivel tal como está en el código (sin los cambios del editor de la casa). */
export function planDef(areaId: string): AreaDef | undefined {
  return AREAS.find((a) => a.id === areaId);
}

/** Los cambios del editor de la casa de cada nivel y el festival decorado (con su día), para rearmar. */
const editsOf = new Map<string, WorldEdits>();
let fiesta: { id: string; day: number } | null = null;

/** Rearma un nivel del mundo: el plano, los cambios del editor y la decoración del festival encima. */
function rebuildWorldArea(areaId: string): OfficeMap | undefined {
  const def = planDef(areaId);
  if (!def) return undefined;
  const edited = applyWorldEdits(def, editsOf.get(areaId));
  const map = buildArea(applyFestivalDecor(edited, fiesta && festivalDecorOf(fiesta.id, edited, fiesta.day)));
  getWorld().areas.set(areaId, map);
  return map;
}

/**
 * Aplica los cambios del editor de la casa a un nivel del mundo: desde ahí `getWorld()` lo devuelve con
 * esos muebles (y la decoración de las oficinas se arma encima). Devuelve el nivel nuevo.
 */
export function setWorldEdits(areaId: string, edits: WorldEdits): OfficeMap | undefined {
  if (!planDef(areaId)) return undefined;
  editsOf.set(areaId, edits);
  return rebuildWorldArea(areaId);
}

/**
 * Prende la decoración de un festival (el de ese día del juego) o la apaga con null: rearma los niveles que
 * cambian y devuelve cuáles son (vacío si ya estaba así), para que el servidor y la escena los rearmen.
 */
export function setFestivalDecor(id: string | null, day = 0): string[] {
  const next = id && festivalDecorAreas(id).length ? { id, day } : null;
  if (next?.id === fiesta?.id && next?.day === fiesta?.day) return [];
  const areas = [...new Set([...festivalDecorAreas(fiesta?.id), ...festivalDecorAreas(next?.id)])];
  fiesta = next;
  for (const a of areas) rebuildWorldArea(a);
  return areas;
}

/** El festival cuya decoración está puesta (y su día), o null. */
export const festivalDecorNow = (): { id: string; day: number } | null => fiesta && { ...fiesta };

/** Todas las zonas de todos los niveles (sus ids son únicos en toda la cabaña). */
export function allZones(w: World = getWorld()): Zone[] {
  return [...w.areas.values()].flatMap((a) => a.zones);
}

/** Distancia máxima (en tiles) desde la que uno puede sentarse o a la que se levanta. */
export const SEAT_REACH_TILES = 1.5;
/** Distancia máxima (en tiles) al centro de un portal para usarlo. */
export const PORTAL_REACH_TILES = 1.25;
/** Distancia (en tiles) a la que se usa un objeto interactivo (buzón, tablón, barra de la cafetería). */
export const INTERACT_REACH_TILES = 1.4;

export function isBlockedPx(map: OfficeMap, px: number, py: number): boolean {
  return isBlockedTile(map, Math.floor(px / map.tileSize), Math.floor(py / map.tileSize));
}

/**
 * ¿Puede un avatar pararse con los pies en (x, y)? La caja de los pies no puede tocar tiles
 * bloqueados ni quedar partida por una pared (las paredes son bordes delgados entre tiles).
 */
export function canStandAt(map: OfficeMap, x: number, y: number): boolean {
  const { halfWidth, top, bottom } = FEET_BOX;
  const ts = map.tileSize;
  const x0 = x - halfWidth;
  const x1 = x + halfWidth;
  const y0 = y + top;
  const y1 = y + bottom - 1;
  if (isBlockedPx(map, x0, y0) || isBlockedPx(map, x1, y0) || isBlockedPx(map, x0, y1) || isBlockedPx(map, x1, y1)) {
    return false;
  }
  const tx0 = Math.floor(x0 / ts);
  const tx1 = Math.floor(x1 / ts);
  const ty0 = Math.floor(y0 / ts);
  const ty1 = Math.floor(y1 / ts);
  if (tx0 !== tx1) for (let ty = ty0; ty <= ty1; ty++) if (wallLeftOf(map, tx1, ty)) return false;
  if (ty0 !== ty1) for (let tx = tx0; tx <= tx1; tx++) if (wallAbove(map, tx, ty1)) return false;
  return true;
}

/**
 * ¿Se puede caminar en línea recta de A a B? Revisa puntos intermedios más cerca que el ancho de
 * los pies, así nadie "salta" una pared delgada entre dos posiciones enviadas.
 */
export function canWalkBetween(map: OfficeMap, ax: number, ay: number, bx: number, by: number): boolean {
  const dist = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(dist / 4));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (!canStandAt(map, ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
  }
  return true;
}

/**
 * Como `canWalkBetween`, pero también acepta el camino en "L" (primero x y luego y, o al revés). El
 * cliente mueve cada eje por separado, así que en diagonal por un marco de puerta o la esquina de un
 * mueble esquiva la esquina que la recta sí cortaría: el servidor no debe rechazar ese paso.
 */
export function canWalkBetweenAxes(map: OfficeMap, ax: number, ay: number, bx: number, by: number): boolean {
  return (
    canWalkBetween(map, ax, ay, bx, by) ||
    (canWalkBetween(map, ax, ay, bx, ay) && canWalkBetween(map, bx, ay, bx, by)) ||
    (canWalkBetween(map, ax, ay, ax, by) && canWalkBetween(map, ax, by, bx, by))
  );
}

/** Zona que contiene el punto; si hay solapamiento gana la más pequeña. */
export function zoneAt(map: OfficeMap, px: number, py: number): Zone | undefined {
  let best: Zone | undefined;
  for (const z of map.zones) {
    if (px >= z.x && px < z.x + z.width && py >= z.y && py < z.y + z.height) {
      if (!best || z.width * z.height < best.width * best.height) best = z;
    }
  }
  return best;
}

/** Zonas "cerradas": tienen puerta y se muestran como lugar propio. */
const CLOSED_TYPES = new Set(["office", "meeting", "table"]);

/**
 * Lugar "humano" de un punto, para mostrar dónde está alguien:
 * - el id de la zona cerrada (oficina, sala, mesa) que lo contiene;
 * - `door:<zoneId>` si está parado en el tile de la puerta de una zona cerrada;
 * - la zona abierta que lo contiene, o "" si no hay ninguna.
 * No afecta el aislamiento de audio/chat: eso depende solo de `zoneAt`.
 */
export function placeAt(map: OfficeMap, x: number, y: number): string {
  const zone = zoneAt(map, x, y);
  if (zone && CLOSED_TYPES.has(zone.type)) return zone.id;
  const ts = map.tileSize;
  const tx = Math.floor(x / ts);
  const ty = Math.floor(y / ts);
  const doorway = map.zones.find((z) => z.door && Math.floor(z.door.x / ts) === tx && Math.floor(z.door.y / ts) === ty);
  if (doorway) return `door:${doorway.id}`;
  return zone?.id ?? "";
}

/** Texto para un lugar devuelto por `placeAt`. */
export function placeLabel(place: string, zoneName: (id: string) => string | undefined): string {
  if (!place) return "Pasillo";
  if (place.startsWith("door:")) return `Entrada · ${zoneName(place.slice(5)) ?? "sala"}`;
  return zoneName(place) ?? "Pasillo";
}

/** Punto frente a la puerta de una zona cerrada (o su centro si no tiene puerta). */
export function officeDoor(zone: Zone): { x: number; y: number } {
  return zone.door ?? { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 };
}

/** Centro de una zona, en tiles (para "ir a mi oficina"). */
export function zoneCenterTile(map: OfficeMap, zone: Zone): { x: number; y: number } {
  const cx = Math.floor((zone.x + zone.width / 2) / map.tileSize);
  const cy = Math.floor((zone.y + zone.height / 2) / map.tileSize);
  return { x: cx, y: cy };
}

export function seatAtTile(map: OfficeMap, tx: number, ty: number): Seat | undefined {
  return map.seats.get(ty * map.width + tx);
}

/** Asiento cuya posición de sentado es exactamente (x, y) (con medio píxel de tolerancia). */
export function seatAtPoint(map: OfficeMap, x: number, y: number): Seat | undefined {
  const seat = seatAtTile(map, Math.floor(x / map.tileSize), Math.floor(y / map.tileSize));
  return seat && Math.abs(seat.x - x) <= 0.5 && Math.abs(seat.y - y) <= 0.5 ? seat : undefined;
}

export function pointsOfType(map: OfficeMap, type: string) {
  return map.points.filter((p) => p.type === type);
}

/** ¿Está (x, y) al alcance de algún punto de ese tipo (la barra, el buzón)? */
export function nearPointOfType(map: OfficeMap, type: PointType, x: number, y: number): boolean {
  const reach = INTERACT_REACH_TILES * map.tileSize;
  return pointsOfType(map, type).some((p) => Math.hypot(p.x - x, p.y - y) <= reach);
}

// ---------- Teléfonos de escritorio ----------
// Desde dónde se puede llamar: lo usan el servidor (valida la llamada) y el cliente (la "E" y el botón
// del teléfono), así los dos dicen lo mismo.

/** Hasta dónde (en tiles, al borde del mueble) se alcanza el teléfono: sentado en la silla del escritorio llega. */
export const PHONE_REACH_TILES = 1.3;

export const isPhone = (type: string) => catalogItem(type).phone === true;

/**
 * El teléfono al alcance de alguien parado (o sentado) en (x, y), o undefined. Se mide al borde de lo que
 * ocupa el teléfono; el de una oficina no se alcanza desde afuera (la pared está en medio aunque quede
 * cerca: el pasillo pasa pegado a los escritorios de las oficinas de abajo) ni al revés.
 */
export function phoneInReach(map: OfficeMap, x: number, y: number): PlacedFurniture | undefined {
  const ts = map.tileSize;
  const here = zoneAt(map, x, y);
  let best: { f: PlacedFurniture; d: number } | undefined;
  for (const f of map.furniture) {
    if (!isPhone(f.type)) continue;
    const dx = Math.max(f.x * ts - x, 0, x - (f.x + f.w) * ts);
    const dy = Math.max(f.y * ts - y, 0, y - (f.y + f.d) * ts);
    const d = Math.hypot(dx, dy);
    if (d > PHONE_REACH_TILES * ts || (best && best.d <= d)) continue;
    const there = zoneAt(map, (f.x + f.w / 2) * ts, (f.y + f.d / 2) * ts);
    if ((here?.type === "office" || there?.type === "office") && here?.id !== there?.id) continue;
    best = { f, d };
  }
  return best?.f;
}

export function spawnPoint(map: OfficeMap) {
  const spawn = map.points.find((p) => p.type === "spawn");
  if (!spawn) throw new Error(`El nivel ${map.id} no tiene un punto 'spawn'`);
  return spawn;
}

/** Portal cuyo tile es (tx, ty). */
export function portalAtTile(map: OfficeMap, tx: number, ty: number): Portal | undefined {
  return map.portals.find((p) => p.tiles.some((t) => t.x === tx && t.y === ty));
}

/** ¿Está (x, y) lo bastante cerca de algún tile del portal para usarlo? */
export function nearPortal(map: OfficeMap, portal: Portal, x: number, y: number): boolean {
  const ts = map.tileSize;
  return portal.tiles.some((t) => Math.hypot(t.x * ts + ts / 2 - x, t.y * ts + ts / 2 - y) <= ts * PORTAL_REACH_TILES);
}
export * from "./encargos";
