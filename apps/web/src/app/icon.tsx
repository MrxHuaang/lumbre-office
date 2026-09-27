// Favicon: la llamita de Lumbre como SVG pixel, generado por código (sin archivos de imagen).
import { llamaSvg } from "@/components/lumbre/marca";

export const contentType = "image/svg+xml";

export default function Icon() {
  return new Response(llamaSvg(), { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=86400" } });
}
