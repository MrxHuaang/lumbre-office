import { drawCharacter, drawSitting, FRAME, styleFor, type CharacterStyle } from "@hyvento/map/art";
import { Look } from "@hyvento/shared";
import type * as Phaser from "phaser";
import { toHtmlCanvas } from "./iso/canvas";
import { characterKey } from "./lookKey";

export { characterKey, lookId } from "./lookKey";

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

/** Registra un canvas como textura con frames de 32x32 numerados como un spritesheet. */
function addSheet(scene: Phaser.Scene, key: string, px: Pixels) {
  const texture = scene.textures.addCanvas(key, toHtmlCanvas(px));
  if (!texture) return;
  const cols = px.width / FRAME;
  const rows = px.height / FRAME;
  for (let i = 0; i < cols * rows; i++) texture.add(i, 0, (i % cols) * FRAME, Math.floor(i / cols) * FRAME, FRAME, FRAME);
}

/**
 * Texturas de un personaje: `<clave>` (caminata) y `<clave>-sit` (sentado). Se dibujan una sola vez y
 * se reutilizan entre quienes se vean igual.
 */
export function ensureCharacterTextures(scene: Phaser.Scene, avatar: string, look: Look | null): string {
  const key = characterKey(avatar, look);
  const style: CharacterStyle = styleFor(avatar, look);
  if (!scene.textures.exists(key)) addSheet(scene, key, drawCharacter(style));
  if (!scene.textures.exists(`${key}-sit`)) addSheet(scene, `${key}-sit`, drawSitting(style));
  return key;
}

const urlCache = new Map<string, string>();

/** Hoja de caminata de un personaje como data URL, para las vistas previas en React. */
export function characterSheetUrl(avatar: string, look: Look | null): string {
  const key = characterKey(avatar, look);
  let url = urlCache.get(key);
  if (!url) {
    url = toHtmlCanvas(drawCharacter(styleFor(avatar, look))).toDataURL();
    urlCache.set(key, url);
  }
  return url;
}
