// Proyección isométrica pura (sin Phaser): la usan también módulos que se cargan fuera del juego
// (paneles de React, el SSR de Next), donde importar Phaser rompe porque toca `window` al cargarse.
import { WORLD_TO_ART, toScreen, toWorld } from "@hyvento/map/art";

/** Punto del mundo (px de juego, z en px de pantalla) → coordenadas de pantalla del juego. */
export function worldToScreen(x: number, y: number, z = 0) {
  return toScreen(x * WORLD_TO_ART, y * WORLD_TO_ART, z);
}

/** Pantalla → mundo sobre el piso (z = 0). */
export function screenToWorld(sx: number, sy: number) {
  const a = toWorld(sx, sy);
  return { x: a.x / WORLD_TO_ART, y: a.y / WORLD_TO_ART };
}

/** Profundidad isométrica: lo que está más abajo-adelante (mayor x + y) se dibuja encima. */
export const depthOf = (x: number, y: number) => x + y;
export const DEPTH_FLAT = -1e6;
export const DEPTH_OVERLAY = 1e7;
