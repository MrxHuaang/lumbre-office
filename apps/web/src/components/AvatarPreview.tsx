/** Muestra el frame frontal de un spritesheet de personaje (32x32) escalado. */
export function AvatarPreview({ avatar, scale = 3, walking = false }: { avatar: string; scale?: number; walking?: boolean }) {
  const size = 32 * scale;
  return (
    <div
      aria-hidden
      className={`pixelated ${walking ? "avatar-walk" : ""}`}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(/assets/characters/${avatar}.png)`,
        backgroundSize: `${96 * scale}px ${128 * scale}px`,
        backgroundPosition: "0 0",
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}
