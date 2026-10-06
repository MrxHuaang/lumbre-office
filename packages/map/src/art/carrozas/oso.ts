// El Oso de anteojos músico (pixel art pintado): el oso andino gigante, sentado, con su pelaje café oscuro
// y los "anteojos" color crema alrededor de los ojos que le bajan hasta el hocico, la sonrisa abierta y la
// vincha tejida con flores y plumas; lleva una ruana de rayas andinas con flecos que tapa el camión y toca
// una guitarra pintada con flores (una garra rasguea, la otra pisa los trastes). Detrás, el monte: hojas
// grandes y plumas; alrededor, los animalitos del monte que bailan con él: el mono que brinca, la
// guacamaya que aletea, el zorro con falda de colores y el coatí con maracas.
// Todo se dibuja de frente a la pantalla en 3/4 (el lado izquierdo con luz, el derecho en sombra), en
// coordenadas de pantalla desde el origen de la carroza.
import type { Ramp, RGBA } from "../pixel";
import { BRILLO, Figura, LINEA, ojo, parpado, pluma } from "./figuras";
import type { CarrozaArte, Parte } from "./partes";
import { ANCHO, escena, ORO, pantalla, parteBase, plataforma } from "./plataforma";
import { capsula, circulo, corte, elipse, Pintura, poligono, rampa, resta, tono, union, type Forma } from "./pintura";

const LARGO = 112;
const PELO = rampa("#5a3a26");
const PELO_OSCURO = rampa("#3e2a20");
const CREMA = rampa("#e8d2a8");
const NARIZ = rampa("#2a2230");
const BOCA = rampa("#7a1d33");
const LENGUA = rampa("#e8708a");
const MADERA = rampa("#eab04a");
const MADERA_OSC = rampa("#8a5a2a");
const ROJO = rampa("#d8283a");
const MAGENTA = rampa("#c8287a");
const MORADO = rampa("#7a3cb8");
const VERDE = rampa("#3db842");
const HOJA = rampa("#2a8a3a");
const AMARILLO = rampa("#f6c81c");
const NARANJA = rampa("#f2861c");
const TURQUESA = rampa("#1fb8b0");
const AZUL = rampa("#2f6fd6");
const BLANCO = rampa("#f2ede2");
const GRIS = rampa("#8a8a96");
const ZORRO = rampa("#d87a2a");
const MONO = rampa("#9a5a30");
/** Los colores de la ruana. */
const RUANA = [MAGENTA, MORADO, VERDE, AMARILLO, NARANJA, TURQUESA];

const OX = 70;
const OY = 230;
const fig = () => new Figura(240, 340, OX, OY, [0, 0, 0]);
const P = (x: number, y: number): [number, number] => [x + OX, y + OY];
const curvaP = (p: Pintura, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, c: RGBA, g = 1) => p.curva(x0 + OX, y0 + OY, cx + OX, cy + OY, x1 + OX, y1 + OY, c, g);
const pol = (...pts: [number, number][]) => poligono(pts.map(([x, y]) => P(x, y)));
const el = (x: number, y: number, rx: number, ry: number, a = 0) => elipse(x + OX, y + OY, rx, ry, a);
const ci = (x: number, y: number, r: number) => circulo(x + OX, y + OY, r);
const cap = (ax: number, ay: number, bx: number, by: number, ra: number, rb = ra) => capsula(ax + OX, ay + OY, bx + OX, by + OY, ra, rb);

const FL = pantalla(0, ANCHO, -10);
const FC = pantalla(LARGO, ANCHO, -10);
const FR = pantalla(LARGO, 0, -10);
const BK = pantalla(0, 0, -10);
/** El centro de la cabeza del oso y el de sus hombros. */
const H = { x: 40, y: -60 };
const S = { x: 40, y: -26 };
/** El cuerpo de la guitarra y hacia dónde va el mástil. */
const G = { x: 26, y: 16 };
const GA = -0.42;

/** Ajusta un color hacia más oscuro (k < 0) o más claro (k > 0). */
function mixTono(c: RGBA, k: number): RGBA {
  const f = k < 0 ? 1 + k * 0.17 : 1 + k * 0.14;
  return [Math.min(255, Math.round(c[0] * f)), Math.min(255, Math.round(c[1] * f)), Math.min(255, Math.round(c[2] * f)), 255];
}

/** El pelaje: mechoncitos claros y oscuros en rayitas (como pelo peinado hacia abajo). */
function pelaje(q: { x: number; y: number }, c: RGBA): RGBA {
  const h = ((q.x * 7 + Math.floor(q.y / 3) * 13) % 11 + 11) % 11;
  if (h === 0) return mixTono(c, -1.3);
  if (h === 5) return mixTono(c, 0.9);
  return c;
}

/** Una flor de cinco pétalos. */
function flor(p: Pintura, x: number, y: number, r: number, petalo: Ramp, centro: Ramp) {
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    p.volumen(el(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, r * 0.62, r * 0.45, a), petalo, { alto: 1.5, brillo: 0.3, borde: "oscuro" });
  }
  p.volumen(ci(x, y, r * 0.42), centro, { alto: 1.2, brillo: 0.8, borde: "oscuro" });
}

/** Una hoja grande del monte (con su vena). */
function hoja(p: Pintura, x: number, y: number, ang: number, largo: number, ancho: number, r: Ramp) {
  const cx = x + Math.cos(ang) * largo * 0.5;
  const cy = y + Math.sin(ang) * largo * 0.5;
  p.volumen(el(cx, cy, largo / 2, ancho / 2, ang), r, { alto: ancho * 0.35, planos: true, borde: "oscuro", sombra: 0.3 });
  curvaP(p, x, y, cx + Math.cos(ang + 1.5) * 1.2, cy + Math.sin(ang + 1.5) * 1.2, x + Math.cos(ang) * largo * 0.92, y + Math.sin(ang) * largo * 0.92, tono(r, 5), 1);
}

/** El monte detrás del oso: hojas grandes en abanico y plumas de colores. */
function monte(p: Pintura) {
  const hojas: [number, number, number, number, Ramp][] = [
    [BK.x + 4, BK.y - 2, -2.1, 40, HOJA],
    [BK.x + 10, BK.y - 4, -1.6, 46, VERDE],
    [BK.x + 22, BK.y - 2, -1.2, 40, HOJA],
    [FR.x - 34, FR.y - 44, -1.9, 44, VERDE],
    [FR.x - 26, FR.y - 42, -1.3, 46, HOJA],
    [FR.x - 18, FR.y - 40, -0.8, 40, VERDE],
    [FR.x - 12, FR.y - 36, -0.75, 30, HOJA],
    [BK.x - 8, BK.y + 6, -2.6, 34, VERDE],
    [BK.x + 30, BK.y - 6, -1.9, 50, VERDE],
    [BK.x + 48, BK.y - 2, -1.1, 50, HOJA],
    [BK.x + 60, BK.y + 4, -0.6, 44, VERDE],
  ];
  for (const [x, y, a, l, r] of hojas) hoja(p, x, y, a, l, 13, r);
  // Plumas de colores entre las hojas.
  pluma(p, FR.x - 30 + OX, FR.y - 46 + OY, -1.5, 34, 8, NARANJA);
  pluma(p, FR.x - 22 + OX, FR.y - 44 + OY, -1.05, 32, 8, AMARILLO);
  pluma(p, FR.x - 14 + OX, FR.y - 40 + OY, -0.6, 28, 7, ROJO);
  pluma(p, BK.x + 16 + OX, BK.y - 2 + OY, -1.4, 30, 7, MORADO);
  for (const [x, y, c] of [
    [BK.x + 2, BK.y - 30, ROJO],
    [FR.x - 30, FR.y - 60, MORADO],
    [FR.x - 6, FR.y - 44, AMARILLO],
  ] as const)
    flor(p, x, y, 4.2, c, AMARILLO);
}

/** La ruana: de los hombros a la cubierta, con rayas andinas en zigzag, rombos y los flecos de colores. */
function ruana(p: Pintura) {
  const forma = union(pol([S.x - 26, S.y - 2], [S.x + 28, S.y - 2], [S.x + 56, S.y + 70], [S.x - 54, S.y + 72]), el(S.x, S.y + 72, 56, 16), el(S.x, S.y + 2, 30, 12));
  p.volumen(forma, MAGENTA, {
    alto: 26,
    planos: true,
    borde: "oscuro",
    sombra: 0.4,
    patron: (q) => {
      const x = q.x - OX;
      const y = q.y - OY;
      const banda = Math.floor((y + Math.abs((((x % 10) + 10) % 10) - 5) * 0.8) / 5);
      return RUANA[((banda % RUANA.length) + RUANA.length) % RUANA.length]!;
    },
    pinta: (q, c) => {
      const x = q.x - OX;
      const y = q.y - OY;
      const v = ((y + Math.abs((((x % 10) + 10) % 10) - 5) * 0.8) % 5 + 5) % 5;
      // La rayita oscura entre banda y banda, y los puntitos tejidos.
      if (v < 0.8) return tono(PELO_OSCURO, 2);
      if (v > 2 && v < 3 && (((x + Math.floor(y / 5) * 2) % 4) + 4) % 4 === 0) return tono(BLANCO, 5);
      // El pliegue: la ruana cae en ondas desde el cuello.
      const ang = Math.atan2(x - S.x, Math.max(1, y - S.y + 20));
      const f = (ang * 5 + 50) % 1;
      if (f > 0.85) return mixTono(c, -1.4);
      if (f < 0.12) return mixTono(c, 0.8);
      return x > S.x + 10 ? mixTono(c, -0.6) : c;
    },
  });
  // Los flecos: hilos de colores que cuelgan del ruedo.
  for (let k = 0; k <= 50; k++) {
    const t = k / 50;
    const a = Math.PI * (1 - t);
    const x = S.x + Math.cos(a) * 55;
    const y = S.y + 72 + Math.sin(a) * 15.5;
    const c = RUANA[k % RUANA.length]!;
    p.trazo(x + OX, y + OY, x + OX + 0.5, y + OY + 5 + (k % 2), tono(c, 3), 1.6);
    p.punto(Math.round(x + OX), Math.round(y + OY + 5 + (k % 2)), tono(c, 1));
  }
  // El cuello de la ruana: un ribete tejido de oro.
  p.volumen(resta(el(S.x, S.y + 1, 18, 7), el(S.x, S.y - 1, 13, 4.5)), AMARILLO, { alto: 2, planos: true, borde: "oscuro", pinta: (q, c) => (q.x % 3 === 0 ? mixTono(c, -1.2) : c) });
}

/** Un brazo peludo del oso (del hombro a la garra), con la garra de uñas crema. */
function brazo(p: Pintura, h: { x: number; y: number }, m: { x: number; y: number }, codo: { x: number; y: number }, lado: -1 | 1) {
  p.volumen(cap(h.x, h.y, codo.x, codo.y, 10, 9), PELO, { alto: 6, planos: true, borde: "oscuro", sombra: 0.35, pinta: pelaje });
  p.volumen(cap(codo.x, codo.y, m.x, m.y, 9, 8), PELO, { alto: 6, planos: true, borde: "oscuro", sombra: 0.35, pinta: pelaje });
  // La garra: la mano redonda y cuatro uñas crema.
  p.volumen(el(m.x, m.y, 8.5, 7.5), PELO_OSCURO, { alto: 4, planos: true, borde: "oscuro", pinta: pelaje });
  for (let k = 0; k < 4; k++) {
    const ux = m.x - 5 + k * 3.4;
    const uy = m.y + 5 + Math.abs(k - 1.5) * -0.6;
    p.volumen(pol([ux - 1.2, uy - 1], [ux + 1.2, uy - 1], [ux + lado * 0.6, uy + 3.6]), CREMA, { alto: 1, brillo: 0.9, planos: true, borde: "oscuro" });
  }
}

/** La guitarra pintada: la caja de madera con flores, la boca con su roseta, el puente, el mástil y el clavijero. */
function guitarra(p: Pintura) {
  const ux = Math.cos(GA);
  const uy = Math.sin(GA);
  const A = (d: number, l = 0) => ({ x: G.x + ux * d - uy * l, y: G.y + uy * d + ux * l });
  const ab = A(-6);
  const ar = A(14);
  const caja = union(el(ab.x, ab.y, 19, 15, GA), el(ar.x, ar.y, 14, 11.5, GA), el(A(4).x, A(4).y, 14, 12, GA));
  // El costado (aro) más oscuro, corrido abajo a la derecha, y la tapa.
  p.volumen({ ...caja, d: (x, y) => caja.d(x - 1.5, y - 2.5), x1: caja.x1 + 2, y1: caja.y1 + 3 }, MADERA_OSC, { alto: 2, planos: true, borde: "oscuro", sombra: 0.4 });
  p.volumen(caja, MADERA, { alto: 5, planos: true, borde: "oscuro", brillo: 0.6 });
  // El mástil con los trastes y el clavijero con las clavijas.
  const m0 = A(24);
  const m1 = A(62);
  p.volumen(cap(m0.x, m0.y, m1.x, m1.y, 3, 2.6), MADERA_OSC, { alto: 2, planos: true, borde: "oscuro", sombra: 0.35 });
  for (let k = 0; k < 6; k++) {
    const q = A(28 + k * 6);
    p.trazo(q.x - uy * 2 + OX, q.y + ux * 2 + OY, q.x + uy * 2 + OX, q.y - ux * 2 + OY, tono(ORO, 4), 1);
  }
  const c0 = A(62);
  const c1 = A(72);
  p.volumen(cap(c0.x, c0.y, c1.x, c1.y, 4, 4.4), MADERA, { alto: 2, planos: true, borde: "oscuro" });
  for (let k = 0; k < 3; k++)
    for (const l of [-1, 1]) {
      const q = A(64 + k * 3.2, l * 5.6);
      p.volumen(ci(q.x, q.y, 1.6), BLANCO, { alto: 1, brillo: 0.9, borde: "oscuro" });
    }
  // La boca con la roseta de colores, el puente y las cuerdas.
  const b = A(6);
  p.volumen(ci(b.x, b.y, 6.4), AMARILLO, { alto: 1, planos: true, borde: "oscuro", pinta: (q, c) => ((Math.floor(Math.atan2(q.y - OY - b.y, q.x - OX - b.x) * 2.5) + 10) % 2 ? tono(ROJO, 3) : c) });
  p.plano(ci(b.x, b.y, 4.4), tono(NARIZ, 1));
  const pu = A(-12);
  p.volumen(cap(pu.x - uy * 5, pu.y + ux * 5, pu.x + uy * 5, pu.y - ux * 5, 1.6), MADERA_OSC, { alto: 1, borde: "oscuro" });
  for (const l of [-1.5, -0.5, 0.5, 1.5]) {
    const a = A(-12, l * 1.3);
    const z = A(62, l * 1.1);
    if (l === -1.5 || l === 0.5) p.trazo(a.x + OX, a.y + OY, z.x + OX, z.y + OY, tono(BLANCO, 4), 1);
  }
  // Las flores pintadas en la tapa.
  flor(p, A(-8, 9).x, A(-8, 9).y, 3.6, ROJO, AMARILLO);
  flor(p, A(-10, -8).x, A(-10, -8).y, 3.2, AZUL, AMARILLO);
  flor(p, A(16, 6).x, A(16, 6).y, 2.8, MAGENTA, AMARILLO);
  flor(p, A(-2, -11).x, A(-2, -11).y, 2.4, AMARILLO, ROJO);
}

/** El cuerpo: la ruana, el brazo que pisa los trastes y la guitarra (el que rasguea va aparte). */
function cuerpo(p: Pintura) {
  // Las patas que asoman debajo de la ruana, con las plantas crema.
  for (const [x, l] of [
    [S.x - 30, -1],
    [S.x + 34, 1],
  ] as const) {
    p.volumen(el(x, S.y + 84, 11, 7, l * 0.2), PELO_OSCURO, { alto: 4, planos: true, borde: "oscuro", pinta: pelaje });
    p.volumen(el(x - l * 1, S.y + 84, 5, 3.6), CREMA, { alto: 1, borde: "oscuro" });
  }
  ruana(p);
  // El brazo de la derecha (en pantalla) baja a pisar el mástil.
  guitarra(p);
  const ux = Math.cos(GA);
  const uy = Math.sin(GA);
  brazo(p, { x: S.x + 26, y: S.y + 4 }, { x: G.x + ux * 50, y: G.y + uy * 50 - 2 }, { x: S.x + 36, y: S.y + 20 }, 1);
}

/** Los ojos del oso (centro y lado). */
const OJOS = [
  [H.x - 9, H.y - 4, -1],
  [H.x + 9, H.y - 4, 1],
] as const;

/** La cabeza: orejas, pelaje, los anteojos crema, los ojos, el hocico con la nariz y la sonrisa, y la vincha. */
function cabeza(p: Pintura) {
  const { x, y } = H;
  for (const l of [-1, 1]) {
    p.volumen(ci(x + l * 21, y - 19, 8.5), PELO, { alto: 4, planos: true, borde: "oscuro", sombra: 0.35, pinta: pelaje });
    p.volumen(ci(x + l * 21, y - 18.5, 4.6), CREMA, { alto: 2, base: -0.6, borde: false });
  }
  // La cabeza ancha, con las mejillas peludas.
  const cab = union(el(x, y - 2, 25, 22), el(x, y + 10, 22, 14));
  p.volumen(cab, PELO, { alto: 16, planos: true, borde: "oscuro", sombra: 0.35, pinta: pelaje });
  // Los "anteojos": las marcas crema que rodean los ojos y bajan por el hocico.
  const marcas = union(
    resta(el(x - 9, y - 4, 9, 8), el(x - 9, y - 3, 5.6, 5.2)),
    resta(el(x + 9, y - 4, 9, 8), el(x + 9, y - 3, 5.6, 5.2)),
    cap(x - 3, y + 2, x - 6, y + 10, 2.6),
    cap(x + 3, y + 2, x + 6, y + 10, 2.6),
  );
  p.volumen(marcas, CREMA, { alto: 2, planos: true, borde: false, base: 0.4 });
  for (const [cx, cy, l] of OJOS) {
    const [ex, ey] = P(cx, cy);
    ojo(p, ex, ey, 9, 3.6, 3.2, l, { iris: rampa("#9a5a2a"), pestanas: 0, mira: 0.4 });
  }
  // El hocico crema, la nariz grande y negra con su brillo.
  p.volumen(el(x, y + 12, 14, 10), CREMA, { alto: 6, planos: true, borde: "oscuro", sombra: 0.35 });
  p.volumen(el(x, y + 6, 6, 4.2), NARIZ, { alto: 3, brillo: 1, planos: true, borde: "oscuro" });
  p.punto(Math.round(x - 2 + OX), Math.round(y + 4 + OY), BRILLO);
  p.trazo(x + OX, y + 9 + OY, x + OX, y + 12 + OY, tono(NARIZ, 1), 1);
  // La sonrisa abierta: la boca, la lengua y los dientitos de arriba.
  const boca = corte(el(x, y + 13, 9, 7), el(x, y + 20, 13, 8));
  p.volumen(boca, BOCA, { alto: 2, base: -0.6, borde: "oscuro" });
  p.volumen(corte(el(x + 1, y + 20, 6, 3.4), boca), LENGUA, { alto: 2, brillo: 0.8, borde: false });
  for (const l of [-1, 1]) p.plano(el(x + l * 4, y + 13.4, 1.6, 1.2), tono(BLANCO, 5));
  curvaP(p, x - 10, y + 12, x - 11, y + 14, x - 9, y + 15, tono(PELO_OSCURO, 1), 1);
  curvaP(p, x + 10, y + 12, x + 11, y + 14, x + 9, y + 15, tono(PELO_OSCURO, 1), 1);
  // La vincha tejida, con flores y un penachito de plumas.
  const vincha = corte(resta(el(x, y + 2, 27, 26), el(x, y + 6, 27, 25)), el(x, y - 20, 30, 10));
  p.volumen(vincha, TURQUESA, { alto: 2, planos: true, borde: "oscuro", patron: (q) => (Math.floor((q.x - OX) / 4) % 2 ? ROJO : TURQUESA), pinta: (q, c) => ((q.x + q.y) % 4 === 0 ? tono(AMARILLO, 5) : c) });
  pluma(p, x + 4 + OX, y - 24 + OY, -1.25, 22, 7, VERDE);
  pluma(p, x + 8 + OX, y - 23 + OY, -0.85, 22, 7, NARANJA);
  pluma(p, x + 12 + OX, y - 22 + OY, -0.45, 20, 7, MORADO);
  flor(p, x - 14, y - 19, 4.4, AMARILLO, ROJO);
  flor(p, x + 3, y - 24, 4, ROJO, AMARILLO);
}

/** Un animalito del monte parado, bailando con los brazos arriba (el mono, el zorro y el coatí). */
function animalito(
  p: Pintura,
  x: number,
  y: number,
  s: number,
  o: { pelo: Ramp; panza: Ramp; orejas: "redondas" | "puntas"; cola: "larga" | "zorro" | "rayas"; antifaz?: boolean; falda?: Ramp; lleva?: Ramp },
) {
  const S2 = (v: number) => v * s;
  // La cola detrás.
  if (o.cola === "larga") p.volumen(cap(x + S2(4), y - S2(6), x + S2(16), y - S2(20), S2(1.8), S2(1.2)), o.pelo, { alto: 1.5, planos: true, borde: "oscuro" });
  else
    for (let k = 0; k < 5; k++) {
      const t = k / 4;
      p.volumen(ci(x + S2(6 + t * 9), y - S2(6 + t * 10), S2(3.2 - t * 0.6)), o.cola === "rayas" ? (k % 2 ? PELO_OSCURO : o.pelo) : k === 4 ? BLANCO : o.pelo, { alto: 1.5, planos: true, borde: "oscuro" });
    }
  // Las piernas, el cuerpo y la panza (o la falda).
  for (const l of [-1, 1]) p.volumen(cap(x + l * S2(3.4), y - S2(9), x + l * S2(4.6), y - S2(1), S2(2.2)), o.pelo, { alto: 1.5, planos: true, borde: "oscuro" });
  p.volumen(el(x, y - S2(15), S2(7), S2(9)), o.pelo, { alto: S2(4), planos: true, borde: "oscuro", sombra: 0.3 });
  p.volumen(el(x, y - S2(14), S2(4.4), S2(6.4)), o.panza, { alto: S2(2), planos: true, borde: false });
  if (o.falda) p.volumen(pol([x - S2(5), y - S2(12)], [x + S2(5), y - S2(12)], [x + S2(9), y - S2(5)], [x - S2(9), y - S2(5)]), o.falda, { alto: S2(2), planos: true, borde: "oscuro", patron: (q) => (Math.floor((q.x - OX) / 2) % 2 ? o.falda! : AMARILLO) });
  // Los brazos arriba, bailando (o con maracas).
  for (const l of [-1, 1]) {
    p.volumen(cap(x + l * S2(5), y - S2(20), x + l * S2(11), y - S2(29), S2(1.9)), o.pelo, { alto: 1.5, planos: true, borde: "oscuro" });
    if (o.lleva) {
      p.volumen(ci(x + l * S2(12), y - S2(33), S2(3)), o.lleva, { alto: 1.5, brillo: 0.9, planos: true, borde: "oscuro" });
      p.volumen(cap(x + l * S2(11.5), y - S2(30), x + l * S2(11), y - S2(28), S2(0.9)), MADERA_OSC, { alto: 1, borde: "oscuro" });
    }
  }
  // La cabeza, las orejas, la cara clara, el antifaz, los ojos, la nariz y la sonrisa.
  const hx = x;
  const hy = y - S2(29);
  for (const l of [-1, 1]) {
    if (o.orejas === "redondas") p.volumen(ci(hx + l * S2(6.5), hy - S2(3), S2(3)), o.pelo, { alto: 1.5, planos: true, borde: "oscuro" });
    else p.volumen(pol([hx + l * S2(2.5), hy - S2(5)], [hx + l * S2(8), hy - S2(14)], [hx + l * S2(7.5), hy - S2(2)]), o.pelo, { alto: 1.5, planos: true, borde: "oscuro" });
  }
  p.volumen(el(hx, hy, S2(7.4), S2(6.6)), o.pelo, { alto: S2(3.4), planos: true, borde: "oscuro", sombra: 0.3 });
  p.volumen(el(hx, hy + S2(2), S2(5.4), S2(4)), o.panza, { alto: S2(2), planos: true, borde: false });
  if (o.antifaz) p.plano(el(hx, hy - S2(1), S2(6.4), S2(2.2)), tono(PELO_OSCURO, 1));
  for (const l of [-1, 1]) {
    p.plano(el(hx + l * S2(2.6), hy - S2(1), Math.max(0.9, S2(1)), Math.max(1, S2(1.3))), LINEA);
    p.punto(Math.round(hx + l * S2(2.6) - 0.4 + OX), Math.round(hy - S2(1.6) + OY), BRILLO);
  }
  p.plano(el(hx, hy + S2(1.6), S2(1.3), S2(0.9)), tono(NARIZ, 1));
  curvaP(p, hx - S2(2.4), hy + S2(3), hx, hy + S2(5.4), hx + S2(2.4), hy + S2(3), tono(BOCA, 1), 1);
}

/** La guacamaya amarilla y verde (el ala va aparte, para que aletee). */
function guacamaya(p: Pintura, x: number, y: number) {
  // La cola larga, roja y azul.
  pluma(p, x + 2 + OX, y + 4 + OY, 2.0, 22, 5, ROJO);
  pluma(p, x + 4 + OX, y + 4 + OY, 1.7, 20, 5, AZUL);
  p.volumen(el(x, y - 4, 7, 9.5, 0.3), AMARILLO, { alto: 4, planos: true, borde: "oscuro", sombra: 0.3, patron: (q) => (q.y - OY > y - 2 ? VERDE : AMARILLO) });
  p.volumen(ci(x - 3, y - 15, 6), VERDE, { alto: 3, planos: true, borde: "oscuro" });
  p.volumen(el(x - 4, y - 15, 3.4, 2.6), BLANCO, { alto: 1, borde: false });
  p.plano(ci(x - 4, y - 15.5, 1.1), LINEA);
  p.volumen(pol([x - 8, y - 16], [x - 14, y - 12], [x - 8, y - 11]), rampa("#3a3440"), { alto: 1.5, brillo: 0.8, borde: "oscuro" });
  // Las patas en la rama.
  p.volumen(cap(x - 10, y + 6, x + 12, y + 6, 1.8), MADERA_OSC, { alto: 1, borde: "oscuro" });
}

/** Un ala de la guacamaya (verde, azul y roja en la punta). */
function alaGuacamaya(p: Pintura, x: number, y: number) {
  for (const [a, c, l] of [
    [-0.6, ROJO, 18],
    [-0.35, AZUL, 17],
    [-0.1, VERDE, 15],
  ] as const)
    pluma(p, x + OX, y + OY, a, l, 6, c);
}

/** El faldón: rojo con guirnaldas de verde y oro y rosetas. */
function guirnaldas(u: number, v: number, alto: number): RGBA {
  const cell = 10;
  const fu = (((u % cell) + cell) % cell) / cell;
  const arco = alto - 2 - Math.sin(fu * Math.PI) * 4.4;
  if (v > alto - 1.4) return tono(ROJO, 2);
  if (Math.abs(v - arco) < 0.8) return tono(VERDE, 4);
  if (Math.abs(v - arco + 1.4) < 0.6) return tono(ORO, 4);
  const r = Math.hypot((fu < 0.5 ? fu : 1 - fu) * cell, v - (alto - 2.2));
  if (r < 1.6) return tono(AMARILLO, 4);
  if (Math.abs(v - 2.4) < 0.6) return tono(ORO, 3);
  return tono(TURQUESA, 2 + (v < 2.4 ? 0 : 0.6));
}

export function oso(): CarrozaArte {
  const s = escena(LARGO, 20);
  plataforma(s, LARGO, { faldon: guirnaldas, cubierta: (u, v) => tono(HOJA, 3 + ((Math.floor(u / 4) + Math.floor(v / 4)) % 2 ? 0.4 : -0.2)), flecos: [ROJO, AMARILLO, VERDE, MAGENTA] }, false);
  const f = fig();
  const partes: Parte[] = [parteBase(s)];

  // Atrás: el monte, el mono que brinca y la guacamaya que aletea.
  const mon = f.lienzo();
  monte(mon);
  partes.push(f.parte("monte", mon, ...P(40, 10), { mov: { gira: { amp: 0.012, periodo: 4200 } } }));
  const mono = f.lienzo();
  const mp = { x: BK.x - 14, y: BK.y - 18 };
  animalito(mono, mp.x, mp.y, 1, { pelo: MONO, panza: CREMA, orejas: "redondas", cola: "larga" });
  pluma(mono, mp.x + 2 + OX, mp.y - 34 + OY, -1.3, 10, 4, MAGENTA);
  pluma(mono, mp.x + 3 + OX, mp.y - 34 + OY, -0.9, 9, 4, TURQUESA);
  partes.push(f.parte("mono", mono, ...P(mp.x, mp.y), { mov: { gira: { amp: 0.14, periodo: 900 }, vaiven: { dy: -3, periodo: 450 } } }));
  const gp = { x: FR.x - 12, y: FR.y - 70 };
  const gua = f.lienzo();
  guacamaya(gua, gp.x, gp.y);
  partes.push(f.parte("guacamaya", gua, ...P(gp.x, gp.y + 6), { mov: { gira: { amp: 0.05, periodo: 2000 } } }));
  const ala = f.lienzo();
  alaGuacamaya(ala, gp.x + 2, gp.y - 6);
  partes.push(f.parte("ala", ala, ...P(gp.x + 2, gp.y - 6), { padre: "guacamaya", mov: { gira: { amp: 0.35, periodo: 520, centro: -0.2 } } }));

  // El oso: el cuerpo con la ruana y la guitarra, la cabeza que lleva el compás y el brazo que rasguea.
  const cue = f.lienzo();
  cuerpo(cue);
  partes.push(f.parte("cuerpo", cue, ...P(S.x, S.y + 80), { mov: { gira: { amp: 0.008, periodo: 1800 } } }));
  const cab = f.lienzo();
  cabeza(cab);
  partes.push(f.parte("cabeza", cab, ...P(H.x, H.y + 22), { padre: "cuerpo", mov: { gira: { amp: 0.07, periodo: 1800, fase: 0.25 } } }));
  const parp = f.lienzo();
  for (const [cx, cy, l] of OJOS) {
    const [ex, ey] = P(cx, cy);
    parpado(parp, ex, ey, 9, 3.6, 3.2, l, CREMA);
  }
  partes.push(f.parte("parpados", parp, ...P(H.x, H.y + 22), { padre: "cabeza", contorno: false, mov: { parpadeo: { cada: 3700, dura: 220 } } }));
  const ras = f.lienzo();
  const hombro = { x: S.x - 24, y: S.y + 4 };
  brazo(ras, hombro, { x: G.x - 4, y: G.y + 16 }, { x: S.x - 46, y: S.y + 30 }, -1);
  partes.push(f.parte("rasgueo", ras, ...P(hombro.x, hombro.y), { padre: "cuerpo", mov: { gira: { amp: 0.06, periodo: 450 } } }));

  // Adelante: el coatí con maracas, el zorro con falda y matas de flores.
  const coa = f.lienzo();
  const cp = { x: FL.x + 16, y: FL.y - 6 };
  animalito(coa, cp.x, cp.y, 0.95, { pelo: GRIS, panza: BLANCO, orejas: "redondas", cola: "rayas", antifaz: true, lleva: AMARILLO });
  partes.push(f.parte("coati", coa, ...P(cp.x, cp.y), { mov: { gira: { amp: 0.1, periodo: 760 }, vaiven: { dy: -1.5, periodo: 380 } } }));
  const zor = f.lienzo();
  const zp = { x: FC.x + 14, y: FC.y - 16 };
  animalito(zor, zp.x, zp.y, 1, { pelo: ZORRO, panza: BLANCO, orejas: "puntas", cola: "zorro", falda: MAGENTA });
  partes.push(f.parte("zorro", zor, ...P(zp.x, zp.y), { mov: { gira: { amp: 0.12, periodo: 1000, fase: 0.5 }, vaiven: { dy: -2, periodo: 500, fase: 0.5 } } }));
  const mat = f.lienzo();
  for (const [t, c] of [
    [0.16, AMARILLO],
    [0.32, ROJO],
    [0.56, MORADO],
    [0.78, NARANJA],
  ] as const) {
    const q = { x: FL.x + (FC.x - FL.x) * t, y: FL.y - 9 + (FC.y - FL.y) * t };
    for (let i = 0; i < 4; i++) hoja(mat, q.x - 6 + i * 4, q.y + 1, -Math.PI / 2 + (i - 1.5) * 0.6, 9, 5, i % 2 ? HOJA : VERDE);
    flor(mat, q.x - 2, q.y - 4, 3.8, c, AMARILLO);
    flor(mat, q.x + 5, q.y - 1, 3, AMARILLO, ROJO);
  }
  partes.push(f.parte("matas", mat, ...P(FC.x, FC.y)));
  void [ORO];
  return { largo: LARGO, partes, luces: [], marco: { x0: -ANCHO - 40, x1: LARGO + 40 } };
}

export type { Forma };
