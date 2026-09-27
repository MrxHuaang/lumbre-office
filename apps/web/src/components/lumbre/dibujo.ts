"use client";

// De píxeles del motor a una imagen recortada al dibujo (sin el relleno vacío de alrededor), para
// mostrarla con <img> y ubicar cosas encima en porcentajes.
import type { PixelCanvas } from "@hyvento/map/art";
import { toHtmlCanvas } from "@/game/iso/canvas";

export interface Dibujo {
  src: string;
  /** Tamaño del recorte, en píxeles del motor. */
  w: number;
  h: number;
  /** Esquina del recorte dentro del lienzo original (para pasar coordenadas del lienzo al recorte). */
  x0: number;
  y0: number;
}

export function recortar(px: PixelCanvas, margen = 2): Dibujo {
  let minX = px.width;
  let minY = px.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < px.height; y++)
    for (let x = 0; x < px.width; x++)
      if (px.data[(y * px.width + x) * 4 + 3]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  if (maxX < 0) return { src: toHtmlCanvas(px).toDataURL(), w: px.width, h: px.height, x0: 0, y0: 0 };
  const x0 = Math.max(0, minX - margen);
  const y0 = Math.max(0, minY - margen);
  const w = Math.min(px.width, maxX + margen + 1) - x0;
  const h = Math.min(px.height, maxY + margen + 1) - y0;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.drawImage(toHtmlCanvas(px), x0, y0, w, h, 0, 0, w, h);
  return { src: out.toDataURL(), w, h, x0, y0 };
}

/** ¿La persona pidió menos movimiento? (en el servidor, o si no se puede saber, se asume que no). */
export function prefiereQuieto(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
