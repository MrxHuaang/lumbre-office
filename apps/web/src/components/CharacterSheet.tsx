import type { Direction } from "@hyvento/shared";
import type { CSSProperties } from "react";

const ROW: Record<Direction, number> = { down: 0, left: 1, right: 2, up: 3 };

/**
 * La hoja de caminata (3x4 cuadros) de un personaje ya dibujada, como imagen pixelada. Sin el motor de
 * arte: la usan CharacterSprite (que dibuja la hoja en el navegador) y la portada (que la trae del build).
 */
export function CharacterSheet({
  url,
  dir = "down",
  walking = false,
  className = "",
  style,
}: {
  url: string | null;
  dir?: Direction;
  walking?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
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
