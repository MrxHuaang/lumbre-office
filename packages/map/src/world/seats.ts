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
};

/** Altura del asiento de un tipo, contando la grada donde está (butacas del cine). */
export function seatZ(type: string): number {
  return (SEAT_Z[type] ?? (type.startsWith("cinema-seat") ? SEAT_Z["cinema-seat"]! : SIT_BASE_Z)) + (catalogItem(type).lift ?? 0);
}

/**
 * De espaldas no se ven las piernas colgando: la hoja sube estos px para que la cadera quede sobre el
 * asiento (si no, en una banca angosta el cuerpo cuelga por delante de la tabla).
 */
export const SIT_BACK_RAISE = 3;

/**
 * Cuánto bajar (positivo) o subir (negativo) la hoja de sentado en ese asiento, en px de arte. Con
 * `facing`, de espaldas sube un poco más (ver SIT_BACK_RAISE).
 */
export function seatLift(type: string, facing?: Facing): number {
  return SIT_BASE_Z - seatZ(type) - (facing === "left" || facing === "up" ? SIT_BACK_RAISE : 0);
}

/**
 * Sentado de espaldas a la cámara en un asiento con respaldo: el respaldo queda delante. El cuerpo se
 * dibuja debajo del mueble (el respaldo lo tapa de verdad) y encima va solo la cabeza (filas de la hoja
 * < SIT_BACK_ROWS), para que se vea quién es aunque el respaldo sea más alto que el personaje.
 */
export function seatBehind(type: string, facing: Facing): boolean {
  return Boolean(catalogItem(type).hasBack) && (facing === "left" || facing === "up");
}

/**
 * Filas de la hoja de sentado (de arriba) que van sobre el respaldo: la cabeza hasta el cuello (el cuello
 * del chibi sentado cae en FEET_Y - 11; un test lo revisa). Lo alto (sombreros, peinados) entra siempre.
 */
export const SIT_BACK_ROWS = 27;
