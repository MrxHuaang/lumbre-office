// Pixel art dibujado a mano (docs/arte/estandar-arte.md): cada pieza es una grilla de letras, una por píxel, con
// su leyenda de colores. Nada de primitivas: la silueta, cada tono, cada brillo y el contorno se eligen a
// propósito. Los tonos de un material van con dígitos (0 el más oscuro, 5 el más claro), así una misma
// grilla sirve con otra rampa (un roble verde y uno oliva).
import { OUT, SHADOW, mix } from "./palette";
import { PixelCanvas, alpha, at, type Ramp, type RGBA, type Sprite } from "./pixel";

export type Legend = Record<string, RGBA>;

/** Lo que no se pinta en una grilla. */
const EMPTY = new Set([".", " "]);

/**
 * Sprite desde una grilla de letras. `ox`/`oy` es dónde queda el origen del mueble (la esquina del fondo de
 * su lugar) dentro de la grilla, igual que en los demás sprites. Con `mirror`, la grilla se voltea en
 * horizontal con su origen (ojo: la luz queda viniendo de la derecha; para lo simétrico o lo que no tiene luz). Una letra sin color es un error,
 * para que un dedazo no pase callado.
 */
export function gridSprite(rows: readonly string[], legend: Legend, ox: number, oy: number, mirror = false): Sprite {
  return { canvas: gridCanvas(rows, legend, mirror), ox: mirror ? gridWidth(rows) - ox : ox, oy };
}

export const gridWidth = (rows: readonly string[]) => Math.max(...rows.map((r) => r.length));

/** Solo el lienzo de una grilla (para lo que no es mueble, o para estampar encima de otro). */
export function gridCanvas(rows: readonly string[], legend: Legend, mirror = false): PixelCanvas {
  const w = gridWidth(rows);
  const c = new PixelCanvas(w, rows.length);
  stamp(c, rows, legend, 0, 0, mirror);
  return c;
}

/** Pinta una grilla sobre un lienzo con su esquina de arriba a la izquierda en (x0, y0). */
export function stamp(c: PixelCanvas, rows: readonly string[], legend: Legend, x0: number, y0: number, mirror = false) {
  const w = gridWidth(rows);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      if (EMPTY.has(ch)) continue;
      const col = legend[ch];
      if (!col) throw new Error(`Letra sin color en la grilla: "${ch}" (fila ${y}: ${row})`);
      c.set(x0 + (mirror ? w - 1 - x : x), y0 + y, col);
    }
  });
}

/** Los seis tonos de una rampa con los dígitos del 0 (oscuro) al 5 (claro). */
export function rampLegend(r: Ramp, digits = "012345"): Legend {
  const out: Legend = {};
  [...digits].forEach((d, i) => (out[d] = at(r, i)));
  return out;
}

/** Contorno cálido de un material: su tono más oscuro tirado hacia el café del contorno. */
export const edgeOf = (r: Ramp, k = 0.4): RGBA => mix(at(r, 0), OUT, k);

/** Sombra en el piso, para las letras de sombra de una grilla. */
export const groundShadow = (a = 0.3): RGBA => alpha(SHADOW, a);
