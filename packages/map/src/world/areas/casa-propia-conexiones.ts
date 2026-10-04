// Dónde se conectan los tres niveles de la casa de cada persona (como CONEXIONES, pero de la plantilla:
// las mismas para todas las casas). Cada conexión tiene los tiles del portal y la llegada a ESE nivel.
import type { Conexion } from "./conexiones";

const par = (x: number, y: number) => [
  { x, y },
  { x: x + 1, y },
];

export const CASA_CONEXIONES = {
  afuera: {
    /** Frente a la puerta de la casona (x 6..7 de su frente; la casona está en (21, 9) y mide 14x9). */
    puerta: { tiles: par(27, 18), llegada: { x: 27, y: 19, facing: "down" } },
    /** Frente a la puerta de atrás, en el costado este de la casona: da al patio. */
    atras: { tiles: [{ x: 35, y: 13 }], llegada: { x: 36, y: 13, facing: "right" } },
    /** Donde se baja del bus (la vereda, frente al refugio de la parada). */
    parada: { tiles: [], llegada: { x: 32, y: 30, facing: "up" } },
  },
  abajo: {
    /** La puerta de entrada del recibidor, en la pared sur. */
    puerta: { tiles: par(2, 14), llegada: { x: 2, y: 12, facing: "up" } },
    /** La puerta de atrás de la sala de fiestas, en la pared este: sale al patio. */
    atras: { tiles: [{ x: 26, y: 4 }], llegada: { x: 24, y: 4, facing: "left" } },
    /** El pie de la escalera del pasillo (sube al segundo piso). */
    escalera: { tiles: par(7, 11), llegada: { x: 8, y: 12, facing: "down" } },
  },
  arriba: {
    /** El pie de la escalera del pasillo (baja al primer piso), una sobre otra. */
    escalera: { tiles: par(7, 11), llegada: { x: 8, y: 12, facing: "down" } },
  },
} satisfies Record<string, Record<string, Conexion>>;
