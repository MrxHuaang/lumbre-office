"use client";

// La ayuda de E en la estación del Megabús: "Subir al Megabús" con las puertas abiertas; si no, cuánto falta.
import { useEffect, useState } from "react";
import { busDoorsOpenNow, busEtaNow, useBusStore } from "@/game/busStore";

/** Se vuelve a mirar cada medio segundo (la cuenta corre sola con la hora del servidor). */
export function useBusTick(ms = 500) {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

/** "3 min", "1 min" o "unos segundos". */
export function etaText(ms: number): string {
  if (ms <= 45_000) return "unos segundos";
  return `${Math.ceil(ms / 60_000)} min`;
}

export function BusPromptLabel() {
  useBusTick();
  const phase = useBusStore((s) => s.phase);
  if (busDoorsOpenNow()) return <>Subir al Megabús</>;
  if (phase === "closing") return <>El Megabús está cerrando las puertas</>;
  return <>Megabús: llega en {etaText(busEtaNow())}</>;
}
