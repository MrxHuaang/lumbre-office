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
    /** La puerta principal de la casa (el porche). */
    casa: { tiles: par(15, 12), llegada: { x: 15, y: 14, facing: "down" } },
  },
  plantaBaja: {
    /** La puerta de entrada del recibidor, hacia el jardín. */
    entrada: { tiles: par(7, 26), llegada: { x: 7, y: 24, facing: "up" } },
    // Las escaleras están una sobre otra en todos los pisos (contra la pared oeste, al sur del pasillo): la de la
    // izquierda (x 0..1) une la planta baja con el piso 2 y la de la derecha (x 3..4) baja al sótano
    // y, en el piso 2, sube al 3. Se pisan en la fila de abajo del primer escalón (y = 17).
    escaleraArriba: { tiles: par(0, 17), llegada: { x: 1, y: 18, facing: "down" } },
    escaleraSotano: { tiles: par(3, 17), llegada: { x: 4, y: 18, facing: "down" } },
  },
  piso2: {
    escaleraAbajo: { tiles: par(0, 17), llegada: { x: 1, y: 18, facing: "down" } },
    escaleraArriba: { tiles: par(3, 17), llegada: { x: 4, y: 18, facing: "down" } },
  },
  piso3: {
    escaleraAbajo: { tiles: par(3, 17), llegada: { x: 4, y: 18, facing: "down" } },
  },
  sotano: {
    escalera: { tiles: par(1, 3), llegada: { x: 2, y: 4, facing: "down" } },
  },
} satisfies Record<string, Record<string, Conexion>>;

/** Destino de un portal: la llegada de `c` en el nivel `area`. */
export const hacia = (area: string, c: Conexion) => ({ area, ...c.llegada });
