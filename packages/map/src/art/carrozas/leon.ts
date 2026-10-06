// El León del circo (pixel art pintado): la cabeza del león, dorada y sonriente, es el frente del camión;
// la melena de mechones naranjas, rojos, rosados y morados la envuelve y cae por los costados hasta el
// faldón. Lleva un sombrero de copa de rayas rosadas y verdes con payasitos sentados en el ala, y atrás,
// sobre pedestales de colores, la compañía del circo: payasos de nariz roja y cuello de vuelos, un perrito
// con su collar y un globo. El faldón es magenta, de festones dorados con borlas y flecos verde agua.
import type { Ramp, RGBA } from "../pixel";
import { BRILLO, ceja, Figura, LINEA, mejilla, ojo, parpado, pluma } from "./figuras";
import { baranda, festones, hash } from "./guirnaldas";
import type { CarrozaArte, Parte } from "./partes";
import { ANCHO, escena, ORO, pantalla, parteBase, plataforma } from "./plataforma";
import { caja, capsula, circulo, elipse, Pintura, poligono, rampa, tono, union, type Forma } from "./pintura";

const LARGO = 112;
const CARA = rampa("#f2b82a");
const HOCICO = rampa("#f6d77a");
const NARIZ = rampa("#7a3a2a");
const BOCA = rampa("#6a1a2a");
const LENGUA = rampa("#e8607a");
const DIENTE = rampa("#f6f0e0");
const CEJA = rampa("#5a2a1a");
const IRIS = rampa("#a8601c");
const MELENA = [rampa("#f2a21c"), rampa("#f2711c"), rampa("#e0402a"), rampa("#e0408a"), rampa("#a83cc8")];
const MAGENTA = rampa("#d8287a");
const MORADO = rampa("#8a3ac8");
const VERDE = rampa("#2fae8a");
const ROSADO = rampa("#f0609a");
const AMARILLO = rampa("#f7c518");
const FLECO = [rampa("#2fae8a"), rampa("#e6b02a")];
const PIELES = [rampa("#f0c8a0"), rampa("#d8a070"), rampa("#a8704a")];
const PERRO = rampa("#f4ece0");
const MANCHA_PERRO = rampa("#b8763a");

const OX = 90;
const OY = 140;
const fig = () => new Figura(250, 250, OX, OY, [0, 0, 0]);
const P = (x: number, y: number): [number, number] => [x + OX, y + OY];
const curvaP = (p: Pintura, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, c: RGBA, g = 1) => p.curva(x0 + OX, y0 + OY, cx + OX, cy + OY, x1 + OX, y1 + OY, c, g);
const pol = (...pts: [number, number][]) => poligono(pts.map(([x, y]) => P(x, y)));
const el = (x: number, y: number, rx: number, ry: number, a = 0) => elipse(x + OX, y + OY, rx, ry, a);
const ci = (x: number, y: number, r: number) => circulo(x + OX, y + OY, r);
const cap = (ax: number, ay: number, bx: number, by: number, ra: number, rb = ra) => capsula(ax + OX, ay + OY, bx + OX, by + OY, ra, rb);
const L = (q: { x: number; y: number }) => ({ x: q.x + OX, y: q.y + OY });

const FL = pantalla(0, ANCHO, 0);
const FC = pantalla(LARGO, ANCHO, -10);
/** El centro de la cara (al frente) y su escala. */
const H = { x: 78, y: 14 };
const K = 1.15;
const X = (d: number) => H.x + d * K;
const Y = (d: number) => H.y + d * K;
const R = (r: number) => r * K;

/**
 * La melena: la masa que tapa la cubierta del frente y cae por el costado, y encima las mechas onduladas en
 * anillos alrededor de la cara (naranjas y doradas adentro, rojas, rosadas y moradas afuera), peinadas hacia
 * atrás y hacia abajo; y las que caen por el costado hasta el faldón.
 */
function melena(p: Pintura) {
  const C = { x: X(-4), y: Y(5) };
  // La silueta: el cuerpo de la melena, los rizos de la orilla (enroscados hacia atrás) y la caída por el
  // costado hasta la cubierta.
  let sil: Forma = union(el(C.x, C.y, R(46), R(44)), pol([X(-20), Y(-36)], [X(30), Y(-22)], [X(44), Y(30)], [FC.x - 12, FC.y - 16], [FC.x - 62, FC.y - 31], [X(-58), Y(26)], [X(-46), Y(0)]));
  const rizos: { x: number; y: number; a: number }[] = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + hash(i, 1) * 0.1;
    const r = R(45 + hash(i, 2) * 4);
    const x = C.x + Math.cos(a) * r;
    const y = C.y + Math.sin(a) * r * 0.97;
    // Por abajo y hacia el frente la melena se recoge (ahí va la barbilla y el faldón).
    if (Math.sin(a) > 0.75) continue;
    rizos.push({ x, y, a });
    sil = union(sil, el(x, y, R(9), R(6), a + 1.1));
  }
  for (let k = 0; k < 7; k++) {
    const x = X(-56) + k * 8.4;
    const y = Y(26) + k * 5.4;
    rizos.push({ x, y, a: Math.PI * 0.75 });
    sil = union(sil, el(x, y, R(7), R(5), Math.PI * 0.75 + 1.1));
  }
  // Las mechas: rayas onduladas que salen de la cara, naranjas y doradas adentro y rojas, rosadas y moradas
  // afuera, con la raya oscura entre una y otra.
  const mecha = (q: { x: number; y: number }) => {
    const dx = q.x - OX - C.x;
    const dy = q.y - OY - C.y;
    const d = Math.hypot(dx, dy) / K;
    const th = Math.atan2(dy, dx);
    const s = th * 2.4 + Math.sin(d * 0.16 + th * 3) * 0.3;
    const banda = Math.floor(s * 2);
    const capa = Math.floor((d - 24) / 8 + (banda % 2 ? 0.7 : 0) + Math.sin(th * 3) * 0.3);
    return { s, banda, k: Math.max(0, Math.min(MELENA.length - 1, capa)) };
  };
  p.volumen(sil, MELENA[2]!, {
    alto: 18,
    planos: true,
    borde: "oscuro",
    patron: (q) => MELENA[mecha(q).k]!,
    pinta: (q, c) => {
      const m = mecha(q);
      const f = m.s * 2 - m.banda;
      if (f < 0.12) return [Math.round(c[0] * 0.72), Math.round(c[1] * 0.62), Math.round(c[2] * 0.78), 255];
      if (f > 0.3 && f < 0.42) return tono(MELENA[m.k]!, 5);
      if (f > 0.66 && f < 0.72) return [Math.round(c[0] * 0.86), Math.round(c[1] * 0.8), Math.round(c[2] * 0.9), 255];
      return null;
    },
  });
  // El rizo de la punta de cada mecha de la orilla.
  for (const r of rizos) {
    const n = r.a + 1.1;
    curvaP(p, r.x - Math.cos(n) * R(5), r.y - Math.sin(n) * R(5), r.x + Math.cos(n + 1.4) * R(3), r.y + Math.sin(n + 1.4) * R(3), r.x + Math.cos(n) * R(3), r.y + Math.sin(n) * R(3), tono(MELENA[0]!, 5), 1);
  }
}

/** La cara: el óvalo dorado, las orejas, los ojos cafés, las cejas, el hocico, la nariz y la boca de arriba. */
function cara(p: Pintura) {
  for (const [ox, oy] of [
    [-24, -25],
    [21, -26],
  ] as const) {
    p.volumen(el(X(ox), Y(oy), R(9), R(8)), CARA, { alto: 4, planos: true, borde: "oscuro", sombra: 0.35 });
    p.volumen(el(X(ox), Y(oy + 1), R(5), R(4.4)), rampa("#c8784a"), { alto: 2, base: -0.6, borde: false });
  }
  const forma = union(el(X(-2), Y(-8), R(25), R(22)), el(X(-1), Y(7), R(27), R(19)), el(X(3), Y(22), R(19), R(13)));
  p.volumen(forma, CARA, { alto: 16, planos: true, borde: "oscuro", brillo: 0.45 });
  p.volumen(el(X(-10), Y(-20), R(12), R(6), -0.3), CARA, { alto: 4, base: 1, borde: false, brillo: 0 });
  p.volumen(el(X(16), Y(10), R(10), R(16), 0.1), CARA, { alto: 4, base: -1, borde: false, brillo: 0 });
  // Los ojos grandes y cafés, con las cejas gruesas levantadas (contento).
  ojo(p, ...P(X(-11), Y(-6)), R(14.5), R(7), R(5.2), -1, { iris: IRIS, pestanas: 2, mira: 1.2 });
  ojo(p, ...P(X(12), Y(-7)), R(13), R(6.6), R(4.8), 1, { iris: IRIS, pestanas: 2, mira: 1.2 });
  ceja(p, ...P(X(-11.5), Y(-17)), R(13), -1, tono(CEJA, 2), 2.4);
  ceja(p, ...P(X(12), Y(-18)), R(12), 1, tono(CEJA, 2), 2.2);
  // Los cachetes con el tiro al blanco rosado y las pintitas de colores.
  for (const [cx, cy] of [
    [X(-20), Y(7)],
    [X(22), Y(5)],
  ] as const) {
    p.plano(ci(cx, cy, R(4.2)), tono(ROSADO, 3));
    p.plano(ci(cx, cy, R(2.8)), tono(CARA, 4));
    p.plano(ci(cx, cy, R(1.4)), tono(ROSADO, 3));
  }
  for (let k = 0; k < 7; k++) p.plano(ci(X(-4 + k * 3.2) + hash(k, 9) * 2, Y(-26 + hash(k, 8) * 6), 0.8), tono([ROSADO, VERDE, MORADO][k % 3]!, 3));
  // El hocico (las dos almohaditas claras) con las pintitas de los bigotes.
  for (const [cx, l] of [
    [X(-5), -1],
    [X(11), 1],
  ] as const) {
    p.volumen(el(cx, Y(12), R(10), R(7), l * 0.2), HOCICO, { alto: 4, planos: true, borde: false, sombra: 0.25 });
    for (let k = 0; k < 6; k++) p.plano(ci(cx + l * (k % 3) * 3 - l * 2, Y(10 + Math.floor(k / 3) * 3), 0.8), tono([ROSADO, VERDE, MORADO][k % 3]!, 2));
    for (let k = 0; k < 3; k++) curvaP(p, cx + l * 6, Y(10 + k * 2.4), cx + l * 14, Y(9 + k * 3), cx + l * 22, Y(8 + k * 4), tono(rampa("#fff6e0"), 5), 1);
  }
  // La nariz café, ancha, con su brillo.
  p.volumen(union(el(X(3), Y(4), R(7.5), R(4.5)), pol([X(-4), Y(4)], [X(10), Y(4)], [X(3), Y(10)])), NARIZ, { alto: 3, brillo: 0.9, planos: true, borde: "oscuro", sombra: 0.4 });
  p.trazo(...P(X(3), Y(10)), ...P(X(3), Y(14)), tono(NARIZ, 1), 1);
  // La boca abierta: lo hondo, la lengua, el labio de arriba con los dientes y los colmillos.
  const boca = union(el(X(3), Y(26), R(17), R(13)), pol([X(-16), Y(14)], [X(22), Y(13)], [X(19), Y(26)], [X(-13), Y(26)]));
  p.volumen(boca, BOCA, { alto: 5, base: -1, borde: "oscuro" });
  curvaP(p, X(-14), Y(16), X(3), Y(20), X(20), Y(16), tono(NARIZ, 2), 2);
  for (let k = 0; k < 8; k++) {
    const t = (k + 0.5) / 8;
    const dx = X(-11 + t * 28);
    const dy = Y(17 + Math.sin(t * Math.PI) * 2.6);
    p.volumen(caja(dx - 1.6 + OX, dy + OY, dx + 1.6 + OX, dy + 3.4 + OY, 0.8), DIENTE, { alto: 1, brillo: 0.9, borde: "oscuro", planos: true });
  }
  for (const cx of [X(-11), X(17)]) p.volumen(pol([cx - 2.8, Y(17)], [cx + 2.8, Y(17)], [cx, Y(26)]), DIENTE, { alto: 2, brillo: 1, planos: true, borde: "oscuro", sombra: 0.4 });
}

/** La quijada (se abre): la lengua rosada, los dientes de abajo y la barbilla dorada con su pelusa. */
function quijada(p: Pintura) {
  p.volumen(el(X(4), Y(30), R(12), R(7)), LENGUA, { alto: 4, brillo: 0.7, planos: true, borde: "oscuro" });
  p.trazo(...P(X(4), Y(26)), ...P(X(4), Y(34)), tono(LENGUA, 1), 1);
  // La barbilla: una media luna dorada bajo la boca, con la pelusa clara.
  const barbilla = pol([X(-14), Y(33)], [X(3), Y(40)], [X(20), Y(32)], [X(17), Y(42)], [X(3), Y(48)], [X(-11), Y(43)]);
  p.volumen(barbilla, CARA, { alto: 5, planos: true, borde: "oscuro", sombra: 0.35, pinta: (q, c) => (q.y - OY > Y(44) ? tono(HOCICO, 3) : c) });
  curvaP(p, X(-14), Y(33), X(3), Y(41), X(20), Y(32), tono(NARIZ, 2), 2);
  for (let k = 0; k < 7; k++) {
    const t = (k + 0.5) / 7;
    const dx = X(-10 + t * 27);
    const dy = Y(35 + Math.sin(t * Math.PI) * 3.6);
    p.volumen(caja(dx - 1.5 + OX, dy - 3.2 + OY, dx + 1.5 + OX, dy + OY, 0.8), DIENTE, { alto: 1, brillo: 0.9, borde: "oscuro", planos: true });
  }
}

/** El sombrero de copa: el ala dorada y verde, la copa de rayas rosadas y verdes, la cinta y los payasitos del ala. */
function sombrero(p: Pintura) {
  const cx = X(-4);
  const cy = Y(-33);
  p.volumen(el(cx, cy, R(27), R(8)), VERDE, { alto: 3, planos: true, borde: "oscuro", sombra: 0.4, pinta: (q, c) => (Math.hypot((q.x - OX - cx) / R(27), (q.y - OY - cy) / R(8)) > 0.82 ? tono(ORO, 4) : c) });
  // Los penachos de plumas a los lados de la copa (detrás).
  for (const [l, cols] of [
    [-1, [rampa("#f7c518"), rampa("#1fb8b0"), ROSADO]],
    [1, [rampa("#1fb8b0"), MORADO, rampa("#f7c518")]],
  ] as const)
    cols.forEach((c, k) => pluma(p, cx + l * R(13) + OX, cy - R(14) + OY, -Math.PI / 2 + l * (0.35 + k * 0.32), R(20 - k * 2), R(7), c, { brillo: 0.35 }));
  const copa = union(pol([cx - R(15), cy - 2], [cx + R(15), cy - 2], [cx + R(17), cy - R(30)], [cx - R(17), cy - R(30)]), el(cx, cy - 2, R(15), R(4)));
  p.volumen(copa, ROSADO, { alto: 6, planos: true, borde: "oscuro", patron: (q) => (Math.floor((q.x - OX - cx + R(17)) / R(5)) % 2 ? VERDE : ROSADO) });
  p.volumen(el(cx, cy - R(30), R(17), R(4.6)), ROSADO, { alto: 2, planos: true, borde: "oscuro", base: 0.6, patron: (q) => (Math.floor((q.x - OX - cx + R(17)) / R(5)) % 2 ? VERDE : ROSADO) });
  p.volumen(caja(cx - R(15.4) + OX, cy - R(8) + OY, cx + R(15.4) + OX, cy - R(4) + OY), ORO, { alto: 2, brillo: 0.9, planos: true, borde: "oscuro" });
  // Los payasitos sentados en el ala, de frente.
  for (let k = 0; k < 3; k++) {
    const bx = cx - R(15) + k * R(15);
    const by = cy + R(4) + Math.sin(((k + 0.5) / 3) * Math.PI) * R(2);
    payasito(p, bx, by, [MORADO, AMARILLO, VERDE][k]!, PIELES[k % 2]!);
  }
}

/** Una carita de payaso sentado (cabeza grande, cuello de vuelos, nariz roja y gorrito). */
function payasito(p: Pintura, x: number, y: number, ropa: Ramp, piel: Ramp) {
  p.volumen(el(x, y + 1, 5.6, 4), ropa, { alto: 2, borde: "oscuro" });
  for (let k = -2; k <= 2; k++) p.volumen(ci(x + k * 2.2, y - 2.4, 2), rampa("#f4f0e8"), { alto: 1, borde: "oscuro" });
  for (const d of [-1, 1]) p.volumen(ci(x + d * 5, y - 8, 2.4), rampa("#e8602a"), { alto: 1, borde: "oscuro" });
  p.volumen(ci(x, y - 8, 5.6), piel, { alto: 3, brillo: 0.5, borde: "oscuro" });
  p.volumen(el(x, y - 13.5, 3.6, 2.6), ropa, { alto: 1.5, borde: "oscuro" });
  for (const d of [-1, 1]) {
    p.plano(el(x + d * 2.1, y - 9, 0.8, 1.2), LINEA);
    mejilla(p, x + d * 3.4 + OX, y - 6.4 + OY, 1.3, 0.8, tono(rampa("#ef6ba0"), 3));
  }
  p.volumen(ci(x, y - 7, 1.6), rampa("#e0283c"), { alto: 1, brillo: 1, borde: false });
  p.curva(x - 2.4 + OX, y - 5 + OY, x + OX, y - 2.8 + OY, x + 2.4 + OX, y - 5 + OY, LINEA, 1);
}

/** Un pedestal de circo en 3/4: la tapa, el frente claro, el lado en sombra y el ribete dorado. */
function pedestal(p: Pintura, u: number, v: number, w: number, d: number, h: number, c: Ramp, c2: Ramp) {
  const q = (a: number, b: number, z: number): [number, number] => {
    const s = pantalla(a, b, z);
    return [s.x, s.y];
  };
  p.volumen(pol(q(u, v + d, 0), q(u + w, v + d, 0), q(u + w, v + d, h), q(u, v + d, h)), c, { alto: 2, base: 0.5, planos: true, borde: "oscuro", pinta: (pt, col) => ((pt.x + pt.y) % 7 === 0 ? tono(c2, 4) : col) });
  p.volumen(pol(q(u + w, v, 0), q(u + w, v + d, 0), q(u + w, v + d, h), q(u + w, v, h)), c, { alto: 2, base: -1.2, planos: true, borde: "oscuro" });
  p.volumen(pol(q(u, v, h), q(u + w, v, h), q(u + w, v + d, h), q(u, v + d, h)), c2, { alto: 2, base: 0.8, planos: true, borde: "oscuro" });
  for (const z of [h - 0.8, 0.8]) {
    p.trazo(...P(...q(u, v + d, z)), ...P(...q(u + w, v + d, z)), tono(ORO, 4), 1);
    p.trazo(...P(...q(u + w, v + d, z)), ...P(...q(u + w, v, z)), tono(ORO, 2), 1);
  }
}

/** El perrito sentado: cuerpo blanco con manchas cafés, orejas caídas, collar rojo y la lengua afuera. */
function perrito(p: Pintura, x: number, y: number) {
  p.volumen(el(x, y - 8, 7, 9), PERRO, { alto: 4, planos: true, borde: "oscuro", patron: (q) => (q.x - OX > x + 2 && q.y - OY < y - 8 ? MANCHA_PERRO : PERRO) });
  for (const d of [-1, 1]) p.volumen(el(x + d * 4, y - 1, 3, 2), PERRO, { alto: 2, borde: "oscuro" });
  p.volumen(el(x, y - 17, 3, 6), rampa("#e0283c"), { alto: 2, borde: "oscuro" });
  p.volumen(el(x + 1, y - 22, 7, 6.4), PERRO, { alto: 4, brillo: 0.5, borde: "oscuro", patron: (q) => (q.x - OX > x + 3 ? MANCHA_PERRO : PERRO) });
  for (const d of [-1, 1]) p.volumen(el(x + 1 + d * 7, y - 21, 2.6, 5, d * 0.3), MANCHA_PERRO, { alto: 2, borde: "oscuro" });
  p.volumen(el(x + 3, y - 18.5, 3.6, 2.6), PERRO, { alto: 2, borde: "oscuro" });
  p.plano(el(x + 4, y - 20, 1.5, 1.1), LINEA);
  for (const d of [-1, 1]) {
    p.plano(ci(x + 1 + d * 2.6, y - 23.5, 1), LINEA);
    p.punto(Math.round(x + 1 + d * 2.6 + OX - 0.4), Math.round(y - 24.3 + OY), BRILLO);
  }
  p.volumen(el(x + 3.4, y - 15.6, 1.2, 1.6), LENGUA, { alto: 1, borde: "oscuro" });
}

/**
 * Un payaso del circo, de pie con los pies en (x, y): el traje bombacho de dos colores con pompones, el
 * cuello de vuelos, la cara clara con la nariz roja y la sonrisa pintada, los mechones naranjas a los lados
 * y el gorrito o el bombín.
 */
function payaso(p: Pintura, x: number, y: number, s: number, k: number) {
  const ropa = [MORADO, AMARILLO, VERDE, MAGENTA][k % 4]!;
  const ropa2 = [AMARILLO, MORADO, MAGENTA, VERDE][k % 4]!;
  const S = (v: number) => v * s;
  const piel = PIELES[k % 2]!;
  // Los zapatones y el pantalón bombacho.
  for (const d of [-1, 1]) p.volumen(el(x + d * S(4), y - S(1.5), S(3.6), S(1.8)), rampa("#e0283c"), { alto: 1, borde: "oscuro" });
  p.volumen(union(el(x, y - S(9), S(8), S(7)), caja(x - S(6) + OX, y - S(6) + OY, x + S(6) + OX, y - S(2) + OY)), ropa2, { alto: S(4), planos: true, borde: "oscuro" });
  // La blusa con pompones y los brazos (uno saluda).
  p.volumen(el(x, y - S(19), S(7.5), S(7)), ropa, { alto: S(4), planos: true, borde: "oscuro", patron: (q) => (q.x - OX < x ? ropa : ropa2) });
  for (let i = 0; i < 2; i++) p.volumen(ci(x, y - S(20 - i * 5), S(1.4)), rampa("#f4f0e8"), { alto: 1, borde: "oscuro" });
  const saluda = k % 2 ? 1 : -1;
  p.volumen(cap(x + saluda * S(6), y - S(22), x + saluda * S(12), y - S(30), S(2.4)), ropa, { alto: S(2), borde: "oscuro" });
  p.volumen(ci(x + saluda * S(12.5), y - S(31.5), S(2.5)), rampa("#f4f0e8"), { alto: S(2), borde: "oscuro" });
  p.volumen(cap(x - saluda * S(6), y - S(21), x - saluda * S(9), y - S(13), S(2.4)), ropa, { alto: S(2), borde: "oscuro" });
  p.volumen(ci(x - saluda * S(9), y - S(12), S(2.4)), rampa("#f4f0e8"), { alto: S(2), borde: "oscuro" });
  // El cuello de vuelos.
  for (let i = -3; i <= 3; i++) p.volumen(el(x + i * S(2.2), y - S(25.5) + Math.abs(i) * S(0.5), S(2.2), S(1.9)), rampa("#f4f0e8"), { alto: 1, borde: "oscuro", pinta: (q, c) => ((q.x + q.y) % 5 === 0 ? tono([ROSADO, VERDE, AMARILLO][(i + 3) % 3]!, 3) : c) });
  // La cabeza: los mechones naranjas, la cara, la nariz y la sonrisa.
  const hy = y - S(33);
  for (const d of [-1, 1]) p.volumen(el(x + d * S(7), hy + S(1), S(3.4), S(3.4)), rampa(["#e8602a", "#f2a21c", "#c83a2a"][k % 3]!), { alto: S(2), borde: "oscuro" });
  p.volumen(ci(x, hy, S(7.4)), piel, { alto: S(4), brillo: 0.5, borde: "oscuro" });
  p.volumen(el(x, hy + S(3.6), S(4), S(2.4)), rampa("#fbf2e8"), { alto: 1, borde: false });
  for (const d of [-1, 1]) {
    p.plano(el(x + d * S(2.8), hy - S(1), Math.max(0.9, S(1)), Math.max(1.2, S(1.5))), LINEA);
    p.punto(Math.round(x + d * S(2.8) - 0.5 + OX), Math.round(hy - S(1.8) + OY), BRILLO);
    mejilla(p, x + d * S(4.6) + OX, hy + S(2.4) + OY, S(1.6), S(1), tono(rampa("#ef6ba0"), 3));
  }
  p.curva(x - S(3) + OX, hy + S(3.4) + OY, x + OX, hy + S(6) + OY, x + S(3) + OX, hy + S(3.4) + OY, tono(rampa("#e0283c"), 2), 1);
  p.volumen(ci(x, hy + S(1.4), S(1.8)), rampa("#e0283c"), { alto: 1, brillo: 1, borde: "oscuro" });
  // El gorrito de pompón o el bombín.
  if (k % 3 === 0) {
    p.volumen(el(x, hy - S(6), S(8), S(2)), ropa2, { alto: 1.5, borde: "oscuro", sombra: 0.3 });
    p.volumen(union(el(x, hy - S(8), S(5), S(4)), caja(x - S(5) + OX, hy - S(8) + OY, x + S(5) + OX, hy - S(6) + OY)), ropa2, { alto: S(2), borde: "oscuro", planos: true });
    p.plano(caja(x - S(5) + OX, hy - S(7.5) + OY, x + S(5) + OX, hy - S(6.3) + OY), tono(ROSADO, 3));
  } else {
    p.volumen(pol([x - S(5.5), hy - S(5)], [x + S(5.5), hy - S(5)], [x + S(1), hy - S(15)]), ropa2, { alto: S(2), borde: "oscuro", planos: true, patron: (q) => (Math.floor((q.y - OY - hy) / S(3)) % 2 ? ropa2 : ropa) });
    p.volumen(ci(x + S(1), hy - S(15.5), S(2)), rampa("#f4f0e8"), { alto: 1, borde: "oscuro" });
  }
}

export function leon(): CarrozaArte {
  const s = escena(LARGO, 20);
  plataforma(s, LARGO, { faldon: festones([MAGENTA, MORADO, VERDE], rampa("#a8208a"), ORO), cubierta: () => tono(MORADO, 2), flecos: FLECO }, false);
  const f = fig();
  const partes: Parte[] = [parteBase(s)];

  // Atrás, en gradas: el pedestal alto con su fila de payasos, el del medio con la suya y el perrito.
  const grupo = (id: string, lugares: readonly (readonly [number, number, number])[], k0: number, mov: number) => {
    const p = f.lienzo();
    lugares.forEach(([u, v, z], k) => {
      const q = pantalla(u, v, z);
      payaso(p, q.x, q.y, 0.95, k + k0);
    });
    const q0 = pantalla(lugares[0]![0], lugares[0]![1], lugares[0]![2]);
    return f.parte(id, p, ...P(q0.x, q0.y), { mov: { vaiven: { dy: -1.5, periodo: 760 + mov * 90, fase: mov * 0.21 }, gira: { amp: 0.025, periodo: 1700, fase: mov * 0.3 } } });
  };
  const alto = f.lienzo();
  pedestal(alto, 2, 2, 44, 12, 18, MORADO, VERDE);
  partes.push(f.parte("grada-alta", alto, ...P(0, 0)));
  partes.push(grupo("payasos-arriba", [[8, 8, 18], [22, 8, 18], [36, 8, 18]], 0, 0));
  // El globo verde agua de un payaso de arriba.
  const glo = f.lienzo();
  const qg = pantalla(36, 8, 18);
  curvaP(glo, qg.x + 12, qg.y - 30, qg.x + 16, qg.y - 38, qg.x + 14, qg.y - 46, tono(rampa("#f4f0e8"), 4), 1);
  glo.volumen(el(qg.x + 14, qg.y - 52, 5, 6), rampa("#1fb8b0"), { alto: 3, brillo: 1, borde: "oscuro" });
  partes.push(f.parte("globo", glo, ...P(qg.x + 12, qg.y - 30), { mov: { gira: { amp: 0.12, periodo: 2300 } } }));
  const medio = f.lienzo();
  pedestal(medio, 4, 16, 26, 10, 9, VERDE, MAGENTA);
  pedestal(medio, 31, 17, 10, 10, 13, MAGENTA, AMARILLO);
  partes.push(f.parte("grada-medio", medio, ...P(0, 0)));
  partes.push(grupo("payasos-medio", [[10, 21, 9], [24, 21, 9]], 3, 1));

  // El perrito en su pedestal (mueve la cabeza).
  const per = f.lienzo();
  const qp = pantalla(36, 22, 13);
  perrito(per, qp.x, qp.y);
  partes.push(f.parte("perrito", per, ...P(qp.x, qp.y), { mov: { gira: { amp: 0.06, periodo: 1900 } } }));
  partes.push(grupo("payasos-lado", [[4, 33, 0], [18, 34, 0], [32, 35, 0]], 6, 2));

  // La baranda del costado.
  const bar = f.lienzo();
  baranda(bar, L(FL), L(pantalla(LARGO * 0.45, ANCHO, 0)), 11, [MAGENTA, MORADO, VERDE], rampa("#a8208a"), ORO, [ROSADO, AMARILLO, rampa("#f4f0f8"), VERDE]);
  partes.push(f.parte("baranda", bar, ...P(FL.x, FL.y)));

  // La melena (con la cara encima) y la cabeza.
  const mel = f.lienzo();
  melena(mel);
  partes.push(f.parte("melena", mel, ...P(X(-6), Y(50)), { mov: { gira: { amp: 0.012, periodo: 4200 } } }));
  const cab = f.lienzo();
  cara(cab);
  partes.push(f.parte("cabeza", cab, ...P(X(0), Y(36)), { padre: "melena", mov: { gira: { amp: 0.04, periodo: 3300 } } }));
  const qui = f.lienzo();
  quijada(qui);
  partes.push(f.parte("quijada", qui, ...P(X(3), Y(24)), { padre: "cabeza", mov: { vaiven: { dy: 2, periodo: 950 } } }));
  const parp = f.lienzo();
  parpado(parp, ...P(X(-11), Y(-6)), R(14.5), R(7), R(5.2), -1, CARA);
  parpado(parp, ...P(X(12), Y(-7)), R(13), R(6.6), R(4.8), 1, CARA);
  partes.push(f.parte("parpados", parp, ...P(X(0), Y(36)), { padre: "cabeza", contorno: false, mov: { parpadeo: { cada: 3100, dura: 190 } } }));
  const som = f.lienzo();
  sombrero(som);
  partes.push(f.parte("sombrero", som, ...P(X(-4), Y(-33)), { padre: "cabeza", mov: { gira: { amp: 0.05, periodo: 1600 } } }));

  return { largo: LARGO, partes, luces: [], marco: { x0: -ANCHO - 40, x1: LARGO + 40 } };
}
