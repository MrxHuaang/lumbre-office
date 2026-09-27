// La imagen que se ve al compartir el enlace (Open Graph y X): el mismo banner pixel del README, con
// la llamita, "LUMBRE" y el eslogan, generado por código.
import { ImageResponse } from "next/og";
import { bannerSvg, ESLOGAN, MARCA } from "@/components/lumbre/marca";

export const alt = `${MARCA} — ${ESLOGAN}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  // 400x210 píxeles de arte a escala 3 = 1200x630.
  const svg = bannerSvg({ ancho: 400, alto: 210, escala: 3 });
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#2a2033" }}>
        <img src={src} width={size.width} height={size.height} alt="" />
      </div>
    ),
    size,
  );
}
