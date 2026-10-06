// El Tablero del Diablo (pixel art pintado): una calavera de fiesta gigante, turquesa, que sonríe con sus
// dientes de oro y los ojos vivos en las cuencas hondas, con flores pintadas en la frente; dos diablitos
// (uno rojo y uno verde) enroscados en la cabeza como cuernos de carnero; la túnica azul y roja de pliegues
// que cae hasta la calle y tapa el camión; las manos levantadas de dedos huesudos y garras amarillas; y a
// sus pies, como un pesebre, el fraile y el diablo jugando ajedrez con la gente mirando.
// Todo se dibuja de frente a la pantalla en 3/4 (el lado izquierdo con luz, el derecho en sombra), en
// coordenadas de pantalla desde el origen de la carroza.
import type { Ramp, RGBA } from "../pixel";
import { BRILLO, Figura, LINEA, ojo, parpado } from "./figuras";
import { figurita } from "./munecos";
import type { CarrozaArte, Parte } from "./partes";
import { ANCHO, escena, floresBarniz, ORO, pantalla, parteBase, plataforma } from "./plataforma";
import { caja, capsula, circulo, corte, elipse, engordar, Pintura, poligono, rampa, resta, tono, union, type Forma } from "./pintura";

const LARGO = 104;
const HUESO = rampa("#45cfc2");
const CUENCA = rampa("#2a3a62");
const ROJO = rampa("#d8283a");
const AZUL = rampa("#2a52d0");
const VERDE = rampa("#3db842");
const AMARILLO = rampa("#f6c81c");
const NARANJA = rampa("#f2861c");
const MAGENTA = rampa("#d0287a");
const MARFIL = rampa("#f4ead8");
const NEGRO = rampa("#2a2236");
const FRAILE = rampa("#8a5a32");
const PIEL = [rampa("#e8b088"), rampa("#c98a5a"), rampa("#8a5a3a")];

/** El lienzo de la figura: cubre la carroza entera (pantalla de -60..130 en x y de -230..100 en y). */
const OX = 60;
const OY = 230;
const fig = () => new Figura(200, 340, OX, OY, [0, 0, 0]);
/** Un punto de pantalla (desde el origen de la carroza) en el lienzo. */
const P = (x: number, y: number): [number, number] => [x + OX, y + OY];
/** Una curva en coordenadas de pantalla. */
const curvaP = (p: Pintura, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, c: RGBA, g = 1) => p.curva(x0 + OX, y0 + OY, cx + OX, cy + OY, x1 + OX, y1 + OY, c, g);
const pol = (...pts: [number, number][]) => poligono(pts.map(([x, y]) => P(x, y)));
const el = (x: number, y: number, rx: number, ry: number, a = 0) => elipse(x + OX, y + OY, rx, ry, a);
const ci = (x: number, y: number, r: number) => circulo(x + OX, y + OY, r);
const cap = (ax: number, ay: number, bx: number, by: number, ra: number, rb = ra) => capsula(ax + OX, ay + OY, bx + OX, by + OY, ra, rb);

// Las esquinas de la plataforma en pantalla (con el faldón: 10 más abajo).
const FL = pantalla(0, ANCHO, -10);
const FC = pantalla(LARGO, ANCHO, -10);
const FR = pantalla(LARGO, 0, -10);
/** Los hombros de la calavera. */
const S = pantalla(LARGO * 0.46, ANCHO * 0.42, 60);
/** El centro del cráneo. */
const K = { x: S.x - 2, y: S.y - 33 };

/** Una flor pintada de cinco pétalos. */
function flor(p: Pintura, x: number, y: number, r: number, petalo: Ramp, centro: Ramp) {
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    p.volumen(el(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, r * 0.62, r * 0.45, a), petalo, { alto: 1.5, brillo: 0.3, borde: "oscuro" });
  }
  p.volumen(ci(x, y, r * 0.42), centro, { alto: 1.2, brillo: 0.8, borde: "oscuro" });
}

/** La túnica: dos caras (la de la luz y la de la sombra) con pliegues, bandas y el ruedo dorado. */
function tunica(p: Pintura) {
  const cuello: [number, number][] = [
    [S.x - 30, S.y + 2],
    [S.x - 4, S.y + 10],
    [S.x + 28, S.y + 4],
  ];
  const izq = pol(cuello[0]!, cuello[1]!, [FC.x, FC.y + 1], [FL.x - 2, FL.y + 2]);
  const der = pol(cuello[1]!, cuello[2]!, [FR.x + 2, FR.y + 1], [FC.x, FC.y + 1]);
  // Los pliegues: bandas que bajan de los hombros abriéndose, azul y roja, con la sombra del pliegue.
  const pliegue = (lado: number) => (q: { x: number; y: number }) => {
    const x = q.x - OX - S.x;
    const y = q.y - OY - S.y;
    const ang = Math.atan2(x, Math.max(1, y + 30));
    const k = ang * 6.5;
    const banda = Math.floor(k);
    return { banda, f: k - banda, lado };
  };
  for (const [forma, lado] of [
    [izq, 0],
    [der, 1],
  ] as const) {
    const pl = pliegue(lado);
    p.volumen(forma, AZUL, {
      alto: 30,
      planos: true,
      borde: "oscuro",
      patron: (q) => (pl(q).banda % 2 ? ROJO : AZUL),
      pinta: (q, c) => {
        const { f } = pl(q);
        const dy = q.y - OY;
        // El ruedo dorado con flores, cerca de la orilla de abajo.
        const hem = lado ? FC.y + ((FR.y - FC.y) * (q.x - OX - FC.x)) / (FR.x - FC.x) : FL.y + ((FC.y - FL.y) * (q.x - OX - FL.x)) / (FC.x - FL.x);
        if (dy > hem - 7) return tono(AMARILLO, dy > hem - 2 ? 2 : (q.x + q.y) % 6 < 2 ? 5 : 4);
        if (dy > hem - 9) return tono(ROJO, 1);
        // Pliegue: sombra honda en un lado de cada banda, luz en el otro.
        if (f > 0.82) return mixTono(c, -2);
        if (f < 0.14) return mixTono(c, 1);
        return lado ? mixTono(c, -1) : c;
      },
    });
  }
  // Los hombros anchos de la túnica, con el cuello dorado.
  p.volumen(el(S.x - 2, S.y + 8, 36, 12), ROJO, { alto: 8, planos: true, borde: "oscuro", patron: (q) => (q.x - OX < S.x - 2 ? AZUL : ROJO) });
  p.volumen(el(S.x - 2, S.y + 4, 15, 6), AMARILLO, { alto: 3, planos: true, borde: "oscuro" });
  // Flores bordadas en la túnica.
  for (const [x, y, c] of [
    [S.x - 30, S.y + 40, AMARILLO],
    [S.x - 12, S.y + 64, MAGENTA],
    [S.x + 20, S.y + 46, AMARILLO],
    [S.x - 44, S.y + 70, NARANJA],
  ] as const)
    flor(p, x, y, 4.5, c, ROJO);
  // El cuello de huesos.
  for (let k = 0; k < 3; k++) p.volumen(el(S.x - 2, S.y - 2 - k * 5, 9 - k, 3.4), HUESO, { alto: 2.5, sombra: 0.35, borde: "oscuro" });
}

/** Ajusta un color hacia más oscuro (k < 0) o más claro (k > 0), sin salir de la gama. */
function mixTono(c: RGBA, k: number): RGBA {
  const f = k < 0 ? 1 + k * 0.17 : 1 + k * 0.14;
  return [Math.min(255, Math.round(c[0] * f)), Math.min(255, Math.round(c[1] * f)), Math.min(255, Math.round(c[2] * f)), 255];
}

/** El cráneo: la frente ancha, los pómulos, las cuencas hondas con los ojos vivos, la nariz y los dientes de oro. */
function craneo(p: Pintura) {
  const { x, y } = K;
  const forma = union(el(x, y - 6, 31, 28), el(x - 3, y + 10, 26, 17), caja(x - 19 + OX, y + 12 + OY, x + 15 + OX, y + 26 + OY, 5));
  p.volumen(forma, HUESO, { alto: 18, planos: true, borde: "oscuro" });
  // La sien en sombra (el lado derecho, que da a la calle) y la luz de la frente.
  p.volumen(corte(forma, el(x + 26, y + 2, 12, 26)), HUESO, { alto: 10, base: -1.3, borde: false });
  p.volumen(el(x - 10, y - 22, 12, 6, -0.3), HUESO, { alto: 3, base: 1.1, borde: false });
  // Los pómulos marcados.
  for (const [cx, cy, r] of [
    [x - 22, y + 9, 7],
    [x + 15, y + 9, 6],
  ] as const)
    p.volumen(el(cx, cy, r, r * 0.7), HUESO, { alto: 4, base: 0.4, sombra: 0.4, borde: "oscuro" });
  // Las cuencas hondas (la de la izquierda más cerca de la cámara) con su borde de hueso.
  for (const [cx, cy, rx, ry] of [
    [x - 13, y - 1, 11, 10],
    [x + 9, y - 1, 10, 9.5],
  ] as const) {
    p.volumen(el(cx, cy, rx + 1.6, ry + 1.6), HUESO, { alto: 3, base: 0.9, borde: false });
    p.volumen(el(cx, cy, rx, ry), CUENCA, { alto: 6, base: -0.8, contraste: 2, brillo: 0, borde: "oscuro" });
    p.plano(el(cx + 1, cy + 2, rx * 0.8, ry * 0.7), tono(CUENCA, 0));
  }
  // La cresta de las cejas (la luz encima, la sombra que cae a la cuenca).
  curvaP(p, x - 26, y - 11, x - 13, y - 17, x - 2, y - 11, tono(HUESO, 5), 2);
  curvaP(p, x + 0, y - 11, x + 10, y - 16, x + 21, y - 10, tono(HUESO, 4), 2);
  // La nariz: un corazón al revés, hondo.
  p.volumen(pol([x - 6, y + 9], [x - 1, y + 7], [x + 3, y + 9], [x - 1.5, y + 17]), CUENCA, { alto: 2, base: -1, borde: "oscuro" });
  // Flores pintadas en la frente y remolinos rosados en las mejillas (calavera de fiesta).
  flor(p, x - 4, y - 24, 5, ROJO, AMARILLO);
  flor(p, x - 18, y - 19, 3.4, AMARILLO, ROJO);
  flor(p, x + 10, y - 20, 3.4, NARANJA, MAGENTA);
  for (const [cx, cy, l] of [
    [x - 22, y + 12, -1],
    [x + 15, y + 12, 1],
  ] as const) {
    curvaP(p, cx - 4 * l, cy - 3, cx + 2 * l, cy - 4, cx + 3 * l, cy + 1, tono(MAGENTA, 3), 1.4);
    p.plano(ci(cx + 3 * l, cy + 1, 1.2), tono(MAGENTA, 3));
  }
  // La sonrisa: la encía oscura y la fila de dientes de oro de arriba, uno por uno.
  p.volumen(pol([x - 19, y + 17], [x - 4, y + 21], [x + 13, y + 17], [x + 12, y + 22], [x - 4, y + 26], [x - 19, y + 22]), rampa("#5a1830"), { alto: 2, base: -1, borde: "oscuro" });
  dientes(p, x - 19, x + 13, y + 17.5, 8, 7.5);
}

/** Una fila de dientes de oro (en arco de sonrisa), cada uno con su brillo y la rayita oscura entre dos. */
function dientes(p: Pintura, x0: number, x1: number, y: number, n: number, alto: number, abajo = false) {
  const w = (x1 - x0) / n;
  for (let k = 0; k < n; k++) {
    const cx = x0 + w * (k + 0.5);
    const t = (k + 0.5) / n;
    const arco = Math.sin(t * Math.PI) * 3 * (abajo ? -1 : 1);
    const top = y + arco + (abajo ? -alto : 0);
    const forma = caja(cx - w / 2 + 0.6 + OX, top + OY, cx + w / 2 - 0.6 + OX, top + alto + OY, 1.2);
    p.volumen(forma, ORO, { alto: 2, brillo: 0.9, borde: "oscuro", planos: true });
    p.punto(Math.round(cx - w * 0.15 + OX), Math.round(top + 1.4 + OY), BRILLO);
  }
}

/** Los ojos vivos en las cuencas (iris naranja con brillo) y sus párpados (aparte, para el parpadeo). */
function ojos(p: Pintura, cerrados: boolean) {
  for (const [cx, w, l] of [
    [K.x - 13, 15, -1],
    [K.x + 9, 13.5, 1],
  ] as const) {
    const [ex, ey] = P(cx, K.y - 0.5);
    if (cerrados) parpado(p, ex, ey, w, 6, 5, l, HUESO, CUENCA);
    else ojo(p, ex, ey, w, 6, 5, l, { iris: NARANJA, pestanas: 0, mira: -1.2 });
  }
}

/** Un diablito enroscado como cuerno de carnero: el cuerpo a anillos en espiral, la cabeza con su cara y los cuernitos. */
function diablito(p: Pintura, lado: -1 | 1, color: Ramp, panza: Ramp) {
  const base = { x: K.x + lado * 20, y: K.y - 20 };
  const centro = { x: K.x + lado * 33, y: K.y - 38 };
  const pts: { x: number; y: number; r: number }[] = [];
  // Una espiral que sale del cráneo, sube, da la vuelta por afuera y se enrosca.
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    const a = Math.PI * (0.65 + t * 1.75);
    const rad = 17 * (1 - t * 0.5);
    const x = centro.x + lado * Math.cos(a) * rad;
    const y = centro.y + Math.sin(a) * rad * 0.95;
    const k = Math.min(1, i / 4);
    pts.push({ x: base.x + (x - base.x) * k, y: base.y + (y - base.y) * k, r: 6.2 - t * 2.2 });
  }
  pts.forEach((q, i) => p.volumen(ci(q.x, q.y, q.r), i % 3 === 0 ? panza : color, { alto: q.r * 0.8, planos: true, borde: "oscuro", sombra: i ? 0 : 0.4 }));
  // La colita con punta de flecha, colgando del cráneo.
  p.volumen(cap(base.x - lado * 2, base.y + 6, base.x + lado * 6, base.y + 18, 1.4), color, { alto: 1, borde: "oscuro" });
  p.volumen(pol([base.x + lado * 6, base.y + 15], [base.x + lado * 11, base.y + 20], [base.x + lado * 4, base.y + 22]), color, { alto: 1.4, borde: "oscuro" });
  // La cabeza al final de la espiral, con cara, cuernitos y un bracito que saluda.
  const h = pts[pts.length - 1]!;
  const hx = h.x + lado * 5;
  const hy = h.y - 9;
  for (const l of [-1, 1]) p.volumen(pol([hx + l * 3, hy - 4], [hx + l * 7, hy - 13], [hx + l * 6, hy - 3]), MARFIL, { alto: 1.5, borde: "oscuro", planos: true });
  p.volumen(cap(h.x, h.y, hx, hy + 2, 3.4), color, { alto: 2, borde: "oscuro" });
  p.volumen(cap(hx + lado * 4, hy + 2, hx + lado * 11, hy - 6, 1.6), color, { alto: 1.2, borde: "oscuro" });
  p.volumen(ci(hx + lado * 11.5, hy - 7, 2), color, { alto: 1.2, borde: "oscuro" });
  p.volumen(el(hx, hy, 7, 6.4), color, { alto: 5, brillo: 0.6, planos: true, borde: "oscuro" });
  for (const l of [-1, 1]) {
    p.plano(el(hx + l * 2.6, hy - 1, 2, 2.4), tono(MARFIL, 5));
    p.plano(ci(hx + l * 2.6 + lado * 0.6, hy - 0.6, 1.1), LINEA);
    p.punto(Math.round(hx + l * 2.6 - 0.6 + OX), Math.round(hy - 2 + OY), BRILLO);
  }
  curvaP(p, hx - 3.6, hy + 2.6, hx, hy + 6, hx + 3.6, hy + 2.6, LINEA, 1.2);
  p.punto(Math.round(hx + 1 + OX), Math.round(hy + 4 + OY), tono(MARFIL, 5));
}

/** Un brazo levantado: la manga con su puño dorado y la mano huesuda de dedos separados y garras. */
function brazo(p: Pintura, lado: -1 | 1) {
  const h = { x: S.x + lado * 26, y: S.y + 6 };
  const c = { x: S.x + lado * 50, y: S.y - 10 };
  const m = { x: S.x + lado * 56, y: S.y - 46 };
  p.volumen(cap(h.x, h.y, c.x, c.y, 10, 9), lado < 0 ? ROJO : AZUL, { alto: 6, planos: true, borde: "oscuro" });
  p.volumen(cap(c.x, c.y, m.x, m.y + 8, 9, 10), lado < 0 ? AZUL : ROJO, { alto: 6, planos: true, borde: "oscuro", sombra: 0.3 });
  p.volumen(el(m.x, m.y + 8, 11, 4.5, lado * 0.15), AMARILLO, { alto: 2.5, planos: true, borde: "oscuro" });
  // La muñeca y la palma de hueso.
  p.volumen(cap(m.x, m.y + 6, m.x + lado * 1, m.y - 3, 3.4), HUESO, { alto: 2, borde: "oscuro" });
  p.volumen(el(m.x + lado * 1, m.y - 6, 7, 5), HUESO, { alto: 3, planos: true, borde: "oscuro" });
  // Cuatro dedos huesudos abiertos, cada uno de dos huesos con su nudillo, y la garra amarilla curva.
  for (let k = 0; k < 4; k++) {
    const a = -Math.PI / 2 + lado * (-0.55 + k * 0.36);
    const b0 = { x: m.x + lado * 1 + Math.cos(a) * 5, y: m.y - 6 + Math.sin(a) * 4 };
    const b1 = { x: b0.x + Math.cos(a) * 7, y: b0.y + Math.sin(a) * 7 };
    const a2 = a + lado * 0.25;
    const b2 = { x: b1.x + Math.cos(a2) * 6, y: b1.y + Math.sin(a2) * 6 };
    p.volumen(cap(b0.x, b0.y, b1.x, b1.y, 1.7, 1.5), HUESO, { alto: 1.2, borde: "oscuro" });
    p.volumen(ci(b1.x, b1.y, 2), HUESO, { alto: 1.4, borde: "oscuro", base: 0.6 });
    p.volumen(cap(b1.x, b1.y, b2.x, b2.y, 1.5, 1.3), HUESO, { alto: 1.2, borde: "oscuro" });
    const a3 = a2 + lado * 0.6;
    p.volumen(pol([b2.x - 2.2, b2.y + 0.5], [b2.x + 2.2, b2.y + 0.5], [b2.x + Math.cos(a3) * 10, b2.y + Math.sin(a3) * 10]), AMARILLO, { alto: 1.4, brillo: 0.9, borde: "oscuro", planos: true });
  }
  // El pulgar.
  const tb = { x: m.x - lado * 7, y: m.y - 4 };
  p.volumen(cap(m.x - lado * 3, m.y - 3, tb.x, tb.y - 5, 1.7, 1.4), HUESO, { alto: 1.2, borde: "oscuro" });
  p.volumen(pol([tb.x - 1.4, tb.y - 5], [tb.x + 1.4, tb.y - 5], [tb.x - lado * 4, tb.y - 11]), AMARILLO, { alto: 1.2, brillo: 0.9, borde: "oscuro" });
  return h;
}

/** La escena a sus pies: el escalón con el tablero, el fraile y el diablo jugando, y la gente mirando. */
function escenaAbajo(p: Pintura) {
  // El escalón en 3/4: la tapa de cuadros y las dos caras doradas.
  const a = pantalla(LARGO * 0.6, ANCHO + 2, 4);
  const w = 30;
  const d = 12;
  const tapa = pol([a.x, a.y], [a.x + w, a.y + w / 2], [a.x + w - d, a.y + w / 2 + d / 2], [a.x - d, a.y + d / 2]);
  p.plano(tapa, (x, y) => ((Math.floor((x - OX - a.x + (y - OY - a.y) * 2) / 7.5) + Math.floor((-(x - OX - a.x) + (y - OY - a.y) * 2) / 7.5)) % 2 ? tono(NEGRO, 3) : tono(MARFIL, 4)));
  p.plano(pol([a.x - d, a.y + d / 2], [a.x + w - d, a.y + w / 2 + d / 2], [a.x + w - d, a.y + w / 2 + d / 2 + 5], [a.x - d, a.y + d / 2 + 5]), tono(AMARILLO, 4));
  p.plano(pol([a.x + w - d, a.y + w / 2 + d / 2], [a.x + w, a.y + w / 2], [a.x + w, a.y + w / 2 + 5], [a.x + w - d, a.y + w / 2 + d / 2 + 5]), tono(AMARILLO, 2));
  // Las piezas sobre el tablero.
  for (let k = 0; k < 5; k++) {
    const px = a.x + 4 + k * 4.4;
    const py = a.y + 4 + k * 2.2;
    p.volumen(union(el(px, py, 1.6, 2.4), el(px, py - 3, 1.2, 1.2)), k % 2 ? NEGRO : MARFIL, { alto: 1, borde: "oscuro" });
  }
  // El fraile (de hábito café, con su calva) a la izquierda y el diablo (rojo, con cuernos) a la derecha.
  const [fx, fy] = P(a.x - 8, a.y + 6);
  figurita(p, fx, fy, 0.78, { piel: PIEL[0]!, ropa: FRAILE, falda: true });
  p.volumen(el(fx, fy - 38, 6.6, 3), FRAILE, { alto: 2, borde: "oscuro" });
  const [dx, dy] = P(a.x + w + 6, a.y + w / 2 + 2);
  figurita(p, dx, dy, 0.78, { piel: ROJO, ropa: NEGRO });
  for (const l of [-1, 1]) p.volumen(poligono([[dx + l * 3, dy - 37], [dx + l * 6, dy - 44], [dx + l * 5.4, dy - 36]]), MARFIL, { alto: 1, borde: "oscuro" });
}

/** Un mirón de la escena (para que se mezan aparte). */
function miron(f: Figura, id: string, x: number, y: number, k: number, fase: number): Parte {
  const p = f.lienzo();
  const [cx, cy] = P(x, y);
  figurita(p, cx, cy, 0.8, { piel: PIEL[k % 3]!, ropa: [AZUL, VERDE, NARANJA][k % 3]!, sombrero: [ROJO, AMARILLO, VERDE][k % 3]!, pelo: NEGRO });
  return f.parte(id, p, cx, cy, { mov: { gira: { amp: 0.07, periodo: 1500 + k * 200, fase }, vaiven: { dy: -1.2, periodo: 800, fase } } });
}

export function calavera(): CarrozaArte {
  const s = escena(LARGO, 20);
  plataforma(s, LARGO, { faldon: floresBarniz(ROJO, [AMARILLO, VERDE, AZUL], AMARILLO), cubierta: () => tono(NEGRO, 3), flecos: [ROJO, AMARILLO, AZUL, VERDE] }, false);
  const f = fig();
  const piv = (x: number, y: number) => P(x, y);

  const cuerpo = f.lienzo();
  tunica(cuerpo);
  const brazos = (lado: -1 | 1) => {
    const p = f.lienzo();
    const h = brazo(p, lado);
    return f.parte(lado < 0 ? "garra-izq" : "garra-der", p, ...piv(h.x, h.y), { padre: "cuerpo", mov: { gira: { amp: 0.09, periodo: 2300, fase: lado < 0 ? 0 : 0.5 } } });
  };
  const cabeza = f.lienzo();
  craneo(cabeza);
  ojos(cabeza, false);
  const parp = f.lienzo();
  ojos(parp, true);
  // La mandíbula de abajo (se abre y se cierra): el hueso angular y los dientes de abajo.
  const mand = f.lienzo();
  const { x, y } = K;
  mand.volumen(pol([x - 21, y + 21], [x + 15, y + 20], [x + 13, y + 30], [x + 2, y + 37], [x - 10, y + 37], [x - 20, y + 30]), HUESO, { alto: 6, planos: true, borde: "oscuro" });
  mand.volumen(el(x - 4, y + 34, 8, 3), HUESO, { alto: 2, base: 0.8, borde: false });
  dientes(mand, x - 17, x + 12, y + 30, 7, 6, true);
  const diab = f.lienzo();
  diablito(diab, -1, ROJO, rampa("#f2a21c"));
  diablito(diab, 1, VERDE, AMARILLO);
  const abajo = f.lienzo();
  escenaAbajo(abajo);

  const partes = [
    parteBase(s),
    brazos(-1),
    f.parte("cuerpo", cuerpo, ...piv(S.x, S.y + 60), { mov: { gira: { amp: 0.008, periodo: 6000 } } }),
    brazos(1),
    f.parte("cabeza", cabeza, ...piv(K.x, K.y + 26), { padre: "cuerpo", mov: { gira: { amp: 0.05, periodo: 3900 } } }),
    f.parte("parpados", parp, ...piv(K.x, K.y + 26), { padre: "cabeza", contorno: false, mov: { parpadeo: { cada: 3600, dura: 200 } } }),
    f.parte("mandibula", mand, ...piv(K.x, K.y + 22), { padre: "cabeza", mov: { vaiven: { dy: 1.6, periodo: 900 } } }),
    f.parte("diablitos", diab, ...piv(K.x, K.y - 20), { padre: "cabeza", mov: { gira: { amp: 0.03, periodo: 1700 } } }),
    f.parte("escena", abajo, ...piv(FC.x, FC.y)),
    miron(f, "miron-1", FL.x + 14, FL.y + 2, 0, 0),
    miron(f, "miron-2", FL.x + 34, FL.y + 12, 1, 0.3),
    miron(f, "miron-3", FR.x - 10, FR.y - 6, 2, 0.6),
  ];
  void [engordar, resta, LINEA];
  return { largo: LARGO, partes, luces: [], marco: { x0: -ANCHO - 40, x1: LARGO + 40 } };
}

export type { Forma };
