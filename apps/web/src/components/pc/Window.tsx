"use client";

import { useRef } from "react";
import { RISO } from "@/lib/riso";

export interface WindowBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface WindowProps {
  title: string;
  icon: React.ReactNode;
  /** Color de la barra de título (la tinta de la app). */
  ink: string;
  inkText?: string;
  box: WindowBox;
  z: number;
  active: boolean;
  maximized: boolean;
  /** Tamaño del escritorio, para no sacar la ventana de la pantalla al arrastrarla. */
  bounds: { w: number; h: number };
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
  children: React.ReactNode;
}

/** Ventana estilo XP: barra de título con la tinta de la app, arrastrable, con minimizar/maximizar/cerrar. */
export function Window({
  title,
  icon,
  ink,
  inkText = RISO.navy,
  box,
  z,
  active,
  maximized,
  bounds,
  onFocus,
  onMove,
  onMinimize,
  onToggleMaximize,
  onClose,
  children,
}: WindowProps) {
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    onFocus();
    if (maximized || (e.target as HTMLElement).closest("button")) return;
    drag.current = { dx: e.clientX - box.x, dy: e.clientY - box.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    // Siempre queda visible una parte de la barra de título para poder volver a agarrarla.
    const x = Math.min(Math.max(e.clientX - drag.current.dx, 80 - box.w), bounds.w - 80);
    const y = Math.min(Math.max(e.clientY - drag.current.dy, 0), bounds.h - 32);
    onMove(x, y);
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <section
      role="dialog"
      aria-label={title}
      onPointerDownCapture={onFocus}
      className="absolute flex flex-col border-2 border-riso-navy bg-riso-paper"
      style={{
        ...(maximized ? { inset: 0 } : { left: box.x, top: box.y, width: box.w, height: box.h }),
        zIndex: z,
        boxShadow: `${active ? 4 : 2}px ${active ? 4 : 2}px 0 ${RISO.navy}`,
      }}
    >
      <header
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={(e) => !(e.target as HTMLElement).closest("button") && onToggleMaximize()}
        className="flex h-8 shrink-0 cursor-default items-center gap-2 border-b-2 border-riso-navy px-2 select-none"
        style={{ background: ink, color: inkText, opacity: active ? 1 : 0.8 }}
      >
        <span className="shrink-0">{icon}</span>
        <span className="font-display min-w-0 flex-1 truncate text-[13px]">{title}</span>
        <TitleButton label="Minimizar" onClick={onMinimize}>
          <path d="M4 11h8" />
        </TitleButton>
        <TitleButton label={maximized ? "Restaurar" : "Maximizar"} onClick={onToggleMaximize}>
          {maximized ? <path d="M5 7h6v5H5zM7 7V4h6v5h-2" /> : <path d="M4 4h8v8H4z" />}
        </TitleButton>
        <TitleButton label="Cerrar" onClick={onClose} close>
          <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
        </TitleButton>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

function TitleButton({
  label,
  onClick,
  close = false,
  children,
}: {
  label: string;
  onClick: () => void;
  close?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid h-5 w-5 shrink-0 place-items-center border-[1.5px] border-riso-navy text-riso-navy ${
        close ? "bg-riso-pink" : "bg-riso-cream hover:bg-riso-yellow"
      }`}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
        {children}
      </svg>
    </button>
  );
}
