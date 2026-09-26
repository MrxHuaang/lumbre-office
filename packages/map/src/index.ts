import { prop, type TiledMap, type TiledObjectLayer, type TiledTileLayer } from "./tiled";

export * from "./tiled";
export * from "./pathfinding";

/** Capas de tiles cuyos tiles con `collides=true` bloquean el paso. */
export const COLLISION_LAYERS = ["walls", "furniture"] as const;

export type ZoneType = "office" | "meeting" | "lab" | "lounge";
export type PointType = "spawn" | "seat" | "agent_desk" | "visitor_spot" | "task_board";

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

export interface OfficeMap {
  width: number;
  height: number;
  tileSize: number;
  /** 1 = bloqueado, indexado como `ty * width + tx`. */
  blocked: Uint8Array;
  zones: Zone[];
  points: MapPoint[];
}

/** Caja de colisión de los pies del avatar, relativa a su posición (x, y = pies). */
export const FEET_BOX = { halfWidth: 7, top: -6, bottom: 0 } as const;

export function parseOfficeMap(tmj: TiledMap): OfficeMap {
  const tileSize = tmj.tilewidth;
  const colliding = new Set<number>();
  for (const ts of tmj.tilesets) {
    for (const t of ts.tiles ?? []) {
      if (prop<boolean>(t.properties, "collides")) colliding.add(ts.firstgid + t.id);
    }
  }

  const blocked = new Uint8Array(tmj.width * tmj.height);
  for (const layer of tmj.layers) {
    if (layer.type !== "tilelayer") continue;
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

  return { width: tmj.width, height: tmj.height, tileSize, blocked, zones, points };
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

export function pointsOfType(map: OfficeMap, type: PointType): MapPoint[] {
  return map.points.filter((p) => p.type === type);
}

export function spawnPoint(map: OfficeMap): MapPoint {
  const spawn = map.points.find((p) => p.type === "spawn");
  if (!spawn) throw new Error("El mapa no tiene un punto 'spawn'");
  return spawn;
}
