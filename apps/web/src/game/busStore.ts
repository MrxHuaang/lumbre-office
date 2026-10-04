// El Megabús en el cliente: la fase que manda el servidor (`state.bus`) proyectada con la hora del servidor,
// para la ayuda de E en la estación, la pantalla de viaje de los de adentro y los portales de bajada.
import { BUS_TIMINGS, busEtaMs, busTraveling, doorsOpenAt, isBusPhase, isBusStop, type BusPhase, type BusStop, type BusTimings } from "@hyvento/shared";
import { create } from "zustand";
import { serverNow } from "./club/store";

export interface BusView {
  phase: BusPhase;
  since: number;
  nextAt: number;
  run: number;
  /** De dónde a dónde va la ruta en curso (en "route"). */
  from: BusStop;
  to: BusStop;
  /** Cuánto dura un viaje según el servidor (0 = el de siempre). */
  tripMs: number;
}

interface BusStore extends BusView {
  set: (v: BusView) => void;
}

export const useBusStore = create<BusStore>((set) => ({
  phase: "away",
  since: 0,
  nextAt: 0,
  run: 0,
  from: "estacion",
  to: "estacion",
  tripMs: 0,
  set: (v) => set(v),
}));

/** Lee la fase del estado de la sala (tolerante a un valor raro). */
export function readBus(
  raw: { phase?: string; since?: number; nextAt?: number; run?: number; from?: string; to?: string; tripMs?: number } | undefined,
): BusView {
  const phase = raw?.phase && isBusPhase(raw.phase) ? raw.phase : "away";
  const stop = (v: string | undefined): BusStop => (v && isBusStop(v) ? v : "estacion");
  return { phase, since: raw?.since ?? 0, nextAt: raw?.nextAt ?? 0, run: raw?.run ?? 0, from: stop(raw?.from), to: stop(raw?.to), tripMs: raw?.tripMs ?? 0 };
}

/** Los tiempos del bus con la duración del viaje que manda el servidor. */
export function busTimingsOf(b: Pick<BusView, "tripMs">): BusTimings {
  return b.tripMs > 0 ? { ...BUS_TIMINGS, tripMs: b.tripMs } : BUS_TIMINGS;
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
  return busEtaMs(b.phase, b.since, b.nextAt, serverNow(), busTimingsOf(b), b.to);
}
