// Las paredes de la casa del árbol y lo que cuelga en ellas: tablones horizontales clavados (el papel
// `treehouse`), la ventana a la copa del árbol (de día hojas y cielo; de noche estrellas, luna y
// luciérnagas) y una guirnalda de banderines. room.ts e interior-room.ts los llaman. Unidades de arte
// (tile = 16); en las paredes `u` corre a lo largo del muro y `hv` es la altura.
import type { WallFeature } from "../world/types";
import { C, inRect } from "./palette";
import { at, bayer, noise, smoothNoise, type RGBA } from "./pixel";

const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * Tablones anchos horizontales, cada uno con su tono y sus vetas, las juntas oscuras, los clavos en los
 * extremos y una viga redonda arriba (el techo apoya en ella).
 */
export function treehouseWall(u: number, hv: number): RGBA {
  if (hv < 0) return at(C.woodDark, 1);
  // Viga de arriba: un palo redondo con corteza.
  if (hv >= 52) return at(C.logs, hv >= 55 ? 4 : hv >= 53.5 ? 3 : 1);
  if (hv < 2) return at(C.woodDark, hv >= 1 ? 3 : 2);
  const h = 7;
  const row = Math.floor((hv - 2) / h);
  const k = hv - 2 - row * h;
  const off = noise(row, 1, 91) * 40;
  const len = 26 + Math.floor(noise(row, 2, 91) * 14);
  const seg = Math.floor((u + off) / len);
  const x = mod(u + off, len);
  if (k < 0.8) return at(C.woodDark, 1);
  if (x < 0.7) return at(C.woodDark, 2);
  // Clavos en las puntas de cada tablón.
  if ((Math.abs(x - 2) < 0.6 || Math.abs(x - len + 2) < 0.6) && (Math.abs(k - 2) < 0.6 || Math.abs(k - 5.2) < 0.6)) return at(C.metal, 3);
  const tone = noise(seg, row, 93);
  const base = tone < 0.25 ? 2 : tone < 0.8 ? 3 : 4;
  let c = at(C.wood, base);
  if (k > h - 1.3) c = at(C.wood, base + 1);
  if (k < 1.6) c = at(C.wood, base - 1);
  // Vetas que ondulan y algún nudo.
  const grain = Math.abs(smoothNoise(u * 0.4, hv * 3, 3, seg + row * 7) - 0.5);
  if (grain < 0.03) c = at(C.wood, base - 1);
  if (Math.hypot(x - len * noise(seg, row, 95), k - 3.5) < 1.1 && noise(seg, row, 97) < 0.35) c = at(C.woodDark, 3);
  return c;
}

/** La ventana a la copa: marco de palos, postigos abiertos, alféizar con una matita y lo que se ve afuera. */
function windowAt(u: number, hv: number, u1: number, day: boolean): RGBA | null {
  const x0 = 4;
  const x1 = u1 - 4;
  const v0 = 22;
  const v1 = 44;
  // Postigos abiertos a los lados.
  if (inRect(u, hv, x0 - 5, v0, x0 - 1, v1) || inRect(u, hv, x1 + 1, v0, x1 + 5, v1)) {
    const rel = u < x0 ? u - (x0 - 5) : u - (x1 + 1);
    if (rel < 0.7 || rel > 3.3 || hv < v0 + 0.8 || hv > v1 - 0.8) return at(C.green, 1);
    if (Math.abs(hv - (v0 + v1) / 2) < 0.7) return at(C.green, 2);
    return at(C.green, Math.floor(rel) % 2 ? 3 : 4);
  }
  if (!inRect(u, hv, x0 - 1, v0 - 3, x1 + 1, v1 + 2)) return null;
  // Alféizar con una maceta de barro y su matita.
  if (hv < v0) {
    const mid = (x0 + x1) / 2;
    if (hv >= v0 - 1 && Math.abs(u - mid) < 2.2) return at(C.terracotta, 3);
    return at(C.woodDark, hv < v0 - 2 ? 2 : 4);
  }
  if (hv >= v1) return at(C.logs, hv >= v1 + 1 ? 4 : 2);
  if (u < x0 || u >= x1) return at(C.logs, 2);
  const mid = (x0 + x1) / 2;
  // La matita del alféizar asoma por delante del vidrio.
  if (hv < v0 + 4 && Math.hypot(u - mid, (hv - v0) * 1.3) < 3.6 && noise(Math.floor(u), Math.floor(hv), 3) < 0.8) return at(C.leaf, hv > v0 + 2 ? 4 : 2);
  if (Math.abs(u - mid) < 0.6 || Math.abs(hv - (v0 + v1) / 2) < 0.6) return at(C.logs, 3);
  // Afuera: una rama que cruza, hojas en los bordes y el cielo.
  const branch = Math.abs(hv - (v0 + 7 + (u - x0) * 0.35)) < 1.2 && u > x0 + 1;
  const leaves = smoothNoise(u, hv, 4, 31) + (Math.min(u - x0, x1 - u, v1 - hv) < 5 ? 0.25 : 0) > 0.78;
  if (day) {
    if (branch) return at(C.logs, 2);
    if (leaves) return at(C.leaf, smoothNoise(u, hv, 2, 33) > 0.5 ? 4 : 3);
    // Reflejo en diagonal.
    if (Math.abs(u - x0 - (v1 - hv) * 0.8 - 3) < 0.6) return at(C.sky, 4);
    return at(C.sky, hv > v0 + 12 ? 2 : 3);
  }
  if (branch) return at(C.night, 0);
  if (leaves) return at(C.green, 0);
  // Luna, estrellas y alguna luciérnaga.
  if (Math.hypot(u - x1 + 5, hv - v1 + 5) < 2.4) return at(C.cream, 5);
  if (noise(Math.floor(u), Math.floor(hv), 35) > 0.975) return at(C.white, 4);
  if (noise(Math.floor(u), Math.floor(hv), 37) > 0.992) return at(C.gold, 5);
  return at(C.night, bayer(Math.floor(u), Math.floor(hv)) < 0.2 ? 2 : 1);
}

const FLAGS = [C.rug, C.mustard, C.sage, C.fabric, C.rose, C.cream];

/** Guirnalda de banderines de tela que cuelga de un cordel, con su comba entre clavo y clavo. */
function buntingAt(f: WallFeature, u: number, hv: number): RGBA | null {
  const span = 24;
  const k = mod(u, span);
  const sag = Math.sin((k / span) * Math.PI) * 3;
  const line = 49 - sag;
  if (Math.abs(hv - line) < 0.45) return at(C.cork, 2);
  // Un banderín cada 6: triángulo que cuelga del cordel.
  const fi = Math.floor(u / 6);
  const fx = mod(u, 6);
  const depth = line - hv;
  if (depth > 0 && depth < 6 && fx > 0.8 && fx < 5.2 && Math.abs(fx - 3) < (6 - depth) * 0.36) {
    const r = FLAGS[mod(fi + f.x + f.y, FLAGS.length)]!;
    return at(r, depth < 1 ? 2 : Math.abs(fx - 3) < 0.6 ? 4 : 3);
  }
  return null;
}

/** Lo que cuelga en la casa del árbol (o null si el tipo no es de aquí). */
export function casaArbolFeature(f: WallFeature, u: number, hv: number, day: boolean): RGBA | null {
  const u1 = (f.width ?? 1) * 16;
  switch (f.kind) {
    case "treehouse-window":
      return windowAt(u, hv, u1, day);
    case "bunting":
      return buntingAt(f, u, hv);
    default:
      return null;
  }
}
