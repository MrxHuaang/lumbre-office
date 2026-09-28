// El agua donde se nada (la pileta de la piscina): una "vista" del nivel en la que solo se pisa el agua,
// para validar el movimiento en modo nado con la misma colisión de siempre (`canStandAt`), calcular rutas
// nadando (`findPath`) y encontrar por dónde se entra y se sale. La usan el servidor y el cliente.
import { catalogItem, localToWorld } from "./world/catalog";
import { FEET_BOX, isBlockedTile, type OfficeMap, type PlacedFurniture } from "./world/build";

const swimCache = new WeakMap<OfficeMap, OfficeMap>();

/**
 * El nivel visto desde el agua: bloqueado todo menos los tiles de los muebles `swim` (la pileta). Sin
 * asientos ni portales: nadando no se usan.
 */
export function swimMap(map: OfficeMap): OfficeMap {
  let m = swimCache.get(map);
  if (m) return m;
  const blocked = new Uint8Array(map.blocked.length).fill(1);
  for (const f of map.furniture) {
    const item = catalogItem(f.type);
    if (!item.swim) continue;
    for (const [lx, ly] of item.blocks ?? []) {
      const [dx, dy] = localToWorld(item, f.facing, lx, ly);
      blocked[(f.y + dy) * map.width + f.x + dx] = 0;
    }
  }
  m = { ...map, blocked, seats: new Map(), portals: [] };
  swimCache.set(map, m);
  return m;
}

/** ¿El tile es agua donde se nada? */
export function isSwimTile(map: OfficeMap, tx: number, ty: number): boolean {
  return !isBlockedTile(swimMap(map), tx, ty);
}

/** ¿El nivel tiene piscina? */
export const hasPool = (map: OfficeMap) => map.furniture.some((f) => catalogItem(f.type).swim);

/** ¿Caben los pies de alguien nadando en (x, y)? (la caja de los pies entera sobre el agua). */
export function canSwimAt(map: OfficeMap, x: number, y: number): boolean {
  const ts = map.tileSize;
  const { halfWidth, top, bottom } = FEET_BOX;
  for (const [px, py] of [
    [x - halfWidth, y + top],
    [x + halfWidth, y + top],
    [x - halfWidth, y + bottom - 1],
    [x + halfWidth, y + bottom - 1],
  ] as const)
    if (!isSwimTile(map, Math.floor(px / ts), Math.floor(py / ts))) return false;
  return true;
}

/** ¿Se nada en línea recta de A a B? (puntos intermedios, como `canWalkBetween`). */
export function canSwimBetween(map: OfficeMap, ax: number, ay: number, bx: number, by: number): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 4));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (!canSwimAt(map, ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
  }
  return true;
}

const center = (map: OfficeMap, tx: number, ty: number) => ({ x: tx * map.tileSize + map.tileSize / 2, y: ty * map.tileSize + map.tileSize / 2 });

/**
 * Por dónde se sale del agua estando en (x, y): el tile de tierra (sin bloquear) más cercano a menos de
 * `reachTiles`. Null si el borde queda lejos. `taken` descarta lugares ocupados.
 */
export function poolExitSpot(map: OfficeMap, x: number, y: number, reachTiles: number, taken: (x: number, y: number) => boolean = () => false): { x: number; y: number } | null {
  const ts = map.tileSize;
  const tx = Math.floor(x / ts);
  const ty = Math.floor(y / ts);
  let best: { x: number; y: number; d: number } | null = null;
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (isBlockedTile(map, nx, ny)) continue;
      const c = center(map, nx, ny);
      // Hasta el borde del tile de tierra: desde el agua pegada a él se alcanza.
      const d = Math.hypot(c.x - x, c.y - y) / ts;
      if (d > reachTiles + 0.5 || taken(c.x, c.y) || (best && best.d <= d)) continue;
      best = { ...c, d };
    }
  return best && { x: best.x, y: best.y };
}

/** Por dónde se entra desde un punto del deck: el tile de agua más cercano que esté libre. */
export function poolEntrySpot(map: OfficeMap, x: number, y: number, taken: (x: number, y: number) => boolean = () => false): { x: number; y: number } | null {
  const ts = map.tileSize;
  const tx = Math.floor(x / ts);
  const ty = Math.floor(y / ts);
  let best: { x: number; y: number; d: number } | null = null;
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++) {
      if (!isSwimTile(map, tx + dx, ty + dy)) continue;
      const c = center(map, tx + dx, ty + dy);
      const d = Math.hypot(c.x - x, c.y - y);
      if (taken(c.x, c.y) || (best && best.d <= d)) continue;
      best = { ...c, d };
    }
  return best && { x: best.x, y: best.y };
}

const DIR: Record<string, [number, number]> = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };

/**
 * El salto del trampolín: desde la punta del tablón (sobre el agua) hasta donde se cae, unos tiles más
 * allá. Null si ahí no hay agua (un trampolín mal puesto).
 */
export function diveLine(map: OfficeMap, board: PlacedFurniture): { fromX: number; fromY: number; toX: number; toY: number } | null {
  const ts = map.tileSize;
  const [dx, dy] = DIR[board.facing] ?? [1, 0];
  const c = center(map, board.x, board.y);
  const to = { x: c.x + dx * ts * 2.6, y: c.y + dy * ts * 2.6 };
  if (!canSwimAt(map, to.x, to.y)) return null;
  return { fromX: c.x + dx * ts * 0.9, fromY: c.y + dy * ts * 0.9, toX: to.x, toY: to.y };
}
