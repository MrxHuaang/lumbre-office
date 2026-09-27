// Casa viva: lo que se ve al usar los muebles chicos. Llamas animadas (fogata y chimeneas), la cortina
// cerrada sobre una ventana, el globo que gira, lo que avanza para todos (puzle, pizarra, caballete), la
// luz de "ocupado" del baño y las cosas que se llevan un rato en la mano (libro, regadera, malvavisco
// en su palito). Las capas sobre un mueble tienen el tamaño y el origen de su dibujo (como usables.ts).
import { drawFurniture } from "./furniture";
import { C, OUT, mix } from "./palette";
import { PixelCanvas, alpha, at, flat, hex, noise, renderSprite, type RGBA, type Shader, type Sprite } from "./pixel";

// ---------- Fuego ----------

/** Tamaños de llama: la de la chimenea, la de la fogata y la de la fogata (o chimenea) avivada. */
export type FlameSize = "hearth" | "pit" | "stoked" | "hearth-stoked";
const FLAME: Record<FlameSize, { rx: number; h: number }> = {
  hearth: { rx: 3.2, h: 8 },
  "hearth-stoked": { rx: 4.4, h: 12 },
  pit: { rx: 7.5, h: 19 },
  stoked: { rx: 9.5, h: 27 },
};
/** Cuadros de la animación de la llama. */
export const FLAME_FRAMES = 4;

/**
 * Una llama en capas (de afuera hacia adentro: roja, naranja, amarilla y el corazón casi blanco) que se
 * mece con el cuadro. El origen del lienzo es la base de la llama, al centro (`ox`, `oy`).
 */
export function flame(frame: number, size: FlameSize): Sprite {
  const { rx, h } = FLAME[size];
  const w = Math.ceil(rx * 2 + 8);
  const H = Math.ceil(h + 4);
  const c = new PixelCanvas(w, H);
  const ox = Math.floor(w / 2);
  const oy = H - 2;
  const f = frame % FLAME_FRAMES;
  const layer = (lrx: number, lh: number, col: RGBA, dx = 0) => {
    for (let y = 0; y < lh; y++) {
      const t = y / lh;
      // Se angosta hacia la punta y se mece: más arriba, más se corre (cada cuadro, hacia otro lado).
      const lw = lrx * Math.sin((1 - t) * Math.PI * 0.55 + 0.05) * (1 - t * 0.2);
      const sway = Math.sin(y * 0.7 + f * 1.6) * t * 2.2 + (f % 2 ? 0.5 : -0.5) * t;
      for (let x = -lw; x <= lw; x++) c.set(Math.round(ox + dx + x + sway), Math.round(oy - y), col);
    }
  };
  const jitter = (k: number) => 1 + (noise(f, k, 31) - 0.5) * 0.18;
  layer(rx, h * jitter(1), at(C.fire, 1));
  layer(rx * 0.78, h * 0.83 * jitter(2), at(C.fire, 2));
  layer(rx * 0.56, h * 0.66 * jitter(3), at(C.fire, 3), f % 2 ? 1 : 0);
  layer(rx * 0.34, h * 0.44 * jitter(4), at(C.fire, 4));
  layer(Math.max(0.8, rx * 0.16), h * 0.22, at(C.white, 4));
  // Lengüitas sueltas arriba (una por cuadro, en otro lugar).
  const tx = ox + Math.round((noise(f, 7, 13) - 0.5) * rx);
  const ty = Math.round(oy - h * (0.9 + noise(f, 8, 13) * 0.2));
  c.set(tx, ty, at(C.fire, 3));
  c.set(tx, ty - 1, at(C.fire, 2));
  return { canvas: c, ox, oy };
}

// ---------- Cortinas ----------

/**
 * La cortina cerrada sobre una ventana (el tipo "window" de room.ts): dos paños con pliegues que se juntan
 * al medio, colgados de la barra dorada. `edge` "h" = pared norte (cara +y), "v" = pared oeste (cara +x).
 * El origen es la esquina de la ventana (su tile en el borde de la pared).
 */
export function curtainClosed(edge: "h" | "v", width: number): Sprite {
  const len = width * 16;
  const shade: Shader = (u, v, fw) => {
    if (v >= 28.5) return at(C.gold, v >= 29.5 ? 4 : 2);
    const mid = fw / 2;
    const seam = Math.abs(u - mid) < 0.8;
    const fold = Math.floor(u + (u > mid ? 1 : 0)) % 4;
    // El dobladillo de abajo y los pliegues: tres tonos que se repiten.
    if (v < 1.2) return at(C.curtain, 1);
    if (seam) return at(C.curtain, 0);
    return at(C.curtain, fold === 0 ? 1 : fold === 1 ? 3 : fold === 2 ? 4 : 2);
  };
  const box =
    edge === "h"
      ? { x: 1, y: -0.6, z: 19, w: len - 2, d: 0.6, h: 30, left: shade, top: flat(at(C.curtain, 2)) }
      : { x: -0.6, y: 1, z: 19, w: 0.6, d: len - 2, h: 30, right: shade, top: flat(at(C.curtain, 2)) };
  return renderSprite([box], { outline: OUT });
}

// ---------- Capas sobre el dibujo de un mueble ----------

function layerOf(type: string): { base: Sprite; out: Sprite } {
  const base = drawFurniture(type, "front");
  return { base, out: { canvas: new PixelCanvas(base.canvas.width, base.canvas.height), ox: base.ox, oy: base.oy } };
}

const colorAt = (c: PixelCanvas, x: number, y: number): RGBA => {
  const i = (y * c.width + x) * 4;
  return [c.data[i]!, c.data[i + 1]!, c.data[i + 2]!, c.data[i + 3]!];
};
const same = (a: RGBA, b: RGBA) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/** Los píxeles del dibujo que tienen exactamente ese color (la tela de la pizarra, lo que falta del puzle…). */
function pixelsOf(base: Sprite, col: RGBA): [number, number][] {
  const out: [number, number][] = [];
  const c = base.canvas;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (c.alphaAt(x, y) && same(colorAt(c, x, y), col)) out.push([x, y]);
  return out;
}

/**
 * Lo que avanza para todos, pintado sobre el mueble según el contador (0..max):
 * - `puzzle-table`: las piezas que faltan se van poniendo (de a bloques de 2x2, en orden salteado);
 * - `cafe-sign`: renglones de tiza que se garabatean uno tras otro;
 * - `easel`: el boceto a lápiz se va pintando de izquierda a derecha.
 * Devuelve null si no hay nada que pintar (0, o un tipo sin capa).
 */
export function progressLayer(type: string, n: number, max: number): Sprite | null {
  if (n <= 0) return null;
  const frac = Math.min(1, n / Math.max(1, max));
  const { base, out } = layerOf(type);
  const c = out.canvas;
  if (type === "puzzle-table") {
    const px = pixelsOf(base, at(C.green, 1));
    if (!px.length) return null;
    const minY = Math.min(...px.map((p) => p[1]));
    const maxY = Math.max(...px.map((p) => p[1]));
    // Bloques de 2x2 en un orden salteado (el mismo siempre): cada pieza nueva cae en otro lado.
    const blockOf = (x: number, y: number) => (x >> 1) * 1000 + (y >> 1);
    const order = (b: number) => noise(Math.floor(b / 1000), b % 1000, 11);
    const blocks = [...new Set(px.map(([x, y]) => blockOf(x, y)))].sort((a, b) => order(a) - order(b));
    const done = new Set(blocks.slice(0, Math.round(blocks.length * frac)));
    for (const [x, y] of px) {
      if (!done.has(blockOf(x, y))) continue;
      const t = (y - minY) / Math.max(1, maxY - minY);
      const pic = t < 0.35 ? C.fire : t < 0.55 ? C.gold : t < 0.8 ? C.violet : C.leaf;
      c.set(x, y, at(pic, (x + y) % 2 ? 3 : 2));
    }
    return out;
  }
  if (type === "cafe-sign") {
    const px = pixelsOf(base, at(C.green, 0));
    if (!px.length) return null;
    // Renglones a lo largo de la cara (en la cara +x, z constante ↔ x/2 + y constante en pantalla).
    const line = (x: number, y: number) => Math.floor((x / 2 + y) / 2.5);
    const lines = [...new Set(px.map(([x, y]) => line(x, y)))].sort((a, b) => a - b);
    const lit = new Set(lines.slice(1, 1 + Math.ceil((lines.length - 2) * frac)));
    const inks = [at(C.cream, 5), hex("#f4a5b5"), at(C.sky, 3), at(C.gold, 4)];
    for (const [x, y] of px) {
      const l = line(x, y);
      if (!lit.has(l) || (x / 2 + y) % 2.5 > 1.1) continue;
      // Cada renglón con su largo y sus cortes (palabras garabateadas).
      if (noise(Math.floor(x / 3), l, 23) < 0.3) continue;
      c.set(x, y, inks[l % inks.length]!);
    }
    return out;
  }
  if (type === "easel") {
    const px = pixelsOf(base, at(C.cream, 5));
    if (!px.length) return null;
    const minX = Math.min(...px.map((p) => p[0]));
    const maxX = Math.max(...px.map((p) => p[0]));
    const edge = minX + (maxX - minX + 1) * frac;
    // Arriba cielo, abajo el pasto (en pantalla: más alto = menos x/2 + y).
    const mid = Math.min(...px.map((p) => p[0] / 2 + p[1])) + 6;
    for (const [x, y] of px) {
      if (x + noise(0, y, 4) * 1.5 > edge) continue;
      const h = x / 2 + y;
      c.set(x, y, h < mid ? at(C.sky, (x + y) % 3 ? 2 : 3) : at(C.leaf, (x + y) % 3 ? 3 : 4));
    }
    return out;
  }
  return null;
}

/**
 * El globo terráqueo girando: los colores de la esfera (mar, tierra, casquetes) se corren de a `k`
 * píxeles por fila, así los continentes pasan de un lado al otro. El soporte queda igual.
 */
export function globeSpin(k: number): Sprite {
  const { base, out } = layerOf("globe");
  const c = base.canvas;
  const isSphere = (col: RGBA) => {
    const [r, g, b] = col;
    return b > r + 25 || (g > r + 8 && g > b) || (r > 200 && g > 200 && b > 200) || (r > 190 && g > 150 && b < 110);
  };
  for (let y = 0; y < c.height; y++) {
    const row: number[] = [];
    for (let x = 0; x < c.width; x++) if (c.alphaAt(x, y) && isSphere(colorAt(c, x, y))) row.push(x);
    if (row.length < 3) continue;
    for (let i = 0; i < row.length; i++) {
      const from = row[(i + k * 2 + row.length * 4) % row.length]!;
      out.canvas.set(row[i]!, y, colorAt(c, from, y));
    }
  }
  return out;
}

// ---------- Baños ----------

/** La luz del cubículo: verde libre, roja ocupado (con un brillito). */
export function stallLight(busy: boolean): PixelCanvas {
  const c = new PixelCanvas(7, 7);
  const col = busy ? hex("#e5484d") : hex("#5ea247");
  c.ellipse(3.5, 3.5, 2.6, 2.6, col);
  c.set(2, 2, mix(col, hex("#ffffff"), 0.6));
  c.outline(OUT);
  return c;
}

/** Una burbuja de jabón (se ve por el borde claro y el brillo). */
export function soapBubble(big = false): PixelCanvas {
  const s = big ? 6 : 4;
  const c = new PixelCanvas(s, s);
  const rim = alpha(hex("#e8fbff"), 0.9);
  const r = s / 2;
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const d = Math.hypot(x + 0.5 - r, y + 0.5 - r);
      if (d <= r && d > r - 1.1) c.set(x, y, rim);
      else if (d <= r - 1.1) c.set(x, y, alpha(hex("#bfe8ff"), 0.25));
    }
  c.set(1, 1, hex("#ffffff"));
  return c;
}

/** Gota de agua. */
export function waterDrop(): PixelCanvas {
  const c = new PixelCanvas(3, 4);
  c.set(1, 0, at(C.sky, 3));
  c.rect(0, 1, 3, 2, at(C.sky, 2));
  c.set(1, 3, at(C.sky, 1));
  c.set(0, 1, at(C.sky, 4));
  return c;
}

/** Chispa de la fogata (un píxel con su brillo). */
export function spark(hot: boolean): PixelCanvas {
  const c = new PixelCanvas(2, 2);
  c.set(0, 0, at(C.fire, hot ? 4 : 3));
  c.set(1, 0, alpha(at(C.fire, 2), 0.6));
  c.set(0, 1, alpha(at(C.fire, 2), 0.6));
  return c;
}

// ---------- Lo que se lleva un rato en la mano ----------

const BOOK_COVERS = [C.rug, C.fabric, C.green, C.violet, C.mustard];

/** Libro abierto (tapas del color de la semilla), con renglones en las páginas. */
export function openBook(seed: number): PixelCanvas {
  const cover = BOOK_COVERS[Math.abs(seed) % BOOK_COVERS.length]!;
  const c = new PixelCanvas(11, 8);
  c.rect(1, 5, 9, 2, at(cover, 2));
  c.rect(1, 1, 4, 5, at(C.cream, 4));
  c.rect(6, 1, 4, 5, at(C.cream, 5));
  c.rect(5, 1, 1, 6, at(cover, 1));
  for (const y of [2, 4]) {
    c.rect(2, y, 2, 1, at(C.cream, 1));
    c.rect(7, y, 2, 1, at(C.cream, 2));
  }
  c.outline(OUT);
  return c;
}

/** Regadera de lata inclinada (el pico hacia la izquierda, para regar hacia adelante). */
export function wateringCan(): PixelCanvas {
  const c = new PixelCanvas(14, 10);
  const m = C.green;
  c.rect(5, 3, 6, 5, at(m, 3));
  c.rect(5, 3, 6, 1, at(m, 4));
  c.rect(5, 7, 6, 1, at(m, 1));
  // Asa arriba y el pico largo.
  c.rect(6, 1, 4, 1, at(m, 2));
  c.set(6, 2, at(m, 2));
  c.set(9, 2, at(m, 2));
  c.line(5, 5, 1, 2, at(m, 2));
  c.line(5, 6, 2, 3, at(m, 3));
  c.rect(0, 1, 2, 2, at(C.metal, 4));
  c.outline(OUT);
  return c;
}

/**
 * El palito con el malvavisco asándose: `toast` 0 blanco, 1 tostadito, 2 dorado, 3 con la punta quemada.
 * El palito sale de la mano (abajo a la derecha) y apunta a la izquierda y arriba (el cliente lo voltea).
 */
export function roastStick(toast: 0 | 1 | 2 | 3): PixelCanvas {
  const c = new PixelCanvas(16, 9);
  c.line(15, 8, 4, 3, at(C.wood, 2));
  const tones = [hex("#fff6e6"), hex("#f3d9a8"), hex("#d9923e"), hex("#8a5530")];
  c.rect(1, 1, 4, 3, tones[toast]!);
  c.rect(1, 1, 4, 1, mix(tones[toast]!, hex("#ffffff"), 0.4));
  if (toast === 3) c.set(1, 3, hex("#3a2014"));
  c.outline(OUT);
  return c;
}
