import { nearestFreeTile } from "./pathfinding";
import { AREAS, SPAWN_AREA } from "./world/areas";
import { buildArea, step, type OfficeMap, type PointType, type Portal, type Seat, type Zone } from "./world/build";
import type { Facing } from "./world/types";

export * from "./pathfinding";
export * from "./world/build";
export * from "./world/catalog";
export type * from "./world/types";
export { AREAS, OFFICE_COUNT, SPAWN_AREA } from "./world/areas";

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

/** Caja de colisión de los pies del avatar, centrada en su posición (x, y = pies). */
export const FEET_BOX = { halfWidth: 6, top: -6, bottom: 7 } as const;

export function isBlockedTile(map: OfficeMap, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return true;
  return map.blocked[ty * map.width + tx] === 1;
}

export function isBlockedPx(map: OfficeMap, px: number, py: number): boolean {
  return isBlockedTile(map, Math.floor(px / map.tileSize), Math.floor(py / map.tileSize));
}

/** Pared en el borde superior del tile (x, y). */
export function wallAbove(map: OfficeMap, x: number, y: number): number {
  if (x < 0 || x >= map.width || y < 0 || y > map.height) return 0;
  return map.wallH[y * map.width + x]!;
}

/** Pared en el borde izquierdo del tile (x, y). */
export function wallLeftOf(map: OfficeMap, x: number, y: number): number {
  if (y < 0 || y >= map.height || x < 0 || x > map.width) return 0;
  return map.wallV[y * (map.width + 1) + x]!;
}

/** ¿Hay pared entre dos tiles vecinos (ortogonales)? */
export function wallBetween(map: OfficeMap, ax: number, ay: number, bx: number, by: number): boolean {
  if (ax === bx) return wallAbove(map, ax, Math.max(ay, by)) !== 0;
  return wallLeftOf(map, Math.max(ax, bx), ay) !== 0;
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

const OPPOSITE: Record<Facing, Facing> = { up: "down", down: "up", left: "right", right: "left" };
const SIDES: Record<Facing, [Facing, Facing]> = {
  up: ["left", "right"],
  down: ["left", "right"],
  left: ["up", "down"],
  right: ["up", "down"],
};

/**
 * Dónde queda de pie quien se levanta: detrás del asiento (las sillas miran a la mesa), a los
 * lados o adelante; el primer tile libre sin pared de por medio.
 */
export function seatStandSpot(map: OfficeMap, seat: Seat): { x: number; y: number } {
  const ts = map.tileSize;
  const order: Facing[] = [OPPOSITE[seat.facing], ...SIDES[seat.facing], seat.facing];
  for (const dir of order) {
    const [nx, ny] = step(seat.tileX, seat.tileY, dir);
    if (!isBlockedTile(map, nx, ny) && !wallBetween(map, seat.tileX, seat.tileY, nx, ny)) {
      return { x: nx * ts + ts / 2, y: ny * ts + ts / 2 };
    }
  }
  const tile = nearestFreeTile(map, { x: seat.tileX, y: seat.tileY });
  return tile ? { x: tile.x * ts + ts / 2, y: tile.y * ts + ts / 2 } : { x: seat.x, y: seat.y };
}

export function pointsOfType(map: OfficeMap, type: string) {
  return map.points.filter((p) => p.type === type);
}

/** ¿Está (x, y) al alcance de algún punto de ese tipo (la barra, el buzón)? */
export function nearPointOfType(map: OfficeMap, type: PointType, x: number, y: number): boolean {
  const reach = INTERACT_REACH_TILES * map.tileSize;
  return pointsOfType(map, type).some((p) => Math.hypot(p.x - x, p.y - y) <= reach);
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
