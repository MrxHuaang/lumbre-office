"use client";

// La insignia de un logro (medalla pixel dibujada por código) y el dibujito solo, como imagen nítida.
import { drawBadge, drawBadgeGlyph } from "@hyvento/map/art";
import type { Achievement, BadgeIcon } from "@hyvento/shared";
import { ArtImage } from "../casino/PixelArt";

export function Badge({
  achievement,
  locked = false,
  scale = 2,
  className = "",
}: {
  achievement: Pick<Achievement, "icon" | "rarity" | "secret" | "name">;
  locked?: boolean;
  scale?: number;
  className?: string;
}) {
  const { icon, rarity, secret } = achievement;
  const hide = locked && secret;
  return (
    <ArtImage
      id={`insignia-${icon}-${rarity}-${locked ? (hide ? "secreto" : "bloqueado") : "abierto"}`}
      make={() => drawBadge(icon, rarity, { locked, secret })}
      scale={scale}
      alt={hide ? "Logro secreto" : achievement.name}
      className={className}
    />
  );
}

export function BadgeGlyph({ icon, scale = 2, className = "" }: { icon: BadgeIcon; scale?: number; className?: string }) {
  return <ArtImage id={`glifo-${icon}`} make={() => drawBadgeGlyph(icon)} scale={scale} className={className} />;
}
