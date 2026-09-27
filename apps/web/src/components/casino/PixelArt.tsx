"use client";

// Piezas pixel del casino para la UI: números con la tipografía de 5x7 del paño (en SVG, nítidos a
// cualquier escala entera) y dibujos del motor pixel (fichas) como imagen.
import { textMask, type PixelCanvas } from "@hyvento/map/art";
import { useEffect, useMemo, useState } from "react";
import { toHtmlCanvas } from "@/game/iso/canvas";

/**
 * Texto con la tipografía pixel del casino. `scale` = píxeles por punto (1 o 2 se leen perfecto);
 * con `outline` lleva un borde de un punto, como en el paño.
 */
export function PixelNumber({
  value,
  scale = 2,
  color = "currentColor",
  outline,
  className = "",
  label,
}: {
  value: string | number;
  scale?: number;
  color?: string;
  outline?: string;
  className?: string;
  /** Texto para lectores de pantalla (por defecto, el mismo valor). */
  label?: string;
}) {
  const text = String(value);
  const { w, h, lit, edge } = useMemo(() => {
    const m = textMask(text);
    const pad = outline ? 1 : 0;
    const lit: [number, number][] = [];
    const edge: [number, number][] = [];
    for (let y = -pad; y < m.h + pad; y++)
      for (let x = -pad; x < m.w + pad; x++) {
        if (m.on(x, y)) lit.push([x + pad, y + pad]);
        else if (pad && (m.on(x - 1, y) || m.on(x + 1, y) || m.on(x, y - 1) || m.on(x, y + 1))) edge.push([x + pad, y + pad]);
      }
    return { w: m.w + pad * 2, h: m.h + pad * 2, lit, edge };
  }, [text, outline]);
  return (
    <svg
      role="img"
      aria-label={label ?? text}
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      className={`inline-block shrink-0 ${className}`}
    >
      {outline && edge.map(([x, y]) => <rect key={`o${x},${y}`} x={x} y={y} width={1} height={1} fill={outline} />)}
      {lit.map(([x, y]) => (
        <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill={color} />
      ))}
    </svg>
  );
}

/** Un dibujo del motor pixel como imagen ampliada sin suavizar (`id` identifica el dibujo). */
export function ArtImage({ id, make, scale = 2, className = "", alt = "" }: { id: string; make: () => PixelCanvas; scale?: number; className?: string; alt?: string }) {
  const [art, setArt] = useState<{ id: string; url: string; w: number; h: number } | null>(null);
  useEffect(() => {
    // Se dibuja solo en el navegador (el lienzo no existe al renderizar en el servidor).
    const px = make();
    setArt({ id, url: toHtmlCanvas(px).toDataURL(), w: px.width, h: px.height });
    // `make` cambia en cada render; el dibujo depende solo de `id`.
  }, [id]);
  if (!art || art.id !== id) return <span className={`inline-block ${className}`} />;
  return <img src={art.url} alt={alt} width={art.w * scale} height={art.h * scale} className={`[image-rendering:pixelated] ${className}`} draggable={false} />;
}
