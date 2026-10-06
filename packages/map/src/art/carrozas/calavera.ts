// El Tablero del Diablo (pixel art pintado): una calavera de fiesta gigante, turquesa, con filigranas de
// oro, los ojos grandes y vivos y la boca abierta de risa con los dientes de oro; detrás, un penacho de
// plumas; a cada lado un diablo rojo de cuernos verdes que se ríe; la túnica azul de ribetes dorados y
// las manos turquesa de garras de oro que se estiran hacia la gente; y en la cubierta, como un pesebre,
// el fraile y el diablo jugando ajedrez con la gente del pueblo mirando. El faldón, de cortinas recogidas
// con flores. Todo de frente a la pantalla en 3/4 (luz de arriba a la izquierda), en coordenadas de
// pantalla desde el origen de la carroza.
import type { Ramp, RGBA } from "../pixel";
import { BRILLO, Figura, ojo, parpado, pluma } from "./figuras";
import { figurita } from "./munecos";
import type { CarrozaArte, Parte } from "./partes";
import { ANCHO, cortinas, escena, ORO, pantalla, parteBase, plataforma } from "./plataforma";
import { capsula, circulo, elipse, Pintura, poligono, rampa, resta, tono, union } from "./pintura";

const LARGO = 104;
const HUESO = rampa("#3cc6c0");
const CUENCA = rampa("#1f2f5a");
const ROJO = rampa("#d8283a");
const DIABLO = rampa("#e03a2a");
const CUERNO = rampa("#3db842");
const AZUL = rampa("#2a4ad0");
const MORADO = rampa("#7a2ac8");
const AMARILLO = rampa("#f6c81c");
const NARANJA = rampa("#f2861c");
const MAGENTA = rampa("#d0287a");
const VERDE = rampa("#2fa84a");
const MARFIL = rampa("#f4ead8");
const NEGRO = rampa("#2a2236");
const FRAILE = rampa("#8a5a32");
const MADERA = rampa("#a8743a");
const BOCA = rampa("#5a1430");
const LENGUA = rampa("#f07a9a");
const PIEL = [rampa("#e8b088"), rampa("#c98a5a"), rampa("#8a5a3a"), rampa("#f0c8a0")];

const OX = 80;
const OY = 220;
const P = (x: number, y: number): [number, number] => [x + OX, y + OY];
const pol = (...pts: [number, number][]) => poligono(pts.map(([x, y]) => P(x, y)));
const el = (x: number, y: number, rx: number, ry: number, a = 0) => elipse(x + OX, y + OY, rx, ry, a);
const ci = (x: number, y: number, r: number) => circulo(x + OX, y + OY, r);
const cap = (ax: number, ay: number, bx: number, by: number, ra: number, rb = ra) => capsula(ax + OX, ay + OY, bx + OX, by + OY, ra, rb);
const curvaP = (p: Pintura, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, c: RGBA, g = 1) => p.curva(x0 + OX, y0 + OY, cx + OX, cy + OY, x1 + OX, y1 + OY, c, g);
const fig = () => new Figura(250, 330, OX, OY, [0, 0, 0]);
const op = { planos: true, borde: "oscuro" as const };

/** El centro del cráneo (sobre la mitad de atrás de la cubierta). */
const K = (() => {
  const s = pantalla(LARGO * 0.5, ANCHO * 0.25, 84);
  return { x: s.x, y: s.y };
})();
/** Los hombros de la túnica. */
const S = { x: K.x, y: K.y + 44 };

/** Un remolino de filigrana dorada (con su puntico). */
function filigrana(p: Pintura, x: number, y: number, s: number, lado: 1 | -1) {
  curvaP(p, x, y, x + lado * s, y - s * 0.9, x + lado * s * 0.4, y - s * 1.6, tono(ORO, 4), 1.2);
  curvaP(p, x + lado * s * 0.4, y - s * 1.6, x - lado * s * 0.2, y - s * 1.4, x + lado * s * 0.05, y - s * 1.05, tono(ORO, 4), 1);
  p.plano(ci(x, y + 1.2, 1), tono(ORO, 5));
}

/** El penacho de plumas detrás del cráneo. */
function penacho(p: Pintura) {
  const [cx, cy] = P(K.x, K.y - 6);
  const colores = [rampa("#1fb8b0"), NARANJA, ROJO, MORADO, rampa("#1fb8b0"), AMARILLO, ROJO, rampa("#1fb8b0")];
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.27;
    pluma(p, cx + Math.cos(a) * 18, cy + Math.sin(a) * 18, a, 34 - Math.abs(i - 4) * 2, 11, colores[i % colores.length]!);
  }
}

/** El cráneo: la frente con filigranas, los pómulos, las cuencas, la nariz y la boca abierta de risa. */
function craneo(p: Pintura) {
  const { x, y } = K;
  const forma = union(el(x, y - 10, 34, 31), el(x, y + 8, 29, 20));
  p.volumen(forma, HUESO, { alto: 22, brillo: 0.6, ...op });
  // La sien en sombra (el lado que da a la calle) y la luz de la frente.
  const sien = el(x + 24, y - 2, 13, 30);
  p.volumen(resta(sien, resta(sien, forma)), HUESO, { alto: 10, base: -1.4, borde: false });
  p.volumen(el(x - 12, y - 28, 13, 7, -0.3), HUESO, { alto: 3, base: 1.2, borde: false });
  // Puntos de colores y filigranas doradas (calavera de fiesta).
  filigrana(p, x - 4, y - 20, 6, 1);
  filigrana(p, x - 20, y - 14, 5, -1);
  filigrana(p, x + 18, y - 18, 5, 1);
  for (const [dx, dy, c] of [
    [-10, -32, MORADO],
    [6, -34, AMARILLO],
    [16, -28, MAGENTA],
    [-24, -26, AMARILLO],
    [24, -10, MORADO],
  ] as const)
    p.volumen(ci(x + dx, y + dy, 1.8), c, { alto: 1, brillo: 0.8, borde: "oscuro" });
  // Los pómulos marcados.
  for (const [cx, cy, r] of [
    [x - 21, y + 7, 7.5],
    [x + 19, y + 7, 6.5],
  ] as const)
    p.volumen(el(cx, cy, r, r * 0.66), HUESO, { alto: 4, base: 0.5, sombra: 0.4, ...op });
  // Las cuencas hondas.
  for (const [cx, rx] of [
    [x - 12, 11.5],
    [x + 12, 11],
  ] as const) {
    p.volumen(el(cx, y - 3, rx + 1.8, rx + 0.8), HUESO, { alto: 3, base: 0.9, borde: false });
    p.volumen(el(cx, y - 3, rx, rx - 0.6), CUENCA, { alto: 5, base: -0.6, contraste: 2, brillo: 0, borde: "oscuro" });
  }
  // La nariz: un corazón al revés, hondo.
  p.volumen(pol([x - 5, y + 7], [x - 0.5, y + 5], [x + 4, y + 7], [x, y + 15]), CUENCA, { alto: 2, base: -1, borde: "oscuro" });
  // La boca abierta de risa: la boca oscura, la lengua y los dientes de oro de arriba.
  const sonrisa = resta(el(x, y + 18, 24, 18), el(x, y + 6, 30, 14));
  p.volumen(sonrisa, BOCA, { alto: 4, base: -0.8, borde: "oscuro" });
  p.volumen(el(x + 1, y + 32, 11, 4.5), LENGUA, { alto: 3, brillo: 0.8, ...op });
  dientes(p, x - 22, x + 22, y + 17.5, 10, 6.5);
}

/** Una fila de dientes de oro (en arco de sonrisa), cada uno con su brillo. */
function dientes(p: Pintura, x0: number, x1: number, y: number, n: number, alto: number, abajo = false) {
  const w = (x1 - x0) / n;
  for (let k = 0; k < n; k++) {
    const cx = x0 + w * (k + 0.5);
    const t = (k + 0.5) / n;
    const arco = Math.sin(t * Math.PI) * 5 * (abajo ? -1 : 1);
    const top = y + arco + (abajo ? -alto : 0);
    p.volumen(el(cx, top + alto / 2, w / 2 - 0.5, alto / 2), ORO, { alto: 2, brillo: 0.9, ...op });
    p.punto(Math.round(cx - w * 0.15 + OX), Math.round(top + 1.6 + OY), BRILLO);
  }
}

/** Los ojos grandes y vivos (blanco, iris azul, brillo) y sus párpados (aparte, para el parpadeo). */
function ojos(p: Pintura, cerrados: boolean) {
  for (const [cx, l] of [
    [K.x - 12, -1],
    [K.x + 12, 1],
  ] as const) {
    const [ex, ey] = P(cx, K.y - 3);
    if (cerrados) parpado(p, ex, ey, 17, 8, 7, l, HUESO, CUENCA);
    else ojo(p, ex, ey, 17, 8, 7, l, { iris: rampa("#2a7ad8"), pestanas: 0, mira: l * -0.5 });
  }
}

/** Un diablo de busto que se ríe: cara roja, cuernos verdes curvos, orejas de punta, penacho de plumas. */
function diablo(p: Pintura, x: number, y: number, lado: -1 | 1) {
  const [cx, cy] = P(x, y - 8);
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + lado * (0.2 + i * 0.22);
    pluma(p, cx + Math.cos(a) * 10, cy + Math.sin(a) * 10, a, 22 - i * 1.5, 8, [ROJO, NARANJA, rampa("#1fb8b0"), ROJO, VERDE, AMARILLO][i]!);
  }
  // Los hombros (manto verde con ribete dorado).
  p.volumen(el(x, y + 20, 15, 8), DIABLO, { alto: 6, ...op, patron: (q) => (Math.abs(q.y - OY - (y + 15)) < 1.6 ? AMARILLO : rampa("#a81820")) });
  // Los cuernos verdes, curvos hacia afuera y arriba.
  for (const l of [-1, 1] as const)
    for (let k = 0; k < 12; k++) {
      const t = k / 11;
      const nx = x + l * (10 + Math.sin(t * 2.4) * 12);
      const ny = y - 12 - t * 18 + Math.max(0, t - 0.7) * 10;
      p.volumen(ci(nx, ny, 4.6 - t * 3.6), CUERNO, { alto: 2.5, ...op, base: k % 3 === 0 ? -0.6 : 0.3 });
    }
  // Las orejas de punta.
  for (const l of [-1, 1]) p.volumen(pol([x + l * 13, y - 4], [x + l * 24, y - 10], [x + l * 15, y + 4]), DIABLO, { alto: 2, ...op });
  // La cara: roja, con las cejas de fuego, los ojos amarillos, la nariz y la risa grande.
  p.volumen(el(x, y, 15, 17), DIABLO, { alto: 9, brillo: 0.6, ...op });
  for (const l of [-1, 1] as const) {
    p.volumen(pol([x + l * 2, y - 8], [x + l * 13, y - 13], [x + l * 11, y - 6]), rampa("#a81820"), { alto: 1.5, ...op });
    const [ex, ey] = P(x + l * 6, y - 3);
    ojo(p, ex, ey, 9, 4, 3, l, { iris: AMARILLO, pestanas: 0, mira: lado * 0.8 });
  }
  p.volumen(el(x, y + 4, 3.4, 3), DIABLO, { alto: 2, base: 0.8, sombra: 0.4, ...op });
  p.volumen(resta(el(x, y + 9, 11, 7), el(x, y + 3, 13, 5)), BOCA, { alto: 2, base: -0.6, borde: "oscuro" });
  for (let k = -3; k <= 3; k++) p.volumen(el(x + k * 2.7, y + 7.6 + Math.abs(k) * 0.3, 1.2, 1.8), MARFIL, { alto: 1, borde: "oscuro" });
  for (const l of [-1, 1]) p.volumen(pol([x + l * 5, y + 8], [x + l * 7, y + 8], [x + l * 6, y + 12]), MARFIL, { alto: 1, borde: "oscuro" });
  // La barbita de chivo y un arete de oro.
  p.volumen(pol([x - 4, y + 15], [x + 4, y + 15], [x, y + 22]), rampa("#a81820"), { alto: 1.5, ...op });
  p.volumen(ci(x - lado * 16, y + 4, 2), ORO, { alto: 1, brillo: 1, borde: "oscuro" });
}

/** La túnica azul de ribetes dorados y forro rojo, que cae sobre la parte de atrás del camión. */
function tunica(p: Pintura) {
  const BL = pantalla(0, ANCHO * 0.55, 0);
  const BR = pantalla(LARGO, ANCHO * 0.4, 0);
  const forma = union(pol([S.x - 54, S.y - 2], [S.x + 54, S.y + 4], [BR.x + 4, BR.y], [BR.x - 20, BR.y + 10], [BL.x + 26, BL.y + 8], [BL.x - 4, BL.y]), el(S.x, S.y + 4, 56, 16));
  p.volumen(forma, AZUL, {
    alto: 26,
    ...op,
    patron: (q) => {
      const x = q.x - OX - S.x;
      const y = q.y - OY - S.y;
      // Los pliegues que caen desde los hombros.
      const k = Math.atan2(x, Math.max(2, y + 40)) * 9;
      return Math.abs(k - Math.round(k)) > 0.4 ? rampa("#2236a8") : AZUL;
    },
  });
  // Las solapas doradas con bordado.
  for (const l of [-1, 1]) p.volumen(cap(S.x + l * 6, S.y - 2, S.x + l * 30, S.y + 46, 4), AMARILLO, { alto: 2, ...op, patron: (q) => (Math.floor((q.x + q.y) / 3) % 3 === 0 ? ROJO : AMARILLO) });
}

/** Un brazo que se estira con la manga de la túnica y la mano turquesa de garras de oro. */
function brazo(p: Pintura, lado: -1 | 1) {
  const h = { x: S.x + lado * 42, y: S.y + 4 };
  const m = { x: S.x + lado * 66, y: S.y + 34 };
  p.volumen(cap(h.x, h.y, m.x - lado * 6, m.y - 6, 13, 11), AZUL, { alto: 8, ...op });
  // El puño ancho de la manga con el ribete dorado y el forro rojo.
  p.volumen(el(m.x - lado * 8, m.y - 7, 11, 9, lado * 0.6), ROJO, { alto: 4, ...op });
  p.volumen(resta(el(m.x - lado * 8, m.y - 7, 11, 9, lado * 0.6), el(m.x - lado * 8, m.y - 7, 9, 7, lado * 0.6)), AMARILLO, { alto: 2, borde: "oscuro" });
  // La mano: palma y cuatro dedos gruesos doblados hacia abajo, con garras de oro.
  p.volumen(el(m.x, m.y, 9, 7, lado * 0.4), HUESO, { alto: 5, ...op });
  for (let k = 0; k < 4; k++) {
    const bx = m.x + lado * (3 + k * 1.2);
    const by = m.y - 4 + k * 3.2;
    const mx = bx + lado * 7;
    const my = by + 1;
    const tx = mx + lado * 3;
    const ty = my + 6;
    p.volumen(cap(bx, by, mx, my, 2.8, 2.6), HUESO, { alto: 2, sombra: 0.35, ...op });
    p.volumen(cap(mx, my, tx, ty, 2.6, 2.2), HUESO, { alto: 2, sombra: 0.35, ...op });
    p.volumen(pol([tx - 2, ty - 1], [tx + 2, ty - 1], [tx - lado * 1, ty + 7]), ORO, { alto: 1.4, brillo: 1, ...op });
  }
  p.volumen(cap(m.x - lado * 2, m.y - 5, m.x + lado * 2, m.y - 12, 2.8, 2.4), HUESO, { alto: 2, sombra: 0.35, ...op });
  p.volumen(pol([m.x + lado * 2 - 2, m.y - 12], [m.x + lado * 2 + 2, m.y - 12], [m.x + lado * 4, m.y - 18]), ORO, { alto: 1.4, brillo: 1, ...op });
  return h;
}

/** La escena del ajedrez en la cubierta: la mesita, el fraile, el diablito y el tablero con sus piezas. */
function ajedrez(p: Pintura) {
  const m = pantalla(LARGO * 0.5, ANCHO * 0.78, 6);
  const w = 15;
  const tapa = pol([m.x, m.y - 4], [m.x + w, m.y + 3.5], [m.x, m.y + 11], [m.x - w, m.y + 3.5]);
  for (const [dx, dy] of [
    [-w + 3, 4],
    [w - 3, 4],
    [0, 10],
  ] as const)
    p.volumen(cap(m.x + dx, m.y + dy, m.x + dx, m.y + dy + 8, 1.3), MADERA, { alto: 1, ...op });
  p.volumen(pol([m.x - w, m.y + 3.5], [m.x, m.y + 11], [m.x + w, m.y + 3.5], [m.x + w, m.y + 6], [m.x, m.y + 13.5], [m.x - w, m.y + 6]), MADERA, { alto: 2, ...op });
  p.plano(tapa, (x, y) => {
    const u = (x - OX - m.x) / w + (y - OY - m.y - 3.5) / 7.5;
    const v = -(x - OX - m.x) / w + (y - OY - m.y - 3.5) / 7.5;
    return (Math.floor((u + 2) * 3) + Math.floor((v + 2) * 3)) % 2 ? tono(NEGRO, 3) : tono(MARFIL, 4);
  });
  for (let k = 0; k < 6; k++) {
    const px = m.x - 8 + k * 3.2;
    const py = m.y + 1 + (k % 2) * 3;
    p.volumen(union(el(px, py, 1.2, 1.8), el(px, py - 2.6, 1, 1)), k < 3 ? MARFIL : NEGRO, { alto: 1, borde: "oscuro" });
  }
  // El fraile (hábito café, la calva con su corona de pelo) a la izquierda.
  const [fx, fy] = P(m.x - w - 6, m.y + 10);
  figurita(p, fx, fy, 0.95, { piel: PIEL[3]!, ropa: FRAILE, falda: true });
  p.volumen(resta(elipse(fx, fy - 44, 8.4, 3.6), elipse(fx, fy - 46, 6, 2.4)), FRAILE, { alto: 2, borde: "oscuro" });
  // El diablito rojo con cuernos y cola a la derecha.
  const [dx, dy] = P(m.x + w + 7, m.y + 12);
  figurita(p, dx, dy, 0.95, { piel: DIABLO, ropa: rampa("#a81820") });
  for (const l of [-1, 1]) p.volumen(poligono([[dx + l * 3, dy - 45], [dx + l * 7, dy - 54], [dx + l * 6, dy - 44]]), CUERNO, { alto: 1, borde: "oscuro" });
  p.volumen(capsula(dx + 8, dy - 8, dx + 15, dy - 2, 1.2), DIABLO, { alto: 1, borde: "oscuro" });
  p.volumen(poligono([[dx + 14, dy - 4], [dx + 19, dy - 2], [dx + 14, dy + 1]]), DIABLO, { alto: 1, borde: "oscuro" });
}

/** Una persona del pueblo que mira el ajedrez (se mece aparte). */
function persona(f: Figura, id: string, x: number, y: number, k: number, fase: number): Parte {
  const p = f.lienzo();
  const [cx, cy] = P(x, y);
  const ropas: Ramp[] = [MORADO, rampa("#1fa8a0"), ROJO, rampa("#2a7a3a"), NARANJA, AZUL];
  figurita(p, cx, cy, 0.66, { piel: PIEL[k % 4]!, ropa: ropas[k % ropas.length]!, falda: k % 2 === 0, sombrero: [ROJO, AMARILLO, VERDE, NEGRO][k % 4]!, pelo: NEGRO });
  return f.parte(id, p, cx, cy, { mov: { gira: { amp: 0.06, periodo: 1500 + k * 170, fase }, vaiven: { dy: -1.1, periodo: 760 + k * 40, fase } } });
}

export function calavera(): CarrozaArte {
  const s = escena(LARGO, 20);
  plataforma(s, LARGO, { faldon: cortinas([ROJO, AZUL, rampa("#1fa86a")], rampa("#3a1a4a"), [AMARILLO, ROJO, MAGENTA]), cubierta: (u, v) => tono(Math.floor(u / 4) % 2 ? rampa("#7a3a8a") : rampa("#5a2a6a"), v > ANCHO - 3 ? 2 : 3), flecos: [AMARILLO, ROJO, AZUL] }, false);
  const f = fig();
  const partes: Parte[] = [parteBase(s)];

  const pen = f.lienzo();
  penacho(pen);
  partes.push(f.parte("penacho", pen, ...P(K.x, K.y), { padre: "cabeza", mov: { gira: { amp: 0.03, periodo: 2900 } } }));
  // Los diablos de los lados (se mecen y se ríen).
  for (const [lado, dx, dy] of [
    [-1, -44, -2],
    [1, 44, 4],
  ] as const) {
    const p = f.lienzo();
    diablo(p, K.x + dx, K.y + dy, lado);
    partes.push(f.parte(lado < 0 ? "diablo-izq" : "diablo-der", p, ...P(K.x + dx, K.y + dy + 24), { padre: "cuerpo", mov: { gira: { amp: 0.06, periodo: 1900, fase: lado < 0 ? 0 : 0.5 } } }));
  }
  const cuerpo = f.lienzo();
  tunica(cuerpo);
  partes.push(f.parte("cuerpo", cuerpo, ...P(S.x, S.y + 40), { mov: { gira: { amp: 0.006, periodo: 6000 } } }));
  // La cabeza (cráneo y boca), los párpados y la quijada con los dientes de abajo.
  const cab = f.lienzo();
  craneo(cab);
  ojos(cab, false);
  partes.push(f.parte("cabeza", cab, ...P(K.x, K.y + 34), { padre: "cuerpo", mov: { gira: { amp: 0.04, periodo: 3900 } } }));
  const parp = f.lienzo();
  ojos(parp, true);
  partes.push(f.parte("parpados", parp, ...P(K.x, K.y + 34), { padre: "cabeza", contorno: false, mov: { parpadeo: { cada: 3600, dura: 200 } } }));
  const mand = f.lienzo();
  mand.volumen(resta(el(K.x, K.y + 34, 24, 9), el(K.x, K.y + 27, 18, 7)), HUESO, { alto: 6, ...op });
  dientes(mand, K.x - 15, K.x + 15, K.y + 34, 7, 5.5, true);
  partes.push(f.parte("quijada", mand, ...P(K.x, K.y + 30), { padre: "cabeza", mov: { vaiven: { dy: 1.6, periodo: 1000 } } }));
  // Los brazos con las garras que se estiran.
  for (const lado of [-1, 1] as const) {
    const p = f.lienzo();
    const h = brazo(p, lado);
    partes.push(f.parte(lado < 0 ? "garra-izq" : "garra-der", p, ...P(h.x, h.y), { padre: "cuerpo", mov: { gira: { amp: 0.06, periodo: 2300, fase: lado < 0 ? 0 : 0.5 } } }));
  }
  // El ajedrez en la cubierta y la gente mirando.
  const aj = f.lienzo();
  ajedrez(aj);
  partes.push(f.parte("ajedrez", aj, ...P(K.x, K.y + 90)));
  const gente: [number, number][] = [
    [0.1, 0.6],
    [0.2, 0.92],
    [0.78, 0.95],
    [0.9, 0.62],
  ];
  gente.forEach(([u, v], k) => {
    const q = pantalla(LARGO * u, ANCHO * v, 0);
    partes.push(persona(f, `gente-${k}`, q.x, q.y, k, k * 0.17));
  });
  return { largo: LARGO, partes, luces: [], marco: { x0: -ANCHO - 40, x1: LARGO + 40 } };
}
