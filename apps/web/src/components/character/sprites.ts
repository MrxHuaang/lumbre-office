// Dibujos del editor de personaje, cacheados por look. Al arrastrar un selector de color cambian
// decenas de miniaturas por segundo: los cachés tienen tope para no crecer sin fin y cada look se
// dibuja una sola vez mientras siga en uso.
import {
  characterShadow,
  drawCharacter,
  drawFurniture,
  drawSitting,
  SHEET_DIRECTIONS,
  type PixelCanvas,
  type SheetDirection,
} from "@hyvento/map/art";
import { normalizeLook, type LookInput } from "@hyvento/shared";
import { toHtmlCanvas } from "@/game/iso/canvas";

/** Caché con tope: al pasarse, se borra lo que hace más tiempo que no se usa. */
function lru<T>(limit: number) {
  const map = new Map<string, T>();
  return (key: string, make: () => T): T => {
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
}

// Los píxeles de las miniaturas (baratos) y los <canvas> de la vista previa (uno por look a la vez).
const pixels = lru<PixelCanvas>(400);
const canvases = lru<HTMLCanvasElement>(24);

/** Clave estable de un look: el look completo (mismo dibujo → misma clave, venga viejo o nuevo). */
export function lookKey(look: LookInput): string {
  return JSON.stringify(normalizeLook(look));
}

/** Hoja de caminata en píxeles: 3 columnas (quieto, paso A, paso B) x 4 filas (SHEET_DIRECTIONS). */
export function walkPixels(look: LookInput, key = lookKey(look)): PixelCanvas {
  return pixels(`walk:${key}`, () => drawCharacter(look));
}

/** La hoja de caminata como <canvas>, para la vista previa. */
export function walkSheet(look: LookInput, key = lookKey(look)): HTMLCanvasElement {
  return canvases(`walk:${key}`, () => toHtmlCanvas(walkPixels(look, key)));
}

/** Hoja de sentado: 4 frames en fila (SHEET_DIRECTIONS). */
export function sitSheet(look: LookInput, key = lookKey(look)): HTMLCanvasElement {
  return canvases(`sit:${key}`, () => toHtmlCanvas(drawSitting(look)));
}

export const dirIndex = (dir: SheetDirection) => SHEET_DIRECTIONS.indexOf(dir);

let stool: { canvas: HTMLCanvasElement; ox: number; oy: number } | null = null;
/** El taburete de la cabaña, para la vista previa "sentado". */
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
