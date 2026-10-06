"use client";

import { DORMIR, durmiendoTexto } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { useDormirStore } from "@/game/dormir";
import { lessMotion } from "@/lib/prefs";
import { PixelIcon } from "./Cozy";

/** "Durmiendo 2/4": mientras alguien duerme en una cama (VIR-144). */
export function DormirChip() {
  const estado = useDormirStore((s) => s.estado);
  if (!estado || estado.dormidos === 0) return null;
  return (
    <div className="cozy-chip flex h-[34px] items-center gap-1.5 px-2.5 text-[13px]" aria-live="polite" title="Cuando duerman los que faltan, amanece">
      <PixelIcon name="moon" size={14} />
      <span className="font-pixel leading-none tabular-nums">{durmiendoTexto(estado)}</span>
    </div>
  );
}

/** Al amanecer, la pantalla se funde desde negro (con "menos movimiento", corto). */
export function AmanecerFundido() {
  const at = useDormirStore((s) => s.amanecioAt);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!at) return;
    setVisible(true);
    // Un cuadro en negro y después se aclara con la transición de CSS.
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(false)));
    return () => cancelAnimationFrame(raf);
  }, [at]);
  if (!at) return null;
  const ms = lessMotion() ? 300 : DORMIR.fundidoMs;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-30 bg-black"
      style={{ opacity: visible ? 1 : 0, transition: visible ? "none" : `opacity ${ms}ms ease-in` }}
    />
  );
}
