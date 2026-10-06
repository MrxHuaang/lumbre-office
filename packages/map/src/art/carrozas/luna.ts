// La Luna en el lago (pixel art pintado): una media luna de nácar acostada sobre el agua, con el rostro de
// una mujer dormida (las pestañas largas, las cejas azules, las mejillas rosadas y la sonrisa en calma) que
// de vez en cuando abre un ojo. Su pelo es el lago entero: olas azules en remolinos con espuma blanca, que
// tapan todo el camión, con flores y estrellas de oro enredadas. Las truchas arcoíris saltan alrededor, la
// llavecita de oro con la E cuelga adelante y se mece, y encima de las olas bailan los del muelle con sus
// tocados de plumas. El marco de la luna y las esquinas van con volutas doradas.
// Todo de frente a la pantalla en 3/4 (la luz de arriba a la izquierda), en coordenadas de pantalla desde
// el origen de la carroza.
import type { Ramp, RGBA } from "../pixel";
import { abanico, BRILLO, ceja, cuentas, Figura, LINEA, mejilla, ojo, parpado } from "./figuras";
import type { CarrozaArte, Parte } from "./partes";
import { ANCHO, escena, ORO, pantalla, parteBase, plataforma } from "./plataforma";
import { capsula, circulo, corte, elipse, girada, Pintura, poligono, rampa, resta, tono, union, type Forma } from "./pintura";

const LARGO = 104;
const NACAR = rampa("#efe4d0");
const AZUL = rampa("#2a5ac8");
const AZUL2 = rampa("#1d3a9a");
const CELESTE = rampa("#4a9ae8");
const ESPUMA = rampa("#eaf6ff");
const ROSA = rampa("#ef6ba0");
const TRUCHA = rampa("#8aa24a");
const RAYA = rampa("#f07a9a");
const VIENTRE = rampa("#f4eee0");
const MORADO = rampa("#8a3cc8");
const MAGENTA = rampa("#d0287a");
const NARANJA = rampa("#f2861c");
const AMARILLO = rampa("#f6c81c");
const TURQUESA = rampa("#1fb8b0");
const VERDE = rampa("#1f8a6a");
const PIELES = [rampa("#8a5a3a"), rampa("#a86a3a"), rampa("#6e4428"), rampa("#c98a5a")];
const PLUMAS: readonly Ramp[] = [NARANJA, MAGENTA, AMARILLO, TURQUESA, MORADO];

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
/** El centro de la cara de la luna. */
const M = { x: 30, y: 6 };

/** Una espiral (los remolinos del pelo y las volutas). */
function espiral(p: Pintura, cx: number, cy: number, r: number, c: RGBA, vueltas = 1.4, sentido = 1, g = 1) {
  let px = cx;
  let py = cy;
  const n = 36;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const a = sentido * t * vueltas * Math.PI * 2;
    const x = cx + Math.cos(a) * r * t;
    const y = cy + Math.sin(a) * r * t * 0.85;
    p.trazo(px + OX, py + OY, x + OX, y + OY, c, g);
    px = x;
    py = y;
  }
}

/** Una flor de cinco pétalos redondos. */
function flor(p: Pintura, x: number, y: number, r: number, petalo: Ramp, centro: Ramp) {
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    p.volumen(el(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, r * 0.62, r * 0.45, a), petalo, { alto: 1.5, brillo: 0.3, borde: "oscuro" });
  }
  p.volumen(ci(x, y, r * 0.42), centro, { alto: 1.2, brillo: 0.8, borde: "oscuro" });
}

/** Una estrella de oro de cuatro puntas. */
function estrella(p: Pintura, x: number, y: number, r: number) {
  const k = r * 0.28;
  p.volumen(pol([x, y - r], [x + k, y - k], [x + r, y], [x + k, y + k], [x, y + r], [x - k, y + k], [x - r, y], [x - k, y - k]), ORO, { alto: 1.5, brillo: 1, planos: true, borde: "oscuro" });
}

/** Un remolino de ola: el rizo redondo de un azul, la espuma blanca por arriba y la espiral adentro. */
function rizo(p: Pintura, x: number, y: number, r: number, color: Ramp, sentido: 1 | -1) {
  p.volumen(ci(x, y, r), color, { alto: r * 0.6, planos: true, borde: "oscuro", sombra: 0.3 });
  // La cresta de espuma: un arco claro arriba que se enrosca.
  curvaP(p, x - r * 0.85 * sentido, y + r * 0.1, x - r * 0.2 * sentido, y - r * 1.15, x + r * 0.8 * sentido, y - r * 0.25, tono(ESPUMA, 4), 1.4);
  espiral(p, x + r * 0.05 * sentido, y + r * 0.05, r * 0.62, tono(color, 5), 1.3, sentido);
  pt(p, x - r * 0.5, y - r * 0.55, BRILLO);
}

/** El pelo de olas: la masa que tapa el camión y sube atrás, cubierta de remolinos por filas. */
function pelo(p: Pintura) {
  const masa = union(
    pol([TL.x - 3, TL.y - 6], [TL.x + 4, TL.y - 26], [-14, -36], [20, -54], [56, -52], [92, -26], [TR.x + 3, TR.y - 10], [TR.x + 3, TR.y + 2], [TC.x, TC.y + 2], [TL.x - 3, TL.y + 3]),
    el(34, -36, 48, 22),
  );
  p.volumen(masa, AZUL, { alto: 30, planos: true, borde: "oscuro" });
  // Los remolinos: de atrás y arriba hacia adelante y abajo.
  let k = 0;
  for (let fila = 0; fila < 12; fila++) {
    const t = fila / 11;
    for (let i = 0; i < 13; i++) {
      const u = (i + (fila % 2) * 0.5) / 12;
      const x = TL.x - 2 + u * (TR.x - TL.x + 6) + t * 14 + Math.sin(i * 4.1 + fila) * 2;
      const y = -58 + t * 100 + u * (TR.y - TL.y) * 0.45 + Math.sin(i * 2.3 + fila * 1.7) * 3;
      if (masa.d(x + OX, y + OY) > -1) continue;
      k++;
      const col = [AZUL, CELESTE, AZUL2, AZUL][k % 4]!;
      rizo(p, x, y, 6.5 + ((i + fila) % 3), col, (i + fila) % 2 ? 1 : -1);
    }
  }
  // Las flores y las estrellas enredadas en el pelo.
  for (const [x, y, r, c] of [
    [58, -30, 6, NARANJA],
    [70, -24, 5, MORADO],
    [50, -22, 4, MAGENTA],
    [8, -26, 4.5, MORADO],
    [-4, -18, 3.6, NARANJA],
    [84, -12, 4, MAGENTA],
  ] as const)
    flor(p, x, y, r, c, AMARILLO);
  for (const [x, y, r] of [
    [78, -6, 5],
    [24, -38, 3.5],
    [-22, -6, 3],
    [94, 12, 3.4],
    [64, -40, 3],
  ] as const)
    estrella(p, x, y, r);
}

/** Una bailarina del muelle: la falda de vuelos, el top con collares, los brazos arriba y el tocado de plumas. */
function bailarina(f: Figura, id: string, x: number, y: number, s: number, k: number, fase: number): Parte {
  const p = f.lienzo();
  const S = (v: number) => v * s;
  const piel = PIELES[k % PIELES.length]!;
  const falda = [MAGENTA, MORADO, NARANJA, TURQUESA][k % 4]!;
  // El tocado de plumas (detrás de la cabeza).
  const hy = y - S(40);
  abanico(p, x + OX, hy - S(3) + OY, S(5), S(15), -Math.PI + 0.25, -0.25, 7, PLUMAS.slice(k % 2), S(6));
  // Las piernas.
  for (const d of [-1, 1]) p.volumen(cap(x + d * S(3), y - S(12), x + d * S(3.5), y - S(1), S(2.2)), piel, { alto: S(1.5), planos: true, borde: "oscuro" });
  // La falda de vuelos: tres volantes de colores.
  for (let j = 0; j < 3; j++) {
    const yy = y - S(22) + j * S(4);
    const w = S(7 + j * 2.4);
    p.volumen(pol([x - w * 0.7, yy - S(3)], [x + w * 0.7, yy - S(3)], [x + w, yy + S(3)], [x - w, yy + S(3)]), j % 2 ? AMARILLO : falda, {
      alto: S(2),
      planos: true,
      borde: "oscuro",
      sombra: 0.25,
      pinta: (q, c) => (Math.abs(q.y - OY - yy - S(3)) < 0.8 && (q.x % 2 === 0) ? tono(AMARILLO, 5) : c),
    });
  }
  // El top y los collares.
  p.volumen(caja2(x - S(5.5), y - S(32), x + S(5.5), y - S(21)), falda, { alto: S(2), planos: true, borde: "oscuro" });
  cuentas(p, x - S(4) + OX, y - S(31) + OY, x + OX, y - S(26) + OY, x + S(4) + OX, y - S(31) + OY, 0.9, [AMARILLO, TURQUESA]);
  // Los brazos arriba, saludando.
  for (const d of [-1, 1]) {
    p.volumen(cap(x + d * S(5), y - S(31), x + d * S(11), y - S(45), S(1.8)), piel, { alto: S(1.4), planos: true, borde: "oscuro" });
    p.volumen(ci(x + d * S(11.5), y - S(46.5), S(2.2)), piel, { alto: S(1.4), planos: true, borde: "oscuro" });
    p.volumen(el(x + d * S(9.5), y - S(42), S(2.4), S(1.2), d * 0.9), AMARILLO, { alto: 1, brillo: 1, borde: "oscuro" });
  }
  // La cabeza con su cara contenta.
  p.volumen(ci(x, hy, S(6.5)), piel, { alto: S(4), planos: true, brillo: 0.5, borde: "oscuro" });
  p.volumen(el(x, hy - S(5), S(6.5), S(2.6)), [AMARILLO, TURQUESA][k % 2]!, { alto: S(1.5), planos: true, borde: "oscuro" });
  for (const d of [-1, 1]) {
    p.plano(el(x + d * S(2.5), hy, S(0.9), S(1.3)), LINEA);
    pt(p, x + d * S(2.5) - 0.4, hy - S(0.6), BRILLO);
    mejilla(p, x + d * S(4) + OX, hy + S(2.4) + OY, S(1.5), S(1), tono(ROSA, 3));
  }
  curvaP(p, x - S(2), hy + S(2.6), x, hy + S(4.6), x + S(2), hy + S(2.6), LINEA, 1);
  const [cx, cy] = P(x, y);
  return f.parte(id, p, cx, cy, { mov: { gira: { amp: 0.08, periodo: 1400 + k * 170, fase }, vaiven: { dy: -1.6, periodo: 700, fase } } });
}

const caja2 = (x0: number, y0: number, x1: number, y1: number) => pol([x0, y0], [x1, y0], [x1, y1], [x0, y1]);

/**
 * Una trucha arcoíris: el lomo verde oliva con pintas negras, la raya rosada, la barriga blanca, las aletas
 * y la cola, el ojo y la boca abierta. (x, y) es el centro y `ang` hacia dónde mira la cabeza.
 */
function trucha(p: Pintura, x: number, y: number, L: number, ang: number) {
  const s = Math.cos(ang) >= 0 ? 1 : -1;
  const co = Math.cos(ang);
  const si = Math.sin(ang);
  // Del marco del pez (u a lo largo hacia la cabeza, v hacia la barriga) a la pantalla.
  const A = (u: number, v: number): [number, number] => [x + u * co - v * s * si, y + u * si + v * s * co];
  const loc = (q: { x: number; y: number }) => {
    const dx = q.x + 0.5 - OX - x;
    const dy = q.y + 0.5 - OY - y;
    return { u: dx * co + dy * si, v: (-dx * si + dy * co) * s };
  };
  const h = L * 0.17;
  // La cola en abanico y las aletas (detrás del cuerpo).
  p.volumen(pol(A(-L * 0.4, 0), A(-L * 0.66, -h * 1.3), A(-L * 0.58, 0), A(-L * 0.66, h * 1.3)), TRUCHA, { alto: 1.5, planos: true, borde: "oscuro", pinta: (q, c) => (Math.abs(loc(q).v) < 0.7 ? tono(RAYA, 3) : c) });
  p.volumen(pol(A(-L * 0.05, -h * 0.8), A(L * 0.08, -h * 1.7), A(L * 0.18, -h * 0.8)), TRUCHA, { alto: 1, planos: true, borde: "oscuro" });
  p.volumen(pol(A(L * 0.05, h * 0.7), A(L * 0.0, h * 1.5), A(L * 0.16, h * 0.8)), RAYA, { alto: 1, planos: true, borde: "oscuro" });
  // El cuerpo en huso.
  const cuerpo = union(girada(el(x, y, L * 0.42, h), x + OX, y + OY, ang), girada(el(x - s * 0, y, L * 0.5, h * 0.55), x + OX, y + OY, ang));
  p.volumen(cuerpo, TRUCHA, {
    alto: h * 0.8,
    planos: true,
    borde: "oscuro",
    brillo: 0.6,
    patron: (q) => {
      const { v } = loc(q);
      if (v > h * 0.32) return VIENTRE;
      if (Math.abs(v - h * 0.05) < h * 0.26) return RAYA;
      return TRUCHA;
    },
    pinta: (q, c) => {
      const { u, v } = loc(q);
      // Las pintas negras del lomo y la cola.
      if (v < h * 0.1 && ((q.x * 7 + q.y * 13) % 17 === 0 || (q.x * 11 + q.y * 5) % 23 === 0) && u < L * 0.3) return tono(TRUCHA, 0);
      return c;
    },
  });
  // La agalla, el ojo y la boca.
  const g0 = A(L * 0.24, -h * 0.6);
  const g1 = A(L * 0.2, 0);
  const g2 = A(L * 0.24, h * 0.6);
  curvaP(p, g0[0], g0[1], g1[0], g1[1], g2[0], g2[1], tono(TRUCHA, 0), 1);
  const [ex, ey] = A(L * 0.34, -h * 0.25);
  p.plano(ci(ex, ey, Math.max(1.4, L * 0.045)), tono(AMARILLO, 5));
  p.plano(ci(ex, ey, Math.max(0.8, L * 0.025)), LINEA);
  pt(p, ex - 0.6, ey - 0.6, BRILLO);
  const [mx, my] = A(L * 0.46, h * 0.18);
  const [nx, ny] = A(L * 0.38, h * 0.28);
  p.trazo(mx + OX, my + OY, nx + OX, ny + OY, LINEA, 1.2);
}

/** La media luna de nácar con el rostro dormido y el marco de volutas de oro. */
function luna(p: Pintura) {
  const { x, y } = M;
  // La media luna acostada: el cuerno de la izquierda sube y la panza cae sobre el agua.
  const cuerno = resta(el(x - 8, y + 14, 46, 32, -0.18), el(x + 6, y - 2, 40, 30, -0.18));
  p.volumen(cuerno, NACAR, {
    alto: 12,
    planos: true,
    borde: "oscuro",
    sombra: 0.35,
    // El nácar: chispitas de color.
    pinta: (q, c) => ((q.x * 5 + q.y * 3) % 19 === 0 ? tono(rampa("#c8e0f0"), 5) : (q.x * 3 + q.y * 7) % 23 === 0 ? tono(ROSA, 5) : c),
  });
  // El ribete de oro de la media luna, con sus volutas.
  const ribete = resta(engr(el(x - 8, y + 14, 46, 32, -0.18), 0), engr(el(x - 8, y + 14, 46, 32, -0.18), -3));
  p.volumen(corte(ribete, cuerno), ORO, { alto: 1.5, brillo: 1, planos: true, borde: "oscuro" });
  for (const [vx, vy, r, sen] of [
    [x - 50, y - 2, 4, 1],
    [x - 28, y + 40, 4.5, -1],
    [x + 8, y + 46, 4, 1],
  ] as const) {
    p.volumen(ci(vx, vy, r), ORO, { alto: 2, brillo: 1, planos: true, borde: "oscuro" });
    espiral(p, vx, vy, r * 0.8, tono(ORO, 1), 1.3, sen);
  }
  // La cara: el óvalo de nácar, un poquito ladeado hacia arriba (mira al cielo).
  const cara = union(el(x, y, 19, 23, 0.1), el(x - 1, y + 10, 14, 13));
  p.volumen(cara, NACAR, { alto: 12, planos: true, borde: "oscuro", brillo: 0.5 });
  p.volumen(corte(cara, el(x + 19, y + 2, 8, 24)), NACAR, { alto: 6, base: -1, borde: false });
  // El marco de volutas de oro por la derecha de la cara.
  curvaP(p, x + 12, y - 24, x + 30, y - 6, x + 18, y + 26, tono(ORO, 3), 2.4);
  curvaP(p, x + 12, y - 24, x + 30, y - 6, x + 18, y + 26, tono(ORO, 5), 1);
  for (const [vx, vy, r, sen] of [
    [x + 13, y - 26, 3.6, -1],
    [x + 25, y + 6, 3.4, 1],
    [x + 17, y + 28, 3.4, -1],
  ] as const) {
    p.volumen(ci(vx, vy, r), ORO, { alto: 2, brillo: 1, planos: true, borde: "oscuro" });
    espiral(p, vx, vy, r * 0.8, tono(ORO, 1), 1.3, sen);
  }
  // Las cejas azules, los ojos cerrados con pestañas largas, la nariz, las mejillas y la sonrisa en calma.
  for (const l of [-1, 1] as const) {
    ceja(p, x + l * 8 + OX, y - 8 + OY, 12, l, tono(AZUL, 3), 1.8);
    const [ex, ey] = P(x + l * 8, y);
    parpado(p, ex, ey, 12, 4.5, 3.5, l, NACAR, rampa("#c8bce8"));
    mejilla(p, x + l * 11 + OX, y + 8 + OY, 4, 2.4, tono(ROSA, 3));
  }
  p.volumen(union(el(x, y + 4, 2.2, 4.4), el(x, y + 7.5, 3.6, 2)), NACAR, { alto: 3, base: 0.3, brillo: 0.8, sombra: 0.35 });
  pt(p, x - 1.6, y + 8.5, tono(NACAR, 0));
  pt(p, x + 1.6, y + 8.5, tono(NACAR, 0));
  p.volumen(el(x, y + 14.5, 4.6, 1.8), rampa("#e07a8a"), { alto: 1.4, brillo: 0.6, borde: false });
  curvaP(p, x - 5, y + 14, x, y + 16, x + 5, y + 14, tono(rampa("#a83a5a"), 1), 1);
  pt(p, x - 5.6, y + 13.4, tono(rampa("#a83a5a"), 1));
  pt(p, x + 5.6, y + 13.4, tono(rampa("#a83a5a"), 1));
}

const engr = (f: Forma, k: number): Forma => ({ ...f, d: (px, py) => f.d(px, py) - k, x0: f.x0 - k, y0: f.y0 - k, x1: f.x1 + k, y1: f.y1 + k });

/** El ojo que se abre de vez en cuando (el de la derecha, mirando de reojo). */
function ojoAbierto(p: Pintura) {
  const [ex, ey] = P(M.x + 8, M.y);
  p.volumen(engr(el(M.x + 8, M.y, 7.5, 5.5), 0), NACAR, { alto: 3, borde: false });
  ojo(p, ex, ey, 12, 4.5, 3.5, 1, { iris: rampa("#3a6ad8"), pestanas: 4, mira: -1.5, sombra: rampa("#c8bce8") });
}

/** Las olas de adelante (corren de ida y vuelta) con su espuma. */
function olas(p: Pintura) {
  for (const [x, y, r, c] of [
    [-36, 20, 6, CELESTE],
    [-26, 28, 6.5, AZUL],
    [46, 52, 7, CELESTE],
    [58, 58, 6.5, AZUL],
    [70, 62, 6, CELESTE],
    [84, 52, 6.5, AZUL],
    [98, 44, 6, CELESTE],
  ] as const)
    rizo(p, x, y, r, c, x % 2 ? 1 : -1);
  for (const [x, y] of [
    [-30, 14],
    [52, 46],
    [76, 56],
    [92, 40],
  ] as const)
    for (let k = 0; k < 3; k++) p.volumen(ci(x + k * 2.4, y - k * 1.6, 1.1 + k * 0.2), ESPUMA, { alto: 1, brillo: 1, borde: false });
}

/** La llavecita de oro con la E, colgando de una cadenita (se mece). */
function llave(p: Pintura, x: number, y: number) {
  for (let k = 0; k < 5; k++) p.volumen(el(x, y + k * 3, 1.2, 1.7), ORO, { alto: 1, brillo: 1, borde: "oscuro" });
  const top = y + 15;
  // El ojo de la llave: un trébol de tres aros.
  for (const [dx, dy] of [
    [0, 4],
    [-4, 8],
    [4, 8],
  ] as const)
    p.volumen(resta(ci(x + dx, top + dy, 3.6), ci(x + dx, top + dy, 1.5)), ORO, { alto: 1.6, brillo: 1, planos: true, borde: "oscuro" });
  p.volumen(cap(x, top + 11, x, top + 30, 1.8), ORO, { alto: 1.4, brillo: 1, planos: true, borde: "oscuro" });
  p.volumen(caja2(x, top + 22, x + 6, top + 25), ORO, { alto: 1.2, brillo: 1, planos: true, borde: "oscuro" });
  p.volumen(caja2(x, top + 27, x + 7, top + 30), ORO, { alto: 1.2, brillo: 1, planos: true, borde: "oscuro" });
  // La plaquita con la E.
  const py = top + 33;
  p.volumen(caja2(x - 5, py, x + 5, py + 10), ORO, { alto: 2, brillo: 1, planos: true, borde: "oscuro" });
  const E = tono(rampa("#7a3a1a"), 1);
  p.plano(caja2(x - 2.5, py + 2, x - 0.6, py + 8), E);
  p.plano(caja2(x - 2.5, py + 2, x + 2.5, py + 3.4), E);
  p.plano(caja2(x - 2.5, py + 4.4, x + 1.6, py + 5.8), E);
  p.plano(caja2(x - 2.5, py + 6.8, x + 2.5, py + 8.2), E);
}

/** El faldón: un fondo verde mar con drapeados morados, medallones de oro y borlas. */
function faldon(u: number, v: number, alto: number): RGBA {
  const cell = 10;
  const k = Math.floor(u / cell);
  const fu = (u % cell) / cell;
  const borde = alto - 2.2 - 4.2 * Math.sin(Math.PI * fu);
  const mu = Math.abs((u % cell) - 0.2);
  // El medallón en la unión de dos drapeados.
  if (Math.hypot(Math.min(mu, cell - mu), v - (alto - 3)) < 1.8) return tono(k % 2 ? MAGENTA : MORADO, 4);
  if (Math.hypot(Math.min(mu, cell - mu), v - (alto - 3)) < 2.6) return tono(ORO, 4);
  if (v > borde && v < borde + 1) return tono(ORO, 3);
  if (v > borde) return tono(k % 2 ? MORADO : MAGENTA, 3 + (Math.floor(u * 2) % 2 ? 0.5 : -0.4));
  return tono(VERDE, 3 + ((Math.floor(u) + Math.floor(v)) % 3 === 0 ? 0.6 : 0));
}

export function lunaDelLago(): CarrozaArte {
  const s = escena(LARGO, 20);
  plataforma(s, LARGO, { faldon, cubierta: () => tono(AZUL, 2), flecos: [MORADO, ORO, MAGENTA, VERDE] }, false);
  const f = fig();
  const partes: Parte[] = [parteBase(s)];

  // Los del muelle bailando arriba de las olas (detrás del pelo, que les tapa los pies).
  for (const [x, y, k, fase] of [
    [-30, -10, 0, 0],
    [30, -55, 1, 0.25],
    [58, -55, 2, 0.5],
    [86, -30, 3, 0.75],
  ] as const)
    partes.push(bailarina(f, `bailarin-${k}`, x, y, k === 2 ? 1.05 : 0.9, k, fase));

  const pel = f.lienzo();
  pelo(pel);
  partes.push(f.parte("pelo", pel, ...P(30, 30), { mov: { gira: { amp: 0.006, periodo: 5200 } } }));

  // La trucha que salta en arco por encima del pelo (gira sobre un punto del agua).
  const sal = f.lienzo();
  trucha(sal, -6, -68, 38, 0.45);
  partes.push(f.parte("trucha-salta", sal, ...P(4, -20), { padre: "pelo", mov: { gira: { amp: 0.32, periodo: 3000 } } }));

  const lun = f.lienzo();
  luna(lun);
  partes.push(f.parte("luna", lun, ...P(M.x, M.y + 30), { padre: "pelo", mov: { gira: { amp: 0.025, periodo: 4800 } } }));
  const oj = f.lienzo();
  ojoAbierto(oj);
  partes.push(f.parte("ojo", oj, ...P(M.x, M.y + 30), { padre: "luna", contorno: false, mov: { parpadeo: { cada: 5600, dura: 1100, fase: 0.4 } } }));

  // Las truchas a cada lado de la cara, que se asoman entre las olas.
  const pi = f.lienzo();
  trucha(pi, -14, 0, 40, -0.55);
  partes.push(f.parte("trucha-izq", pi, ...P(-12, 10), { padre: "pelo", mov: { gira: { amp: 0.09, periodo: 1900 }, vaiven: { dy: -2, periodo: 1900 } } }));
  const pd = f.lienzo();
  trucha(pd, 76, 4, 40, Math.PI + 0.75);
  partes.push(f.parte("trucha-der", pd, ...P(76, 16), { padre: "pelo", mov: { gira: { amp: 0.09, periodo: 2100, fase: 0.5 }, vaiven: { dy: -2, periodo: 2100, fase: 0.5 } } }));

  const ol = f.lienzo();
  olas(ol);
  partes.push(f.parte("olas", ol, ...P(30, 50), { mov: { vaiven: { dx: 2.5, periodo: 2600 } } }));

  const ll = f.lienzo();
  llave(ll, 92, -6);
  partes.push(f.parte("llave", ll, ...P(92, -6), { padre: "pelo", mov: { gira: { amp: 0.2, periodo: 2300 } } }));
  void [TURQUESA];
  return { largo: LARGO, partes, luces: [], marco: { x0: -ANCHO - 40, x1: LARGO + 40 } };
}

export { lunaDelLago as luna };
