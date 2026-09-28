// Cómo se dibuja alguien sentado en cada tipo de asiento: a qué altura queda (cada dibujo tiene su
// asiento más alto o más bajo) y, de espaldas, qué parte asoma sobre el respaldo.
import { catalogItem } from "./catalog";
import type { Facing } from "./types";

/** Altura del asiento de una silla (px de arte): la hoja de sentado está hecha para ella. */
export const SIT_BASE_Z = 11;

/** Altura de la superficie del asiento en el dibujo de cada tipo (px de arte); si falta, la de la silla. */
const SEAT_Z: Record<string, number> = {
  stool: 14,
  armchair: 10,
  bench: 10,
  beanbag: 7,
  "cinema-seat": 10,
  "log-seat": 8,
  "picnic-bench": 9,
  "patio-chair": 10,
  "armchair-wing": 11,
  hammock: 10,
  "entry-bench": 13,
  "deck-chair": 10,
  // La banca en herradura de la glorieta (sobre la plataforma de piedra).
  gazebo: 12,
  // La reposera de la piscina, casi a ras del deck.
  "sun-lounger": 7,
  // La banca de adentro de la sauna (el piso del barril va alto, sobre la cuna).
  sauna: 15,
};

/** Altura del asiento de un tipo, contando la grada donde está (butacas del cine). */
export function seatZ(type: string): number {
  return (SEAT_Z[type] ?? (type.startsWith("cinema-seat") ? SEAT_Z["cinema-seat"]! : SIT_BASE_Z)) + (catalogItem(type).lift ?? 0);
}

/** Cuánto bajar (positivo) o subir (negativo) la hoja de sentado en ese asiento, en px de arte. */
export function seatLift(type: string): number {
  return SIT_BASE_Z - seatZ(type);
}

/**
 * Sentado de espaldas a la cámara en un asiento con respaldo: el respaldo queda delante. Se dibuja la
 * persona encima del mueble pero solo hasta los hombros (filas de la hoja < SIT_BACK_ROWS), para que la
 * cabeza asome sobre el respaldo y el resto quede tapado.
 */
export function seatBehind(type: string, facing: Facing): boolean {
  return Boolean(catalogItem(type).hasBack) && (facing === "left" || facing === "up");
}

/**
 * Filas de la hoja de sentado (de arriba) que se ven sobre el respaldo: cabeza y hombros. El respaldo
 * tapa desde 6 filas sobre los pies de la hoja (FEET_Y - 6 del chibi; un test lo revisa): la cadera
 * del chibi sentado queda siempre a la misma altura, aunque el personaje crezca hacia arriba.
 */
export const SIT_BACK_ROWS = 31;
