// El Megabús por dentro (nivel `megabus`): piso de caucho antideslizante, los paneles claros con la franja
// verde lima y el pasamanos amarillo, los pliegues grises del fuelle, las ventanas oscuras de piso a techo
// con la pantalla de ruta y los muebles de adentro (asientos, barras con timbre, el plato del fuelle y la
// cabina del conductor). Unidades de arte (tile = 16); en las paredes `u` corre a lo largo y `hv` es la altura.
import type { WallFeature, WallpaperKind } from "../world/types";
import { BLACK, GREY, HANDRAIL, LED, LIME, TINT } from "./bus-colores";
import { textMask } from "./digits";
import { shadowUnder, type Variant } from "./kit";
import { C, OUT, mix } from "./palette";
import { alpha, at, bayer, flat, noise, renderSprite, solidBox, type Box, type RGBA, type Sprite } from "./pixel";
import { Escena } from "./exterior-escena";

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
    // Pliegues del acordeón: nervios verticales claros y hondos, con los aros de caucho arriba y abajo.
    if (hv < 3 || hv > 52) return at(BLACK, hv < 1 || hv > 54 ? 1 : 3);
    const k = ((u % 4) + 4) % 4;
    const c = at(GREY, k < 1 ? 1 : k < 2 ? 2 : k < 3 ? 4 : 3);
    return hv > 24 && hv < 27 ? mix(c, at(GREY, 0), 0.4) : c;
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

/**
 * Asiento de pasajero mirando hacia +x: base de caucho, concha de plástico (verde lima o el azul de los
 * preferenciales), cojín oscuro y el agarradero amarillo arriba del respaldo.
 */
function busSeat(variant: Variant, blue: boolean): Sprite {
  const back = variant === "back";
  const shell = blue ? C.blue : LIME;
  const pad = blue ? C.fabric : BLACK;
  const bx = back ? 12 : 2;
  const boxes: Box[] = [
    // Pedestal.
    solidBox({ x: 6, y: 6, z: 0, w: 4, d: 4, h: 7 }, GREY, 2),
    { x: 2, y: 2, z: 7, w: 12, d: 12, h: 2, top: flat(at(shell, 3)), left: flat(at(shell, 1)), right: flat(at(shell, 2)) },
    { x: back ? 3 : 4, y: 3, z: 9, w: 9, d: 10, h: 1.5, top: flat(at(pad, 3)), left: flat(at(pad, 1)), right: flat(at(pad, 2)) },
  ];
  const rest: Box[] = [
    { x: bx, y: 2, z: 9, w: 2, d: 12, h: 14, top: flat(at(shell, 4)), left: flat(at(shell, 2)), right: (_u, v) => at(shell, v > 11 ? 3 : 2) },
    // Agarradero amarillo sobre el respaldo.
    solidBox({ x: bx, y: 3, z: 23, w: 2, d: 1, h: 3 }, HANDRAIL, 2),
    solidBox({ x: bx, y: 12, z: 23, w: 2, d: 1, h: 3 }, HANDRAIL, 2),
    { x: bx, y: 3, z: 25, w: 2, d: 10, h: 1.5, top: flat(at(HANDRAIL, 4)), left: flat(at(HANDRAIL, 2)), right: flat(at(HANDRAIL, 3)) },
  ];
  return renderSprite(back ? [...boxes, ...rest] : [...rest, ...boxes], { outline: OUT, under: shadowUnder(2, 2, 12, 12) });
}

/** Barra vertical amarilla de piso a techo, con el timbre rojo y su letrero de "PARE". */
function busPole(): Sprite {
  return renderSprite(
    [
      solidBox({ x: 6, y: 6, z: 0, w: 4, d: 4, h: 1 }, GREY, 3),
      solidBox({ x: 7, y: 7, z: 0, w: 2, d: 2, h: 52 }, HANDRAIL, 2),
      // Timbre: cajita roja con el botón.
      solidBox({ x: 9, y: 6.5, z: 24, w: 2, d: 3, h: 4 }, C.rug, 3),
      solidBox({ x: 11, y: 7.5, z: 25.5, w: 0.8, d: 1, h: 1 }, C.cream, 4),
    ],
    { outline: OUT, under: shadowUnder(6, 6, 4, 4) },
  );
}

/** El plato giratorio del fuelle: un disco gris con estrías y el aro de caucho, a ras del piso. */
function busTurntable(): Sprite {
  const s = new Escena({ x0: -2, y0: -2, z0: -1, x1: 34, y1: 82, z1: 2 }, 2);
  s.borde = false;
  s.quad([0, 0, 0.2], [1, 0, 0], [0, 1, 0], 32, 80, (u, v) => {
    const d = Math.hypot(u - 16, (v - 40) * 0.42);
    if (d < 14) return at(GREY, (Math.floor(u / 2) + Math.floor(v / 2)) % 2 ? 2 : 3);
    if (d < 15.5) return at(BLACK, 2);
    return u < 1 || u > 31 ? at(BLACK, 1) : null;
  });
  return s.sprite();
}

/**
 * La cabina del conductor (2x5, al frente): el tablero con el volante, la silla del conductor, el
 * torniquete de la puerta de adelante y la mampara baja. Todo bajo, para no tapar el pasillo.
 */
function busCabin(): Sprite {
  const s = new Escena({ x0: -2, y0: -2, z0: -1, x1: 34, y1: 82, z1: 34 }, 3);
  // Mampara baja de vidrio con marco lima (del lado del pasillo).
  s.box(0, 0, 0, 2, 80, 18, () => at(LIME, 4), () => at(LIME, 2), (u, v) => (v < 3 ? at(LIME, 3) : u % 16 < 1.5 ? at(LIME, 3) : alpha(at(TINT, 4), 0.55)));
  // Tablero: caja negra con los relojes verdes y el volante.
  s.box(20, 4, 0, 12, 40, 16, () => at(BLACK, 3), () => at(BLACK, 1), (u, v) => {
    if (v > 11 && v < 14 && u > 6 && u < 34) return (Math.floor(u) % 5) < 2 ? at(LIME, 5) : at(BLACK, 0);
    return at(BLACK, 2);
  });
  for (let a = 0; a < Math.PI * 2; a += 0.06) s.plot(18 + Math.cos(a) * 0.8, 24 + Math.cos(a) * 5, 20 + Math.sin(a) * 5, at(BLACK, 0));
  s.solid(19, 23, 14, 2, 2, 6, at(GREY, 3), at(GREY, 1), at(GREY, 2));
  // Silla del conductor (de espaldas a la cámara: el respaldo del lado del pasillo).
  s.solid(8, 18, 0, 3, 3, 7, at(GREY, 3), at(GREY, 1), at(GREY, 2));
  s.solid(4, 14, 7, 11, 11, 3, at(BLACK, 3), at(BLACK, 1), at(BLACK, 2));
  s.solid(3, 14, 10, 3, 11, 14, at(BLACK, 4), at(BLACK, 2), at(BLACK, 3));
  // Validador de tarjetas junto a la puerta de adelante, del lado de la plataforma (pantallita verde).
  s.solid(10, 8, 0, 6, 6, 18, at(GREY, 4), at(GREY, 2), at(GREY, 3));
  s.quad([10, 14, 12], [1, 0, 0], [0, 0, 1], 6, 4, () => at(LIME, 5));
  s.shadow(2, 2, 30, 76, 0.25);
  return s.sprite();
}

export const BUS_INSIDE_DRAW: Record<string, (v: Variant) => Sprite> = {
  "bus-seat": (v) => busSeat(v, false),
  "bus-seat-blue": (v) => busSeat(v, true),
  "bus-pole": busPole,
  "bus-turntable": busTurntable,
  "bus-cabin": busCabin,
};
