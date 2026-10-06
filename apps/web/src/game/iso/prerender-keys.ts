// Nombres compartidos entre el script que pre-dibuja el arte en el build (scripts/prerender.ts) y el
// juego que lo carga (prerender.ts): si no coinciden, el juego no encuentra la imagen y la dibuja.
import { CATALOG, catalogItem, type OfficeMap } from "@hyvento/map";
import type { ParteMovil } from "@hyvento/map/art";
import { PAINTING_BASE_TYPE, paintingIdOf } from "@hyvento/shared";

export { GAME_MANIFEST, PRERENDER_DIR } from "./prerender-paths";

export type FurnitureVariant = "front" | "back";

/** Clave de textura (o de cuadro del atlas) de un mueble: la noche solo cuenta si tiene versión nocturna. */
export function furnitureKey(type: string, variant: FurnitureVariant, night: boolean) {
  // Todos los cuadros de la Pintura comparten el marco (los píxeles van en otra capa, ver game/paintings.ts).
  if (paintingIdOf(type)) type = PAINTING_BASE_TYPE;
  return catalogItem(type).hasNight ? `mueble-${type}-${variant}-${night ? "noche" : "dia"}` : `mueble-${type}-${variant}`;
}

/** Todas las versiones que el juego puede pedir de cada mueble del catálogo. */
export function allFurnitureVariants(): { type: string; variant: FurnitureVariant; night: boolean }[] {
  const out: { type: string; variant: FurnitureVariant; night: boolean }[] = [];
  for (const type of Object.keys(CATALOG)) {
    const item = catalogItem(type);
    for (const variant of item.hasBack ? (["front", "back"] as const) : (["front"] as const))
      for (const night of item.hasNight ? [false, true] : [false]) out.push({ type, variant, night });
  }
  return out;
}

/**
 * Pisos y papeles de cada habitación: lo único del fondo que cambia en el juego (la decoración de las
 * oficinas). Si no coincide con lo pre-dibujado, el fondo se dibuja en el navegador.
 */
export function areaDecorSignature(map: OfficeMap): string {
  return JSON.stringify(map.def.rooms.map((r) => [r.floor, r.wallpaper]));
}

/**
 * Salas (índices de `def.rooms`) cuyo piso o papel no es el que tenían al pre-dibujar el nivel (`decor`
 * es la firma de entonces): las que hay que pintar encima del fondo del build. Null si las salas no se
 * pueden comparar (el nivel cambió).
 */
export function changedDecorRooms(decor: string, map: OfficeMap): Set<number> | null {
  let before: unknown;
  try {
    before = JSON.parse(decor);
  } catch {
    return null;
  }
  if (!Array.isArray(before) || before.length !== map.def.rooms.length) return null;
  const out = new Set<number>();
  map.def.rooms.forEach((r, i) => {
    const b: unknown = before[i];
    if (!Array.isArray(b) || b[0] !== r.floor || b[1] !== r.wallpaper) out.add(i);
  });
  return out;
}

/** Uno de los cuadros del atlas de muebles: [atlas, x, y, ancho, alto, origen x, origen y]. */
export type AtlasFrame = [number, number, number, number, number, number, number];

export interface GameManifest {
  /** Huella de las fuentes del arte: cambia la URL de cada imagen cuando cambia el dibujo. */
  version: string;
  /** Fondo de cada nivel (piso, losa y paredes altas), de día y de noche. */
  areas: Record<string, { decor: string; ox: number; oy: number; w: number; h: number; dia: string; noche: string }>;
  atlases: string[];
  frames: Record<string, AtlasFrame>;
  /** Baldosa del bosque de alrededor, por tipo. */
  surroundings: Record<string, string>;
  /** Las carrozas del Carnaval: cómo se mueve cada parte (el dibujo va en el atlas, con `carrozaKey`). */
  carrozas?: Record<string, CarrozaMeta>;
}

/** Una carroza sin sus dibujos: lo largo y cada parte con su pivote y su movimiento. */
export interface CarrozaMeta {
  largo: number;
  partes: (ParteMovil & { px: number; py: number; w: number; h: number })[];
}

/** Cuadro del atlas de una parte de una carroza. */
export const carrozaKey = (id: string, parte: string) => `carroza-${id}-${parte}`;
