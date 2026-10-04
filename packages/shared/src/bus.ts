// El Megabús (docs/plan-estructuras.md, estructura 8): un bus articulado como los del Megabús de Pereira
// pasa por la calle del sur del jardín, frena en la "Estación Hyvento" y abre las puertas. Quien se sube
// entra al nivel `megabus` (el bus por dentro). Si alguien quedó a bordo al cerrar las puertas, el bus da
// una vuelta de `tripMs` y vuelve a la misma estación (adentro se ve una pantalla de viaje); si no, sigue
// de largo. El servidor lleva solo la fase y cuándo empezó (`OfficeState.bus`), sin simular el recorrido:
// el cliente dibuja el bus con estas reglas y la hora del servidor.
import { z } from "zod";
import { NIGHT_FROM, NIGHT_UNTIL } from "./clock";

export const BUS = {
  /**
   * Horario laboral del juego (minutos del día, de `serviceFrom` hasta antes de `serviceUntil`): pasa un
   * bus cada `dayEveryMs` reales; el resto (la noche del juego), cada `nightEveryMs`.
   */
  serviceFrom: NIGHT_UNTIL,
  serviceUntil: NIGHT_FROM,
  dayEveryMs: 3 * 60_000,
  nightEveryMs: 10 * 60_000,
  /** El primer bus después de abrir la sala (así no se espera un horario entero). */
  firstInMs: 20_000,
  /**
   * Quien llega en bus (opción de "Mi personaje") espera a lo más esto: si el próximo tarda más, sale uno
   * de refuerzo ya (el horario sigue igual después).
   */
  maxWaitMs: 15_000,
  /** Nombre del nivel de adentro del bus. */
  area: "megabus",
  /** Largo del bus en tiles: el cuerpo de adelante, el fuelle y el de atrás. */
  frontLen: 8.5,
  jointLen: 1,
  rearLen: 6.5,
  /** Puertas de cada cuerpo, en tiles desde el frente hacia atrás. */
  doors: [2, 6.2, 10.6, 13.8],
} as const;

/** Tiempos de una pasada (ms reales); los tests los acortan. */
export interface BusTimings {
  /** Llega frenando desde la punta de la calle. */
  approachMs: number;
  /** Puertas abiertas (se sube y se baja). */
  openMs: number;
  /** Se cierran las puertas. */
  closingMs: number;
  /** Arranca y se pierde por la otra punta (cuando se va sin nadie a bordo). */
  departMs: number;
  /** La vuelta con gente a bordo: de que cierra las puertas hasta que vuelve a abrirlas en la estación. */
  tripMs: number;
  /** Lo que tardan las puertas en abrirse del todo (hasta entonces no se sube ni se baja). */
  doorsMs: number;
}

export const BUS_TIMINGS: BusTimings = {
  approachMs: 9_000,
  openMs: 14_000,
  closingMs: 1_800,
  departMs: 9_000,
  tripMs: 30_000,
  doorsMs: 900,
};

export const BUS_LENGTH = BUS.frontLen + BUS.jointLen + BUS.rearLen;

/**
 * - "away": no hay bus a la vista (espera el horario);
 * - "arriving": entra por la calle y frena en la estación;
 * - "open": parado con las puertas abiertas;
 * - "closing": cierra las puertas;
 * - "route": se fue con gente a bordo y vuelve (la vuelta dura `tripMs` y termina en "open");
 * - "leaving": se va sin nadie a bordo.
 */
export const BUS_PHASES = ["away", "arriving", "open", "closing", "route", "leaving"] as const;
export type BusPhase = (typeof BUS_PHASES)[number];
export const isBusPhase = (v: string): v is BusPhase => (BUS_PHASES as readonly string[]).includes(v);

/** ¿Es horario laboral del juego (pasa más seguido)? */
export const isBusServiceMinute = (minuteOfDay: number) => minuteOfDay >= BUS.serviceFrom && minuteOfDay < BUS.serviceUntil;

/** Cada cuánto pasa el bus a esa hora del juego. */
export const busHeadwayMs = (minuteOfDay: number) => (isBusServiceMinute(minuteOfDay) ? BUS.dayEveryMs : BUS.nightEveryMs);

/** Duración de una fase ("away" no tiene: dura hasta el próximo horario). */
export function phaseMs(phase: BusPhase, t: BusTimings): number {
  switch (phase) {
    case "arriving":
      return t.approachMs;
    case "open":
      return t.openMs;
    case "closing":
      return t.closingMs;
    case "route":
      return t.tripMs;
    case "leaving":
      return t.departMs;
    case "away":
      return 0;
  }
}

/** Cuánto dura una pasada sin nadie a bordo, de que aparece a que se pierde. */
export const runMs = (t: BusTimings) => t.approachMs + t.openMs + t.closingMs + t.departMs;

/** ¿Las puertas están del todo abiertas (se sube y se baja)? */
export const doorsOpenAt = (phase: BusPhase, elapsedMs: number, t: BusTimings) => phase === "open" && elapsedMs >= t.doorsMs;

/** Qué tan abiertas se ven las puertas (0 cerradas … 1 abiertas). */
export function doorsOpening(phase: BusPhase, elapsedMs: number, t: BusTimings): number {
  if (phase === "open") return Math.min(1, elapsedMs / Math.max(1, t.doorsMs));
  if (phase === "closing") return Math.max(0, 1 - elapsedMs / Math.max(1, t.doorsMs));
  return 0;
}

/** Los de adentro no ven el mundo: el bus va en camino (ni parado en la estación ni cerrando). */
export const busTraveling = (phase: BusPhase) => phase !== "open" && phase !== "closing";

/**
 * Dónde va el frente del bus respecto de la parada (tiles: negativo antes de llegar, positivo al irse), con
 * frenado y arranque parejos, o null si no está a la vista. `inDist` = de la punta oeste de la calle a la
 * parada y `outDist` = de la parada a la punta este (hasta que se pierde la cola). En la vuelta ("route")
 * primero se va como al irse y al final vuelve a entrar como al llegar.
 */
export function busOffset(phase: BusPhase, elapsedMs: number, t: BusTimings, inDist: number, outDist: number): number | null {
  const arrive = (ms: number) => {
    const k = 1 - Math.max(0, Math.min(1, ms / Math.max(1, t.approachMs)));
    return -inDist * k * k;
  };
  const depart = (ms: number) => {
    const k = Math.max(0, Math.min(1, ms / Math.max(1, t.departMs)));
    return outDist * k * k;
  };
  switch (phase) {
    case "arriving":
      return arrive(elapsedMs);
    case "open":
    case "closing":
      return 0;
    case "leaving":
      return elapsedMs >= t.departMs ? null : depart(elapsedMs);
    case "route": {
      if (elapsedMs < t.departMs) return depart(elapsedMs);
      const back = elapsedMs - (t.tripMs - t.approachMs);
      return back >= 0 ? arrive(back) : null;
    }
    case "away":
      return null;
  }
}

const smooth = (a: number, b: number, x: number) => {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/**
 * Cuánto se corre hacia el carril de afuera (0 = pegado a la plataforma, 1 = el carril de al lado) un punto
 * del bus que está a `s` tiles (a lo largo de la calle) de donde para el frente: viene por afuera, se arrima
 * para frenar y al irse vuelve a salir. Cada cuerpo lo calcula con su propio centro: por eso el bus se
 * dobla en el fuelle al arrimarse. Todo el largo del bus parado (de `-BUS_LENGTH` a 0) queda en 0: en la
 * estación los dos cuerpos y el fuelle van en línea, pegados a la plataforma.
 */
export const busLane = (s: number) => (s < 0 ? 1 - smooth(-BUS_LENGTH - 16, -BUS_LENGTH + 2, s) : smooth(3, 19, s));

/** Ms que faltan para que el bus abra las puertas en la estación (0 si ya está ahí). */
export function busEtaMs(phase: BusPhase, since: number, nextAt: number, now: number, t: BusTimings): number {
  const elapsed = now - since;
  switch (phase) {
    case "open":
    case "closing":
      return 0;
    case "arriving":
      return Math.max(0, t.approachMs - elapsed);
    case "route":
      return Math.max(0, t.tripMs - elapsed);
    case "leaving":
    case "away":
      return Math.max(0, nextAt - now) + t.approachMs;
  }
}

/** La segunda línea de la pantalla de la estación ("PROXIMO" va arriba): "2 MIN", "YA VIENE"… (cabe en 8 letras). */
export function nextBusText(phase: BusPhase, etaMs: number): string {
  if (phase === "open") return "AQUI";
  if (phase === "closing") return "SALIENDO";
  if (etaMs <= 20_000) return "YA VIENE";
  return `${Math.min(10, Math.max(1, Math.ceil(etaMs / 60_000)))} MIN`;
}

/**
 * Las paradas del Megabús (docs/plan-casas.md): la "Estación Hyvento" del jardín y la de "Casa". Hoy el bus
 * da la vuelta y vuelve a la estación; la de la casa la estrena el viaje de ida y vuelta.
 */
export const BUS_STOPS = ["estacion", "casa"] as const;
export type BusStop = (typeof BUS_STOPS)[number];

/** El nombre de la parada como lo dice la pantallita del bus. */
export function busStopName(stop: BusStop): string {
  return stop === "casa" ? "Casa" : "Estación Hyvento";
}

// ---------- Mensajes ----------

export const BUS_MSG = {
  /** Cliente → servidor: subirse al bus parado en la estación (hay que estar en ella). */
  board: "bus:board",
  /** Servidor → quien lo intentó: por qué no se pudo (`BusNotice`). */
  notice: "bus:notice",
} as const;

export const BusBoardMessage = z.object({}).strict();

export const BusNoticeCode = z.enum(["far", "noBus", "route", "busy"]);
export type BusNoticeCode = z.infer<typeof BusNoticeCode>;
export interface BusNotice {
  code: BusNoticeCode;
}

export const BUS_NOTICES: Record<BusNoticeCode, string> = {
  far: "Hay que estar en la estación, junto a las puertas del bus.",
  noBus: "El bus todavía no abre las puertas: mira la pantalla de la estación.",
  route: "El bus va en ruta: se baja cuando llegue a la estación.",
  busy: "Ahora no puedes subir al bus.",
};
