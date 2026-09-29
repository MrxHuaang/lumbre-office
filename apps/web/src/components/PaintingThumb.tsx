"use client";

// Un cuadro de la Pintura de frente (sin perspectiva), ampliado sin suavizar: para la galería del PC y
// la mochila del editor de decoración.
import { PAINTING, PAINTING_PALETTE, paintingIdOf } from "@hyvento/shared";
import { useEffect, useMemo } from "react";
import { usePaintingStore } from "@/game/paintingStore";

const urls = new Map<string, string>();

/** Data URL de un lienzo (16x16 píxeles reales; el navegador lo agranda sin suavizar). */
export function paintingUrl(pixels: string): string {
  const hit = urls.get(pixels);
  if (hit) return hit;
  const n = PAINTING.size;
  const canvas = document.createElement("canvas");
  canvas.width = n;
  canvas.height = n;
  const ctx = canvas.getContext("2d")!;
  for (let i = 0; i < n * n; i++) {
    ctx.fillStyle = PAINTING_PALETTE[parseInt(pixels[i] ?? "0", 16)] ?? PAINTING_PALETTE[0];
    ctx.fillRect(i % n, Math.floor(i / n), 1, 1);
  }
  const url = canvas.toDataURL();
  urls.set(pixels, url);
  return url;
}

export function PaintingThumb({ pixels, className = "h-12 w-12" }: { pixels: string; className?: string }) {
  const src = useMemo(() => paintingUrl(pixels), [pixels]);
  return <img src={src} alt="" draggable={false} className={`border-2 border-cozy-frame [image-rendering:pixelated] ${className}`} />;
}

/** El cuadro de un mueble `cuadro:<id>` de la mochila (lo pide si no lo tiene). */
export function PaintingItemArt({ itemId, className }: { itemId: string; className?: string }) {
  const id = paintingIdOf(itemId);
  const painting = usePaintingStore((s) => (id ? s.byId[id] : null));
  useEffect(() => {
    if (id) usePaintingStore.getState().request(id);
  }, [id]);
  return (
    <span className="grid h-12 w-full place-items-center">
      {painting ? <PaintingThumb pixels={painting.pixels} className={className ?? "h-10 w-10"} /> : <span className="h-10 w-10 border-2 border-cozy-frame bg-cozy-paper-light" />}
    </span>
  );
}

/** Título del cuadro de un mueble `cuadro:<id>` (lo pide si no lo tiene; null mientras llega). */
export function usePaintingTitle(itemId: string): string | null {
  const id = paintingIdOf(itemId);
  useEffect(() => {
    if (id) usePaintingStore.getState().request(id);
  }, [id]);
  return usePaintingStore((s) => (id ? (s.byId[id]?.title ?? null) : null));
}
