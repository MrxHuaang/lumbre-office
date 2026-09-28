// Las paredes del estudio de grabación (el nivel `podcast`) y lo que cuelga en ellas: el papel `estudio`
// (zócalo de madera y paneles acústicos de tela acolchada), el cartel "EN EL AIRE", la ventana de
// estrellas y los afiches: del espacio (planetas, nebulosa, cohete, mapa estelar), de un viaje por un
// sistema de planetitas de madera (la fogata con malvaviscos y el diario de exploración con sus hilos),
// de un mapa de fantasía de tres carriles con su río (y el escudo con las espadas) y de programación
// ("HOLA MUNDO", el pato de goma, la pizarra con un diagrama). Todo dibujado aquí, sin logos ni
// personajes de nadie. También la puerta del pasillo del piso 3 que entra al estudio, con su cartel.
// room.ts los llama. Unidades de arte (tile = 16); en las paredes `u` corre a lo largo del muro (de
// izquierda a derecha en pantalla) y `hv` es la altura.
import type { WallFeature } from "../world/types";
import { Escena } from "./exterior-escena";
import { C, inRect, mix } from "./palette";
import { at, bayer, noise, smoothNoise, type Ramp, type RGBA, type Sprite } from "./pixel";

const mod = (n: number, m: number) => ((n % m) + m) % m;

// ---------- Letras ----------

// Letras de 3x5 (cinco filas de arriba abajo), solo las que se usan aquí.
const FONT: Record<string, string> = {
  A: ".#. #.# ### #.# #.#",
  D: "##. #.# #.# #.# ##.",
  E: "### #.. ##. #.. ###",
  H: "#.# #.# ### #.# #.#",
  I: "### .#. .#. .#. ###",
  L: "#.. #.. #.. #.. ###",
  M: "#.# ### ### #.# #.#",
  N: "##. #.# #.# #.# #.#",
  O: ".#. #.# #.# #.# .#.",
  R: "##. #.# ##. #.# #.#",
  U: "#.# #.# #.# #.# ###",
  "{": ".## .#. #.. .#. .##",
  "}": "##. .#. ..# .#. ##.",
};

/**
 * ¿Hay letra en (u, hv)? `text` centrado en `mid`, con la fila de arriba en `top`, a escala `s` (cada
 * punto de la letra mide s x s unidades).
 */
function textOn(text: string, u: number, hv: number, mid: number, top: number, s: number): boolean {
  const tw = text.length * 4 * s - s;
  const x = Math.floor((u - (mid - tw / 2)) / s);
  const y = Math.floor((top - hv) / s);
  if (x < 0 || y < 0 || y >= 5) return false;
  const k = Math.floor(x / 4);
  const gx = x - k * 4;
  if (k >= text.length || gx >= 3) return false;
  return FONT[text[k]!]?.split(" ")[y]?.[gx] === "#";
}

// ---------- Papel del estudio ----------

const FELT: Ramp[] = [C.curtain, C.cork, C.sage, C.mustard];

/**
 * Zócalo de tablas verticales, un listón a la altura de la silla y, arriba, paneles acústicos de tela
 * acolchada (un botón al centro de cada uno) en colores cálidos apagados, con su marco de madera.
 */
export function estudioWall(u: number, hv: number): RGBA {
  if (hv < 0) return at(C.woodDark, 1);
  if (hv < 3) return at(C.woodDark, hv >= 2 ? 3 : 2);
  if (hv >= 52) return at(C.logs, hv >= 55 ? 4 : hv >= 53.5 ? 3 : 1);
  if (hv < 17) {
    const bu = mod(u, 6);
    if (bu < 0.8) return at(C.wood, 1);
    return at(C.wood, noise(Math.floor(u / 6), 1, 41) < 0.4 ? 2 : 3);
  }
  if (hv < 20) return at(C.woodDark, hv >= 19 ? 5 : hv >= 18 ? 4 : 2);
  // Paneles de 16 x 16 en dos filas, desfasados entre filas.
  const row = hv < 36 ? 0 : 1;
  const pu = mod(u + row * 8, 16);
  const pv = hv - (row ? 36 : 20);
  const k = Math.floor((u + row * 8) / 16);
  if (pu < 1 || pv < 0.8 || pv >= 15.2) return at(C.logs, 2);
  const r = FELT[mod(k * 3 + row, FELT.length)]!;
  // El acolchado: más claro arriba a la izquierda, más oscuro abajo, y el botón del centro.
  const d = Math.hypot(pu - 8.5, pv - 8);
  if (d < 1) return at(r, 1);
  if (d < 1.8) return at(r, 2);
  if (pu < 2.2 || pv >= 13.8) return at(r, 4);
  if (pu >= 14.5 || pv < 1.8) return at(r, 1);
  // Surcos que van del borde al botón (la tela tirante).
  if (Math.abs(Math.abs(pu - 8.5) - Math.abs(pv - 8) * 1.06) < 0.35) return at(r, 2);
  return at(r, bayer(Math.floor(u), Math.floor(hv)) < 0.15 ? 2 : 3);
}

// ---------- Marcos ----------

/** Afiche enmarcado entre (u0, v0) y (u1, v1): marco de madera y el dibujo `inner(x, y, w, h)` (y hacia arriba). */
function framed(u: number, hv: number, u0: number, v0: number, u1: number, v1: number, inner: (x: number, y: number, w: number, h: number) => RGBA): RGBA | null {
  if (!inRect(u, hv, u0, v0, u1, v1)) return null;
  const t = 1.3;
  if (u < u0 + t || u >= u1 - t || hv < v0 + t || hv >= v1 - t) return at(C.woodDark, hv >= v1 - t || u < u0 + t ? 4 : 2);
  return inner(u - u0 - t, hv - v0 - t, u1 - u0 - t * 2, v1 - v0 - t * 2);
}

/** Estrellitas sueltas sobre un fondo (tramado fijo por píxel). */
const star = (x: number, y: number, seed: number, p = 0.965) => noise(Math.floor(x), Math.floor(y), seed) > p;

// ---------- Espacio ----------

/** Planetas: uno grande con anillo, uno azul chico y uno rojo, sobre azul noche con estrellas. */
function planetsAt(x: number, y: number, w: number, h: number): RGBA {
  const cx = w * 0.5;
  const cy = h * 0.55;
  // Anillo inclinado (por delante del planeta en su mitad de abajo).
  const rx = (x - cx) / 7.5;
  const ry = (y - cy + (x - cx) * 0.25) / 2.2;
  const ring = Math.abs(Math.hypot(rx, ry) - 1) < 0.16;
  const dp = Math.hypot(x - cx, y - cy);
  if (ring && (y - cy + (x - cx) * 0.25 < 0 || dp > 4.6)) return at(C.cream, 4);
  if (dp < 4.6) {
    const band = Math.floor((y - cy + 5) / 1.6) % 3;
    return at([C.mustard, C.cork, C.terracotta][band]!, x - cx < -1.5 ? 4 : x - cx > 2 ? 2 : 3);
  }
  if (Math.hypot(x - w * 0.22, y - h * 0.2) < 2) return at(C.sky, x < w * 0.22 ? 3 : 1);
  if (Math.hypot(x - w * 0.8, y - h * 0.86) < 1.4) return at(C.rug, 3);
  if (star(x, y, 51)) return at(C.cream, 5);
  // Título abajo: rayitas claras.
  if (y < 3.5 && y > 2 && x > 2 && x < w - 2 && Math.floor(x) % 3 !== 2) return at(C.gold, 4);
  return at(C.night, y > h * 0.6 ? 2 : 1);
}

/** Nebulosa: nubes violetas y rosadas con estrellas brillantes en cruz. */
function nebulaAt(x: number, y: number, w: number, h: number): RGBA {
  const n = smoothNoise(x, y, 5, 61) * 0.7 + smoothNoise(x, y, 2.5, 62) * 0.3;
  const swirl = Math.sin((x - w / 2) * 0.35 + (y - h / 2) * 0.25 + n * 3);
  for (const [sx, sy] of [
    [w * 0.3, h * 0.7],
    [w * 0.7, h * 0.35],
  ] as const) {
    const dx = Math.abs(x - sx);
    const dy = Math.abs(y - sy);
    if ((dx < 0.6 && dy < 2.5) || (dy < 0.6 && dx < 2.5)) return at(C.white, dx + dy < 1 ? 4 : 3);
  }
  if (star(x, y, 63, 0.95)) return at(C.cream, 5);
  if (n > 0.62 && swirl > -0.2) return at(C.rose, n > 0.72 ? 4 : 3);
  if (n > 0.5) return at(C.violet, n > 0.56 ? 4 : 3);
  if (n > 0.4) return at(C.violet, 2);
  return at(C.night, bayer(Math.floor(x), Math.floor(y)) < 0.3 ? 2 : 1);
}

/** Afiche retro de un cohete de madera que despega: fondo crema, órbita punteada y su llama. */
function rocketAt(x: number, y: number, w: number, h: number): RGBA {
  const mid = w / 2;
  const dx = x - mid;
  const body = y > 8 && y < 20 && Math.abs(dx) < 2.6 - (y > 16 ? (y - 16) * 0.6 : 0);
  if (y >= 20 && y < 23 && Math.abs(dx) < (23 - y) * 0.7) return at(C.rug, 3);
  if (body) {
    if (Math.hypot(dx, y - 14.5) < 1.2) return at(C.sky, 3);
    if (Math.floor(y) % 3 === 0) return at(C.wood, 2);
    return at(C.wood, dx < 0 ? 4 : 3);
  }
  // Aletas.
  if (y > 7 && y < 11 && Math.abs(dx) >= 2.6 && Math.abs(dx) < 2.6 + (11 - y) * 0.9) return at(C.rug, 3);
  // Llama.
  if (y <= 8 && y > 2 && Math.abs(dx) < (y - 2) * 0.4) return at(y > 5 ? C.fire : C.gold, y > 6 ? 3 : 4);
  // Órbita punteada alrededor.
  const o = Math.hypot((x - mid) / (w * 0.42), (y - h * 0.55) / (h * 0.3));
  if (Math.abs(o - 1) < 0.07 && Math.floor(Math.atan2(y - h * 0.55, x - mid) * 8) % 2 === 0) return at(C.terracotta, 3);
  if (Math.hypot(x - w * 0.18, y - h * 0.82) < 1.8) return at(C.mustard, 3);
  return at(C.cream, y < 3 ? 2 : 4);
}

/** Mapa estelar: carta azul con el círculo de coordenadas, constelaciones unidas por líneas y su rosa. */
function starMapAt(x: number, y: number, w: number, h: number): RGBA {
  const cx = w / 2;
  const cy = h / 2;
  const d = Math.hypot(x - cx, y - cy);
  const pts: [number, number][] = [
    [0.2, 0.75],
    [0.38, 0.62],
    [0.55, 0.78],
    [0.7, 0.55],
    [0.3, 0.3],
    [0.62, 0.22],
  ];
  const P = pts.map(([a, b]) => [a * w, b * h] as const);
  const lines: [number, number][] = [
    [0, 1],
    [1, 2],
    [1, 3],
    [1, 4],
    [4, 5],
  ];
  for (const [px, py] of P) if (Math.hypot(x - px, y - py) < 1) return at(C.gold, 5);
  for (const [a, b] of lines) {
    const [ax, ay] = P[a]!;
    const [bx, by] = P[b]!;
    const len = Math.hypot(bx - ax, by - ay);
    const t = ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (len * len);
    if (t > 0 && t < 1 && Math.abs((x - ax) * (by - ay) - (y - ay) * (bx - ax)) / len < 0.35) return at(C.cream, 3);
  }
  if (Math.abs(d - Math.min(w, h) * 0.46) < 0.35 || Math.abs(x - cx) < 0.2 || Math.abs(y - cy) < 0.2) return at(C.navy, 4);
  if (star(x, y, 71, 0.975)) return at(C.cream, 4);
  return at(C.navy, 2);
}

/**
 * Ventana redonda al espacio (2 tiles): marco de madera con remaches de bronce y, adentro, estrellas,
 * un planeta con anillo y el resplandor de una nebulosa. De día el cielo de adentro es un poco más claro.
 */
function starWindowAt(u: number, hv: number, u1: number, day: boolean): RGBA | null {
  const cx = u1 / 2;
  const cy = 35;
  const r = 13;
  const d = Math.hypot(u - cx, hv - cy);
  if (d > r + 3) return hv >= 18 && hv < 20 && Math.abs(u - cx) < r ? at(C.woodDark, 4) : null;
  if (d > r) {
    const a = Math.atan2(hv - cy, u - cx);
    if (mod(a * 8 / Math.PI, 2) < 0.18 && Math.abs(d - r - 1.5) < 0.6) return at(C.gold, 4);
    return at(C.logs, d > r + 2.2 ? 1 : hv > cy ? 4 : 3);
  }
  // Cruz del marco.
  if (Math.abs(u - cx) < 0.6 || Math.abs(hv - cy) < 0.6) return at(C.logs, 2);
  const x = u - cx;
  const y = hv - cy;
  const pd = Math.hypot(x + 4, y - 3);
  if (pd < 3.6) return at(C.sage, x + 4 < -1 ? 4 : 2);
  if (Math.abs(Math.hypot((x + 4) / 6.5, (y - 3 + (x + 4) * 0.3) / 1.8) - 1) < 0.13) return at(C.cream, 4);
  if (Math.hypot(x - 5, y + 5) < 1.1) return at(C.rug, 4);
  if (star(u, hv, 81, 0.95)) return at(C.white, 4);
  if (star(u, hv, 82, 0.99)) return at(C.gold, 5);
  const neb = smoothNoise(u, hv, 4, 83);
  if (neb > 0.66 && x > 0) return at(C.violet, 3);
  const base = day ? C.navy : C.night;
  return at(base, (neb > 0.55 ? 3 : 2) - (bayer(Math.floor(u), Math.floor(hv)) < 0.25 ? 1 : 0));
}

// ---------- El viaje de los planetitas de madera ----------

/**
 * Un planetita de madera (tablas curvas) con un arbolito, la fogata y un palito con un malvavisco,
 * flotando en el espacio con dos lunas.
 */
function campfireAt(x: number, y: number, w: number, h: number): RGBA {
  const cx = w / 2;
  const cy = h * 0.34;
  const r = 5.6;
  const d = Math.hypot(x - cx, y - cy);
  // Arriba del planeta: la fogata (troncos y llama), el arbolito y el malvavisco.
  const top = cy + r;
  if (y >= top - 0.6 && y < top + 1 && Math.abs(x - cx) < 1.8) return at(C.logs, 2);
  if (y >= top + 0.5 && y < top + 4.5 && Math.abs(x - cx) < (top + 4.5 - y) * 0.45) return at(y < top + 2 ? C.fire : C.gold, 3);
  if (Math.abs(x - (cx - 3.6)) < 0.5 && y >= top - 1 && y < top + 2) return at(C.logs, 2);
  if (Math.hypot(x - (cx - 3.6), y - (top + 3.2)) < 1.8) return at(C.leaf, 3);
  // El palito cruza sobre el fuego con el malvavisco en la punta.
  const sx = x - (cx + 1);
  if (sx > 0 && sx < 4 && Math.abs(y - (top + 2.2 + sx * 0.5)) < 0.35) return at(C.cork, 2);
  if (Math.hypot(x - (cx + 4.4), y - (top + 4.2)) < 0.9) return at(C.cream, 5);
  if (d < r) {
    // Tablas curvas del planetita, con la luz de la fogata arriba.
    const plank = Math.floor((y - cy + r) / 1.8);
    const k = mod(x + plank * 3, 7);
    if (k < 0.5) return at(C.woodDark, 2);
    return at(C.wood, (y - cy > r * 0.4 ? 4 : 3) - (x - cx > r * 0.5 ? 1 : 0));
  }
  if (Math.hypot(x - w * 0.16, y - h * 0.8) < 1.5) return at(C.cream, 3);
  if (Math.hypot(x - w * 0.86, y - h * 0.62) < 1.1) return at(C.sage, 3);
  if (star(x, y, 91)) return at(C.cream, 5);
  return at(C.night, y > h * 0.7 ? 1 : 2);
}

/**
 * Diario de exploración (2 tiles): un corcho con fichas de papel (cada una con un dibujito), unidas por
 * hilos naranjas, y notas con signos de pregunta.
 */
function exploreLogAt(x: number, y: number, w: number, h: number): RGBA {
  const cards: [number, number, number][] = [
    [w * 0.12, h * 0.62, 0],
    [w * 0.42, h * 0.72, 1],
    [w * 0.72, h * 0.6, 2],
    [w * 0.26, h * 0.2, 3],
    [w * 0.6, h * 0.18, 1],
  ];
  const links: [number, number][] = [
    [0, 1],
    [1, 2],
    [0, 3],
    [1, 4],
    [2, 4],
  ];
  const cw = 6.5;
  const ch = 5;
  for (const [cx, cy, pic] of cards) {
    if (inRect(x, y, cx, cy, cx + cw, cy + ch)) {
      const lx = x - cx;
      const ly = y - cy;
      // La chinche arriba y el dibujito: un planeta, una fogata, un cohete o un signo de pregunta.
      if (Math.hypot(lx - cw / 2, ly - ch + 0.6) < 0.6) return at(C.rug, 3);
      if (pic === 0 && Math.hypot(lx - 3.2, ly - 2.2) < 1.4) return at(C.sage, 3);
      if (pic === 1 && ly > 1 && ly < 3.6 && Math.abs(lx - 3.2) < (3.6 - ly) * 0.6) return at(C.fire, 3);
      if (pic === 2 && Math.abs(lx - 3.2) < 0.8 && ly > 0.8 && ly < 3.6) return at(C.wood, 3);
      if (pic === 3 && ((Math.abs(Math.hypot(lx - 3.2, ly - 2.8) - 1) < 0.35 && ly > 2.4) || (Math.abs(lx - 3.2) < 0.4 && ly > 1.2 && ly < 2))) return at(C.woodDark, 2);
      if (ly < 1 && lx > 1 && lx < cw - 1 && Math.floor(lx) % 2 === 0) return at(C.cream, 2);
      return at(C.cream, 5);
    }
  }
  const centers = cards.map(([cx, cy]) => [cx + cw / 2, cy + ch / 2] as const);
  for (const [a, b] of links) {
    const [ax, ay] = centers[a]!;
    const [bx, by] = centers[b]!;
    const len = Math.hypot(bx - ax, by - ay);
    const t = ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (len * len);
    if (t > 0 && t < 1 && Math.abs((x - ax) * (by - ay) - (y - ay) * (bx - ax)) / len < 0.5) return at(C.fire, 4);
  }
  return at(C.cork, 1 + Math.floor(noise(Math.floor(x), Math.floor(y), 93) * 3));
}

// ---------- El mapa de los tres carriles ----------

/**
 * Mapa de fantasía (2 tiles) en pergamino: pasto con bosquecitos, tres carriles de tierra entre la base
 * azul (abajo a la izquierda) y la roja (arriba a la derecha), y el río que cruza en la otra diagonal.
 */
function lanesAt(x: number, y: number, w: number, h: number): RGBA {
  const nx = x / w;
  const ny = y / h;
  const near = (v: number, t: number) => Math.abs(v) < t;
  // Bases en las esquinas, con su cristal.
  const blue = Math.hypot(nx - 0.1, (ny - 0.12) * (h / w)) * w;
  const red = Math.hypot(nx - 0.9, (ny - 0.88) * (h / w)) * w;
  if (blue < 2.6) return blue < 1.2 ? at(C.cyan, 4) : at(C.fabric, 3);
  if (red < 2.6) return red < 1.2 ? at(C.fire, 4) : at(C.rug, 3);
  // Río: de arriba a la izquierda a abajo a la derecha, ondulado.
  const river = ny - (1 - nx) - Math.sin(nx * 9) * 0.03;
  if (near(river, 0.07)) return at(C.sky, near(river, 0.03) ? 3 : 2);
  // Carriles: el de arriba (sube por la izquierda y cruza por arriba), el del medio (diagonal) y el de abajo.
  const t = 0.05;
  const top = (near(nx - 0.1, t) && ny > 0.12) || (near(ny - 0.88, t * 1.6) && nx > 0.1);
  const bottom = (near(ny - 0.12, t * 1.6) && nx > 0.1) || (near(nx - 0.9, t) && ny > 0.12);
  const mid = near(ny - nx, t * 1.3);
  if (top || bottom || mid) return at(C.cork, 4);
  // Torrecitas en los carriles.
  for (const [tx, ty] of [
    [0.1, 0.5],
    [0.5, 0.88],
    [0.35, 0.35],
    [0.65, 0.65],
    [0.5, 0.12],
    [0.9, 0.5],
  ] as const)
    if (Math.hypot((nx - tx) * w, (ny - ty) * h) < 1) return at(C.cream, 5);
  // Bosquecitos en la selva entre carriles.
  if (smoothNoise(x, y, 2.2, 97) > 0.68) return at(C.green, 1);
  return at(C.green, bayer(Math.floor(x), Math.floor(y)) < 0.2 ? 2 : 3);
}

/** El marco dorado del mapa (más fino y con esquinitas). */
function lanesMapAt(u: number, hv: number, u1: number): RGBA | null {
  if (!inRect(u, hv, 1.5, 20, u1 - 1.5, 49)) return null;
  const t = 1.3;
  if (u < 1.5 + t || u >= u1 - 1.5 - t || hv < 20 + t || hv >= 49 - t) {
    const corner = (u < 5 || u > u1 - 5) && (hv < 23.5 || hv > 45.5);
    return at(C.gold, corner ? 5 : hv >= 49 - t ? 4 : 2);
  }
  return lanesAt(u - 1.5 - t, hv - 20 - t, u1 - 3 - t * 2, 29 - t * 2);
}

/** Un escudo de madera con el borde de bronce y dos espadas cruzadas detrás, en una tablita. */
function swordShieldAt(u: number, hv: number, u1: number): RGBA | null {
  const cx = u1 / 2;
  const cy = 36;
  // Espadas: dos diagonales con su guarda y el pomo.
  for (const sgn of [1, -1]) {
    const a = u - cx;
    const b = hv - cy;
    const along = (a * sgn + b) / Math.SQRT2;
    const across = (a * sgn - b) / Math.SQRT2;
    if (along > -11 && along < 11 && Math.abs(across) < 0.9) return along > 5 ? at(C.metal, along > 9 ? 5 : 4) : along > 3.5 ? at(C.gold, 3) : at(C.logs, 2);
    if (Math.abs(along - 4.2) < 0.7 && Math.abs(across) < 2.6) return at(C.gold, 4);
    if (Math.hypot(along + 11, across) < 1.2) return at(C.gold, 3);
  }
  // Escudo redondeado abajo en punta.
  const dx = Math.abs(u - cx);
  const dy = hv - cy;
  const inShield = (m: number) => (dy > -2 ? dx < 6.5 - m && dy < 7 - m : dx < (dy + 9) * 0.75 - m);
  if (inShield(0)) {
    if (!inShield(1.2)) return at(C.gold, dy > 3 ? 4 : 3);
    // Cuartel en dos maderas y una estrella al centro.
    if (Math.hypot(u - cx, hv - cy - 1) < 1.6) return at(C.cream, 5);
    return at((u < cx) !== (hv < cy) ? C.rug : C.wood, dy > 3 ? 3 : 2);
  }
  // Tablita de la que cuelga.
  if (hv >= 46 && hv < 48.5 && dx < 7.5) return at(C.woodDark, hv >= 47.5 ? 4 : 3);
  return null;
}

// ---------- Programación ----------

/** "HOLA MUNDO" (2 tiles): pantalla de terminal con las llaves grandes y el cursor que parpadea. */
function helloAt(x: number, y: number, w: number, h: number): RGBA {
  const mid = w / 2;
  if (textOn("{ }", x, y, mid, h - 2, 2)) return at(C.gold, 4);
  if (textOn("HOLA", x, y, mid, h - 14, 1)) return at(C.leaf, 5);
  if (textOn("MUNDO", x, y, mid, h - 20, 1)) return at(C.leaf, 5);
  // El cursor al final y líneas de "código" abajo.
  if (inRect(x, y, mid + 10.5, h - 25, mid + 12, h - 20)) return at(C.leaf, 4);
  if (y < 3 && y >= 1.5 && x > 2 && x < w - 2 && noise(Math.floor(x / 3), 1, 99) > 0.3) return at(C.green, 3);
  // Líneas de barrido de la pantalla.
  return Math.floor(y) % 2 ? at(C.green, 0) : mix(at(C.green, 0), at(C.night, 1), 0.5);
}

/** El pato de goma de depurar: amarillo, con su pico naranja y burbujitas, sobre celeste. */
function duckAt(x: number, y: number, w: number, h: number): RGBA {
  const cx = w / 2;
  const body = Math.hypot((x - cx + 0.5) / 5, (y - 8) / 3.4);
  const head = Math.hypot(x - cx - 2.2, y - 14);
  if (Math.hypot(x - cx - 3, y - 15) < 0.6) return at(C.night, 1);
  if (head < 3) return at(C.mustard, x > cx + 2 ? 4 : 3);
  if (x > cx + 4.6 && x < cx + 7 && Math.abs(y - 13.4) < 0.9) return at(C.fire, 3);
  if (body < 1) return at(C.mustard, y > 9 ? 4 : body > 0.8 ? 2 : 3);
  // Agua abajo y burbujas.
  if (y < 5) return at(C.sky, Math.floor(x + y * 2) % 5 === 0 ? 3 : 2);
  for (const [bx, by, br] of [
    [w * 0.2, h * 0.75, 1.3],
    [w * 0.3, h * 0.88, 0.8],
    [w * 0.78, h * 0.85, 1],
  ] as const) {
    const d = Math.hypot(x - bx, y - by);
    if (d < br) return at(C.white, d > br - 0.5 ? 4 : 3);
  }
  return at(C.sky, 3);
}

/** Pizarra blanca (2 tiles) con un diagrama: cajas unidas por flechas, una nube y un chulito. */
function diagramAt(u: number, hv: number, u1: number): RGBA | null {
  if (!inRect(u, hv, 2, 22, u1 - 2, 48)) return null;
  if (u < 3.5 || u >= u1 - 3.5 || hv < 23.5 || hv >= 46.5) return at(C.wood, hv >= 46.5 ? 5 : 3);
  // La repisita de los marcadores abajo.
  if (hv < 25 && (Math.abs(u - 8) < 1.5 || Math.abs(u - 11) < 1.5)) return at(hv < 24.3 ? C.woodDark : Math.abs(u - 8) < 1.5 ? C.blue : C.rug, 3);
  const box = (x0: number, y0: number, x1: number, y1: number) => inRect(u, hv, x0, y0, x1, y1) && !inRect(u, hv, x0 + 0.7, y0 + 0.7, x1 - 0.7, y1 - 0.7);
  if (box(6, 37, 13, 43) || box(19, 37, 26, 43) || box(12.5, 27, 20, 32)) return at(C.blue, 2);
  // Flechas: de la caja 1 a la 2 y de las dos a la de abajo.
  if (Math.floor(hv) === 40 && u > 13 && u < 19) return at(C.rug, 3);
  if (u > 17.4 && u < 19 && Math.abs(hv - 40.2) < 19 - u) return at(C.rug, 3);
  if (Math.abs(u - 10 - (37 - hv) * 0.5) < 0.45 && hv > 32 && hv < 37) return at(C.rug, 3);
  if (Math.abs(u - 22 + (37 - hv) * 0.5) < 0.45 && hv > 32 && hv < 37) return at(C.rug, 3);
  // Nube a la derecha y un chulito verde.
  if (Math.abs(Math.hypot(u - (u1 - 7), hv - 31) - 2.4) < 0.4 && hv > 29.5) return at(C.sage, 2);
  const ck = u - (u1 - 9);
  if (ck > 0 && ck < 2 && Math.abs(hv - (41 - ck)) < 0.5) return at(C.leaf, 3);
  if (ck >= 2 && ck < 5 && Math.abs(hv - (39 + (ck - 2) * 1.4)) < 0.5) return at(C.leaf, 3);
  return at(C.white, hv > 40 && Math.abs(u - hv * 0.6 - 3) < 1.2 ? 3 : 4);
}

// ---------- El cartel "EN EL AIRE" ----------

/** Placa del cartel, relativa al rasgo: grande (dos renglones, en el estudio) o chica (sobre la puerta). */
interface OnAirLayout {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  lines: { text: string; top: number }[];
  s: number;
}

function onAirLayout(f: WallFeature): OnAirLayout {
  const w = (f.width ?? 1) * 16;
  if (f.kind === "studio-door") return { u0: 2.5, u1: w - 2.5, v0: 41, v1: 51, lines: [{ text: "EN EL AIRE", top: 48.5 }], s: 1 };
  return { u0: 3, u1: w - 3, v0: 24, v1: 51, lines: [{ text: "EN EL", top: 47.5 }, { text: "AIRE", top: 35.5 }], s: 2 };
}

/** Rojo de las letras prendidas (más vivo que la paleta: es luz). */
const ON_AIR_RED: RGBA = [255, 84, 64, 255];

/** Color del cartel en (u, hv), prendido o apagado (o null fuera de la placa). */
function onAirAt(f: WallFeature, u: number, hv: number, lit: boolean): RGBA | null {
  const g = onAirLayout(f);
  if (!inRect(u, hv, g.u0, g.v0, g.u1, g.v1)) return null;
  if (u < g.u0 + 1 || u >= g.u1 - 1 || hv < g.v0 + 1 || hv >= g.v1 - 1) return at(C.woodDark, hv >= g.v1 - 1 ? 4 : 2);
  const mid = (g.u0 + g.u1) / 2;
  for (const l of g.lines) if (textOn(l.text, u, hv, mid, l.top, g.s)) return lit ? ON_AIR_RED : at(C.rug, 1);
  // Foquito redondo a la izquierda (rojo prendido) y el vidrio oscuro del cartel.
  if (Math.hypot(u - g.u0 - 3, hv - (g.v0 + g.v1) / 2) < (g.s > 1 ? 1.8 : 1.1)) return lit ? at(C.fire, 4) : at(C.rug, 1);
  return lit ? mix(at(C.night, 1), at(C.rug, 2), 0.35) : at(C.night, 1);
}

/**
 * La puerta acolchada del estudio (3 tiles, en la pared del pasillo del piso 3): el marco, la hoja de
 * cuero con botones y su ventanita redonda, la manija de bronce y, encima, el cartel "EN EL AIRE".
 */
function studioDoorAt(f: WallFeature, u: number, hv: number, day: boolean): RGBA | null {
  const sign = onAirAt(f, u, hv, false);
  if (sign) return sign;
  const u1 = (f.width ?? 1) * 16;
  const d0 = u1 / 2 - 8.5;
  const d1 = u1 / 2 + 8.5;
  const top = 37;
  if (!inRect(u, hv, d0 - 1.5, 0, d1 + 1.5, top + 1.5)) return null;
  if (u < d0 || u >= d1 || hv >= top) return at(C.woodDark, hv >= top + 0.8 || u < d0 - 0.8 ? 4 : 3);
  const du = u - d0;
  const w = d1 - d0;
  // Ventanita redonda (de noche con la luz del estudio).
  const dw = Math.hypot(du - w / 2, hv - 27);
  if (dw < 3.4) return dw > 2.6 ? at(C.gold, 3) : day ? mix(at(C.gold, 4), at(C.cream, 4), 0.5) : at(C.gold, 4);
  // Manija y la placa de la cerradura.
  if (Math.hypot(du - (w - 2.6), hv - 16) < 0.9) return at(C.gold, 5);
  if (Math.abs(du - (w - 2.6)) < 0.5 && hv > 13.5 && hv < 15) return at(C.gold, 2);
  // Acolchado de cuero con botones en rombo.
  const bx = mod(du - 1, 4);
  const by = mod(hv - 2, 4);
  if ((Math.floor((du - 1) / 4) + Math.floor((hv - 2) / 4)) % 2 === 0 && Math.hypot(bx - 2, by - 2) < 0.6) return at(C.woodDark, 1);
  if (du < 0.9 || du > w - 0.9) return at(C.cork, 1);
  return at(C.cork, Math.abs(bx - 2) + Math.abs(by - 2) < 1.2 ? 3 : 2);
}

// ---------- Registro ----------

/** Lo que cuelga en el estudio y la puerta del pasillo (o null si el tipo no es de aquí). */
export function podcastFeature(f: WallFeature, u: number, hv: number, day: boolean): RGBA | null {
  const u1 = (f.width ?? 1) * 16;
  const poster = (inner: (x: number, y: number, w: number, h: number) => RGBA) => framed(u, hv, 2, 20, u1 - 2, 48, inner);
  switch (f.kind) {
    case "onair-sign":
      return onAirAt(f, u, hv, false);
    case "studio-door":
      return studioDoorAt(f, u, hv, day);
    case "poster-planets":
      return poster(planetsAt);
    case "poster-nebula":
      return poster(nebulaAt);
    case "poster-rocket":
      return poster(rocketAt);
    case "star-map":
      return poster(starMapAt);
    case "star-window":
      return starWindowAt(u, hv, u1, day);
    case "poster-campfire":
      return poster(campfireAt);
    case "explore-log":
      return framed(u, hv, 1.5, 21, u1 - 1.5, 48, exploreLogAt);
    case "lanes-map":
      return lanesMapAt(u, hv, u1);
    case "sword-shield":
      return swordShieldAt(u, hv, u1);
    case "poster-hello":
      return framed(u, hv, 2, 20, u1 - 2, 48, helloAt);
    case "poster-duck":
      return poster(duckAt);
    case "diagram-board":
      return diagramAt(u, hv, u1);
    default:
      return null;
  }
}

/**
 * El cartel "EN EL AIRE" prendido, para ponerlo encima de la pared (el cliente lo prende para todos
 * mientras se graba). Coordenadas de arte relativas a la esquina del tile (f.x, f.y) del rasgo: se pone
 * en `worldToScreen(f.x * ts, f.y * ts)` menos (ox, oy). `frame` alterna un poco el brillo.
 */
export function onAirSignSprite(f: WallFeature, frame = 0): Sprite {
  const len = (f.width ?? 1) * 16;
  const g = onAirLayout(f);
  const s = new Escena({ x0: -4, y0: -4, z0: -2, x1: f.edge === "h" ? len + 4 : 6, y1: f.edge === "h" ? 6 : len + 4, z1: 60 }, 2);
  s.borde = false;
  // Punto de la pared (un pelo por delante) para (u, hv): en las paredes oeste `u` corre hacia el norte.
  const put = (u: number, hv: number, c: RGBA) => (f.edge === "h" ? s.plot(u, 0.3, hv, c) : s.plot(0.3, len - u, hv, c));
  for (let u = g.u0 - 2.5; u < g.u1 + 2.5; u += 0.4)
    for (let hv = g.v0 - 2.5; hv < g.v1 + 2.5; hv += 0.4) {
      const c = onAirAt(f, u, hv, true);
      if (c) {
        put(u, hv, c);
        continue;
      }
      // El halo rojo alrededor de la placa.
      const du = Math.max(g.u0 - u, 0, u - g.u1);
      const dv = Math.max(g.v0 - hv, 0, hv - g.v1);
      const d = du + dv;
      if (d < 2.2 + frame * 0.6) put(u, hv, [255, 84, 64, Math.round(Math.max(0, 0.6 - d * 0.22) * 255)]);
    }
  return s.sprite();
}
