"use client";

// "Crea el mundo de tu equipo" todavía no existe (ver docs/plan-equipos.md). Los botones abren este
// aviso: cuenta qué viene y ofrece una "lista de espera" que solo muestra un mensaje. No pide correo,
// no guarda nada y no llama a ningún servicio.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PixelIcon } from "../Cozy";
import { Llama } from "./Logo";

const DIALOGO = "lumbre-proximamente";

/** Botón que abre el aviso de "Próximamente". */
export function CrearMundo({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      className={className}
      aria-haspopup="dialog"
      onClick={() => (document.getElementById(DIALOGO) as HTMLDialogElement | null)?.showModal()}
    >
      {children}
    </button>
  );
}

/** El aviso (uno por página). Se cierra con Esc, con la X o tocando afuera. */
export function Proximamente() {
  const ref = useRef<HTMLDialogElement>(null);
  const [avisado, setAvisado] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    // Al cerrarlo vuelve al estado de antes, para la próxima vez que se abra.
    const alCerrar = () => setAvisado(false);
    d.addEventListener("close", alCerrar);
    return () => d.removeEventListener("close", alCerrar);
  }, []);

  return (
    <dialog
      id={DIALOGO}
      ref={ref}
      aria-labelledby={`${DIALOGO}-titulo`}
      className="lumbre-dialogo cozy-panel m-auto w-[min(100%-32px,520px)] p-0 font-pixel text-cozy-ink"
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
    >
      <div className="relative flex flex-col gap-4 px-6 pt-6 pb-6 sm:px-8 sm:pt-7">
        <button type="button" onClick={() => ref.current?.close()} className="cozy-btn absolute top-3 right-3 h-9 w-9 p-0" aria-label="Cerrar">
          <PixelIcon name="close" size={14} />
        </button>
        <span className="cozy-chip flex w-fit items-center gap-2 px-2.5 py-1 text-[13px] leading-none">
          <Llama size={14} viva={false} />
          Próximamente
        </span>
        <h2 id={`${DIALOGO}-titulo`} className="pr-10 text-[26px] leading-tight font-semibold text-balance">
          Crear el mundo de tu equipo llega pronto
        </h2>
        {avisado ? (
          <p role="status" className="text-[17px] leading-relaxed">
            ¡Gracias por las ganas! Todavía no hay una lista de verdad, así que no guardamos nada tuyo. Cuando abra, lo vas a ver aquí mismo en la portada.
          </p>
        ) : (
          <>
            <p className="text-[17px] leading-relaxed text-cozy-ink-soft">
              Hoy Lumbre es la cabaña del equipo Hyvento. Estamos preparando todo para que cualquier equipo tenga la suya:
            </p>
            <ul className="flex flex-col gap-2.5 text-[16px] leading-snug">
              <li className="flex gap-2.5">
                <PixelIcon name="cabin" size={16} color="var(--color-cozy-wood)" className="mt-0.5 shrink-0" />
                Un mundo propio, aislado del resto, con su gente, su chat y sus puntos.
              </li>
              <li className="flex gap-2.5">
                <PixelIcon name="tag" size={16} color="var(--color-cozy-wood)" className="mt-0.5 shrink-0" />
                El nombre del equipo en el letrero de la cabaña y en el menú.
              </li>
              <li className="flex gap-2.5">
                <PixelIcon name="mail" size={16} color="var(--color-cozy-wood)" className="mt-0.5 shrink-0" />
                Invitaciones para que entre tu gente con su cuenta de Google.
              </li>
            </ul>
          </>
        )}
        <div className="mt-2 flex flex-wrap gap-3">
          {avisado ? (
            <button type="button" onClick={() => ref.current?.close()} className="cozy-btn cozy-btn-primary px-5 py-2.5 text-[16px]">
              Volver a la portada
            </button>
          ) : (
            <>
              <button type="button" onClick={() => setAvisado(true)} className="cozy-btn cozy-btn-primary px-5 py-2.5 text-[16px]">
                <PixelIcon name="bell" size={14} />
                Quiero enterarme
              </button>
              <button type="button" onClick={() => ref.current?.close()} className="cozy-btn px-5 py-2.5 text-[16px]">
                Seguir mirando
              </button>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
