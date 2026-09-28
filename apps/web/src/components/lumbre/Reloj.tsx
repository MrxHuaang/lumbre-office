"use client";

// El reloj del juego en la portada: se arrastra la hora y la cabaña pasa del amanecer a la noche con el
// mismo cielo pixel del HUD (lib/sky.ts). En el juego lo lleva el servidor: un día dura una hora real.
import { skyPhase, type SkyPhase } from "@hyvento/shared";
import Image from "next/image";
import { useId, useState } from "react";
import { SKY_H, SKY_W, skyPixels } from "@/lib/sky";

const FASE: Record<SkyPhase, { nombre: string; velo: string }> = {
  amanecer: { nombre: "Amanecer", velo: "rgb(120 90 170 / 0.28)" },
  dia: { nombre: "De día", velo: "transparent" },
  atardecer: { nombre: "Atardecer", velo: "rgb(214 110 60 / 0.3)" },
  noche: { nombre: "De noche", velo: "rgb(22 20 64 / 0.58)" },
};

const hora = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function Reloj() {
  const id = useId();
  const [minuto, setMinuto] = useState(10 * 60);
  const fase = skyPhase(minuto);
  const cielo = skyPixels(minuto);

  return (
    <figure className="flex flex-col gap-4">
      <div className="relative overflow-hidden border-4 border-cozy-frame shadow-[6px_6px_0_rgb(20_10_24/0.5)]">
        <Image
          src="/landing/casa.webp"
          alt="La cabaña de Lumbre con su torre, el garaje y el porche, dibujada en pixel-art"
          width={791}
          height={426}
          unoptimized
          sizes="(min-width: 1024px) 640px, 100vw"
          className="pixelated block h-auto w-full"
        />
        <span className="lumbre-velo pointer-events-none absolute inset-0" style={{ background: FASE[fase].velo }} aria-hidden />
        {/* La ventanita del cielo, como en el HUD del juego. */}
        <div className="cozy-chip absolute top-3 left-3 flex items-center gap-2.5 px-2 py-1.5">
          <svg viewBox={`0 0 ${SKY_W} ${SKY_H}`} shapeRendering="crispEdges" className="h-[30px] w-[42px] border-2 border-cozy-frame" aria-hidden>
            {cielo.map((p, i) => (
              <rect key={i} x={p.x} y={p.y} width={1} height={1} fill={p.color} />
            ))}
          </svg>
          <span className="flex flex-col leading-none">
            <span className="text-[18px] font-semibold tabular-nums">{hora(minuto)}</span>
            <span className="text-[12px] text-cozy-ink-soft">{FASE[fase].nombre}</span>
          </span>
        </div>
      </div>
      <figcaption className="flex flex-col gap-2">
        <label htmlFor={id} className="text-[15px] text-cozy-paper-dark">
          Arrastra para cambiar la hora del juego
        </label>
        <input
          id={id}
          type="range"
          min={0}
          max={1430}
          step={10}
          value={minuto}
          onChange={(e) => setMinuto(Number(e.target.value))}
          aria-valuetext={`${hora(minuto)}, ${FASE[fase].nombre.toLowerCase()}`}
          className="lumbre-rango w-full"
        />
      </figcaption>
    </figure>
  );
}
