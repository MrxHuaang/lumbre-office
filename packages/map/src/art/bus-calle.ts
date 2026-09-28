// La calle de la parada del bus (piso "road" del jardín, ver world/areas/parada.ts): el cordón de la
// plataforma visto como escalón (la calzada va más abajo), el carril exclusivo pintado de rojo teja con
// "SOLO BUS", la doble línea amarilla, el carril mixto de asfalto tibio con su línea de borde y el cordón
// de enfrente. Nada de gris industrial: el asfalto tira a café oscuro y la pintura está apenas gastada.
import { ROAD } from "../world/areas/parada";
import { textMask } from "./digits";
import { C, mix } from "./palette";
import { at, bayer, noise, ramp, smoothNoise, type RGBA } from "./pixel";

const L = 16;
/** Asfalto tibio (café muy oscuro) y el rojo teja del carril exclusivo. */
const ASPHALT = ramp("#29211f", "#332a27", "#3d332f", "#4a3e38", "#5a4c44");
const BUSWAY = ramp("#4a221c", "#5c2b22", "#6e3428", "#80402f", "#94503a");
/** Piedra arenisca del cordón (cálida, no gris). */
const CURB = ramp("#6e5a48", "#8c7560", "#a8907a", "#c4ad94", "#dcc9ae");

/** Lo que baja del cordón hasta la calzada: el alto del escalón en tiles (CURB_DROP = 12 px de arte). */
const FACE = 12 / L;
/** "SOLO BUS" pintado en el carril exclusivo: dónde (x en tiles del nivel) y a qué escala (px por punto). */
const LETTERS = textMask("SOLO BUS", 1);
const LETTER_SCALE = 3;
const LETTER_XS = [16, 74];

/** Textura del asfalto: granitos claros y oscuros, manchas suaves y la huella de las ruedas. */
function tarmac(r: RGBA[], X: number, Y: number, tracks: number[]): RGBA {
  const x = Math.floor(X);
  const y = Math.floor(Y);
  const n = noise(x, y, 91);
  const patch = smoothNoise(X, Y, 26, 92);
  let i = patch < 0.35 ? 1 : patch < 0.7 ? 2 : 3;
  // Donde pisan las ruedas la calzada está un poco más lisa y oscura.
  if (tracks.some((t) => Math.abs(Y / L - t) < 0.28)) i = Math.max(0, i - 1);
  if (n > 0.97) i = Math.min(r.length - 1, i + 1);
  else if (n < 0.03) i = 0;
  // Una grieta finita, muy de vez en cuando.
  const crack = smoothNoise(X, Y, 11, 93);
  if (crack > 0.495 && crack < 0.505 && smoothNoise(X, Y, 60, 94) > 0.72) return at(r, 0);
  return at(r, bayer(x, y) < 0.12 ? Math.max(0, i - 1) : i);
}

/** Pintura de la calle, levemente gastada (le faltan granitos). */
const paint = (c: RGBA, X: number, Y: number): RGBA => (noise(Math.floor(X), Math.floor(Y), 95) < 0.12 ? mix(c, at(ASPHALT, 2), 0.55) : c);

export function roadFloor(X: number, Y: number): RGBA {
  const ty = Y / L;
  const tx = X / L;
  // Cordón de la plataforma: el canto de arriba claro y la cara que baja a la calzada, con su sombra.
  if (ty < ROAD.y0 + 0.1) return at(CURB, 4);
  if (ty < ROAD.y0 + FACE) {
    const v = (ty - ROAD.y0) / FACE;
    if (v > 0.86) return at(CURB, 0);
    return at(CURB, (Math.floor(X / 5) + (v > 0.5 ? 1 : 0)) % 2 ? 1 : 2);
  }
  // Sombra del cordón sobre la calzada.
  const shade = ty < ROAD.y0 + FACE + 0.14;
  if (ty < ROAD.laneY) {
    // Doble línea amarilla que separa el carril exclusivo del mixto.
    if (ty > ROAD.laneY - 0.22) return paint(at(C.mustard, 3), X, Y);
    // "SOLO BUS" en crema, a lo largo del carril.
    for (const x0 of LETTER_XS) {
      const u = Math.floor((tx - x0) * (L / LETTER_SCALE));
      const v = Math.floor((ty - (ROAD.y0 + FACE + 0.7)) * (L / LETTER_SCALE));
      if (LETTERS.on(u, v)) return paint(at(C.cream, 4), X, Y);
    }
    const c = tarmac(BUSWAY, X, Y, [81.5, 83.5]);
    return shade ? mix(c, at(BUSWAY, 0), 0.5) : c;
  }
  if (ty < ROAD.laneY + 0.08) return at(ASPHALT, 1);
  if (ty < ROAD.laneY + 0.3) return paint(at(C.mustard, 3), X, Y);
  if (ty < ROAD.y1) {
    // Línea de borde cortada (crema) y el carril mixto.
    if (ty > ROAD.y1 - 0.34 && ty < ROAD.y1 - 0.2 && ((tx % 3) + 3) % 3 < 1.8) return paint(at(C.cream, 3), X, Y);
    return tarmac(ASPHALT, X, Y, [85, 86.4]);
  }
  // Cordón de enfrente: la tapa de arenisca con juntas.
  if (((tx % 2) + 2) % 2 < 0.07) return at(CURB, 1);
  return at(CURB, ty < ROAD.y1 + 0.12 ? 2 : 3);
}
