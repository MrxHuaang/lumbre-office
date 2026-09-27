// Piezas comunes del modo mesa: pasar los dibujos de alta resolución (casino-mesa.ts) a imágenes de
// Phaser puestas en el mundo con escala 1/R, y la profundidad de una mesa.
import type { OfficeMap, PlacedFurniture } from "@hyvento/map";
import type { Overlay, PixelCanvas } from "@hyvento/map/art";
import type * as Phaser from "phaser";
import { depthOf, ensureTexture } from "../iso/view";

/** Profundidad del mueble (la misma que le da el nivel): lo de la mesa va apenas encima. */
export function furnitureDepth(map: OfficeMap, f: PlacedFurniture): number {
  const ts = map.tileSize;
  return depthOf((f.x + f.w / 2) * ts, (f.y + f.d / 2) * ts);
}

/** Imagen de un dibujo del modo mesa (un paño, una marca) en su lugar del mundo. */
export function overlayImage(scene: Phaser.Scene, key: string, ov: Overlay, depth: number): Phaser.GameObjects.Image {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  ensureTexture(scene, key, () => ov.canvas);
  return scene.add.image(ov.sx, ov.sy, key).setOrigin(0, 0).setScale(1 / ov.R).setDepth(depth);
}

/**
 * Imagen de un dibujo suelto (ficha, carta, placa) con el punto (ax, ay) del lienzo en (x, y) de
 * pantalla. La textura se guarda por clave: las fichas y cartas se repiten mucho.
 */
export function pieceImage(
  scene: Phaser.Scene,
  key: string,
  make: () => PixelCanvas,
  x: number,
  y: number,
  R: number,
  depth: number,
  anchor: { ax: number; ay: number } | null = null,
): Phaser.GameObjects.Image {
  ensureTexture(scene, key, make);
  const img = scene.add.image(x, y, key).setScale(1 / R).setDepth(depth);
  if (anchor) img.setOrigin(anchor.ax / img.width, anchor.ay / img.height);
  return img;
}
