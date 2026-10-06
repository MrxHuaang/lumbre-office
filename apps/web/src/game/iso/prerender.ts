// El arte pre-dibujado en el build (scripts/prerender.ts): fondos de los niveles, el atlas de muebles y
// el bosque de alrededor. Se baja con el cargador de Phaser antes de crear la escena (el navegador
// decodifica los PNG fuera del hilo principal). Si algo falta, quien lo pide lo dibuja como antes.
import type { OfficeMap } from "@hyvento/map";
import { drawAreaPatch } from "@hyvento/map/art";
import type * as Phaser from "phaser";
import { toHtmlCanvas } from "./canvas";
import { areaDecorSignature, changedDecorRooms, GAME_MANIFEST, PRERENDER_DIR, type GameManifest } from "./prerender-keys";

const MANIFEST_KEY = "prerender-manifiesto";
let manifest: GameManifest | null = null;

const url = (m: GameManifest, file: string) => `${PRERENDER_DIR}/${file}?v=${m.version}`;
/** Clave por archivo: si el día y la noche son la misma imagen (el jardín), se baja y se guarda una vez. */
const fileTexture = (file: string) => `pre-${file}`;
const atlasTexture = (i: number) => `pre-muebles-${i}`;
const surroundTexture = (kind: string) => `pre-alrededores-${kind}`;

/**
 * Pide el manifiesto y, cuando llega, todas sus imágenes (son ~1,5 MB): se llama en `preload()`. Si no
 * hay manifiesto (desarrollo sin generar) la escena arranca igual y dibuja todo en el navegador.
 */
export function queuePrerender(scene: Phaser.Scene) {
  scene.load.json(MANIFEST_KEY, `${PRERENDER_DIR}/${GAME_MANIFEST}`);
  scene.load.once(`filecomplete-json-${MANIFEST_KEY}`, (_key: string, _type: string, data: GameManifest) => {
    manifest = data;
    const files = new Set(Object.values(data.areas).flatMap((a) => [a.dia, a.noche]));
    for (const file of files) scene.load.image(fileTexture(file), url(data, file));
    data.atlases.forEach((file, i) => scene.load.image(atlasTexture(i), url(data, file)));
    for (const [kind, file] of Object.entries(data.surroundings)) scene.load.image(surroundTexture(kind), url(data, file));
  });
  const onError = (file: Phaser.Loader.File) => {
    // Sin esa imagen se dibuja en el navegador; en desarrollo avisa cómo generarlas.
    if (process.env.NODE_ENV !== "production") console.info(`Falta el arte pre-dibujado (${file.key}): corre \`pnpm --filter @hyvento/web prerender\`.`);
  };
  scene.load.on("loaderror", onError);
  scene.load.once("complete", () => scene.load.off("loaderror", onError));
}

/** Fondo pre-dibujado de un nivel, si coincide con su decoración (una oficina con otro piso no). */
export function prerenderedBase(scene: Phaser.Scene, map: OfficeMap, night: boolean): { key: string; ox: number; oy: number } | null {
  const a = manifest?.areas[map.id];
  const key = a && fileTexture(night ? a.noche : a.dia);
  if (!a || !key || !scene.textures.exists(key) || a.decor !== areaDecorSignature(map)) return null;
  return { key, ox: a.ox, oy: a.oy };
}

/**
 * Fondo de un nivel con oficinas decoradas (otro piso o papel): el del build y encima solo esas salas
 * (drawAreaPatch), en un lienzo nuevo. Mucho más rápido que dibujar el nivel entero. Null si no hay fondo
 * del build para ese nivel o no se puede comparar.
 */
export function patchedPrerenderedBase(scene: Phaser.Scene, map: OfficeMap, night: boolean): { canvas: HTMLCanvasElement; ox: number; oy: number } | null {
  const a = manifest?.areas[map.id];
  const key = a && fileTexture(night ? a.noche : a.dia);
  if (!a || !key || !scene.textures.exists(key)) return null;
  const rooms = changedDecorRooms(a.decor, map);
  if (!rooms) return null;
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const canvas = document.createElement("canvas");
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(src, 0, 0);
  const patch = drawAreaPatch(map, !night, rooms);
  // El parche va en su propio origen: se corre para que caiga donde el del build tiene el suyo.
  if (patch) ctx.drawImage(toHtmlCanvas(patch.canvas), a.ox - patch.ox, a.oy - patch.oy);
  return { canvas, ox: a.ox, oy: a.oy };
}

/** Cuadro de un mueble en el atlas (el nombre del cuadro es la clave del mueble) con su tamaño y origen. */
export function prerenderedFurniture(scene: Phaser.Scene, key: string): { texture: string; frame: string; w: number; h: number; ox: number; oy: number } | null {
  const f = manifest?.frames[key];
  if (!f) return null;
  const [i, x, y, w, h, ox, oy] = f;
  const texture = atlasTexture(i);
  if (!scene.textures.exists(texture)) return null;
  const tex = scene.textures.get(texture);
  if (!tex.has(key)) tex.add(key, 0, x, y, w, h);
  return { texture, frame: key, w, h, ox, oy };
}

/** Lo que el build dejó de una carroza del Carnaval (sus partes van en el atlas), o null. */
export const prerenderedCarroza = (id: string) => manifest?.carrozas?.[id] ?? null;

/** Baldosa pre-dibujada del bosque de alrededor. */
export function prerenderedSurroundings(scene: Phaser.Scene, kind: string): string | null {
  const key = surroundTexture(kind);
  return manifest?.surroundings[kind] && scene.textures.exists(key) ? key : null;
}
