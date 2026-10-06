// La trucha de la laguna (pixel art pintado): una trucha arcoíris gigante que salta sobre la ola con la boca
// abierta (dientes de punta, la lengua rosada) y el ojo redondo y brillante; las escamas pasan del verde de
// la cabeza al amarillo, naranja, fucsia, morado y azul hasta la cola, con las aletas naranjas de rayos y
// plumas de colores en el lomo. Debajo, el agua: olas azules enroscadas con espuma blanca que tapan el
// camión, y en ellas tres barcas de madera con pescadores de ruana y sombrero que pescan con caña y se mecen.
// Todo de frente a la pantalla en 3/4 (luz de arriba a la izquierda), en coordenadas de pantalla desde el
// origen de la carroza.
import type { Ramp, RGBA } from "../pixel";
import { BRILLO, Figura, LINEA, pluma } from "./figuras";
import type { CarrozaArte, Parte } from "./partes";
import { ANCHO, escena, pantalla, parteBase, plataforma } from "./plataforma";
import { capsula, circulo, elipse, Pintura, poligono, rampa, resta, tono, union, type Forma } from "./pintura";

const LARGO = 104;
const VERDE = rampa("#4cc23a");
const LIMA = rampa("#b8d82a");
const AMARILLO = rampa("#f6c21c");
const NARANJA = rampa("#f2761c");
const FUCSIA = rampa("#e0308a");
const MORADO = rampa("#8a3cd0");
const AZUL = rampa("#2f62e0");
const TURQUESA = rampa("#1fb0b8");
const CREMA = rampa("#f6eab8");
const ALETA = rampa("#f2581c");
const ALETA2 = rampa("#f28a24");
const BOCA = rampa("#6a1030");
const LENGUA = rampa("#f07890");
const DIENTE = rampa("#f6f2e6");
const OJO = rampa("#a8601c");
const MAR = rampa("#2450c8");
const MAR2 = rampa("#1a3a98");
const CELESTE = rampa("#58a8f0");
const ESPUMA = rampa("#eef6fa");
const MADERA = rampa("#8a5a30");
const PIEL = [rampa("#e0a878"), rampa("#c08050"), rampa("#8a5a3a"), rampa("#f0c49a")];

const hexLinea: RGBA = [88, 104, 128, 255];
const OX = 90;
const OY = 230;
const P = (x: number, y: number): [number, number] => [x + OX, y + OY];
const pol = (...pts: [number, number][]) => poligono(pts.map(([x, y]) => P(x, y)));
const el = (x: number, y: number, rx: number, ry: number, a = 0) => elipse(x + OX, y + OY, rx, ry, a);
const ci = (x: number, y: number, r: number) => circulo(x + OX, y + OY, r);
const cap = (ax: number, ay: number, bx: number, by: number, ra: number, rb = ra) => capsula(ax + OX, ay + OY, bx + OX, by + OY, ra, rb);
const curvaP = (p: Pintura, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, c: RGBA, g = 1) => p.curva(x0 + OX, y0 + OY, cx + OX, cy + OY, x1 + OX, y1 + OY, c, g);
const fig = () => new Figura(260, 330, OX, OY, [0, 0, 0]);
const op = { planos: true, borde: "oscuro" as const };

// ---------- La trucha en su propio sistema: a lo largo (a, desde la nariz) y de través (b, + hacia la barriga) ----------

/** La nariz y la raíz de la cola (px de pantalla): la cola queda arriba y atrás, como al saltar. */
const NARIZ = { x: 100, y: 10 };
const RAIZ = { x: -20, y: -38 };
const LT = Math.hypot(RAIZ.x - NARIZ.x, RAIZ.y - NARIZ.y);
const U = { x: (RAIZ.x - NARIZ.x) / LT, y: (RAIZ.y - NARIZ.y) / LT };
/** Hacia la barriga (abajo en la pantalla). */
const B = U.x < 0 ? { x: U.y, y: -U.x } : { x: -U.y, y: U.x };
/** Un punto de la trucha (a, b) en px de pantalla. */
const T = (a: number, b: number) => ({ x: NARIZ.x + U.x * a + B.x * b, y: NARIZ.y + U.y * a + B.y * b });
const Tp = (a: number, b: number): [number, number] => {
  const q = T(a, b);
  return [q.x, q.y];
};
/** De px del lienzo a (a, b). */
const local = (px: number, py: number) => {
  const dx = px - OX - NARIZ.x;
  const dy = py - OY - NARIZ.y;
  return { a: dx * U.x + dy * U.y, b: dx * B.x + dy * B.y };
};
const polT = (...pts: [number, number][]) => pol(...pts.map(([a, b]) => Tp(a, b)));

/** El perfil del lomo y de la barriga (medio alto a cada t de 0, la nariz, a 1, la cola). */
const PERFIL: [number, number, number][] = [
  [0, 7, 6],
  [0.05, 15, 16],
  [0.12, 24, 26],
  [0.22, 30, 31],
  [0.35, 31, 30],
  [0.5, 28, 26],
  [0.65, 21, 18],
  [0.8, 14, 12],
  [0.92, 8.5, 7.5],
  [1, 6.5, 6],
];
function perfil(t: number): { lomo: number; barriga: number } {
  const tt = Math.max(0, Math.min(1, t));
  for (let i = 1; i < PERFIL.length; i++) {
    const [t1, l1, b1] = PERFIL[i]!;
    const [t0, l0, b0] = PERFIL[i - 1]!;
    if (tt <= t1) {
      const k = (tt - t0) / (t1 - t0);
      const s = (1 - Math.cos(k * Math.PI)) / 2;
      return { lomo: l0 + (l1 - l0) * s, barriga: b0 + (b1 - b0) * s };
    }
  }
  return { lomo: 6.5, barriga: 6 };
}

/** El cuerpo de la trucha como forma (distancia aproximada en el sistema de la trucha). */
const cuerpoForma: Forma = (() => {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 40; i++) pts.push(Tp((i / 40) * LT, -perfil(i / 40).lomo));
  for (let i = 40; i >= 0; i--) pts.push(Tp((i / 40) * LT, perfil(i / 40).barriga));
  return pol(...pts);
})();

/** Los colores de las escamas en bandas sesgadas: verde en la cabeza y el arcoíris hasta la cola. */
const BANDAS = [VERDE, LIMA, AMARILLO, NARANJA, FUCSIA, MORADO, AZUL, TURQUESA, VERDE, AMARILLO, NARANJA, MORADO];
function colorEscama(a: number, b: number): Ramp {
  if (a < 30) return b > 4 ? LIMA : VERDE;
  // El opérculo: fucsia y morado, con sus escamas.
  if (a < 52 && b > -22 && b < 20) return a < 44 ? FUCSIA : MORADO;
  const k = Math.floor((a - 30 - b * 0.7) / 11);
  return BANDAS[Math.max(0, Math.min(BANDAS.length - 1, k + 1))]!;
}

/** El cuerpo: escamas del arcoíris, la barriga crema, las pintas, el opérculo fucsia, el ojo y la boca de arriba. */
function cuerpo(p: Pintura) {
  // La boca por dentro (lo que se ve cuando la quijada baja).
  p.volumen(polT([-1, -6], [34, 1], [38, 24], [-4, 22]), BOCA, { alto: 4, base: -0.6, borde: "oscuro" });
  p.volumen(polT([6, 10], [30, 4], [32, 14], [8, 18]), LENGUA, { alto: 2, brillo: 0.6, borde: "oscuro" });
  const sinBoca = resta(cuerpoForma, polT([-20, -6.5], [34, 1], [44, 34], [-20, 44]));
  p.volumen(sinBoca, VERDE, {
    alto: 22,
    ...op,
    patron: (q) => {
      const { a, b } = local(q.x + 0.5, q.y + 0.5);
      const { barriga } = perfil(a / LT);
      if (b > barriga * 0.5 && a > 26) return CREMA;
      return colorEscama(a, b);
    },
    pinta: (q, c) => {
      const { a, b } = local(q.x + 0.5, q.y + 0.5);
      if (a < 30) return c;
      // Las escamas: medias lunas en filas corridas, con su orilla oscura y un brillito.
      const fila = Math.floor((b + 40) / 4);
      const aa = a + (fila % 2) * 2.6;
      const ca = Math.floor(aa / 5.2) * 5.2 + 2.6;
      const cb = fila * 4 - 40;
      const d = Math.hypot(aa - ca, (b - cb) * 1.25);
      const r = colorEscama(a, b);
      if (d > 2.5 && d < 3.5 && b - cb > -0.5) return tono(r, b > 0 ? 0 : 1);
      if (d < 1.3 && b - cb < 1.5) return tono(r, 5);
      // Las pintas de la trucha por el lomo.
      if (b < -6 && (Math.floor(a * 7.3 + b * 3.1) % 23 === 0 || Math.floor(a * 3.7 - b * 5.3) % 29 === 0)) return tono(MAR2, 1);
      return c;
    },
  });
  // La luz del lomo y la sombra de la barriga (volumen de pez).
  p.plano(cuerpoForma, (qx, qy) => {
    const { a, b } = local(qx + 0.5, qy + 0.5);
    if (a < 2) return null;
    const { lomo, barriga } = perfil(a / LT);
    if (b > barriga - 2.5 && a > 30) return tono(CREMA, 1);
    if (b < -lomo + 2.5) return tono(colorEscama(a, b), 4);
    return null;
  });
  // La cabeza: la luz del hocico y el opérculo (fucsia y morado), con su orilla dorada.
  {
    let prev = T(51, -24);
    for (let i = 1; i <= 12; i++) {
      const s = i / 12;
      const q = T(51 - Math.sin(s * Math.PI) * 6, -24 + s * 44);
      p.trazo(prev.x + OX, prev.y + OY, q.x + OX, q.y + OY, tono(AMARILLO, 4), 1.4);
      prev = q;
    }
  }
  // El labio de arriba y los dientes de punta que bajan.
  for (let k = 0; k < 8; k++) {
    const a = 2 + k * 3.9;
    const b = -5.6 + (a / 34) * 6.4;
    p.volumen(polT([a - 1.7, b], [a + 1.7, b], [a, b + 4.6 - k * 0.25]), DIENTE, { alto: 1, planos: true, borde: "propio", brillo: 1 });
  }
  // El ojo: grande, redondo, con el aro dorado, el iris café y dos brillos.
  const e = T(21, -12);
  p.volumen(ci(e.x, e.y, 8.4), AMARILLO, { alto: 3, ...op, brillo: 0.8, sombra: 0.35 });
  p.volumen(ci(e.x, e.y, 6.8), rampa("#f4f0e8"), { alto: 3, borde: false, base: 0.4 });
  p.volumen(ci(e.x - 0.6, e.y + 0.4, 4.8), OJO, { alto: 2, borde: false });
  p.plano(ci(e.x - 0.6, e.y + 0.6, 2.6), LINEA);
  p.plano(ci(e.x - 2.2, e.y - 1.4, 1.4), BRILLO);
  p.punto(Math.round(e.x + 1.4 + OX), Math.round(e.y + 2.4 + OY), BRILLO);
  // La narina.
  const n = T(5, -10);
  p.plano(el(n.x, n.y, 1.4, 1.1), tono(MAR2, 1));
  // Plumas de adorno en el costado (naranja y morada), como en las carrozas de Pasto.
  const f0 = T(62, 2);
  pluma(p, f0.x + OX, f0.y + OY, Math.atan2(U.y, U.x) - 0.9, 30, 8, NARANJA);
  pluma(p, f0.x + OX + 4, f0.y + OY + 2, Math.atan2(U.y, U.x) - 0.45, 28, 8, MORADO);
}

const mezcla = (a: RGBA, b: RGBA, t: number): RGBA => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t), 255];

/** Una aleta de rayos (naranja): su forma y los rayos que salen de `raiz`. */
function aleta(p: Pintura, forma: Forma, raiz: { x: number; y: number }, color: Ramp = ALETA) {
  p.volumen(forma, color, {
    alto: 4,
    ...op,
    brillo: 0.5,
    sombra: 0.3,
    pinta: (q, c) => {
      const ang = Math.atan2(q.y + 0.5 - OY - raiz.y, q.x + 0.5 - OX - raiz.x);
      const k = (((ang * 6) % 1) + 1) % 1;
      return k < 0.2 ? tono(color, 1) : k > 0.75 ? tono(color, 4) : c;
    },
  });
}

/** Las aletas que van con el cuerpo: la dorsal, la adiposa, la pélvica y la anal. */
function aletasFijas(p: Pintura) {
  aleta(p, polT([42, -27], [46, -44], [56, -58], [70, -56], [84, -42], [88, -22], [64, -27]), T(64, -24));
  aleta(p, polT([100, -13], [106, -21], [112, -16], [110, -9]), T(105, -12), ALETA2);
  aleta(p, polT([76, 15], [84, 28], [92, 28], [90, 13]), T(84, 14));
  aleta(p, polT([98, 9], [104, 18], [111, 16], [109, 7]), T(104, 8), ALETA2);
}

/** La cola: un abanico grande partido en dos puntas, con rayos. */
function cola(p: Pintura) {
  const r = T(LT - 2, 0);
  aleta(p, polT([LT - 3, -6], [LT + 22, -34], [LT + 34, -36], [LT + 26, -14], [LT + 22, 0], [LT + 26, 14], [LT + 34, 34], [LT + 22, 32], [LT - 3, 6]), r);
  return r;
}

/** La aleta del pecho (parte aparte: aletea). */
function aletaPecho(p: Pintura) {
  const r = T(44, 10);
  aleta(p, polT([44, 6], [56, 24], [68, 30], [66, 20], [50, 8]), r, ALETA2);
  return r;
}

/** La quijada de abajo (se abre y se cierra): el labio, la garganta crema, los dientes y la lengua. */
function quijada(p: Pintura) {
  const forma = polT([34, 1], [40, 22], [28, 29], [10, 27], [-4, 24], [-7, 19], [6, 19], [34, 4]);
  p.volumen(forma, AMARILLO, { alto: 6, ...op, patron: (q) => (local(q.x, q.y).b > 21 ? CREMA : AMARILLO) });
  for (let k = 0; k < 7; k++) {
    const a = -3 + k * 4;
    const b = 19 - k * 0.7;
    p.volumen(polT([a - 1.4, b], [a + 1.4, b], [a, b - 3.6]), DIENTE, { alto: 1, planos: true, borde: "propio", brillo: 1 });
  }
}

// ---------- El agua ----------

/** Una ola enroscada: el lomo azul de bandas, el rizo con su hueco y la espuma blanca en la cresta. */
function ola(p: Pintura, x: number, y: number, w: number, h: number, dir: 1 | -1) {
  const Q = (u: number, v: number): [number, number] => [x + dir * u * w, y + v * h];
  const forma = pol(Q(-0.5, 0), Q(-0.36, -0.42), Q(-0.18, -0.82), Q(0.04, -1), Q(0.24, -0.96), Q(0.38, -0.78), Q(0.4, -0.58), Q(0.3, -0.5), Q(0.24, -0.62), Q(0.14, -0.58), Q(0.16, -0.36), Q(0.5, 0));
  const [cx, cy] = Q(0.12, -0.5);
  p.volumen(forma, MAR, {
    alto: h * 0.4,
    ...op,
    // Bandas que se curvan con la ola (como las olas pintadas a mano).
    patron: (q) => {
      const d = Math.hypot(q.x - OX - cx, (q.y - OY - cy) * 1.2);
      return [MAR, CELESTE, MAR, MAR2][Math.floor(d / 2.4) % 4]!;
    },
    pinta: (q, c) => (q.hondo < 2.2 && q.ny < 0 ? tono(ESPUMA, q.hondo < 1.1 ? 4 : 3) : c),
  });
  // La espuma del labio que se enrosca y las garritas de espuma que caen.
  const [lx, ly] = Q(0.3, -0.76);
  p.volumen(union(el(lx, ly, w * 0.1, h * 0.16), el(lx - dir * w * 0.12, ly - h * 0.14, w * 0.12, h * 0.1)), ESPUMA, { alto: 1.5, ...op, brillo: 0.7 });
  for (let k = 0; k < 3; k++) {
    const [fx, fy] = Q(0.36 - k * 0.07, -0.58 + k * 0.05);
    p.volumen(ci(fx, fy, Math.max(0.8, 1.4 - k * 0.25)), ESPUMA, { alto: 1, borde: "oscuro" });
  }
}

/** El agua de atrás: la masa de olas sobre el camión, con plumas detrás del lomo de la trucha. */
function aguaAtras(p: Pintura) {
  // Plumas de atrás (moradas, fucsias, naranjas y turquesas) que asoman por encima del lomo.
  const ramo = (x: number, y: number, a0: number, cols: Ramp[]) => cols.forEach((c, k) => pluma(p, x + OX, y + OY, a0 + (k - (cols.length - 1) / 2) * 0.32, 26 - Math.abs(k - 1.5) * 3, 8, c));
  ramo(T(30, -22).x, T(30, -22).y, -Math.PI / 2 - 0.15, [FUCSIA, MORADO, TURQUESA, NARANJA]);
  ramo(T(100, -14).x, T(100, -14).y, -Math.PI / 2 - 0.35, [MORADO, NARANJA, VERDE]);
  // La masa de agua.
  const masa = pol([-44, 12], [-36, -8], [0, -16], [60, 4], [100, 20], [106, 52], [64, 74], [-42, 24]);
  p.volumen(masa, MAR, { alto: 16, ...op, patron: (q) => (Math.floor((q.y - OY + Math.sin((q.x - OX) * 0.3) * 2) / 3) % 2 ? MAR : MAR2) });
  // Las olas altas de atrás, de la cola hacia la nariz.
  for (const [u, v, w, h, dir] of [
    [-4, 30, 22, 22, 1],
    [2, 16, 24, 26, -1],
    [6, 4, 22, 22, 1],
    [22, 6, 26, 30, -1],
    [40, 8, 26, 34, 1],
    [58, 10, 26, 32, -1],
    [76, 12, 24, 28, 1],
    [92, 14, 22, 24, -1],
  ] as const) {
    const q = pantalla(u, v, 0);
    ola(p, q.x, q.y + 6, w, h, dir);
  }
}

/** La fila de olas de adelante (por la orilla de la vereda y por la de adelante). */
function olasFrente(p: Pintura) {
  for (let k = 0; k < 8; k++) {
    const q = pantalla(4 + k * 13.4, ANCHO - 1, 0);
    ola(p, q.x, q.y + 4, 20, 16 + (k % 2) * 4, k % 2 ? 1 : -1);
  }
  for (const v of [30, 17, 5]) {
    const q = pantalla(LARGO - 1, v, 0);
    ola(p, q.x, q.y + 3, 15, 13, 1);
  }
}

// ---------- Las barcas ----------

/** Un pescador sentado (de la cintura para arriba): ruana de rayas, sombrero y la caña. */
function pescador(p: Pintura, x: number, y: number, k: number) {
  const piel = PIEL[k % PIEL.length]!;
  const ruana = [[FUCSIA, AMARILLO, TURQUESA], [NARANJA, MORADO, AMARILLO], [TURQUESA, FUCSIA, LIMA], [MORADO, NARANJA, VERDE]][k % 4]!;
  p.volumen(pol([x, y - 13], [x + 8, y - 4], [x + 2, y + 2], [x - 7, y - 4]), ruana[0]!, {
    alto: 3,
    ...op,
    patron: (q) => ruana[Math.floor((q.y - OY - y + 20) / 2.4) % 3]!,
  });
  // Los brazos hacia adelante con las manos en la caña.
  p.volumen(cap(x + 3, y - 8, x + 8, y - 6, 1.6), ruana[1]!, { alto: 1, ...op });
  p.volumen(ci(x + 8.6, y - 6.4, 1.6), piel, { alto: 1, ...op });
  // La cabeza y el sombrero (de paja, verde o azul).
  p.volumen(ci(x, y - 15.5, 3.8), piel, { alto: 2, ...op, brillo: 0.6 });
  p.plano(ci(x + 1.4, y - 15.4, 0.7), LINEA);
  p.plano(ci(x - 1.2, y - 15.4, 0.7), LINEA);
  const sombrero = [rampa("#e6c06a"), rampa("#3a9a3a"), rampa("#2f5ad0"), rampa("#e6c06a")][k % 4]!;
  p.volumen(el(x, y - 18.4, 7, 2), sombrero, { alto: 1.4, ...op, sombra: 0.3 });
  p.volumen(pol([x - 3.6, y - 18.6], [x + 3.6, y - 18.6], [x + 3, y - 23], [x - 3, y - 23]), sombrero, { alto: 1.6, ...op });
  p.plano(pol([x - 3.6, y - 19.8], [x + 3.6, y - 19.8], [x + 3.6, y - 18.8], [x - 3.6, y - 18.8]), tono(rampa("#e0283c"), 3));
  // La caña de pescar y el hilo que baja al agua.
  const tip = { x: x + 8.6 + (k % 2 ? 16 : 13), y: y - 6.4 - (k % 2 ? 20 : 24) };
  p.trazo(x + 8 + OX, y - 6 + OY, tip.x + OX, tip.y + OY, tono(MADERA, 1), 1);
  curvaP(p, tip.x, tip.y, tip.x + 2, tip.y + 8, tip.x + 1, tip.y + 16, hexLinea, 1);
}

/** Una barca de madera (a lo largo de la calle) con dos pescadores; centro (u, v) del camión y lo largo. */
function barca(f: Figura, id: string, u: number, v: number, largo: number, k: number, fase: number): Parte {
  const p = f.lienzo();
  const z = 15;
  const ancho = 7;
  const borde = (lado: 1 | -1, zz: number, n = 12) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const s = -1 + (2 * i) / n;
      const w = ancho * Math.sqrt(Math.max(0, 1 - s * s)) * (lado > 0 ? 1 : 1);
      const q = pantalla(u + (s * largo) / 2, v + lado * w, zz);
      return [q.x, q.y] as [number, number];
    });
  const cerca = borde(1, z);
  const lejos = borde(-1, z);
  // Por dentro (el fondo de la barca) y las bancas.
  p.volumen(pol(...cerca, ...lejos.reverse()), MADERA, { alto: 3, base: -1.4, borde: "oscuro" });
  for (const s of [-0.25, 0.3]) {
    const a = pantalla(u + (s * largo) / 2, v + ancho * 0.9, z - 1);
    const b = pantalla(u + (s * largo) / 2, v - ancho * 0.9, z - 1);
    p.trazo(a.x + OX, a.y + OY, b.x + OX, b.y + OY, tono(MADERA, 4), 1.6);
  }
  // Los dos pescadores, sentados en las bancas.
  for (const [s, j] of [
    [-0.28, 0],
    [0.32, 1],
  ] as const) {
    const q = pantalla(u + (s * largo) / 2, v, z);
    pescador(p, q.x, q.y + 1, k * 2 + j);
  }
  // El costado de la barca (de tablas), que tapa las piernas.
  const quilla = borde(1, 8, 12).map(([x, y], i) => [x - 1, y - 2 + Math.sin((i / 12) * Math.PI) * 2] as [number, number]);
  const costado = pol(...borde(1, z), ...quilla.reverse());
  p.volumen(costado, MADERA, {
    alto: 4,
    ...op,
    pinta: (q, c) => {
      const t = (q.y - OY - (q.x - OX) * 0.5) % 3;
      return Math.abs(t) < 0.5 ? tono(MADERA, 1) : c;
    },
  });
  // La borda clara y las sogas.
  p.curva(cerca[0]![0] + OX, cerca[0]![1] + OY, cerca[6]![0] + OX, cerca[6]![1] + OY + 1, cerca[12]![0] + OX, cerca[12]![1] + OY, tono(MADERA, 5), 1.4);
  const c0 = pantalla(u, v, 8);
  return f.parte(id, p, ...P(c0.x, c0.y), { mov: { gira: { amp: 0.05, periodo: 2600 + k * 300, fase }, vaiven: { dy: -1.2, periodo: 1300 + k * 150, fase } } });
}

/** El ramo de adelante: plumas y una flor fucsia grande (se mece). */
function ramo(p: Pintura, x: number, y: number) {
  for (const [a, c] of [
    [-2.2, MORADO],
    [-1.85, NARANJA],
    [-1.55, FUCSIA],
    [-1.25, VERDE],
    [-0.95, NARANJA],
  ] as const)
    pluma(p, x + OX, y + OY, a, 20, 7, c);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    p.volumen(el(x + Math.cos(a) * 3.4, y - 4 + Math.sin(a) * 2.6, 3, 2.2, a), FUCSIA, { alto: 1.4, ...op, brillo: 0.5 });
  }
  p.volumen(ci(x, y - 4, 1.8), AMARILLO, { alto: 1, brillo: 1, borde: "oscuro" });
  for (const l of [-1, 1]) p.volumen(el(x + l * 7, y + 1, 4, 1.8, l * 0.4), VERDE, { alto: 1, ...op });
}

/** El faldón: olas azules con su espuma blanca. */
function faldon(u: number, v: number, alto: number): RGBA {
  const cresta = alto - 3.2 + Math.sin(u * 0.7) * 1.4;
  if (v > cresta + 0.8) return tono(ESPUMA, v > alto - 2 ? 3 : 4);
  if (v > cresta) return tono(CELESTE, 4);
  const k = Math.floor((v + Math.abs(((u % 6) + 6) % 6 - 3) * 0.8) / 2);
  return tono([MAR, MAR2, CELESTE, MAR][((k % 4) + 4) % 4]!, 3);
}

export function trucha(): CarrozaArte {
  const s = escena(LARGO, 20);
  plataforma(s, LARGO, { faldon, cubierta: () => tono(MAR2, 3), flecos: [MADERA, MAR, MADERA, CELESTE] }, false);
  const f = fig();
  const partes: Parte[] = [parteBase(s)];

  const atras = f.lienzo();
  aguaAtras(atras);
  partes.push(f.parte("agua", atras, ...P(30, 30)));
  partes.push(barca(f, "barca-atras", 18, 8, 30, 2, 0.6));

  // La trucha: la cola, el cuerpo con sus aletas, la aleta del pecho y la quijada.
  const pc = f.lienzo();
  const rc = cola(pc);
  const cu = f.lienzo();
  aletasFijas(cu);
  cuerpo(cu);
  const centro = T(LT * 0.45, 4);
  partes.push(f.parte("cuerpo", cu, ...P(centro.x, centro.y), { mov: { vaiven: { dy: -3.5, periodo: 2600 }, gira: { amp: 0.035, periodo: 2600, fase: 0.25 } } }));
  partes.push(f.parte("cola", pc, ...P(rc.x, rc.y), { padre: "cuerpo", mov: { gira: { amp: 0.16, periodo: 1300 } } }));
  // La cola va detrás del cuerpo: se pinta antes.
  const ic = partes.length - 1;
  [partes[ic - 1], partes[ic]] = [partes[ic]!, partes[ic - 1]!];
  const pa = f.lienzo();
  const ra = aletaPecho(pa);
  partes.push(f.parte("aleta-pecho", pa, ...P(ra.x, ra.y), { padre: "cuerpo", mov: { gira: { amp: 0.18, periodo: 900 } } }));
  const qp = f.lienzo();
  quijada(qp);
  const bis = T(34, 1);
  partes.push(f.parte("quijada", qp, ...P(bis.x, bis.y), { padre: "cuerpo", mov: { gira: { amp: 0.045, centro: 0.035, periodo: 1100 } } }));

  // Las barcas de adelante, el ramo y la fila de olas.
  partes.push(barca(f, "barca-medio", 30, 29, 34, 1, 0.3));
  const pr = f.lienzo();
  const rq = pantalla(52, 34, 6);
  ramo(pr, rq.x, rq.y);
  partes.push(f.parte("ramo", pr, ...P(rq.x, rq.y), { mov: { gira: { amp: 0.08, periodo: 2200 } } }));
  partes.push(barca(f, "barca-frente", 76, 29, 34, 0, 0));
  const pf = f.lienzo();
  olasFrente(pf);
  partes.push(f.parte("olas", pf, ...P(30, 60), { mov: { vaiven: { dx: 1.2, periodo: 1800 } } }));
  return { largo: LARGO, partes, luces: [], marco: { x0: -ANCHO - 40, x1: LARGO + 40 } };
}
