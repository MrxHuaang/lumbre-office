// El dibujo de la portada con el motor del juego. Lo usan el build (scripts/prerender.ts, que lo deja
// en imágenes), el test de la escena y, solo si faltan esas imágenes, el navegador (portada-motor.ts).
// La portada en sí no importa este archivo: el motor pesa demasiado para una página pública.
import { buildArea, catalogItem, type AreaDef } from "@hyvento/map";
import { cardSprite, composeArea, drawFish, drawFurniture, drawMenuItem, type PixelCanvas } from "@hyvento/map/art";
import type { LandingManifest } from "@/game/iso/prerender-paths";
import { ESCENA, ESCENA_PAD, JUEGOS, L, OFICINA, SALA_PAD, type Objeto } from "./escena";

export const SALAS: Record<string, AreaDef> = { oficina: OFICINA, juegos: JUEGOS };

/** La escena viva: de noche, con las ventanas encendidas; de día, igual pero con sol. */
export const dibujarEscena = (noche: boolean): PixelCanvas => composeArea(buildArea(ESCENA), !noche, ESCENA_PAD);

export const dibujarSala = (sala: string, noche: boolean): PixelCanvas => composeArea(buildArea(SALAS[sala]!), !noche, SALA_PAD);

export const DIBUJO_DE_OBJETO: Record<Objeto, () => PixelCanvas> = {
  Tinto: () => drawMenuItem("tinto"),
  Pandebono: () => drawMenuItem("pandebono"),
  "Tres leches": () => drawMenuItem("torta"),
  As: () => cardSprite(0, 3),
  Arawana: () => drawFish("arawana", "raro"),
  Arcade: () => drawFurniture("arcade-cabinet").canvas,
};

export type Luz = LandingManifest["luces"][number];

/**
 * Las luces de la escena (faroles, fogata, farol del porche), sacadas del catálogo: en tiles y alto.
 * Un mueble que ya no exista se salta (el test de la escena avisa).
 */
export function lucesDeEscena(): Luz[] {
  return ESCENA.furniture.flatMap((f) => {
    let luz: ReturnType<typeof catalogItem>["light"];
    try {
      luz = catalogItem(f.type).light;
    } catch {
      return [];
    }
    return luz ? [{ x: f.x + luz.at[0] / L, y: f.y + luz.at[1] / L, z: luz.at[2], color: luz.color, radio: luz.radius, fuego: f.type === "fire-pit" }] : [];
  });
}

/** Recorte de un lienzo a lo dibujado (sin el relleno vacío), con un margen: igual en Node y el navegador. */
export function recorte(px: PixelCanvas, margen = 2): { x0: number; y0: number; w: number; h: number } {
  let minX = px.width;
  let minY = px.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < px.height; y++)
    for (let x = 0; x < px.width; x++)
      if (px.data[(y * px.width + x) * 4 + 3]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  if (maxX < 0) return { x0: 0, y0: 0, w: px.width, h: px.height };
  const x0 = Math.max(0, minX - margen);
  const y0 = Math.max(0, minY - margen);
  return { x0, y0, w: Math.min(px.width, maxX + margen + 1) - x0, h: Math.min(px.height, maxY + margen + 1) - y0 };
}
