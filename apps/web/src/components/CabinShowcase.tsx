"use client";

// La cabaña de verdad (mismo motor que el juego) como ilustración del login: un jardincito con la
// cabaña, se dibuja una vez en el navegador y se muestra como imagen pixelada.
import { buildArea, type AreaDef, type Placement } from "@hyvento/map";
import { composeArea } from "@hyvento/map/art";
import { useEffect, useState } from "react";
import { isNightNow } from "@/lib/cozy";
import { toHtmlCanvas } from "@/game/iso/canvas";

const place = (type: string, x: number, y: number, facing: Placement["facing"] = "right"): Placement => ({ type, x, y, facing });

const SHOWCASE: AreaDef = {
  id: "vitrina",
  name: "Vitrina",
  width: 22,
  height: 17,
  outdoor: true,
  ground: (x, y) => ((x === 10 || x === 11) && y >= 12) || (y === 12 && x >= 9 && x <= 12) ? "path" : "grass",
  rooms: [],
  doors: [],
  zones: [],
  features: [],
  portals: [],
  points: [],
  furniture: [
    place("cabin", 3, 2),
    ...[4, 5, 6, 7, 14, 15, 16, 17].map((x) => place("flowerbed", x, 12, "down")),
    place("mailbox", 8, 14, "down"),
    place("lamp-post", 9, 15),
    place("lamp-post", 12, 15),
    place("bench", 14, 14, "down"),
    place("tree", 1, 3),
    place("pine", 20, 2),
    place("tree", 20, 8),
    place("pine", 1, 12),
    place("bush", 19, 13),
    place("bush", 2, 15),
  ],
};

export function CabinShowcase({ className = "" }: { className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    // Se dibuja después de montar (usa <canvas>) y sin bloquear el primer render.
    const id = setTimeout(() => setSrc(toHtmlCanvas(composeArea(buildArea(SHOWCASE), !isNightNow(), 24)).toDataURL()), 0);
    return () => clearTimeout(id);
  }, []);
  if (!src) return <div className={className} />;
  return <img src={src} alt="" aria-hidden className={`pixelated ${className}`} />;
}
