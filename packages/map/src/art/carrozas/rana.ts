// La Rana dorada (pixel art pintado): la rana dorada del Pacífico, gigante y sentada, de oro brillante con
// pintas cafés en el lomo y las patas, los ojos saltones verdes, la sonrisa de oreja a oreja con la lengua
// afuera, la corona de oro con piedras y plumas, y el collar de plumas de colores con la cadena y el rubí.
// Debajo de la boca infla el buche. A sus pies, entre hojas grandes y flores del monte, cuatro ranitas de oro
// tocan el cununo; atrás, tres bailarines con tocado de plumas.
// Todo se dibuja de frente a la pantalla en 3/4 (el lado izquierdo con luz, el derecho en sombra), en
// coordenadas de pantalla desde el origen de la carroza.
import type { Ramp, RGBA } from "../pixel";
import { abanico, ARCOIRIS, BRILLO, Figura, LINEA, ojo, parpado, pluma } from "./figuras";
import { figurita } from "./munecos";
import type { CarrozaArte, Parte } from "./partes";
import { ANCHO, escena, ORO, pantalla, parteBase, plataforma } from "./plataforma";
import { capsula, circulo, corte, elipse, Pintura, poligono, rampa, resta, tono, union, type Forma } from "./pintura";

const LARGO = 112;
const RANA = rampa("#f2be1c");
const PANZA = rampa("#f6dc7a");
const PINTA = rampa("#5a3a1a");
const BOCA = rampa("#8a1a30");
const LENGUA = rampa("#e8607a");
const DIENTE = rampa("#f6f0e0");
const VERDE = rampa("#3db842");
const HOJA = rampa("#2a8a3a");
const ROJO = rampa("#d8283a");
const NARANJA = rampa("#f2711c");
const MORADO = rampa("#8a3cc8");
const AZUL = rampa("#2f6fd6");
const TURQUESA = rampa("#1fb8b0");
const AMARILLO = rampa("#f7d21c");
const MADERA = rampa("#9a5a2a");
const CUERO = rampa("#ead6a8");
const PIELES = [rampa("#8d5524"), rampa("#c68642"), rampa("#5a3a24")];

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
const BK = pantalla(0, 0, -10);
/** El centro del cuerpo y el de la cabeza. */
const B = { x: 38, y: 8 };
const H = { x: 34, y: -36 };

/** Las pintas cafés de la piel (fijas: salen de una grilla corrida, con el tamaño que cambia). */
function pintas(q: { x: number; y: number }, c: RGBA): RGBA {
  const x = q.x - OX;
  const y = q.y - OY;
  const cx = Math.floor(x / 11);
  const cy = Math.floor(y / 10);
  const h = ((cx * 37 + cy * 61) % 13 + 13) % 13;
  if (h % 4 === 3) return c;
  const px = cx * 11 + 3.5 + (h % 4);
  const py = cy * 10 + 3.5 + (h % 3);
  const r = 2 + (h % 3) * 0.7;
  const d = Math.hypot(x - px, (y - py) * 1.1);
  if (d < r) return tono(PINTA, d < r - 0.9 ? 2 : 1);
  return c;
}

/** Una flor del monte (de cinco pétalos grandes, como la cayena), con el pistilo amarillo. */
function flor(p: Pintura, x: number, y: number, r: number, petalo: Ramp) {
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    p.volumen(el(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75, r * 0.7, r * 0.52, a), petalo, { alto: 1.6, brillo: 0.4, planos: true, borde: "oscuro" });
  }
  p.volumen(ci(x, y, r * 0.3), AMARILLO, { alto: 1.2, brillo: 0.9, borde: "oscuro" });
  p.trazo(x + OX, y + OY, x + r * 0.6 + OX, y - r * 0.5 + OY, tono(AMARILLO, 5), 1);
}

/** Una hoja grande del monte (con su vena y las nervaduras). */
function hoja(p: Pintura, x: number, y: number, ang: number, largo: number, ancho: number, r: Ramp) {
  const cx = x + Math.cos(ang) * largo * 0.5;
  const cy = y + Math.sin(ang) * largo * 0.5;
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  p.volumen(el(cx, cy, largo / 2, ancho / 2, ang), r, {
    alto: ancho * 0.35,
    planos: true,
    borde: "oscuro",
    sombra: 0.3,
    pinta: (q, c) => {
      const dx = q.x + 0.5 - OX - x;
      const dy = q.y + 0.5 - OY - y;
      const along = dx * ux + dy * uy;
      const side = -dx * uy + dy * ux;
      if (Math.abs(side) < 0.6 && along < largo * 0.92) return tono(r, 5);
      if (Math.abs(((along - Math.abs(side) * 1.2) % 5) + 5) % 5 < 0.7) return tono(r, 1);
      return c;
    },
  });
}

/** La rana: las patas de atrás dobladas, el cuerpo, la panza, las patas de adelante y el collar de plumas. */
function cuerpo(p: Pintura) {
  // Las patas de atrás, dobladas a los lados, con los dedos largos y las ventosas.
  for (const [l, dx] of [
    [-1, -34],
    [1, 38],
  ] as const) {
    p.volumen(el(B.x + dx, B.y + 8, 17, 21, l * 0.35), RANA, { alto: 9, planos: true, borde: "oscuro", sombra: 0.4, brillo: 0.7, pinta: pintas });
    const pie = { x: B.x + dx + l * 10, y: B.y + 30 };
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 2 + l * (0.2 + k * 0.38);
      const t = { x: pie.x + Math.cos(a) * 12, y: pie.y + Math.sin(a) * 5 };
      p.volumen(cap(pie.x, pie.y, t.x, t.y, 2.4, 1.8), RANA, { alto: 1.5, planos: true, borde: "oscuro", sombra: 0.3 });
      p.volumen(ci(t.x, t.y, 2.6), RANA, { alto: 1.5, brillo: 0.9, planos: true, borde: "oscuro", base: 0.4 });
    }
  }
  // El cuerpo y la panza clara.
  p.volumen(el(B.x, B.y - 2, 37, 30), RANA, { alto: 18, planos: true, borde: "oscuro", sombra: 0.4, brillo: 0.7, pinta: (q, c) => (Math.hypot(q.x - OX - B.x + 2, (q.y - OY - B.y - 10) * 1.1) < 22 ? c : pintas(q, c)) });
  p.volumen(el(B.x - 2, B.y + 10, 22, 18), PANZA, { alto: 8, planos: true, borde: false, brillo: 0.5, pinta: (q, c) => ((q.y % 4) === 0 && (q.x % 3) !== 0 ? tono(PANZA, 2) : c) });
  // Las patas de adelante, derechas, con los dedos abiertos y las ventosas.
  for (const [l, hx] of [
    [-1, B.x - 22],
    [1, B.x + 22],
  ] as const) {
    p.volumen(cap(hx - l * 2, B.y - 2, hx, B.y + 28, 7, 5.5), RANA, { alto: 4, planos: true, borde: "oscuro", sombra: 0.35, brillo: 0.6, pinta: pintas });
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 2 + (k - 1.5) * 0.55;
      const t = { x: hx + Math.cos(a) * 9, y: B.y + 30 + Math.sin(a) * 4 };
      p.volumen(cap(hx, B.y + 29, t.x, t.y, 2.2, 1.7), RANA, { alto: 1.5, planos: true, borde: "oscuro" });
      p.volumen(ci(t.x, t.y, 2.4), RANA, { alto: 1.5, brillo: 0.9, planos: true, borde: "oscuro", base: 0.4 });
    }
  }
  // El collar de plumas de colores, con la cadena de oro y el rubí.
  const cuello = { x: H.x + 2, y: H.y + 20 };
  for (let k = 0; k < 15; k++) {
    const t = k / 14;
    const a = Math.PI * (0.95 - t * 0.9);
    const bx = cuello.x + Math.cos(a) * 34;
    const by = cuello.y + Math.sin(a) * 9 - 6;
    pluma(p, bx + OX, by + OY, a + (t - 0.5) * 0.4, 13, 6, ARCOIRIS[(k * 3) % ARCOIRIS.length]!);
  }
  for (let k = 0; k <= 16; k++) {
    const t = k / 16;
    const x = cuello.x - 28 + t * 56;
    const y = cuello.y + 2 + Math.sin(t * Math.PI) * 7;
    p.volumen(el(x, y, 1.8, 1.3, 0.5 * (k % 2 ? 1 : -1)), ORO, { alto: 1, brillo: 0.9, borde: "oscuro" });
  }
  p.volumen(el(cuello.x, cuello.y + 11, 3.4, 4), ROJO, { alto: 2, brillo: 1, planos: true, borde: "oscuro" });
  p.volumen(resta(el(cuello.x, cuello.y + 11, 4.6, 5.2), el(cuello.x, cuello.y + 11, 3.4, 4)), ORO, { alto: 1, brillo: 0.9, borde: "oscuro" });
}

/** Los ojos saltones (centro y lado). */
const OJOS = [
  [H.x - 19, H.y - 16, -1],
  [H.x + 20, H.y - 17, 1],
] as const;

/** La cabeza: las cúpulas de los ojos, la cabeza ancha, la sonrisa de oreja a oreja con la lengua y la corona. */
function cabeza(p: Pintura) {
  const { x, y } = H;
  // La cabeza ancha y las cúpulas de los ojos, de oro, con pintas en la coronilla.
  const forma = union(el(x, y, 36, 20), ...OJOS.map(([cx, cy]) => ci(cx, cy, 11.5)));
  p.volumen(forma, RANA, { alto: 14, planos: true, borde: "oscuro", sombra: 0.4, brillo: 0.75, pinta: (q, c) => (q.y - OY < y - 10 && Math.abs(q.x - OX - x) < 10 ? pintas(q, c) : c) });
  for (const [cx, cy, l] of OJOS) {
    p.volumen(ci(cx, cy, 8.4), rampa("#2a2230"), { alto: 3, borde: false });
    const [ex, ey] = P(cx, cy + 0.4);
    ojo(p, ex, ey, 15, 7, 6.4, l, { iris: rampa("#3a9a4a"), pestanas: 0, mira: -l * 0.4, linea: 1.4 });
  }
  // Las ventanas de la nariz.
  for (const l of [-1, 1]) p.plano(el(x + l * 4, y - 4, 1.4, 1), tono(PINTA, 1));
  // La sonrisa: la boca abierta, los dientitos de arriba y la lengua.
  const boca = resta(el(x, y + 5, 29, 12), el(x, y - 3, 33, 10));
  p.volumen(boca, BOCA, { alto: 2, base: -0.6, borde: "oscuro" });
  p.volumen(corte(el(x + 2, y + 13, 15, 5.4), boca), LENGUA, { alto: 2.5, brillo: 0.8, borde: false });
  p.plano(corte(cap(x + 2, y + 10, x + 2, y + 15, 0.5), boca), tono(LENGUA, 1));
  for (let k = -6; k <= 6; k++) {
    const tx = x + k * 3.6;
    const ty = y + 7 - Math.sqrt(Math.max(0, 1 - (k / 8) ** 2)) * 0 + (k * k) * 0.05 - 0.4;
    if (Math.abs(k) < 6) p.volumen(pol([tx - 1.4, ty - 0.6], [tx + 1.4, ty - 0.6], [tx, ty + 2.6]), DIENTE, { alto: 1, brillo: 1, borde: "oscuro" });
  }
  // El labio de oro, gruesito, y las comisuras sonrientes.
  curvaP(p, x - 30, y + 2, x, y + 13, x + 30, y + 1, tono(RANA, 5), 1);
  for (const l of [-1, 1]) curvaP(p, x + l * 29, y + 3, x + l * 33, y + 2, x + l * 34, y - 2, tono(PINTA, 1), 1.4);
  // La corona de oro con picos, bolitas y piedras, ladeada, y las plumas detrás.
  const c = { x: x + 4, y: y - 26 };
  pluma(p, c.x - 4 + OX, c.y - 2 + OY, -1.85, 26, 9, ROJO);
  pluma(p, c.x + 2 + OX, c.y - 2 + OY, -1.45, 28, 9, VERDE);
  pluma(p, c.x + 8 + OX, c.y - 1 + OY, -1.0, 26, 9, MORADO);
  pluma(p, c.x + 12 + OX, c.y + 1 + OY, -0.6, 20, 8, AZUL);
  const corona = union(pol([c.x - 16, c.y + 8], [c.x + 16, c.y + 6], [c.x + 17, c.y - 10], [c.x + 10, c.y - 2], [c.x + 5, c.y - 14], [c.x, c.y - 3], [c.x - 6, c.y - 13], [c.x - 10, c.y - 1], [c.x - 17, c.y - 8]));
  p.volumen(corona, ORO, { alto: 4, brillo: 0.9, planos: true, borde: "oscuro", sombra: 0.4 });
  for (const [px, py] of [
    [c.x - 17, c.y - 9],
    [c.x - 6, c.y - 14],
    [c.x + 5, c.y - 15],
    [c.x + 17, c.y - 11],
  ] as const)
    p.volumen(ci(px, py, 2), ORO, { alto: 1.2, brillo: 1, borde: "oscuro" });
  p.volumen(el(c.x - 1, c.y + 2, 3, 3.6), ROJO, { alto: 1.5, brillo: 1, planos: true, borde: "oscuro" });
  p.volumen(ci(c.x - 10, c.y + 3, 2), VERDE, { alto: 1.2, brillo: 1, borde: "oscuro" });
  p.volumen(ci(c.x + 9, c.y + 2, 2), AZUL, { alto: 1.2, brillo: 1, borde: "oscuro" });
}

/** El buche que se infla, debajo de la boca. */
function buche(p: Pintura) {
  p.volumen(el(H.x + 1, H.y + 22, 15, 8), PANZA, { alto: 6, brillo: 0.9, planos: true, borde: "oscuro", pinta: (q, c) => ((q.y % 3) === 0 && (q.x % 4) === 1 ? tono(PANZA, 2) : c) });
}

/** Una ranita de oro sentada tocando el cununo (el tambor de madera con el parche de cuero). */
function ranita(p: Pintura, x: number, y: number, s: number, k: number) {
  const S = (v: number) => v * s;
  // El cuerpo y la cabeza con sus ojos.
  p.volumen(el(x, y - S(12), S(9), S(10)), RANA, { alto: S(5), brillo: 0.7, planos: true, borde: "oscuro", sombra: 0.35, pinta: pintas });
  const hy = y - S(24);
  p.volumen(union(el(x, hy, S(9), S(6)), ci(x - S(5), hy - S(4.4), S(3.6)), ci(x + S(5), hy - S(4.4), S(3.6))), RANA, { alto: S(4), brillo: 0.8, planos: true, borde: "oscuro" });
  for (const l of [-1, 1]) {
    p.plano(ci(x + l * S(5), hy - S(4.4), S(2.2)), tono(DIENTE, 5));
    p.plano(ci(x + l * S(5) + 0.4, hy - S(4.2), S(1.3)), LINEA);
    p.punto(Math.round(x + l * S(5) - 0.6 + OX), Math.round(hy - S(5.2) + OY), BRILLO);
  }
  p.volumen(resta(el(x, hy + S(1.4), S(6), S(3.4)), el(x, hy - S(1), S(7), S(3))), BOCA, { alto: 1, borde: "oscuro" });
  p.plano(el(x + S(1), hy + S(3.4), S(2.6), S(1)), tono(LENGUA, 3));
  // Una vincha de color.
  p.volumen(cap(x - S(8), hy - S(2), x + S(8), hy - S(2.6), S(1.2)), [ROJO, TURQUESA, MORADO, NARANJA][k % 4]!, { alto: 1, borde: "oscuro" });
  // El cununo delante, con el parche, los aros y las cuñas.
  const d = { x: x + S(1), y: y - S(2) };
  p.volumen(caja2(d.x, d.y, S(8), S(10)), MADERA, { alto: 2, planos: true, borde: "oscuro", sombra: 0.35, pinta: (q, c) => (Math.abs(q.y - OY - (d.y - S(3))) < 0.8 ? tono(ROJO, 3) : (q.x + q.y) % 5 === 0 ? tono(MADERA, 1) : c) });
  p.volumen(el(d.x, d.y - S(10), S(8), S(2.8)), CUERO, { alto: 1.5, brillo: 0.5, planos: true, borde: "oscuro" });
}

/** El cuerpo del cununo: un barril angosto abajo. */
function caja2(x: number, y: number, r: number, h: number): Forma {
  return union(pol([x - r, y - h], [x + r, y - h], [x + r * 0.75, y], [x - r * 0.75, y]), el(x, y, r * 0.75, r * 0.3));
}

/** Las manos de una ranita que tocan el cununo (van aparte: suben y bajan). */
function manosRanita(p: Pintura, x: number, y: number, s: number) {
  const S = (v: number) => v * s;
  for (const l of [-1, 1]) {
    p.volumen(cap(x + l * S(7), y - S(16), x + l * S(4) + S(1), y - S(13.5), S(1.8)), RANA, { alto: 1.2, planos: true, borde: "oscuro" });
    p.volumen(ci(x + l * S(4) + S(1), y - S(13), S(2)), RANA, { alto: 1.2, brillo: 0.9, borde: "oscuro" });
  }
}

/** Un bailarín de atrás, con tocado de plumas. */
function bailarin(f: Figura, id: string, x: number, y: number, k: number, fase: number): Parte {
  const p = f.lienzo();
  const [cx, cy] = P(x, y);
  figurita(p, cx, cy, 0.6, { piel: PIELES[k % 3]!, ropa: [ROJO, TURQUESA, NARANJA][k % 3]!, pelo: rampa("#1d1622") });
  abanico(p, cx, cy - 31, 3, 12, -Math.PI + 0.35, -0.35, 5, ARCOIRIS.slice(k * 2), 4);
  p.volumen(cap(cx - 5 - OX, cy - 29 - OY, cx + 5 - OX, cy - 29 - OY, 1.5), ORO, { alto: 1, borde: "oscuro" });
  return f.parte(id, p, cx, cy, { mov: { gira: { amp: 0.09, periodo: 1100 + k * 170, fase }, vaiven: { dy: -1.8, periodo: 550 + k * 40, fase } } });
}

/** El faldón: espirales de colores (rojo, morado, amarillo y turquesa) sobre fondo vino. */
function espirales(u: number, v: number, alto: number): RGBA {
  const cell = 9;
  const k = Math.floor(u / cell);
  const fu = (((u % cell) + cell) % cell) - cell / 2;
  const fv = v - alto / 2;
  const r = Math.hypot(fu, fv * 1.2);
  const a = Math.atan2(fv, fu);
  const col = [AMARILLO, TURQUESA, NARANJA, MORADO][k % 4]!;
  if (r < 4.2 && (((r - a * 0.7) % 1.9) + 1.9) % 1.9 < 0.8) return tono(col, 4);
  if (v > alto - 1.6) return tono(VERDE, 3);
  return tono(ROJO, 2 + ((Math.floor(u) + Math.floor(v)) % 2 ? 0.4 : 0));
}

export function rana(): CarrozaArte {
  const s = escena(LARGO, 20);
  plataforma(s, LARGO, { faldon: espirales, cubierta: (u, v) => tono(HOJA, 3 + ((Math.floor(u / 4) + Math.floor(v / 4)) % 2 ? 0.4 : -0.2)), flecos: [VERDE, AMARILLO, VERDE, ROJO] }, false);
  const f = fig();
  const partes: Parte[] = [parteBase(s)];

  // Atrás: el monte (hojas grandes) y los bailarines.
  const mon = f.lienzo();
  for (const [x, y, a, l, r] of [
    [BK.x - 10, BK.y + 4, -2.4, 34, HOJA],
    [BK.x + 4, BK.y - 4, -1.9, 40, VERDE],
    [BK.x + 26, BK.y - 2, -1.5, 36, HOJA],
    [FR.x - 30, FR.y - 34, -1.2, 36, VERDE],
    [FR.x - 14, FR.y - 26, -0.6, 34, HOJA],
    [BK.x - 22, BK.y + 14, -2.8, 30, VERDE],
    [BK.x + 44, BK.y - 2, -1.7, 34, VERDE],
    [FR.x - 20, FR.y - 30, -0.9, 40, HOJA],
  ] as [number, number, number, number, Ramp][])
    hoja(mon, x, y, a, l, 15, r);
  flor(mon, BK.x - 2, BK.y - 26, 5, MORADO);
  flor(mon, FR.x - 16, FR.y - 50, 5, ROJO);
  partes.push(f.parte("monte", mon, ...P(B.x, B.y), { mov: { gira: { amp: 0.01, periodo: 4400 } } }));

  // La rana: el cuerpo, la cabeza, los párpados y el buche que se infla.
  const cue = f.lienzo();
  cuerpo(cue);
  partes.push(f.parte("cuerpo", cue, ...P(B.x, B.y + 30), { mov: { gira: { amp: 0.006, periodo: 4800 } } }));
  const cab = f.lienzo();
  cabeza(cab);
  partes.push(f.parte("cabeza", cab, ...P(H.x, H.y + 18), { padre: "cuerpo", mov: { gira: { amp: 0.045, periodo: 3000 } } }));
  const parp = f.lienzo();
  for (const [cx, cy, l] of OJOS) {
    const [ex, ey] = P(cx, cy + 0.4);
    parpado(parp, ex, ey, 15, 7, 6.4, l, RANA);
  }
  partes.push(f.parte("parpados", parp, ...P(H.x, H.y + 18), { padre: "cabeza", contorno: false, mov: { parpadeo: { cada: 3300, dura: 260 } } }));
  const buc = f.lienzo();
  buche(buc);
  partes.push(f.parte("buche", buc, ...P(H.x + 1, H.y + 15), { padre: "cabeza", mov: { escala: { sx: 0.16, sy: 0.32, periodo: 1600 } } }));
  // Los bailarines, atrás a la derecha, junto a la pata.
  partes.push(bailarin(f, "bailarin-1", 86, 46, 0, 0), bailarin(f, "bailarin-2", 98, 52, 1, 0.3), bailarin(f, "bailarin-3", 110, 57, 2, 0.6));

  // Adelante: hojas y flores, y las ranitas con el cununo (las manos tocan aparte).
  const fre = f.lienzo();
  const borde = (t: number) => ({ x: FL.x + (FC.x - FL.x) * t, y: FL.y - 9 + (FC.y - FL.y) * t });
  for (const [t, c] of [
    [0.05, NARANJA],
    [0.3, MORADO],
    [0.55, ROJO],
    [0.8, MORADO],
    [0.98, NARANJA],
  ] as const) {
    const q = borde(t);
    for (let i = 0; i < 4; i++) hoja(fre, q.x - 7 + i * 5, q.y + 2, -Math.PI / 2 + (i - 1.5) * 0.7, 12, 6, i % 2 ? HOJA : VERDE);
    flor(fre, q.x, q.y - 3, 4.4, c);
  }
  for (const t of [0.3, 0.7]) {
    const q = { x: FC.x + (FR.x - FC.x) * t, y: FC.y - 9 + (FR.y - FC.y) * t };
    hoja(fre, q.x - 4, q.y + 2, -1.9, 12, 6, VERDE);
    hoja(fre, q.x + 2, q.y + 2, -1.1, 12, 6, HOJA);
    flor(fre, q.x, q.y - 2, 4, t < 0.5 ? ROJO : MORADO);
  }
  partes.push(f.parte("frente", fre, ...P(FC.x, FC.y)));
  const ranitas: [number, number][] = [
    [FL.x + 20, FL.y - 4],
    [FL.x + 52, FL.y + 12],
    [FL.x + 84, FL.y + 30],
    [FC.x + 20, FC.y - 22],
  ];
  ranitas.forEach(([x, y], k) => {
    const p = f.lienzo();
    ranita(p, x, y, 0.9, k);
    partes.push(f.parte(`ranita-${k}`, p, ...P(x, y), { mov: { gira: { amp: 0.05, periodo: 1200 + k * 90, fase: k * 0.25 } } }));
    const m = f.lienzo();
    manosRanita(m, x, y, 0.9);
    partes.push(f.parte(`manos-${k}`, m, ...P(x, y - 13), { padre: `ranita-${k}`, mov: { vaiven: { dy: -2, periodo: 320 + k * 20, fase: k * 0.3 } } }));
  });
  void [corte, TURQUESA];
  return { largo: LARGO, partes, luces: [], marco: { x0: -ANCHO - 40, x1: LARGO + 40 } };
}

export type { Forma };
