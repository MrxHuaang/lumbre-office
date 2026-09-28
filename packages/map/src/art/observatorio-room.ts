// Las paredes y lo que cuelga adentro del observatorio: piedra cálida de la torre con zócalo y viga de
// madera, los mapas estelares enmarcados, el mural del cielo pintado a mano (la lomita con la torre bajo
// las constelaciones de la cabaña) y las ventanas redondas de ojo de buey. room.ts los llama. Unidades de
// arte (tile = 16); `u` corre a lo largo del muro y `hv` es la altura sobre el piso. Arte propio.
import type { WallFeature } from "../world/types";
import { C, mix } from "./palette";
import { at, bayer, noise, smoothNoise, type RGBA } from "./pixel";
import { WARM_STONE } from "./observatorio-exterior";

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Piedra de la torre por dentro: hiladas irregulares, zócalo de tablas abajo y la viga de arriba. */
export function stoneworkWall(u: number, hv: number): RGBA {
  if (hv < 0) return at(WARM_STONE, 1);
  if (hv >= 52) return at(C.woodDark, hv >= 55 ? 4 : hv < 53 ? 1 : 3);
  // Zócalo de tablas (lo que se roza con los muebles).
  if (hv < 9) {
    if (hv >= 8) return at(C.wood, 4);
    if (mod(u, 11) < 0.8) return at(C.woodDark, 2);
    return at(C.wood, 2 + (noise(Math.floor(u / 11), 0, 81) < 0.5 ? 0 : 1));
  }
  const row = Math.floor(hv / 6);
  const off = noise(row, 5, 82) * 11;
  const col = Math.floor((u + off) / 11);
  const k = mod(u + off, 11);
  const kv = mod(hv, 6);
  if (kv < 0.9 || k < 0.9) return at(WARM_STONE, 1);
  const n = noise(col, row, 83);
  let c = at(WARM_STONE, 3 + (n < 0.2 ? -1 : n > 0.85 ? 1 : 0));
  if (kv > 5 && k > 1.4) c = at(WARM_STONE, 2);
  else if (kv < 2 && k < 5) c = at(WARM_STONE, 4);
  // Un poco de hollín cálido cerca de la viga (las lámparas de aceite).
  if (hv > 44 && bayer(Math.floor(u), Math.floor(hv)) < (hv - 44) / 30) c = mix(c, at(C.woodDark, 2), 0.35);
  return c;
}

/** Mapa estelar enmarcado: papel crema, el cielo azul noche con estrellas doradas y sus líneas. */
function starChartAt(f: WallFeature, u: number, hv: number, u1: number): RGBA | null {
  const v0 = 18;
  const v1 = 47;
  if (u < 3 || u >= u1 - 3 || hv < v0 || hv >= v1) return null;
  const x = u - 3;
  const y = hv - v0;
  const w = u1 - 6;
  const h = v1 - v0;
  if (x < 1.2 || y < 1.2 || x >= w - 1.2 || y >= h - 1.2) return at(C.woodDark, 2 + (x < 1.2 || y >= h - 1.2 ? 1 : 0));
  if (x < 3 || y < 3 || x >= w - 3 || y >= h - 3) return at(C.cream, 4 - (noise(Math.floor(x), Math.floor(y), 84) < 0.15 ? 1 : 0));
  // Círculo del cielo con su borde graduado.
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2 - 4;
  const d = Math.hypot(x - cx, y - cy);
  if (d > r + 0.8) return at(C.cream, 3);
  if (d > r - 0.4) return at(C.gold, 2);
  const seed = f.x * 7 + f.y * 13;
  // Estrellas y una constelación que las une (siempre las mismas en cada mapa).
  const stars: [number, number][] = [0, 1, 2, 3, 4].map((i) => [cx + (noise(i, 1, seed) - 0.5) * r * 1.4, cy + (noise(i, 2, seed) - 0.5) * r * 1.4]);
  for (const [sx, sy] of stars) if (Math.hypot(x - sx, y - sy) < 1.1) return at(C.gold, 5);
  for (let i = 0; i < stars.length - 1; i++) {
    const [ax, ay] = stars[i]!;
    const [bx, by] = stars[i + 1]!;
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    if (Math.hypot(x - (ax + (bx - ax) * t), y - (ay + (by - ay) * t)) < 0.45) return at(C.gold, 3);
  }
  if (noise(Math.floor(x), Math.floor(y), seed + 5) < 0.04) return at(C.cream, 5);
  // Anillo de la eclíptica punteado.
  if (Math.abs(d - r * 0.6) < 0.35 && Math.floor(Math.atan2(y - cy, x - cx) * 8) % 2 === 0) return at(C.blue, 4);
  return at(C.navy, d > r * 0.8 ? 1 : 2);
}

/**
 * El mural pintado directo en la piedra: el cielo de noche que se aclara hacia el horizonte, la lomita con
 * la torre y su cúpula, un planeta con anillo, la luna y estrellas. Los bordes se deshacen en la piedra.
 */
function muralAt(u: number, hv: number, u1: number, wall: RGBA): RGBA | null {
  const v0 = 12;
  const v1 = 50;
  if (hv < v0 || hv >= v1 || u < 2 || u >= u1 - 2) return null;
  const x = u - 2;
  const y = hv - v0;
  const w = u1 - 4;
  const h = v1 - v0;
  // Borde irregular: la pintura no llega pareja a la orilla.
  const edge = Math.min(x, y, w - x, h - y);
  if (edge < 2.5 && smoothNoise(u, hv, 2, 85) > edge / 2.5) return null;
  // La lomita y la torre en silueta cálida.
  const hill = 7 + Math.sin(x * 0.07) * 2 + Math.sin(x * 0.19 + 1) * 1.2;
  const tx = w * 0.62;
  const tower = Math.abs(x - tx) < 5 && y < hill + 14;
  const dome = Math.hypot(x - tx, y - (hill + 14)) < 5.5 && y >= hill + 14;
  if (y < hill) return at(C.leaf, y < hill - 2 ? 1 : 2);
  if (tower) return Math.abs(x - tx + 1.5) < 1 && y > hill + 6 && y < hill + 9 ? at(C.gold, 5) : at(C.woodDark, 2);
  if (dome) return at(C.woodDark, 3);
  // Telescopio que asoma de la cúpula.
  const ty = hill + 17;
  if (x > tx && x < tx + 8 && Math.abs(y - ty - (x - tx) * 0.6) < 0.8) return at(C.gold, 4);
  // Luna y planeta con anillo.
  if (Math.hypot(x - w * 0.18, y - h * 0.78) < 3.2) return Math.hypot(x - w * 0.18 - 1.3, y - h * 0.78 - 0.8) < 2.6 ? at(C.navy, 3) : at(C.cream, 5);
  const px = w * 0.85;
  const py = h * 0.7;
  if (Math.abs((y - py) - (x - px) * 0.25) < 0.6 && Math.abs(x - px) < 6.5 && Math.hypot(x - px, y - py) > 2.6) return at(C.gold, 4);
  if (Math.hypot(x - px, y - py) < 3) return at(C.rug, y > py ? 4 : 3);
  // Estrellas pintadas a pincel.
  if (noise(Math.floor(x / 2), Math.floor(y / 2), 86) < 0.05 && mod(x, 2) < 1 && mod(y, 2) < 1) return at(C.gold, 5);
  // Cielo: azul noche arriba que se entibia hacia el horizonte, con algo de la piedra que se transparenta.
  const t = (y - hill) / (h - hill);
  const sky = t < 0.25 ? at(C.rug, 4) : t < 0.45 ? at(C.violet, 3) : t < 0.7 ? at(C.navy, 3) : at(C.navy, 2);
  return mix(sky, wall, 0.12);
}

/** Ventana redonda de ojo de buey con aro de latón: cielo de día, noche estrellada de noche. */
function portholeAt(u: number, hv: number, u1: number, day: boolean): RGBA | null {
  const cx = u1 / 2;
  const cy = 34;
  const d = Math.hypot(u - cx, hv - cy);
  if (d > 7) return null;
  if (d > 5.6) return at(C.gold, hv > cy ? 4 : 2);
  if (Math.abs(u - cx) < 0.4 || Math.abs(hv - cy) < 0.4) return at(C.gold, 2);
  if (day) return at(C.sky, hv > cy + 1 ? 2 : 1);
  if (noise(Math.floor(u), Math.floor(hv), 87) < 0.08) return at(C.cream, 5);
  return at(C.night, hv > cy ? 2 : 1);
}

export function observatorioFeature(f: WallFeature, u: number, hv: number, day: boolean): RGBA | null {
  const u1 = (f.width ?? 1) * 16;
  switch (f.kind) {
    case "star-chart":
      return starChartAt(f, u, hv, u1);
    case "mural":
      return muralAt(u, hv, u1, stoneworkWall(u, hv));
    case "porthole":
      return portholeAt(u, hv, u1, day);
    default:
      return null;
  }
}
