import { drawCharacter, drawSitting, FRAME, type CharacterStyle } from "@hyvento/map/character";
import { Look } from "@hyvento/shared";
import type * as Phaser from "phaser";

type Pixels = ReturnType<typeof drawCharacter>;

/** Look guardado como JSON en el estado de la sala ("" o inválido → null). */
export function parseLook(json: string): Look | null {
  if (!json) return null;
  try {
    const parsed = Look.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Identificador estable de un look (mismo look → misma textura, aunque cambie el orden). */
export function lookId(look: Look): string {
  const canonical = JSON.stringify({ ...look, accessories: [...look.accessories].sort() });
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) h = Math.imul(h ^ canonical.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

function toHtmlCanvas(px: Pixels): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = px.width;
  canvas.height = px.height;
  canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(px.data), px.width, px.height), 0, 0);
  return canvas;
}

/** Registra un canvas como textura con frames de 32x32 numerados como un spritesheet. */
function addSheet(scene: Phaser.Scene, key: string, px: Pixels) {
  const texture = scene.textures.addCanvas(key, toHtmlCanvas(px));
  if (!texture) return;
  const cols = px.width / FRAME;
  const rows = px.height / FRAME;
  for (let i = 0; i < cols * rows; i++) texture.add(i, 0, (i % cols) * FRAME, Math.floor(i / cols) * FRAME, FRAME, FRAME);
}

/**
 * Texturas de un personaje personalizado: `<clave>` (caminata) y `<clave>-sit` (sentado).
 * Se dibujan una sola vez por look y se reutilizan entre quienes se vean igual.
 */
export function ensureLookTextures(scene: Phaser.Scene, look: Look): string {
  const key = `look-${lookId(look)}`;
  if (!scene.textures.exists(key)) addSheet(scene, key, drawCharacter(look as CharacterStyle));
  if (!scene.textures.exists(`${key}-sit`)) addSheet(scene, `${key}-sit`, drawSitting(look as CharacterStyle));
  return key;
}

const urlCache = new Map<string, string>();

/** Hoja de caminata de un look como data URL, para las vistas previas en React. */
export function lookSheetUrl(look: Look): string {
  const id = lookId(look);
  let url = urlCache.get(id);
  if (!url) {
    url = toHtmlCanvas(drawCharacter(look as CharacterStyle)).toDataURL();
    urlCache.set(id, url);
  }
  return url;
}
