// Piezas comunes de las figuras de papel maché (VIR-173): la figura con su sistema de coordenadas (las
// partes se pintan en lienzos del mismo tamaño y se recortan), ojos grandes con brillo y pestañas, los
// párpados del parpadeo, bocas sonrientes, mejillas, plumas por capas, collares de cuentas y manos.
import type { Escena } from "../exterior-escena";
import { mix } from "../palette";
import { bayer, hex, type Ramp, type RGBA } from "../pixel";
import type { Movimiento, Parte } from "./partes";
import { pantalla, recortar } from "./plataforma";
import { capsula, circulo, corte, elipse, engordar, girada, Pintura, rampa, resta, tono, union, type Forma } from "./pintura";

/**
 * Una figura pintada de frente: un lienzo de w x h con el punto de apoyo (ax, ay) parado en el punto del
 * mundo `at` de la carroza. Cada parte que se mueve se pinta en su propio lienzo del mismo tamaño.
 */
export class Figura {
  private readonly sx: number;
  private readonly sy: number;
  constructor(
    readonly w: number,
    readonly h: number,
    readonly ax: number,
    readonly ay: number,
    at: readonly [number, number, number],
  ) {
    const s = pantalla(at[0], at[1], at[2]);
    this.sx = s.x;
    this.sy = s.y;
  }

  lienzo() {
    return new Pintura(this.w, this.h);
  }

  /** Un punto de la figura en px de pantalla desde el origen de la carroza. */
  aPantalla(fx: number, fy: number) {
    return { x: this.sx + fx - this.ax, y: this.sy + fy - this.ay };
  }

  /** Cierra un lienzo como parte de la carroza, con su pivote (en coordenadas de la figura). */
  parte(id: string, p: Pintura, pivX: number, pivY: number, o: { mov?: Movimiento; padre?: string; contorno?: boolean; corre?: readonly [number, number] } = {}): Parte {
    if (o.contorno !== false) p.contorno();
    const r = recortar(p.c, pivX, pivY);
    const at = this.aPantalla(pivX + (o.corre?.[0] ?? 0), pivY + (o.corre?.[1] ?? 0));
    return { id, canvas: r.canvas, px: r.px, py: r.py, x: at.x, y: at.y, ...(o.mov ? { mov: o.mov } : {}), ...(o.padre ? { padre: o.padre } : {}) };
  }
}

/** Pega un dibujo plano (ya con contorno) sobre la plataforma, con su apoyo (ax, ay) en el punto `at`. */
export function estampar(s: Escena, p: Pintura, ax: number, ay: number, at: readonly [number, number, number]) {
  p.contorno();
  const q = s.p(at[0], at[1], at[2]);
  const ox = Math.round(q.x - ax);
  const oy = Math.round(q.y - ay);
  const d = p.c.data;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const i = (y * p.w + x) * 4;
      if (d[i + 3]) s.canvas.set(ox + x, oy + y, [d[i]!, d[i + 1]!, d[i + 2]!, d[i + 3]!]);
    }
}

// ---------- Colores comunes ----------

export const BLANCO_OJO = rampa("#e8e2da");
export const LINEA = hex("#2a1520");
export const BRILLO = hex("#fffdf4");
export const LABIOS = rampa("#d63a6e");
export const BOCA = rampa("#7a1d33");
export const DIENTES = rampa("#f1ece2");
export const LENGUA = rampa("#e0607a");

// ---------- Ojos ----------

/** El ojo en forma de almendra: el arco de arriba sube `hu` y el de abajo baja `hl` desde (cx, cy). */
export function almendra(cx: number, cy: number, w: number, hu: number, hl: number, inclina = 0): Forma {
  const ru = ((w / 2) ** 2 + hu * hu) / (2 * hu);
  const rl = ((w / 2) ** 2 + hl * hl) / (2 * hl);
  const f = corte(circulo(cx, cy - hu + ru, ru), circulo(cx, cy + hl - rl, rl));
  const lens: Forma = { ...f, x0: cx - w / 2, x1: cx + w / 2, y0: cy - hu, y1: cy + hl };
  return inclina ? girada(lens, cx, cy, inclina) : lens;
}

/** Un punto del arco de arriba del ojo (t de 0, lagrimal, a 1, la esquina de afuera). */
function arcoArriba(cx: number, cy: number, w: number, hu: number, t: number, lado: 1 | -1) {
  const ru = ((w / 2) ** 2 + hu * hu) / (2 * hu);
  const x = cx + lado * (-w / 2 + w * t);
  const dx = x - cx;
  return { x, y: cy - hu + ru - Math.sqrt(Math.max(0, ru * ru - dx * dx)) };
}
function arcoAbajo(cx: number, cy: number, w: number, hl: number, t: number, lado: 1 | -1) {
  const rl = ((w / 2) ** 2 + hl * hl) / (2 * hl);
  const x = cx + lado * (-w / 2 + w * t);
  const dx = x - cx;
  return { x, y: cy + hl - rl + Math.sqrt(Math.max(0, rl * rl - dx * dx)) };
}

export interface OjoOpts {
  /** El iris (su rampa). */
  iris: Ramp;
  /** Hacia dónde mira (px, corre el iris). */
  mira?: number;
  /** Cuántas pestañas (0 = sin). */
  pestanas?: number;
  /** Sombra de ojos pintada encima del párpado (como las máscaras de pavo real). */
  sombra?: Ramp;
  /** El grosor de la línea del párpado. */
  linea?: number;
}

/**
 * Un ojo grande y vivo: el blanco con la sombra del párpado, el iris con su aro y el brillo de abajo, la
 * pupila, dos brillos, la línea del párpado con el rabito de afuera y las pestañas (más largas hacia
 * afuera). `lado` = hacia dónde queda la esquina de afuera (1 derecha, -1 izquierda).
 */
export function ojo(p: Pintura, cx: number, cy: number, w: number, hu: number, hl: number, lado: 1 | -1, o: OjoOpts) {
  const lens = almendra(cx, cy, w, hu, hl);
  if (o.sombra) {
    // La sombra de ojos: una medialuna de color arriba del ojo, degradada hacia la ceja.
    const s = resta(elipse(cx + lado * 1, cy - hu * 0.3, w * 0.62, hu * 2.1), engordar(lens, 0.6));
    p.volumen(corte(s, elipse(cx, cy - hu, w, hu * 2.4)), o.sombra, { alto: 3, brillo: 0.3, borde: false, base: 0.4 });
  }
  p.volumen(lens, BLANCO_OJO, { alto: 3, contraste: 2, brillo: 0, borde: false, base: 0.6 });
  // La sombra del párpado sobre el blanco.
  p.plano(corte(lens, engordar(resta(lens, { ...lens, d: (x, y) => lens.d(x, y - Math.max(1.5, hu * 0.35)) }), 0)), tono(BLANCO_OJO, 1));
  const ri = Math.max(2, Math.min(w * 0.26, (hu + hl) * 0.58));
  const ix = cx + (o.mira ?? 0);
  const iy = cy + (hl - hu) * 0.15;
  const iris = corte(circulo(ix, iy, ri), lens);
  p.plano(iris, (x, y) => {
    const dx = x + 0.5 - ix;
    const dy = y + 0.5 - iy;
    const r = Math.hypot(dx, dy) / ri;
    if (r > 0.82) return tono(o.iris, 0);
    const vetas = Math.abs(Math.sin(Math.atan2(dy, dx) * 6)) > 0.8 ? -0.6 : 0;
    const k = 1.6 + (dy / ri) * 1.6 + (r > 0.55 ? 0.4 : 0) + vetas + (bayer(x, y) - 0.5) * 0.6;
    return tono(o.iris, Math.max(1, Math.min(5, k + 1)));
  });
  p.plano(corte(circulo(ix, iy, ri * 0.42), lens), LINEA);
  // Lo de arriba del iris bajo la sombra del párpado.
  p.plano(corte(iris, { ...lens, d: (x, y) => -(lens.d(x, y + Math.max(1.4, hu * 0.3))) }), mix(tono(o.iris, 0), LINEA, 0.5));
  // Los brillos: uno grande arriba a la izquierda y uno chiquito abajo a la derecha.
  const b = Math.max(1, ri * 0.3);
  p.plano(circulo(ix - ri * 0.36, iy - ri * 0.34, b), BRILLO);
  p.punto(Math.round(ix + ri * 0.38), Math.round(iy + ri * 0.36), BRILLO);
  // La línea del párpado de arriba (más gruesa hacia afuera) y el rabito.
  const g = o.linea ?? Math.max(1.4, w / 9);
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = arcoArriba(cx, cy, w, hu, i / n, lado);
    const b2 = arcoArriba(cx, cy, w, hu, (i + 1) / n, lado);
    p.trazo(a.x, a.y - 0.3, b2.x, b2.y - 0.3, LINEA, g * (0.6 + (i / n) * 0.7));
  }
  const fin = arcoArriba(cx, cy, w, hu, 1, lado);
  p.trazo(fin.x, fin.y, fin.x + lado * w * 0.14, fin.y - hu * 0.35, LINEA, g * 0.9);
  // Las pestañas.
  const np = o.pestanas ?? 4;
  for (let i = 0; i < np; i++) {
    const t = 0.48 + (i / Math.max(1, np - 1)) * 0.5;
    const a = arcoArriba(cx, cy, w, hu, t, lado);
    const len = w * (0.12 + t * 0.12);
    p.curva(a.x, a.y, a.x + lado * len * 0.3, a.y - len * 0.8, a.x + lado * len * 0.9, a.y - len * 0.95, LINEA, 1);
  }
  // La línea de abajo, suave.
  for (let i = 3; i < 13; i++) {
    const a = arcoAbajo(cx, cy, w, hl, i / 14, lado);
    p.punto(Math.round(a.x), Math.round(a.y + 0.6), mix(LINEA, tono(BLANCO_OJO, 1), 0.55));
  }
}

/** El párpado cerrado (para el parpadeo): la almendra del color de la piel y la línea con las pestañas hacia abajo. */
export function parpado(p: Pintura, cx: number, cy: number, w: number, hu: number, hl: number, lado: 1 | -1, piel: Ramp, sombra?: Ramp) {
  const lens = engordar(almendra(cx, cy, w, hu, hl), 0.8);
  p.volumen(lens, sombra ?? piel, { alto: 4, brillo: 0.4, borde: false, base: 0.3 });
  const g = Math.max(1.4, w / 9);
  // El ojo cerrado: una curva hacia abajo, con las pestañas.
  const y = cy + hl * 0.35;
  p.curva(cx - lado * w / 2, y - 0.5, cx, y + hl * 0.9, cx + lado * (w / 2 + w * 0.08), y - hu * 0.15, LINEA, g);
  for (let i = 0; i < 4; i++) {
    const t = 0.45 + i * 0.17;
    const x = cx + lado * (-w / 2 + w * t);
    const yy = y + hl * 0.9 * (1 - (2 * t - 1) ** 2) * 0.9;
    p.trazo(x, yy, x + lado * 1.2, yy + w * 0.12 + 1, LINEA, 1);
  }
}

/** Ceja arqueada. */
export function ceja(p: Pintura, cx: number, cy: number, w: number, lado: 1 | -1, col: RGBA, g = 2) {
  p.curva(cx - lado * w * 0.5, cy + 0.8, cx - lado * w * 0.02, cy - w * 0.34, cx + lado * w * 0.55, cy + 1.4, col, g);
}

/** La sonrisa abierta: labios, la boca oscura, los dientes de arriba y la lengua. */
export function sonrisa(p: Pintura, cx: number, cy: number, w: number, h: number, labios: Ramp = LABIOS) {
  const boca = resta(elipse(cx, cy, w / 2, h), elipse(cx, cy - h * 0.92, (w / 2) * 1.18, h * 1.0));
  p.volumen(engordar(boca, 1.6), labios, { alto: 2.5, brillo: 0.7 });
  p.plano(boca, tono(BOCA, 2));
  p.plano(corte(boca, elipse(cx, cy + h * 0.95, w * 0.3, h * 0.45)), tono(LENGUA, 3));
  // Los dientes de arriba: una franja que sigue el labio de arriba, solo en el medio.
  const rx = (w / 2) * 1.18;
  p.plano(boca, (x, y) => {
    const k = (x + 0.5 - cx) / rx;
    if (Math.abs(x + 0.5 - cx) > w * 0.36) return null;
    const labio = cy - h * 0.92 + h * Math.sqrt(Math.max(0, 1 - k * k));
    return y + 0.5 < labio + Math.max(1.6, h * 0.42) ? tono(DIENTES, 4) : null;
  });
  // Las comisuras.
  p.punto(Math.round(cx - w / 2 - 1), Math.round(cy - h * 0.15), LINEA);
  p.punto(Math.round(cx + w / 2), Math.round(cy - h * 0.15), LINEA);
}

/** Mejillas pintadas: un óvalo tramado del color dado. */
export function mejilla(p: Pintura, cx: number, cy: number, rx: number, ry: number, col: RGBA) {
  p.plano(elipse(cx, cy, rx, ry), (x, y) => {
    const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    return d < 0.6 || bayer(x, y) > d - 0.1 ? col : null;
  });
}

// ---------- Plumas ----------

/**
 * Una pluma larga (de la base, en el ángulo dado, `largo` y `ancho`): el volumen de su color, el raquis
 * claro por el centro y las barbas marcadas, con la punta más oscura.
 */
export function pluma(p: Pintura, x: number, y: number, ang: number, largo: number, ancho: number, r: Ramp, o: { ojo?: Ramp; brillo?: number } = {}) {
  const ex = x + Math.cos(ang) * largo;
  const ey = y + Math.sin(ang) * largo;
  const cx = (x + ex) / 2 + Math.cos(ang) * largo * 0.08;
  const cy = (y + ey) / 2 + Math.sin(ang) * largo * 0.08;
  const f = elipse(cx, cy, largo / 2, ancho / 2, ang);
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  p.volumen(f, r, {
    alto: ancho * 0.45,
    brillo: o.brillo ?? 0.45,
    sombra: 0.3,
    pinta: (q, c) => {
      const along = (q.x + 0.5 - x) * ux + (q.y + 0.5 - y) * uy;
      const side = -(q.x + 0.5 - x) * uy + (q.y + 0.5 - y) * ux;
      // El raquis.
      if (Math.abs(side) < 0.55 && along < largo * 0.92) return tono(r, 5);
      // Las barbas: rayitas en diagonal.
      if (Math.abs(((along - Math.abs(side) * 0.8) % 3.2) + 3.2) % 3.2 < 0.7 && Math.abs(side) > 1) return tono(r, 2);
      // El ojo de pavo real cerca de la punta.
      if (o.ojo) {
        const dd = Math.hypot(along - largo * 0.8, side * 1.3);
        if (dd < ancho * 0.16) return tono(o.ojo, 0);
        if (dd < ancho * 0.28) return tono(rampa("#2a7fd4"), 3);
        if (dd < ancho * 0.42) return tono(o.ojo, 4);
      }
      return c;
    },
  });
}

/** El arcoíris de los tocados de Pasto: rojo, naranja, amarillo, verde, turquesa, azul y morado. */
export const ARCOIRIS: readonly Ramp[] = ["#e0283c", "#f2711c", "#f7c518", "#3db842", "#1fb8b0", "#2f6fd6", "#8a3cc8"].map(rampa);

/**
 * El tocado en abanico: plumas en dos capas (las de atrás largas, las de adelante cortas y corridas de
 * color) entre los ángulos `a0` y `a1`, con la base en (cx, cy).
 */
export function abanico(p: Pintura, cx: number, cy: number, r0: number, largo: number, a0: number, a1: number, n: number, colores: readonly Ramp[], ancho = 9) {
  for (const capa of [0, 1]) {
    const m = capa ? n - 1 : n;
    for (let i = 0; i < m; i++) {
      const t = capa ? (i + 0.5) / n : i / (n - 1);
      const a = a0 + (a1 - a0) * t;
      const L = capa ? largo * 0.72 : largo;
      const col = colores[Math.floor(t * colores.length * 0.999 + (capa ? 1 : 0)) % colores.length]!;
      pluma(p, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, a, L, capa ? ancho * 0.9 : ancho, col);
    }
  }
}

// ---------- Cuentas, manos, telas ----------

/** Una sarta de cuentas siguiendo una curva cuadrática, alternando colores. */
export function cuentas(p: Pintura, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, r: number, colores: readonly Ramp[]) {
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / (r * 1.9)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
    const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
    p.volumen(circulo(x, y, r), colores[i % colores.length]!, { alto: r, brillo: 0.9, borde: "oscuro", sombra: 0.3 });
  }
}

/**
 * Una mano abierta vista de frente (palma hacia la cámara), con la muñeca en (x, y) y los dedos hacia
 * `ang`. `uñas`: el color de las uñas pintadas. Devuelve la forma de la palma (para pintarle encima).
 */
export function mano(p: Pintura, x: number, y: number, ang: number, s: number, piel: Ramp, o: { unas?: Ramp; dedos?: number; abiertos?: number; lado?: 1 | -1 } = {}): Forma {
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const vx = -uy;
  const vy = ux;
  const lado = o.lado ?? 1;
  const palmaC = { x: x + ux * s * 0.55, y: y + uy * s * 0.55 };
  const palma = elipse(palmaC.x, palmaC.y, s * 0.6, s * 0.5, ang);
  const dedos: Forma[] = [];
  const puntas: { x: number; y: number; a: number }[] = [];
  const nd = o.dedos ?? 4;
  const ab = o.abiertos ?? 0.18;
  for (let i = 0; i < nd; i++) {
    const k = i - (nd - 1) / 2;
    const a = ang + k * ab;
    const bx = palmaC.x + ux * s * 0.42 + vx * k * s * 0.27;
    const by = palmaC.y + uy * s * 0.42 + vy * k * s * 0.27;
    const L = s * (0.72 - Math.abs(k) * 0.12);
    dedos.push(capsula(bx, by, bx + Math.cos(a) * L, by + Math.sin(a) * L, s * 0.15, s * 0.12));
    puntas.push({ x: bx + Math.cos(a) * L, y: by + Math.sin(a) * L, a });
  }
  // El pulgar, de lado.
  const ta = ang - lado * 1.1;
  const tx = palmaC.x - vx * lado * s * 0.35;
  const ty = palmaC.y - vy * lado * s * 0.35;
  const pulgar = capsula(tx, ty, tx + Math.cos(ta) * s * 0.55, ty + Math.sin(ta) * s * 0.55, s * 0.17, s * 0.13);
  const brazo = capsula(x - ux * s * 0.4, y - uy * s * 0.4, palmaC.x, palmaC.y, s * 0.34, s * 0.42);
  p.volumen(brazo, piel, { alto: s * 0.25, brillo: 0.4 });
  for (const d of [pulgar, ...dedos]) p.volumen(d, piel, { alto: s * 0.12, brillo: 0.5, sombra: 0.25 });
  p.volumen(palma, piel, { alto: s * 0.3, brillo: 0.4 });
  if (o.unas) {
    // Las uñas largas pintadas, que salen de la punta de cada dedo.
    for (const t of puntas) {
      const L = s * 0.3;
      p.volumen(elipse(t.x + Math.cos(t.a) * L * 0.25, t.y + Math.sin(t.a) * L * 0.25, L * 0.62, s * 0.1, t.a), o.unas, { alto: 1.5, brillo: 0.9, sombra: 0.3 });
    }
  }
  return palma;
}

/** Una tela con rayas de colores (ruanas, anacos, fajas): rampa por banda a lo alto (`dir` = 0) o a lo ancho. */
export function rayas(colores: readonly Ramp[], ancho: number, desde = 0, dir: 0 | 1 = 0) {
  return (q: { x: number; y: number }) => {
    const k = Math.floor(((dir ? q.x : q.y) - desde) / ancho) % colores.length;
    return colores[(k + colores.length) % colores.length]!;
  };
}

// ---------- El rostro entero ----------

export interface RostroOpts {
  piel: Ramp;
  /** Pintura de la cara por píxel (franjas de color, degradados de fantasía). */
  patron?: (q: { x: number; y: number }) => Ramp | null;
  ojo: { dx: number; dy: number; w: number; hu: number; hl: number; iris: Ramp; sombra?: Ramp; pestanas?: number; mira?: number };
  boca?: { dy: number; w: number; h: number; labios?: Ramp };
  cejas?: RGBA;
  mejillas?: RGBA;
  /** Nariz de este color (por defecto, la piel). */
  nariz?: Ramp;
}

/** Una cara grande de papel maché: el óvalo con volumen, los ojos, las cejas, la nariz, las mejillas y la sonrisa. */
export function rostro(p: Pintura, cx: number, cy: number, rx: number, ry: number, o: RostroOpts) {
  p.volumen(elipse(cx, cy, rx, ry), o.piel, { alto: Math.min(rx, ry) * 0.55, brillo: 0.6, ...(o.patron ? { patron: o.patron } : {}) });
  const e = o.ojo;
  if (o.mejillas) for (const l of [-1, 1]) mejilla(p, cx + l * (e.dx + e.w * 0.25), cy + e.dy + e.hl + 5, e.w * 0.32, e.w * 0.2, o.mejillas);
  if (o.cejas) for (const l of [-1, 1] as const) ceja(p, cx + l * (e.dx + 0.5), cy + e.dy - e.hu - 4, e.w, l, o.cejas, Math.max(1.4, e.w / 8));
  for (const l of [-1, 1] as const) ojo(p, cx + l * e.dx, cy + e.dy, e.w, e.hu, e.hl, l, { iris: e.iris, ...(e.sombra ? { sombra: e.sombra } : {}), ...(e.pestanas !== undefined ? { pestanas: e.pestanas } : {}), mira: e.mira ?? 0 });
  const nr = o.nariz ?? o.piel;
  const ny = cy + e.dy + (o.boca ? (o.boca.dy - e.dy) * 0.5 : ry * 0.35);
  p.volumen(union(elipse(cx, ny - 2, rx * 0.11, ry * 0.18), elipse(cx, ny + 1.5, rx * 0.2, ry * 0.09)), nr, { alto: 3, brillo: 0.8, base: 0.5, sombra: 0.35 });
  p.punto(Math.round(cx - rx * 0.09), Math.round(ny + 2), tono(nr, 0));
  p.punto(Math.round(cx + rx * 0.09), Math.round(ny + 2), tono(nr, 0));
  if (o.boca) sonrisa(p, cx, cy + o.boca.dy, o.boca.w, o.boca.h, o.boca.labios);
}

/** Los párpados de un rostro (para la parte del parpadeo). */
export function parpadosDe(p: Pintura, cx: number, cy: number, o: RostroOpts, piel: Ramp = o.piel) {
  const e = o.ojo;
  for (const l of [-1, 1] as const) parpado(p, cx + l * e.dx, cy + e.dy, e.w, e.hu, e.hl, l, piel, e.sombra);
}
