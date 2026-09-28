// El Megabús en el cliente: la fase que manda el servidor (`state.bus`) proyectada con la hora del servidor,
// para la ayuda de E en la estación, la pantalla de viaje de los de adentro y los portales de bajada.
import { BUS_TIMINGS, busEtaMs, busTraveling, doorsOpenAt, isBusPhase, type BusPhase } from "@hyvento/shared";
import { create } from "zustand";
import { serverNow } from "./club/store";

export interface BusView {
  phase: BusPhase;
  since: number;
  nextAt: number;
  run: number;
}

interface BusStore extends BusView {
  set: (v: BusView) => void;
}

export const useBusStore = create<BusStore>((set) => ({
  phase: "away",
  since: 0,
  nextAt: 0,
  run: 0,
  set: (v) => set(v),
}));

/** Lee la fase del estado de la sala (tolerante a un valor raro). */
export function readBus(raw: { phase?: string; since?: number; nextAt?: number; run?: number } | undefined): BusView {
  const phase = raw?.phase && isBusPhase(raw.phase) ? raw.phase : "away";
  return { phase, since: raw?.since ?? 0, nextAt: raw?.nextAt ?? 0, run: raw?.run ?? 0 };
}

/** ¿Están abiertas del todo las puertas ahora (se sube y se baja)? */
export function busDoorsOpenNow(): boolean {
  const b = useBusStore.getState();
  return doorsOpenAt(b.phase, serverNow() - b.since, BUS_TIMINGS);
}

/** ¿El bus va en camino (los de adentro ven la pantalla de viaje)? */
export const busTravelingNow = () => busTraveling(useBusStore.getState().phase);

/** Ms hasta que el bus abra las puertas en la estación. */
export function busEtaNow(): number {
  const b = useBusStore.getState();
  return busEtaMs(b.phase, b.since, b.nextAt, serverNow(), BUS_TIMINGS);
}
