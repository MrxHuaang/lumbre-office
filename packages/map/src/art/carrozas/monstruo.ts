// El Reloj de E., el simio mecánico (pixel art pintado): un simio gigante de pelaje azul en mechones y cara
// rosada que se ríe con la boca abierta, orejas rosadas y un penacho de plumas naranjas, con engranajes de
// bronce que le dan vueltas en la cabeza; sus manos moradas sostienen al frente una máscara dorada que
// también se ríe. Atrás, sobre el camión, la maquinaria del reloj: tubos de bronce que echan humo y un
// balcón con baranda dorada donde van figuras con tocados de plumas; por el costado, una fila de rostros
// dorados tallados con penachos. El faldón, de cortinas moradas y fucsias con ribetes dorados. Todo de
// frente a la pantalla en 3/4 (luz de arriba a la izquierda), en coordenadas de pantalla desde el origen.
import type { Ramp, RGBA } from "../pixel";
import { BRILLO, Figura, LINEA, ojo, parpado, pluma } from "./figuras";
import { figurita } from "./munecos";
import type { CarrozaArte, Parte } from "./partes";
import { ANCHO, cortinas, escena, ORO, pantalla, parteBase, plataforma } from "./plataforma";
import { capsula, circulo, elipse, Pintura, poligono, rampa, resta, tono, union, type Forma } from "./pintura";

const LARGO = 112;
const PELO = rampa("#2f5ee0");
const PELO2 = rampa("#1f3aa8");
const PELO3 = rampa("#4f8af2");
const CARA = rampa("#ee7a8a");
const OREJA = rampa("#e85a72");
const BOCA = rampa("#6a1430");
const LENGUA = rampa("#f06a8a");
const DIENTE = rampa("#f6f0e0");
const MORADO = rampa("#8a44d8");
const FUCSIA = rampa("#c8287a");
const BRONCE = rampa("#d89a2a");
const NARANJA = rampa("#f2861c");
const AMARILLO = rampa("#f6c81c");
const TURQUESA = rampa("#1fb8b0");
const VERDE = rampa("#3db842");
const ROJO = rampa("#e0283c");
const PIEL = [rampa("#e8b088"), rampa("#c98a5a"), rampa("#8a5a3a")];

const OX = 70;
const OY = 230;
const P = (x: number, y: number): [number, number] => [x + OX, y + OY];
const pol = (...pts: [number, number][]) => poligono(pts.map(([x, y]) => P(x, y)));
const el = (x: number, y: number, rx: number, ry: number, a = 0) => elipse(x + OX, y + OY, rx, ry, a);
const ci = (x: number, y: number, r: number) => circulo(x + OX, y + OY, r);
const cap = (ax: number, ay: number, bx: number, by: number, ra: number, rb = ra) => capsula(ax + OX, ay + OY, bx + OX, by + OY, ra, rb);
const curvaP = (p: Pintura, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, c: RGBA, g = 1) => p.curva(x0 + OX, y0 + OY, cx + OX, cy + OY, x1 + OX, y1 + OY, c, g);
const fig = () => new Figura(250, 330, OX, OY, [0, 0, 0]);
const op = { planos: true, borde: "oscuro" as const };

/** La cabeza del simio (adelante, arriba) y el pecho. */
const H = (() => {
  const s = pantalla(LARGO * 0.78, ANCHO * 0.5, 66);
  return { x: s.x, y: s.y };
})();
const PECHO = (() => {
  const s = pantalla(LARGO * 0.72, ANCHO * 0.5, 30);
  return { x: s.x, y: s.y };
})();

/** Un mechón de pelo: una gota alargada con su punta hacia `ang`. */
function mechon(x: number, y: number, ang: number, largo: number, ancho: number): Forma {
  const tx = x + Math.cos(ang) * largo;
  const ty = y + Math.sin(ang) * largo;
  return union(el(x, y, ancho, ancho * 0.85), pol([x + Math.cos(ang + 1.57) * ancho, y + Math.sin(ang + 1.57) * ancho], [tx, ty], [x + Math.cos(ang - 1.57) * ancho, y + Math.sin(ang - 1.57) * ancho]));
}

/** Pelaje: una forma cubierta de mechones por capas (de arriba hacia abajo), con la sombra de cada uno. */
function pelaje(p: Pintura, forma: Forma, x0: number, y0: number, x1: number, y1: number, ang = Math.PI / 2 + 0.4) {
  p.volumen(forma, PELO, { alto: 20, ...op });
  let k = 0;
  for (let y = y0; y <= y1; y += 3.4) {
    const fila = Math.round((y - y0) / 3.4);
    for (let x = x0 + (fila % 2) * 2; x <= x1; x += 4) {
      const jx = x + Math.sin(fila * 2.1 + x * 0.7) * 1.4;
      const jy = y + Math.cos(x * 1.3 + fila) * 1.2;
      if (forma.d(jx + OX, jy + OY) > -1) continue;
      k++;
      const r = forma.d(jx + OX, jy - 6 + OY) > 0 ? PELO3 : k % 5 === 0 ? PELO2 : PELO;
      p.volumen(mechon(jx, jy, ang + Math.sin(k * 1.7) * 0.3, 9 + (k % 4), 2.8), r, { alto: 3, planos: true, borde: "propio", sombra: 0.28 });
    }
  }
}

/** Un engranaje de bronce con dientes cuadrados, rayos y el perno del centro. */
function engranaje(p: Pintura, x: number, y: number, r: number, metal: Ramp) {
  const n = Math.max(8, Math.round(r * 0.75));
  const [cx, cy] = P(x, y);
  const forma: Forma = {
    d: (px, py) => {
      const dx = px - cx;
      const dy = py - cy;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const diente = ((a / (Math.PI * 2)) * n + 10) % 1 < 0.5;
      const hueco = d < r * 0.62 && d > r * 0.3 && Math.abs(Math.sin(a * 2.5)) > 0.55;
      return hueco ? 1 : d - (r + (diente ? 2.6 : 0));
    },
    x0: cx - r - 4,
    y0: cy - r - 4,
    x1: cx + r + 4,
    y1: cy + r + 4,
  };
  p.volumen(forma, metal, { alto: 3, brillo: 0.9, ...op, sombra: 0.4 });
  p.volumen(circulo(cx, cy, r * 0.28), metal, { alto: 2, base: 0.8, brillo: 1, borde: "oscuro" });
  p.plano(circulo(cx, cy, Math.max(1, r * 0.1)), tono(metal, 0));
}

/** Un rostro dorado tallado, sereno, con su tocado de plumas y la joya en la frente. */
function rostroDorado(p: Pintura, x: number, y: number, r: number, k: number) {
  const plumas = [MORADO, TURQUESA, FUCSIA, VERDE, NARANJA];
  const [cx, cy] = P(x, y - r * 0.9);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.32;
    pluma(p, cx + Math.cos(a) * 3, cy + Math.sin(a) * 3, a, r * 1.6, r * 0.55, plumas[(i + k) % plumas.length]!);
  }
  p.volumen(el(x, y, r, r * 1.2), ORO, { alto: r * 0.6, brillo: 0.9, ...op, sombra: 0.4 });
  // La banda de la frente con la joya.
  p.volumen(cap(x - r * 0.9, y - r * 0.55, x + r * 0.9, y - r * 0.55, r * 0.18), MORADO, { alto: 1.5, ...op });
  p.volumen(ci(x, y - r * 0.55, r * 0.2), [TURQUESA, FUCSIA, VERDE][k % 3]!, { alto: 1, brillo: 1, borde: "oscuro" });
  // Los ojos cerrados en paz, la nariz y la sonrisa.
  for (const l of [-1, 1]) curvaP(p, x + l * r * 0.55, y - r * 0.05, x + l * r * 0.35, y + r * 0.12, x + l * r * 0.12, y - r * 0.05, tono(ORO, 0), 1);
  p.volumen(el(x, y + r * 0.25, r * 0.16, r * 0.24), ORO, { alto: 1, base: 0.6, sombra: 0.4, borde: "oscuro" });
  curvaP(p, x - r * 0.4, y + r * 0.6, x, y + r * 0.85, x + r * 0.4, y + r * 0.6, tono(ORO, 0), 1);
  // El collar.
  p.volumen(el(x, y + r * 1.25, r * 0.8, r * 0.28), MORADO, { alto: 2, ...op, patron: (q) => (Math.floor(q.x / 2) % 2 ? MORADO : AMARILLO) });
}

/** La maquinaria de atrás: el balcón con su baranda dorada y los tubos de bronce. Devuelve las bocas. */
function maquinaria(p: Pintura): { x: number; y: number }[] {
  // La caseta del balcón (una caja en 3/4: la cara de la luz y la de la sombra).
  const a = pantalla(4, 4, 34);
  const b = pantalla(LARGO * 0.45, 4, 34);
  const c = pantalla(LARGO * 0.45, ANCHO - 6, 34);
  const d = pantalla(4, ANCHO - 6, 34);
  const piso = (q: { x: number; y: number }) => q;
  void piso;
  p.volumen(pol([a.x, a.y], [b.x, b.y], [c.x, c.y], [d.x, d.y]), rampa("#7a3a8a"), { alto: 2, ...op, patron: (q) => ((Math.floor((q.x + q.y * 2) / 6) + Math.floor((q.y * 2 - q.x) / 6)) % 2 ? rampa("#7a3a8a") : rampa("#5a2a6a")) });
  p.volumen(pol([d.x, d.y], [c.x, c.y], [c.x, c.y + 34], [d.x, d.y + 34]), FUCSIA, { alto: 6, ...op });
  p.volumen(pol([c.x, c.y], [b.x, b.y], [b.x, b.y + 34], [c.x, c.y + 34]), FUCSIA, { alto: 6, base: -1, ...op });
  // Los tubos de bronce (detrás, más altos) con sus anillos.
  const bocas: { x: number; y: number }[] = [];
  for (const [u, v, h, r] of [
    [0.28, 0.3, 40, 5],
    [0.38, 0.5, 52, 6],
    [0.2, 0.62, 34, 4.4],
    [0.48, 0.32, 30, 4.6],
  ] as const) {
    const q = pantalla(LARGO * u, ANCHO * v, 34);
    const t = { x: q.x, y: q.y - h };
    p.volumen(union(cap(q.x, q.y, t.x, t.y, r)), BRONCE, { alto: 3, brillo: 0.95, ...op, sombra: 0.35 });
    for (let k = 1; k <= 2; k++) p.volumen(el(q.x, q.y - (h * k) / 3, r + 1.4, 2.2), BRONCE, { alto: 1.5, base: 0.8, brillo: 0.9, ...op });
    p.volumen(el(t.x, t.y, r + 1.6, 2.6), BRONCE, { alto: 2, base: 0.6, brillo: 0.9, ...op });
    p.plano(el(t.x, t.y, r - 0.6, 1.4), tono(BRONCE, 0));
    bocas.push(t);
  }
  // Un engranaje grande quieto en la maquinaria.
  const g = pantalla(LARGO * 0.33, 2, 60);
  engranaje(p, g.x, g.y, 9, BRONCE);
  return bocas;
}

/** La baranda dorada del balcón (delante de las figuras). */
function baranda(p: Pintura) {
  const d = pantalla(4, ANCHO - 6, 34);
  const c = pantalla(LARGO * 0.45, ANCHO - 6, 34);
  p.volumen(cap(d.x, d.y - 9, c.x, c.y - 9, 1.6), ORO, { alto: 1, brillo: 0.9, ...op });
  for (let t = 0; t <= 1.001; t += 0.1) {
    const x = d.x + (c.x - d.x) * t;
    const y = d.y + (c.y - d.y) * t;
    p.volumen(cap(x, y - 9, x, y, 1.1), ORO, { alto: 1, brillo: 0.9, ...op });
  }
}

/** Una figura del balcón, con su tocado de plumas (se mece aparte). */
function bailarina(f: Figura, id: string, u: number, v: number, k: number): Parte {
  const p = f.lienzo();
  const q = pantalla(LARGO * u, ANCHO * v, 34);
  const [cx, cy] = P(q.x, q.y);
  const plumas = [FUCSIA, TURQUESA, MORADO, VERDE];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.35;
    pluma(p, cx + Math.cos(a) * 2, cy - 36 + Math.sin(a) * 2, a, 13, 4.6, plumas[(i + k) % plumas.length]!);
  }
  figurita(p, cx, cy, 0.75, { piel: PIEL[k % 3]!, ropa: [MORADO, TURQUESA, FUCSIA][k % 3]!, falda: k % 2 === 0, pelo: rampa("#2a2236") });
  return f.parte(id, p, cx, cy, { mov: { gira: { amp: 0.07, periodo: 1400 + k * 160, fase: k * 0.3 }, vaiven: { dy: -1.2, periodo: 700 + k * 50, fase: k * 0.3 } } });
}

/** El cuerpo del simio: los hombros y el pecho de pelaje y los brazos que bajan a las manos. */
function cuerpo(p: Pintura) {
  const { x, y } = PECHO;
  const forma = union(el(x, y - 6, 40, 30), el(x - 26, y + 6, 18, 22), el(x + 22, y + 10, 18, 22), pol([x - 44, y + 30], [x + 44, y + 40], [x + 30, y + 56], [x - 40, y + 46]));
  pelaje(p, forma, x - 52, y - 34, x + 46, y + 54);
}

/** La cabeza: la melena azul, las orejas rosadas, la cara que se ríe y el penacho naranja. */
function cabeza(p: Pintura) {
  const { x, y } = H;
  // El penacho de plumas naranjas y amarillas.
  const [px, py] = P(x - 2, y - 22);
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.2;
    pluma(p, px + Math.cos(a) * 4, py + Math.sin(a) * 4, a, 26 - Math.abs(i - 4) * 2.4, 8, [NARANJA, AMARILLO, ROJO][i % 3]!);
  }
  // La melena.
  const mel = el(x, y, 31, 29);
  pelaje(p, mel, x - 32, y - 30, x + 32, y + 28, Math.PI / 2 + 0.2);
  // Las orejas.
  for (const l of [-1, 1]) {
    p.volumen(el(x + l * 27, y - 2, 7, 9), OREJA, { alto: 4, ...op, sombra: 0.35 });
    p.volumen(el(x + l * 27, y - 1, 3.6, 5.4), rampa("#b8304a"), { alto: 2, borde: false });
  }
  // La cara rosada (frente, ojos, hocico).
  const cara = union(el(x - 7, y - 4, 12, 11), el(x + 7, y - 4, 12, 11), el(x, y + 9, 19, 14));
  p.volumen(cara, CARA, { alto: 10, brillo: 0.5, ...op, sombra: 0.35 });
  // La frente arrugada y las cejas.
  for (const l of [-1, 1] as const) {
    curvaP(p, x + l * 2, y - 10, x + l * 8, y - 14, x + l * 15, y - 10, tono(PELO2, 1), 2);
    const [ex, ey] = P(x + l * 7.5, y - 4);
    ojo(p, ex, ey, 11, 5.4, 4.4, l, { iris: rampa("#8a4a1a"), pestanas: 0, mira: 0.6 });
  }
  // La nariz y las ventanas.
  p.volumen(el(x, y + 4, 6.5, 4), OREJA, { alto: 2, brillo: 0.8, ...op });
  for (const l of [-1, 1]) p.plano(el(x + l * 2.4, y + 5, 1.4, 1), tono(BOCA, 1));
  // La boca abierta de risa: la sonrisa con los dientes de arriba y la lengua.
  const boca = resta(el(x, y + 13, 15, 10), el(x, y + 5, 19, 8));
  p.volumen(boca, BOCA, { alto: 3, base: -0.6, borde: "oscuro" });
  p.volumen(el(x + 1, y + 19, 8, 3.4), LENGUA, { alto: 2, brillo: 0.8, borde: false });
  for (let k = -4; k <= 4; k++) p.volumen(el(x + k * 2.8, y + 10.2 + Math.abs(k) * 0.35 + (k * k) * 0.05, 1.3, 2), DIENTE, { alto: 1, brillo: 0.9, borde: "oscuro" });
  for (let k = -3; k <= 3; k++) p.volumen(el(x + k * 2.8, y + 20.5 - Math.abs(k) * 0.4, 1.2, 1.6), DIENTE, { alto: 1, brillo: 0.9, borde: "oscuro" });
  // Los cachetes.
  for (const l of [-1, 1]) p.volumen(el(x + l * 13, y + 8, 4, 3), CARA, { alto: 2, base: 0.8, borde: false });
  // Un rizo morado (adorno) en la melena.
  curvaP(p, x - 22, y - 18, x - 30, y - 24, x - 26, y - 30, tono(MORADO, 4), 2);
}

/** Las manos moradas con la máscara dorada que se ríe. */
function mascaraYManos(p: Pintura) {
  const M = pantalla(LARGO - 2, ANCHO - 6, 18);
  const { x, y } = M;
  // La máscara de teatro dorada con su sonrisa y los adornos de colores.
  p.volumen(union(el(x, y, 15, 16), el(x, y + 8, 11, 10)), ORO, { alto: 8, brillo: 0.95, ...op, sombra: 0.4 });
  for (const l of [-1, 1]) {
    p.volumen(resta(el(x + l * 6, y - 3, 5, 3.6), el(x + l * 6, y - 5.6, 5.6, 3)), rampa("#2a1a3a"), { alto: 1, borde: "oscuro" });
    curvaP(p, x + l * 2, y - 9, x + l * 7, y - 12, x + l * 12, y - 8, tono(TURQUESA, 3), 1.4);
    p.plano(ci(x + l * 10, y + 1, 1.2), tono(FUCSIA, 3));
  }
  p.volumen(resta(el(x, y + 9, 9, 6.5), el(x, y + 4.5, 11, 5)), BOCA, { alto: 1.5, base: -0.6, borde: "oscuro" });
  for (let k = -3; k <= 3; k++) p.plano(el(x + k * 2.3, y + 7.4 + Math.abs(k) * 0.3, 0.9, 1.4), tono(DIENTE, 4));
  p.volumen(el(x, y + 18, 3, 1.6), VERDE, { alto: 1, brillo: 1, borde: "oscuro" });
  // Las manos: la izquierda agarra por un lado y la derecha por el otro, dedos gruesos con uñas.
  for (const l of [-1, 1] as const) {
    const hx = x + l * 15;
    const hy = y + 6;
    p.volumen(el(hx + l * 4, hy + 8, 10, 9), MORADO, { alto: 6, ...op });
    for (let k = 0; k < 4; k++) {
      const by = hy - 6 + k * 4.6;
      p.volumen(cap(hx + l * 2, by, hx - l * 4, by + 1.5, 3.4, 3), MORADO, { alto: 2, sombra: 0.35, ...op });
      p.curva(hx + l * 0.5 + OX, by - 1.6 + OY, hx + l * 0.5 + OX, by + OY, hx + l * 0.5 + OX, by + 1.6 + OY, tono(MORADO, 1), 1);
      p.volumen(el(hx - l * 5.2, by + 1.4, 1.8, 1.6), rampa("#f6b0d0"), { alto: 1, brillo: 0.9, borde: "oscuro" });
    }
    p.volumen(cap(hx + l * 6, hy + 4, hx + l * 2, hy + 14, 3.6, 3.2), MORADO, { alto: 2, base: 0.5, sombra: 0.4, ...op });
  }
}

export function monstruo(): CarrozaArte {
  const s = escena(LARGO, 20);
  plataforma(s, LARGO, { faldon: cortinas([FUCSIA, MORADO], rampa("#3a1a4a"), [AMARILLO, TURQUESA, ORO]), cubierta: () => tono(rampa("#5a2a6a"), 3), flecos: [AMARILLO, FUCSIA, MORADO] }, false);
  const f = fig();
  const partes: Parte[] = [parteBase(s)];

  // La maquinaria de atrás, el humo y las figuras del balcón.
  const maq = f.lienzo();
  const bocas = maquinaria(maq);
  // La fila de rostros dorados por el costado (sobre la cara de la luz de la caseta).
  for (let k = 0; k < 4; k++) {
    const q = pantalla(8 + k * 11, ANCHO - 5, 18);
    rostroDorado(maq, q.x, q.y, 6.4, k);
  }
  partes.push(f.parte("maquinaria", maq, ...P(0, 34)));
  bocas.forEach((b, k) => {
    const p = f.lienzo();
    p.volumen(union(el(b.x, b.y - 7, 7, 5.6), el(b.x + 5, b.y - 10, 5, 4.6), el(b.x - 5, b.y - 9, 4.6, 4.2)), rampa("#f4f2f8"), { alto: 3, ...op });
    partes.push(f.parte(`humo-${k}`, p, ...P(b.x, b.y - 6), { mov: { sube: { dx: 5, dy: -24, periodo: 2600, fase: k / 4, crece: 0.9 } } }));
  });
  partes.push(bailarina(f, "balcon-1", 0.12, 0.45, 0), bailarina(f, "balcon-2", 0.22, 0.7, 1), bailarina(f, "balcon-3", 0.34, 0.4, 2));
  const bar = f.lienzo();
  baranda(bar);
  partes.push(f.parte("baranda", bar, ...P(0, 34)));

  // El simio: el cuerpo, los engranajes de la cabeza, la cabeza, los párpados y las manos con la máscara.
  const cu = f.lienzo();
  cuerpo(cu);
  partes.push(f.parte("cuerpo", cu, ...P(PECHO.x, PECHO.y + 50), { mov: { gira: { amp: 0.008, periodo: 5200 } } }));
  const engs: [number, number, number, 1 | -1, number][] = [
    [H.x + 24, H.y - 20, 9, 1, 6000],
    [H.x + 34, H.y - 6, 6, -1, 4200],
  ];
  const cab = f.lienzo();
  cabeza(cab);
  partes.push(f.parte("cabeza", cab, ...P(H.x, H.y + 26), { padre: "cuerpo", mov: { gira: { amp: 0.05, periodo: 3700 } } }));
  engs.forEach(([x, y, r, sentido, periodo], k) => {
    const p = f.lienzo();
    engranaje(p, x, y, r, BRONCE);
    partes.push(f.parte(`engranaje-${k}`, p, ...P(x, y), { padre: "cabeza", mov: { rueda: { periodo, sentido } } }));
  });
  const parp = f.lienzo();
  for (const l of [-1, 1] as const) {
    const [ex, ey] = P(H.x + l * 7.5, H.y - 4);
    parpado(parp, ex, ey, 11, 5.4, 4.4, l, CARA);
  }
  partes.push(f.parte("parpados", parp, ...P(H.x, H.y + 26), { padre: "cabeza", contorno: false, mov: { parpadeo: { cada: 3300, dura: 190 } } }));
  const man = f.lienzo();
  mascaraYManos(man);
  const M = pantalla(LARGO - 2, ANCHO - 6, 18);
  partes.push(f.parte("manos", man, ...P(M.x, M.y + 10), { padre: "cuerpo", mov: { vaiven: { dy: -2.5, periodo: 2600 } } }));
  void [BRILLO, LINEA];
  return { largo: LARGO, partes, luces: [], marco: { x0: -ANCHO - 40, x1: LARGO + 40 } };
}
