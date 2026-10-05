"use client";

import { FESTIVAL_HORAS, festivalById, GAME_DAY_REAL_MS, añoTexto, clockStep, fechaCorta, fechaDelJuego, fechaPlaca, formatGameTime, skyPhase, type SkyPhase } from "@hyvento/shared";
import { useEffect, useRef, useState } from "react";
import { useGameTime } from "@/game/gameClock";
import { sfx } from "@/game/sfx";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "./Cozy";
import { SKY_H, SKY_W, skyPixels } from "@/lib/sky";
import { CalendarioPanel } from "./CalendarioPanel";

const PHASE_TEXT: Record<SkyPhase, string> = { amanecer: "Amaneciendo", dia: "De día", atardecer: "Atardeciendo", noche: "De noche" };

/**
 * Reloj del juego en el HUD, como el de Stardew Valley: la fecha del calendario del juego ("Lun 3 ·
 * Otoño"), la hora de a 10 minutos y una ventanita con el cielo (el sol o la luna van cruzando). Con un
 * clic abre el calendario de la estación. En pantallas chicas queda solo la ventanita y la hora.
 */
export function GameClockChip() {
  const t = useGameTime();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // Se cierra al tocar fuera o con Escape (como el menú).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  if (!t) return null;
  const shown = clockStep(t.minuteOfDay);
  const time = formatGameTime(shown);
  const fecha = fechaDelJuego(t.day);
  const toggle = () => {
    if (open) sfx.uiClose();
    else sfx.uiOpen();
    setOpen(!open);
  };
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="cozy-chip flex h-[34px] items-center gap-2 pr-3 pl-1.5 hover:brightness-105"
        title={`${fechaCorta(fecha)}, ${añoTexto(fecha)}, ${time} (${PHASE_TEXT[skyPhase(t.minuteOfDay)].toLowerCase()}). Un día dura ${Math.round(GAME_DAY_REAL_MS / 60_000)} minutos. Clic para ver el calendario.`}
        aria-label={`${fechaCorta(fecha)}, ${añoTexto(fecha)}, ${time}. Abrir el calendario`}
      >
        <SkyWindow minuteOfDay={shown} />
        <span className="hidden text-cozy-ink-soft sm:inline">{fechaPlaca(fecha)}</span>
        <span className="font-pixel text-[15px] leading-none tabular-nums">{time}</span>
      </button>
      {open && <CalendarioPanel fecha={fecha} />}
    </div>
  );
}

const FASE_TEXT: Record<string, string> = { previa: `abre a las ${FESTIVAL_HORAS.apertura}:00`, fiesta: "¡en fiesta!", fin: "ya cerró" };

/** El letrero del festival de hoy (si hay): su nombre, con su color, y si ya abrió. */
export function FestivalChip() {
  const { id, fase } = useOfficeStore((s) => s.festival);
  const f = id ? festivalById(id) : undefined;
  if (!f) return null;
  return (
    <div
      className="cozy-chip flex h-[34px] items-center gap-1.5 border-l-4 px-2.5 text-[13px]"
      style={{ borderLeftColor: f.color }}
      title={`${f.nombre}: ${f.resumen}`}
      aria-label={`Hoy es ${f.nombre}, ${FASE_TEXT[fase] ?? ""}`}
    >
      <PixelIcon name="star" size={14} />
      <span className="font-pixel leading-none">{f.nombre}</span>
      <span className="hidden text-cozy-ink-soft md:inline">· {FASE_TEXT[fase] ?? ""}</span>
    </div>
  );
}

/** El cielo pixel de 14x10 (ver lib/sky.ts), con su marco de madera. */
export function SkyWindow({ minuteOfDay, scale = 2 }: { minuteOfDay: number; scale?: number }) {
  return (
    <svg
      width={(SKY_W + 2) * scale}
      height={(SKY_H + 2) * scale}
      viewBox={`-1 -1 ${SKY_W + 2} ${SKY_H + 2}`}
      shapeRendering="crispEdges"
      aria-hidden
      className="shrink-0"
    >
      <rect x={-1} y={-1} width={SKY_W + 2} height={SKY_H + 2} fill="var(--color-cozy-frame)" />
      {skyPixels(minuteOfDay).map((p, i) => (
        <rect key={i} x={p.x} y={p.y} width={1} height={1} fill={p.color} />
      ))}
    </svg>
  );
}
