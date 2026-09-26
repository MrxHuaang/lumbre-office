"use client";

import { useEffect } from "react";
import { useOfficeStore } from "@/game/store";

/**
 * Ventana sobre la oficina (perfil, personaje, administración): no se sale de la sala. Mientras
 * está abierta, el teclado no mueve al personaje; se cierra con "cerrar", Esc o un clic fuera.
 */
export function OfficeDialog({
  title,
  onClose,
  shadow,
  className = "max-w-3xl",
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  /** Tinta de la sombra de la ventana. */
  shadow: string;
  /** Tamaño de la ventana (clases de Tailwind). */
  className?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const { setTyping } = useOfficeStore.getState();
    setTyping(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      setTyping(false);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 z-40 grid place-items-center bg-riso-navy/45 p-3 sm:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal
        aria-label={title}
        className={`riso-panel flex max-h-full w-full flex-col ${className}`}
        style={{ "--riso-shadow": shadow } as React.CSSProperties}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-riso-navy px-5 py-3">
          <h2 className="font-display text-[17px]">{title}</h2>
          <button type="button" onClick={onClose} className="text-[13px] underline-offset-2 hover:underline">
            cerrar
          </button>
        </header>
        {children}
        {footer && (
          <footer className="flex shrink-0 flex-wrap items-center gap-4 border-t-2 border-riso-navy px-5 py-3">{footer}</footer>
        )}
      </section>
    </div>
  );
}
