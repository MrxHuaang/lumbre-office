// Piezas de escultura comunes a las carrozas (VIR-173): el camión decorado (cubierta, faldón con arcos
// para las ruedas, flecos, ruedas que asoman), plumas con grosor, tocados en abanico, cabezas con la cara
// pintada (una calcomanía sobre el elipsoide), collares de cuentas, manos, muñecos chicos y la cosecha.
import { CURB_DROP } from "../../world/areas/parada";
import { mix } from "../palette";
import { PixelCanvas, type Ramp, type RGBA } from "../pixel";
import { en, hacia, leerCalco, liso, mirando, por, suma, type Escultor, type Marco, type Mat, type Tinte, type V3 } from "./escultura";
import { BRILLO, LINEA, mejilla } from "./figuras";
import { Pintura, circulo, elipse, rampa, tono } from "./pintura";

/** Ancho de las carrozas (en y): cabe en el carril exclusivo. */
export const ANCHO = 40;
export const Z = { piso: -CURB_DROP, base: -10, top: 0 };
export const ORO = rampa("#e6aa2a");
const LLANTA = rampa("#2c2634");
const RIN = rampa("#c9c4d4");

export interface Camion {
  /** Color del faldón por (u a lo largo, v desde abajo, alto). */
  faldon: (u: number, v: number, alto: number) => RGBA;
  cubierta: (u: number, v: number) => RGBA;
  flecos: readonly Ramp[];
}

const RUEDAS = (len: number) => [13, len - 15];

/**
 * El camión decorado: la cubierta, el faldón de colores por el costado (+y) y el frente (+x) con el
 * ribete dorado, los arcos por donde asoman las ruedas, los flecos y la sombra en la calle.
 */
export function camion(e: Escultor, len: number, c: Camion) {
  e.parte("plataforma", [0, 0, 0]);
  const alto = Z.top - Z.base;
  const ruedas = RUEDAS(len);
  const arco = (u: number, v: number) => ruedas.some((x) => Math.hypot(u - x, v) < 8.2);
  const lado =
    (frente: boolean): Tinte =>
    (q) => {
      if (!frente && arco(q.u, q.v)) return null;
      if (q.v > alto - 1.8) return { c: tono(ORO, q.v > alto - 0.9 ? 4 : 3), brillo: 0.8 };
      if (!frente && ruedas.some((x) => Math.hypot(q.u - x, q.v) < 9.4)) return { c: tono(ORO, 2) };
      return { c: c.faldon(q.u, q.v, alto) };
    };
  // Las ruedas, adentro, que asoman por los arcos.
  for (const x of ruedas)
    e.rueda(x, ANCHO - 5, Z.piso + 6.5, 6.5, 3.5, (q) => {
      if (q.l[2] === 1) {
        const d = Math.hypot(q.l[0], q.l[1]);
        if (d < 0.32) return { r: RIN, t: 1, brillo: 0.9 };
        if (d < 0.56) return { r: RIN, t: -1 };
        return { r: LLANTA };
      }
      return { r: LLANTA, t: -0.5 };
    });
  e.caja(0, 0, Z.base, len, ANCHO, alto, (q) => ({ c: q.u < 1.2 || q.v < 1.2 || q.u > len - 1.2 || q.v > ANCHO - 1.2 ? tono(ORO, 4) : c.cubierta(q.u, q.v) }), lado(false), lado(true));
  // El grosor de la base (el chasís oscuro, un poco adentro).
  e.caja(1, 1, Z.piso + 3, len - 2, ANCHO - 2, Z.base - Z.piso - 3, null, (q) => (arco(q.u, q.v + 3 - alto) ? null : { r: LLANTA, t: -1 }), liso(LLANTA, -1.5));
  // Los flecos que cuelgan del faldón.
  const fleco = (o: V3, du: V3, n: number, conArcos: boolean) =>
    e.lamina(
      o,
      du,
      [0, 0, -1],
      n,
      3.6,
      (q) => ({ c: tono(c.flecos[Math.floor(q.u / 1.6) % c.flecos.length]!, q.v > 2.6 ? 2 : 4) }),
      (u, v) => u % 1.6 < 1.05 && v < (Math.floor(u / 1.6) % 2 ? 3.6 : 2.8) && !(conArcos && ruedas.some((x) => Math.abs(u - x) < 8.5)),
    );
  fleco([0, ANCHO + 0.2, Z.base + 0.5], [1, 0, 0], len, true);
  fleco([len + 0.2, 0, Z.base + 0.5], [0, 1, 0], ANCHO, false);
  e.sombraSuelo(-3, 1, len + 6, ANCHO + 5, Z.piso, 0.34);
}

/** El marco de la plataforma completa: hasta dónde puede llegar lo que se mueve (px de pantalla). */
export const marcoDe = (len: number) => ({ x0: -ANCHO - 40, x1: len + 40 });

// ---------- Plumas ----------

/**
 * Una pluma con grosor: de `raiz` hacia `dir`, `largo` y `ancho`, aplanada contra `plano` (la normal del
 * abanico). El raquis claro, las barbas, la punta más oscura y, si se pide, el ojo de pavo real.
 */
export function pluma3d(e: Escultor, raiz: V3, dir: V3, plano: V3, largo: number, ancho: number, r: Ramp, o: { ojo?: boolean; t?: number } = {}) {
  const m = hacia(dir, plano);
  const c = suma(raiz, por(m.fre, largo / 2));
  e.elipsoide(c, ancho / 2, 1.1, largo / 2, m, (q) => {
    const along = (q.l[2] + 1) / 2;
    const side = q.l[0];
    let t = (o.t ?? 0) + (along > 0.86 ? -0.7 : 0);
    if (Math.abs(side) < 0.1 && along < 0.94) return { r, t: t + 2, brillo: 0.6 };
    if (((along * largo - Math.abs(side) * ancho * 0.45) % 3 + 3) % 3 < 0.75 && Math.abs(side) > 0.18) t -= 1;
    if (o.ojo) {
      const d = Math.hypot((along - 0.8) * largo, side * ancho * 0.5);
      if (d < ancho * 0.12) return { c: LINEA, brillo: 0.8 };
      if (d < ancho * 0.24) return { r: rampa("#1f63c8"), t: 1, brillo: 0.8 };
      if (d < ancho * 0.36) return { r: rampa("#f2c21c"), t: 0.5 };
    }
    return { r, t, brillo: 0.45 };
  });
}

/** Los siete colores del arcoíris de los tocados de Pasto. */
export const ARCOIRIS: readonly Ramp[] = ["#e0283c", "#f2711c", "#f7c518", "#3db842", "#1fb8b0", "#2f6fd6", "#8a3cc8"].map(rampa);

/**
 * Tocado o ala en abanico: plumas en dos capas (las de atrás largas, las de adelante más cortas) entre los
 * ángulos `a0` y `a1` del plano (der, arr) del marco, desde `centro`, inclinadas `atras` hacia atrás.
 */
export function abanico3d(e: Escultor, centro: V3, m: Marco, r0: number, largo: number, a0: number, a1: number, n: number, colores: readonly Ramp[], ancho = 9, atras = 0.3) {
  for (const capa of [0, 1]) {
    const k = capa ? n - 1 : n;
    for (let i = 0; i < k; i++) {
      const t = capa ? (i + 0.5) / n : i / (n - 1);
      const a = a0 + (a1 - a0) * t;
      const radial = suma(por(m.der, Math.cos(a)), por(m.arr, Math.sin(a)));
      const dir = suma(radial, por(m.fre, -atras));
      const raiz = suma(centro, por(radial, r0), por(m.fre, capa ? 1.5 : -1.5));
      const col = colores[Math.floor(t * colores.length * 0.999 + (capa ? 1 : 0)) % colores.length]!;
      pluma3d(e, raiz, dir, m.fre, capa ? largo * 0.74 : largo, capa ? ancho * 0.92 : ancho, col, { t: capa ? 0.3 : -0.3 });
    }
  }
}

// ---------- Cabezas con la cara pintada ----------

/** Una calcomanía para un elipsoide de radios (ra, rb): un lienzo de 2ra x 2rb con el centro en el medio. */
export function calco(ra: number, rb: number, pintar: (p: Pintura, cx: number, cy: number) => void): PixelCanvas {
  const p = new Pintura(Math.round(ra * 2), Math.round(rb * 2));
  pintar(p, ra, rb);
  return p.c;
}

/**
 * Tinte para un elipsoide con cara: la piel (o su patrón) y, adelante, lo pintado en la calcomanía.
 * `desde`: desde qué tan de frente se pega (l[2] > desde).
 */
export function conCara(piel: (q: { l: V3 }) => Mat, cara: PixelCanvas, desde = 0.15): Tinte {
  return (q) => {
    if (q.l[2] > desde) {
      const c = leerCalco(cara, q.l[0], q.l[1]);
      if (c) return { c, brillo: 0.35 };
    }
    return piel(q);
  };
}

/** Solo lo pintado de la calcomanía (para los párpados, que van encima de la cara). */
export function soloCalco(cara: PixelCanvas, desde = 0.15): Tinte {
  return (q) => {
    if (q.l[2] <= desde) return null;
    const c = leerCalco(cara, q.l[0], q.l[1]);
    return c ? { c, brillo: 0.4 } : null;
  };
}

/** Un collar de cuentas en 3D siguiendo una curva cuadrática (a, control, b). */
export function cuentas3d(e: Escultor, a: V3, ctl: V3, b: V3, r: number, colores: readonly Ramp[]) {
  const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / (r * 1.8)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p: V3 = [0, 1, 2].map((k) => (1 - t) * (1 - t) * a[k]! + 2 * (1 - t) * t * ctl[k]! + t * t * b[k]!) as unknown as V3;
    e.esfera(p, r, liso(colores[i % colores.length]!, 0.3, 0.9));
  }
}

/**
 * Una mano abierta: la palma (elipsoide aplanado) en `c` mirando hacia `palma`, los dedos hacia `dedos` y
 * el pulgar de lado. Con `unas`, uñas largas pintadas.
 */
export function mano3d(e: Escultor, c: V3, dedos: V3, palma: V3, s: number, piel: Ramp, o: { unas?: Ramp; abre?: number; curva?: number } = {}) {
  const m = hacia(dedos, palma);
  e.elipsoide(c, s * 0.55, s * 0.24, s * 0.5, m, liso(piel, 0, 0.4));
  const abre = o.abre ?? 0.16;
  const curva = o.curva ?? 0.25;
  for (let i = 0; i < 4; i++) {
    const k = i - 1.5;
    const raiz = en(c, m, k * s * 0.26, 0, s * 0.4);
    const L = s * (0.7 - Math.abs(k) * 0.1);
    const d1 = suma(por(m.fre, Math.cos(k * abre)), por(m.der, Math.sin(k * abre)));
    const mid = suma(raiz, por(d1, L * 0.55));
    const d2 = suma(d1, por(m.arr, curva));
    const tip = suma(mid, por(d2, L * 0.5));
    e.capsula(raiz, mid, s * 0.14, s * 0.13, liso(piel, 0.2, 0.5));
    e.capsula(mid, tip, s * 0.13, s * 0.11, liso(piel, 0.2, 0.5));
    if (o.unas) e.capsula(tip, suma(tip, por(d2, s * 0.28)), s * 0.1, s * 0.05, liso(o.unas, 0.5, 0.9));
  }
  const pr = en(c, m, -s * 0.45, 0, -s * 0.05);
  e.capsula(pr, en(c, m, -s * 0.85, s * 0.15, s * 0.3), s * 0.16, s * 0.12, liso(piel, 0.2, 0.5));
}

// ---------- Muñecos chicos ----------

export interface MunecoOpts {
  piel: Ramp;
  ropa: Ramp;
  ropa2?: Ramp;
  sombrero?: Ramp;
  pelo?: Ramp;
  /** Hacia dónde mira (ángulo, como `mirando`). */
  mira?: number;
  /** Lo que lleva en la mano levantada. */
  lleva?: (e: Escultor, mano: V3) => void;
}

/** Un muñeco chico de papel maché (unos 40 de alto a escala 1) con los pies en `base`. */
export function muneco3d(e: Escultor, base: V3, s: number, o: MunecoOpts) {
  const m = mirando(o.mira ?? 1.05);
  const S = (v: number) => v * s;
  const oscuro = rampa("#3a2a3e");
  for (const l of [-1, 1]) e.capsula(en(base, m, l * S(3), 0, 0), en(base, m, l * S(3), S(12), 0), S(2.2), S(2.4), liso(oscuro));
  // La ruana o el vestido: un cono truncado con rayas.
  const r2 = o.ropa2 ?? rampa("#f2e6c8");
  e.cono(base[0], base[1], base[2] + S(10), S(10), S(18), (q) => ({ r: Math.floor(q.v / S(3)) % 3 === 0 ? r2 : o.ropa, t: 0, brillo: 0.3 }), S(4));
  // Los brazos: uno levantado, el otro en jarra.
  const hombro = (l: number) => en(base, m, l * S(6), S(25), 0);
  const manoArriba = en(base, m, S(12), S(36), S(2));
  e.capsula(hombro(1), manoArriba, S(2), S(1.8), liso(o.ropa));
  e.esfera(manoArriba, S(2.3), liso(o.piel));
  e.capsula(hombro(-1), en(base, m, -S(10), S(16), S(2)), S(2), S(1.8), liso(o.ropa));
  o.lleva?.(e, manoArriba);
  // La cabeza con su carita pintada.
  const cab = en(base, m, 0, S(34), 0);
  const cara = calco(S(7.5), S(7.5), (p, cx, cy) => {
    for (const l of [-1, 1]) {
      p.plano(elipse(cx + l * S(2.6), cy, Math.max(0.8, S(1)), Math.max(1, S(1.4))), LINEA);
      p.punto(Math.round(cx + l * S(2.6) - 0.4), Math.round(cy - S(0.6)), BRILLO);
      mejilla(p, cx + l * S(4.2), cy + S(2.6), S(1.6), S(1), tono(rampa("#ef6ba0"), 3));
    }
    p.curva(cx - S(2), cy + S(3), cx, cy + S(5), cx + S(2), cy + S(3), LINEA, 1);
  });
  if (o.pelo) e.elipsoide(suma(cab, por(m.fre, -S(1)), [0, 0, S(1)]), S(8.2), S(8), S(7.8), m, liso(o.pelo, 0, 0.6));
  e.elipsoide(cab, S(7.5), S(7.5), S(7.5), m, conCara(() => ({ r: o.piel, brillo: 0.5 }), cara, 0.2));
  if (o.sombrero) {
    e.disco(cab[0], cab[1], cab[2] + S(5), S(11), liso(o.sombrero, 0.3));
    e.cono(cab[0], cab[1], cab[2] + S(5), S(6), S(7), (q) => ({ r: q.v < S(2) ? rampa("#e0283c") : o.sombrero!, brillo: 0.3 }), S(5));
  }
}

/** Una mazorca de colores (granos tramados) de `a` a `b`, con las hojas abiertas en la base. */
export function mazorca3d(e: Escultor, a: V3, b: V3, r: number, granos: Ramp) {
  e.capsula(a, b, r, r * 0.7, (q) => ({ r: granos, t: (Math.floor(q.u * 3) + Math.floor(q.v * 1.3)) % 2 ? 0.4 : -0.6, brillo: 0.6 }));
  const hoja = rampa("#d8c27a");
  const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  for (const l of [-1, 1]) e.capsula(a, suma(a, por(d, 0.45), [l * r * 1.4, -l * r * 0.6, 0]), r * 0.35, r * 0.15, liso(hoja));
}

/** Una papa (morada o amarilla). */
export const papa3d = (e: Escultor, c: V3, r: number, color: Ramp) => e.elipsoide(c, r * 1.25, r * 0.85, r, mirando(0.3), (q) => ({ r: color, t: Math.abs(Math.sin(q.u * 5) * Math.cos(q.v * 4)) > 0.96 ? -1.5 : 0, brillo: 0.25 }));

/** Una mata de quinua: tallos y las panojas de color. */
export function quinua3d(e: Escultor, base: V3, h: number, color: Ramp) {
  const tallo = rampa("#5a8a3a");
  for (const [dx, dy] of [
    [-2, 0],
    [0, 1],
    [2, -1],
  ] as const) {
    const top: V3 = [base[0] + dx, base[1] + dy, base[2] + h * (dx === 0 ? 1 : 0.8)];
    e.capsula(base, top, 0.7, 0.5, liso(tallo));
    for (let k = 0; k < 4; k++) e.esfera([top[0] + (k % 2) - 0.5, top[1], top[2] - k * 2.2], 2.3 - k * 0.3, liso(color, 0, 0.3));
  }
}

/** El elemento i de una lista, dando la vuelta (también con i negativo). */
export const ciclo = <T>(xs: readonly T[], i: number): T => xs[((Math.floor(i) % xs.length) + xs.length) % xs.length]!;

/** Mezcla dos rampas (para degradados de color en una misma pieza). */
export const entre = (a: Ramp, b: Ramp, k: number): Ramp => a.map((c, i) => mix(c, b[i]!, k));

export { circulo };
