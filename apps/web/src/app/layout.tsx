import type { Metadata, Viewport } from "next";
import { Pixelify_Sans } from "next/font/google";
import { DESCRIPCION, ESLOGAN, MARCA } from "@/components/lumbre/marca";
import "./globals.css";

// Estilo cozy de la cabaña: Pixelify Sans (pixel-art) en toda la oficina.
const pixelify = Pixelify_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-cozy" });

/**
 * La dirección pública del sitio, para que la imagen al compartir (opengraph-image.tsx) tenga URL
 * completa: la de Auth.js si está, si no la de producción de Vercel y, en local, localhost.
 */
function urlDelSitio(): URL {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  const candidatas = [process.env.AUTH_URL, process.env.NEXTAUTH_URL, vercel && `https://${vercel}`, "http://localhost:3000"];
  for (const c of candidatas) {
    if (!c) continue;
    try {
      return new URL(c);
    } catch {
      // Una variable mal escrita no puede tumbar todas las páginas: se prueba la siguiente.
    }
  }
  return new URL("http://localhost:3000");
}

// La marca pública es Lumbre; Hyvento es el equipo que la usa (su cabaña adentro).
export const metadata: Metadata = {
  metadataBase: urlDelSitio(),
  title: { default: `${MARCA} · ${ESLOGAN}`, template: `%s · ${MARCA}` },
  description: DESCRIPCION,
  applicationName: MARCA,
  openGraph: { type: "website", siteName: MARCA, title: `${MARCA} · ${ESLOGAN}`, description: DESCRIPCION, locale: "es_CO", url: "/" },
  twitter: { card: "summary_large_image", title: MARCA, description: ESLOGAN },
};

export const viewport: Viewport = { themeColor: "#2a2033" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={pixelify.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
