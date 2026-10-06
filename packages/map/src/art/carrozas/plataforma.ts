// La plataforma de las carrozas (el camión decorado): faldón de colores con patrones andinos, flecos,
// el ribete dorado con bombillitos (prendidos de noche) y la cubierta. Va en 3D (con la Escena de
// z-buffer de afuera) y es la parte de atrás de cada carroza; encima van las figuras pintadas de frente.
// Coordenadas de arte (tile = 16), mirando hacia +x (el sentido del desfile), con el origen en la esquina
// de atrás del lado de la vereda, a ras de la vereda: las ruedas bajan `CURB_DROP` hasta la calzada.
import { CURB_DROP } from "../../world/areas/parada";
import { glyph, textMask } from "../digits";
import { Escena, type Tinte } from "../exterior-escena";
import { mix } from "../palette";
import { PixelCanvas, toScreen, type Ramp, type RGBA } from "../pixel";
import type { LuzCarroza, Parte } from "./partes";
import { rampa, tono } from "./pintura";

/** Ancho de las carrozas (en y): cabe en el carril exclusivo. */
export const ANCHO = 40;
export const Z = { wheel: -CURB_DROP, base: -10, top: 0 };

const LLANTA = rampa("#2a2433");
export const ORO = rampa("#e0a526");

/** Un punto del mundo de la carroza → px de pantalla desde su origen. */
export const pantalla = (x: number, y: number, z = 0) => toScreen(x, y, z);

/** Escena de una carroza de `largo` con figuras hasta `alto` (z) y `margen` a los lados. */
export const escena = (largo: number, alto = 40, margen = 6) =>
  new Escena({ x0: -margen, y0: -margen, z0: Z.wheel - 2, x1: largo + margen, y1: ANCHO + margen, z1: alto }, 3);

export interface EstiloFaldon {
  /** Color del faldón por (u a lo largo, v desde abajo), en unidades de arte. */
  faldon: (u: number, v: number, alto: number) => RGBA;
  /** La cubierta (por u, v en el piso de la plataforma). */
  cubierta: (u: number, v: number) => RGBA;
  /** Los colores de los flecos de abajo y de los bombillitos del ribete. */
  flecos: readonly Ramp[];
}

function rueda(s: Escena, cx: number, y: number) {
  s.quad([cx - 6, y + 0.3, Z.wheel], [1, 0, 0], [0, 0, 1], 12, 8, (u, v) => {
    const d = Math.hypot(u - 6, v - 6);
    if (d > 6) return null;
    if (d < 1.8) return tono(ORO, 3);
    if (d < 3.4) return tono(LLANTA, 4);
    return tono(LLANTA, d > 5.2 ? 1 : 2);
  });
}

/**
 * La plataforma: el faldón (caras +y y +x), los flecos que cuelgan, el ribete dorado con bombillitos y la
 * cubierta. Devuelve las luces de los bombillitos (para el brillo de noche).
 */
export function plataforma(s: Escena, len: number, e: EstiloFaldon, night: boolean): LuzCarroza[] {
  const alto = Z.top - Z.base;
  const lado: Tinte = (u, v) => {
    if (v > alto - 1.6) return tono(ORO, v > alto - 0.8 ? 4 : 3);
    if (v < 1.4) return null;
    return e.faldon(u, v, alto);
  };
  for (const x of [9, len - 9]) rueda(s, x, ANCHO - 1.5);
  s.box(0, 0, Z.base, len, ANCHO, alto, (u, v) => (u < 1.2 || v < 1.2 || u > len - 1.2 || v > ANCHO - 1.2 ? tono(ORO, 3) : e.cubierta(u, v)), lado, lado);
  // Los flecos: hilos de colores que cuelgan del faldón hasta casi la calle.
  const fleco = (o: [number, number, number], du: [number, number, number], n: number) =>
    s.quad(o, du, [0, 0, 1], n, 3.4, (u, v) => {
      const k = Math.floor(u / 1.5);
      if (u % 1.5 > 1.1) return null;
      if (v < (k % 2 ? 0.6 : 0)) return null;
      return tono(e.flecos[k % e.flecos.length]!, v > 2.6 ? 4 : 3);
    });
  fleco([0, ANCHO + 0.05, Z.base - 2], [1, 0, 0], len);
  fleco([len + 0.05, 0, Z.base - 2], [0, 1, 0], ANCHO);
  s.shadow(-1, 0, len + 2, ANCHO + 2, 0.34);
  // Los bombillitos del ribete (por las dos caras que se ven).
  const luces: LuzCarroza[] = [];
  const bombillo = (x: number, y: number, k: number) => {
    const r = e.flecos[k % e.flecos.length]!;
    const q = s.p(x, y, Z.top - 0.6);
    const col = night ? mix(tono(r, 5), [255, 250, 220, 255], 0.55) : tono(r, 4);
    s.canvas.set(q.x, q.y, col);
    s.canvas.set(q.x + 1, q.y, night ? tono(r, 5) : tono(r, 3));
    if (night && k % 3 === 0) {
      const p = pantalla(x, y, Z.top);
      luces.push({ x: p.x, y: p.y, r: 10, color: "#ffd88a" });
    }
  };
  let k = 0;
  for (let x = 3; x < len - 1; x += 5) bombillo(x, ANCHO, k++);
  for (let y = ANCHO - 3; y > 1; y -= 5) bombillo(len, y, k++);
  return luces;
}

/**
 * Letras de 5x7 sobre la cara +y (de cara a la cámara), con la base en z0 desde u0, sobre una plaquita.
 * Cada letra va derecha y la siguiente baja en escalera (sesgadas se deshacían). Se pinta encima de todo.
 */
export function letrero(s: Escena, text: string, u0: number, z0: number, col: RGBA, bg: RGBA) {
  const y = ANCHO;
  const m = textMask(text, 1);
  s.quad([u0 - 2, y + 0.45, z0 - 2], [1, 0, 0], [0, 0, 1], m.w + 4, m.h + 4, () => bg);
  let x = 0;
  for (const ch of text) {
    const g = glyph(ch);
    if (!g) continue;
    const w = g[0]!.length;
    const q = s.p(u0 + x + w / 2, y + 0.45, z0 + m.h);
    const left = Math.round(q.x - w / 2);
    const top = Math.round(q.y);
    for (let gy = 0; gy < g.length; gy++) for (let gx = 0; gx < w; gx++) if (g[gy]![gx] === "#") s.canvas.set(left + gx, top + gy, col);
    x += w + 1;
  }
}

/** La parte de la base (la Escena entera): su pivote es el origen de la carroza. */
export function parteBase(s: Escena, id = "plataforma"): Parte {
  const sp = s.sprite();
  return { id, canvas: sp.canvas, px: sp.ox, py: sp.oy, x: 0, y: 0 };
}

/** Recorta un lienzo a lo pintado (corriendo el pivote): texturas chicas. */
export function recortar(c: PixelCanvas, px: number, py: number): { canvas: PixelCanvas; px: number; py: number } {
  let x0 = c.width;
  let y0 = c.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (c.data[(y * c.width + x) * 4 + 3]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return { canvas: new PixelCanvas(1, 1), px: 0, py: 0 };
  const out = new PixelCanvas(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = y0; y <= y1; y++) out.data.set(c.data.subarray((y * c.width + x0) * 4, (y * c.width + x1 + 1) * 4), (y - y0) * out.width * 4);
  return { canvas: out, px: px - x0, py: py - y0 };
}

// ---------- Patrones del faldón ----------

/** Rombos escalonados andinos (como los de las fajas y las ruanas). */
export function rombosAndinos(colores: readonly Ramp[], fondo: Ramp) {
  return (u: number, v: number, alto: number): RGBA => {
    const cy = alto / 2;
    const cell = 9;
    const k = Math.floor(u / cell);
    const du = Math.abs((u % cell) - cell / 2);
    const dv = Math.abs(v - cy);
    const d = Math.floor(du) + Math.floor(dv);
    const c = colores[k % colores.length]!;
    if (d <= 1) return tono(colores[(k + 2) % colores.length]!, 4);
    if (d <= 3) return tono(c, 3);
    if (d === 4) return tono(c, 1);
    if (dv > alto / 2 - 2) return tono(fondo, 2);
    return tono(fondo, 3 + ((Math.floor(u) + Math.floor(v)) % 2 ? 0 : 0.4));
  };
}

/** Zigzag de colores en bandas (las "olas" de los tejidos). */
export function zigzag(colores: readonly Ramp[]) {
  return (u: number, v: number): RGBA => {
    const band = Math.floor((v + Math.abs(((u % 8) + 8) % 8 - 4)) / 2.2);
    return tono(colores[((band % colores.length) + colores.length) % colores.length]!, 3 + (band % 2 ? 0.6 : 0));
  };
}

/** Flores pintadas al estilo del barniz de Pasto: fondo de un color y flores de pétalos redondos. */
export function floresBarniz(fondo: Ramp, petalos: readonly Ramp[], centro: Ramp) {
  return (u: number, v: number, alto: number): RGBA => {
    const cell = 10;
    const k = Math.floor(u / cell);
    const fu = (u % cell) - cell / 2;
    const fv = v - alto / 2 - (k % 2 ? 0.8 : -0.8);
    const r = Math.hypot(fu, fv);
    const ang = Math.atan2(fv, fu);
    if (r < 1.2) return tono(centro, 4);
    if (r < 3.6 + Math.cos(ang * 5) * 0.9) return tono(petalos[k % petalos.length]!, r < 2.4 ? 4 : 3);
    if (Math.abs(fv) < 0.5 && Math.abs(fu) > 3.6) return tono(rampa("#3f9b4a"), 3);
    return tono(fondo, 3);
  };
}
