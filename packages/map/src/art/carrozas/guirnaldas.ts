// Adornos comunes del jaguar, el león, el cóndor y el Galeras (VIR-173): el faldón de festones (la tela
// recogida en guirnaldas con el ribete dorado y las borlas), flores de pétalos redondos, hojas, el
// danzante chico con su tocado de plumas y los brazos arriba, y el tambor. Todo en coordenadas del lienzo.
import type { Ramp, RGBA } from "../pixel";
import { BRILLO, LINEA, mejilla, pluma } from "./figuras";
import { capsula, caja, circulo, elipse, Pintura, poligono, rampa, tono, union } from "./pintura";

/** Un número de 0 a 1 que sale siempre igual para cada (a, b): manchas, flores y pliegues sin azar. */
export const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * El faldón de festones: arriba la tela recogida en guirnaldas (cada una cuelga en arco, con sus pliegues
 * y el ribete dorado), entre una y otra la borla, y abajo el fondo de pliegues con una florecita dorada.
 * `telas` se turnan de guirnalda en guirnalda.
 */
export function festones(telas: readonly Ramp[], fondo: Ramp, oro: Ramp, celda = 12) {
  return (u: number, v: number, alto: number): RGBA => {
    const k = Math.floor(u / celda);
    const t = (((u % celda) + celda) % celda) / celda;
    const tela = telas[((k % telas.length) + telas.length) % telas.length]!;
    const arriba = alto - 1.6;
    const borde = arriba - 5.6 * Math.sin(Math.PI * t);
    // La borla que cuelga entre dos guirnaldas.
    const dt = Math.min(t, 1 - t) * celda;
    if (dt < 0.7 && v > 2.4) return tono(oro, v > arriba - 1 ? 4 : 3);
    if (dt < 1.3 && v > 1.4 && v < 3.4) return tono(oro, v > 2.6 ? 4 : 2);
    if (Math.abs(v - borde) < 0.75) return tono(oro, v > borde ? 4 : 2);
    if (v > borde) {
      // Los pliegues de la guirnalda: arcos que siguen el borde, con luz arriba.
      const f = (arriba - v) / Math.max(0.5, arriba - borde);
      const banda = Math.floor(f * 3);
      return tono(tela, banda % 2 ? 2.4 : f < 0.2 ? 4 : 3);
    }
    // El fondo: pliegues derechos y una florecita dorada en el medio de cada guirnalda.
    const fu = (t - 0.5) * celda;
    const fv = v - 2.6;
    if (Math.hypot(fu, fv * 1.3) < 1.1) return tono(oro, 4);
    return tono(fondo, Math.floor(u * 1.4) % 3 === 0 ? 2 : 3);
  };
}

/** Una flor de cinco pétalos redondos con su centro. */
export function flor(p: Pintura, x: number, y: number, r: number, petalo: Ramp, centro: Ramp, giro = 0) {
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2 + giro;
    p.volumen(elipse(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75, r * 0.6, r * 0.45, a), petalo, { alto: 1.4, brillo: 0.3, borde: "propio" });
  }
  p.volumen(circulo(x, y, r * 0.4), centro, { alto: 1.2, brillo: 0.8, borde: "propio" });
}

/** Una hoja larga (de la base hacia `ang`), con su nervio claro. */
export function hoja(p: Pintura, x: number, y: number, ang: number, largo: number, ancho: number, verde: Ramp) {
  const cx = x + (Math.cos(ang) * largo) / 2;
  const cy = y + (Math.sin(ang) * largo) / 2;
  p.volumen(elipse(cx, cy, largo / 2, ancho / 2, ang), verde, { alto: ancho * 0.4, brillo: 0.4, borde: "propio", sombra: 0.25 });
  p.trazo(x + Math.cos(ang) * 1.5, y + Math.sin(ang) * 1.5, x + Math.cos(ang) * largo * 0.8, y + Math.sin(ang) * largo * 0.8, tono(verde, 4), 1);
}

export const VERDES = ["#2f9a4a", "#3fb85a", "#1f7a5a"].map(rampa);

/**
 * Un macizo de hojas y flores que llena una franja (de x0 a x1, con la orilla de abajo en `y(x)`), como
 * la cama de flores que cubre la plataforma.
 */
export function macizo(p: Pintura, x0: number, x1: number, y: (x: number) => number, alto: number, flores: readonly Ramp[], semilla = 0) {
  const n = Math.max(3, Math.round((x1 - x0) / 5));
  for (let i = 0; i < n * 2; i++) {
    const x = x0 + ((i + hash(i, semilla) * 0.8) / (n * 2)) * (x1 - x0);
    const yb = y(x);
    const a = -Math.PI / 2 + (hash(i, semilla + 3) - 0.5) * 2.2;
    hoja(p, x, yb - 1, a, alto * (0.6 + hash(i, semilla + 5) * 0.5), 4 + hash(i, semilla + 7) * 2, VERDES[i % VERDES.length]!);
  }
  for (let i = 0; i < n; i++) {
    const x = x0 + ((i + 0.3 + hash(i, semilla + 11) * 0.5) / n) * (x1 - x0);
    const yb = y(x) - alto * (0.25 + hash(i, semilla + 13) * 0.55);
    const r = 2.6 + hash(i, semilla + 17) * 1.8;
    flor(p, x, yb, r, flores[(i + semilla) % flores.length]!, AMARILLO_FLOR, hash(i, semilla) * 2);
  }
}

const AMARILLO_FLOR = rampa("#f7c518");

export interface DanzanteOpts {
  piel: Ramp;
  traje: Ramp;
  traje2: Ramp;
  /** Las plumas del tocado (de atrás hacia adelante); vacío, sin tocado. */
  plumas: readonly Ramp[];
  pelo?: Ramp;
  /** Falda (si no, pantalón). */
  falda?: boolean;
  /** Antifaz de este color (los ojos se ven por los huecos). */
  antifaz?: Ramp;
  /** Sombrerito en vez de tocado de plumas. */
  sombrero?: Ramp;
  /** Brazos: arriba (`v`), uno arriba y otro en jarra, o abajo. */
  brazos?: "v" | "uno" | "abajo";
  /** Nariz roja de payaso y cuello de vuelos. */
  payaso?: Ramp;
}

const ORO = rampa("#e6b02a");

/**
 * Un danzante chico de papel maché con proporciones de muñeco (cabeza grande), de pie con los pies en
 * (cx, by): el tocado de plumas en abanico, la cara con ojos de brillo y cachetes, el traje de dos colores
 * con el pectoral dorado y los brazos arriba bailando. Mide unos 42 px a escala 1 (sin las plumas).
 */
export function danzante(p: Pintura, cx: number, by: number, s: number, o: DanzanteOpts) {
  const S = (v: number) => v * s;
  const hy = by - S(31);
  const hr = S(8.6);
  // El tocado: plumas en abanico detrás de la cabeza.
  if (!o.sombrero) {
    const n = o.plumas.length;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * (1.9 / Math.max(1, n - 1));
      pluma(p, cx + Math.cos(a) * S(5), hy - S(4) + Math.sin(a) * S(4), a, S(15 - Math.abs(i - (n - 1) / 2) * 1.6), S(5.6), o.plumas[i]!, { brillo: 0.35 });
    }
  }
  if (o.pelo) p.volumen(union(elipse(cx, hy - S(0.5), hr + S(1.4), hr + S(0.6)), caja(cx - hr - S(1.4), hy, cx + hr + S(1.4), hy + S(9), S(2))), o.pelo, { alto: S(3), borde: "oscuro" });
  // Las piernas o la falda.
  const oscuro = rampa("#3a2a3e");
  if (o.falda) p.volumen(poligono([[cx - S(5), by - S(14)], [cx + S(5), by - S(14)], [cx + S(9), by - S(2.5)], [cx - S(9), by - S(2.5)]]), o.traje2, { alto: S(4), borde: "oscuro", patron: (q) => (Math.floor((q.y - by) / S(2.6)) % 2 ? o.traje : o.traje2) });
  else for (const d of [-1, 1]) p.volumen(capsula(cx + d * S(2.8), by - S(12), cx + d * S(3.2), by - S(2), S(2.4)), o.traje2, { alto: S(2), borde: "oscuro" });
  for (const d of [-1, 1]) p.volumen(elipse(cx + d * S(3.4), by - S(1.4), S(2.8), S(1.5)), oscuro, { alto: 1, borde: "oscuro" });
  // Los brazos: hombro, codo y la mano abierta.
  const manos: [number, number, number, number][] =
    o.brazos === "abajo"
      ? [[S(9), -S(20), S(10), -S(13)], [-S(9), -S(20), -S(10), -S(13)]]
      : o.brazos === "uno"
        ? [[S(11), -S(25), S(12), -S(33)], [-S(10), -S(18), -S(6), -S(14)]]
        : [[S(11), -S(25), S(12), -S(34)], [-S(11), -S(25), -S(12), -S(34)]];
  for (const [ex, ey, hx, hy2] of manos) {
    const d = Math.sign(ex);
    p.volumen(capsula(cx + d * S(5), by - S(22), cx + ex, by + ey, S(2.3), S(2)), o.traje, { alto: S(2), borde: "oscuro" });
    p.volumen(capsula(cx + ex, by + ey, cx + hx, by + hy2, S(1.9), S(1.7)), o.piel, { alto: S(2), borde: "oscuro" });
    p.volumen(circulo(cx + hx, by + hy2 - S(0.6), S(2.3)), o.piel, { alto: S(2), borde: "oscuro" });
  }
  // El torso: el traje de dos colores, el cinto y el pectoral dorado.
  p.volumen(caja(cx - S(6), by - S(24), cx + S(6), by - S(12), S(2.6)), o.traje, { alto: S(4), borde: "oscuro", patron: (q) => (q.x < cx ? o.traje : o.traje2) });
  p.volumen(elipse(cx, by - S(13), S(6.4), S(1.5)), ORO, { alto: S(1), brillo: 0.8, borde: "oscuro" });
  if (o.payaso) for (let k = -2; k <= 2; k++) p.volumen(elipse(cx + k * S(2.6), by - S(23), S(2), S(1.8)), rampa("#f4f0e8"), { alto: 1, brillo: 0.4, borde: "oscuro" });
  else p.volumen(elipse(cx, by - S(21.5), S(5), S(2.2)), ORO, { alto: S(1.5), brillo: 0.9, borde: "oscuro" });
  // La cabeza.
  p.volumen(circulo(cx, hy, hr), o.piel, { alto: S(5), brillo: 0.45, borde: "oscuro" });
  if (o.pelo) p.volumen(corteArriba(cx, hy, hr), o.pelo, { alto: S(2), borde: false });
  const ey = hy + S(1);
  if (o.antifaz) p.volumen(union(elipse(cx - S(3.4), ey, S(3.6), S(2.6), 0.2), elipse(cx + S(3.4), ey, S(3.6), S(2.6), -0.2)), o.antifaz, { alto: 1.5, brillo: 0.9, borde: "oscuro" });
  for (const d of [-1, 1]) {
    p.plano(elipse(cx + d * S(3.2), ey, Math.max(1, S(1.2)), Math.max(1.2, S(1.7))), LINEA);
    p.punto(Math.round(cx + d * S(3.2) - 0.5), Math.round(ey - S(0.8)), BRILLO);
    if (!o.antifaz) mejilla(p, cx + d * S(5), ey + S(3), S(1.9), S(1.1), tono(rampa("#ef6ba0"), 3));
  }
  if (o.payaso) p.volumen(circulo(cx, ey + S(2.6), S(1.9)), o.payaso, { alto: 1, brillo: 1, borde: "oscuro" });
  p.curva(cx - S(2.6), ey + S(4), cx, ey + S(6.6), cx + S(2.6), ey + S(4), LINEA, 1);
  if (o.sombrero) {
    p.volumen(elipse(cx, hy - S(6), S(11), S(2.6)), o.sombrero, { alto: S(2), sombra: 0.3, borde: "oscuro" });
    p.volumen(caja(cx - S(5.5), hy - S(13), cx + S(5.5), hy - S(5.5), S(2)), o.sombrero, { alto: S(3), borde: "oscuro" });
    p.plano(caja(cx - S(5.5), hy - S(8), cx + S(5.5), hy - S(6.5)), tono(rampa("#e0283c"), 3));
  } else if (o.plumas.length) p.volumen(caja(cx - S(7), hy - S(8.5), cx + S(7), hy - S(5.5), S(1.2)), ORO, { alto: S(1.2), brillo: 0.9, borde: "oscuro", planos: true });
}

/** El pelo de arriba de la cabeza (el flequillo), como un casquete. */
function corteArriba(cx: number, cy: number, r: number) {
  const c = circulo(cx, cy, r);
  return { ...c, d: (x: number, y: number) => Math.max(c.d(x, y), y - (cy - r * 0.35) - Math.abs(x - cx) * 0.25) };
}

/**
 * La baranda alta del costado: una franja de tela (de `a` a `b`, en px del lienzo, de `alto` px) con
 * festones colgando, el pasamanos dorado arriba y flores sobre él. Sube el costado de la plataforma como
 * en las carrozas de verdad.
 */
export function baranda(p: Pintura, a: { x: number; y: number }, b: { x: number; y: number }, alto: number, telas: readonly Ramp[], fondo: Ramp, oro: Ramp, flores: readonly Ramp[]) {
  const pend = (b.y - a.y) / (b.x - a.x);
  const largo = b.x - a.x;
  const f = poligono([[a.x, a.y], [b.x, b.y], [b.x, b.y - alto], [a.x, a.y - alto]]);
  const pat = festones(telas, fondo, oro, 14);
  p.volumen(f, fondo, {
    alto: 2,
    borde: "oscuro",
    planos: true,
    pinta: (q) => {
      const u = q.x + 0.5 - a.x;
      const v = a.y + pend * u - (q.y + 0.5);
      if (u < 0 || u > largo) return null;
      return pat(u * 1.1, v, alto);
    },
  });
  p.volumen(capsula(a.x, a.y - alto, b.x, b.y - alto, 1.6), oro, { alto: 1.4, brillo: 0.9, borde: "oscuro" });
  const n = Math.round(largo / 7);
  for (let k = 0; k <= n; k++) {
    const x = a.x + (k / n) * largo;
    const y = a.y + pend * (x - a.x) - alto - 1;
    flor(p, x, y, 2.6 + hash(k, 5) * 0.9, flores[k % flores.length]!, AMARILLO_FLOR, k);
    if (k % 2) hoja(p, x + 2, y + 1, -0.4 - hash(k, 2), 6, 3, VERDES[k % 3]!);
  }
}

/** Un tambor (bombo andino): el aro, el cuero de arriba y las cuerdas en zigzag. */
export function tambor(p: Pintura, cx: number, by: number, r: number, h: number, cuerpo: Ramp, aro: Ramp) {
  p.volumen(union(caja(cx - r, by - h, cx + r, by - r * 0.3), elipse(cx, by - r * 0.3, r, r * 0.38)), cuerpo, { alto: r * 0.5, borde: "oscuro", planos: true, sombra: 0.3 });
  for (let k = 0; k < 4; k++) {
    const x0 = cx - r + (k * 2 * r) / 4;
    p.trazo(x0, by - h + 2, x0 + r / 2, by - r * 0.5, tono(rampa("#f4ead8"), 4), 1);
    p.trazo(x0 + r / 2, by - r * 0.5, x0 + r, by - h + 2, tono(rampa("#f4ead8"), 3), 1);
  }
  p.volumen(elipse(cx, by - h, r, r * 0.38), rampa("#f0dcb8"), { alto: 1.5, borde: "oscuro", brillo: 0.4 });
  p.volumen(union(elipse(cx, by - h, r + 0.6, r * 0.38 + 0.6)), aro, { alto: 1, borde: "oscuro", planos: true, pinta: (q) => (Math.hypot((q.x + 0.5 - cx) / r, (q.y + 0.5 - by + h) / (r * 0.38)) < 0.8 ? tono(rampa("#f0dcb8"), 4) : null) });
}
