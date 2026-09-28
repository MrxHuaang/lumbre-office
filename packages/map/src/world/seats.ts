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
  // El cojín del orejero queda a 9,5 (más bajo que el del sillón): con 11 flotaba.
  "armchair-wing": 10,
  // La tela cuelga en curva: donde se sienta (a un cuarto de cada punta) queda a ~13.
  hammock: 12,
  "entry-bench": 13,
  "deck-chair": 10,
  // La banca en herradura de la glorieta (sobre la plataforma de piedra).
  gazebo: 12,
  // La reposera de la piscina, casi a ras del deck.
  "sun-lounger": 7,
};

/** Altura del asiento de un tipo, contando la grada donde está (butacas del cine). */
export function seatZ(type: string): number {
  return (SEAT_Z[type] ?? (type.startsWith("cinema-seat") ? SEAT_Z["cinema-seat"]! : SIT_BASE_Z)) + (catalogItem(type).lift ?? 0);
}

/**
 * Cuánto se corre el cuerpo hacia donde mira (unidades de arte), para que la cadera caiga en el centro
 * del cojín y no sobre el respaldo: en los muebles con respaldo grueso el cojín queda por delante del
 * centro del tile. En la glorieta, la banca está más adentro que el centro de los tiles del borde.
 */
const SEAT_FORWARD: Record<string, number> = {
  sofa: 4,
  "lounge-sofa": 4,
  "sofa-leather": 2,
  armchair: 2,
  "armchair-wing": 2,
  "cinema-seat": 2,
  beanbag: 2,
  gazebo: 4,
};

/** Paso de pantalla (px de arte) por unidad hacia cada lado del mundo: toScreen de (±1, 0) y (0, ±1). */
const SCREEN_STEP: Record<Facing, { x: number; y: number }> = {
  right: { x: 1, y: 0.5 },
  left: { x: -1, y: -0.5 },
  down: { x: -1, y: 0.5 },
  up: { x: 1, y: -0.5 },
};

/** Corrimiento en pantalla (px de arte, enteros) del cuerpo sentado en ese asiento mirando a `facing`. */
export function seatShift(type: string, facing: Facing): { x: number; y: number } {
  const n = SEAT_FORWARD[type] ?? (type.startsWith("cinema-seat") ? SEAT_FORWARD["cinema-seat"]! : 0);
  const step = SCREEN_STEP[facing];
  return { x: Math.round(step.x * n) || 0, y: Math.round(step.y * n) || 0 };
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
