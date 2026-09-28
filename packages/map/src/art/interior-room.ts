// Pisos, papeles murales y cosas colgadas de los interiores del rediseño (planta baja y pisos 2 y 3).
// room.ts los llama; viven aparte para que cada parte del rediseño toque lo menos posible de room.ts.
// Unidades de arte (tile = 16). En las paredes `u` corre a lo largo del muro y `hv` es la altura.
import type { FloorKind, WallFeature, WallpaperKind } from "../world/types";
import { busWallpaper } from "./bus-adentro";
import { C, OUT, inRect, mix } from "./palette";
import { at, bayer, noise, ramp, smoothNoise, type Ramp, type RGBA } from "./pixel";
import { boardsWall, cinderblockWall } from "./garaje-room";
import { treehouseWall } from "./casa-arbol-room";

/** Verde bosque (papel de la biblioteca). */
export const FOREST: Ramp = ramp("#132019", "#1b3024", "#264430", "#335a3e", "#4a7654", "#6f9a73");
/** Madera plateada por el sol (el deck del balcón y la terraza). */
const DECK: Ramp = ramp("#4d3a2c", "#6e5541", "#8f7155", "#ab8c6a", "#c4a883", "#dcc6a2");
/** Azulejo blanco con su junta gris y el filo azul. */
const TILE: Ramp = ramp("#8f8f9c", "#b9bac4", "#d9dbe2", "#eceef2", "#fafbfd");

const WALL_H = 56;
const mod = (n: number, m: number) => ((n % m) + m) % m;

// ---------- Pisos ----------

/** Parqué en espiga: tablas de 2 celdas de largo, una a lo largo de x y otra de y, en zigzag. */
function parquet(X: number, Y: number): RGBA {
  const w = 4;
  const a = Math.floor(X / w);
  const b = Math.floor(Y / w);
  const fu = X / w - a;
  const fv = Y / w - b;
  const d = mod(a - b, 4);
  // d 0..1: tabla a lo largo de x (arranca en d = 0); d 2..3: a lo largo de y (arranca en d = 3).
  const alongX = d < 2;
  const start = alongX ? [a - d, b] : [a, b - (3 - d)];
  const tone = noise(start[0]!, start[1]!, 41);
  // Las que van a lo largo de y quedan un pelo más oscuras: así se lee el zigzag sin ruido.
  const c = at(C.wood, (alongX ? 3 : 2.6) + (tone < 0.25 ? -0.6 : tone > 0.8 ? 0.6 : 0));
  const edge = alongX ? fv < 0.16 || (d === 0 && fu < 0.16) : fu < 0.16 || (d === 3 && fv < 0.16);
  return edge ? at(C.wood, 1) : c;
}

/** Baldosa de cocina: cuadros de 5 en crema y gris piedra, con junta. */
function kitchenTiles(X: number, Y: number): RGBA {
  const s = 5;
  const u = mod(X, s);
  const v = mod(Y, s);
  if (u < 0.6 || v < 0.6) return at(C.stone, 2);
  const dark = (Math.floor(X / s) + Math.floor(Y / s)) % 2 === 0;
  const base = dark ? at(C.stone, 3) : at(C.cream, 4);
  // Brillo en la esquina de cada baldosa.
  if (u < 1.6 && v < 1.6) return dark ? at(C.stone, 4) : at(C.cream, 5);
  return base;
}

/** Baldosín de los baños: mosaico blanco con algunas piezas azules sueltas. */
function bathTiles(X: number, Y: number): RGBA {
  const s = 2.5;
  const i = Math.floor(X / s);
  const j = Math.floor(Y / s);
  if (mod(X, s) < 0.5 || mod(Y, s) < 0.5) return at(TILE, 1);
  const n = noise(i, j, 77);
  if (n < 0.1) return at(C.sky, 1);
  if (n < 0.16) return at(C.sky, 2);
  return at(TILE, n > 0.8 ? 4 : 3);
}

/** Deck de afuera: tablas a lo largo de x con juntas abiertas, uniones desfasadas y clavos. */
function deck(X: number, Y: number): RGBA {
  const row = Math.floor(Y / 6);
  const v = mod(Y, 6);
  if (v < 0.7) return at(DECK, 1);
  const off = Math.floor(noise(row, 3, 9) * 32);
  const seg = Math.floor((X + off) / 32);
  const u = mod(X + off, 32);
  if (u < 0.7) return at(DECK, 1);
  // Clavos en las puntas de cada tabla.
  if ((u > 1.2 && u < 2) || (u > 30 && u < 30.8)) if ((v > 1.5 && v < 2.3) || (v > 4 && v < 4.8)) return at(DECK, 0);
  const tone = noise(seg, row, 13);
  let c = at(DECK, tone < 0.3 ? 3 : tone < 0.8 ? 4 : 5);
  if (v > 5.2) c = at(DECK, 3);
  if (v < 1.5) c = mix(c, at(DECK, 5), 0.3);
  if (noise(Math.floor(X / 3), row, 29) < 0.08) c = at(DECK, 2);
  return c;
}

/** Roble claro (tablas anchas y listones de pared). */
const OAK: Ramp = ramp("#6e5438", "#927252", "#b3916b", "#cdac83", "#e0c59e", "#efdcbc");
/** Barro cocido (ladrillo del piso y de la pared). */
const CLAY: Ramp = ramp("#4f2519", "#74392a", "#97503a", "#b3664a", "#c98260", "#dea17f");
/** Verde agua colonial (zócalo pintado y baldosa hidráulica). */
const TEAL: Ramp = ramp("#173a38", "#21524e", "#2f6d66", "#468a80", "#6aa99c", "#9ccabd");

/**
 * Baldosa hidráulica (la de las casas viejas colombianas): cuadros de 8 con un cuarto de círculo en cada
 * esquina (entre cuatro baldosas forman una flor), un rombo al centro y la cenefa fina.
 */
function hydraulic(X: number, Y: number): RGBA {
  // Una baldosa por tile: el dibujo se lee de lejos sin volverse ruido.
  const s = 16;
  const u = mod(X, s);
  const v = mod(Y, s);
  if (u < 0.6 || v < 0.6) return at(C.stone, 3);
  const cu = Math.min(u, s - u);
  const cv = Math.min(v, s - v);
  const r = Math.hypot(cu, cv);
  // Cuarto de flor en cada esquina: botón mostaza y pétalos rojo vino con su filo crema.
  if (r < 2) return at(C.mustard, 3);
  if (r < 5.5) {
    // Cuatro pétalos por flor: se cortan en las diagonales.
    const petal = Math.abs(cu - cv) < 1.1 ? at(C.cream, 4) : at(C.rug, r < 4 ? 2 : 3);
    return petal;
  }
  if (r < 6.3) return at(C.rug, 1);
  // Rombo verde al centro de cada baldosa, con el ojo crema.
  const d = Math.abs(u - s / 2) + Math.abs(v - s / 2);
  if (d < 1.5) return at(C.cream, 5);
  if (d < 3.5) return at(TEAL, d < 2.5 ? 4 : 3);
  if (d < 4.1) return at(TEAL, 1);
  // Cenefa verde por el borde de la baldosa, entre flor y flor.
  if (Math.min(cu, cv) < 1.8 && Math.min(cu, cv) > 1.1) return at(TEAL, 2);
  return at(C.cream, bayer(Math.floor(X), Math.floor(Y)) < 0.1 ? 3 : 4);
}

/** Parqué en damero: cuadros de 8 con tres tablillas, a lo largo de x y de y alternados. */
function checker(X: number, Y: number): RGBA {
  const s = 8;
  const i = Math.floor(X / s);
  const j = Math.floor(Y / s);
  const u = mod(X, s);
  const v = mod(Y, s);
  if (u < 0.5 || v < 0.5) return at(C.woodDark, 2);
  const alongX = (i + j) % 2 === 0;
  // Dos tablillas por cuadro (con más, de lejos se ve como tejido de alfombra).
  const across = alongX ? v : u;
  const strip = Math.floor(across / (s / 2));
  const tone = noise(i * 2 + strip, j, 57);
  // Los cuadros a lo largo de y van en madera oscura: así se lee el tablero.
  const r = alongX ? C.wood : C.woodDark;
  const base = alongX ? 4 : 5;
  const c = at(r, base - (tone < 0.3 ? 1 : 0));
  if (Math.abs(across - s / 2) < 0.4) return mix(c, at(C.woodDark, 1), 0.45);
  // Brillo en la punta de cada tablilla.
  const along = alongX ? u : v;
  return along < 1.2 ? mix(c, at(C.cream, 5), 0.2) : c;
}

/** Terrazo: base crema con esquirlas de colores y juntas de latón cada dos tiles. */
function terrazzo(X: number, Y: number): RGBA {
  if (mod(X, 32) < 0.5 || mod(Y, 32) < 0.5) return at(C.gold, 3);
  const x = Math.floor(X);
  const y = Math.floor(Y);
  const n = noise(x, y, 61);
  const chip = noise(Math.floor(X / 2), Math.floor(Y / 2), 63);
  // Esquirlas grandes (de 2x2) y chicas (de 1x1), pocas y en tonos apagados sobre la base de mármol.
  if (chip < 0.025) return at(C.rose, 3);
  if (chip < 0.045) return at(C.sage, 3);
  if (chip > 0.975) return at(C.stone, 2);
  if (n < 0.04) return at(C.stone, 3);
  if (n < 0.06) return at(C.cork, 3);
  if (n > 0.95) return at(C.white, 4);
  return at(C.cream, bayer(x, y) < 0.25 ? 4 : 5);
}

/** Ladrillo de barro cocido en trabazón: piezas de 8x4 desfasadas por hilera, con junta gris. */
function brickFloor(X: number, Y: number): RGBA {
  const row = Math.floor(Y / 4);
  const off = row % 2 ? 4 : 0;
  const u = mod(X + off, 8);
  const v = mod(Y, 4);
  if (u < 0.6 || v < 0.6) return at(C.stone, 2);
  const tone = noise(Math.floor((X + off) / 8), row, 67);
  let c = at(CLAY, tone < 0.3 ? 2 : tone < 0.8 ? 3 : 4);
  // Desgaste: el borde de arriba de cada ladrillo un pelo más claro y manchitas oscuras.
  if (v < 1.3) c = mix(c, at(CLAY, 5), 0.25);
  if (noise(Math.floor(X), Math.floor(Y), 69) < 0.05) c = at(CLAY, 1);
  return c;
}

/** Moqueta de hotel: verde oscuro con una retícula de rombos mostaza y un punto crema en cada cruce. */
function moquette(X: number, Y: number): RGBA {
  // La retícula va a lo largo de x e y del mundo: en la vista isométrica se ve como rombos.
  const x = mod(X, 12) - 6;
  const y = mod(Y, 12) - 6;
  const edge = Math.max(Math.abs(x), Math.abs(y));
  if (edge > 5.4) return at(C.mustard, 2);
  // Una florcita crema al centro de cada rombo, con cuatro pétalos mostaza.
  const r = Math.abs(x) + Math.abs(y);
  if (r < 1.1) return at(C.cream, 4);
  if (r < 2.6 && Math.min(Math.abs(x), Math.abs(y)) < 0.7) return at(C.mustard, 3);
  if (edge > 3.6 && edge < 4.3) return at(C.green, 3);
  return at(C.green, bayer(Math.floor(X), Math.floor(Y)) < 0.18 ? 1 : 2);
}

/** Tablas anchas de roble claro, largas y con la veta marcada. */
function planks(X: number, Y: number): RGBA {
  const row = Math.floor(Y / 5.33);
  const v = mod(Y, 5.33);
  if (v < 0.55) return at(OAK, 1);
  const off = Math.floor(noise(row, 5, 71) * 48);
  const seg = Math.floor((X + off) / 48);
  if (mod(X + off, 48) < 0.55) return at(OAK, 1);
  const tone = noise(seg, row, 73);
  let c = at(OAK, tone < 0.3 ? 3 : tone < 0.85 ? 4 : 5);
  // Vetas: líneas largas y finas que ondulan.
  const g = Math.sin((X + off) * 0.19 + row * 2) * 1.2 + 2.6;
  if (Math.abs(v - g) < 0.35 && noise(Math.floor((X + off) / 6), row, 75) < 0.6) c = at(OAK, 2);
  return c;
}

export function interiorFloor(kind: FloorKind, X: number, Y: number): RGBA {
  switch (kind) {
    case "parquet":
      return parquet(X, Y);
    case "kitchen":
      return kitchenTiles(X, Y);
    case "mosaic":
      return bathTiles(X, Y);
    case "hydraulic":
      return hydraulic(X, Y);
    case "checker":
      return checker(X, Y);
    case "terrazzo":
      return terrazzo(X, Y);
    case "brick":
      return brickFloor(X, Y);
    case "moquette":
      return moquette(X, Y);
    case "planks":
      return planks(X, Y);
    default:
      return deck(X, Y);
  }
}

// ---------- Paredes ----------

/** Cornisa de arriba (igual en todos los muros). */
function crown(hv: number): RGBA | null {
  if (hv >= WALL_H - 4) return at(C.cream, hv >= WALL_H - 1 ? 4 : hv < WALL_H - 3 ? 1 : 3);
  return null;
}

/** Machimbre: tablas verticales de madera de piso a techo, con un listón a la altura de la silla. */
function paneling(u: number, hv: number): RGBA {
  if (hv < 3) return at(C.woodDark, hv >= 2 ? 3 : 2);
  const top = crown(hv);
  if (top) return top;
  if (hv >= 18 && hv < 21) return at(C.woodDark, hv >= 20 ? 5 : hv >= 19 ? 4 : 2);
  const bw = 6;
  const k = Math.floor(u / bw);
  const bu = mod(u, bw);
  if (bu < 0.8) return at(C.wood, 1);
  if (bu < 1.6) return at(C.wood, 4);
  const tone = noise(k, hv < 18 ? 1 : 2, 17);
  let c = at(C.wood, tone < 0.35 ? 2 : 3);
  // Nudos sueltos en la madera.
  if (noise(k, Math.floor(hv / 5), 23) > 0.93 && Math.hypot(bu - 3.5, mod(hv, 5) - 2.5) < 1.2) c = at(C.wood, 1);
  return c;
}

/** Azulejos: blancos hasta media pared con una cenefa azul, y arriba estuco crema. */
function tiled(u: number, hv: number): RGBA {
  if (hv < 3) return at(C.stone, hv >= 2 ? 3 : 2);
  const top = crown(hv);
  if (top) return top;
  if (hv >= 34) return at(C.cream, bayer(Math.floor(u), Math.floor(hv)) < 0.12 ? 3 : 4);
  if (hv >= 32) return at(C.blue, hv >= 33 ? 3 : 2);
  const s = 4;
  const x = mod(u, s);
  const y = mod(hv - 3, s);
  if (x < 0.6 || y < 0.6) return at(TILE, 1);
  const row = Math.floor((hv - 3) / s);
  // Una hilera de azulejos azules con un rombo pintado.
  if (row === 5) return Math.abs(x - 2.2) + Math.abs(y - 2.2) < 1.3 ? at(C.gold, 4) : at(C.blue, 3);
  if (x < 1.6 && y > s - 1.6) return at(TILE, 4);
  return at(TILE, 3);
}

/** Verde bosque con un rombo dorado repetido y el zócalo de madera de siempre. */
function forest(u: number, hv: number): RGBA {
  if (hv < 3) return at(C.woodDark, hv >= 2 ? 3 : 2);
  const top = crown(hv);
  if (top) return top;
  if (hv < 18) {
    if (hv >= 16) return at(C.woodDark, 4);
    if (hv >= 15) return at(C.woodDark, 1);
    if (mod(u, 12) < 1) return at(C.woodDark, 1);
    if (mod(u, 12) < 2) return at(C.woodDark, 4);
    return at(C.woodDark, 3);
  }
  const x = mod(u, 8) - 4;
  const y = mod(hv - 18, 10) - 5;
  const dd = Math.abs(x) + Math.abs(y) * 0.8;
  if (dd < 1) return at(C.gold, 3);
  if (Math.abs(dd - 2.6) < 0.4) return at(FOREST, 3);
  return at(FOREST, hv < 20 ? 1 : 2);
}

/** Zócalo de madera oscura con su moldura (de 0 a `top`), para los papeles que lo llevan. */
function wainscot(u: number, hv: number, top: number): RGBA {
  if (hv < 3) return at(C.woodDark, hv >= 2 ? 3 : 2);
  if (hv >= top - 2) return at(C.woodDark, hv >= top - 1 ? 5 : 2);
  const pu = mod(u, 16);
  if (pu < 1 || (hv >= 5 && hv < 6) || (hv >= top - 4 && hv < top - 3)) return at(C.woodDark, 2);
  if (pu < 2 || (hv >= 6 && hv < 7)) return at(C.woodDark, 4);
  return at(C.woodDark, 3);
}

/** Rayas finas: crema con líneas azules y rosadas alternadas, sobre un zócalo pintado de azul. */
function stripes(u: number, hv: number): RGBA {
  const top = crown(hv);
  if (top) return top;
  if (hv < 3) return at(C.woodDark, hv >= 2 ? 3 : 2);
  if (hv < 18) {
    // Zócalo de tablero pintado, con su marco.
    if (hv >= 16) return at(C.cream, hv >= 17 ? 5 : 2);
    const pu = mod(u, 12);
    if (pu < 1 || hv < 4 || hv >= 15) return at(C.blue, 2);
    if (pu < 2 || hv < 5) return at(C.blue, 4);
    return at(C.blue, 3);
  }
  const k = mod(u, 6);
  if (k < 0.8) return at(Math.floor(u / 6) % 2 ? C.rose : C.blue, 3);
  if (k >= 3 && k < 3.5) return at(C.cream, 3);
  return at(C.cream, hv < 20 ? 3 : 4);
}

/** Damasco dorado tono sobre tono: medallones en rejilla desfasada, con zócalo de madera. */
function damask(u: number, hv: number): RGBA {
  const top = crown(hv);
  if (top) return top;
  if (hv < 20) return wainscot(u, hv, 20);
  const row = Math.floor((hv - 20) / 12);
  const x = mod(u + (row % 2 ? 6 : 0), 12) - 6;
  const y = mod(hv - 20, 12) - 6;
  const ax = Math.abs(x);
  // Medallón: una gota doble (arriba y abajo) con el centro calado y hojitas a los lados.
  const shape = ax / 3.2 + Math.abs(y) / 5.5;
  if (shape < 0.35) return at(C.mustard, 2);
  if (shape < 1) return at(C.mustard, ax < 1.6 && Math.abs(y) < 3 ? 4 : 3);
  if (Math.abs(ax - 4) < 0.7 && Math.abs(y) < 1.2) return at(C.mustard, 3);
  return at(C.mustard, bayer(Math.floor(u), Math.floor(hv)) < 0.12 ? 1 : 2);
}

/** Ladrillo visto: hileras de 8x4 en trabazón con junta crema, del zócalo a la cornisa. */
function brickWall(u: number, hv: number): RGBA {
  const top = crown(hv);
  if (top) return top;
  if (hv < 3) return at(C.woodDark, hv >= 2 ? 3 : 2);
  const row = Math.floor((hv - 3) / 4);
  const off = row % 2 ? 4 : 0;
  const x = mod(u + off, 8);
  const y = mod(hv - 3, 4);
  if (x < 0.7 || y < 0.7) return at(C.cream, 2);
  const tone = noise(Math.floor((u + off) / 8), row, 81);
  let c = at(CLAY, tone < 0.25 ? 2 : tone < 0.8 ? 3 : 4);
  if (y > 3.1) c = at(CLAY, 2);
  if (noise(Math.floor(u), Math.floor(hv), 83) < 0.06) c = at(CLAY, 1);
  return c;
}

/** Listones verticales de roble claro, angostos y con una ranura oscura entre cada uno. */
function slats(u: number, hv: number): RGBA {
  const top = crown(hv);
  if (top) return top;
  if (hv < 3) return at(OAK, hv >= 2 ? 2 : 1);
  const k = Math.floor(u / 3);
  const x = mod(u, 3);
  if (x < 0.7) return at(C.woodDark, 1);
  const tone = noise(k, 1, 85);
  let c = at(OAK, tone < 0.3 ? 3 : tone < 0.8 ? 4 : 5);
  if (x < 1.3) c = at(OAK, 5);
  if (noise(k, Math.floor(hv / 4), 87) < 0.08) c = at(OAK, 2);
  return c;
}

/** Casa colonial: estuco blanco cálido arriba y un zócalo pintado de verde agua con su filete. */
function colonial(u: number, hv: number): RGBA {
  const top = crown(hv);
  if (top) return top;
  if (hv < 2) return at(TEAL, 1);
  if (hv < 20) {
    if (hv >= 18.5) return at(C.mustard, 3);
    if (hv >= 17.5) return at(TEAL, 1);
    // Pintura a brocha: un leve veteado horizontal.
    return at(TEAL, noise(Math.floor(u / 5), Math.floor(hv / 2), 89) < 0.25 ? 2 : 3);
  }
  const n = noise(Math.floor(u), Math.floor(hv), 91);
  if (n < 0.04) return at(C.cream, 3);
  return at(C.cream, bayer(Math.floor(u), Math.floor(hv)) < 0.08 ? 4 : 5);
}

/** Muro de un papel del rediseño, o null si es de los de siempre (room.ts lo dibuja). */
export function interiorWall(kind: WallpaperKind | null, u: number, hv: number): RGBA | null {
  if (hv < 0) return null;
  switch (kind) {
    case "paneling":
      return paneling(u, hv);
    case "tile":
      return tiled(u, hv);
    case "forest":
      return forest(u, hv);
    case "stripes":
      return stripes(u, hv);
    case "damask":
      return damask(u, hv);
    case "brick":
      return brickWall(u, hv);
    case "slats":
      return slats(u, hv);
    case "colonial":
      return colonial(u, hv);
    case "cinderblock":
      return cinderblockWall(u, hv);
    case "treehouse":
      return treehouseWall(u, hv);
    case "megabus":
    case "fuelle":
      return busWallpaper(kind, u, hv);
    case "boards":
      return boardsWall(u, hv);
    default:
      return null;
  }
}

// ---------- Cosas colgadas ----------

/** Espejo de marco dorado con el borde de arriba en arco y reflejos en diagonal, sobre una repisita. */
function mirrorAt(u: number, hv: number, u1: number): RGBA | null {
  const n = Math.max(1, Math.round(u1 / 16));
  const pw = u1 / n;
  const pu = mod(u, pw);
  const cx = pw / 2;
  // Repisita de vidrio con un frasco de jabón.
  if (hv >= 22 && hv < 24 && pu > 2 && pu < pw - 2) return at(C.white, hv >= 23 ? 4 : 2);
  if (hv >= 24 && hv < 28 && Math.abs(pu - cx - 3) < 1.2) return hv >= 27 ? at(C.metal, 3) : at(C.leaf, 4);
  const top = 46;
  const r = cx - 3;
  const inArch = (x: number, y: number, rr: number) => y < top - rr || Math.hypot(x - cx, y - (top - rr)) < rr;
  if (hv < 26 || hv >= top + 1 || Math.abs(pu - cx) >= r + 1.5 || !inArch(pu, hv, r + 1.5)) return null;
  if (Math.abs(pu - cx) >= r || !inArch(pu, hv, r)) return at(C.gold, pu < cx ? 4 : 2);
  const t = pu - (hv - 26) * 0.7;
  if (mod(t, 11) < 1.4) return at(C.white, 4);
  if (mod(t, 11) < 2) return at(C.sky, 4);
  return at(C.sky, hv > 38 ? 2 : 3);
}

const FELT: Ramp[] = [C.sage, C.mustard, C.rose, C.fabric];

/** Paneles acústicos: rectángulos grandes de fieltro acanalado en colores apagados, con marco de madera. */
function acousticAt(u: number, hv: number, u1: number): RGBA | null {
  if (!inRect(u, hv, 1, 21, u1 - 1, 51)) return null;
  const n = Math.max(1, Math.round(u1 / 16));
  const pw = (u1 - 2) / n;
  const k = Math.floor((u - 1) / pw);
  const pu = u - 1 - k * pw;
  // Dos filas por columna, desfasadas en alto.
  const split = 36 + (k % 2 ? 4 : -3);
  const top = hv >= split;
  const pv = top ? hv - split : hv - 21;
  const ph = top ? 51 - split : split - 21;
  if (pu < 1 || pu >= pw - 1 || pv < 0.8 || pv >= ph - 0.8) return pu < 0.5 || pu >= pw - 0.5 ? null : at(C.woodDark, 3);
  const r = FELT[(k * 2 + (top ? 1 : 0)) % FELT.length]!;
  if (pu < 1.8 || pv >= ph - 1.6) return at(r, 4);
  if (pu >= pw - 1.8 || pv < 1.6) return at(r, 1);
  return at(r, mod(pu, 2.2) < 0.8 ? 2 : 3);
}

/**
 * Ventanal de piso a techo: marcos de madera cada ~12 unidades, travesaño arriba, cortinas recogidas a
 * los lados y, afuera, cielo con nubes y el bosque (de noche, estrellas).
 */
function ventanalAt(u: number, hv: number, u1: number, day: boolean): RGBA | null {
  const x0 = 5;
  const x1 = u1 - 5;
  // Cortinas recogidas con su lazo dorado.
  const curtain = (d: number) => {
    const w = hv > 30 ? 5 : hv > 24 ? 3.5 : 4.5;
    if (d < 0 || d >= w || hv < 4 || hv >= 51) return null;
    if (hv >= 26 && hv < 28) return at(C.gold, 4);
    const f = Math.floor(d + hv * 0.1) % 3;
    return at(C.curtain, f === 0 ? 1 : f === 1 ? 3 : 2);
  };
  const cl = curtain(u) ?? curtain(u1 - 1 - u);
  if (cl) return cl;
  // Barra de la cortina.
  if (hv >= 51 && hv < 53) return at(C.woodDark, hv >= 52 ? 4 : 2);
  if (!inRect(u, hv, x0, 3, x1, 51)) return null;
  // Marco exterior, alféizar y travesaño.
  if (hv < 5) return at(C.cream, hv >= 4 ? 5 : 2);
  if (u < x0 + 1.5 || u >= x1 - 1.5 || hv >= 49) return at(C.cream, u < x0 + 0.8 || hv >= 50 ? 4 : 3);
  const n = Math.max(2, Math.round((x1 - x0) / 12));
  const pw = (x1 - x0) / n;
  const pu = mod(u - x0, pw);
  if (pu < 1.2 || (hv >= 39 && hv < 40.5)) return at(C.cream, 3);
  // Paisaje: cielo, nubes, copas de árboles al fondo.
  const X = u;
  const Y = hv;
  if (!day) {
    if (noise(Math.floor(X), Math.floor(Y), 91) < 0.025) return at(C.gold, 5);
    if (Y < 14 + 3 * Math.sin(X * 0.3)) return at(C.night, 0);
    return at(C.night, Y > 36 ? 1 : 2);
  }
  const hill = 14 + 3 * Math.sin(X * 0.21) + 2 * Math.sin(X * 0.57 + 1);
  if (Y < hill) {
    const trees = smoothNoise(X, Y, 3, 7);
    return at(C.leaf, Y < hill - 3 ? (trees > 0.5 ? 1 : 2) : trees > 0.55 ? 3 : 2);
  }
  // Reflejo en diagonal sobre el vidrio.
  if (mod(X - Y * 0.6, 17) < 1.3) return at(C.sky, 4);
  const cloud = smoothNoise(X, Y * 2, 7, 3);
  if (Y > 30 && cloud > 0.62) return at(C.white, cloud > 0.72 ? 4 : 3);
  const t = (Y - hill) / (48 - hill);
  return at(C.sky, 1 + t * 2.4 + (bayer(Math.floor(X), Math.floor(Y)) - 0.5));
}

/** Repisas flotantes con frascos, tazas, libros y una planta que cuelga. */
function shelfAt(f: WallFeature, u: number, hv: number, u1: number): RGBA | null {
  const shelves = [29, 41];
  for (const sy of shelves) {
    if (hv >= sy && hv < sy + 2 && u > 1 && u < u1 - 1) return at(C.wood, hv >= sy + 1 ? 4 : 2);
    // Ménsulas.
    if (hv >= sy - 3 && hv < sy && (Math.abs(u - 4) < 0.8 || Math.abs(u - (u1 - 4)) < 0.8) && u1 - (hv - sy + 3) > 0) return at(C.woodDark, 2);
    if (hv >= sy + 2 && hv < sy + 9) {
      const y = hv - sy - 2;
      const slot = Math.floor((u - 2) / 4);
      if (u < 2 || u >= u1 - 2) continue;
      const kind = Math.floor(noise(slot, sy + f.x * 3 + f.y * 5, 83) * 5);
      const su = mod(u - 2, 4);
      if (kind === 0 && su > 0.6 && su < 3.4 && y < 5) {
        // Frasco de vidrio con granos o especias y su tapa.
        if (y >= 4) return at(C.woodDark, 3);
        return su < 1.2 ? at(C.white, 4) : at([C.mustard, C.rug, C.leaf, C.cork][slot % 4]!, y < 2 ? 2 : 3);
      }
      if (kind === 1 && su > 0.8 && su < 3.2 && y < 3) return su < 1.4 ? at(C.cream, 5) : at([C.blue, C.rose, C.cream][slot % 3]!, 3);
      if (kind === 2 && y < 6 && su < 3.4) return at(BOOKSET[Math.floor(su)]!, su % 1 < 0.2 ? 1 : 3);
      if (kind === 3 && su > 0.5 && su < 3.5) {
        // Matera con hojas que caen por delante de la repisa.
        if (y < 3) return at(C.terracotta, su < 1.2 ? 4 : 2);
        if (y < 6 && noise(Math.floor(u * 1.5), Math.floor(hv * 1.5), 7) < 0.7) return at(C.leaf, y > 4 ? 4 : 3);
      }
    }
    if (hv >= sy - 6 && hv < sy && Math.abs(u - 12) < 1.5 && u1 > 20 && noise(Math.floor(hv), 1, sy) < 0.8) return at(C.leaf, hv % 2 ? 2 : 3);
  }
  return null;
}
const BOOKSET: Ramp[] = [C.rug, C.fabric, C.sage, C.mustard];

/** Mapamundi enmarcado: pergamino con continentes, rosa de los vientos y la ruta punteada de un viaje. */
function mapAt(u: number, hv: number, u1: number): RGBA | null {
  if (!inRect(u, hv, 3, 24, u1 - 3, 48)) return null;
  if (u < 4.5 || u >= u1 - 4.5 || hv < 25.5 || hv >= 46.5) return at(C.woodDark, u < 4 || hv >= 47.5 ? 4 : 2);
  const x = u - 4.5;
  const y = hv - 25.5;
  const w = u1 - 9;
  const land = smoothNoise(x * 1.1 + 3, y * 1.4, 5, 29) + (Math.abs(x - w / 2) < w * 0.12 ? -0.18 : 0);
  // Ruta punteada y la rosa de los vientos.
  const route = Math.abs(y - (10 + 5 * Math.sin((x / w) * Math.PI * 1.6))) < 0.5 && Math.floor(x) % 3 === 0;
  if (route) return at(C.rug, 2);
  const rx = x - (w - 5);
  const ry = y - 4;
  if (Math.abs(rx) + Math.abs(ry) * 2 < 2.2 || Math.abs(rx) * 2 + Math.abs(ry) < 2.2) return at(C.rug, 3);
  if (land > 0.58) return at(land > 0.7 ? C.leaf : C.sage, land > 0.66 ? 3 : 4);
  const edge = land > 0.54;
  return edge ? at(C.cork, 2) : at(C.cream, bayer(Math.floor(u), Math.floor(hv)) < 0.15 ? 3 : 4);
}

/** Retrato en marco dorado ovalado: alguien de medio cuerpo sobre un fondo oscuro. */
function portraitAt(u: number, hv: number, u1: number): RGBA | null {
  const cx = u1 / 2;
  const cy = 37;
  const rx = Math.min(10, u1 / 2 - 2);
  const ry = 11;
  const d = Math.hypot((u - cx) / rx, (hv - cy) / ry);
  if (d >= 1) return null;
  if (d >= 0.82) return at(C.gold, (u < cx) === hv > cy ? 4 : 2);
  const x = u - cx;
  const y = hv - cy;
  // Hombros y saco, cuello blanco, cara, pelo.
  if (y < -3 && Math.abs(x) < 7 - (y + 3) * -0.4) return Math.abs(x) < 1 && y > -6 ? at(C.cream, 5) : at(C.fabric, y < -7 ? 1 : 2);
  const face = Math.hypot(x / 3, (y - 1) / 3.8);
  if (face < 1) {
    if (y > 2.5 && face > 0.55) return at(C.woodDark, 2);
    if (Math.abs(y) < 0.5 && Math.abs(Math.abs(x) - 1.3) < 0.5) return OUT;
    return at(C.rose, x < 0 ? 5 : 4);
  }
  if (Math.hypot(x / 3.8, (y - 2.5) / 3.2) < 1) return at(C.woodDark, 2);
  return at(FOREST, d > 0.6 ? 1 : 2);
}

/** Lo que cuelga de una pared del rediseño (o null si el tipo no es de los de aquí). */
export function interiorFeature(f: WallFeature, u: number, hv: number, day: boolean): RGBA | null {
  const u1 = (f.width ?? 1) * 16;
  switch (f.kind) {
    case "mirror":
      return mirrorAt(u, hv, u1);
    case "acoustic":
      return acousticAt(u, hv, u1);
    case "ventanal":
      return ventanalAt(u, hv, u1, day);
    case "shelf":
      return shelfAt(f, u, hv, u1);
    case "map":
      return mapAt(u, hv, u1);
    case "portrait":
      return portraitAt(u, hv, u1);
    default:
      return null;
  }
}
