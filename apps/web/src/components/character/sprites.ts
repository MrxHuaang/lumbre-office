// Dibujos del editor de personaje, cacheados por look. Al arrastrar un selector de color cambian
// decenas de miniaturas por segundo: los cachÃ©s tienen tope para no crecer sin fin, cada look se
// dibuja una sola vez mientras siga en uso y al cerrar el editor se vacÃ­an (la cabaÃ±a sigue corriendo).
import {
  characterShadow,
  drawCharacter,
  drawFurniture,
  drawSitting,
  BODY_X,
  BODY_Y,
  FRAME,
  SHEET_DIRECTIONS,
  type PixelCanvas,
  type SheetDirection,
} from "@hyvento/map/art";
import { normalizeLook, type LookInput } from "@hyvento/shared";
import { toHtmlCanvas } from "@/game/iso/canvas";

/** CachÃ© con tope: al pasarse, se borra lo que hace mÃ¡s tiempo que no se usa. */
function lru<T>(limit: number) {
  const map = new Map<string, T>();
  const get = (key: string, make: () => T): T => {
    const hit = map.get(key);
    if (hit !== undefined) {
      map.delete(key);
      map.set(key, hit);
      return hit;
    }
    const value = make();
    map.set(key, value);
    if (map.size > limit) map.delete(map.keys().next().value!);
    return value;
  };
  return Object.assign(get, { clear: () => map.clear() });
}

/**
 * Recortes del frame (el cuerpo mide 16 de ancho desde BODY_X y su fila r cae en BODY_Y + r de la celda) y
 * su escala entera en la miniatura: asÃ­ cada pÃ­xel del chibi mide lo mismo y no se ve borroso. `hat` deja
 * lugar arriba para lo alto (la chistera, el gorro de chef) y `full` es el personaje entero, sombreros
 * incluidos (los trajes).
 */
const crop = (x: number, row: number, w: number, h: number, scale: number) => ({ x: BODY_X + x, y: BODY_Y + row, w, h, scale });
export const CROPS = {
  head: crop(-1, -3, 18, 18, 3),
  hat: crop(-1, -6, 18, 20, 3),
  torso: crop(-2, 1, 20, 20, 3),
  body: crop(-3, -3, 22, 30, 2),
  full: crop(-3, -7, 22, 36, 2),
  legs: crop(-2, 16, 20, 13, 3),
} as const;
export type Crop = keyof typeof CROPS;

// Las miniaturas guardan solo su recorte (1â€“3 KB cada uno; una pestaÃ±a tiene unas 30). Las hojas completas
// (~48 KB) quedan pocas: las del look actual y las que se piden varias veces seguidas con otro recorte.
const thumbs = lru<ImageData>(400);
const sheets = lru<PixelCanvas>(16);
// Los <canvas> de la vista previa (uno por look a la vez).
const canvases = lru<HTMLCanvasElement>(24);

/** Clave estable de un look: el look completo (mismo dibujo â†’ misma clave, venga viejo o nuevo). */
export function lookKey(look: LookInput): string {
  return JSON.stringify(normalizeLook(look));
}

/** Hoja de caminata en pÃ­xeles: 3 columnas (quieto, paso A, paso B) x 4 filas (SHEET_DIRECTIONS). */
function walkPixels(look: LookInput, key: string): PixelCanvas {
  return sheets(key, () => drawCharacter(look));
}

/** Miniatura: el frame quieto de una direcciÃ³n, recortado a la parte que interesa. */
export function thumbImage(look: LookInput, key: string, dir: SheetDirection, crop: Crop): ImageData {
  return thumbs(`${key}|${dir}|${crop}`, () => {
    const r = CROPS[crop];
    const px = walkPixels(look, key);
    const img = new ImageData(r.w, r.h);
    const top = dirIndex(dir) * FRAME + r.y;
    for (let y = 0; y < r.h; y++) {
      const from = ((top + y) * px.width + r.x) * 4;
      img.data.set(px.data.subarray(from, from + r.w * 4), y * r.w * 4);
    }
    return img;
  });
}

/** La hoja de caminata como <canvas>, para la vista previa. */
export function walkSheet(look: LookInput, key = lookKey(look)): HTMLCanvasElement {
  return canvases(`walk:${key}`, () => toHtmlCanvas(walkPixels(look, key)));
}

/** Hoja de sentado: 4 frames en fila (SHEET_DIRECTIONS). */
export function sitSheet(look: LookInput, key = lookKey(look)): HTMLCanvasElement {
  return canvases(`sit:${key}`, () => toHtmlCanvas(drawSitting(look)));
}

/** Suelta los dibujos cacheados (al cerrar el editor). */
export function clearEditorSprites() {
  thumbs.clear();
  sheets.clear();
  canvases.clear();
}

export const dirIndex = (dir: SheetDirection) => SHEET_DIRECTIONS.indexOf(dir);

let stool: { canvas: HTMLCanvasElement; ox: number; oy: number } | null = null;
/** El taburete de la cabaÃ±a, para la vista previa "sentado". */
export function stoolSprite() {
  if (!stool) {
    const s = drawFurniture("stool");
    stool = { canvas: toHtmlCanvas(s.canvas), ox: s.ox, oy: s.oy };
  }
  return stool;
}

let shadow: HTMLCanvasElement | null = null;
/** La sombra que llevan los personajes bajo los pies. */
export function shadowSprite(): HTMLCanvasElement {
  shadow ??= toHtmlCanvas(characterShadow());
  return shadow;
}
