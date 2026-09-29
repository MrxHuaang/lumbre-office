"use client";

import Link from "next/link";
import { useEffect } from "react";
import { CozyTitle, PixelIcon } from "@/components/Cozy";

/**
 * Error de una página (Next lo muestra en lugar del contenido; el layout con las fuentes y los estilos
 * sigue). "Reintentar" vuelve a dibujar el segmento sin recargar; "Volver al inicio" es un enlace normal.
 */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // El digest es el que aparece en los logs del servidor (Vercel): sirve para cruzarlos.
    console.error("[web] error en la página", error.digest ?? "", error);
  }, [error]);

  return (
    <main className="cozy-void grid min-h-full place-items-center px-4 py-10 font-pixel text-cozy-ink">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <CozyTitle className="text-[clamp(34px,6vw,52px)] leading-none">Algo se rompió</CozyTitle>
        <section role="alert" className="cozy-panel flex w-full flex-col items-center gap-4 px-6 py-5">
          <PixelIcon name="cabin" size={28} color="var(--color-cozy-wood)" />
          <p className="text-[16px] leading-snug">
            La cabaña tuvo un tropiezo al dibujar esta pantalla. Puedes intentarlo de nuevo o volver al inicio.
          </p>
          {error.digest && <p className="text-[12px] text-cozy-ink-soft">Código: {error.digest}</p>}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={reset} className="cozy-btn cozy-btn-primary px-5 py-2.5 text-[16px]">
              Reintentar
            </button>
            <Link href="/" className="cozy-btn px-5 py-2.5 text-[16px]">
              <PixelIcon name="home" size={14} />
              Volver al inicio
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
