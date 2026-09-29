"use client";

import { useEffect } from "react";

// Este reemplaza al layout raíz entero (se rompió el propio layout): no hay globals.css ni la fuente de
// next/font. Por eso trae su <html>/<body> y los colores cozy copiados en estilos en línea.
const C = {
  void: "#2a2033",
  paper: "#fbe1a4",
  paperLight: "#fdf0c8",
  paperDark: "#f5cf85",
  ink: "#4a2a1c",
  inkSoft: "#8a4b1c",
  frame: "#5b2b0e",
  wood: "#b3571a",
  woodLight: "#e0923e",
  green: "#5ea247",
  greenDeep: "#2e5a40",
  greenLight: "#8cc653",
};
const FONT = '"Pixelify Sans", ui-monospace, monospace';

const button: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 20px",
  fontFamily: FONT,
  fontSize: 16,
  fontWeight: 500,
  lineHeight: 1.1,
  cursor: "pointer",
  textDecoration: "none",
  background: C.paperDark,
  color: C.ink,
  border: `2px solid ${C.wood}`,
  boxShadow: `inset 2px 2px 0 ${C.paperLight}, 2px 2px 0 rgb(20 10 24 / 0.35)`,
};

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[web] error global", error.digest ?? "", error);
  }, [error]);

  return (
    <html lang="es">
      <head>
        <title>Algo se rompió · Lumbre</title>
        {/* La fuente pixel desde Google (si no carga, queda la monoespaciada). */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;600&display=swap" />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 16,
          boxSizing: "border-box",
          background: C.void,
          color: C.ink,
          fontFamily: FONT,
        }}
      >
        <main style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", alignItems: "center", gap: 24, textAlign: "center" }}>
          <h1
            style={{
              margin: 0,
              fontSize: 44,
              lineHeight: 1,
              fontWeight: 600,
              color: C.paperLight,
              textShadow: `3px 3px 0 ${C.wood}, 6px 6px 0 ${C.frame}`,
            }}
          >
            Algo se rompió
          </h1>
          <section
            role="alert"
            style={{
              width: "100%",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              padding: "20px 24px",
              background: C.paper,
              border: `3px solid ${C.frame}`,
              boxShadow: `inset 0 0 0 2px ${C.woodLight}, inset 0 0 0 4px ${C.wood}, 3px 3px 0 rgb(20 10 24 / 0.45)`,
            }}
          >
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.35 }}>
              La cabaña no pudo abrir. Intenta de nuevo en un momento o vuelve al inicio.
            </p>
            {error.digest && <p style={{ margin: 0, fontSize: 12, color: C.inkSoft }}>Código: {error.digest}</p>}
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12 }}>
              <button
                type="button"
                onClick={reset}
                style={{
                  ...button,
                  background: C.green,
                  color: C.paperLight,
                  borderColor: C.greenDeep,
                  boxShadow: `inset 2px 2px 0 ${C.greenLight}, 2px 2px 0 rgb(20 10 24 / 0.35)`,
                }}
              >
                Reintentar
              </button>
              {/* Enlace normal (no next/link): se rompió la raíz y conviene una carga completa. */}
              <a href="/" style={button}>
                Volver al inicio
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
