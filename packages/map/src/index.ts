import { nearestFreeTile } from "./pathfinding";
import { prop, type TiledMap, type TiledObjectLayer, type TiledTileLayer } from "./tiled";

export * from "./tiled";
export * from "./pathfinding";

/** Capas de tiles cuyos tiles con `collides=true` bloquean el paso. */
export const COLLISION_LAYERS = ["walls", "furniture"] as const;

export type ZoneType = "office" | "meeting" | "coworking" | "lounge";
export type PointType = "spawn" | "seat" | "task_board" | "screen";

export interface Zone {
  id: string;
  type: ZoneType;
  name: string;
  /** Rectángulo en píxeles. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Audio/chat aislado del exterior (oficinas y salas de reunión). */
  isolated: boolean;
  slot?: number;
}

export interface MapPoint {
  id: number;
  type: PointType;
  name: string;
  tileX: number;
  tileY: number;
  /** Centro del tile en píxeles. */
  x: number;
  y: number;
  /** Zona a la que pertenece (seats). */
  zone?: string;
  /** Referencia a otra entidad (visitor_spot → desk id). */
  ref?: string;
  index?: number;
}

/** Hacia dónde queda mirando quien se sienta (sillas y sofás miran a la mesa). */
export type SeatFacing = "up" | "down";

/** Un tile con la propiedad `seat` (silla o sofá). */
export interface Seat {
  tileX: number;
  tileY: number;
  /** Posición de los pies de quien está sentado, en px. */
  x: number;
  y: number;
  facing: SeatFacing;
  /** Frente a un escritorio con computador (se puede prender el PC). */
  computer: boolean;
}

export interface OfficeMap {
  width: number;
  height: number;
  tileSize: number;
  /** 1 = bloqueado, indexado como `ty * width + tx`. */
  blocked: Uint8Array;
  zones: Zone[];
  points: MapPoint[];
  /** Asientos por índice de tile (`ty * width + tx`). */
  seats: Map<number, Seat>;
}

/** Altura de los pies dentro del tile del asiento (la persona sentada queda sobre la silla). */
export const SEAT_FEET_Y = 24;
/** Distancia máxima (en tiles) desde la que uno puede sentarse o a la que se levanta. */
export const SEAT_REACH_TILES = 1.5;

/** Caja de colisión de los pies del avatar, relativa a su posición (x, y = pies). */
export const FEET_BOX = { halfWidth: 7, top: -6, bottom: 0 } as const;

export function parseOfficeMap(tmj: TiledMap): OfficeMap {
  const tileSize = tmj.tilewidth;
  const colliding = new Set<number>();
  const seatFacing = new Map<number, SeatFacing>();
  const computerGids = new Set<number>();
  for (const ts of tmj.tilesets) {
    for (const t of ts.tiles ?? []) {
      if (prop<boolean>(t.properties, "collides")) colliding.add(ts.firstgid + t.id);
      const seat = prop<string>(t.properties, "seat");
      if (seat === "up" || seat === "down") seatFacing.set(ts.firstgid + t.id, seat);
      if (prop<boolean>(t.properties, "computer")) computerGids.add(ts.firstgid + t.id);
    }
  }

  const blocked = new Uint8Array(tmj.width * tmj.height);
  const seats = new Map<number, Seat>();
  const computers = new Set<number>();
  for (const layer of tmj.layers) {
    if (layer.type !== "tilelayer") continue;
    (layer as TiledTileLayer).data.forEach((gid, i) => {
      if (computerGids.has(gid)) computers.add(i);
    });
  }
  for (const layer of tmj.layers) {
    if (layer.type !== "tilelayer") continue;
    (layer as TiledTileLayer).data.forEach((gid, i) => {
      const facing = seatFacing.get(gid);
      if (!facing) return;
      const tileX = i % tmj.width;
      const tileY = Math.floor(i / tmj.width);
      // Se usa el PC si la silla mira hacia un escritorio con computador justo arriba.
      const computer = facing === "up" && computers.has(i - tmj.width);
      seats.set(i, { tileX, tileY, x: tileX * tileSize + tileSize / 2, y: tileY * tileSize + SEAT_FEET_Y, facing, computer });
    });
    if (!(COLLISION_LAYERS as readonly string[]).includes(layer.name)) continue;
    (layer as TiledTileLayer).data.forEach((gid, i) => {
      if (colliding.has(gid)) blocked[i] = 1;
    });
  }

  const zonesLayer = findObjectLayer(tmj, "zones");
  const zones: Zone[] = (zonesLayer?.objects ?? []).map((o) => ({
    id: prop<string>(o.properties, "zoneId") ?? `${o.type}-${o.id}`,
    type: o.type as ZoneType,
    name: o.name,
    x: o.x,
    y: o.y,
    width: o.width,
    height: o.height,
    isolated: prop<boolean>(o.properties, "isolated") ?? (o.type === "office" || o.type === "meeting"),
    slot: prop<number>(o.properties, "slot"),
  }));

  const pointsLayer = findObjectLayer(tmj, "points");
  const points: MapPoint[] = (pointsLayer?.objects ?? []).map((o) => {
    const tileX = Math.floor(o.x / tileSize);
    const tileY = Math.floor(o.y / tileSize);
    return {
      id: o.id,
      type: o.type as PointType,
      name: o.name,
      tileX,
      tileY,
      x: tileX * tileSize + tileSize / 2,
      y: tileY * tileSize + tileSize / 2,
      zone: prop<string>(o.properties, "zone"),
      ref: prop<string>(o.properties, "ref"),
      index: prop<number>(o.properties, "index"),
    };
  });

  return { width: tmj.width, height: tmj.height, tileSize, blocked, zones, points, seats };
}

function findObjectLayer(tmj: TiledMap, name: string): TiledObjectLayer | undefined {
  return tmj.layers.find((l): l is TiledObjectLayer => l.type === "objectgroup" && l.name === name);
}

export function isBlockedTile(map: OfficeMap, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return true;
  return map.blocked[ty * map.width + tx] === 1;
}

export function isBlockedPx(map: OfficeMap, px: number, py: number): boolean {
  return isBlockedTile(map, Math.floor(px / map.tileSize), Math.floor(py / map.tileSize));
}

/** ¿Puede un avatar pararse con los pies en (x, y)? Revisa las esquinas de FEET_BOX. */
export function canStandAt(map: OfficeMap, x: number, y: number): boolean {
  const { halfWidth, top, bottom } = FEET_BOX;
  return (
    !isBlockedPx(map, x - halfWidth, y + top) &&
    !isBlockedPx(map, x + halfWidth, y + top) &&
    !isBlockedPx(map, x - halfWidth, y + bottom - 1) &&
    !isBlockedPx(map, x + halfWidth, y + bottom - 1)
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

const DOORWAY_PRIORITY: ZoneType[] = ["office", "meeting", "coworking"];

/**
 * Lugar "humano" de un punto, para mostrar dónde está alguien:
 * - el id de la zona cerrada (oficina, sala, coworking) que lo contiene;
 * - `door:<zoneId>` si está en el umbral de una puerta: fuera de toda zona cerrada pero pegado a una.
 *   Funciona porque las zonas cerradas están rodeadas de muro y solo sus puertas quedan contiguas;
 * - la zona abierta que lo contiene (zona común), o "" en un pasillo sin zona.
 * No afecta el aislamiento de audio/chat: eso depende solo de `zoneAt`.
 */
export function placeAt(map: OfficeMap, x: number, y: number): string {
  const zone = zoneAt(map, x, y);
  if (zone && DOORWAY_PRIORITY.includes(zone.type)) return zone.id;
  const doorway = doorwayAt(map, x, y);
  if (doorway) return `door:${doorway.id}`;
  return zone?.id ?? "";
}

function doorwayAt(map: OfficeMap, x: number, y: number): Zone | undefined {
  const ts = map.tileSize;
  const around = [
    zoneAt(map, x, y - ts),
    zoneAt(map, x, y + ts),
    zoneAt(map, x - ts, y),
    zoneAt(map, x + ts, y),
  ].filter((z): z is Zone => Boolean(z));
  for (const type of DOORWAY_PRIORITY) {
    const z = around.find((a) => a.type === type);
    if (z) return z;
  }
  return undefined;
}

/** Texto para un lugar devuelto por `placeAt`. */
export function placeLabel(place: string, zoneName: (id: string) => string | undefined): string {
  if (!place) return "Pasillo";
  if (place.startsWith("door:")) return `Entrada · ${zoneName(place.slice(5)) ?? "sala"}`;
  return zoneName(place) ?? "Pasillo";
}

/** Punto frente a la puerta de una oficina: centro del borde inferior, un tile hacia afuera. */
export function officeDoor(map: OfficeMap, zone: Zone): { x: number; y: number } {
  return { x: zone.x + zone.width / 2, y: zone.y + zone.height + map.tileSize / 2 };
}

/** Centro de una zona, ajustado a un tile libre (para "ir a mi oficina"). */
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

/**
 * Dónde queda de pie quien se levanta: en la misma silla si es transitable, o en el tile libre
 * hacia el que mira (frente al sofá).
 */
export function seatStandSpot(map: OfficeMap, seat: Seat): { x: number; y: number } {
  if (canStandAt(map, seat.x, seat.y)) return { x: seat.x, y: seat.y };
  const ts = map.tileSize;
  const ahead = { x: seat.tileX, y: seat.tileY + (seat.facing === "down" ? 1 : -1) };
  const tile = isBlockedTile(map, ahead.x, ahead.y) ? nearestFreeTile(map, { x: seat.tileX, y: seat.tileY }) : ahead;
  if (!tile) return { x: seat.x, y: seat.y };
  return { x: tile.x * ts + ts / 2, y: tile.y * ts + ts * 0.75 };
}

export function pointsOfType(map: OfficeMap, type: PointType): MapPoint[] {
  return map.points.filter((p) => p.type === type);
}

export function spawnPoint(map: OfficeMap): MapPoint {
  const spawn = map.points.find((p) => p.type === "spawn");
  if (!spawn) throw new Error("El mapa no tiene un punto 'spawn'");
  return spawn;
}
