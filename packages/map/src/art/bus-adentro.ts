// El Megabús por dentro (nivel `megabus`): piso de caucho antideslizante, los paneles claros con la franja
// verde lima y el pasamanos amarillo, los pliegues grises del fuelle, las ventanas oscuras de piso a techo
// con la pantalla de ruta y los muebles de adentro (asientos, barras con timbre, el plato del fuelle y la
// cabina del conductor). Unidades de arte (tile = 16); en las paredes `u` corre a lo largo y `hv` es la altura.
import type { WallFeature, WallpaperKind } from "../world/types";
import { BLACK, GREY, HANDRAIL, LED, LIME, TINT } from "./bus-colores";
import { textMask } from "./digits";
import { busCabinSprite, busPoleSprite, busSeatSprite, busTurntableSprite } from "./bus-adentro-tanda3";
import type { Variant } from "./kit";
import { C, mix } from "./palette";
import { at, bayer, noise, type RGBA, type Sprite } from "./pixel";

// ---------- Piso y paredes ----------

/** Caucho antideslizante: negro verdoso con botoncitos en relieve y alguna marca de suela. */
export function rubberFloor(X: number, Y: number): RGBA {
  const u = ((X % 6) + 6) % 6;
  const v = ((Y % 6) + 6) % 6;
  const d = Math.hypot(u - 3, v - 3);
  if (d < 1.1) return at(BLACK, 4);
  if (d < 1.7 && u > 3 && v > 3) return at(BLACK, 1);
  const n = noise(Math.floor(X), Math.floor(Y), 51);
  return at(BLACK, n > 0.94 ? 3 : bayer(Math.floor(X), Math.floor(Y)) < 0.1 ? 1 : 2);
}

/** Pasamanos amarillo corrido con sus soportes (a la altura `z0`). */
function rail(u: number, hv: number, z0: number): RGBA | null {
  if (hv >= z0 && hv < z0 + 2) return at(HANDRAIL, hv < z0 + 1 ? 3 : 2);
  if (hv >= z0 + 2 && hv < z0 + 5 && ((u % 32) + 32) % 32 < 1.2) return at(GREY, 3);
  return null;
}

/** Papel de los muros del bus: paneles, la franja lima, el pasamanos y los avisos del techo; o el fuelle. */
export function busWallpaper(kind: WallpaperKind, u: number, hv: number): RGBA {
  if (kind === "fuelle") {
    // Pliegues del acordeón, cada uno de 6: el fondo hondo, la cara que mira a la luz (de la izquierda) con
    // el filo brillante y la cara en sombra; los marcos de caucho arriba y abajo con su borde claro, y la
    // faja del medio que aprieta los pliegues.
    if (hv < 3 || hv > 52) {
      if (hv < 1 || hv > 54) return at(BLACK, 1);
      return at(BLACK, hv > 52 && hv < 53 ? 4 : hv < 3 && hv >= 2 ? 4 : 2);
    }
    const k = Math.floor(((u % 6) + 6) % 6);
    let c = at(GREY, [0, 3, 4, 5, 2, 1][k]!);
    // Junto a los marcos y a la faja, los pliegues se apagan (quedan metidos).
    if (hv < 5 || hv > 50 || (hv > 22.5 && hv < 24) || (hv > 28 && hv < 29.5)) c = mix(c, at(GREY, 0), 0.45);
    if (hv >= 24 && hv <= 28) return at(BLACK, hv < 25 ? 4 : hv > 27 ? 1 : k === 0 ? 2 : 3);
    return c;
  }
  const seam = ((u % 32) + 32) % 32 < 0.8;
  if (hv < 3) return at(BLACK, 2);
  if (hv < 14) return seam ? at(C.cream, 2) : at(C.cream, 3 + (bayer(Math.floor(u), Math.floor(hv)) < 0.08 ? 1 : 0));
  if (hv < 17) return at(LIME, hv < 15 ? 3 : 4);
  const r = rail(u, hv, 43);
  if (r) return r;
  if (hv > 47) {
    // Avisos en el techo: cartelitos de colores entre los paneles.
    const slot = Math.floor(u / 48);
    const du = u - slot * 48;
    if (du > 8 && du < 40 && hv > 48 && hv < 54) {
      const col = [C.sky, C.rose, C.mustard, C.sage][Math.floor(noise(slot, 3, 52) * 4)]!;
      return du < 9 || du > 39 || hv < 49 || hv > 53 ? at(GREY, 2) : at(col, (Math.floor(du / 4) + Math.floor(hv)) % 3 === 0 ? 4 : 3);
    }
    return at(C.cream, 4);
  }
  return seam ? at(C.cream, 3) : at(C.cream, 4);
}

/**
 * Ventana del bus: vidrio polarizado casi negro de la franja lima al pasamanos, con parales cada dos tiles,
 * un reflejo en diagonal y, de día, el verde de afuera apenas asomando abajo. Con `text`, encima va la
 * pantalla de ruta (LED ámbar sobre negro).
 */
export function busWallFeature(f: WallFeature, u: number, hv: number, day: boolean): RGBA | null {
  const u1 = (f.width ?? 1) * 16;
  if (f.text && hv > 46 && hv < 55 && u > 6 && u < u1 - 6) {
    const m = textMask(f.text, 1);
    const x0 = Math.floor((u1 - m.w) / 2);
    const gx = Math.floor(u - x0);
    const gy = Math.floor(54 - hv) - 1;
    if (hv < 47 || hv > 54 || u < 7 || u > u1 - 7) return at(GREY, 1);
    if (m.on(gx, gy)) return at(LED, 3);
    return at(BLACK, (gx + gy) % 2 ? 0 : 1);
  }
  if (hv < 17 || hv >= 42 || u < 1 || u >= u1 - 1) return null;
  const k = ((u % 32) + 32) % 32;
  // Paral y marco de caucho.
  if (k < 2 || hv < 18 || hv > 40.5) return at(BLACK, k < 1 || hv > 41 ? 1 : 3);
  const x = Math.floor(u);
  const y = Math.floor(hv);
  // Reflejo diagonal (más marcado de noche, con las luces de adentro).
  if (Math.abs(((u + hv * 0.8) % 40) - 20) < (day ? 1.2 : 1.8)) return day ? at(TINT, 4) : mix(at(TINT, 3), at(C.gold, 3), 0.35);
  if (day) {
    // Afuera: copas de árboles oscuras abajo y cielo apagado arriba (el vidrio casi no deja ver).
    const tree = hv < 24 + Math.sin(u * 0.21) * 2.5 + Math.sin(u * 0.07) * 2;
    if (tree) return at(C.leaf, bayer(x, y) < 0.5 ? 0 : 1);
    return hv > 34 ? at(TINT, 3) : at(TINT, 2);
  }
  return at(TINT, bayer(x, y) < 0.15 ? 1 : 0);
}

// ---------- Muebles ----------
// Dibujados a mano en grillas (art/bus-adentro-tanda3.ts).

export const BUS_INSIDE_DRAW: Record<string, (v: Variant) => Sprite> = {
  "bus-seat": (v) => busSeatSprite(v === "back", false),
  "bus-seat-blue": (v) => busSeatSprite(v === "back", true),
  "bus-pole": busPoleSprite,
  "bus-turntable": busTurntableSprite,
  "bus-cabin": busCabinSprite,
};
