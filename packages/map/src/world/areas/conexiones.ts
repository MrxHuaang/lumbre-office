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
    /** La puerta principal de la casa: el porche (la casa está en (52, 14) y mide 22x14). */
    casa: { tiles: par(62, 28), llegada: { x: 62, y: 30, facing: "down" } },
    /**
     * El pie de la escalera exterior de madera que sube al balcón del piso 2: pegada al costado este de la
     * terraza cubierta (la casa termina en x = 73), baja hasta el pasto en y = 28.
     */
    escaleraTerraza: { tiles: [{ x: 73, y: 28 }], llegada: { x: 73, y: 29, facing: "down" } },
    /** La puerta chica del garaje, pegado al oeste de la torre (el garaje está en (47, 23) y mide 5x5). */
    garaje: { tiles: [{ x: 50, y: 28 }], llegada: { x: 50, y: 29, facing: "down" } },
    /**
     * El pie de la escalera de cuerda de la casa del árbol, en el huerto de frutales (el árbol está en
     * (11, 80) y mide 4x4; la escalera cuelga frente al segundo tile).
     */
    casaArbol: { tiles: [{ x: 12, y: 84 }], llegada: { x: 12, y: 85, facing: "down" } },
    /**
     * La puerta del observatorio, arriba de la loma del este (la torre está en (128, 40) y mide 6x6): se
     * sube por los escalones de piedra del frente y se entra por la puerta de la torre.
     */
    observatorio: { tiles: par(130, 46), llegada: { x: 130, y: 47, facing: "down" } },
  },
  plantaBaja: {
    /** La puerta de entrada del recibidor, al centro de la fachada sur (detrás del porche del jardín). */
    entrada: { tiles: par(17, 26), llegada: { x: 17, y: 24, facing: "up" } },
    // Las escaleras están una sobre otra en todos los pisos, contra la pared norte del recibidor (o del
    // rellano): la de la izquierda (x 11..12) une la planta baja con el piso 2 y la de la derecha
    // (x 14..15) baja al sótano y, en el piso 2, sube al 3. Se pisan en la fila de abajo del primer
    // escalón (y = 17). El sótano no: ahí esas baldosas son del casino y su escalera está en el
    // vestíbulo (ver `sotano` abajo); bajar lleva de una a la otra.
    escaleraArriba: { tiles: par(11, 17), llegada: { x: 12, y: 18, facing: "down" } },
    escaleraSotano: { tiles: par(14, 17), llegada: { x: 15, y: 18, facing: "down" } },
  },
  piso2: {
    escaleraAbajo: { tiles: par(11, 17), llegada: { x: 12, y: 18, facing: "down" } },
    escaleraArriba: { tiles: par(14, 17), llegada: { x: 15, y: 18, facing: "down" } },
    /** La salida del balcón (esquina este) a la escalera exterior que baja al jardín. */
    terraza: { tiles: [{ x: 28, y: 24 }], llegada: { x: 27, y: 24, facing: "left" } },
  },
  piso3: {
    escaleraAbajo: { tiles: par(14, 17), llegada: { x: 15, y: 18, facing: "down" } },
  },
  sotano: {
    /** La escalera del vestíbulo, contra la pared norte. */
    escalera: { tiles: par(28, 3), llegada: { x: 28, y: 4, facing: "down" } },
  },
  garaje: {
    /** La puerta de la pared sur del taller (se sale al jardín, frente a la puerta chica). */
    entrada: { tiles: par(6, 10), llegada: { x: 6, y: 9, facing: "up" } },
  },
  casaArbol: {
    /** La trampilla del piso, cerca del rincón del frente: se llega a su lado, mirando a la mesita. */
    trampilla: { tiles: [{ x: 5, y: 4 }], llegada: { x: 5, y: 3, facing: "left" } },
  },
  megabus: {
    /**
     * Las tres puertas del bus por dentro (en la pared baja del sur: la de atrás y las dos de adelante). No
     * se entra por un portal: se sube con E en la estación y se llega junto a la puerta más cercana.
     */
    puertas: { tiles: [{ x: 4, y: 5 }, { x: 13, y: 5 }, { x: 18, y: 5 }], llegada: { x: 13, y: 2, facing: "right" } },
  },
  observatorio: {
    /** La puerta de la pared sur de la torre (se sale al jardín, al pie de los escalones). */
    entrada: { tiles: par(6, 11), llegada: { x: 6, y: 10, facing: "up" } },
  },
} satisfies Record<string, Record<string, Conexion>>;

/** Destino de un portal: la llegada de `c` en el nivel `area`. */
export const hacia = (area: string, c: Conexion) => ({ area, ...c.llegada });
