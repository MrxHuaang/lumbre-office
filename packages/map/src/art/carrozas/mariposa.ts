// La Mariposa de la máscara (pixel art pintado): una mujer gigante de pelo negro crespo, con el antifaz de
// Carnaval morado y dorado lleno de brillos, la sonrisa abierta, aretes de cuentas y el tocado de plumas;
// detrás le salen dos alas de mariposa enormes (azules, moradas y de todos los colores, con ojos de pavo
// real y el borde de oro) que aletean. Con una mano gigante saluda (uñas pintadas, anillos y una pluma de
// pavo real pintada en la palma). El vestido de vuelos de colores con collares de cuentas tapa el camión, y
// al frente va una máscara de oro que sonríe con todos los dientes. Atrás bailan tres muchachas con tocado.
// Todo se dibuja de frente a la pantalla en 3/4 (el lado izquierdo con luz, el derecho en sombra), en
// coordenadas de pantalla desde el origen de la carroza.
import type { Ramp, RGBA } from "../pixel";
import { abanico, almendra, BRILLO, cuentas, Figura, LINEA, mano, ojo, parpado, pluma, sonrisa } from "./figuras";
import { figurita } from "./munecos";
import type { CarrozaArte, Parte } from "./partes";
import { ANCHO, escena, ORO, pantalla, parteBase, plataforma } from "./plataforma";
import { capsula, circulo, elipse, engordar, Pintura, poligono, rampa, resta, tono, union, type Forma } from "./pintura";

const LARGO = 112;
const PIEL = rampa("#c8824e");
const PELO = rampa("#2a2232");
const MORADO = rampa("#8a3cc8");
const AZUL = rampa("#2f5ed6");
const TURQUESA = rampa("#1fb8b0");
const VERDE = rampa("#3db842");
const AMARILLO = rampa("#f6c81c");
const NARANJA = rampa("#f2861c");
const ROSADO = rampa("#e8408a");
const ROJO = rampa("#d8283a");
const DORADO = rampa("#e8b02a");
const BOCA = rampa("#7a1d33");
const DIENTE = rampa("#f6f0e0");
const LABIOS = rampa("#d0283a");
/** Los colores de los vuelos del vestido. */
const VUELOS = [MORADO, TURQUESA, NARANJA, VERDE, ROSADO, AZUL];
const PIELES = [rampa("#e0ac69"), rampa("#8d5524"), rampa("#c68642")];

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
/** El centro de la cara, los hombros y la raíz de las alas. */
const H = { x: 64, y: -52 };
const S = { x: 64, y: -18 };
const R = { x: 66, y: -58 };

/** Ajusta un color hacia más oscuro (k < 0) o más claro (k > 0). */
function mixTono(c: RGBA, k: number): RGBA {
  const f = k < 0 ? 1 + k * 0.17 : 1 + k * 0.14;
  return [Math.min(255, Math.round(c[0] * f)), Math.min(255, Math.round(c[1] * f)), Math.min(255, Math.round(c[2] * f)), 255];
}
/** Un brillito de escarcha (fijo, sale del píxel). */
const escarcha = (x: number, y: number, cada = 23) => ((x * 31 + y * 17 + ((x * y) % 7)) % cada + cada) % cada === 0;

/**
 * Un ala de mariposa (`lado` -1 la de la izquierda, 1 la de la derecha): el ala de arriba grande y la de
 * abajo más chica, con bandas de color desde la raíz, venas, los ojos de pavo real, la escarcha y el borde
 * de oro con pintas.
 */
function ala(p: Pintura, lado: -1 | 1) {
  const k = lado < 0 ? 1 : 0.8;
  const arriba = el(R.x + lado * 46 * k, R.y - 40, 46 * k, 30, lado * -0.66);
  const abajo = el(R.x + lado * 34 * k, R.y + 16, 28 * k, 21, lado * 0.45);
  const forma = union(arriba, abajo, el(R.x + lado * 10, R.y - 4, 12, 14));
  const bandas = [MORADO, AZUL, TURQUESA, VERDE, AMARILLO, NARANJA, ROSADO, MORADO];
  p.volumen(forma, AZUL, {
    alto: 8,
    planos: true,
    borde: "oscuro",
    brillo: 0.5,
    sombra: 0.3,
    patron: (q) => {
      const d = Math.hypot(q.x - OX - R.x, (q.y - OY - R.y) * 1.1);
      return bandas[Math.min(bandas.length - 1, Math.floor(d / 11))]!;
    },
    pinta: (q, c) => {
      const x = q.x - OX;
      const y = q.y - OY;
      // El borde de oro, con pintas blancas.
      if (q.hondo < 2.6) return q.hondo < 1.4 ? tono(DORADO, 2) : (x + y) % 5 === 0 ? tono(DIENTE, 5) : tono(DORADO, 4);
      if (q.hondo < 5 && q.hondo >= 2.6) return mixTono(c, -1.6);
      // Las venas oscuras que salen de la raíz.
      const a = Math.atan2(y - R.y, (x - R.x) * lado);
      const f = (((a / 0.32) % 1) + 1) % 1;
      if (f < 0.09) return tono(MORADO, 0);
      if (escarcha(q.x, q.y)) return tono(DIENTE, 5);
      return c;
    },
  });
  // Los ojos de pavo real del ala de arriba y uno chico en la de abajo.
  for (const [x, y, r] of [
    [R.x + lado * 66 * k, R.y - 60, 8],
    [R.x + lado * 40 * k, R.y - 62, 5.4],
    [R.x + lado * 74 * k, R.y - 36, 5],
    [R.x + lado * 42 * k, R.y + 24, 5.4],
  ] as const) {
    p.volumen(el(x, y, r * 1.2, r), DORADO, { alto: 2, planos: true, borde: "oscuro" });
    p.volumen(el(x, y, r * 0.9, r * 0.75), TURQUESA, { alto: 1.5, planos: true, borde: false });
    p.volumen(el(x + lado * 0.6, y, r * 0.5, r * 0.45), rampa("#1a2a6a"), { alto: 1, brillo: 0.8, borde: false });
    p.punto(Math.round(x - 1 + OX), Math.round(y - 1 + OY), BRILLO);
  }
}

/** El vestido de vuelos: filas de festones de colores, cada uno con su ribete de cuentas de oro. */
function vestido(p: Pintura) {
  const forma = union(
    pol([S.x - 22, S.y], [S.x + 24, S.y], [FR.x + 3, FR.y - 6], [FC.x + 2, FC.y + 1], [FC.x - 58, FC.y - 28], [S.x - 50, S.y + 30]),
    el(S.x, S.y + 4, 26, 12),
  );
  p.volumen(forma, MORADO, {
    alto: 26,
    planos: true,
    borde: "oscuro",
    sombra: 0.4,
    patron: (q) => {
      const x = q.x - OX;
      const y = q.y - OY;
      const fila = Math.floor((y - S.y + 4 - Math.abs(Math.sin(((x - S.x) / 14) * Math.PI)) * 4) / 9);
      return VUELOS[((fila % VUELOS.length) + VUELOS.length) % VUELOS.length]!;
    },
    pinta: (q, c) => {
      const x = q.x - OX;
      const y = q.y - OY;
      const v = (((y - S.y + 4 - Math.abs(Math.sin(((x - S.x) / 14) * Math.PI)) * 4) % 9) + 9) % 9;
      // El ribete de cuentas al pie de cada festón, y el pliegue del vuelo.
      if (v > 7.6) return (x % 3) === 0 ? tono(DORADO, 5) : tono(DORADO, 2);
      if (v < 1.4) return mixTono(c, 0.9);
      if (v > 5.6) return mixTono(c, -1.2);
      if (escarcha(q.x, q.y, 29)) return tono(DIENTE, 5);
      return x > S.x + 20 ? mixTono(c, -0.5) : c;
    },
  });
  // Los collares de cuentas, uno sobre otro.
  const colores = [[AMARILLO, ROSADO, TURQUESA], [VERDE, NARANJA, MORADO], [DORADO, ROJO, AZUL]] as const;
  colores.forEach((cs, k) => cuentas(p, S.x - 20 + k * 2 + OX, S.y - 2 + k * 3 + OY, S.x + OX, S.y + 14 + k * 6 + OY, S.x + 21 - k * 2 + OX, S.y - 2 + k * 3 + OY, 1.9, cs));
  // Flores de tela en el vestido.
  for (const [x, y, c] of [
    [S.x - 30, S.y + 30, ROSADO],
    [S.x + 30, S.y + 40, AMARILLO],
    [S.x - 6, S.y + 56, TURQUESA],
    [S.x + 6, S.y + 26, NARANJA],
  ] as const)
    flor(p, x, y, 4.2, c, AMARILLO);
}

/** Una flor de cinco pétalos. */
function flor(p: Pintura, x: number, y: number, r: number, petalo: Ramp, centro: Ramp) {
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    p.volumen(el(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, r * 0.62, r * 0.45, a), petalo, { alto: 1.5, brillo: 0.3, borde: "oscuro" });
  }
  p.volumen(ci(x, y, r * 0.42), centro, { alto: 1.2, brillo: 0.8, borde: "oscuro" });
}

/** Los ojos (centro y lado). */
const OJOS = [
  [H.x - 7.5, H.y - 3, -1],
  [H.x + 7.5, H.y - 3, 1],
] as const;
const OJO = { w: 10, hu: 4, hl: 3 };

/** La cabeza: el pelo crespo, el cuello, la cara, la boca, el antifaz, los aretes y el tocado. */
function cabeza(p: Pintura) {
  const { x, y } = H;
  // El pelo crespo: una masa de rizos detrás de la cara.
  const rizos: Forma[] = [el(x + 2, y - 2, 25, 26)];
  for (let k = 0; k < 14; k++) {
    const a = Math.PI * 0.85 + (k / 13) * Math.PI * 1.3;
    rizos.push(ci(x + 2 + Math.cos(a) * 24, y - 2 + Math.sin(a) * 24, 7 + (k % 3)));
  }
  p.volumen(union(...rizos), PELO, {
    alto: 12,
    planos: true,
    borde: "oscuro",
    sombra: 0.35,
    pinta: (q, c) => {
      const r = Math.hypot((q.x % 6) - 3, (q.y % 6) - 3);
      return r > 2 && r < 2.8 ? mixTono(c, 1.6) : c;
    },
  });
  // El cuello y la cara.
  p.volumen(cap(x, y + 14, x, y + 26, 7), PIEL, { alto: 3, planos: true, borde: "oscuro" });
  p.volumen(union(el(x, y - 2, 16, 18), el(x, y + 8, 12, 12)), PIEL, { alto: 10, planos: true, borde: "oscuro", brillo: 0.4 });
  for (const [cx, cy, l] of OJOS) {
    const [ex, ey] = P(cx, cy);
    ojo(p, ex, ey, OJO.w, OJO.hu, OJO.hl, l, { iris: rampa("#6a3a1a"), pestanas: 3, mira: 0.4 });
  }
  // La nariz y la sonrisa grande.
  p.volumen(el(x, y + 5, 2.6, 3.4), PIEL, { alto: 2, brillo: 0.6, base: 0.4, borde: false, sombra: 0.35 });
  sonrisa(p, x + OX, y + 12 + OY, 15, 6, LABIOS);
  // El antifaz: dos alas que suben a los lados, con los huecos de los ojos, joyas y escarcha.
  const huecos = union(...OJOS.map(([cx, cy]) => engordar(almendra(cx + OX, cy + OY, OJO.w, OJO.hu, OJO.hl), 0.8)));
  const antifaz = resta(
    union(el(x - 9, y - 4, 10.5, 7.5, -0.25), el(x + 9, y - 4, 10.5, 7.5, 0.25), pol([x - 17, y - 5], [x - 27, y - 19], [x - 11, y - 11]), pol([x + 17, y - 5], [x + 27, y - 19], [x + 11, y - 11]), el(x, y - 2, 4, 4)),
    huecos,
  );
  p.volumen(antifaz, MORADO, {
    alto: 3,
    planos: true,
    borde: "oscuro",
    sombra: 0.35,
    pinta: (q, c) => {
      // El borde de afuera de oro; el de los huecos de los ojos, oscuro (así no parecen gafas).
      if (q.hondo < 1.1) return huecos.d(q.x + 0.5, q.y + 0.5) < 1.8 ? tono(MORADO, 0) : tono(DORADO, 4);
      if (escarcha(q.x, q.y, 11)) return tono(DORADO, 5);
      return (q.x + q.y) % 13 === 0 ? tono(TURQUESA, 4) : c;
    },
  });
  p.volumen(pol([x, y - 10], [x - 2, y - 6], [x, y - 2], [x + 2, y - 6]), ROSADO, { alto: 1.5, brillo: 1, planos: true, borde: "oscuro" });
  // Los aretes de cuentas.
  for (const l of [-1, 1]) {
    p.volumen(ci(x + l * 15.5, y + 6, 1.8), DORADO, { alto: 1, brillo: 0.9, borde: "oscuro" });
    cuentas(p, x + l * 15.5 + OX, y + 8 + OY, x + l * 16.5 + OX, y + 14 + OY, x + l * 15.5 + OX, y + 20 + OY, 1.6, [TURQUESA, ROSADO, AMARILLO]);
  }
  // El tocado: la diadema de oro con su joya, las plumas en abanico y flores en el pelo.
  abanico(p, x + OX, y - 22 + OY, 4, 30, -Math.PI + 0.55, -0.55, 7, [ROSADO, TURQUESA, AMARILLO, NARANJA, MORADO], 8);
  p.volumen(cap(x - 13, y - 18, x + 13, y - 18, 2.4), DORADO, { alto: 2, brillo: 0.9, planos: true, borde: "oscuro" });
  p.volumen(el(x, y - 21, 3.4, 4.4), TURQUESA, { alto: 2, brillo: 1, planos: true, borde: "oscuro" });
  flor(p, x - 20, y - 10, 4.4, ROSADO, AMARILLO);
  flor(p, x + 22, y - 8, 4, NARANJA, AMARILLO);
  flor(p, x - 16, y - 18, 3.2, AMARILLO, ROJO);
}

/** El brazo y la mano gigante que saluda: uñas pintadas, anillos, la pulsera y la pluma de pavo real pintada. */
function manoQueSaluda(p: Pintura, w: { x: number; y: number }) {
  // El antebrazo con el vuelo de la manga.
  p.volumen(cap(w.x + 6, w.y + 34, w.x, w.y + 4, 7, 6), PIEL, { alto: 4, planos: true, borde: "oscuro", sombra: 0.35 });
  p.volumen(el(w.x + 7, w.y + 34, 12, 6, -0.2), TURQUESA, { alto: 4, planos: true, borde: "oscuro", pinta: (q, c) => (q.hondo < 1.6 ? tono(DORADO, 4) : c) });
  const palma = mano(p, w.x + OX, w.y + OY, -Math.PI / 2 - 0.12, 22, PIEL, { unas: MORADO, dedos: 4, abiertos: 0.2, lado: -1 });
  // La pluma de pavo real pintada en la palma.
  p.plano(palma, (px, py) => {
    const x = px - OX - w.x + 2;
    const y = py - OY - w.y + 13;
    const d = Math.hypot(x * 1.2, y + 2);
    if (d < 1.8) return tono(rampa("#1a2a6a"), 2);
    if (d < 3.2) return tono(TURQUESA, 3);
    if (d < 4.4 && y < 2) return tono(VERDE, 4);
    if (Math.abs(x + y * 0.1) < 0.6 && y > 2 && y < 12) return tono(VERDE, 2);
    if (y > 0 && y < 11 && Math.abs(x) < 3 && (y + Math.abs(x)) % 2 < 1) return tono(VERDE, 3);
    return null;
  });
  // Los anillos de oro con piedras y la pulsera.
  for (const [dx, dy, c] of [
    [-5, -22, TURQUESA],
    [1, -24, ROSADO],
    [6, -21, VERDE],
  ] as const) {
    p.volumen(el(w.x + dx, w.y + dy, 3.2, 1.8), DORADO, { alto: 1, brillo: 0.9, planos: true, borde: "oscuro" });
    p.volumen(ci(w.x + dx, w.y + dy - 0.6, 1.5), c, { alto: 1, brillo: 1, borde: "oscuro" });
  }
  p.volumen(el(w.x, w.y + 3, 8, 3, -0.1), DORADO, { alto: 1.5, brillo: 0.9, planos: true, borde: "oscuro", pinta: (q, c) => (q.x % 3 === 0 ? tono(ROJO, 4) : c) });
}

/** La máscara de oro del frente: una cara de jaguar dorada que sonríe con todos los dientes. */
function mascaraDeOro(p: Pintura, m: { x: number; y: number }) {
  // Las orejas y los rayos de oro alrededor.
  for (let k = 0; k < 9; k++) {
    const a = -Math.PI + 0.25 + (k / 8) * (Math.PI - 0.5);
    p.volumen(pol([m.x + Math.cos(a - 0.14) * 16, m.y - 2 + Math.sin(a - 0.14) * 15], [m.x + Math.cos(a) * 25, m.y - 2 + Math.sin(a) * 23], [m.x + Math.cos(a + 0.14) * 16, m.y - 2 + Math.sin(a + 0.14) * 15]), k % 2 ? NARANJA : DORADO, { alto: 1.5, brillo: 0.8, planos: true, borde: "oscuro" });
  }
  for (const l of [-1, 1]) {
    p.volumen(el(m.x + l * 14, m.y - 15, 5.5, 6, l * 0.4), DORADO, { alto: 2, planos: true, borde: "oscuro" });
    p.volumen(el(m.x + l * 14, m.y - 14, 2.6, 3.4, l * 0.4), ROSADO, { alto: 1, borde: false });
  }
  // La cara redonda de oro, con las pintas del jaguar.
  p.volumen(union(el(m.x, m.y - 2, 18, 16), el(m.x, m.y + 8, 15, 10)), DORADO, {
    alto: 8,
    brillo: 0.9,
    planos: true,
    borde: "oscuro",
    sombra: 0.4,
    pinta: (q, c) => {
      const x = q.x - OX - m.x;
      const y = q.y - OY - m.y;
      return Math.hypot(((x + 40) % 7) - 3.5, ((y + 40) % 6) - 3) < 1 && y < -6 ? tono(NARANJA, 1) : c;
    },
  });
  // Los ojos grandes y vivos, con la ceja.
  for (const l of [-1, 1] as const) {
    const [ex, ey] = P(m.x + l * 7, m.y - 5);
    ojo(p, ex, ey, 9, 3.6, 3, l, { iris: rampa("#2a8a3a"), pestanas: 0, mira: -0.4 });
    curvaP(p, m.x + l * 2, m.y - 9, m.x + l * 7, m.y - 13, m.x + l * 12, m.y - 9, tono(DORADO, 0), 1.6);
  }
  // La nariz ancha.
  p.volumen(pol([m.x - 4, m.y - 1], [m.x + 4, m.y - 1], [m.x, m.y + 3.4]), ROSADO, { alto: 1.5, brillo: 0.9, planos: true, borde: "oscuro" });
  // La sonrisa de oreja a oreja, con los colmillos arriba y abajo.
  const boca = resta(el(m.x, m.y + 7, 13, 7), el(m.x, m.y + 1, 16, 5));
  p.volumen(boca, BOCA, { alto: 2, base: -0.6, borde: "oscuro" });
  p.volumen(el(m.x, m.y + 11.4, 6, 1.8), rampa("#e0607a"), { alto: 1.5, borde: false });
  for (let k = -4; k <= 4; k++) {
    const tx = m.x + k * 2.7;
    const yy = m.y + 5.4 + Math.abs(k) * 0.15;
    p.volumen(pol([tx - 1.3, yy - 0.5], [tx + 1.3, yy - 0.5], [tx, yy + (Math.abs(k) === 3 ? 4.4 : 2.8)]), DIENTE, { alto: 1, brillo: 1, planos: true, borde: "oscuro" });
    if (Math.abs(k) < 4) {
      const yb = m.y + 13.2 - Math.abs(k) * 0.6;
      p.volumen(pol([tx - 1.2, yb + 0.5], [tx + 1.2, yb + 0.5], [tx, yb - 2.6]), DIENTE, { alto: 1, brillo: 1, planos: true, borde: "oscuro" });
    }
  }
}

/** Una bailarina de atrás, con su tocado de plumas. */
function bailarina(f: Figura, id: string, x: number, y: number, k: number, fase: number): Parte {
  const p = f.lienzo();
  const [cx, cy] = P(x, y);
  figurita(p, cx, cy, 0.62, { piel: PIELES[k % 3]!, ropa: [MORADO, TURQUESA, ROSADO][k % 3]!, pelo: PELO, falda: true });
  abanico(p, cx, cy - 32, 3, 13, -Math.PI + 0.35, -0.35, 5, [ROSADO, TURQUESA, AMARILLO, MORADO].slice(k % 2), 4);
  p.volumen(cap(cx - 5 - OX, cy - 30 - OY, cx + 5 - OX, cy - 30 - OY, 1.5), ORO, { alto: 1, borde: "oscuro" });
  return f.parte(id, p, cx, cy, { mov: { gira: { amp: 0.09, periodo: 1200 + k * 160, fase }, vaiven: { dy: -1.6, periodo: 600 + k * 50, fase } } });
}

/** El faldón: morado con rombos de colores y el ruedo de oro. */
function faldonMariposa(u: number, v: number, alto: number): RGBA {
  const cell = 7;
  const k = Math.floor(u / cell);
  const du = Math.abs((((u % cell) + cell) % cell) - cell / 2);
  const dv = Math.abs(v - alto / 2);
  if (v > alto - 2.2) return tono(DORADO, v > alto - 1.4 ? 4 : 2);
  if (du + dv < 2) return tono(VUELOS[(k + 2) % VUELOS.length]!, 4);
  if (du + dv < 3.4) return tono(VUELOS[k % VUELOS.length]!, 3);
  return tono(MORADO, 2 + ((Math.floor(u) + Math.floor(v)) % 2 ? 0.4 : 0));
}

export function mariposa(): CarrozaArte {
  const s = escena(LARGO, 20);
  plataforma(s, LARGO, { faldon: faldonMariposa, cubierta: (u, v) => tono(MORADO, 2 + ((Math.floor(u / 4) + Math.floor(v / 4)) % 2 ? 0.5 : 0)), flecos: [DORADO, MORADO, TURQUESA, ROSADO] }, false);
  const f = fig();
  const partes: Parte[] = [parteBase(s)];

  // Las alas (aletean: se encogen a lo ancho desde la raíz).
  for (const lado of [-1, 1] as const) {
    const p = f.lienzo();
    ala(p, lado);
    partes.push(f.parte(lado < 0 ? "ala-izq" : "ala-der", p, ...P(R.x, R.y), { mov: { escala: { sx: 0.13, periodo: 1500, fase: lado < 0 ? 0 : 0.5 }, gira: { amp: 0.03, periodo: 1500, fase: lado < 0 ? 0 : 0.5 } } }));
  }

  // Atrás, a la izquierda: las bailarinas en su escalón de oro.
  const esc = f.lienzo();
  const e0 = pantalla(10, 26, 0);
  esc.volumen(pol([e0.x - 30, e0.y - 2], [e0.x, e0.y - 16], [e0.x + 22, e0.y - 4], [e0.x - 8, e0.y + 10]), DORADO, { alto: 3, planos: true, borde: "oscuro", sombra: 0.4 });
  esc.volumen(pol([e0.x - 30, e0.y - 2], [e0.x - 8, e0.y + 10], [e0.x - 8, e0.y + 15], [e0.x - 30, e0.y + 3]), DORADO, { alto: 1, base: -0.8, borde: "oscuro" });
  esc.volumen(pol([e0.x - 8, e0.y + 10], [e0.x + 22, e0.y - 4], [e0.x + 22, e0.y + 1], [e0.x - 8, e0.y + 15]), DORADO, { alto: 1, base: -1.6, borde: "oscuro" });
  partes.push(f.parte("escalon", esc, ...P(e0.x, e0.y)));
  partes.push(bailarina(f, "bailarina-2", e0.x + 6, e0.y - 9, 1, 0.33));
  partes.push(bailarina(f, "bailarina-1", e0.x - 20, e0.y + 1, 0, 0));
  partes.push(bailarina(f, "bailarina-3", e0.x + 2, e0.y + 7, 2, 0.66));

  // El cuerpo: el vestido de vuelos y los collares.
  const cue = f.lienzo();
  vestido(cue);
  partes.push(f.parte("cuerpo", cue, ...P(S.x, S.y + 70), { mov: { gira: { amp: 0.006, periodo: 5000 } } }));
  const cab = f.lienzo();
  cabeza(cab);
  partes.push(f.parte("cabeza", cab, ...P(H.x, H.y + 24), { padre: "cuerpo", mov: { gira: { amp: 0.05, periodo: 3200 } } }));
  const parp = f.lienzo();
  for (const [cx, cy, l] of OJOS) {
    const [ex, ey] = P(cx, cy);
    parpado(parp, ex, ey, OJO.w, OJO.hu, OJO.hl, l, PIEL);
  }
  partes.push(f.parte("parpados", parp, ...P(H.x, H.y + 24), { padre: "cabeza", contorno: false, mov: { parpadeo: { cada: 4100, dura: 220 } } }));

  // La mano que saluda (gira en la muñeca) y la máscara de oro del frente.
  const man = f.lienzo();
  const w = { x: 30, y: -24 };
  manoQueSaluda(man, w);
  partes.push(f.parte("mano", man, ...P(w.x + 4, w.y + 30), { padre: "cuerpo", mov: { gira: { amp: 0.16, periodo: 1400, centro: 0.04 } } }));
  const mas = f.lienzo();
  const m = { x: FC.x + 22, y: FC.y - 44 };
  mascaraDeOro(mas, m);
  partes.push(f.parte("mascara", mas, ...P(m.x, m.y + 14), { mov: { gira: { amp: 0.05, periodo: 2200 }, vaiven: { dy: -1.5, periodo: 1100 } } }));
  void [FL, pluma, LINEA, NARANJA];
  return { largo: LARGO, partes, luces: [], marco: { x0: -ANCHO - 40, x1: LARGO + 40 } };
}

export type { Forma };
