// El agua que brilla (historia, capítulo 3): los destellos de luna que titilan sobre el lago del jardín
// cuando la luna está alta y el cielo limpio. Son chiquitos (un punto, una crucecita y una estrellita de
// cuatro puntas) en crema y celeste pálido, con el borde a medio transparentar; el cliente los prende y
// apaga encima del agua (game/aguaBrilla.ts).
import { PixelCanvas, hex, type RGBA } from "./pixel";

/** Cuántos tamaños de destello hay. */
export const LAKE_GLINT_KINDS = 3;

const CORE = hex("#fffbe6");
const MID = hex("#d8f0ff", 220);
const EDGE = hex("#9fd2f0", 120);

/** Un destello de luna: 0 = punto con halo, 1 = crucecita, 2 = estrellita de cuatro puntas. */
export function lakeGlint(kind: number): PixelCanvas {
  const k = Math.max(0, Math.min(LAKE_GLINT_KINDS - 1, Math.floor(kind)));
  const size = 3 + k * 2;
  const c = new PixelCanvas(size, size);
  const mid = (size - 1) / 2;
  const put = (x: number, y: number, col: RGBA) => c.set(mid + x, mid + y, col);
  put(0, 0, CORE);
  // Los brazos: más largos en los destellos grandes, y se apagan hacia la punta.
  for (let r = 1; r <= k + 1; r++) {
    const col = r === k + 1 ? EDGE : MID;
    put(r, 0, col);
    put(-r, 0, col);
    put(0, r, col);
    put(0, -r, col);
  }
  // El halo del punto (solo el más chico, para que no quede en un pixel suelto).
  if (k === 0) for (const [x, y] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) put(x, y, hex("#9fd2f0", 70));
  return c;
}
