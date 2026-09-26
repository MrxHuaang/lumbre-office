"use client";

import { FRAME, type SheetDirection } from "@hyvento/map/art";
import type { LookInput } from "@hyvento/shared";
import { useEffect, useRef } from "react";
import { dirIndex, lookKey, walkPixels } from "./sprites";

/**
 * Recortes del frame de 32x32 (el cuerpo va de x=8 a 24 y de y=3 a 30) y su escala entera en la
 * miniatura: así cada píxel del chibi mide lo mismo y no se ve borroso.
 */
export const CROPS = {
  head: { x: 7, y: 2, w: 18, h: 18, scale: 3 },
  torso: { x: 6, y: 5, w: 20, h: 20, scale: 3 },
  body: { x: 5, y: 2, w: 22, h: 30, scale: 2 },
  legs: { x: 6, y: 19, w: 20, h: 13, scale: 3 },
} as const;
export type Crop = keyof typeof CROPS;

/** Mini chibi (un frame quieto) recortado a la parte que interesa: la cabeza, el torso, los pies… */
export function ChibiThumb({
  look,
  crop,
  dir = "right",
  className = "",
}: {
  look: LookInput;
  crop: Crop;
  dir?: SheetDirection;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const r = CROPS[crop];
  const key = lookKey(look);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    // Se copian los píxeles del recorte directo (sin un <canvas> intermedio por look): al arrastrar un
    // color se redibujan todas las miniaturas de la pestaña.
    const px = walkPixels(look, key);
    const img = ctx.createImageData(r.w, r.h);
    const top = dirIndex(dir) * FRAME + r.y;
    for (let y = 0; y < r.h; y++) {
      const from = ((top + y) * px.width + r.x) * 4;
      img.data.set(px.data.subarray(from, from + r.w * 4), y * r.w * 4);
    }
    ctx.putImageData(img, 0, 0);
    // `look` cambia de objeto en cada render; lo que importa es su clave.
  }, [key, dir, crop]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      width={r.w}
      height={r.h}
      className={`pixelated block ${className}`}
      style={{ width: r.w * r.scale, height: r.h * r.scale }}
    />
  );
}
