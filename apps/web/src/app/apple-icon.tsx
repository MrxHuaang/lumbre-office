// Ícono para la pantalla de inicio (iOS pide PNG): la misma llamita, píxel por píxel, con ImageResponse.
import { ImageResponse } from "next/og";
import { llamaPixeles } from "@/components/lumbre/marca";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const { w, h, pixeles } = llamaPixeles(0);
  const px = Math.floor(140 / Math.max(w, h));
  const ox = Math.round((180 - w * px) / 2);
  const oy = Math.round((180 - h * px) / 2);
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
