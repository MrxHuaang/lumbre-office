"use client";

// Piezas comunes de los paneles de mundo lleno: el dibujo de un objeto de la mano ampliado y cuántas
// unidades de algo hay en la mochila.
import type { PixelCanvas } from "@hyvento/map/art";
import { objItemId } from "@hyvento/shared";
import { useEffect, useMemo, useState } from "react";
import { useBagStore } from "@/game/bag";
import { toHtmlCanvas } from "@/game/iso/canvas";

const cache = new Map<string, string>();

/** Un dibujo de píxeles como imagen ampliada sin suavizar (se guarda por clave). */
export function PixelImg({ id, draw, size = 40, className = "" }: { id: string; draw: () => PixelCanvas; size?: number; className?: string }) {
  const [src, setSrc] = useState(() => cache.get(id) ?? null);
  useEffect(() => {
    if (cache.has(id)) return setSrc(cache.get(id)!);
    const url = toHtmlCanvas(draw()).toDataURL();
    cache.set(id, url);
    setSrc(url);
  }, [id, draw]);
  return src ? <img src={src} alt="" width={size} height={size} className={`object-contain [image-rendering:pixelated] ${className}`} /> : <span style={{ width: size, height: size }} />;
}

/** Cuántas unidades de cada objeto (id del dibujo, sin `obj:`) hay en la mochila, contando lo que no cupo. */
export function useBagCount(): (art: string) => number {
  const slots = useBagStore((s) => s.slots);
  const overflow = useBagStore((s) => s.overflow);
  return useMemo(() => {
    const have = new Map<string, number>();
    for (const s of [...slots, ...overflow]) if (s) have.set(s.itemId, (have.get(s.itemId) ?? 0) + s.quantity);
    return (art: string) => have.get(objItemId(art)) ?? 0;
  }, [slots, overflow]);
}
