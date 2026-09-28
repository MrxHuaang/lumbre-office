"use client";

// La pantalla del viaje en Megabús: mientras el bus va en camino, los de adentro no ven el mundo sino esta
// pantalla (cozy, pixel): el bus verde avanzando por la línea con las paradas de Pereira, la barra de
// progreso y la próxima estación. El audio de proximidad sigue entre los pasajeros. Solo lee la fase del
// servidor (`state.bus`) y la hora: no hay nada que simular.
import { busCarSprite } from "@hyvento/map/art";
import { BUS, BUS_ROUTE_STOPS, BUS_TIMINGS, busTraveling } from "@hyvento/shared";
import { useMemo } from "react";
import { useBusStore } from "@/game/busStore";
import { serverNow } from "@/game/club/store";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { useOfficeStore } from "@/game/store";
import { CozyTitle } from "../Cozy";
import { useBusTick } from "./BusPromptLabel";

/** Qué tan avanzado va el viaje (0..1) y qué dice arriba. */
function tripProgress(phase: string, elapsed: number): { p: number; title: string } {
  const t = BUS_TIMINGS;
  if (phase === "route") return { p: Math.min(1, elapsed / t.tripMs), title: "En ruta" };
  if (phase === "arriving") return { p: 0.8 + 0.2 * Math.min(1, elapsed / t.approachMs), title: "Llegando" };
  if (phase === "leaving") return { p: 0.05, title: "Saliendo" };
  return { p: 0, title: "Esperando la salida" };
}

export function BusTrip() {
  useBusTick(200);
  const area = useOfficeStore((s) => s.area);
  const { phase, since } = useBusStore();
  const busArt = useMemo(() => (typeof document === "undefined" ? "" : toHtmlCanvas(busCarSprite("front", false, 0).canvas).toDataURL()), []);
  if (area !== BUS.area || !busTraveling(phase)) return null;
  const { p, title } = tripProgress(phase, serverNow() - since);
  const stops = BUS_ROUTE_STOPS;
  // La parada que sigue: la primera que el bus todavía no pasó (la última es la nuestra).
  const passed = Math.floor(p * (stops.length - 1) + 1e-6);
  const next = stops[Math.min(stops.length - 1, passed + (p >= 1 ? 0 : 1))]!;
  return (
    <div className="cozy-void pointer-events-auto absolute inset-0 z-[5] flex items-center justify-center p-4 font-pixel text-cozy-ink" role="status" aria-live="polite">
      <div className="cozy-panel flex w-[min(640px,100%)] flex-col gap-5 px-6 py-6">
        <div className="flex items-baseline justify-between gap-3">
          <CozyTitle as="h2" className="text-[22px]">
            Megabús · {title}
          </CozyTitle>
          <span className="cozy-chip px-2 py-0.5 text-[12px]">Pasaje gratis</span>
        </div>
        {/* La línea: paradas y el bus que avanza. */}
        <div className="relative mx-2 h-24">
          <div className="absolute top-[58px] right-0 left-0 h-[6px] border-2 border-[#2c4f17] bg-[#8dc63f]" />
          <div className="absolute top-[58px] left-0 h-[6px] bg-[#c2e57e]" style={{ width: `${p * 100}%` }} />
          {stops.map((name, i) => {
            const x = (i / (stops.length - 1)) * 100;
            const done = i <= passed;
            return (
              <div key={name} className="absolute top-[52px] -translate-x-1/2" style={{ left: `${x}%` }}>
                <div className={`mx-auto h-[18px] w-[18px] border-2 border-[#2c4f17] ${done ? "bg-[#fffaf0]" : "bg-[#8dc63f]"}`} />
                <div className={`mt-1 w-20 text-center text-[11px] leading-tight ${i === stops.length - 1 ? "font-semibold" : "text-cozy-ink-soft"}`}>{name}</div>
              </div>
            );
          })}
          {busArt && (
            <img
              src={busArt}
              alt=""
              className="absolute top-0 h-[52px] -translate-x-1/2 [image-rendering:pixelated]"
              style={{ left: `${p * 100}%`, transition: "left 0.2s linear" }}
            />
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="h-4 flex-1 border-2 border-cozy-wood bg-cozy-paper-dark">
            <div className="h-full bg-[#8dc63f]" style={{ width: `${Math.round(p * 100)}%` }} />
          </div>
          <span className="w-10 text-right text-[13px]">{Math.round(p * 100)}%</span>
        </div>
        <p className="flex flex-wrap items-baseline justify-between gap-2 text-[15px]">
          <span>
            Próxima estación: <strong>Estación Hyvento</strong>
          </span>
          {phase === "route" && p < 0.95 && next !== "Estación Hyvento" && <span className="text-[12px] text-cozy-ink-soft">Pasando por {next}</span>}
        </p>
        <p className="text-[12px] text-cozy-ink-soft">
          El bus vuelve a la Estación Hyvento y abre las puertas: ahí te bajas por cualquiera de ellas. Mientras tanto se siguen oyendo los que van a bordo.
        </p>
      </div>
    </div>
  );
}
