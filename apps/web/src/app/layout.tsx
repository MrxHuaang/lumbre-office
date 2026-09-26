import type { Metadata } from "next";
import { Pixelify_Sans } from "next/font/google";
import "./globals.css";

// Estilo cozy de la cabaña: Pixelify Sans (pixel-art) en toda la oficina.
const pixelify = Pixelify_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-cozy" });

export const metadata: Metadata = {
  title: "Hyvento Office",
  description: "La cabaña virtual del equipo Hyvento",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={pixelify.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
