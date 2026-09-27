"use client";

import type { Direction, Look } from "@hyvento/shared";
import { useEffect, useState, type CSSProperties } from "react";
import { characterSheetUrl } from "@/game/looks";
import { CharacterSheet } from "./CharacterSheet";

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
  // Los personajes se dibujan en un <canvas>: solo en el navegador, después de montar.
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => setUrl(characterSheetUrl(avatar, look ?? null)), [avatar, look]);

  return <CharacterSheet url={url} dir={dir} walking={walking} className={className} style={style} />;
}
