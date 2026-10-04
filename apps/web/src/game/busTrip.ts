// El viaje en Megabús visto desde adentro (la pantalla del viaje, components/bus/BusTrip.tsx): a dónde va,
// cuánto falta, qué tan rápido pasa el paisaje y cuándo suena el timbre. Todo sale de la fase que manda el
// servidor (`state.bus`) y de la hora del servidor; aquí no hay reglas, solo la cuenta (con tests).
import { BUS_TIMINGS, type BusPhase, type BusStop, type BusTimings } from "@hyvento/shared";

/** Lo que el cliente sabe del bus (lo de `useBusStore`). */
export interface BusTripState {
  phase: BusPhase;
  since: number;
  nextAt: number;
  /** A dónde va la ruta en curso y cuánto dura un viaje (0 = el de siempre); ver `state.bus`. */
  to?: BusStop;
  tripMs?: number;
}

/** A qué parada va el bus y cuánto dura el viaje. */
export interface TripInfo {
  stop: BusStop;
  durationMs: number;
}

/**
 * El único lugar que dice a dónde va el viaje y cuánto dura (lo manda el servidor en `state.bus`). Solo una
 * ruta va a la casa; llegando o esperando el bus, se va a la estación.
 */
export function tripInfo(bus: BusTripState): TripInfo {
  const stop: BusStop = bus.phase === "route" && bus.to === "casa" ? "casa" : "estacion";
  return { stop, durationMs: bus.tripMs && bus.tripMs > 0 ? bus.tripMs : BUS_TIMINGS.tripMs };
}

/** Faltando esto (ms) para llegar se pide la parada: suena el timbre y la pantallita lo avisa. */
export const BELL_MS = 4_000;

export interface TripView {
  /** Lo recorrido, 0..1 (la barra de la pantallita). */
  progress: number;
  /** Ms que faltan para abrir las puertas. */
  etaMs: number;
  /** Qué tan rápido pasa el paisaje: 0 quieto … 1 a toda. */
  speed: number;
  /** Ya se pidió la parada (falta poco). */
  bell: boolean;
  /** Llegó: está parado con las puertas abiertas (o cerrándolas). */
  arrived: boolean;
  /** Lo que dice arriba de la pantallita. */
  status: string;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Cómo va el viaje ahora. La velocidad sigue el mismo arranque y frenado que el bus de la calle (`busOffset`:
 * posición cuadrática, velocidad que sube o baja en línea recta): sale quieto, va a toda y frena hasta
 * pararse justo al abrir las puertas.
 */
export function tripView(bus: BusTripState, now: number, info: TripInfo, t: BusTimings = BUS_TIMINGS): TripView {
  const elapsed = Math.max(0, now - bus.since);
  const dur = Math.max(1, info.durationMs);
  let eta: number;
  let speed: number;
  let leaving = false;
  switch (bus.phase) {
    case "open":
    case "closing":
      return { progress: 1, etaMs: 0, speed: 0, bell: true, arrived: true, status: "Llegamos" };
    case "route":
    case "leaving":
      eta = Math.max(0, dur - elapsed);
      leaving = elapsed < t.departMs;
      speed = Math.min(clamp01(elapsed / Math.max(1, t.departMs)), clamp01(eta / Math.max(1, t.approachMs)));
      break;
    case "arriving":
      eta = Math.max(0, t.approachMs - elapsed);
      speed = clamp01(eta / Math.max(1, t.approachMs));
      break;
    case "away":
      // Quien llega en bus y espera el que sale: ya va en camino a toda.
      eta = Math.max(0, bus.nextAt - now) + t.approachMs;
      speed = 1;
      break;
  }
  const bell = eta <= BELL_MS;
  const status = bell ? "Parada solicitada" : leaving ? "Saliendo" : bus.phase === "arriving" ? "Llegando" : "En ruta";
  return { progress: clamp01(1 - eta / dur), etaMs: eta, speed, bell, arrived: false, status };
}
