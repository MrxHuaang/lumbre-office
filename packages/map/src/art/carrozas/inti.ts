// El Inti que canta (pixel art pintado): el sol andino gigante al frente, de cara dorada que se ríe con la
// boca abierta, mejillas pintadas con espirales rojas y filigranas turquesas, el rombo en la frente y los
// aretes de espiral; alrededor, un aro tejido de todos los colores y las llamas doradas de los rayos, que
// dan vueltas (las largas para un lado y las cortas para el otro). Detrás, el cuerpo de plumas del arcoíris
// que corre hasta la cola, levantada atrás; sobre una tarima, un jaguar manchado y más músicos. Por la
// orilla, los zampoñeros de ruana a rayas y penacho de plumas, que tocan, y dos bombos pintados.
// Todo de frente a la pantalla en 3/4 (luz de arriba a la izquierda), en coordenadas de pantalla desde el
// origen de la carroza.
import { bayer, type Ramp, type RGBA } from "../pixel";
import { ARCOIRIS, BRILLO, Figura, LINEA, mejilla, ojo, parpado, pluma, sonrisa } from "./figuras";
import type { CarrozaArte, Parte } from "./partes";
import { ANCHO, escena, ORO, pantalla, parteBase, plataforma, rombosAndinos } from "./plataforma";
import { capsula, circulo, elipse, Pintura, poligono, rampa, resta, tono, union, type Forma } from "./pintura";

const LARGO = 104;
const SOL = rampa("#f4b41c");
const LLAMA = rampa("#f6a61c");
const NARANJA = rampa("#ee6a1c");
const ROJO = rampa("#e0283c");
const FUCSIA = rampa("#d0287a");
const MORADO = rampa("#8a3cc8");
const AZUL = rampa("#2f6fd6");
const VERDE = rampa("#3db842");
const AMARILLO = rampa("#f7d21c");
const TURQUESA = rampa("#1fb8b0");
const CAFE = rampa("#6a3a1a");
const LABIO = rampa("#e0502a");
const BAMBU = rampa("#e6c050");
const MADERA = rampa("#9a6a30");
const CUERO = rampa("#f2e2c0");
const JAGUAR = rampa("#e8a030");
const PELO = rampa("#2a1e26");
const PIEL = [rampa("#d9a066"), rampa("#c68642"), rampa("#e0ac69"), rampa("#f1c27d")];
/** Las bandas del aro tejido, de afuera hacia adentro. */
const ARO = [FUCSIA, MORADO, AZUL, TURQUESA, VERDE, AMARILLO, NARANJA];

const OX = 80;
const OY = 230;
const P = (x: number, y: number): [number, number] => [x + OX, y + OY];
const pol = (...pts: [number, number][]) => poligono(pts.map(([x, y]) => P(x, y)));
const el = (x: number, y: number, rx: number, ry: number, a = 0) => elipse(x + OX, y + OY, rx, ry, a);
const ci = (x: number, y: number, r: number) => circulo(x + OX, y + OY, r);
const cap = (ax: number, ay: number, bx: number, by: number, ra: number, rb = ra) => capsula(ax + OX, ay + OY, bx + OX, by + OY, ra, rb);
const curvaP = (p: Pintura, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, c: RGBA, g = 1) => p.curva(x0 + OX, y0 + OY, cx + OX, cy + OY, x1 + OX, y1 + OY, c, g);
const fig = () => new Figura(250, 330, OX, OY, [0, 0, 0]);
const op = { planos: true, borde: "oscuro" as const };

/** El centro del sol (adelante, arriba). */
const S = (() => {
  const s = pantalla(LARGO * 0.8, ANCHO * 0.4, 52);
  return { x: s.x, y: s.y };
})();

/** Una espiral pintada (filigrana). */
function espiral(p: Pintura, x: number, y: number, r: number, lado: 1 | -1, col: RGBA, g = 1, vueltas = 2.2) {
  let px = x;
  let py = y;
  for (let i = 1; i <= 24; i++) {
    const t = i / 24;
    const a = t * Math.PI * vueltas;
    const qx = x + lado * Math.cos(a) * r * t;
    const qy = y - Math.sin(a) * r * t;
    p.trazo(px + OX, py + OY, qx + OX, qy + OY, col, g);
    px = qx;
    py = qy;
  }
}

// ---------- El sol ----------

/** Un rayo en llama: sale del aro en el ángulo `ang`, ondulado, con la veta naranja y un rizo en la base. */
function rayo(p: Pintura, ang: number, r0: number, r1: number, ancho: number, onda: number) {
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const izq: [number, number][] = [];
  const der: [number, number][] = [];
  const centro: { x: number; y: number }[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const r = r0 + (r1 - r0) * t;
    const off = Math.sin(t * Math.PI * 1.6) * onda * t;
    const w = ancho * Math.pow(1 - t, 0.75) + 0.4;
    const cx = S.x + ux * r - uy * off;
    const cy = S.y + uy * r + ux * off;
    centro.push({ x: cx, y: cy });
    izq.push([cx - uy * w, cy + ux * w]);
    der.push([cx + uy * w, cy - ux * w]);
  }
  p.volumen(pol(...izq, ...der.reverse()), LLAMA, { alto: 4, ...op, brillo: 0.7, sombra: 0.35 });
  // La veta del centro y el rizo de la base.
  for (let i = 2; i < 9; i++) p.trazo(centro[i]!.x + OX, centro[i]!.y + OY, centro[i + 1]!.x + OX, centro[i + 1]!.y + OY, tono(NARANJA, 3), 1);
  const b = centro[2]!;
  espiral(p, b.x, b.y, 2.6, 1, tono(NARANJA, 2));
}

/** Las llamas largas (o las cortas) alrededor del sol. Cada juego es una parte que da vueltas. */
function rayos(p: Pintura, largos: boolean) {
  const n = 8;
  for (let k = 0; k < n; k++) {
    const ang = ((k + (largos ? 0 : 0.5)) / n) * Math.PI * 2 - Math.PI / 2;
    if (largos) rayo(p, ang, 27, 46, 8.5, 4);
    else rayo(p, ang, 27, 39, 7, 3);
  }
}

/** El aro tejido de colores: siete bandas de ladrillitos (como un tejido de chumbe) entre los rayos y la cara. */
function aro(p: Pintura) {
  const forma = resta(ci(S.x, S.y, 31), ci(S.x, S.y, 21));
  p.volumen(forma, FUCSIA, {
    alto: 6,
    ...op,
    patron: (q) => {
      const r = Math.hypot(q.x + 0.5 - OX - S.x, q.y + 0.5 - OY - S.y);
      return ARO[Math.max(0, Math.min(ARO.length - 1, Math.floor((31 - r) / 1.45)))]!;
    },
    pinta: (q, c) => {
      const dx = q.x + 0.5 - OX - S.x;
      const dy = q.y + 0.5 - OY - S.y;
      const r = Math.hypot(dx, dy);
      const banda = Math.floor((31 - r) / 1.45);
      const ang = Math.atan2(dy, dx) + (banda % 2) * 0.09;
      const f = (((ang / (Math.PI * 2)) * 36) % 1 + 1) % 1;
      // Las juntas de los ladrillitos del tejido.
      if (f < 0.14) return mezcla(c, LINEA, 0.35);
      if (((31 - r) % 1.45) < 0.35) return mezcla(c, LINEA, 0.2);
      return f > 0.6 && bayer(q.x, q.y) > 0.5 ? mezcla(c, BRILLO, 0.18) : c;
    },
  });
}

const mezcla = (a: RGBA, b: RGBA, t: number): RGBA => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t), 255];

/** La cara del sol: dorada y moteada, ojos grandes, cejas cafés, la nariz, la risa, las mejillas y los adornos. */
function cara(p: Pintura) {
  const { x, y } = S;
  const forma = union(el(x, y, 23, 24), el(x, y + 6, 21, 20));
  p.volumen(forma, SOL, { alto: 16, ...op, pinta: (q, c) => (bayer(q.x, q.y) > 0.9 ? tono(SOL, 5) : bayer(q.x * 3, q.y) < 0.05 ? tono(SOL, 2) : c) });
  // Los aretes de espiral, a los lados.
  for (const l of [-1, 1] as const) {
    p.volumen(ci(x + l * 23, y + 8, 4.6), ORO, { alto: 2, ...op, brillo: 0.9, sombra: 0.35 });
    espiral(p, x + l * 23, y + 8, 3.4, l, tono(NARANJA, 1));
  }
  // El rombo de la frente con sus volutas turquesas.
  p.volumen(pol([x, y - 22], [x + 5, y - 16], [x, y - 10], [x - 5, y - 16]), ROJO, { alto: 2, ...op, brillo: 0.8 });
  p.volumen(pol([x, y - 19.4], [x + 2.4, y - 16], [x, y - 12.6], [x - 2.4, y - 16]), TURQUESA, { alto: 1, borde: false, brillo: 1 });
  for (const l of [-1, 1] as const) espiral(p, x + l * 8, y - 18, 3, l, tono(TURQUESA, 3), 1, 1.6);
  // Las cejas gruesas y arqueadas.
  for (const l of [-1, 1] as const) curvaP(p, x + l * 3, y - 9.5, x + l * 9, y - 15, x + l * 15.5, y - 10, tono(CAFE, 1), 2.4);
  // Los ojos grandes (cafés, alegres).
  for (const l of [-1, 1] as const) ojo(p, x + OX + l * 8.5, y + OY - 4, 11, 5, 4.6, l, { iris: rampa("#8a4a1a"), pestanas: 0, mira: -0.6, linea: 1.5 });
  // La mejilla izquierda: el círculo rojo con su espiral; la derecha, filigrana turquesa que baja a la barbilla.
  mejilla(p, x - 13 + OX, y + 7 + OY, 5, 4, tono(ROJO, 3));
  espiral(p, x - 13, y + 7, 3.6, -1, tono(ROJO, 1), 1);
  mejilla(p, x + 13 + OX, y + 7 + OY, 4.4, 3.6, tono(NARANJA, 3));
  espiral(p, x + 13, y + 7, 3.2, 1, tono(ROJO, 1), 1);
  curvaP(p, x + 19, y + 12, x + 14, y + 24, x + 2, y + 25, tono(TURQUESA, 3), 1.6);
  curvaP(p, x - 19, y + 13, x - 14, y + 23, x - 4, y + 25, tono(AZUL, 3), 1.4);
  espiral(p, x + 6, y + 24, 2.4, 1, tono(TURQUESA, 3));
  espiral(p, x - 7, y + 24, 2.4, -1, tono(AZUL, 3));
  // La nariz.
  p.volumen(union(el(x, y + 4, 4.4, 3.4), el(x, y, 2.2, 4)), SOL, { alto: 3, base: 0.6, borde: "oscuro", sombra: 0.4, brillo: 0.9 });
  for (const l of [-1, 1]) p.plano(el(x + l * 1.8, y + 5.6, 1.1, 0.8), tono(CAFE, 1));
  // La risa grande.
  sonrisa(p, x + OX, y + OY + 11, 20, 8, LABIO);
}

// ---------- El cuerpo de plumas, la tarima y el jaguar ----------

/** El camino del cuerpo de plumas (de debajo del sol hacia atrás, y la cola que se levanta), en px de pantalla. */
const CAMINO = [
  [100, 18, 8, 13],
  [86, 22, 18, 15],
  [70, 25, 30, 15],
  [54, 27, 38, 14],
  [38, 28, 40, 13],
  [24, 29, 38, 12],
  [12, 30, 36, 10],
  [5, 29, 44, 8],
  [3, 27, 54, 6],
].map(([u, v, z, r]) => ({ ...pantalla(u!, v!, z!), r: r! }));

/** Una pluma corta y redonda (una escama del cuerpo de plumas), con la punta hacia `ang`. */
function plumita(x: number, y: number, ang: number, largo: number, ancho: number): Forma {
  const tx = x + Math.cos(ang) * largo;
  const ty = y + Math.sin(ang) * largo;
  return union(el((x + tx) / 2, (y + ty) / 2, largo / 2, ancho, ang), ci(x, y, ancho * 0.8));
}

function cuerpoPlumas(p: Pintura) {
  const masa = union(...CAMINO.slice(1).map((q, i) => cap(CAMINO[i]!.x, CAMINO[i]!.y, q.x, q.y, CAMINO[i]!.r * 0.8, q.r * 0.8)));
  p.volumen(masa, AMARILLO, { alto: 12, ...op });
  // Filas de plumitas, de la cola hacia el sol, cada una corrida de color (las bandas del arcoíris en diagonal).
  let k = 0;
  for (let i = CAMINO.length - 2; i >= 0; i--) {
    const a = CAMINO[i]!;
    const b = CAMINO[i + 1]!;
    const n = Math.max(3, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 2.6));
    for (let j = n; j >= 0; j--) {
      const t = j / n;
      const cx = a.x + (b.x - a.x) * t;
      const cy = a.y + (b.y - a.y) * t;
      const r = a.r + (b.r - a.r) * t;
      const dir = Math.atan2(b.y - a.y, b.x - a.x);
      for (let m = -2; m <= 2; m++) {
        const px = cx + Math.cos(dir + Math.PI / 2) * m * r * 0.42;
        const py = cy + Math.sin(dir + Math.PI / 2) * m * r * 0.42 - r * 0.25;
        k++;
        const col = ARCOIRIS[(((i * 3 + j + m * 2) % 7) + 7) % 7]!;
        p.volumen(plumita(px, py, dir + 0.5 + m * 0.12, r * 0.55, r * 0.34), col, { alto: 2, ...op, sombra: 0.3, brillo: 0.5 });
      }
    }
  }
  void k;
  // La cola: un abanico de plumas largas del arcoíris que se levanta atrás.
  const c = CAMINO[CAMINO.length - 1]!;
  for (let m = 0; m < 7; m++) pluma(p, c.x + OX, c.y + OY + 4, -Math.PI / 2 - 0.9 + m * 0.26, 26 - Math.abs(m - 3) * 2, 8, ARCOIRIS[m]!);
}

/** La tarima de atrás: dos escalones de madera dorada con baranda. */
function tarima(p: Pintura) {
  const caja3 = (u0: number, v0: number, u1: number, v1: number, z0: number, z1: number, col: Ramp) => {
    const a = pantalla(u0, v1, z1);
    const b = pantalla(u1, v1, z1);
    const c = pantalla(u1, v0, z1);
    const d = pantalla(u0, v0, z1);
    p.volumen(pol([a.x, a.y], [b.x, b.y], [c.x, c.y], [d.x, d.y]), col, { alto: 2, ...op, base: 0.8 });
    const a0 = pantalla(u0, v1, z0);
    const b0 = pantalla(u1, v1, z0);
    const c0 = pantalla(u1, v0, z0);
    p.volumen(pol([a.x, a.y], [b.x, b.y], [b0.x, b0.y], [a0.x, a0.y]), col, { alto: 1, ...op, base: -0.2, pinta: (q, cc) => ((q.x - OX + 200) % 5 < 1 ? tono(col, 1) : cc) });
    p.volumen(pol([b.x, b.y], [c.x, c.y], [c0.x, c0.y], [b0.x, b0.y]), col, { alto: 1, ...op, base: -1.2 });
    // El ribete dorado.
    p.trazo(a.x + OX, a.y + OY, b.x + OX, b.y + OY, tono(ORO, 4), 1);
  };
  caja3(2, 2, 34, 20, 0, 12, MADERA);
  caja3(4, 3, 22, 12, 12, 20, MADERA);
  // La baranda con postes torneados.
  for (let u = 4; u <= 22; u += 4.5) {
    const a = pantalla(u, 12, 20);
    p.volumen(cap(a.x, a.y, a.x, a.y - 7, 1), ORO, { alto: 1, ...op, brillo: 0.9 });
    p.volumen(ci(a.x, a.y - 7.6, 1.4), ORO, { alto: 1, ...op, brillo: 1 });
  }
  const r0 = pantalla(4, 12, 26);
  const r1 = pantalla(22, 12, 26);
  p.trazo(r0.x + OX, r0.y + OY, r1.x + OX, r1.y + OY, tono(ORO, 4), 1.4);
}

/** El jaguar echado sobre las plumas, de frente: la cabeza grande y manchada, las orejas, el hocico blanco. */
function jaguar(p: Pintura, x: number, y: number) {
  const k = 1.25;
  const K = (v: number) => v * k;
  // El lomo manchado, echado hacia atrás, y la cola.
  p.volumen(el(x - K(12), y + K(6), K(15), K(7), -0.25), JAGUAR, { alto: 6, ...op, pinta: (q, c) => manchas(q, c) });
  curvaP(p, x - K(24), y + K(10), x - K(32), y + K(4), x - K(28), y - K(4), tono(JAGUAR, 2), 2.4);
  // Las orejas redondas con el centro oscuro.
  for (const l of [-1, 1]) {
    p.volumen(ci(x + l * K(7.4), y - K(7.6), K(3.6)), JAGUAR, { alto: 2, ...op });
    p.volumen(ci(x + l * K(7.4), y - K(7.2), K(1.9)), rampa("#5a3020"), { alto: 1, borde: false });
  }
  // La cabeza ancha: la frente manchada y las mejillas claras.
  p.volumen(union(el(x, y - K(1), K(10), K(8.4)), el(x, y + K(3), K(9), K(6.6))), JAGUAR, {
    alto: 7,
    ...op,
    brillo: 0.5,
    pinta: (q, c) => {
      const v = q.y - OY - y;
      if (v > K(1) && Math.abs(q.x - OX - x) < K(7)) return c;
      return manchas(q, c, true);
    },
  });
  // Los ojos ámbar con la raya oscura que baja al hocico.
  for (const l of [-1, 1]) {
    const ex = x + l * K(4.2);
    const ey = y - K(1.6);
    p.plano(el(ex, ey, K(2.4), K(1.6)), tono(rampa("#d8c02a"), 4));
    p.plano(el(ex + l * 0.3, ey, K(0.8), K(1.4)), LINEA);
    p.punto(Math.round(ex - 1 + OX), Math.round(ey - 1 + OY), BRILLO);
    p.trazo(ex - l * K(2.4) + OX, ey - K(0.6) + OY, ex + l * K(2.6) + OX, ey - K(1.4) + OY, LINEA, 1);
    p.trazo(ex - l * K(2) + OX, ey + K(1.2) + OY, x - l * K(1.6) + OX, y + K(2.6) + OY, tono(PELO, 2), 1);
  }
  // El hocico blanco, la nariz rosada, la boca y los bigotes.
  p.volumen(union(el(x - K(2.6), y + K(4.6), K(3.6), K(2.8)), el(x + K(2.6), y + K(4.6), K(3.6), K(2.8)), el(x, y + K(7), K(3), K(2))), CUERO, { alto: 2, ...op });
  p.volumen(pol([x - K(2.4), y + K(1.6)], [x + K(2.4), y + K(1.6)], [x, y + K(4)]), rampa("#e07a7a"), { alto: 1, borde: "oscuro", brillo: 0.9 });
  curvaP(p, x - K(2.8), y + K(6), x, y + K(7.4), x + K(2.8), y + K(6), LINEA, 1);
  p.plano(ci(x, y + K(5.2), 0.6), LINEA);
  for (const l of [-1, 1]) {
    p.trazo(x + l * K(5) + OX, y + K(4.4) + OY, x + l * K(11) + OX, y + K(3.4) + OY, tono(CUERO, 4), 1);
    p.trazo(x + l * K(5) + OX, y + K(5.6) + OY, x + l * K(11) + OX, y + K(6.4) + OY, tono(CUERO, 4), 1);
  }
  // Las patas delanteras, adelante.
  for (const l of [-1, 1]) p.volumen(el(x + l * K(5.4), y + K(10.4), K(3.4), K(2.2)), JAGUAR, { alto: 1.4, ...op, pinta: (q, c) => manchas(q, c) });
}

/** Las manchas del jaguar: rosetas negras con el centro más oscuro. */
function manchas(q: { x: number; y: number }, c: RGBA, cara = false): RGBA {
  const s = cara ? 3.4 : 4.4;
  const fy = Math.floor(q.y / s);
  const fx = Math.floor((q.x + (fy % 2) * s * 0.5) / s);
  const cx = (fx + 0.5) * s - (fy % 2) * s * 0.5;
  const cy = (fy + 0.5) * s;
  const d = Math.hypot(q.x + 0.5 - cx, q.y + 0.5 - cy);
  if ((fx * 7 + fy * 3) % 4 === 0) return c;
  if (d < (cara ? 0.9 : 1.6)) return cara ? tono(PELO, 2) : tono(JAGUAR, 1);
  if (!cara && d < 2.1) return tono(PELO, 2);
  return c;
}

// ---------- Los músicos ----------

/** Un zampoñero (pies en x, y): ruana a rayas, cintillo tejido, penacho de plumas y la zampoña en la boca. */
function zamponero(p: Pintura, x: number, y: number, s: number, k: number, tambor = false) {
  const S2 = (v: number) => v * s;
  const piel = PIEL[k % PIEL.length]!;
  const rayas = [ARCOIRIS[k % 7]!, ARCOIRIS[(k + 2) % 7]!, ARCOIRIS[(k + 4) % 7]!, AMARILLO];
  // El penacho (detrás de la cabeza).
  for (let m = 0; m < 5; m++) pluma(p, x + OX, y + OY - S2(29), -Math.PI / 2 + (m - 2) * 0.38, S2(11) - Math.abs(m - 2) * S2(1.2), S2(4), ARCOIRIS[(k + m) % 7]!);
  // Las piernas y las sandalias.
  for (const l of [-1, 1]) {
    p.volumen(cap(x + l * S2(2.2), y - S2(8), x + l * S2(2.4), y - S2(1.5), S2(1.6)), CAFE, { alto: 1, ...op });
    p.volumen(el(x + l * S2(2.6), y - S2(0.8), S2(2), S2(1)), rampa("#8a5a30"), { alto: 1, ...op });
  }
  // La ruana larga de rayas, con el ribete de flecos.
  const ruana = pol([x - S2(4), y - S2(21)], [x + S2(4), y - S2(21)], [x + S2(8), y - S2(7)], [x - S2(8), y - S2(7)]);
  p.volumen(ruana, rayas[0]!, { alto: S2(3), ...op, patron: (q) => rayas[Math.floor((q.x - OX - x + S2(20)) / S2(1.8)) % rayas.length]! });
  for (let i = -3; i <= 3; i++) p.punto(Math.round(x + i * S2(2.2) + OX), Math.round(y - S2(6.3) + OY), tono(AMARILLO, 4));
  // La cabeza: el pelo negro largo, la cara, el cintillo tejido.
  const hy = y - S2(26);
  p.volumen(union(el(x, hy - S2(1), S2(5.4), S2(5)), cap(x - S2(4.4), hy, x - S2(4.4), hy + S2(3.6), S2(1.2)), cap(x + S2(4.4), hy, x + S2(4.4), hy + S2(3.6), S2(1.2))), PELO, { alto: 2, ...op });
  p.volumen(el(x, hy + S2(0.8), S2(4.6), S2(4.8)), piel, { alto: S2(3), ...op, brillo: 0.5 });
  p.volumen(caja4(x - S2(5.4), hy - S2(4), x + S2(5.4), hy - S2(2)), ROJO, { alto: 1, ...op, pinta: (q, c) => ((q.x + q.y) % 3 === 0 ? tono(AMARILLO, 4) : c) });
  for (const l of [-1, 1]) {
    p.plano(el(x + l * S2(1.8), hy, Math.max(0.6, S2(0.7)), Math.max(0.8, S2(1))), LINEA);
    p.punto(Math.round(x + l * S2(1.8) - 0.4 + OX), Math.round(hy - S2(0.6) + OY), BRILLO);
  }
  if (tambor) {
    // Con la maza del bombo levantada.
    p.volumen(cap(x + S2(4), y - S2(18), x + S2(8), y - S2(25), S2(1.4)), rayas[1]!, { alto: 1, ...op });
    p.volumen(cap(x + S2(8), y - S2(25), x + S2(11), y - S2(31), S2(0.7)), MADERA, { alto: 1, ...op });
    p.volumen(ci(x + S2(11.4), y - S2(32), S2(1.8)), CUERO, { alto: 1, ...op });
    p.volumen(cap(x - S2(4), y - S2(18), x - S2(6), y - S2(12), S2(1.4)), rayas[1]!, { alto: 1, ...op });
    return;
  }
  // Los brazos que sostienen la zampoña frente a la boca.
  for (const l of [-1, 1]) p.volumen(cap(x + l * S2(4), y - S2(18), x + l * S2(3.4), y - S2(20.5), S2(1.5)), rayas[1]!, { alto: 1, ...op });
  // La zampoña: cañas doradas de largo que baja (cada una con su luz y su sombra), amarradas con una cinta roja.
  const z0 = x - S2(5);
  const ancho = S2(10.4);
  p.plano(caja4(z0 - 0.5, hy + S2(2.6), z0 + ancho + 0.5, hy + S2(14)), (qx, qy) => {
    const u = qx + 0.5 - OX - z0;
    const v = qy + 0.5 - OY - (hy + S2(3));
    const i = Math.floor(u / (ancho / 6));
    if (i < 0 || i > 5) return null;
    if (v < 0 || v > S2(11) - i * S2(1.3)) return null;
    const f = (u % (ancho / 6)) / (ancho / 6);
    if (v < 1) return tono(BAMBU, 1);
    return tono(BAMBU, f < 0.45 ? 5 : f < 0.8 ? 3 : 1);
  });
  p.plano(caja4(x - S2(5), hy + S2(7), x + S2(5.4), hy + S2(8)), tono(ROJO, 3));
  for (const l of [-1, 1]) p.volumen(ci(x + l * S2(4.4), hy + S2(6.4), S2(1.6)), piel, { alto: 1, ...op });
}

const caja4 = (x0: number, y0: number, x1: number, y1: number): Forma => pol([x0, y0], [x1, y0], [x1, y1], [x0, y1]);

/** Un bombo andino parado (de cuero de chivo), con la caja pintada en zigzag. */
function bombo(p: Pintura, x: number, y: number, r: number) {
  const cuerpo = union(caja4(x - r, y - r * 1.5, x + r, y - r * 0.3), el(x, y - r * 0.3, r, r * 0.42));
  p.volumen(cuerpo, ROJO, {
    alto: r * 0.8,
    ...op,
    patron: (q) => {
      const u = q.x - OX - x + r;
      const v = q.y - OY - y + r * 1.5;
      const z = Math.abs(((u % 5) + 5) % 5 - 2.5);
      return Math.abs(v - r * 0.6 - z) < 1.1 ? AMARILLO : Math.abs(v - r * 0.6 - z) < 2 ? VERDE : ROJO;
    },
  });
  p.volumen(el(x, y - r * 1.5, r, r * 0.42), CUERO, { alto: 1.5, ...op, brillo: 0.6 });
  p.trazo(x - r + OX, y - r * 1.3 + OY, x + r + OX, y - r * 1.3 + OY, tono(ORO, 4), 1);
}

/** Un músico de la orilla (cada uno es una parte: toca a su ritmo). */
function musico(f: Figura, id: string, u: number, v: number, k: number, tambor = false): Parte {
  const p = f.lienzo();
  const q = pantalla(u, v, 0);
  zamponero(p, q.x, q.y, 1, k, tambor);
  return f.parte(id, p, ...P(q.x, q.y), { mov: { vaiven: { dy: -1.2, periodo: 560 + k * 37, fase: k * 0.29 }, gira: { amp: tambor ? 0.1 : 0.05, periodo: 1120 + k * 74, fase: k * 0.17 } } });
}

export function inti(): CarrozaArte {
  const s = escena(LARGO, 20);
  plataforma(s, LARGO, { faldon: rombosAndinos([AMARILLO, TURQUESA, NARANJA, VERDE], FUCSIA), cubierta: (u) => tono(Math.floor(u / 4) % 2 ? MORADO : FUCSIA, 2), flecos: [AMARILLO, FUCSIA, ORO] }, false);
  const f = fig();
  const partes: Parte[] = [parteBase(s)];

  // Atrás: la tarima con músicos y el jaguar.
  const pt = f.lienzo();
  tarima(pt);
  partes.push(f.parte("tarima", pt, ...P(0, 20)));
  const pm = f.lienzo();
  for (const [u, v, k] of [
    [5, 6, 1],
    [11, 5, 2],
    [17, 6, 3],
  ] as const) {
    const q = pantalla(u, v, 20);
    zamponero(pm, q.x, q.y, 0.9, k);
  }
  const qm = pantalla(11, 6, 20);
  partes.push(f.parte("musicos-tarima", pm, ...P(qm.x, qm.y), { padre: "tarima", mov: { vaiven: { dy: -1, periodo: 640 } } }));
  // El cuerpo de plumas.
  const pc = f.lienzo();
  cuerpoPlumas(pc);
  partes.push(f.parte("plumas", pc, ...P(CAMINO[2]!.x, CAMINO[2]!.y + 10), { mov: { gira: { amp: 0.006, periodo: 4800 } } }));

  const pj = f.lienzo();
  const J = pantalla(8, 16, 34);
  jaguar(pj, J.x, J.y);
  partes.push(f.parte("jaguar", pj, ...P(J.x, J.y + 10), { mov: { gira: { amp: 0.06, periodo: 3000 } } }));

  // El sol: los rayos largos y los cortos (giran en sentidos contrarios), el aro y la cara.
  const rl = f.lienzo();
  rayos(rl, true);
  partes.push(f.parte("rayos-largos", rl, ...P(S.x, S.y), { mov: { rueda: { periodo: 24000, sentido: 1 } } }));
  const rc = f.lienzo();
  rayos(rc, false);
  partes.push(f.parte("rayos-cortos", rc, ...P(S.x, S.y), { mov: { rueda: { periodo: 18000, sentido: -1 } } }));
  const pa = f.lienzo();
  aro(pa);
  partes.push(f.parte("aro", pa, ...P(S.x, S.y)));
  const pf = f.lienzo();
  cara(pf);
  partes.push(f.parte("cara", pf, ...P(S.x, S.y + 22), { mov: { gira: { amp: 0.04, periodo: 3400 } } }));
  const pp = f.lienzo();
  for (const l of [-1, 1] as const) parpado(pp, S.x + OX + l * 8.5, S.y + OY - 4, 11, 5, 4.6, l, SOL);
  partes.push(f.parte("parpados", pp, ...P(S.x, S.y + 22), { padre: "cara", contorno: false, mov: { parpadeo: { cada: 3800, dura: 200 } } }));

  // La orilla: los zampoñeros y los dos bombos.
  partes.push(musico(f, "musico-1", 6, 37, 0));
  partes.push(musico(f, "musico-3", 34, 38, 2, true));
  const pb = f.lienzo();
  for (const u of [41, 75]) {
    const q = pantalla(u, 39, 0);
    bombo(pb, q.x, q.y, 5.5);
  }
  const qb = pantalla(58, 39, 0);
  partes.push(f.parte("bombos", pb, ...P(qb.x, qb.y), { mov: { vaiven: { dy: -0.8, periodo: 560 } } }));
  partes.push(musico(f, "musico-4", 50, 38, 3));
  partes.push(musico(f, "musico-5", 64, 38, 4));
  partes.push(musico(f, "musico-6", 82, 37, 5, true));
  partes.push(musico(f, "musico-7", 96, 36, 6));
  void [VERDE, ARCOIRIS];
  return { largo: LARGO, partes, luces: [], marco: { x0: -ANCHO - 40, x1: LARGO + 40 } };
}
