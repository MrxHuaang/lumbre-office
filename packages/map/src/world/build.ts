import { nearestFreeTile } from "../pathfinding";
import { catalogItem, footprint, localToWorld } from "./catalog";
import type { AreaDef, Facing, FloorKind, Placement, PointDef, ZoneType } from "./types";

export const TILE_SIZE = 32;

export interface Zone {
  id: string;
  type: ZoneType;
  name: string;
  /** Rectángulo en píxeles de mundo. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Audio/chat aislado del exterior (oficinas, sala de reuniones, mesas). */
  isolated: boolean;
  slot?: number;
  /** Centro del tile justo afuera de la puerta, en px (oficinas y sala de reuniones). */
  door?: { x: number; y: number };
  /** Punto medio del borde de la puerta, en px (donde va la placa con el nombre). */
  doorEdge?: { x: number; y: number };
}

export type PointType = PointDef["type"];

export interface MapPoint {
  id: number;
  type: PointType;
  name: string;
  tileX: number;
  tileY: number;
  /** Centro del tile en píxeles. */
  x: number;
  y: number;
  zone?: string;
}

export interface Seat {
  tileX: number;
  tileY: number;
  /** Posición de quien está sentado (centro del tile), en px. */
  x: number;
  y: number;
  facing: Facing;
  /** Frente a un escritorio con computador (se puede prender el PC). */
  computer: boolean;
}

export interface Portal {
  id: string;
  label: string;
  tiles: { x: number; y: number }[];
  to: { area: string; x: number; y: number; facing: Facing };
}

/** Un mueble ya ubicado: los tiles que ocupa en el mundo. */
export interface PlacedFurniture extends Required<Placement> {
  w: number;
  d: number;
}

/** Pared de borde: 0 = nada, 1 = pared baja (interior o frente), 2 = pared alta (fondo del edificio). */
export type WallKind = 0 | 1 | 2;

export interface OfficeMap {
  /** Id del nivel ("jardin", "planta-baja", "piso-2"). */
  id: string;
  name: string;
  width: number;
  height: number;
  tileSize: number;
  outdoor: boolean;
  /** 1 = bloqueado, indexado como `ty * width + tx`. */
  blocked: Uint8Array;
  /** Pared en el borde superior del tile (x, y): índice `y * width + x`, con y en 0..height. */
  wallH: Uint8Array;
  /** Pared en el borde izquierdo del tile (x, y): índice `y * (width + 1) + x`, con x en 0..width. */
  wallV: Uint8Array;
  /** Piso de cada tile transitable (o null fuera del edificio). */
  floors: (FloorKind | null)[];
  zones: Zone[];
  points: MapPoint[];
  /** Asientos por índice de tile (`ty * width + tx`). */
  seats: Map<number, Seat>;
  portals: Portal[];
  furniture: PlacedFurniture[];
  def: AreaDef;
}

export function buildArea(def: AreaDef): OfficeMap {
  const { width, height } = def;
  const ts = TILE_SIZE;
  const idx = (x: number, y: number) => y * width + x;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;

  // Habitación de cada tile (-1 = fuera).
  const roomOf = new Int16Array(width * height).fill(-1);
  def.rooms.forEach((r, i) => {
    for (let y = r.rect.y; y < r.rect.y + r.rect.h; y++)
      for (let x = r.rect.x; x < r.rect.x + r.rect.w; x++) if (inside(x, y)) roomOf[idx(x, y)] = i;
  });
  const floors: (FloorKind | null)[] = Array.from({ length: width * height }, (_, i) => {
    const x = i % width;
    const y = Math.floor(i / width);
    if (def.outdoor) return def.ground?.(x, y) ?? "grass";
    const r = roomOf[i]!;
    return r >= 0 ? def.rooms[r]!.floor : null;
  });
  for (const t of def.thresholds ?? []) floors[idx(t.x, t.y)] = "doormat";

  // Paredes: todo borde entre una habitación y otra cosa, salvo las puertas.
  const wallH = new Uint8Array((height + 1) * width);
  const wallV = new Uint8Array(height * (width + 1));
  const doorH = new Set<number>();
  const doorV = new Set<number>();
  for (const d of def.doors)
    for (let k = 0; k < (d.width ?? 1); k++) {
      if (d.edge === "h") doorH.add((d.y) * width + d.x + k);
      else doorV.add((d.y + k) * (width + 1) + d.x);
    }
  const room = (x: number, y: number) => (inside(x, y) ? roomOf[idx(x, y)]! : -1);
  if (!def.outdoor) {
    for (let y = 0; y <= height; y++)
      for (let x = 0; x < width; x++) {
        const above = room(x, y - 1);
        const below = room(x, y);
        if (above === below || doorH.has(y * width + x)) continue;
        // Alta solo en el borde norte del edificio (nada arriba): ahí van ventanas y pantallas.
        wallH[y * width + x] = above === -1 && below >= 0 ? 2 : 1;
      }
    for (let y = 0; y < height; y++)
      for (let x = 0; x <= width; x++) {
        const left = room(x - 1, y);
        const right = room(x, y);
        if (left === right || doorV.has(y * (width + 1) + x)) continue;
        wallV[y * (width + 1) + x] = left === -1 && right >= 0 ? 2 : 1;
      }
  }

  // Colisión: fuera del edificio, el agua del estanque y muebles sólidos.
  const blocked = new Uint8Array(width * height);
  for (let i = 0; i < blocked.length; i++) if (floors[i] === null || floors[i] === "water") blocked[i] = 1;
  // Fuera de la zona jugable se dibuja pero no se camina (límite invisible).
  const play = def.playable;
  if (play)
    for (let i = 0; i < blocked.length; i++) {
      const x = i % width;
      const y = Math.floor(i / width);
      if (x < play.x || y < play.y || x >= play.x + play.w || y >= play.y + play.h) blocked[i] = 1;
    }

  const furniture: PlacedFurniture[] = [];
  const computers = new Set<number>();
  const seats = new Map<number, Seat>();
  for (const p of def.furniture) {
    const item = catalogItem(p.type);
    const facing = p.facing ?? "right";
    const [w, d] = footprint(item, facing);
    furniture.push({ type: p.type, x: p.x, y: p.y, facing, w, d });
    for (let y = p.y; y < p.y + d; y++)
      for (let x = p.x; x < p.x + w; x++) {
        if (!inside(x, y)) throw new Error(`${p.type} en (${p.x}, ${p.y}) se sale de ${def.id}`);
        if (item.solid !== false) blocked[idx(x, y)] = 1;
        if (item.computer) computers.add(idx(x, y));
      }
    for (const [lx, ly] of item.seats ?? []) {
      const [dx, dy] = localToWorld(item, facing, lx, ly);
      const tx = p.x + dx;
      const ty = p.y + dy;
      seats.set(idx(tx, ty), { tileX: tx, tileY: ty, x: tx * ts + ts / 2, y: ty * ts + ts / 2, facing, computer: false });
    }
  }
  // Una silla que mira a un escritorio con computador permite prender el PC.
  for (const seat of seats.values()) {
    const [ax, ay] = step(seat.tileX, seat.tileY, seat.facing);
    seat.computer = inside(ax, ay) && computers.has(idx(ax, ay));
  }

  const zones: Zone[] = def.zones.map((z) => ({
    id: z.id,
    type: z.type,
    name: z.name,
    x: z.rect.x * ts,
    y: z.rect.y * ts,
    width: z.rect.w * ts,
    height: z.rect.h * ts,
    isolated: z.isolated,
    slot: z.slot,
    door: z.door && { x: z.door.x * ts + ts / 2, y: z.door.y * ts + ts / 2 },
    doorEdge: z.door && doorEdgeOf(z.door, z.rect, ts),
  }));

  const points: MapPoint[] = def.points.map((p, i) => ({
    id: i + 1,
    type: p.type,
    name: p.name,
    tileX: p.x,
    tileY: p.y,
    x: p.x * ts + ts / 2,
    y: p.y * ts + ts / 2,
    zone: p.zone,
  }));

  for (const portal of def.portals)
    for (const t of portal.tiles) if (blocked[idx(t.x, t.y)]) throw new Error(`Portal ${portal.id} en un tile bloqueado`);

  return {
    id: def.id,
    name: def.name,
    width,
    height,
    tileSize: ts,
    outdoor: Boolean(def.outdoor),
    blocked,
    wallH,
    wallV,
    floors,
    zones,
    points,
    seats,
    portals: def.portals,
    furniture,
    def,
  };
}

/** Borde entre el tile de afuera de la puerta y el tile de adentro de la zona que toca. */
function doorEdgeOf(door: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }, ts: number) {
  const inside = (x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  if (inside(door.x - 1, door.y)) return { x: door.x * ts, y: door.y * ts + ts / 2 };
  if (inside(door.x + 1, door.y)) return { x: (door.x + 1) * ts, y: door.y * ts + ts / 2 };
  if (inside(door.x, door.y - 1)) return { x: door.x * ts + ts / 2, y: door.y * ts };
  return { x: door.x * ts + ts / 2, y: (door.y + 1) * ts };
}

/** Tile vecino en una dirección del mundo. */
export function step(x: number, y: number, facing: Facing): [number, number] {
  switch (facing) {
    case "right":
      return [x + 1, y];
    case "left":
      return [x - 1, y];
    case "down":
      return [x, y + 1];
    case "up":
      return [x, y - 1];
  }
}

// Consultas básicas sobre un nivel ya construido. Viven aquí (y no en index.ts) para que decor.ts las
// use sin importar index.ts, que lo reexporta: así no hay importaciones circulares.

/** Caja de colisión de los pies del avatar, centrada en su posición (x, y = pies). */
export const FEET_BOX = { halfWidth: 6, top: -6, bottom: 7 } as const;

export function isBlockedTile(map: OfficeMap, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return true;
  return map.blocked[ty * map.width + tx] === 1;
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
