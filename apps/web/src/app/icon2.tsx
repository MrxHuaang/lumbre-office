// Favicon de respaldo en PNG (para los navegadores que no aceptan el SVG de icon.tsx): la misma
// llamita, píxel por píxel, sobre la noche cozy.
import { ImageResponse } from "next/og";
import { llamaPixeles } from "@/components/lumbre/marca";

export const size = { width: 48, height: 48 };
export const contentType = "image/png";

export default function IconPng() {
  const { w, h, pixeles } = llamaPixeles(0);
  const px = Math.floor(44 / Math.max(w, h));
  const ox = Math.round((size.width - w * px) / 2);
  const oy = Math.round((size.height - h * px) / 2);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#2a2033" }}>
        {pixeles.map((p) => (
          <div key={`${p.x}-${p.y}`} style={{ position: "absolute", left: ox + p.x * px, top: oy + p.y * px, width: px, height: px, background: p.color }} />
        ))}
      </div>
    ),
    size,
  );
}
