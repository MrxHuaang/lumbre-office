// Dónde se conectan los niveles. Cada conexión tiene los tiles del portal (se pisan para cambiar de
// nivel) y la llegada (donde aparece quien entra a ESTE nivel por esa conexión; nunca sobre un portal).
// Cada nivel mantiene sus propias entradas; los demás niveles las importan para armar sus portales.
import type { Facing } from "../types";

export interface Conexion {
  tiles: { x: number; y: number }[];
  llegada: { x: number; y: number; facing: Facing };
}

const par = (x: number, y: number) => [
  { x, y },
  { x: x + 1, y },
];

export const CONEXIONES = {
  jardin: {
    /** La puerta principal de la casa: el porche (la casa está en (38, 13) y mide 22x14). */
    casa: { tiles: par(48, 27), llegada: { x: 48, y: 29, facing: "down" } },
  },
  plantaBaja: {
    /** La puerta de entrada del recibidor, hacia el jardín. */
    entrada: { tiles: par(4, 17), llegada: { x: 4, y: 15, facing: "up" } },
    escaleraArriba: { tiles: par(0, 12), llegada: { x: 1, y: 14, facing: "down" } },
    escaleraSotano: { tiles: par(6, 12), llegada: { x: 7, y: 13, facing: "down" } },
  },
  piso2: {
    escaleraAbajo: { tiles: par(8, 3), llegada: { x: 9, y: 5, facing: "down" } },
    escaleraArriba: { tiles: par(8, 16), llegada: { x: 10, y: 16, facing: "up" } },
  },
  piso3: {
    escaleraAbajo: { tiles: par(5, 5), llegada: { x: 5, y: 6, facing: "down" } },
  },
  sotano: {
    escalera: { tiles: par(1, 3), llegada: { x: 2, y: 4, facing: "down" } },
  },
} satisfies Record<string, Record<string, Conexion>>;

/** Destino de un portal: la llegada de `c` en el nivel `area`. */
export const hacia = (area: string, c: Conexion) => ({ area, ...c.llegada });
