// Encuadre del modo mesa: qué parte de cada mesa muestra la cámara y con qué zoom, según el tamaño de
// la ventana y lo que tapa la tira de abajo. Sin Phaser, para poder probarlo con ventanas típicas.
import { BLACKJACK_SHAPE, BLACKJACK_TOP_Z, ROULETTE_FELT, ROULETTE_TOP_Z, WHEEL_CENTER, WHEEL_R, WHEEL_TOP_Z, blackjackEdge } from "./casino-layout";
import { localToScreen, numbersFit, type MesaFrame, type ScreenBox } from "./casino-mesa";

/** Ventana del juego (px reales) y alto que tapan abajo la tira del modo mesa y los controles. */
export interface TableViewport {
  w: number;
  h: number;
  strip: number;
}

/** Cuánto del espacio libre ocupa la mesa (el resto queda de aire alrededor). */
const FILL = 0.92;

function rectOf(points: { x: number; y: number }[], padX: number, padTop: number, padBottom = padX): ScreenBox {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs) - padX;
  const y = Math.min(...ys) - padTop;
  return { x, y, w: Math.max(...xs) + padX - x, h: Math.max(...ys) + padBottom - y };
}

/**
 * Lo que encuadra la cámara en la ruleta: solo el plano del paño (sin patas ni costados), con lugar
 * arriba para las pilas de fichas de la fila de atrás.
 */
export function rouletteFeltRect(fr: MesaFrame): ScreenBox {
  const { u0, v0, u1, v1 } = ROULETTE_FELT;
  const z = ROULETTE_TOP_Z;
  return rectOf([localToScreen(fr, u0, v0, z), localToScreen(fr, u1, v0, z), localToScreen(fr, u0, v1, z), localToScreen(fr, u1, v1, z)], 1, 3, 1);
}

/** La rueda: el cuenco con la bola y la torreta (sin el pedestal). */
export function wheelBowlRect(fr: MesaFrame): ScreenBox {
  const { u: cu, v: cv } = WHEEL_CENTER;
  const r = WHEEL_R.rim;
  const pts = [];
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 32) pts.push(localToScreen(fr, cu + Math.cos(a) * r, cv + Math.sin(a) * r, WHEEL_TOP_Z));
  return rectOf(pts, 1, 3, 1.5);
}

/** El blackjack: el paño en D, con lugar arriba para las cartas paradas del crupier y los asientos del fondo. */
export function blackjackFeltRect(fr: MesaFrame): ScreenBox {
  const { u0, straight, v0, v1 } = BLACKJACK_SHAPE;
  const z = BLACKJACK_TOP_Z;
  const pts = [localToScreen(fr, u0, v0, z), localToScreen(fr, u0, v1, z), localToScreen(fr, straight, v0, z), localToScreen(fr, straight, v1, z)];
  for (let v = v0; v <= v1; v += 1) pts.push(localToScreen(fr, blackjackEdge(v), v, z));
  return rectOf(pts, 1, 7, 1);
}

/**
 * Zoom entero con el que `rect` entra en la ventana sin la tira (par si `even`: los dibujos van a
 * R = zoom / 2, puntos de 2 píxeles). Nunca menos que `min`: en ventanas muy chicas la mesa se sale un
 * poco antes que dibujarla ilegible.
 */
export function tableZoom(view: TableViewport, rect: { w: number; h: number }, min: number, max: number, even = true): number {
  const w = view.w * FILL;
  const h = Math.max(1, view.h - view.strip) * FILL;
  let z = Math.floor(Math.min(w / rect.w, h / rect.h));
  if (even) z -= z % 2;
  return Math.max(min, Math.min(max, z));
}

/** Zoom mínimo del paño y del blackjack: a R4 los números caben en sus casillas y las manos no se tocan. */
export const TABLE_MIN_ZOOM = 8;
export const TABLE_MAX_ZOOM = 12;
export const WHEEL_MAX_ZOOM = 14;

/**
 * Zoom de la rueda y la resolución de su dibujo: el zoom no tiene que ser par, así la rueda se ve lo
 * más grande posible. Si los números de 5x7 entran con puntos de 2 píxeles, R = zoom / 2; si no, puntos
 * de 1 píxel (R = zoom). Nunca queda una rueda sin números: el zoom mínimo ya los deja entrar.
 */
export function wheelZoom(view: TableViewport, rect: { w: number; h: number }, minZoom: number): { zoom: number; R: number } {
  let zoom = tableZoom(view, rect, minZoom, WHEEL_MAX_ZOOM, false);
  while (!numbersFit(zoom) && zoom < WHEEL_MAX_ZOOM) zoom++;
  const R = zoom % 2 === 0 && numbersFit(zoom / 2) ? zoom / 2 : zoom;
  return { zoom, R };
}
