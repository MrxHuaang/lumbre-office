// Gestos cortos del personaje al hacer un emote (saltito, balanceo, temblor, asentir, saludar). No se
// rehacen las hojas del chibi: el sprite se corre unos píxeles y el saludo suma un brazo como capa.
import { BODY_UP, BODY_X, BODY_Y, drawEmote, emoteFrames, wavingArm, type RGBA } from "@hyvento/map/art";
import type { Direction, EmoteGesture } from "@hyvento/shared";
import type * as Phaser from "phaser";
import { ensureTexture } from "./iso/view";

/** Cuánto se corre el sprite en el instante `t` (ms desde que empezó): `lift` = hacia arriba. */
export function gestureOffset(kind: EmoteGesture, t: number): { x: number; lift: number } {
  switch (kind) {
    case "hop":
      return { x: 0, lift: t % 300 < 150 ? 2 : 0 };
    case "jump":
      return { x: 0, lift: t < 120 ? 2 : t < 320 ? 4 : t < 440 ? 2 : 0 };
    case "sway":
      return { x: [0, 1, 0, -1][Math.floor(t / 200) % 4]!, lift: 0 };
    case "shake":
      return { x: t > 900 ? 0 : Math.floor(t / 60) % 2 ? 1 : -1, lift: 0 };
    case "nod":
      return { x: 0, lift: Math.floor(t / 180) % 2 ? 0 : -1 };
    default:
      return { x: 0, lift: 0 };
  }
}

/** Texturas de los frames de un emote (`emote-<id>-<n>`); devuelve cuántos son y cuánto dura cada uno. */
export function ensureEmoteTextures(scene: Phaser.Scene, id: string) {
  const { count, ms } = emoteFrames(id);
  for (let f = 0; f < count; f++) ensureTexture(scene, `emote-${id}-${f}`, () => drawEmote(id, f));
  return { count, ms };
}

/**
 * Del lado de qué mano se levanta el brazo y a qué columna (desde el centro del sprite) va el hombro.
 * Los brazos del chibi quedan a -5 y +4 del centro en todas las vistas: el que saluda va justo afuera.
 */
export const WAVE_SIDE: Record<Direction, { side: -1 | 1; dx: number }> = {
  down: { side: -1, dx: -6 },
  left: { side: -1, dx: -6 },
  right: { side: 1, dx: 5 },
  up: { side: 1, dx: 5 },
};

/** Hombro respecto de los pies (px), de pie; sentado, SIT_DROP menos. */
export const SHOULDER_UP = BODY_UP.shoulder;

const FALLBACK_SLEEVE: RGBA = [231, 111, 81, 255];
const FALLBACK_SKIN: RGBA = [241, 194, 125, 255];

/**
 * Colores de la manga y de la mano, leídos de la hoja del personaje (frame quieto mirando a la derecha:
 * el brazo de adelante es la columna 12 del cuerpo, con la manga en la fila 15 y la mano en la 20).
 */
function armColors(scene: Phaser.Scene, sheetKey: string): { sleeve: RGBA; skin: RGBA } {
  const read = (x: number, y: number, fallback: RGBA): RGBA => {
    const c = scene.textures.getPixel(x, y, sheetKey, 6);
    return c && c.alpha > 0 ? [c.red, c.green, c.blue, 255] : fallback;
  };
  return { sleeve: read(BODY_X + 12, BODY_Y + 15, FALLBACK_SLEEVE), skin: read(BODY_X + 12, BODY_Y + 20, FALLBACK_SKIN) };
}

/** Textura del brazo que saluda para un personaje (por colores, lado y frame) y dónde queda su hombro. */
export function armTexture(scene: Phaser.Scene, sheetKey: string, side: -1 | 1, frame: number) {
  const { sleeve, skin } = armColors(scene, sheetKey);
  const key = `brazo-${sleeve.slice(0, 3).join(".")}-${skin.slice(0, 3).join(".")}-${side}-${frame % 2}`;
  const art = wavingArm(sleeve, skin, frame, side);
  ensureTexture(scene, key, () => art.canvas);
  return { key, shoulder: art.shoulder };
}
