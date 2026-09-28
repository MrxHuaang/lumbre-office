"use client";

// El dibujo de cualquier cosa de la mochila: los objetos con su dibujo de la mano (items.ts) y los
// muebles con su miniatura de frente. Se dibujan una vez y se guardan como imagen.
import { drawFurniture, drawHeldItem } from "@hyvento/map/art";
import { bagItemInfo } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { PixelIcon } from "../Cozy";

const cache = new Map<string, string | null>();

/** La imagen (data URL) de algo de la mochila; `art` cambia el dibujo (la regadera vacía) y `left` los usos. */
export function itemArtUrl(itemId: string, art?: string, left?: number): string | null {
  const key = `${itemId}|${art ?? ""}|${left ?? ""}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const info = bagItemInfo(itemId);
  let url: string | null = null;
  try {
    const px = info.furniture ? drawFurniture(info.art, "front").canvas : drawHeldItem(art ?? info.art, left !== undefined ? { left } : {});
    // Un objeto sin dibujo sale de 1x1: mejor el ícono de la mochila.
    if (px.width > 1) url = toHtmlCanvas(px).toDataURL();
  } catch {
    url = null;
  }
  cache.set(key, url);
  return url;
}

export function ItemIcon({ itemId, art, left, className = "absolute inset-0 m-auto h-[76%] w-[76%]" }: { itemId: string; art?: string; left?: number; className?: string }) {
  // Se dibuja en un <canvas>: solo en el navegador, después de montar.
  const [src, setSrc] = useState<string | null | undefined>(undefined);
  useEffect(() => setSrc(itemArtUrl(itemId, art, left)), [itemId, art, left]);
  if (src === undefined) return <span className={className} />;
  if (src === null) return <PixelIcon name="bag" size={16} color="var(--color-cozy-wood)" />;
  return <img src={src} alt="" draggable={false} className={`object-contain [image-rendering:pixelated] ${className}`} />;
}
