// Hacia dónde queda el agua desde un punto de pesca: para mirar hacia el lago y saber dónde cae la boya.
// Lo calcula cada cliente con el mapa (todos llegan al mismo lugar con la misma posición).
import type { OfficeMap } from "@hyvento/map";
import type { Direction } from "@hyvento/shared";

const DIRS: { dir: Direction; dx: number; dy: number }[] = [
  { dir: "right", dx: 1, dy: 0 },
  { dir: "down", dx: 0, dy: 1 },
  { dir: "left", dx: -1, dy: 0 },
  { dir: "up", dx: 0, dy: -1 },
];

/** Vector en pantalla de cada dirección del mundo (la vista es isométrica). */
export const SCREEN_DIR: Record<Direction, { x: number; y: number }> = {
  right: { x: 1, y: 0.5 },
  down: { x: -1, y: 0.5 },
  left: { x: -1, y: -0.5 },
  up: { x: 1, y: -0.5 },
};

const isWater = (map: OfficeMap, tx: number, ty: number) =>
  tx >= 0 && ty >= 0 && tx < map.width && ty < map.height && map.floors[ty * map.width + tx] === "water";

/**
 * La dirección con más agua adelante (mirando 1 a 3 tiles) y dónde cae la boya, en px de mundo. Null si
 * no hay agua cerca.
 */
export function castTarget(map: OfficeMap, x: number, y: number): { dir: Direction; x: number; y: number } | null {
  const ts = map.tileSize;
  const tx = Math.floor(x / ts);
  const ty = Math.floor(y / ts);
  let best: { dir: Direction; dx: number; dy: number; score: number } | null = null;
  for (const d of DIRS) {
    let score = 0;
    for (let k = 1; k <= 3; k++) if (isWater(map, tx + d.dx * k, ty + d.dy * k)) score += 4 - k;
    if (score > 0 && (!best || score > best.score)) best = { ...d, score };
  }
  if (!best) return null;
  const far = isWater(map, tx + best.dx * 2, ty + best.dy * 2) ? 1.8 : 1.2;
  return { dir: best.dir, x: x + best.dx * ts * far, y: y + best.dy * ts * far };
}
