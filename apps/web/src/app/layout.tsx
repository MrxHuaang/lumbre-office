import type { Metadata, Viewport } from "next";
import { Pixelify_Sans } from "next/font/google";
import { DESCRIPCION, ESLOGAN, MARCA } from "@/components/lumbre/marca";
import "./globals.css";

// Estilo cozy de la cabaña: Pixelify Sans (pixel-art) en toda la oficina.
const pixelify = Pixelify_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-cozy" });

// La marca pública es Lumbre; Hyvento es el equipo que la usa (su cabaña adentro).
export const metadata: Metadata = {
  title: { default: `${MARCA} · ${ESLOGAN}`, template: `%s · ${MARCA}` },
  description: DESCRIPCION,
  applicationName: MARCA,
  openGraph: { type: "website", siteName: MARCA, title: `${MARCA} · ${ESLOGAN}`, description: DESCRIPCION, locale: "es_CO" },
  twitter: { card: "summary", title: MARCA, description: ESLOGAN },
};

export const viewport: Viewport = { themeColor: "#2a2033" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={pixelify.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
