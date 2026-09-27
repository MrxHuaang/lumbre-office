// Nombres compartidos entre el script que pre-dibuja el arte en el build (scripts/prerender.ts) y el
// juego que lo carga (prerender.ts): si no coinciden, el juego no encuentra la imagen y la dibuja.
import { CATALOG, catalogItem, type OfficeMap } from "@hyvento/map";

export { GAME_MANIFEST, PRERENDER_DIR } from "./prerender-paths";

export type FurnitureVariant = "front" | "back";

/** Clave de textura (o de cuadro del atlas) de un mueble: la noche solo cuenta si tiene versión nocturna. */
export function furnitureKey(type: string, variant: FurnitureVariant, night: boolean) {
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
}
