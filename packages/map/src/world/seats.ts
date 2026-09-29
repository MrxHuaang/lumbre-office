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
  // La banca de adentro de la sauna (el piso del barril va alto, sobre la cuna).
  sauna: 15,
  // El banco de atrás del bote, bajito dentro del casco.
  rowboat: 6,
};

/** Altura del asiento de un tipo, contando la grada donde está (butacas del cine). */
export function seatZ(type: string): number {
  return (SEAT_Z[type] ?? (type.startsWith("cinema-seat") ? SEAT_Z["cinema-seat"]! : SIT_BASE_Z)) + (catalogItem(type).lift ?? 0);
}

/**
 * Solo de espaldas: cuánto se corre el cuerpo hacia donde mira (unidades de arte), para que la cadera
 * caiga en el cojín y no sobre el respaldo grueso, que es lo que queda delante. De frente el cuerpo va
 * centrado en el tile: así se lee centrado sobre el asiento.
 */
const SEAT_FORWARD: Record<string, number> = {
  sofa: 4,
  "lounge-sofa": 4,
  "sofa-leather": 2,
  armchair: 2,
  "armchair-wing": 2,
  "cinema-seat": 2,
  beanbag: 2,
};

/**
 * En todas las orientaciones: la banca en herradura de la glorieta está más adentro que el centro de los
 * tiles del borde (unidades de arte hacia donde mira).
 */
const SEAT_INSET: Record<string, number> = {
  gazebo: 4,
};

/**
 * Solo de espaldas: cuánto va el cuerpo hacia el respaldo delgado (unidades de arte). El respaldo está en
 * el borde del tile (x 2..4) y el cuerpo en el centro quedaba a un lado de él; corrido, el respaldo le
 * tapa la espalda y la cabeza asoma justo encima. De frente no se corre: queda centrado en el cojín.
 */
const SEAT_AGAINST_BACK: Record<string, number> = {
  chair: 4,
  "office-chair": 4,
  "office-chair-broken": 4,
  "bus-seat": 4,
  bench: 4,
  "patio-chair": 2,
};

/** Tipo del que un asiento toma sus medidas: las variantes de color y las gradas del cine son el mismo mueble. */
function seatFamily(type: string): string {
  if (type.startsWith("cinema-seat")) return "cinema-seat";
  if (type.startsWith("office-chair") && type !== "office-chair-broken") return "office-chair";
  if (type.startsWith("bus-seat")) return "bus-seat";
  return type;
}

/** Paso de pantalla (px de arte) por unidad hacia cada lado del mundo: toScreen de (±1, 0) y (0, ±1). */
const SCREEN_STEP: Record<Facing, { x: number; y: number }> = {
  right: { x: 1, y: 0.5 },
  left: { x: -1, y: -0.5 },
  down: { x: -1, y: 0.5 },
  up: { x: 1, y: -0.5 },
};

/**
 * Corrimiento en pantalla (px de arte, enteros) del cuerpo sentado en ese asiento mirando a `facing`:
 * de frente, centrado (salvo la glorieta, SEAT_INSET); de espaldas, hacia el cojín delante del respaldo
 * grueso (SEAT_FORWARD) o contra el respaldo delgado (SEAT_AGAINST_BACK).
 */
export function seatShift(type: string, facing: Facing): { x: number; y: number } {
  const family = seatFamily(type);
  const behind = facing === "left" || facing === "up";
  const n = (SEAT_INSET[family] ?? 0) + (behind ? (SEAT_FORWARD[family] ?? 0) - (SEAT_AGAINST_BACK[family] ?? 0) : 0);
  const step = SCREEN_STEP[facing];
  return { x: Math.round(step.x * n) || 0, y: Math.round(step.y * n) || 0 };
}

/**
 * De espaldas tras un respaldo no se ven las piernas colgando: la hoja sube estos px para que la cadera
 * quede sobre el asiento y la cabeza asome sobre el respaldo. Sin respaldo no sube: el cuerpo se corta
 * a la altura del asiento (ver seatBodyRows) y queda a la misma altura que de frente.
 */
export const SIT_BACK_RAISE = 3;

/**
 * Cuánto bajar (positivo) o subir (negativo) la hoja de sentado en ese asiento, en px de arte. Con
 * `facing`, de espaldas tras un respaldo sube un poco más (ver SIT_BACK_RAISE).
 */
export function seatLift(type: string, facing?: Facing): number {
  return SIT_BASE_Z - seatZ(type) - (facing && seatBehind(type, facing) ? SIT_BACK_RAISE : 0);
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

/**
 * De espaldas en un asiento sin respaldo (banquetas, troncos, bancas de picnic, cojines, la hamaca) no
 * hay nada que tape la cadera y el cuerpo parecía parado encima del asiento: se dibuja solo lo de arriba
 * (filas de la hoja < SIT_WAIST_ROWS) y lo de abajo queda "dentro" del asiento. El corte cae 2 filas
 * sobre el cinturón (FEET_Y - 3; un test lo revisa): justo en el borde del cojín que da a la cámara.
 */
export const SIT_WAIST_ROWS = 32;

/** Filas de la hoja de sentado que se dibujan en ese asiento mirando a `facing` (null: todas). */
export function seatBodyRows(type: string, facing: Facing): number | null {
  if (facing !== "left" && facing !== "up") return null;
  return catalogItem(type).hasBack ? null : SIT_WAIST_ROWS;
}
