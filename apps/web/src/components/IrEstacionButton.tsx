"use client";

import { ESTACION_DESTINO } from "@hyvento/map";
import { BUS, isCasaArea } from "@hyvento/shared";
import { travelTo } from "@/game/viaje";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "./Cozy";

/**
 * "Ir a la estación" (desde la cabaña) e "Ir a la cabaña" (desde la casa propia), VIR-143: los dos dejan en
 * la plataforma de la Estación Hyvento con el viaje rápido (mismas reglas, bloqueos y pausa que la paleta).
 * Adentro del bus no sale: de ahí se baja en la parada.
 */
export function IrEstacionButton() {
  const area = useOfficeStore((s) => s.area);
  if (!area || area === BUS.area) return null;
  const enCasa = isCasaArea(area);
  const label = enCasa ? "Ir a la cabaña" : "Ir a la estación";
  return (
    <button
      onClick={() => travelTo(ESTACION_DESTINO)}
      className="cozy-btn h-[34px] gap-1.5 px-2"
      title={enCasa ? "Volver a la Estación Hyvento, frente a la cabaña" : "Ir a la plataforma de la Estación Hyvento"}
      aria-label={label}
    >
      <PixelIcon name={enCasa ? "cabin" : "bus"} size={14} />
      <span className="max-lg:sr-only">{label}</span>
    </button>
  );
}
