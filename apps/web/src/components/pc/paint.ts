// Lógica del lienzo de la Pintura (sin React): el lienzo es un arreglo de 256 índices de la paleta.
import { BLANK_PAINTING, PAINTING, PAINTING_PIXELS } from "@hyvento/shared";

export type Canvas = readonly number[];

export const blankCanvas = (): number[] => Array.from({ length: PAINTING_PIXELS }, () => 0);

/** Lienzo → los 256 dígitos hexadecimales que guarda la API. */
export const encodeCanvas = (c: Canvas): string => c.map((i) => (i & 15).toString(16)).join("");

/** Los dígitos de un cuadro guardado → lienzo (lo que no se entiende queda en blanco). */
export function decodeCanvas(pixels: string): number[] {
  const src = pixels.length === PAINTING_PIXELS ? pixels : BLANK_PAINTING;
  return Array.from(src, (ch) => {
    const n = parseInt(ch, 16);
    return Number.isNaN(n) ? 0 : n;
  });
}

/** Pinta un píxel (devuelve el mismo lienzo si no cambia nada, para no llenar el historial). */
export function paintAt(c: Canvas, i: number, color: number): Canvas {
  if (i < 0 || i >= c.length || c[i] === color) return c;
  const next = c.slice();
  next[i] = color;
  return next;
}

/** Balde: rellena la mancha del mismo color que toca `i` (4 vecinos, sin cruzar en diagonal). */
export function floodFill(c: Canvas, i: number, color: number): Canvas {
  const n = PAINTING.size;
  const from = c[i];
  if (from === undefined || from === color) return c;
  const next = c.slice();
  const stack = [i];
  while (stack.length) {
    const j = stack.pop()!;
    if (next[j] !== from) continue;
    next[j] = color;
    const x = j % n;
    if (x > 0) stack.push(j - 1);
    if (x < n - 1) stack.push(j + 1);
    if (j >= n) stack.push(j - n);
    if (j < n * (n - 1)) stack.push(j + n);
  }
  return next;
}

/** Espejo horizontal (para pintar simétrico sin hacerlo dos veces). */
export function flipCanvas(c: Canvas): Canvas {
  const n = PAINTING.size;
  return c.map((_, j) => c[Math.floor(j / n) * n + (n - 1 - (j % n))]!);
}

export const isBlankCanvas = (c: Canvas) => c.every((i) => i === 0);

/** Píxeles de la recta entre dos píxeles (Bresenham): un arrastre rápido no deja huecos en el trazo. */
export function lineBetween(a: number, b: number): number[] {
  const n = PAINTING.size;
  let [x0, y0] = [a % n, Math.floor(a / n)];
  const [x1, y1] = [b % n, Math.floor(b / n)];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const out: number[] = [];
  for (;;) {
    out.push(y0 * n + x0);
    if (x0 === x1 && y0 === y1) return out;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}
