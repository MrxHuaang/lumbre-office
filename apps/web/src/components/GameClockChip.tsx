"use client";

import { clockStep, formatGameTime, skyPhase, type SkyPhase } from "@hyvento/shared";
import { useGameTime } from "@/game/gameClock";
import { SKY_H, SKY_W, skyPixels } from "@/lib/sky";

const PHASE_TEXT: Record<SkyPhase, string> = { amanecer: "Amaneciendo", dia: "De día", atardecer: "Atardeciendo", noche: "De noche" };

/**
 * Reloj del juego en el HUD, como el de Stardew Valley: el día, la hora de a 10 minutos y una ventanita
 * con el cielo (el sol o la luna van cruzando). En pantallas chicas queda solo la ventanita y la hora.
 */
export function GameClockChip() {
  const t = useGameTime();
  if (!t) return null;
  const shown = clockStep(t.minuteOfDay);
  const time = formatGameTime(shown);
  return (
    <div
      className="cozy-chip flex items-center gap-2 py-1 pr-3 pl-1.5"
      title={`Reloj de la cabaña: día ${t.day + 1}, ${time} (${PHASE_TEXT[skyPhase(t.minuteOfDay)].toLowerCase()}). Un día dura 24 minutos.`}
      aria-label={`Día ${t.day + 1}, ${time}`}
    >
      <SkyWindow minuteOfDay={shown} />
      <span className="hidden text-cozy-ink-soft sm:inline">Día {t.day + 1}</span>
      <span className="font-pixel text-[15px] leading-none tabular-nums">{time}</span>
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
