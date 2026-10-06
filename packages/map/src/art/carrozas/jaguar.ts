// El Jaguar de la selva (pixel art pintado): la cabeza enorme del jaguar, morada y azul con rosetas
// negras, es el frente del camión y ruge con la boca abierta (colmillos de oro, lengua roja, bigotes
// blancos, ojos azules vivos). Detrás, sobre una cama de hojas y flores, la reina del Carnaval con su
// antifaz verde y el tocado de plumas moradas, verdes y naranjas, con los brazos arriba; atrás bailan los
// danzantes con sus plumas y los bombos. El faldón es morado, de festones dorados y flecos rojos, y el
// costado sube con una baranda de festones y flores.
import type { RGBA } from "../pixel";
import { abanico, BRILLO, Figura, ojo, parpado } from "./figuras";
import { baranda, danzante, festones, flor, hash, macizo, tambor, VERDES } from "./guirnaldas";
import type { CarrozaArte, Parte } from "./partes";
import { ANCHO, escena, ORO, pantalla, parteBase, plataforma } from "./plataforma";
import { circulo, elipse, Pintura, poligono, rampa, tono, union } from "./pintura";

const LARGO = 112;
const MORADO = rampa("#7e3ad8");
const AZUL = rampa("#3d7ae8");
const BLANCO = rampa("#e6ecf8");
const MANCHA = rampa("#2a1f52");
const NARIZ = rampa("#e86a8a");
const BOCA = rampa("#8a1a2a");
const LENGUA = rampa("#e0404a");
const COLMILLO = rampa("#f2cf5a");
const OREJA = rampa("#c86a7a");
const IRIS = rampa("#2f86e8");
const FALDON = rampa("#8a3ad0");
const FALDON2 = rampa("#b84ad8");
const TEAL = rampa("#1f8aa8");
const FLECO = [rampa("#c8243a"), rampa("#d83a6a")];
const PIELES = [rampa("#d89868"), rampa("#b87a4a"), rampa("#8a5a3a")];
const PLUMAS = [rampa("#8a3cc8"), rampa("#2fae6a"), rampa("#f2861c"), rampa("#1fb8b0"), rampa("#f7c518"), rampa("#e0283c")];
const FLORES = [rampa("#e8407a"), rampa("#f7c518"), rampa("#f4f0f8"), rampa("#f2711c"), rampa("#c84ad8")];

const OX = 90;
const OY = 130;
const fig = () => new Figura(250, 240, OX, OY, [0, 0, 0]);
const P = (x: number, y: number): [number, number] => [x + OX, y + OY];
const curvaP = (p: Pintura, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, c: RGBA, g = 1) => p.curva(x0 + OX, y0 + OY, cx + OX, cy + OY, x1 + OX, y1 + OY, c, g);
const pol = (...pts: [number, number][]) => poligono(pts.map(([x, y]) => P(x, y)));
const el = (x: number, y: number, rx: number, ry: number, a = 0) => elipse(x + OX, y + OY, rx, ry, a);
const ci = (x: number, y: number, r: number) => circulo(x + OX, y + OY, r);
/** Un punto de pantalla como punto del lienzo. */
const L = (q: { x: number; y: number }) => ({ x: q.x + OX, y: q.y + OY });

const FL = pantalla(0, ANCHO, 0);
/** El centro de la cabeza (al frente, arriba) y su escala: todo lo de la cabeza se mide en sus unidades. */
const H = { x: 76, y: 8 };
const K = 1.12;
const X = (d: number) => H.x + d * K;
const Y = (d: number) => H.y + d * K;
const R = (r: number) => r * K;
/** Dónde el hocico se vuelve blanco (la boca). */
const M = { x: X(32), y: Y(30) };

/**
 * El pelaje: blanco en el hocico y la barbilla, azul en los cachetes y morado arriba, con las rosetas
 * negras (anillos rotos con el centro más oscuro) que se achican hacia la cara hasta ser pintitas.
 */
function pelaje(q: { x: number; y: number }) {
  const x = q.x - OX;
  const y = q.y - OY;
  const d = Math.hypot((x - M.x) * 0.9, y - M.y) / K + Math.sin(x * 0.5 + y * 0.3) * 2;
  return d < 21 ? BLANCO : d < 34 ? AZUL : MORADO;
}
function rosetas(q: { x: number; y: number }, c: RGBA): RGBA | null {
  const x = q.x - OX;
  const y = q.y - OY;
  const d = Math.hypot((x - M.x) * 0.9, y - M.y) / K;
  if (d < 22) return null;
  const celda = d < 34 ? 7 : 11;
  const i = Math.floor(x / celda);
  const j = Math.floor(y / celda);
  const cx = (i + 0.3 + hash(i, j) * 0.4) * celda;
  const cy = (j + 0.3 + hash(j, i) * 0.4) * celda;
  const r = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.2);
  if (celda === 7) return r < 1.9 ? tono(MANCHA, r < 1 ? 1 : 2) : null;
  const a = Math.atan2(y - cy, x - cx);
  if (r < 4.6 && r > 2.4 && Math.sin(a * 3 + i * 2) > -0.6) return tono(MANCHA, r > 3.8 ? 0 : 1);
  if (r < 2.4) return [Math.round(c[0] * 0.72), Math.round(c[1] * 0.58), Math.round(c[2] * 0.86), 255];
  return null;
}

/** Una oreja: la piel morada, el hueco rosado y el mechón blanco. */
function oreja(p: Pintura, x: number, y: number, r: number, ang: number) {
  p.volumen(el(x, y, r * 0.85, r, ang), MORADO, { alto: 4, planos: true, borde: "oscuro", sombra: 0.35 });
  p.volumen(el(x + 1, y + 1.5, r * 0.5, r * 0.62, ang), OREJA, { alto: 2, base: -0.5, borde: false });
  for (let k = 0; k < 3; k++) p.trazo(...P(x - 1 + k * 1.5, y + r * 0.5), ...P(x + 1 + k * 2.4, y - r * 0.15), tono(BLANCO, 5), 1);
}

/** La cabeza: el cráneo y los cachetes, el puente del hocico, la nariz rosada, los ojos y la boca de arriba. */
function cabeza(p: Pintura) {
  oreja(p, X(-34), Y(-19), R(11), -0.5);
  oreja(p, X(8), Y(-33), R(8), 0.25);
  // La boca abierta (lo hondo, detrás de todo lo de la cara).
  p.volumen(pol([X(2), Y(24)], [X(48), Y(22)], [X(54), Y(30)], [X(46), Y(52)], [X(16), Y(60)], [X(-2), Y(46)]), BOCA, { alto: 6, base: -1.2, borde: "oscuro" });
  p.volumen(el(X(26), Y(40), R(14), R(8)), BOCA, { alto: 3, base: -2, borde: false });
  const forma = union(el(X(-4), Y(-7), R(35), R(27), -0.15), el(X(5), Y(12), R(33), R(19), 0.25), el(X(30), Y(6), R(18), R(12), 0.45), el(X(36), Y(19), R(16), R(7), 0.3));
  const piel = { planos: true, patron: pelaje, pinta: rosetas } as const;
  p.volumen(forma, MORADO, { ...piel, alto: 14, borde: "oscuro", brillo: 0.35 });
  // El volumen: la luz de la frente y la sombra de abajo de los cachetes y de la nuca.
  p.volumen(el(X(-14), Y(-21), R(16), R(8), -0.3), MORADO, { ...piel, alto: 4, base: 1, borde: false, brillo: 0 });
  p.volumen(el(X(8), Y(27), R(28), R(7), 0.2), MORADO, { ...piel, alto: 4, base: -1.2, borde: false, brillo: 0 });
  p.volumen(el(X(-30), Y(8), R(9), R(14), 0.2), MORADO, { ...piel, alto: 4, base: -0.8, borde: false, brillo: 0 });
  // El blanco alrededor de los ojos y las rayas azules de la frente.
  p.volumen(el(X(2), Y(-2), R(11), R(7.5), -0.1), BLANCO, { alto: 3, base: 0.6, borde: false });
  p.volumen(el(X(30), Y(-7), R(7), R(5.5), 0.2), BLANCO, { alto: 2, base: 0.4, borde: false });
  for (const [a, b] of [
    [-7, -15],
    [-2, -17],
    [3, -16],
  ] as const)
    curvaP(p, X(a), Y(b), X(a + 4), Y(b - 5), X(a + 9), Y(b - 7), tono(AZUL, 4), 1.6);
  // Los ojos: el de cerca grande (la esquina de afuera a la izquierda) y el de lejos, junto al hocico.
  ojo(p, ...P(X(2), Y(-2)), R(15), R(6), R(5), -1, { iris: IRIS, pestanas: 0, mira: 2 });
  ojo(p, ...P(X(30), Y(-7)), R(9), R(4), R(3.5), 1, { iris: IRIS, pestanas: 0, mira: 1 });
  // Las cejas oscuras, fruncidas (ruge).
  curvaP(p, X(-9), Y(-9), X(0), Y(-13), X(10), Y(-8), tono(MANCHA, 1), 2);
  curvaP(p, X(25), Y(-13), X(30), Y(-15), X(35), Y(-12), tono(MANCHA, 1), 1.6);
  // Las arrugas del hocico al rugir.
  for (let k = 0; k < 3; k++) curvaP(p, X(21 + k * 3), Y(2 + k * 1.5), X(25 + k * 3), Y(-1 + k * 1.5), X(30 + k * 3), Y(1 + k * 1.5), tono(AZUL, 1), 1);
  // La nariz rosada: ancha arriba, con las ventanas y la rayita al labio.
  p.volumen(union(el(X(44), Y(11), R(7), R(4.6), 0.2), pol([X(38), Y(12)], [X(50), Y(12)], [X(44), Y(19)])), NARIZ, { alto: 3, brillo: 0.9, planos: true, borde: "oscuro", sombra: 0.4 });
  for (const l of [-1, 1]) p.plano(el(X(44 + l * 3.4), Y(13), R(1.6), R(1.1), l * 0.5), tono(BOCA, 0));
  p.trazo(...P(X(44), Y(18.5)), ...P(X(43), Y(22)), tono(MANCHA, 1), 1);
  // Las pintitas de los bigotes en el hocico.
  for (let k = 0; k < 9; k++) p.plano(ci(X(26 + (k % 3) * 4 + Math.floor(k / 3) * 1.6), Y(16 + Math.floor(k / 3) * 2.6), 0.8), tono(MANCHA, 2));
  // El labio de arriba (rojo) y los dientes de oro de arriba, con los dos colmillos grandes.
  curvaP(p, X(2), Y(25), X(26), Y(30), X(50), Y(24), tono(LENGUA, 2), 2);
  for (let k = 0; k < 9; k++) {
    const t = (k + 0.5) / 9;
    const dx = X(6 + t * 40);
    const dy = Y(26.4 + Math.sin(t * Math.PI) * 3.6);
    p.volumen(pol([dx - 2, dy], [dx + 2, dy], [dx, dy + 5]), COLMILLO, { alto: 1, brillo: 0.9, planos: true, borde: "oscuro" });
  }
  for (const [cx, cy, l] of [
    [X(8), Y(27), R(13)],
    [X(42), Y(27), R(12)],
  ] as const) {
    p.volumen(pol([cx - 3.6, cy - 1], [cx + 3.6, cy - 1], [cx + 0.6, cy + l]), COLMILLO, { alto: 2, brillo: 1, planos: true, borde: "oscuro", sombra: 0.4 });
    p.trazo(...P(cx - 1.6, cy + 1), ...P(cx - 0.5, cy + l * 0.6), BRILLO, 1);
  }
}

/** La quijada de abajo (se abre): la barbilla blanca, el labio rojo, la lengua y los dientes de oro de abajo. */
function quijada(p: Pintura) {
  p.volumen(el(X(24), Y(47), R(18), R(8), -0.15), LENGUA, { alto: 4, brillo: 0.6, planos: true, borde: "oscuro" });
  p.trazo(...P(X(16), Y(45)), ...P(X(34), Y(43)), tono(LENGUA, 1), 1);
  const barbilla = pol([X(-2), Y(46)], [X(14), Y(56)], [X(30), Y(56)], [X(46), Y(46)], [X(54), Y(34)], [X(56), Y(40)], [X(46), Y(60)], [X(28), Y(72)], [X(8), Y(68)], [X(-6), Y(56)]);
  p.volumen(barbilla, BLANCO, { alto: 7, planos: true, borde: "oscuro", patron: (q) => (q.x - OX < X(2) || q.y - OY > Y(66) ? AZUL : BLANCO), sombra: 0.35 });
  curvaP(p, X(-2), Y(46), X(22), Y(62), X(54), Y(34), tono(LENGUA, 2), 2);
  for (let k = 0; k < 8; k++) {
    const t = (k + 0.5) / 8;
    const bx = (1 - t) * (1 - t) * X(-2) + 2 * (1 - t) * t * X(22) + t * t * X(54);
    const by = (1 - t) * (1 - t) * Y(46) + 2 * (1 - t) * t * Y(62) + t * t * Y(34);
    p.volumen(el(bx, by - 2.6, 2, 2.6), COLMILLO, { alto: 1, brillo: 0.9, borde: "oscuro" });
  }
  for (const [cx, cy] of [
    [X(3), Y(50)],
    [X(48), Y(41)],
  ] as const)
    p.volumen(pol([cx - 3, cy + 1], [cx + 3, cy + 1], [cx, cy - 12]), COLMILLO, { alto: 2, brillo: 1, planos: true, borde: "oscuro" });
}

/** Los bigotes blancos: largos hacia adelante desde el hocico y cortitos en el cachete. */
function bigotes(p: Pintura) {
  for (const [dy, fin, cur] of [
    [12, 6, -5],
    [16, 14, -1],
    [20, 22, 3],
  ] as const)
    curvaP(p, X(50), Y(dy), X(56), Y(dy + cur), X(62), Y(fin), tono(BLANCO, 5), 1);
  for (const dy of [14, 18, 22]) curvaP(p, X(24), Y(dy), X(14), Y(dy - 1), X(4), Y(dy + 2), tono(BLANCO, 5), 1);
}

/** Los párpados (aparte, para el parpadeo). */
function parpados(p: Pintura) {
  parpado(p, ...P(X(2), Y(-2)), R(15), R(6), R(5), -1, AZUL);
  parpado(p, ...P(X(30), Y(-7)), R(9), R(4), R(3.5), 1, AZUL);
}

/** Dónde va la reina (de pie en la cubierta, detrás de la cabeza). */
const REINA = pantalla(LARGO * 0.32, ANCHO * 0.36, 0);

/** La reina: el tocado grande de plumas y la reina con antifaz verde y los brazos arriba. */
function reina(p: Pintura) {
  const [cx, by] = P(REINA.x, REINA.y);
  abanico(p, cx, by - 60, 10, 36, -Math.PI * 0.97, -Math.PI * 0.03, 9, PLUMAS, 10);
  danzante(p, cx, by, 1.7, { piel: PIELES[0]!, traje: rampa("#f2861c"), traje2: rampa("#8a3cc8"), plumas: [PLUMAS[0]!, PLUMAS[1]!, PLUMAS[2]!, PLUMAS[3]!, PLUMAS[0]!], pelo: rampa("#2a1a22"), falda: true, antifaz: rampa("#2fae6a") });
  // Los aretes dorados.
  for (const l of [-1, 1]) p.volumen(circulo(cx + l * 14.2, by - 50, 2), ORO, { alto: 1, brillo: 1, borde: "oscuro" });
}

export function jaguar(): CarrozaArte {
  const s = escena(LARGO, 20);
  plataforma(s, LARGO, { faldon: festones([FALDON, FALDON2], TEAL, ORO), cubierta: (u, v) => tono(VERDES[2]!, 2 + ((Math.floor(u / 3) + Math.floor(v / 3)) % 2)), flecos: FLECO }, false);
  const f = fig();
  const partes: Parte[] = [parteBase(s)];

  // Atrás: los bombos y la mata de flores del fondo.
  const fondo = f.lienzo();
  macizo(fondo, P(-6, 0)[0], P(60, 0)[0], (xx) => OY + 2 + (xx - OX) * 0.3, 10, FLORES, 3);
  for (const [u, v] of [
    [30, 8],
    [42, 4],
  ] as const) {
    const q = pantalla(u, v, 0);
    tambor(fondo, ...P(q.x, q.y), 6, 13, rampa("#e6b02a"), rampa("#c8243a"));
  }
  partes.push(f.parte("bombos", fondo, ...P(0, 0)));

  const fila = (id: string, lugares: readonly (readonly [number, number])[], k0: number) => {
    const p = f.lienzo();
    lugares.forEach(([u, v], k) => {
      const q = pantalla(u, v, 0);
      const i = k + k0;
      danzante(p, ...P(q.x, q.y), 0.9, {
        piel: PIELES[i % 3]!,
        traje: [rampa("#f2861c"), rampa("#8a3cc8"), rampa("#2fae6a")][i % 3]!,
        traje2: [rampa("#8a3cc8"), rampa("#e0283c"), rampa("#f7c518")][i % 3]!,
        plumas: [PLUMAS[i % 6]!, PLUMAS[(i + 2) % 6]!, PLUMAS[(i + 4) % 6]!, PLUMAS[(i + 1) % 6]!],
        pelo: rampa("#2a1a22"),
        falda: i % 2 === 0,
        ...(i % 3 === 2 ? { sombrero: rampa("#2a62c8") } : {}),
      });
    });
    const q0 = pantalla(lugares[0]![0], lugares[0]![1], 0);
    return f.parte(id, p, ...P(q0.x, q0.y), { mov: { vaiven: { dy: -1.6, periodo: 700 + k0 * 60, fase: k0 * 0.17 }, gira: { amp: 0.025, periodo: 1500, fase: k0 * 0.3 } } });
  };
  partes.push(fila("danzantes-atras", [[4, 6], [18, 2], [50, 4]], 0));

  const rei = f.lienzo();
  reina(rei);
  partes.push(f.parte("reina", rei, ...P(REINA.x, REINA.y), { mov: { gira: { amp: 0.03, periodo: 2600 }, vaiven: { dy: -1.2, periodo: 1300 } } }));
  partes.push(fila("danzantes-lado", [[2, 26], [16, 33], [32, 36]], 3));

  // La baranda del costado (con flores en el pasamanos) y el ramo del cuello del jaguar.
  const flores = f.lienzo();
  const fin = pantalla(LARGO * 0.6, ANCHO, 0);
  baranda(flores, L(FL), L(fin), 12, [FALDON, FALDON2], TEAL, ORO, FLORES);
  // La cama de hojas y flores que cubre la cubierta hasta el cuello del jaguar (filas a lo largo).
  const cama = (u0: number, u1: number, v: number, alto: number, semilla: number) =>
    macizo(flores, P(u0 - v, 0)[0], P(u1 - v, 0)[0], (xx) => OY + (xx - OX) / 2 + v, alto, FLORES, semilla);
  cama(44, 106, 18, 16, 5);
  cama(40, 106, 28, 18, 7);
  cama(56, 100, 38, 14, 9);
  partes.push(f.parte("flores", flores, ...P(FL.x, FL.y)));

  const cab = f.lienzo();
  cabeza(cab);
  bigotes(cab);
  partes.push(f.parte("cabeza", cab, ...P(X(-12), Y(40)), { mov: { gira: { amp: 0.03, periodo: 3600 } } }));
  const qui = f.lienzo();
  quijada(qui);
  partes.push(f.parte("quijada", qui, ...P(X(22), Y(40)), { padre: "cabeza", mov: { vaiven: { dy: 2.6, periodo: 1050 } } }));
  const parp = f.lienzo();
  parpados(parp);
  partes.push(f.parte("parpados", parp, ...P(X(-12), Y(40)), { padre: "cabeza", contorno: false, mov: { parpadeo: { cada: 3400, dura: 200 } } }));

  return { largo: LARGO, partes, luces: [], marco: { x0: -ANCHO - 40, x1: LARGO + 40 } };
}
