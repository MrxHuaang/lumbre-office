// Tipografía pixel propia de 5x7 para el casino (paño, rueda, fichas, cartas, historial). Pensada para
// leerse a escala 1 y 2 sin confundir dígitos: el 1 lleva base y el 7 va inclinado, el 3 es plano a la
// izquierda (el 8 no), el 6 y el 9 se abren hacia lados distintos y el 0 va cruzado (ni 8 ni O).
import type { PixelCanvas, RGBA } from "./pixel";

export const GLYPH_H = 7;

/** Dígitos 0–9: todos de 5 de ancho, así las cifras quedan alineadas en columnas. */
export const DIGITS: readonly (readonly string[])[] = [
  [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  ["..#..", ".##..", "#.#..", "..#..", "..#..", "..#..", "#####"],
  [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
];

/** Letras y signos (para los rótulos del paño, el arco del blackjack y las cartas). */
const LETTERS: Record<string, readonly string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["###", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "-": ["...", "...", "...", "###", "...", "...", "..."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  ":": ["..", "##", "##", "..", "##", "##", ".."],
  ".": [".", ".", ".", ".", ".", ".", "#"],
  "!": ["#", "#", "#", "#", "#", ".", "#"],
  "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  " ": ["...", "...", "...", "...", "...", "...", "..."],
};

/** Dibujo de un carácter (en mayúsculas; los dígitos salen de DIGITS). */
export function glyph(ch: string): readonly string[] | undefined {
  if (ch >= "0" && ch <= "9") return DIGITS[ch.charCodeAt(0) - 48];
  return LETTERS[ch.toUpperCase()];
}

export interface TextOptions {
  /** Píxeles por punto del dibujo (1 o 2). */
  scale?: number;
  /** Separación entre caracteres, en puntos. */
  gap?: number;
}

/** Ancho en píxeles de un texto (los caracteres que no existen no ocupan lugar). */
export function textWidth(text: string, { scale = 1, gap = 1 }: TextOptions = {}): number {
  let w = 0;
  let n = 0;
  for (const ch of text) {
    const g = glyph(ch);
    if (!g) continue;
    w += g[0]!.length;
    n++;
  }
  return n === 0 ? 0 : (w + gap * (n - 1)) * scale;
}

/** ¿Está prendido el punto (x, y) del texto? (coordenadas en puntos, desde la esquina de arriba). */
export function textMask(text: string, gap = 1): { w: number; h: number; on: (x: number, y: number) => boolean } {
  const cols: boolean[][] = [];
  let first = true;
  for (const ch of text) {
    const g = glyph(ch);
    if (!g) continue;
    if (!first) for (let k = 0; k < gap; k++) cols.push(new Array(GLYPH_H).fill(false));
    first = false;
    for (let x = 0; x < g[0]!.length; x++) cols.push(g.map((row) => row[x] === "#"));
  }
  return { w: cols.length, h: GLYPH_H, on: (x, y) => cols[x]?.[y] ?? false };
}

export interface DrawTextOptions extends TextOptions {
  /** Contorno de 1 píxel alrededor de las letras (para leerse sobre el paño o los colores). */
  outline?: RGBA;
  /** Sombra sólida abajo a la derecha, de 1 píxel. */
  shadow?: RGBA;
}

/**
 * Escribe `text` con la esquina de arriba a la izquierda en (x, y). Con `outline` o `shadow` primero
 * se pinta el borde y después las letras, así nunca tapan un trazo.
 */
export function drawText(c: PixelCanvas, text: string, x: number, y: number, color: RGBA, opts: DrawTextOptions = {}) {
  const s = opts.scale ?? 1;
  const m = textMask(text, opts.gap ?? 1);
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const lit = (px: number, py: number) => m.on(Math.floor((px - x0) / s), Math.floor((py - y0) / s)) && px >= x0 && py >= y0;
  if (opts.outline || opts.shadow) {
    for (let py = y0 - 1; py <= y0 + m.h * s + 1; py++)
      for (let px = x0 - 1; px <= x0 + m.w * s + 1; px++) {
        if (lit(px, py)) continue;
        if (opts.shadow && lit(px - 1, py - 1)) c.set(px, py, opts.shadow);
        else if (opts.outline && (lit(px - 1, py) || lit(px + 1, py) || lit(px, py - 1) || lit(px, py + 1))) c.set(px, py, opts.outline);
      }
  }
  for (let py = 0; py < m.h * s; py++) for (let px = 0; px < m.w * s; px++) if (m.on(Math.floor(px / s), Math.floor(py / s))) c.set(x0 + px, y0 + py, color);
}

/** Como `drawText`, pero centrado en (cx, cy). Devuelve la caja que ocupó. */
export function drawTextCentered(c: PixelCanvas, text: string, cx: number, cy: number, color: RGBA, opts: DrawTextOptions = {}) {
  const s = opts.scale ?? 1;
  const w = textWidth(text, opts);
  const h = GLYPH_H * s;
  const x = Math.round(cx - w / 2);
  const y = Math.round(cy - h / 2);
  drawText(c, text, x, y, color, opts);
  return { x, y, w, h };
}

/** Dígitos mini de 3x5, para cuando los de 5x7 no caben (los números de la rueda con poco zoom). */
const TINY_DIGITS: readonly (readonly string[])[] = [
  ["###", "#.#", "#.#", "#.#", "###"],
  [".#.", "##.", ".#.", ".#.", "###"],
  ["###", "..#", "###", "#..", "###"],
  ["###", "..#", ".##", "..#", "###"],
  ["#.#", "#.#", "###", "..#", "..#"],
  ["###", "#..", "###", "..#", "###"],
  ["###", "#..", "###", "#.#", "###"],
  ["###", "..#", ".#.", ".#.", ".#."],
  ["###", "#.#", "###", "#.#", "###"],
  ["###", "#.#", "###", "..#", "###"],
];
export const TINY_GLYPH_W = 3;
export const TINY_GLYPH_H = 5;

/** Escribe un número con los dígitos mini, centrado en (cx, cy), con contorno de 1 píxel. */
export function drawTinyNumberCentered(c: PixelCanvas, text: string, cx: number, cy: number, color: RGBA, outline?: RGBA) {
  const w = text.length * (TINY_GLYPH_W + 1) - 1;
  const x0 = Math.round(cx - w / 2);
  const y0 = Math.round(cy - TINY_GLYPH_H / 2);
  const lit = (x: number, y: number) => {
    const k = Math.floor((x - x0) / (TINY_GLYPH_W + 1));
    const gx = x - x0 - k * (TINY_GLYPH_W + 1);
    const d = TINY_DIGITS[Number(text[k])];
    return x >= x0 && y >= y0 && k < text.length && gx < TINY_GLYPH_W && d?.[y - y0]?.[gx] === "#";
  };
  if (outline)
    for (let y = y0 - 1; y <= y0 + TINY_GLYPH_H; y++)
      for (let x = x0 - 1; x <= x0 + w; x++) if (!lit(x, y) && (lit(x - 1, y) || lit(x + 1, y) || lit(x, y - 1) || lit(x, y + 1))) c.set(x, y, outline);
  for (let y = y0; y < y0 + TINY_GLYPH_H; y++) for (let x = x0; x < x0 + w; x++) if (lit(x, y)) c.set(x, y, color);
}
