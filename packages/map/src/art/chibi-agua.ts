// El personaje en el agua de la piscina: medio cuerpo asomado con el agua alrededor. Se arma desde la
// hoja de caminata ya dibujada (cualquier Look sirve): se recorta a la altura del pecho, se baja para que
// la línea del agua quede junto a los pies y se le pone la onda (la mitad de atrás detrás del cuerpo y la
// de adelante encima). Los cuadros de la brazada son los del paso (los brazos ya se mueven).
import { FEET_Y, FRAME, FRAMES, SHEET_DIRECTIONS } from "./chibi";
import { POOL_WATER } from "./agua";
import { PixelCanvas, alpha, at, type RGBA } from "./pixel";

/** Fila de la hoja de caminata donde se corta (a la altura del pecho). */
export const SWIM_CUT = 21;
/** Fila de la hoja de nado donde queda la línea del agua (un poco más abajo que los pies). */
export const SWIM_WATERLINE = FEET_Y + 1;
/** Cuánto baja el dibujo nadando: el nombre y las burbujas bajan lo mismo. */
export const SWIM_DROP = SWIM_WATERLINE - SWIM_CUT;

/** Onda alrededor del cuerpo: `front` = la mitad de adelante (debajo de la línea del agua). */
function ring(c: PixelCanvas, ox: number, frame: number, front: boolean) {
  const cx = ox + 16;
  const cy = SWIM_WATERLINE;
  const rx = 8.5;
  const ry = 2.6;
  for (let y = cy - 4; y <= cy + 4; y++)
    for (let x = ox; x < ox + FRAME; x++) {
      const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
      if (Math.abs(d - 1) > 0.2) continue;
      const below = y + 0.5 >= cy;
      if (below !== front) continue;
      // En la brazada, un poco de espuma de un lado o del otro.
      const side = x < cx ? -1 : 1;
      const foam = (frame === 1 && side < 0) || (frame === 2 && side > 0);
      const col: RGBA = foam ? at(POOL_WATER, 5) : alpha(at(POOL_WATER, 5), front ? 0.9 : 0.6);
      c.set(x, y, col);
    }
  // Agua turbia justo debajo de la línea: lo que queda del cuerpo se ve a través.
  if (front)
    for (let x = cx - 6; x <= cx + 6; x++) {
      c.set(x, cy, alpha(at(POOL_WATER, 3), 0.55));
      if (Math.abs(x - cx) < 5) c.set(x, cy + 1, alpha(at(POOL_WATER, 2), 0.45));
    }
}

/** Hoja de nado (3 columnas x 4 filas, como la de caminata) a partir de la hoja de caminata. */
export function drawSwimming(walk: PixelCanvas): PixelCanvas {
  const sheet = new PixelCanvas(FRAME * FRAMES, FRAME * SHEET_DIRECTIONS.length);
  for (let row = 0; row < SHEET_DIRECTIONS.length; row++)
    for (let col = 0; col < FRAMES; col++) {
      const ox = col * FRAME;
      const oy = row * FRAME;
      const cell = new PixelCanvas(FRAME * FRAMES, FRAME);
      ring(cell, ox, col, false);
      for (let y = 0; y < SWIM_CUT; y++)
        for (let x = 0; x < FRAME; x++) {
          const i = ((oy + y) * walk.width + ox + x) * 4;
          if (!walk.data[i + 3]) continue;
          const ty = y + SWIM_DROP;
          if (ty > SWIM_WATERLINE) continue;
          cell.set(ox + x, ty, [walk.data[i]!, walk.data[i + 1]!, walk.data[i + 2]!, walk.data[i + 3]!]);
        }
      ring(cell, ox, col, true);
      for (let y = 0; y < FRAME; y++)
        for (let x = 0; x < FRAME; x++) {
          const i = (y * cell.width + ox + x) * 4;
          if (cell.data[i + 3]) sheet.set(ox + x, oy + y, [cell.data[i]!, cell.data[i + 1]!, cell.data[i + 2]!, cell.data[i + 3]!]);
        }
    }
  return sheet;
}
