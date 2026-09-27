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
    /** La puerta de entrada del recibidor, al centro de la fachada sur (detrás del porche del jardín). */
    entrada: { tiles: par(17, 26), llegada: { x: 17, y: 24, facing: "up" } },
    // Las escaleras están una sobre otra en todos los pisos, contra la pared norte del recibidor (o del
    // rellano): la de la izquierda (x 11..12) une la planta baja con el piso 2 y la de la derecha
    // (x 14..15) baja al sótano y, en el piso 2, sube al 3. Se pisan en la fila de abajo del primer
    // escalón (y = 17). El sótano pone su escalera en estos mismos tiles.
    escaleraArriba: { tiles: par(11, 17), llegada: { x: 12, y: 18, facing: "down" } },
    escaleraSotano: { tiles: par(14, 17), llegada: { x: 15, y: 18, facing: "down" } },
  },
  piso2: {
    escaleraAbajo: { tiles: par(11, 17), llegada: { x: 12, y: 18, facing: "down" } },
    escaleraArriba: { tiles: par(14, 17), llegada: { x: 15, y: 18, facing: "down" } },
  },
  piso3: {
    escaleraAbajo: { tiles: par(14, 17), llegada: { x: 15, y: 18, facing: "down" } },
  },
  sotano: {
    /** La escalera del vestíbulo, contra la pared norte. */
    escalera: { tiles: par(28, 3), llegada: { x: 28, y: 4, facing: "down" } },
  },
} satisfies Record<string, Record<string, Conexion>>;

/** Destino de un portal: la llegada de `c` en el nivel `area`. */
export const hacia = (area: string, c: Conexion) => ({ area, ...c.llegada });
