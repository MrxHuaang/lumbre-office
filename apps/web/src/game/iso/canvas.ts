// Píxeles del motor → canvas del navegador. Sin Phaser: lo usan también las vistas previas de React
// (que se renderizan en el servidor, donde Phaser no puede cargarse).
import type { PixelCanvas } from "@hyvento/map/art";
import type * as Phaser from "phaser";

export function toHtmlCanvas(px: PixelCanvas): HTMLCanvasElement {
  const el = document.createElement("canvas");
  el.width = px.width;
  el.height = px.height;
  el.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(px.data), px.width, px.height), 0, 0);
  return el;
}

/** Registra (una vez) un canvas de píxeles como textura. */
export function ensureTexture(scene: Phaser.Scene, key: string, make: () => PixelCanvas) {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, toHtmlCanvas(make()));
  return key;
}
