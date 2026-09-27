// Fase 5: la caja de regalo que se abre (buzón) y el brazo que saluda (gesto sobre el personaje).
import { C, OUT } from "./palette";
import { PixelCanvas, type RGBA } from "./pixel";

export const GIFT_BOX_W = 22;
export const GIFT_BOX_H = 24;
/** Frames de la caja: quieta, se sacude (2), se levanta la tapa y queda abierta con brillos. */
export const GIFT_BOX_FRAMES = 6;

const PAPER = C.rug;
const RIBBON = C.gold;

/** La tapa con el moño, con la esquina de arriba a la izquierda en (x, y). */
function lid(c: PixelCanvas, x: number, y: number) {
  c.rect(x, y, 16, 4, PAPER[3]!);
  c.rect(x, y, 16, 1, PAPER[4]!);
  c.rect(x, y + 3, 16, 1, PAPER[2]!);
  c.rect(x + 7, y, 2, 4, RIBBON[4]!);
  c.rect(x + 8, y, 1, 4, RIBBON[3]!);
  // El moño: dos lazos y el nudo.
  c.rect(x + 3, y - 3, 4, 3, RIBBON[4]!);
  c.rect(x + 9, y - 3, 4, 3, RIBBON[4]!);
  c.rect(x + 4, y - 2, 2, 1, RIBBON[2]!);
  c.rect(x + 10, y - 2, 2, 1, RIBBON[2]!);
  c.rect(x + 7, y - 2, 2, 2, RIBBON[3]!);
  c.set(x + 3, y - 3, RIBBON[5]!);
  c.set(x + 9, y - 3, RIBBON[5]!);
}

/** El cuerpo de la caja (con la cinta al medio); `open` = se ve el interior oscuro y la luz. */
function body(c: PixelCanvas, x: number, y: number, open: boolean) {
  c.rect(x, y, 14, 10, PAPER[3]!);
  c.rect(x, y, 1, 10, PAPER[4]!);
  c.rect(x + 12, y, 2, 10, PAPER[2]!);
  c.rect(x, y + 9, 14, 1, PAPER[1]!);
  // Lunares del papel.
  for (const [px, py] of [[2, 2], [4, 6], [10, 3], [11, 7], [2, 8]] as const) c.set(x + px, y + py, PAPER[5]!);
  c.rect(x + 6, y, 2, 10, RIBBON[4]!);
  c.rect(x + 7, y, 1, 10, RIBBON[3]!);
  if (open) {
    c.rect(x + 1, y, 12, 2, C.woodDark[1]!);
    c.rect(x + 3, y, 8, 1, RIBBON[5]!);
  }
}

/** Un frame de la caja de regalo (22x24). */
export function giftBox(frame: number): PixelCanvas {
  const c = new PixelCanvas(GIFT_BOX_W, GIFT_BOX_H);
  const f = ((frame % GIFT_BOX_FRAMES) + GIFT_BOX_FRAMES) % GIFT_BOX_FRAMES;
  const shake = f === 1 ? -1 : f === 2 ? 1 : 0;
  const open = f >= 3;
  const bx = 4 + shake;
  body(c, bx, 13, open);
  // La tapa salta y queda arriba, un poco corrida.
  const lift = f === 3 ? 4 : f >= 4 ? 7 : 0;
  lid(c, bx - 1 + (f >= 4 ? 1 : 0), 9 - lift);
  c.outline(OUT);
  if (open) {
    // La luz que sale de adentro y unos brillos (sin contorno).
    const glow: RGBA = [...RIBBON[5]!.slice(0, 3), 150] as RGBA;
    for (let i = 0; i < 3; i++) c.rect(bx + 4 + i * 2, 10 - (f === 3 ? 0 : 1), 1, 3 - (i % 2), glow);
    const sparks: [number, number][] =
      f === 3 ? [[2, 8], [19, 9]] : f === 4 ? [[1, 5], [20, 6], [3, 1], [18, 1]] : [[2, 3], [19, 3], [10, 0], [0, 9], [21, 10]];
    for (const [sx, sy] of sparks) {
      c.set(sx, sy, C.white[4]!);
      if (f === 5) {
        c.set(sx - 1, sy, RIBBON[5]!);
        c.set(sx + 1, sy, RIBBON[5]!);
      }
    }
  }
  return c;
}

/**
 * Brazo levantado para saludar (va como capa sobre el personaje, sin rehacer su hoja). `side` = hacia
 * dónde queda la mano (-1 izquierda, 1 derecha); `frame` 0 y 1 alternan para agitarlo. El hombro queda
 * en (`shoulder.x`, `shoulder.y`) del lienzo.
 */
export function wavingArm(sleeve: RGBA, skin: RGBA, frame: number, side: -1 | 1): { canvas: PixelCanvas; shoulder: { x: number; y: number } } {
  const c = new PixelCanvas(10, 12);
  const sx = side === 1 ? 2 : 7;
  const sy = 10;
  // Mano arriba, un poco hacia afuera; en el otro frame, más afuera (se agita).
  const hx = sx + side * (frame % 2 === 0 ? 2 : 4);
  const hy = 2 + (frame % 2);
  const at = (t: number) => ({ x: Math.round(sx + (hx - sx) * t), y: Math.round(sy + (hy - sy) * t) });
  for (let i = 0; i <= 8; i++) {
    const p = at(i / 8);
    c.set(p.x, p.y, i < 3 ? sleeve : skin);
  }
  c.rect(hx - (side === 1 ? 0 : 1), hy - 2, 2, 2, skin);
  c.outline(OUT);
  return { canvas: c, shoulder: { x: sx, y: sy } };
}
