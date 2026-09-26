// Piezas comunes para dibujar muebles (sombras, patas, cojines, palos inclinados, formas redondas).
// Coordenadas locales de arte (tile = 16).
import { C, SHADOW } from "./palette";
import { alpha, at, bayer, floorDiamond, solidBox, type Box, type PixelCanvas, type Project, type Ramp, type RGBA } from "./pixel";

export type Variant = "front" | "back";

export const shadowUnder =
  (x: number, y: number, w: number, d: number, a = 0.3) =>
  (c: PixelCanvas, p: Project) =>
    floorDiamond(c, p, x - 1, y - 1, w + 3, d + 3, alpha(SHADOW, a));

/** Sombra redonda en el piso, centrada en (x, y) y de radio `r` en unidades de arte. */
export const roundShadow =
  (x: number, y: number, r: number, a = 0.3) =>
  (c: PixelCanvas, p: Project) => {
    const q = p(x, y);
    c.ellipse(q.x, q.y, r * 1.42, r * 0.71, alpha(SHADOW, a));
  };

/** Caja invisible: solo reserva espacio en el lienzo (hojas, vapor, llamas). */
export const volume = (x: number, y: number, z: number, w: number, d: number, h: number): Box => ({ x, y, z, w, d, h });

/** Cojín: bordes con ribete y la cara superior con un leve tramado. */
export const cushion = (x: number, y: number, z: number, w: number, d: number, h: number, r: Ramp): Box => ({
  x,
  y,
  z,
  w,
  d,
  h,
  top: (u, v, fw, fh) =>
    at(r, u < 1 || v < 1 || u >= fw - 1 || v >= fh - 1 ? 3 : 4 - (bayer(Math.floor(u), Math.floor(v)) < 0.1 ? 1 : 0)),
  left: (_u, v, _fw, fh) => at(r, v >= fh - 1 ? 3 : 2),
  right: (_u, v, _fw, fh) => at(r, v >= fh - 1 ? 2 : 1),
});

export const leg = (x: number, y: number, h: number, r: Ramp = C.woodDark) => solidBox({ x, y, z: 0, w: 2, d: 2, h }, r, 3);

/**
 * Palo inclinado de sección `t` entre dos puntos, armado con cajitas escalonadas (patas de
 * caballete, trípodes). Se devuelven de atrás hacia adelante para que el orden de pintado cuadre.
 */
export function slant(from: [number, number, number], to: [number, number, number], t: number, r: Ramp, base = 3): Box[] {
  const [x0, y0, z0] = from;
  const [x1, y1, z1] = to;
  const n = Math.max(1, Math.ceil(Math.abs(z1 - z0) / 1.5));
  const boxes: Box[] = [];
  for (let i = 0; i < n; i++) {
    const k = i / n;
    const x = x0 + (x1 - x0) * k;
    const y = y0 + (y1 - y0) * k;
    const z = z0 + (z1 - z0) * k;
    const h = Math.abs(z1 - z0) / n + 0.6;
    boxes.push(solidBox({ x: x - t / 2, y: y - t / 2, z: z1 > z0 ? z : z - h, w: t, d: t, h }, r, base));
  }
  return boxes.sort((a, b) => a.x + a.y - (b.x + b.y) || a.z - b.z);
}

/**
 * Relleno de una elipse en pantalla con el color que dé `shade` (recibe la posición relativa
 * normalizada, -1..1, y el píxel). Para domos, gotas y cuerpos redondeados.
 */
export function blob(
  c: PixelCanvas,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  shade: (nx: number, ny: number, x: number, y: number) => RGBA | null,
) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const col = shade(nx, ny, x, y);
      if (col) c.set(x, y, col);
    }
}

/** Tono de una rampa para una superficie redonda con luz desde arriba a la izquierda (con tramado). */
export function roundTone(r: Ramp, nx: number, ny: number, x: number, y: number, base = 3, spread = 1.6): RGBA {
  const light = -(nx * 0.55 + ny * 0.8);
  return at(r, base + Math.round(light * spread + (bayer(x, y) - 0.5) * 0.7));
}
