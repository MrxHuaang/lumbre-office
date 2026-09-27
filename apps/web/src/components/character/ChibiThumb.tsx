"use client";

import type { SheetDirection } from "@hyvento/map/art";
import type { LookInput } from "@hyvento/shared";
import { useEffect, useRef } from "react";
import { CROPS, lookKey, thumbImage, type Crop } from "./sprites";

export type { Crop };

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
    // Se copian los píxeles del recorte directo (sin un <canvas> intermedio por look): al arrastrar un
    // color se redibujan todas las miniaturas de la pestaña.
    ref.current?.getContext("2d")?.putImageData(thumbImage(look, key, dir, crop), 0, 0);
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
