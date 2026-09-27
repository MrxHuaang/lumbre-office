import type { OfficeMap } from "./world/build";

export interface TilePos {
  x: number;
  y: number;
}

const SQRT2 = Math.SQRT2;
const DIRS: readonly [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
];

/**
 * A* sobre la grilla de colisión (8 direcciones, sin cortar esquinas).
 * Devuelve la ruta de tiles SIN incluir el inicio, o `null` si no hay camino.
 * Respeta las paredes delgadas entre tiles. Síncrono: la usa el cliente (clic-para-caminar).
 * Los portales (puertas, escaleras) solo se pisan si son el destino: pasar junto a una puerta no cambia de nivel.
 */
export function findPath(map: OfficeMap, start: TilePos, goal: TilePos): TilePos[] | null {
  const { width, height, blocked } = map;
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
  const portalTiles = new Set(map.portals.flatMap((p) => p.tiles.map((t) => t.y * width + t.x)));
  portalTiles.delete(goal.y * width + goal.x);
  const free = (x: number, y: number) => inBounds(x, y) && blocked[y * width + x] === 0 && !portalTiles.has(y * width + x);
  // Paredes delgadas entre tiles vecinos (ortogonales).
  const wall = (ax: number, ay: number, bx: number, by: number) =>
    ax === bx ? map.wallH[Math.max(ay, by) * width + ax] !== 0 : map.wallV[ay * (width + 1) + Math.max(ax, bx)] !== 0;
  if (!free(goal.x, goal.y) || !inBounds(start.x, start.y)) return null;
  if (start.x === goal.x && start.y === goal.y) return [];

  const size = width * height;
  const g = new Float64Array(size).fill(Infinity);
  const cameFrom = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const heap = new MinHeap();

  const startIdx = start.y * width + start.x;
  const goalIdx = goal.y * width + goal.x;
  const h = (x: number, y: number) => {
    const dx = Math.abs(x - goal.x);
    const dy = Math.abs(y - goal.y);
    return dx + dy + (SQRT2 - 2) * Math.min(dx, dy); // octile
  };

  g[startIdx] = 0;
  heap.push(startIdx, h(start.x, start.y));

  while (heap.size > 0) {
    const current = heap.pop();
    if (current === goalIdx) break;
    if (closed[current]) continue;
    closed[current] = 1;
    const cx = current % width;
    const cy = (current - cx) / width;

    for (const [dx, dy, cost] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!free(nx, ny)) continue;
      if (dx === 0 || dy === 0) {
        if (wall(cx, cy, nx, ny)) continue;
      } else if (
        // Sin cortar esquinas: en diagonal ambos ortogonales deben estar libres y sin paredes.
        !free(cx + dx, cy) ||
        !free(cx, cy + dy) ||
        wall(cx, cy, cx + dx, cy) ||
        wall(cx, cy, cx, cy + dy) ||
        wall(cx + dx, cy, nx, ny) ||
        wall(cx, cy + dy, nx, ny)
      ) {
        continue;
      }
      const ni = ny * width + nx;
      if (closed[ni]) continue;
      const tentative = g[current]! + cost;
      if (tentative < g[ni]!) {
        g[ni] = tentative;
        cameFrom[ni] = current;
        heap.push(ni, tentative + h(nx, ny));
      }
    }
  }

  if (cameFrom[goalIdx] === -1) return null;
  const path: TilePos[] = [];
  for (let i = goalIdx; i !== startIdx; i = cameFrom[i]!) {
    const x = i % width;
    path.push({ x, y: (i - x) / width });
  }
  return path.reverse();
}

/** Busca el tile libre más cercano (BFS), útil cuando el destino cae en un obstáculo. */
export function nearestFreeTile(map: OfficeMap, from: TilePos, maxRadius = 6): TilePos | null {
  const { width, height, blocked } = map;
  const seen = new Set<number>();
  let frontier: TilePos[] = [from];
  for (let r = 0; r <= maxRadius && frontier.length; r++) {
    const next: TilePos[] = [];
    for (const p of frontier) {
      if (p.x < 0 || p.y < 0 || p.x >= width || p.y >= height) continue;
      const i = p.y * width + p.x;
      if (seen.has(i)) continue;
      seen.add(i);
      if (blocked[i] === 0) return p;
      next.push({ x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 });
    }
    frontier = next;
  }
  return null;
}

class MinHeap {
  private items: number[] = [];
  private prio: number[] = [];
  get size() {
    return this.items.length;
  }
  push(item: number, priority: number) {
    this.items.push(item);
    this.prio.push(priority);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.prio[parent]! <= this.prio[i]!) break;
      this.swap(i, parent);
      i = parent;
    }
  }
  pop(): number {
    const top = this.items[0]!;
    const lastItem = this.items.pop()!;
    const lastPrio = this.prio.pop()!;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.prio[0] = lastPrio;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.items.length && this.prio[l]! < this.prio[m]!) m = l;
        if (r < this.items.length && this.prio[r]! < this.prio[m]!) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number) {
    [this.items[a], this.items[b]] = [this.items[b]!, this.items[a]!];
    [this.prio[a], this.prio[b]] = [this.prio[b]!, this.prio[a]!];
  }
}
