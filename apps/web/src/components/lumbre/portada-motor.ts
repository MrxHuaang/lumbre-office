// Respaldo de la portada cuando faltan las imágenes del build (desarrollo sin generar): dibuja en el
// navegador con el motor. Se importa solo con import() desde dibujo.ts, así queda en un paquete aparte.
import { FEET_Y, FRAME, type PixelCanvas } from "@hyvento/map/art";
import type { Look } from "@hyvento/shared";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { characterSheetUrl } from "@/game/looks";
import type { Dibujo } from "./dibujo";
import { DIBUJO_DE_OBJETO, dibujarEscena, dibujarSala, lucesDeEscena, recorte } from "./escena-arte";
import type { Objeto } from "./escena";

function recortar(px: PixelCanvas, margen = 2): Dibujo {
  const r = recorte(px, margen);
  const out = document.createElement("canvas");
  out.width = r.w;
  out.height = r.h;
  out.getContext("2d")!.drawImage(toHtmlCanvas(px), r.x0, r.y0, r.w, r.h, 0, 0, r.w, r.h);
  return { src: out.toDataURL(), ...r };
}

export const escenaEnVivo = (noche: boolean) => ({ dibujo: recortar(dibujarEscena(noche)), luces: lucesDeEscena(), frame: FRAME, feetY: FEET_Y });
export const salaEnVivo = (sala: string, noche: boolean) => recortar(dibujarSala(sala, noche));
export const objetoEnVivo = (nombre: string) => recortar(DIBUJO_DE_OBJETO[nombre as Objeto](), 1);
export const hojaEnVivo = (avatar: string, look: Look | null) => characterSheetUrl(avatar, look);
