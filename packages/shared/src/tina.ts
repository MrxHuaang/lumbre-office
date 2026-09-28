// La tina caliente y la sauna de barril de la orilla del lago: un rincón para conversar al terminar el día.
// Se entra sentándose (los asientos son del catálogo: la tina y la banca de la sauna); adentro la charla es
// privada (zona aislada), cada rato de descanso da puntos de ocio y al salir se queda mojado un rato (lo de
// la piscina). Reglas que comparten el servidor (las valida) y el cliente (las anticipa y dibuja).

export const TINA = {
  /** Cada cuánto da puntos el descanso adentro (con el tope diario del ocio). */
  tickMs: 5 * 60_000,
  /** Puntos por cada rato de descanso. */
  points: 2,
  /** Cada cuánto revisa la sala quién está adentro. */
  checkMs: 10_000,
} as const;

export type SpaKind = "tub" | "sauna";

/** Asientos del descanso por tipo de mueble: la tina (medio cuerpo en el agua) y la banca de la sauna. */
const SPA_SEATS: Readonly<Record<string, SpaKind>> = { "hot-tub": "tub", sauna: "sauna" };

/** ¿Ese tipo de asiento es de la tina o de la sauna? */
export const spaKindOf = (type: string): SpaKind | null => (Object.hasOwn(SPA_SEATS, type) ? SPA_SEATS[type]! : null);
