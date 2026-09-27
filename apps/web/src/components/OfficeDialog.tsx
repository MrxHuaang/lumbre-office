"use client";

import { useEffect } from "react";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "./Cozy";

/**
 * Ventana sobre la cabaña (perfil, personaje, administración): no se sale de la sala. Mientras
 * está abierta, el teclado no mueve al personaje; se cierra con la X, Esc o un clic fuera.
 */
export function OfficeDialog({
  title,
  onClose,
  className = "max-w-3xl",
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
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
      className="absolute inset-0 z-40 flex items-center justify-center bg-[rgb(42_32_51/0.6)] p-3 sm:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <section role="dialog" aria-modal aria-label={title} className={`cozy-panel flex max-h-full w-full flex-col p-1.5 ${className}`}>
        <header className="flex shrink-0 items-center justify-between gap-3 bg-cozy-wood px-4 py-2.5 text-cozy-paper-light">
          <h2 className="text-[18px] font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="p-1" aria-label="Cerrar">
            <PixelIcon name="close" size={12} />
          </button>
        </header>
        {children}
        {footer && (
          <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t-2 border-cozy-paper-dark px-4 py-3">{footer}</footer>
        )}
      </section>
    </div>
  );
}
