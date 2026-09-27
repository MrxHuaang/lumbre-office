// El tablón de fotos de la cafetería: un corcho grande sobre dos patas, contra la pared (mirando a +x).
// Las fotos se pinchan encima como una capa aparte (`photoBoardPhotos`), del mismo tamaño y origen que el
// dibujo del mueble: el cliente la arma con las miniaturas de las últimas fotos y la pone encima.
import { leg, shadowUnder } from "./kit";
import { C, OUT, mix } from "./palette";
import { PixelCanvas, at, flat, noise, renderSprite, type RGBA, type Shader, type Sprite } from "./pixel";

/** Cara del corcho (la +x de la tabla): su plano `x1`, a lo ancho `y0..y1` y a lo alto `z0..z1`. */
const FACE = { x1: 7, y0: 1, y1: 47, z0: 8, z1: 45 };
const FRAME = 1.6;

/** Tamaño de la foto de cada miniatura (en px de arte; el cliente achica la foto a esto). */
export const PHOTO_BOARD_PIC = { w: 11, h: 7 } as const;
/** Miniaturas del tablón: 3 columnas x 3 filas. */
export const PHOTO_BOARD_SLOTS = 9;
const COLS = 3;
/** Marco blanco de cada miniatura (más ancho abajo, como una polaroid). */
const BORDER = { side: 1, top: 1, bottom: 2 };
const THUMB_W = PHOTO_BOARD_PIC.w + BORDER.side * 2;
const THUMB_H = PHOTO_BOARD_PIC.h + BORDER.top + BORDER.bottom;

const PIN_COLORS = [C.rug, C.fabric, C.mustard, C.leaf, C.rose];

const cork: Shader = (u, v, fw, fh) => {
  const edge = Math.min(u, v, fw - u, fh - v);
  if (edge < FRAME) return at(C.wood, u < FRAME || v >= fh - FRAME ? 4 : 2);
  const n = noise(Math.floor(u), Math.floor(v), 17);
  // Grumos del corcho y unos agujeros de chinches viejas.
  if (n < 0.05) return at(C.cork, 1);
  if (n > 0.9) return at(C.cork, 4);
  return at(C.cork, n < 0.45 ? 2 : 3);
};

/** El tablón vacío (el mueble del catálogo). */
export function photoBoard(): Sprite {
  const wood = C.woodDark;
  return renderSprite(
    [
      leg(4, 4, 12, wood),
      leg(4, 42, 12, wood),
      {
        x: 5,
        y: FACE.y0,
        z: FACE.z0,
        w: FACE.x1 - 5,
        d: FACE.y1 - FACE.y0,
        h: FACE.z1 - FACE.z0,
        top: flat(at(C.wood, 5)),
        left: flat(at(C.wood, 3)),
        right: cork,
      },
      // La repisita de abajo, para que el tablón no se vea colgando.
      { x: 5, y: FACE.y0 + 1, z: FACE.z0 - 1.5, w: 3.5, d: FACE.y1 - FACE.y0 - 2, h: 1.5, top: flat(at(C.wood, 4)), left: flat(at(C.wood, 2)), right: flat(at(C.wood, 3)) },
    ],
    { outline: OUT, under: shadowUnder(3, 1, 6, 46, 0.22) },
  );
}

/** Miniatura de una foto: píxeles RGBA (como un ImageData) de PHOTO_BOARD_PIC.w x PHOTO_BOARD_PIC.h. */
export interface PhotoThumb {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

/** Dónde va cada miniatura en la cara (u desde la izquierda, v desde abajo), con un leve desorden a mano. */
function slotAt(i: number) {
  const fw = FACE.y1 - FACE.y0;
  const fh = FACE.z1 - FACE.z0;
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const gapU = (fw - FRAME * 2 - THUMB_W * COLS) / (COLS + 1);
  const rows = Math.ceil(PHOTO_BOARD_SLOTS / COLS);
  const gapV = (fh - FRAME * 2 - THUMB_H * rows) / (rows + 1);
  // Solo de lado: hacia arriba o abajo se saldría del marco.
  const jitterU = Math.round(noise(i, 3, 5) * 2 - 1);
  const u0 = Math.round(FRAME + gapU + col * (THUMB_W + gapU)) + jitterU;
  const vTop = Math.round(fh - FRAME - gapV - row * (THUMB_H + gapV));
  return { u0, v0: vTop - THUMB_H };
}

/** Color de la miniatura `i` en (u, v) de la cara, o null si ahí no hay foto. */
function thumbColor(thumbs: PhotoThumb[], u: number, v: number): RGBA | null {
  for (let i = 0; i < Math.min(thumbs.length, PHOTO_BOARD_SLOTS); i++) {
    const { u0, v0 } = slotAt(i);
    const tu = Math.floor(u - u0);
    const tv = Math.floor(v - v0);
    if (tu < 0 || tu >= THUMB_W || tv < 0 || tv >= THUMB_H + 1) continue;
    // La chinche: arriba al medio, un poco por encima del borde.
    const mid = Math.floor(THUMB_W / 2);
    if (tv === THUMB_H) return tu === mid || tu === mid - 1 ? at(PIN_COLORS[i % PIN_COLORS.length]!, tu === mid - 1 ? 4 : 2) : null;
    if (tv === THUMB_H - 1 && (tu === mid || tu === mid - 1)) return at(PIN_COLORS[i % PIN_COLORS.length]!, 3);
    const px = tu - BORDER.side;
    const py = THUMB_H - BORDER.top - 1 - tv; // v crece hacia arriba; la imagen, hacia abajo
    const t = thumbs[i]!;
    if (px < 0 || px >= PHOTO_BOARD_PIC.w || py < 0 || py >= PHOTO_BOARD_PIC.h) return at(C.cream, tv < BORDER.bottom ? 4 : 5);
    const sx = Math.min(t.width - 1, Math.floor((px / PHOTO_BOARD_PIC.w) * t.width));
    const sy = Math.min(t.height - 1, Math.floor((py / PHOTO_BOARD_PIC.h) * t.height));
    const k = (sy * t.width + sx) * 4;
    const col: RGBA = [t.data[k] ?? 0, t.data[k + 1] ?? 0, t.data[k + 2] ?? 0, 255];
    // Un poco del tono del corcho: la foto queda dentro de la sala y no brilla como pantalla.
    return mix(col, at(C.cork, 3), 0.08);
  }
  return null;
}

/** Capa con las fotos pinchadas (las primeras `PHOTO_BOARD_SLOTS`), lista para ponerla sobre el tablón. */
export function photoBoardPhotos(thumbs: PhotoThumb[]): Sprite {
  const base = photoBoard();
  const out: Sprite = { canvas: new PixelCanvas(base.canvas.width, base.canvas.height), ox: base.ox, oy: base.oy };
  if (thumbs.length === 0) return out;
  const { canvas } = out;
  for (let py = 0; py < canvas.height; py++)
    for (let px = 0; px < canvas.width; px++) {
      if (!base.canvas.alphaAt(px, py)) continue;
      // Píxel de pantalla → punto de la cara +x (plano x = x1): la misma cuenta de toScreen al revés.
      const sx = px + 0.5 - out.ox;
      const sy = py + 0.5 - out.oy;
      const Y = FACE.x1 - sx;
      const Z = (FACE.x1 + Y) / 2 - sy;
      if (Y < FACE.y0 || Y >= FACE.y1 || Z < FACE.z0 || Z >= FACE.z1) continue;
      const col = thumbColor(thumbs, FACE.y1 - Y, Z - FACE.z0); // u desde la izquierda en pantalla
      if (col) canvas.set(px, py, col);
    }
  return out;
}
