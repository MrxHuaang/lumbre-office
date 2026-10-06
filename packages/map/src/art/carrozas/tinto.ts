// El tinto de Doña Aurora (pixel art pintado): Doña Aurora gigante, la abuela de la cabaña, con el moño
// blanco lleno de plumas y flores, las gafitas redondas, los aretes de oro y la risa de oreja a oreja. Con
// una mano levanta la greca de aluminio que echa vapor y sirve el chorro de tinto en la taza enorme de
// florecitas que tiene en la otra. Lleva el pañolón morado de flecos, el delantal blanco de encaje y la
// falda de franjas. A sus pies, la tierra llena de granos de café, los tamboreros, las parejas que bailan
// con sus pocillos y, en la esquina de adelante, la máscara del carnaval que se ríe entre plumas.
// Todo de frente a la pantalla en 3/4 (la luz de arriba a la izquierda), en coordenadas de pantalla desde
// el origen de la carroza.
import type { Ramp, RGBA } from "../pixel";
import { abanico, BRILLO, ceja, cuentas, Figura, LINEA, mejilla, ojo, parpado, sonrisa } from "./figuras";
import type { CarrozaArte, Parte } from "./partes";
import { ANCHO, escena, ORO, pantalla, parteBase, plataforma } from "./plataforma";
import { capsula, circulo, corte, elipse, Pintura, poligono, rampa, resta, tono, union, type Forma } from "./pintura";

const LARGO = 104;
const PIEL = rampa("#c98a5a");
const CANAS = rampa("#ecebf2");
const PANOLON = rampa("#7a2ab8");
const MAGENTA = rampa("#d0287a");
const TURQUESA = rampa("#1fa8c0");
const NARANJA = rampa("#f2861c");
const AMARILLO = rampa("#f6c81c");
const VERDE = rampa("#3db842");
const ROJO = rampa("#d8283a");
const AZUL = rampa("#2f6fd6");
const BLANCO = rampa("#f4f0e6");
const ALUMINIO = rampa("#b8c0cc");
const CAFE = rampa("#6a3a1e");
const TINTO = rampa("#5a2e14");
const TIERRA = rampa("#8a5a32");
const GRANO = rampa("#4a2614");
const LOZA = rampa("#f6f2e8");
const NEGRO = rampa("#2e2a36");
const PAJA = rampa("#d0a24a");
const MADERA = rampa("#a86a3a");
const MASCARA = rampa("#e0b070");
const PIELES = [rampa("#c98a5a"), rampa("#a86a3a"), rampa("#e0a878"), rampa("#8a5a3a")];
const FALDA: readonly Ramp[] = [PANOLON, MAGENTA, TURQUESA, NARANJA, VERDE, AMARILLO];

const OX = 90;
const OY = 230;
const fig = () => new Figura(270, 340, OX, OY, [0, 0, 0]);
const P = (x: number, y: number): [number, number] => [x + OX, y + OY];
const curvaP = (p: Pintura, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, c: RGBA, g = 1) => p.curva(x0 + OX, y0 + OY, cx + OX, cy + OY, x1 + OX, y1 + OY, c, g);
const pol = (...pts: [number, number][]) => poligono(pts.map(([x, y]) => P(x, y)));
const el = (x: number, y: number, rx: number, ry: number, a = 0) => elipse(x + OX, y + OY, rx, ry, a);
const ci = (x: number, y: number, r: number) => circulo(x + OX, y + OY, r);
const cap = (ax: number, ay: number, bx: number, by: number, ra: number, rb = ra) => capsula(ax + OX, ay + OY, bx + OX, by + OY, ra, rb);
const pt = (p: Pintura, x: number, y: number, c: RGBA) => p.punto(Math.round(x + OX), Math.round(y + OY), c);

const TL = pantalla(0, ANCHO, 0);
const TC = pantalla(LARGO, ANCHO, 0);
const TR = pantalla(LARGO, 0, 0);
/** La cara de Doña Aurora. */
const A = { x: 40, y: -84 };
/** La greca (el centro de la olla). */
const G = { x: -16, y: -110 };
/** La boca de la taza grande. */
const C = { x: 14, y: -34 };
/** La punta del pico de la greca. */
const PICO = { x: 6, y: -98 };

/** Una flor de cinco pétalos redondos. */
function flor(p: Pintura, x: number, y: number, r: number, petalo: Ramp, centro: Ramp = AMARILLO) {
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    p.volumen(el(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, r * 0.62, r * 0.45, a), petalo, { alto: 1.5, brillo: 0.3, borde: "oscuro" });
  }
  p.volumen(ci(x, y, r * 0.42), centro, { alto: 1.2, brillo: 0.8, borde: "oscuro" });
}

/** Un grano de café: el óvalo tostado con su rayita. */
function grano(p: Pintura, x: number, y: number, r: number, a: number) {
  p.volumen(el(x, y, r, r * 0.7, a), GRANO, { alto: 1.2, planos: true, brillo: 0.7, borde: "oscuro" });
  p.trazo(x - Math.cos(a) * r * 0.6 + OX, y - Math.sin(a) * r * 0.6 + OY, x + Math.cos(a) * r * 0.6 + OX, y + Math.sin(a) * r * 0.6 + OY, tono(GRANO, 0), 1);
}

/** Un pocillo de loza con florecitas y tinto adentro (boca en x, y; `r` el radio de la boca). */
function pocillo(p: Pintura, x: number, y: number, r: number, oreja: 1 | -1 = -1) {
  p.volumen(resta(el(x + oreja * r * 1.05, y + r * 0.55, r * 0.42, r * 0.4), el(x + oreja * r * 1.05, y + r * 0.55, r * 0.2, r * 0.18)), LOZA, { alto: 1.5, planos: true, borde: "oscuro" });
  const cuerpo = union(corte(el(x, y, r, r * 0.85), pol([x - r - 1, y], [x + r + 1, y], [x + r + 1, y + r], [x - r - 1, y + r])), el(x, y, r, r * 0.3));
  p.volumen(cuerpo, LOZA, {
    alto: r * 0.5,
    planos: true,
    borde: "oscuro",
    sombra: 0.35,
    // Las florecitas pintadas: azules y naranjas en una franja.
    pinta: (q, c) => {
      const dx = q.x + 0.5 - OX - x;
      const dy = q.y + 0.5 - OY - y;
      if (dy < r * 0.25 || dy > r * 0.65) return c;
      const k = Math.floor((dx + r * 2) / (r * 0.55));
      const fu = ((dx + r * 2) % (r * 0.55)) - r * 0.27;
      const fv = dy - r * 0.45;
      return Math.hypot(fu, fv) < r * 0.16 ? tono(k % 2 ? AZUL : NARANJA, 3) : c;
    },
  });
  p.volumen(el(x, y, r * 0.86, r * 0.22), TINTO, { alto: 1, base: -0.5, borde: false });
}

/** La tierra de café que tapa la cubierta, con granos, los pocillos de las esquinas y unas matas de flores. */
function suelo(p: Pintura) {
  const tierra = pol([TL.x - 2, TL.y - 4], [0, -2], [TR.x + 2, TR.y - 4], [TR.x + 2, TR.y + 2], [TC.x, TC.y + 2], [TL.x - 2, TL.y + 2]);
  p.volumen(tierra, TIERRA, { alto: 4, planos: true, borde: "oscuro", pinta: (q, c) => ((q.x * 7 + q.y * 3) % 13 === 0 ? tono(TIERRA, 1) : c) });
  // Los granos regados y el montón de adelante.
  for (let k = 0; k < 70; k++) {
    const u = (k * 0.618) % 1;
    const v = (k * 0.381 + 0.13) % 1;
    const q = pantalla(6 + u * (LARGO - 12), 4 + v * (ANCHO - 8), 0);
    grano(p, q.x, q.y, 1.9, k * 1.7);
  }
  for (let k = 0; k < 22; k++) {
    const a = k * 2.4;
    const r = Math.sqrt(k) * 2.4;
    grano(p, 30 + Math.cos(a) * r * 1.6, 58 + Math.sin(a) * r * 0.7 - (8 - r) * 0.6, 2.2, a);
  }
  // Las matas de flores de las esquinas.
  for (const [x, y, c] of [
    [-34, 12, NARANJA],
    [-28, 18, MAGENTA],
    [-38, 20, PANOLON],
    [94, 30, MAGENTA],
    [100, 40, NARANJA],
    [6, 50, PANOLON],
    [12, 54, NARANJA],
  ] as const) {
    p.volumen(el(x - 3, y + 2, 4, 1.6, -0.5), VERDE, { alto: 1, borde: "oscuro" });
    p.volumen(el(x + 3, y + 2, 4, 1.6, 0.5), VERDE, { alto: 1, borde: "oscuro" });
    flor(p, x, y - 1, 3.6, c);
  }
  pocillo(p, -30, 2, 8, -1);
  pocillo(p, 100, 18, 8, 1);
}

/** Un tamborero (atrás): la camisa blanca, el pañuelo rojo, el sombrero y el bombo que toca. */
function tamborero(f: Figura, id: string, x: number, y: number, k: number): Parte {
  const p = f.lienzo();
  bailador(p, x, y, 0.85, { piel: PIELES[k % 4]!, camisa: BLANCO, pantalon: NEGRO, sombrero: PAJA, brazo: "mazo" });
  // El bombo: la caja de madera con su parche y los aros rojos.
  const bx = x + 4;
  const by = y - 16;
  p.volumen(union(caja(bx - 8, by - 6, bx + 8, by + 6), el(bx, by + 6, 8, 3)), MADERA, { alto: 4, planos: true, borde: "oscuro", sombra: 0.35, pinta: (q, c) => (Math.abs(q.y + 0.5 - OY - by) < 0.7 ? tono(ROJO, 3) : c) });
  p.volumen(el(bx, by - 6, 8, 3), LOZA, { alto: 1.5, planos: true, borde: "oscuro" });
  for (let j = -1; j <= 1; j++) p.trazo(bx - 7 + OX, by - 4 + j * 3 + OY, bx + 7 + OX, by - 4 - j * 3 + OY, tono(ROJO, 2), 1);
  const [cx, cy] = P(x, y);
  return f.parte(id, p, cx, cy, { mov: { vaiven: { dy: -1.2, periodo: 520, fase: k * 0.5 }, gira: { amp: 0.04, periodo: 1040, fase: k * 0.5 } } });
}
const caja = (x0: number, y0: number, x1: number, y1: number) => pol([x0, y0], [x1, y0], [x1, y1], [x0, y1]);

interface BailadorOpts {
  piel: Ramp;
  camisa: Ramp;
  /** La falda de franjas (para ellas) o el pantalón. */
  falda?: readonly Ramp[];
  pantalon?: Ramp;
  sombrero?: Ramp;
  /** Flores en el pelo en vez de sombrero. */
  flores?: Ramp;
  /** Lo que hace el brazo de la derecha. */
  brazo?: "arriba" | "pocillo" | "mazo" | "flores";
}

/** Un bailador chico de la comparsa (unos 44 px a escala 1), parado con los pies en (x, y). */
function bailador(p: Pintura, x: number, y: number, s: number, o: BailadorOpts) {
  const S = (v: number) => v * s;
  // Las piernas o la falda de franjas con vuelo.
  if (o.falda) {
    const falda = pol([x - S(5), y - S(22)], [x + S(5), y - S(22)], [x + S(12), y - S(3)], [x - S(12), y - S(3)]);
    p.volumen(falda, o.falda[0]!, {
      alto: S(4),
      planos: true,
      borde: "oscuro",
      patron: (q) => o.falda![Math.floor((q.y + 0.5 - OY - (y - S(22))) / S(3.4)) % o.falda!.length]!,
      pinta: (q, c) => (Math.abs(((q.y + 0.5 - OY - (y - S(22))) % S(3.4)) - S(0.3)) < 0.5 ? tono(AMARILLO, 5) : c),
    });
    for (const d of [-1, 1]) p.volumen(el(x + d * S(4), y - S(1.5), S(2.4), S(1.4)), NEGRO, { alto: 1, borde: "oscuro" });
  } else {
    for (const d of [-1, 1]) p.volumen(cap(x + d * S(3.5), y - S(17), x + d * S(5), y - S(2), S(2.6)), o.pantalon ?? NEGRO, { alto: S(2), planos: true, borde: "oscuro" });
    p.volumen(caja(x - S(6.5), y - S(19), x + S(6.5), y - S(16)), ROJO, { alto: 1, planos: true, borde: "oscuro" });
  }
  // El torso de la camisa y el pañuelo rojo al cuello.
  p.volumen(union(caja(x - S(6), y - S(32), x + S(6), y - S(18)), el(x, y - S(31), S(7.5), S(3.5))), o.camisa, { alto: S(3), planos: true, borde: "oscuro" });
  p.volumen(pol([x - S(4), y - S(33)], [x + S(4), y - S(33)], [x, y - S(27)]), ROJO, { alto: 1.4, planos: true, borde: "oscuro" });
  // Los brazos: el de la izquierda en jarra, el de la derecha según lo que haga.
  p.volumen(cap(x - S(6), y - S(30), x - S(10), y - S(22), S(2.2)), o.camisa, { alto: S(1.5), planos: true, borde: "oscuro" });
  p.volumen(ci(x - S(9), y - S(21), S(2)), o.piel, { alto: 1, borde: "oscuro" });
  const br = o.brazo ?? "arriba";
  const mano = br === "arriba" ? { x: x + S(12), y: y - S(44) } : br === "mazo" ? { x: x + S(11), y: y - S(30) } : { x: x + S(11), y: y - S(34) };
  p.volumen(cap(x + S(6), y - S(30), mano.x, mano.y + S(2), S(2.2)), o.camisa, { alto: S(1.5), planos: true, borde: "oscuro" });
  p.volumen(ci(mano.x, mano.y, S(2.2)), o.piel, { alto: 1, borde: "oscuro" });
  if (br === "pocillo") pocillo(p, mano.x + S(1), mano.y - S(3), S(4.5), 1);
  if (br === "mazo") {
    p.volumen(cap(mano.x, mano.y, mano.x - S(6), mano.y + S(8), S(0.9)), MADERA, { alto: 1, borde: "oscuro" });
    p.volumen(ci(mano.x - S(6.5), mano.y + S(8.5), S(2)), LOZA, { alto: 1, borde: "oscuro" });
  }
  if (br === "flores") for (const [dx, dy, c] of [[0, -4, MAGENTA], [-3, -6, AMARILLO], [3, -6, NARANJA]] as const) flor(p, mano.x + S(dx), mano.y + S(dy), S(2.4), c);
  // La cabeza con su cara contenta.
  const hy = y - S(40);
  p.volumen(el(x, hy - S(1), S(7.5), S(7)), NEGRO, { alto: S(3), planos: true, borde: "oscuro" });
  p.volumen(ci(x, hy, S(6.5)), o.piel, { alto: S(4), planos: true, brillo: 0.5, borde: "oscuro" });
  for (const d of [-1, 1]) {
    p.plano(el(x + d * S(2.5), hy, S(0.9), S(1.3)), LINEA);
    pt(p, x + d * S(2.5) - 0.4, hy - S(0.6), BRILLO);
    mejilla(p, x + d * S(4) + OX, hy + S(2.4) + OY, S(1.5), S(1), tono(rampa("#ef6ba0"), 3));
  }
  p.volumen(el(x, hy + S(3), S(2.4), S(1.4)), rampa("#7a1d33"), { alto: 1, borde: false });
  if (o.sombrero) {
    p.volumen(el(x, hy - S(5), S(11), S(2.6)), o.sombrero, { alto: S(2), planos: true, borde: "oscuro", sombra: 0.3 });
    p.volumen(caja(x - S(5), hy - S(11), x + S(5), hy - S(4.5)), o.sombrero, { alto: S(2), planos: true, borde: "oscuro" });
    p.plano(caja(x - S(5), hy - S(7), x + S(5), hy - S(5.5)), tono(NEGRO, 2));
  }
  if (o.flores) {
    flor(p, x - S(5), hy - S(5), S(2.6), o.flores);
    flor(p, x + S(1), hy - S(7), S(2.2), AMARILLO, ROJO);
  }
}

/** Un bailador de adelante como parte (con su vaivén). */
function pareja(f: Figura, id: string, x: number, y: number, k: number, o: BailadorOpts): Parte {
  const p = f.lienzo();
  bailador(p, x, y, 0.95, o);
  const [cx, cy] = P(x, y);
  return f.parte(id, p, cx, cy, { mov: { gira: { amp: 0.08, periodo: 1300 + k * 140, fase: k * 0.27 }, vaiven: { dy: -1.8, periodo: 650, fase: k * 0.27 } } });
}

/** El cuerpo de Doña Aurora: la falda de franjas, el delantal de encaje, la blusa y el pañolón de flecos. */
function cuerpo(p: Pintura) {
  const { x } = A;
  // La falda de franjas con vuelo, sobre la tierra.
  const falda = union(pol([x - 24, -24], [x + 24, -24], [x + 52, 24], [x - 52, 24]), el(x, 24, 52, 12));
  p.volumen(falda, PANOLON, {
    alto: 18,
    planos: true,
    borde: "oscuro",
    sombra: 0.35,
    patron: (q) => {
      const y = q.y + 0.5 - OY;
      const zz = Math.abs((((q.x - OX) % 8) + 8) % 8 - 4) * 0.6;
      return FALDA[Math.max(0, Math.floor((y + 22 + zz) / 6)) % FALDA.length]!;
    },
    pinta: (q, c) => {
      const y = q.y + 0.5 - OY;
      const zz = Math.abs((((q.x - OX) % 8) + 8) % 8 - 4) * 0.6;
      const f = (y + 22 + zz) / 6;
      return f - Math.floor(f) < 0.15 ? tono(AMARILLO, 4) : c;
    },
  });
  // El delantal blanco con el encaje de abajo.
  const delantal = union(pol([x - 15, -22], [x + 15, -22], [x + 24, 18], [x - 24, 18]), el(x, 18, 24, 5));
  p.volumen(delantal, BLANCO, {
    alto: 8,
    planos: true,
    borde: "oscuro",
    pinta: (q, c) => {
      const y = q.y + 0.5 - OY;
      if (y > 14 && ((q.x + q.y) % 3 === 0 || (q.x - q.y + 300) % 3 === 0)) return tono(BLANCO, 1);
      return c;
    },
  });
  for (let k = -7; k <= 7; k++) p.volumen(ci(x + k * 3.4, 23 - Math.abs(k) * 0.2, 1.9), BLANCO, { alto: 1, borde: "oscuro" });
  // La blusa turquesa (las mangas) y el pecho.
  p.volumen(union(el(x, -40, 30, 20), el(x - 24, -48, 11, 9), el(x + 24, -48, 11, 9)), TURQUESA, { alto: 10, planos: true, borde: "oscuro" });
  // El pañolón morado sobre los hombros, que cae en punta, con su franja y los flecos.
  const pan = union(pol([x - 34, -56], [x + 34, -56], [x + 32, -38], [x, -12], [x - 32, -38]), el(x, -54, 34, 9));
  p.volumen(pan, PANOLON, {
    alto: 8,
    planos: true,
    borde: "oscuro",
    sombra: 0.35,
    pinta: (q, c) => {
      const dx = q.x + 0.5 - OX - x;
      const y = q.y + 0.5 - OY;
      // La franja tejida que sigue la orilla en V y las florecitas.
      const orilla = -12 - Math.abs(dx) * (26 / 32);
      if (y > orilla - 5 && y < orilla - 2) return tono([MAGENTA, NARANJA, TURQUESA][Math.floor((dx + 40) / 3) % 3]!, 3);
      if ((q.x * 5 + q.y * 3) % 17 === 0) return tono(MAGENTA, 4);
      return c;
    },
  });
  // Los flecos que cuelgan de la orilla del pañolón.
  for (let k = -14; k <= 14; k++) {
    const dx = k * 2.2;
    const y0 = -12 - Math.abs(dx) * (26 / 32);
    p.trazo(x + dx + OX, y0 + OY, x + dx + k * 0.15 + OX, y0 + 6 + OY, tono(k % 2 ? MAGENTA : PANOLON, 3), 1);
  }
  // El collar de oro y el cuello.
  p.volumen(cap(x, -68, x, -58, 7, 8), PIEL, { alto: 3, planos: true, borde: "oscuro" });
  cuentas(p, x - 9 + OX, -59 + OY, x + OX, -50 + OY, x + 9 + OX, -59 + OY, 1.3, [ORO, AMARILLO]);
}

/** La cabeza: el moño blanco con plumas y flores, la cara arrugadita y risueña, las gafas y los aretes. */
function cabeza(p: Pintura) {
  const { x, y } = A;
  // Las plumas del moño (detrás).
  abanico(p, x + 8 + OX, y - 22 + OY, 7, 30, -2.1, -0.4, 6, [NARANJA, PANOLON, TURQUESA, VERDE, MAGENTA], 8);
  // El pelo blanco: el moño y las ondas a los lados.
  const pelo = union(el(x, y - 4, 20, 18), el(x, y - 22, 12, 9), el(x - 17, y + 2, 7, 10), el(x + 17, y + 2, 7, 10));
  p.volumen(pelo, CANAS, {
    alto: 8,
    planos: true,
    borde: "oscuro",
    // Las ondas del pelo: rizos.
    pinta: (q, c) => (Math.abs((((q.x - OX) * 0.8 + (q.y - OY) * 0.5) % 4) + 4) % 4 < 0.7 ? tono(CANAS, 1) : c),
  });
  // La cara.
  const cara = union(el(x, y + 2, 16, 17), el(x, y + 10, 12, 11));
  p.volumen(cara, PIEL, { alto: 9, planos: true, borde: "oscuro", brillo: 0.5 });
  p.volumen(corte(cara, el(x + 17, y + 4, 7, 18)), PIEL, { alto: 4, base: -1.1, borde: false });
  // Los aretes de oro.
  for (const l of [-1, 1]) p.volumen(resta(ci(x + l * 16.5, y + 10, 3.2), ci(x + l * 16.5, y + 10, 1.6)), ORO, { alto: 1.5, brillo: 1, borde: "oscuro" });
  // Las cejas blancas, los ojos risueños y las gafas redondas de oro.
  for (const l of [-1, 1] as const) {
    ceja(p, x + l * 6.5 + OX, y - 5 + OY, 8, l, tono(CANAS, 1), 1.5);
    const [ex, ey] = P(x + l * 6.5, y + 1);
    ojo(p, ex, ey, 8.5, 3.6, 2.8, l, { iris: CAFE, pestanas: 0, mira: 0.5 });
    p.plano(resta(ci(x + l * 6.6, y + 1, 5.6), ci(x + l * 6.6, y + 1, 4.7)), tono(ORO, 3));
    pt(p, x + l * 6.6 - 3, y - 2, BRILLO);
    // Las patas de gallo de reírse.
    p.trazo(x + l * 12.5 + OX, y + 1 + OY, x + l * 14 + OX, y + OY, tono(PIEL, 1), 1);
    p.trazo(x + l * 12.5 + OX, y + 2.5 + OY, x + l * 14 + OX, y + 3.5 + OY, tono(PIEL, 1), 1);
  }
  p.trazo(x - 0.8 + OX, y + 1 + OY, x + 0.8 + OX, y + 1 + OY, tono(ORO, 3), 1);
  // La nariz, los cachetes y la risa grande.
  p.volumen(union(el(x, y + 5.5, 2.4, 4), el(x, y + 8.5, 3.8, 2.2)), PIEL, { alto: 2.4, base: 0.4, brillo: 0.8, sombra: 0.35 });
  for (const l of [-1, 1]) mejilla(p, x + l * 10 + OX, y + 9 + OY, 3.4, 2.2, tono(rampa("#e86a7a"), 3));
  sonrisa(p, x + OX, y + 14 + OY, 14, 5.4, rampa("#c8405a"));
  // Las flores del moño.
  flor(p, x - 12, y - 16, 3.8, MAGENTA);
  flor(p, x + 10, y - 20, 4.2, AMARILLO, NARANJA);
  flor(p, x + 18, y - 11, 3.4, TURQUESA);
  flor(p, x - 3, y - 26, 3, NARANJA);
}

/** Los ojos (o los párpados, para el parpadeo). */
function parpados(p: Pintura) {
  for (const l of [-1, 1] as const) {
    const [ex, ey] = P(A.x + l * 6.5, A.y + 1);
    parpado(p, ex, ey, 8.5, 3.6, 2.8, l, PIEL);
    p.plano(resta(ci(A.x + l * 6.6, A.y + 1, 5.6), ci(A.x + l * 6.6, A.y + 1, 4.7)), tono(ORO, 3));
  }
}

/** El brazo levantado con la greca de aluminio (el pico apuntando a la taza). */
function tetera(p: Pintura) {
  const hombro = { x: A.x - 28, y: -50 };
  const codo = { x: A.x - 44, y: -70 };
  const mano = { x: G.x + 6, y: G.y - 18 };
  // La olla de la greca: el cuerpo redondo, la tapa, la perilla, la oreja y el pico.
  p.volumen(cap(G.x + 10, G.y + 4, PICO.x, PICO.y, 4, 2.2), ALUMINIO, { alto: 2, brillo: 1, planos: true, borde: "oscuro" });
  const olla = union(el(G.x, G.y + 3, 17, 14), caja(G.x - 15, G.y - 8, G.x + 15, G.y + 4));
  p.volumen(olla, ALUMINIO, { alto: 9, brillo: 1, planos: true, borde: "oscuro", sombra: 0.35, pinta: (q, c) => (Math.abs(q.y + 0.5 - OY - (G.y - 2)) < 0.6 ? tono(ALUMINIO, 1) : c) });
  p.volumen(el(G.x, G.y - 8, 14, 3.8), ALUMINIO, { alto: 2, base: 0.6, brillo: 1, planos: true, borde: "oscuro" });
  p.volumen(el(G.x, G.y - 12, 3.4, 2.6), NEGRO, { alto: 1.5, brillo: 1, borde: "oscuro" });
  // La oreja (el asa de arriba) que agarra la mano.
  p.volumen(resta(el(G.x + 2, G.y - 12, 10, 9), el(G.x + 2, G.y - 11, 7.4, 6.6)), NEGRO, { alto: 1.5, brillo: 0.8, borde: "oscuro" });
  // El brazo: la manga turquesa y la mano.
  p.volumen(cap(hombro.x, hombro.y, codo.x, codo.y, 7, 6), TURQUESA, { alto: 4, planos: true, borde: "oscuro" });
  p.volumen(cap(codo.x, codo.y, mano.x + 4, mano.y + 4, 6, 4.4), TURQUESA, { alto: 4, planos: true, borde: "oscuro", sombra: 0.3 });
  cuentas(p, mano.x + 2 + OX, mano.y + 8 + OY, mano.x + 5 + OX, mano.y + 6 + OY, mano.x + 7 + OX, mano.y + 3 + OY, 1.2, [ORO, ROJO]);
  p.volumen(el(mano.x, mano.y, 5.6, 4.6, -0.3), PIEL, { alto: 3, planos: true, borde: "oscuro", sombra: 0.35 });
  for (let k = 0; k < 3; k++) p.volumen(cap(mano.x - 3 + k * 2.6, mano.y - 3, mano.x - 2 + k * 2.4, mano.y + 2, 1.4), PIEL, { alto: 1, planos: true, borde: "oscuro" });
}

/** El chorro de tinto que cae del pico de la greca a la taza. */
function chorro(p: Pintura) {
  const n = 14;
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const at = (t: number) => [(1 - t) * (1 - t) * PICO.x + 2 * (1 - t) * t * (C.x - 2) + t * t * C.x, (1 - t) * (1 - t) * PICO.y + 2 * (1 - t) * t * (PICO.y + 6) + t * t * (C.y - 1)] as const;
    const [x0, y0] = at(t0);
    const [x1, y1] = at(t1);
    p.volumen(cap(x0, y0, x1, y1, 2.4 + t0 * 0.8, 2.4 + t1 * 0.8), TINTO, { alto: 1.2, brillo: 0.9, planos: true, borde: "oscuro" });
  }
  curvaP(p, PICO.x + 1, PICO.y - 1, C.x - 3, PICO.y + 5, C.x - 1, C.y - 3, tono(CAFE, 5), 1);
}

/** La taza enorme de florecitas, con el remolino del tinto, y la mano que la sostiene. */
function taza(p: Pintura) {
  const { x, y } = C;
  const r = 20;
  // La oreja.
  p.volumen(resta(el(x - r - 2, y + 9, 7, 7), el(x - r - 2, y + 9, 3.6, 3.8)), LOZA, { alto: 2.5, planos: true, borde: "oscuro" });
  const cuerpo = union(corte(el(x, y, r, r * 0.95), caja(x - r - 1, y, x + r + 1, y + r)), el(x, y, r, r * 0.3));
  p.volumen(cuerpo, LOZA, {
    alto: 10,
    planos: true,
    borde: "oscuro",
    sombra: 0.4,
    // Las flores grandes pintadas: azules de centro naranja, con hojitas.
    pinta: (q, c) => {
      const dx = q.x + 0.5 - OX - x;
      const dy = q.y + 0.5 - OY - y;
      for (const [fx, fy, col] of [
        [-10, 9, AZUL],
        [4, 12, NARANJA],
        [14, 7, AZUL],
      ] as const) {
        const a = Math.atan2(dy - fy, dx - fx);
        const d = Math.hypot(dx - fx, dy - fy);
        if (d < 1.4) return tono(AMARILLO, 4);
        if (d < 3.6 + Math.cos(a * 5) * 1) return tono(col, d < 2.4 ? 4 : 3);
      }
      if (Math.abs(dy - 3) < 0.6) return tono(AZUL, 3);
      return c;
    },
  });
  // El tinto adentro con su remolino de espuma.
  p.volumen(el(x, y, r * 0.88, r * 0.24), TINTO, { alto: 1.5, base: -0.6, borde: false });
  curvaP(p, x - 10, y, x - 2, y - 4, x + 8, y - 1, tono(CAFE, 4), 1);
  curvaP(p, x - 4, y + 2, x + 4, y + 3, x + 10, y + 1, tono(CAFE, 3), 1);
  // La mano de la derecha que la agarra por el lado.
  p.volumen(cap(A.x + 28, -48, x + r + 6, y + 4, 7, 5.4), TURQUESA, { alto: 4, planos: true, borde: "oscuro" });
  p.volumen(el(x + r + 2, y + 6, 5, 6, 0.3), PIEL, { alto: 3, planos: true, borde: "oscuro", sombra: 0.35 });
  for (let k = 0; k < 3; k++) p.volumen(cap(x + r + 1, y + 2 + k * 3.2, x + r - 3, y + 3 + k * 3.4, 1.5), PIEL, { alto: 1, planos: true, borde: "oscuro" });
}

/** El vapor de la greca (bolitas de nube que suben y se deshacen). */
function vapor(p: Pintura) {
  p.volumen(union(el(G.x, G.y - 22, 5, 4), el(G.x + 4, G.y - 26, 4, 3.6), el(G.x - 3, G.y - 28, 3.4, 3)), rampa("#f2f0f8"), { alto: 2, planos: true, borde: false });
}

/** La máscara del carnaval de la esquina de adelante: la cara que se ríe, los ojos verdes y las plumas. */
function mascara(p: Pintura) {
  const x = 92;
  const y = 44;
  abanico(p, x + OX, y - 4 + OY, 8, 22, -Math.PI - 0.4, 0.4, 8, [NARANJA, PANOLON, TURQUESA, VERDE, MAGENTA, AMARILLO], 9);
  for (const l of [-1, 1]) p.volumen(el(x + l * 13, y - 4, 4, 6), MASCARA, { alto: 2, planos: true, borde: "oscuro" });
  const cara = union(el(x, y, 13, 14), el(x, y + 8, 10, 9));
  p.volumen(cara, MASCARA, { alto: 9, planos: true, borde: "oscuro", brillo: 0.6, sombra: 0.4 });
  // La frente con su diadema de rombos.
  p.volumen(corte(cara, caja(x - 14, y - 15, x + 14, y - 9)), MAGENTA, { alto: 2, planos: true, borde: "oscuro", patron: (q) => [MAGENTA, TURQUESA, AMARILLO][Math.floor((q.x + 0.5 - OX + 40) / 3) % 3]! });
  for (const l of [-1, 1] as const) {
    ceja(p, x + l * 5 + OX, y - 5 + OY, 7, l, tono(CAFE, 1), 1.6);
    const [ex, ey] = P(x + l * 5, y - 1);
    ojo(p, ex, ey, 7, 3.4, 2.6, l, { iris: rampa("#3ab84a"), pestanas: 0, mira: -0.4 });
  }
  p.volumen(union(el(x, y + 4, 2.4, 3.6), el(x, y + 7, 3.6, 2)), MASCARA, { alto: 2.4, base: 0.4, brillo: 0.8, sombra: 0.35 });
  sonrisa(p, x + OX, y + 12 + OY, 13, 5.4, rampa("#c8405a"));
}

/** El faldón: drapeados de colores (morado, turquesa, naranja, magenta) con ribete de oro y flores. */
function faldon(u: number, v: number, alto: number): RGBA {
  const cell = 10;
  const k = Math.floor(u / cell);
  const fu = (u % cell) / cell;
  const borde = alto - 2 - 4.4 * Math.sin(Math.PI * fu);
  const col = [PANOLON, TURQUESA, NARANJA, MAGENTA][k % 4]!;
  if (v > borde && v < borde + 1) return tono(ORO, 3);
  if (v > borde) return tono(col, 3 + (Math.floor(u * 2) % 2 ? 0.5 : -0.4));
  const mu = Math.min(u % cell, cell - (u % cell));
  if (Math.hypot(mu, v - (alto - 3)) < 1.6) return tono(AMARILLO, 4);
  if (Math.abs(((u % 3) + 3) % 3 - 1.5) < 0.5 && Math.floor(v) % 3 === 0) return tono([MAGENTA, AMARILLO, TURQUESA][k % 3]!, 4);
  return tono(PANOLON, 2 + ((Math.floor(u) + Math.floor(v)) % 3 === 0 ? 0.6 : 0));
}

export function tinto(): CarrozaArte {
  const s = escena(LARGO, 20);
  plataforma(s, LARGO, { faldon, cubierta: () => tono(TIERRA, 3), flecos: [PANOLON, TURQUESA, NARANJA, MAGENTA, AMARILLO] }, false);
  const f = fig();
  const partes: Parte[] = [parteBase(s)];
  const su = f.lienzo();
  suelo(su);
  partes.push(f.parte("tierra", su, ...P(30, 40)));
  partes.push(tamborero(f, "tambor-1", -16, 8, 0), tamborero(f, "tambor-2", 82, 4, 1));

  const cu = f.lienzo();
  cuerpo(cu);
  partes.push(f.parte("cuerpo", cu, ...P(A.x, 26), { mov: { gira: { amp: 0.008, periodo: 5200 } } }));
  const te = f.lienzo();
  tetera(te);
  partes.push(f.parte("greca", te, ...P(A.x - 28, -50), { padre: "cuerpo", mov: { gira: { amp: 0.025, periodo: 3200 } } }));
  const ch = f.lienzo();
  chorro(ch);
  partes.push(f.parte("chorro", ch, ...P(PICO.x, PICO.y), { padre: "greca", mov: { escala: { sx: 0.04, sy: 0.04, periodo: 400 } } }));
  for (let k = 0; k < 2; k++) {
    const v = f.lienzo();
    vapor(v);
    partes.push(f.parte(`vapor-${k}`, v, ...P(G.x, G.y - 22), { padre: "greca", contorno: false, mov: { sube: { dx: 5, dy: -22, periodo: 2400, fase: k / 2, crece: 0.8 } } }));
  }
  const ca = f.lienzo();
  cabeza(ca);
  partes.push(f.parte("cabeza", ca, ...P(A.x, -64), { padre: "cuerpo", mov: { gira: { amp: 0.05, periodo: 3600 } } }));
  const pa = f.lienzo();
  parpados(pa);
  partes.push(f.parte("parpados", pa, ...P(A.x, -64), { padre: "cabeza", contorno: false, mov: { parpadeo: { cada: 3700, dura: 200 } } }));
  const ta = f.lienzo();
  taza(ta);
  partes.push(f.parte("taza", ta, ...P(C.x, C.y), { padre: "cuerpo", mov: { vaiven: { dy: -0.8, periodo: 2600 } } }));

  // Las parejas que bailan adelante.
  partes.push(
    pareja(f, "baila-1", -14, 34, 0, { piel: PIELES[0]!, camisa: BLANCO, falda: [PANOLON, MAGENTA, TURQUESA, AMARILLO], flores: MAGENTA, brazo: "pocillo" }),
    pareja(f, "baila-2", 20, 52, 1, { piel: PIELES[1]!, camisa: BLANCO, pantalon: NEGRO, sombrero: PAJA, brazo: "arriba" }),
    pareja(f, "baila-3", 54, 60, 2, { piel: PIELES[2]!, camisa: BLANCO, falda: [TURQUESA, NARANJA, MAGENTA, VERDE], flores: NARANJA, brazo: "flores" }),
    pareja(f, "baila-4", 74, 40, 3, { piel: PIELES[3]!, camisa: BLANCO, pantalon: NEGRO, sombrero: PAJA, brazo: "pocillo" }),
  );
  const ma = f.lienzo();
  mascara(ma);
  partes.push(f.parte("mascara", ma, ...P(92, 56), { mov: { gira: { amp: 0.05, periodo: 2900 } } }));
  void [ROJO];
  return { largo: LARGO, partes, luces: [], marco: { x0: -ANCHO - 40, x1: LARGO + 40 } };
}

export type { Forma };
