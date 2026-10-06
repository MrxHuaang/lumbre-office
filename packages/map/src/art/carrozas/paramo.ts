// El Páramo (pixel art pintado): un colibrí gigante de plumas tornasoladas (la coronilla azul violeta, la
// cara verde, la garganta morada y el lomo verde esmeralda) posado sobre el musgo, que mete el pico largo y
// curvo en una flor enorme de pétalos naranja, con un ala levantada que zumba y la cola larga de plumas
// moradas y azules que cae por el costado. Alrededor, el páramo de donde nace el agua: los frailejones con
// sus rosetas plateadas y las espigas doradas, el musgo con florecitas, el ojo de agua con piedras y hojas
// de lirio, y tres colibríes chiquitos (uno en su resorte) que también aletean.
// Todo de frente a la pantalla en 3/4 (la luz de arriba a la izquierda), en coordenadas de pantalla desde
// el origen de la carroza.
import type { Ramp, RGBA } from "../pixel";
import { BRILLO, Figura, LINEA, parpado } from "./figuras";
import type { CarrozaArte, Parte } from "./partes";
import { ANCHO, escena, ORO, pantalla, parteBase, plataforma } from "./plataforma";
import { capsula, circulo, corte, elipse, Pintura, poligono, rampa, resta, tono, union, type Forma } from "./pintura";

const LARGO = 104;
const CORONA = rampa("#5a4ae0");
const CARA = rampa("#2fb86a");
const GARGANTA = rampa("#b03ad0");
const LOMO = rampa("#22a07a");
const ESMERALDA = rampa("#3ac85a");
const ALA = rampa("#1fa8a0");
const COLA = rampa("#6a3ad0");
const AZUL = rampa("#2f6fd6");
const PICO = rampa("#3a3440");
const PETALO = rampa("#f0702a");
const PETALO2 = rampa("#e0405a");
const ESTAMBRE = rampa("#f6c81c");
const MUSGO = rampa("#4f8a32");
const MUSGO2 = rampa("#6fa83a");
const HOJA = rampa("#3f8a3a");
const ROSETA = rampa("#8ab070");
const PLATA = rampa("#e4e2c4");
const ESPIGA = rampa("#f2c22a");
const PIEDRA = rampa("#8a8a92");
const AGUA = rampa("#2a9ae0");
const ESPUMA = rampa("#e4f4ff");
const LIRIO = rampa("#4aa83a");
const MORADO = rampa("#8a3cc8");
const MAGENTA = rampa("#d0287a");
const TURQUESA = rampa("#1fb8b0");
const AMARILLO = rampa("#f6c81c");
const ROSA = rampa("#ef6ba0");

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
/** La cabeza del colibrí grande. */
const K = { x: 44, y: -88 };
/** El pecho (el centro del cuerpo). */
const B = { x: 62, y: -56 };
/** La boca de la flor grande. */
const F = { x: 4, y: -34 };

/** Una pluma en gota (de la base hacia `ang`), con la vena clara y la punta de otro color. */
function plumaGota(p: Pintura, x: number, y: number, ang: number, largo: number, ancho: number, r: Ramp, punta?: Ramp) {
  const cx = x + Math.cos(ang) * largo * 0.5;
  const cy = y + Math.sin(ang) * largo * 0.5;
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  p.volumen(el(cx, cy, largo / 2, ancho / 2, ang), r, {
    alto: ancho * 0.45,
    planos: true,
    borde: "oscuro",
    sombra: 0.3,
    brillo: 0.6,
    patron: punta ? (q) => ((q.x - OX - x) * ux + (q.y - OY - y) * uy > largo * 0.7 ? punta : r) : undefined,
  });
  curvaP(p, x + ux * 1.5, y + uy * 1.5, cx, cy, x + ux * largo * 0.8, y + uy * largo * 0.8, tono(r, 5), 1);
}

/** Una flor chiquita de cinco pétalos. */
function florcita(p: Pintura, x: number, y: number, r: number, petalo: Ramp, centro: Ramp = AMARILLO) {
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    p.volumen(el(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75, r * 0.6, r * 0.42, a), petalo, { alto: 1.2, brillo: 0.3, borde: "oscuro" });
  }
  p.plano(ci(x, y, Math.max(0.8, r * 0.38)), tono(centro, 4));
}

/**
 * Un frailejón (o una puya) del páramo: la roseta de hojas largas abajo, el bulbo de hojas plateadas y la
 * espiga dorada de escamas por capas arriba. (x, y) es el pie y `h` lo alto.
 */
function frailejon(p: Pintura, x: number, y: number, h: number) {
  const ry = y - h * 0.3;
  // La roseta: hojas largas que salen hacia afuera y cuelgan.
  for (let k = 0; k < 9; k++) {
    const a = -Math.PI / 2 + ((k - 4) / 4) * 1.55;
    const L = h * (0.44 + (k % 2) * 0.1);
    plumaGota(p, x, ry, a, L, h * 0.11, k % 3 ? ROSETA : HOJA);
  }
  // El bulbo de hojas plateadas.
  const bulbo = union(el(x, y - h * 0.48, h * 0.17, h * 0.13), el(x - h * 0.08, y - h * 0.44, h * 0.1, h * 0.09), el(x + h * 0.08, y - h * 0.44, h * 0.1, h * 0.09));
  p.volumen(bulbo, PLATA, {
    alto: h * 0.08,
    planos: true,
    borde: "oscuro",
    sombra: 0.3,
    // Las hojitas peluditas del bulbo.
    pinta: (q, c) => (Math.abs((((q.x - OX - x) * 0.9 + 40) % 4) - 2) < 0.5 && q.y - OY > y - h * 0.5 ? tono(PLATA, 1) : c),
  });
  // La espiga dorada: un cono de escamas por filas, cada fila corrida media escama.
  const base = y - h * 0.54;
  const alto = h * 0.46;
  const w = h * 0.15;
  const cono = union(pol([x - w, base], [x + w, base], [x + w * 0.35, base - alto * 0.8], [x, base - alto], [x - w * 0.35, base - alto * 0.8]), el(x, base, w, w * 0.4));
  p.volumen(cono, ESPIGA, {
    alto: w * 0.7,
    planos: true,
    borde: "oscuro",
    brillo: 0.6,
    sombra: 0.3,
    pinta: (q, c) => {
      const dy = base - (q.y + 0.5 - OY);
      const fila = Math.floor(dy / 3.2);
      const fu = (((q.x + 0.5 - OX - x + fila * 1.6) % 3.2) + 3.2) % 3.2;
      const fv = dy - fila * 3.2;
      // El borde de cada escama: una U oscura.
      if (fv < 0.7 || Math.abs(fu - 1.6) > 1.75 - fv * 0.4) return tono(rampa("#f2a21c"), 2);
      if (fv > 2.2 && Math.abs(fu - 1.6) < 0.6) return tono(ESPIGA, 5);
      return c;
    },
  });
}

/** Los frailejones de atrás (una parte que se mece con el viento). */
function frailejones(p: Pintura) {
  frailejon(p, -20, 2, 60);
  frailejon(p, 98, -8, 92);
  frailejon(p, 40, 14, 50);
  frailejon(p, 100, 34, 58);
  frailejon(p, -32, 30, 42);
}

/** El suelo: el musgo que tapa la cubierta, con florecitas, y el ojo de agua con piedras y lirios. */
function suelo(p: Pintura) {
  const musgo = union(pol([TL.x - 2, TL.y - 6], [-6, -12], [60, -10], [TR.x + 2, TR.y - 8], [TR.x + 3, TR.y + 2], [TC.x, TC.y + 3], [TL.x - 3, TL.y + 3]), el(40, 18, 56, 24));
  p.volumen(musgo, MUSGO, {
    alto: 10,
    planos: true,
    borde: "oscuro",
    // Matas de musgo: manchas claras y oscuras.
    patron: (q) => (Math.sin(q.x * 0.9) + Math.sin(q.y * 1.3 + q.x * 0.4) > 0.9 ? MUSGO2 : MUSGO),
    pinta: (q, c) => ((q.x * 7 + q.y * 3) % 11 === 0 ? tono(MUSGO, 1) : (q.x * 5 + q.y * 9) % 17 === 0 ? tono(MUSGO2, 5) : c),
  });
  // Unos helechos y hojas por la orilla.
  for (const [x, y, a] of [
    [-34, 22, -2.5],
    [-28, 24, -1.9],
    [96, 50, -0.6],
    [88, 56, -1.1],
  ] as const)
    plumaGota(p, x, y, a, 16, 6, HOJA);
  // Las florecitas moradas, rosadas y amarillas.
  const flores: [number, number, Ramp][] = [
    [-30, 14, MORADO],
    [-22, 26, MAGENTA],
    [-8, 30, ROSA],
    [-14, 18, AMARILLO],
    [58, 26, MAGENTA],
    [66, 34, MORADO],
    [78, 30, ROSA],
    [84, 44, MORADO],
    [70, 52, AMARILLO],
    [44, 60, ROSA],
    [54, 62, MORADO],
    [-4, 44, MAGENTA],
    [94, 36, AMARILLO],
  ];
  for (const [x, y, c] of flores) florcita(p, x, y, 2.8, c);
  // El ojo de agua: las piedras alrededor y el agua con ondas y lirios.
  const O = { x: 22, y: 38 };
  const ojo = el(O.x, O.y, 30, 11);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    p.volumen(el(O.x + Math.cos(a) * 31, O.y + Math.sin(a) * 12, 4.2, 3, a * 0.3), PIEDRA, { alto: 2, planos: true, borde: "oscuro", sombra: 0.3 });
  }
  p.volumen(ojo, AGUA, {
    alto: 4,
    base: -0.4,
    planos: true,
    borde: "oscuro",
    pinta: (q, c) => {
      const x = q.x - OX - O.x;
      const y = q.y - OY - O.y;
      // Las ondas: arcos claros.
      const r = Math.hypot(x / 2.6, y);
      if (Math.abs((r % 4) - 2) < 0.4 && (x + y) % 3 !== 0) return tono(AGUA, 5);
      if ((q.x * 3 + q.y * 7) % 23 === 0) return BRILLO;
      return c;
    },
  });
  // Las piedras de adelante (encima del agua, tapan la orilla).
  for (let k = 0; k < 7; k++) {
    const a = 0.25 + (k / 6) * (Math.PI - 0.5);
    p.volumen(el(O.x + Math.cos(a) * 30, O.y + Math.sin(a) * 11.5, 4.6, 3.2), PIEDRA, { alto: 2, planos: true, borde: "oscuro", sombra: 0.3 });
  }
  // Las hojas de lirio con su muesca.
  for (const [x, y, r] of [
    [6, 36, 4.6],
    [18, 44, 4.2],
    [32, 34, 4.8],
    [40, 42, 3.8],
  ] as const) {
    p.volumen(resta(el(x, y, r, r * 0.55), pol([x, y], [x + r * 1.2, y - r * 0.5], [x + r * 1.2, y + r * 0.1])), LIRIO, { alto: 1.5, planos: true, borde: "oscuro" });
    curvaP(p, x - r * 0.6, y, x, y - r * 0.2, x + r * 0.5, y, tono(LIRIO, 4), 1);
  }
  florcita(p, 32, 32, 2.4, ROSA, AMARILLO);
}

/** La flor grande: el tallo con sus hojas y la campana de pétalos naranja abierta hacia arriba con el estambre. */
function flor(p: Pintura) {
  const { x, y } = F;
  // El tallo y las hojas largas.
  p.volumen(cap(x + 2, y + 22, x + 4, y + 52, 2.4, 3), HOJA, { alto: 1.5, planos: true, borde: "oscuro" });
  for (const [a, L, dy] of [
    [-2.5, 26, 48],
    [-0.6, 24, 46],
    [-2.1, 20, 38],
    [-1.0, 18, 34],
  ] as const)
    plumaGota(p, x + 4, y + dy, a, L, 7, dy > 40 ? HOJA : LIRIO);
  // Un pétalo: ancho en la mitad, con las vetas rojas desde la garganta y el ribete dorado.
  const petalo = (bx: number, by: number, ang: number, L: number, w: number, r: Ramp, base = 0) => {
    const tx = bx + Math.cos(ang) * L;
    const ty = by + Math.sin(ang) * L;
    const forma = union(el(bx + Math.cos(ang) * L * 0.55, by + Math.sin(ang) * L * 0.55, L * 0.48, w, ang), cap(bx, by, tx, ty, w * 0.35, w * 0.55));
    p.volumen(forma, r, {
      alto: w * 0.5,
      base,
      planos: true,
      borde: "oscuro",
      sombra: 0.3,
      brillo: 0.4,
      pinta: (q, c) => {
        const dx = q.x + 0.5 - OX - bx;
        const dy = q.y + 0.5 - OY - by;
        const along = dx * Math.cos(ang) + dy * Math.sin(ang);
        const side = -dx * Math.sin(ang) + dy * Math.cos(ang);
        if (q.hondo < 1.3 && along > L * 0.35) return tono(ESTAMBRE, (q.x + q.y) % 2 ? 4 : 3);
        if (along < L * 0.3) return tono(PETALO2, 1);
        if (Math.abs(((side * 0.9 + 40) % 3.4) - 1.7) < 0.4 && along < L * 0.7) return tono(PETALO2, 2);
        return c;
      },
    });
  };
  // La campana: el cáliz que se abre del tallo a la boca.
  p.volumen(pol([x - 3, y + 24], [x + 5, y + 24], [x + 16, y + 4], [x - 14, y + 4]), PETALO, { alto: 5, planos: true, borde: "oscuro", patron: (q) => (q.y - OY > y + 14 ? PETALO2 : PETALO) });
  // Los pétalos de atrás, abiertos hacia arriba.
  petalo(x - 4, y + 4, -2.3, 30, 10, PETALO, -0.3);
  petalo(x + 1, y + 2, -1.55, 28, 10, PETALO2, -0.2);
  petalo(x + 6, y + 4, -0.75, 30, 10, PETALO, -0.3);
  // La garganta honda y el estambre amarillo, peludito.
  p.volumen(el(x + 1, y + 3, 12, 5), rampa("#8a1a2a"), { alto: 3, base: -0.8, borde: "oscuro" });
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2;
    const r = 2 + (k % 3) * 1.6;
    p.volumen(ci(x + 1 + Math.cos(a) * r * 1.3, y - 2 + Math.sin(a) * r * 0.8, 1.6), ESTAMBRE, { alto: 1, brillo: 1, borde: "oscuro" });
  }
  // Los pétalos de adelante, que se doblan hacia afuera y hacia abajo.
  petalo(x - 6, y + 6, -3.0, 24, 9, PETALO, 0.3);
  petalo(x + 8, y + 6, -0.1, 24, 9, PETALO, 0.2);
  petalo(x + 1, y + 7, 1.1, 14, 8, PETALO, 0.5);
}

/** El ala levantada del colibrí grande (zumba): plumas largas en abanico, verdes con la punta morada. */
function ala(p: Pintura) {
  const x = B.x + 4;
  const y = B.y - 16;
  for (let k = 0; k < 7; k++) {
    const a = -1.25 + k * 0.17;
    plumaGota(p, x, y, a, 44 - k * 3.5, 9, k % 2 ? ALA : ESMERALDA, MORADO);
  }
  p.volumen(el(x + 6, y - 8, 10, 7, -1), ALA, { alto: 3, planos: true, borde: "oscuro", brillo: 0.6 });
}

/** La cola larga que cae por el costado: plumas moradas, azules y verdes. */
function cola(p: Pintura) {
  const x = B.x + 16;
  const y = B.y + 20;
  const cols = [COLA, AZUL, GARGANTA, COLA, ALA];
  for (let k = 0; k < 5; k++) plumaGota(p, x, y, 0.95 + k * 0.13, 46 - Math.abs(k - 2) * 5, 9, cols[k]!, k % 2 ? MAGENTA : AZUL);
}

/** El cuerpo: el pecho y la barriga tornasolados, el ala de adelante plegada y las patitas en el musgo. */
function cuerpo(p: Pintura) {
  const { x, y } = B;
  // Las patitas agarradas al musgo.
  for (const d of [-1, 1]) {
    p.volumen(cap(x + d * 5, y + 22, x + d * 6, y + 34, 1.5), PICO, { alto: 1, borde: "oscuro" });
    for (let k = -1; k <= 1; k++) p.trazo(x + d * 6 + OX, y + 34 + OY, x + d * 6 + k * 3 + OX, y + 37 + OY, tono(PICO, 2), 1.2);
  }
  // El cuerpo en gota: del cuello a la cola.
  const forma = union(el(x, y, 20, 26, -0.45), cap(K.x + 6, K.y + 10, x, y - 6, 12, 16), el(x + 10, y + 16, 12, 10, -0.6));
  p.volumen(forma, LOMO, {
    alto: 16,
    planos: true,
    borde: "oscuro",
    brillo: 0.6,
    // Tornasol: la garganta y el pecho morados, la barriga verde clara, el lomo esmeralda.
    patron: (q) => {
      const dx = q.x - OX - x;
      const dy = q.y - OY - y;
      const j = (q.x + q.y) % 2 ? 1.2 : 0;
      // La garganta morada, el pecho azul violeta, la barriga verde clara y el lomo esmeralda.
      if (Math.hypot((dx + 12) / 11, (dy + 18) / 12) * 12 < 12 + j) return GARGANTA;
      if (Math.hypot((dx + 6) / 12, (dy + 2) / 11) * 12 < 12 + j) return COLA;
      if (dx - dy * 0.6 > 6 + j) return LOMO;
      return ESMERALDA;
    },
    // Escamitas de plumas.
    pinta: (q, c) => ((q.x + Math.floor((q.y - OY) / 3) * 2) % 5 === 0 && (q.y - OY) % 3 === 0 ? mezcla(c, 0.82) : c),
  });
  // El ala de adelante, plegada sobre el costado, de plumas largas hacia la cola.
  for (let k = 0; k < 5; k++) plumaGota(p, x + 4 - k * 1.5, y - 10 + k * 3.2, 0.95 - k * 0.04, 30 - k * 2, 8, k % 2 ? ALA : LOMO, MORADO);
}

const mezcla = (c: RGBA, k: number): RGBA => [Math.round(c[0] * k), Math.round(c[1] * k), Math.round(c[2] * k), 255];

/** La cabeza: la coronilla azul violeta, la cara verde, el ojo grande y el pico largo y curvo hasta la flor. */
function cabeza(p: Pintura) {
  const { x, y } = K;
  // El pico: largo, curvo, negro brillante, de la cara a la boca de la flor.
  const n = 16;
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const bz = (t: number) => {
      const ax = x - 10;
      const ay = y + 4;
      const cx = x - 34;
      const cy = y + 12;
      const bx = F.x + 4;
      const by = F.y + 2;
      return [(1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cx + t * t * bx, (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * cy + t * t * by] as const;
    };
    const [x0, y0] = bz(t0);
    const [x1, y1] = bz(t1);
    p.volumen(cap(x0, y0, x1, y1, 2.6 - t0 * 1.6, 2.6 - t1 * 1.6), PICO, { alto: 1.2, brillo: 0.9, borde: "oscuro" });
  }
  curvaP(p, x - 12, y + 3, x - 32, y + 9, F.x + 6, F.y, tono(PICO, 5), 1);
  // La cabeza redonda con la coronilla y la cara.
  const cab = union(el(x, y, 14, 13), el(x - 6, y + 4, 9, 7));
  p.volumen(cab, CARA, {
    alto: 9,
    planos: true,
    borde: "oscuro",
    brillo: 0.7,
    patron: (q) => {
      const dx = q.x - OX - x;
      const dy = q.y - OY - y;
      if (dy < -3 + dx * 0.2) return CORONA;
      if (dy > 6 && dx < 2) return GARGANTA;
      return CARA;
    },
    pinta: (q, c) => ((q.x * 3 + q.y * 5) % 13 === 0 ? mezcla(c, 0.85) : c),
  });
  ojoAve(p, false);
}

/** El ojo del colibrí: negro brillante con su aro claro y dos brillos (o cerrado, para el parpadeo). */
function ojoAve(p: Pintura, cerrado: boolean) {
  const ex = K.x - 2;
  const ey = K.y - 1;
  if (cerrado) {
    const [cx, cy] = P(ex, ey);
    parpado(p, cx, cy, 8, 3.6, 3.2, -1, CARA, CORONA);
    return;
  }
  p.volumen(ci(ex, ey, 4.6), rampa("#f2ecd8"), { alto: 2, borde: "oscuro" });
  p.volumen(ci(ex - 0.3, ey, 3.6), rampa("#1a1420"), { alto: 2, brillo: 0, borde: false });
  p.plano(ci(ex - 1.4, ey - 1.3, 1.2), BRILLO);
  pt(p, ex + 1.2, ey + 1.4, BRILLO);
}

/** Un colibrí chiquito (de perfil, mirando a `lado`): cuerpo tornasolado, pico fino y la cola. Devuelve el hombro. */
function chico(p: Pintura, x: number, y: number, s: number, lado: 1 | -1, cuerpo: Ramp, garganta: Ramp) {
  const S = (v: number) => v * s;
  // La cola.
  for (let k = -1; k <= 1; k++) plumaGota(p, x - lado * S(6), y + S(5), (lado > 0 ? Math.PI - 0.6 : 0.6) + k * 0.25 * lado, S(12), S(3.6), k ? COLA : AZUL);
  // El cuerpo y la cabeza.
  p.volumen(el(x, y, S(8), S(5.5), -0.5 * lado), cuerpo, {
    alto: S(3),
    planos: true,
    borde: "oscuro",
    brillo: 0.7,
    patron: (q) => ((q.x - OX - x) * lado > S(2) && q.y - OY > y - S(1) ? garganta : cuerpo),
  });
  const hx = x + lado * S(7);
  const hy = y - S(5);
  p.volumen(ci(hx, hy, S(4.4)), cuerpo, { alto: S(2.4), planos: true, borde: "oscuro", brillo: 0.7, patron: (q) => (q.y - OY < hy - S(1.5) ? CORONA : cuerpo) });
  p.trazo(hx + lado * S(4) + OX, hy + S(0.5) + OY, hx + lado * S(14) + OX, hy + S(2.5) + OY, LINEA, Math.max(1, S(1.2)));
  p.plano(ci(hx + lado * S(1.4), hy - S(0.6), Math.max(0.9, S(1.2))), LINEA);
  pt(p, hx + lado * S(1.2) - 0.3, hy - S(1.1), BRILLO);
  return { x: x - lado * S(1), y: y - S(3) };
}

/** Las alas de un colibrí chiquito (dos plumas levantadas). */
function alasChico(p: Pintura, x: number, y: number, s: number, lado: 1 | -1) {
  for (const [a, c] of [
    [-Math.PI / 2 - lado * 0.6, ALA],
    [-Math.PI / 2 - lado * 0.25, ESMERALDA],
  ] as const)
    plumaGota(p, x, y, a, 14 * s, 5 * s, c, MORADO);
}

/** El faldón: turquesa con volutas de oro, drapeados morados y una piedra roja en cada unión. */
function faldon(u: number, v: number, alto: number): RGBA {
  const cell = 12;
  const k = Math.floor(u / cell);
  const fu = (u % cell) / cell;
  const borde = alto - 2.2 - 4 * Math.sin(Math.PI * fu);
  const mu = Math.min(u % cell, cell - (u % cell));
  if (Math.hypot(mu, v - (alto - 3)) < 1.6) return tono(rampa("#d0283a"), 4);
  if (Math.hypot(mu, v - (alto - 3)) < 2.5) return tono(ORO, 4);
  if (v > borde && v < borde + 1) return tono(ORO, 3);
  if (v > borde) return tono(k % 2 ? MORADO : rampa("#a85ad8"), 3 + (Math.floor(u * 2) % 2 ? 0.5 : -0.4));
  // Las volutas: rizos de oro sobre el turquesa.
  const cx = (u % 6) - 3;
  const cv = v - alto * 0.38;
  const r = Math.hypot(cx, cv * 1.4);
  if (Math.abs(r - 1.8) < 0.45 && Math.atan2(cv, cx) > -1.5) return tono(ORO, 3);
  return tono(TURQUESA, 2 + ((Math.floor(u) + Math.floor(v)) % 3 === 0 ? 0.6 : 0));
}

export function paramo(): CarrozaArte {
  const s = escena(LARGO, 20);
  plataforma(s, LARGO, { faldon, cubierta: () => tono(MUSGO, 2), flecos: [MORADO, rampa("#a85ad8"), ORO, MAGENTA] }, false);
  const f = fig();
  const partes: Parte[] = [parteBase(s)];

  const su = f.lienzo();
  suelo(su);
  partes.push(f.parte("musgo", su, ...P(30, 40)));
  const fr = f.lienzo();
  frailejones(fr);
  partes.push(f.parte("frailejones", fr, ...P(40, 10), { mov: { gira: { amp: 0.01, periodo: 4200 } } }));

  const al = f.lienzo();
  ala(al);
  partes.push(f.parte("ala", al, ...P(B.x + 4, B.y - 16), { padre: "cuerpo", mov: { gira: { amp: 0.16, periodo: 320 } } }));
  const co = f.lienzo();
  cola(co);
  partes.push(f.parte("cola", co, ...P(B.x + 16, B.y + 20), { padre: "cuerpo", mov: { gira: { amp: 0.05, periodo: 2300 } } }));
  const cu = f.lienzo();
  cuerpo(cu);
  partes.push(f.parte("cuerpo", cu, ...P(B.x, B.y + 34), { mov: { gira: { amp: 0.012, periodo: 3600 } } }));
  // La cabeza sube y baja: saca el pico de la flor y lo vuelve a meter.
  const ca = f.lienzo();
  cabeza(ca);
  partes.push(f.parte("cabeza", ca, ...P(K.x + 8, K.y + 12), { padre: "cuerpo", mov: { gira: { amp: 0.035, periodo: 2600 } } }));
  const pa = f.lienzo();
  ojoAve(pa, true);
  partes.push(f.parte("parpados", pa, ...P(K.x + 8, K.y + 12), { padre: "cabeza", contorno: false, mov: { parpadeo: { cada: 4300, dura: 200 } } }));
  const fl = f.lienzo();
  flor(fl);
  partes.push(f.parte("flor", fl, ...P(F.x + 4, F.y + 50), { mov: { gira: { amp: 0.02, periodo: 3100 } } }));

  // El colibrí del resorte (a la izquierda): el resorte en espiral que sale del musgo y el pajarito que rebota.
  const re = f.lienzo();
  for (let i = 0; i < 28; i++) {
    const t0 = i / 28;
    const t1 = (i + 1) / 28;
    const at = (t: number) => [-44 + Math.sin(t * Math.PI * 12) * 3, 16 - t * 44] as const;
    const [x0, y0] = at(t0);
    const [x1, y1] = at(t1);
    re.trazo(x0 + OX, y0 + OY, x1 + OX, y1 + OY, tono(rampa("#6a5a4a"), 2), 1.4);
  }
  partes.push(f.parte("resorte", re, ...P(-44, 16), { mov: { escala: { sy: 0.08, periodo: 900 } } }));
  const c1 = f.lienzo();
  const h1 = chico(c1, -46, -34, 1.1, 1, ESMERALDA, GARGANTA);
  partes.push(f.parte("colibri-1", c1, ...P(-44, -28), { mov: { vaiven: { dy: -3.2, periodo: 900 } } }));
  const a1 = f.lienzo();
  alasChico(a1, h1.x, h1.y, 1.1, 1);
  partes.push(f.parte("alas-1", a1, ...P(h1.x, h1.y), { padre: "colibri-1", mov: { gira: { amp: 0.4, periodo: 240 } } }));
  // Los otros dos, posados: uno en el frailejón alto y otro en la orilla de adelante.
  const c2 = f.lienzo();
  const h2 = chico(c2, 112, -62, 0.9, -1, CARA, MAGENTA);
  const h3 = chico(c2, 70, 30, 0.9, -1, ALA, GARGANTA);
  partes.push(f.parte("colibries", c2, ...P(90, -20), { mov: { gira: { amp: 0.03, periodo: 1700 } } }));
  const a2 = f.lienzo();
  alasChico(a2, h2.x, h2.y, 0.9, -1);
  partes.push(f.parte("alas-2", a2, ...P(h2.x, h2.y), { padre: "colibries", mov: { gira: { amp: 0.3, periodo: 260 } } }));
  const a3 = f.lienzo();
  alasChico(a3, h3.x, h3.y, 0.9, -1);
  partes.push(f.parte("alas-3", a3, ...P(h3.x, h3.y), { padre: "colibries", mov: { gira: { amp: 0.3, periodo: 290, fase: 0.3 } } }));
  void [corte, ROSA];
  return { largo: LARGO, partes, luces: [], marco: { x0: -ANCHO - 40, x1: LARGO + 40 } };
}

export type { Forma };
