"use client";

import type { Direction, Look } from "@hyvento/shared";
import { useEffect, useState, type CSSProperties } from "react";
import { lookSheetUrl } from "@/game/looks";

const ROW: Record<Direction, number> = { down: 0, left: 1, right: 2, up: 3 };

/**
 * Un personaje (fijo o personalizado) como imagen pixelada. Con `walking` recorre los 3 frames
 * de caminata en la dirección `dir`.
 */
export function CharacterSprite({
  avatar,
  look,
  dir = "down",
  walking = false,
  className = "",
  style,
}: {
  avatar: string;
  look?: Look | null;
  dir?: Direction;
  walking?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  // Los looks se dibujan en un <canvas>: solo en el navegador, después de montar.
  const [lookUrl, setLookUrl] = useState<string | null>(null);
  useEffect(() => setLookUrl(look ? lookSheetUrl(look) : null), [look]);
  const url = look ? lookUrl : `/assets/characters/${avatar}.png`;

  return (
    <div
      aria-hidden
      className={`pixelated aspect-square ${walking ? "sprite-walk" : ""} ${className}`}
      style={{
        backgroundImage: url ? `url(${url})` : undefined,
        backgroundSize: "300% 400%",
        backgroundRepeat: "no-repeat",
        backgroundPositionX: "0%",
        backgroundPositionY: `${(ROW[dir] * 100) / 3}%`,
        ...style,
      }}
    />
  );
}
