import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Tipografías del estilo RISO de la oficina: Archivo (titulares, ancho variable) e IBM Plex Mono (UI).
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--riso-archivo" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--riso-plex" });

export const metadata: Metadata = {
  title: "Hyvento Office",
  description: "Oficina virtual del equipo Hyvento",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${archivo.variable} ${plexMono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
