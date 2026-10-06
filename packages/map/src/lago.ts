// El lago de un nivel: el pedazo de agua (piso `water`) más grande, con lo que le llega pegado (el arroyo
// del molino). Lo usa el navegador para el brillo del agua de la historia (capítulo 3: game/aguaBrilla.ts).
import type { OfficeMap } from "./world/build";

const cache = new WeakMap<OfficeMap, { x: number; y: number }[]>();

/** Los tiles del lago (vacío si el nivel no tiene agua). */
export function lakeTiles(map: OfficeMap): { x: number; y: number }[] {
  const hit = cache.get(map);
  if (hit) return hit;
  const { width: w, height: h } = map;
  const water = (i: number) => map.floors[i] === "water";
  const seen = new Uint8Array(w * h);
  let best: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || !water(start)) continue;
    const part: number[] = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      part.push(i);
      const x = i % w;
      const y = (i - x) / w;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (!seen[n] && water(n)) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    if (part.length > best.length) best = part;
  }
  const out = best.map((i) => ({ x: i % w, y: Math.floor(i / w) }));
  cache.set(map, out);
  return out;
}
