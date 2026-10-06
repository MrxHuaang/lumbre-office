// El Juglar del acordeón (pixel art pintado): un payaso juglar gigante sentado en la carroza, de cara
// blanca, nariz roja y la sonrisa de oreja a oreja, con el gorro de dos puntas (azul y rojo) de
// cascabeles dorados, la gola de pliegues y el traje de arlequín; toca un acordeón rojo de fuelle azul que
// se abre y se cierra. Al frente, el perro de papel maché (blanco, con su gorrito de juglar) es la trompa
// del camión, y a los lados la baranda barroca de olas rojas y azules con volutas de oro. Alrededor, la
// banda chiquita: trompetas, trombón, dos tambores y un niño de tocado de plumas.
import type { Ramp, RGBA } from "../pixel";
import { BRILLO, Figura, LINEA, mejilla, ojo, parpado, sonrisa } from "./figuras";
import { palitos, persona, tambor } from "./gentecita";
import type { CarrozaArte, Parte } from "./partes";
import { ANCHO, escena, ORO, pantalla, parteBase, plataforma } from "./plataforma";
import { caja, capsula, circulo, elipse, fundir, Pintura, poligono, rampa, tono, union, type Forma } from "./pintura";

const LARGO = 112;
const ROJO = rampa("#d8283a");
const AZUL = rampa("#2a4fc8");
const AZUL2 = rampa("#3a6ae0");
const BLANCO = rampa("#f6efe2");
const CREMA = rampa("#efe2c6");
const NEGRO = rampa("#2a2236");
const NARIZ = rampa("#e82a2a");
const MADERA = rampa("#8a5a32");
const PIELES = [rampa("#e8b088"), rampa("#c98a5a"), rampa("#a8704a")];
const PLUMAS = [rampa("#e0283c"), rampa("#2f6fd6"), rampa("#3db842"), rampa("#8a3cc8"), rampa("#f7c518")];

/** El lienzo de la figura: cubre la carroza (pantalla de -80..156 en x y de -170..115 en y). */
const OX = 80;
const OY = 170;
const fig = () => new Figura(236, 285, OX, OY, [0, 0, 0]);
const P = (x: number, y: number): [number, number] => [x + OX, y + OY];
const curvaP = (p: Pintura, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, c: RGBA, g = 1) => p.curva(x0 + OX, y0 + OY, cx + OX, cy + OY, x1 + OX, y1 + OY, c, g);
const pol = (...pts: [number, number][]) => poligono(pts.map(([x, y]) => P(x, y)));
const el = (x: number, y: number, rx: number, ry: number, a = 0) => elipse(x + OX, y + OY, rx, ry, a);
const ci = (x: number, y: number, r: number) => circulo(x + OX, y + OY, r);
const cap = (ax: number, ay: number, bx: number, by: number, ra: number, rb = ra) => capsula(ax + OX, ay + OY, bx + OX, by + OY, ra, rb);
const op = { planos: true, borde: "oscuro" as const };

/** El centro de la cadera del juglar (sentado) y el de su cara. */
const J = { x: 28, y: 14 };
const K = { x: 28, y: -44 };
/** El perro del frente: el centro del cráneo. */
const D = { x: 90, y: 44 };

/** Una forma que sigue una curva cuadrática, del radio `r0` al `r1` (puntas de gorro, colas, volutas). */
function cuerno(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, r0: number, r1: number): Forma {
  const n = 14;
  const fs: Forma[] = [];
  let px = x0;
  let py = y0;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const qx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
    const qy = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
    fs.push(cap(px, py, qx, qy, r0 + (r1 - r0) * ((i - 1) / n), r0 + (r1 - r0) * t));
    px = qx;
    py = qy;
  }
  return union(...fs);
}

/** Un cascabel dorado con su ranura. */
function cascabel(p: Pintura, x: number, y: number, r: number) {
  p.volumen(ci(x, y, r), ORO, { alto: r * 0.8, brillo: 1, ...op });
  p.plano(el(x, y + r * 0.35, r * 0.7, 0.6), tono(rampa("#6a3a12"), 1));
}

/** Una voluta de oro (espiral) pintada: el rulo de la talla barroca. */
function voluta(p: Pintura, x: number, y: number, r: number, giro: 1 | -1, col: RGBA = tono(ORO, 4)) {
  let px = x + r;
  let py = y;
  for (let i = 1; i <= 26; i++) {
    const a = (i / 26) * Math.PI * 2.4;
    const rr = r * (1 - (i / 26) * 0.8);
    const qx = x + Math.cos(a * giro) * rr;
    const qy = y + Math.sin(a * giro) * rr;
    p.trazo(px + OX, py + OY, qx + OX, qy + OY, col, Math.max(1, r * 0.32));
    px = qx;
    py = qy;
  }
}

// ---------- La carrocería: la baranda barroca y el perro ----------

/** Lo que cuesta pasar de pantalla a la cara de la calle (+y): u a lo largo y z hacia arriba. */
const caraCalle = (sx: number, sy: number) => {
  const u = sx + ANCHO;
  return { u, z: (u + ANCHO) / 2 - sy };
};

/** La baranda del lado de la calle: olas rojas y azules con la cresta crema y volutas de oro. */
function baranda(p: Pintura) {
  const pts: [number, number][] = [];
  for (let u = 0; u <= LARGO - 18; u += 4) {
    const z = 12 + Math.abs(Math.sin(u / 11)) * 7 + (u < 10 ? (10 - u) * 1.2 : 0);
    const s = pantalla(u, ANCHO + 1, z);
    pts.push([s.x, s.y]);
  }
  const b0 = pantalla(LARGO - 18, ANCHO + 1, -11);
  const b1 = pantalla(0, ANCHO + 1, -11);
  pts.push([b0.x, b0.y], [b1.x, b1.y]);
  const forma = pol(...pts);
  p.volumen(forma, ROJO, {
    alto: 6,
    ...op,
    pinta: (q, c) => {
      const { u, z } = caraCalle(q.x - OX, q.y - OY);
      // El ruedo dorado de abajo y la orilla de arriba.
      if (z < -8.5) return tono(ORO, z < -10 ? 2 : 4);
      const cresta = 12 + Math.abs(Math.sin(u / 11)) * 7 + (u < 10 ? (10 - u) * 1.2 : 0);
      if (z > cresta - 2) return tono(ORO, z > cresta - 1 ? 3 : 4);
      // Las olas: la línea que separa el rojo de arriba del azul de abajo.
      const ola = 1 + Math.sin(u / 9 + 1) * 4;
      const d = z - ola;
      if (Math.abs(d) < 1.1) return tono(CREMA, 4);
      if (Math.abs(d - 1.8) < 0.7) return tono(ORO, 4);
      if (d < 0) {
        // El azul con lunares blancos chiquitos.
        if ((Math.floor(u) * 7 + Math.floor(z) * 3) % 23 === 0) return tono(CREMA, 5);
        return mezclaTono(c, AZUL, ROJO);
      }
      return c;
    },
  });
  // Las volutas de oro sobre la ola.
  for (let u = 8; u < LARGO - 22; u += 16) {
    const z = 1 + Math.sin(u / 9 + 1) * 4;
    const s = pantalla(u, ANCHO + 1, z + 4);
    voluta(p, s.x, s.y, 3.6, u % 32 === 8 ? 1 : -1);
    const t = pantalla(u + 8, ANCHO + 1, z - 4);
    voluta(p, t.x, t.y, 2.6, -1, tono(CREMA, 5));
  }
  // La cresta de atrás: un rulo grande de oro y rojo que se levanta.
  const a = pantalla(0, ANCHO + 1, 18);
  p.volumen(cuerno(a.x + 2, a.y + 10, a.x - 8, a.y - 2, a.x + 2, a.y - 14, 5, 2.6), ROJO, { alto: 3, ...op, sombra: 0.3 });
  p.volumen(cuerno(a.x + 4, a.y + 10, a.x - 4, a.y, a.x + 4, a.y - 12, 2.2, 1.2), ORO, { alto: 2, ...op, brillo: 0.9 });
  voluta(p, a.x + 3, a.y - 14, 3.2, 1);
}

/** Pasa el tono de una rampa al mismo tono de otra (para pintar el patrón sobre la luz ya calculada). */
function mezclaTono(c: RGBA, a: Ramp, de: Ramp): RGBA {
  let best = 3;
  let bd = Infinity;
  de.forEach((t, i) => {
    const d = Math.abs(t[0] - c[0]) + Math.abs(t[1] - c[1]) + Math.abs(t[2] - c[2]);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return tono(a, best);
}

/** El perro del frente: el pecho que baja hasta la calle, el cráneo, el hocico, el ojo y la máscara pintada. */
function perro(p: Pintura) {
  const { x, y } = D;
  // El pecho redondo (la trompa del camión), con el collar de cascabeles y el ruedo de oro.
  const pecho = fundir(el(x - 8, y + 20, 26, 20), el(x + 10, y + 28, 20, 12), 8);
  p.volumen(pecho, CREMA, {
    alto: 12,
    ...op,
    pinta: (q, c) => {
      const yy = q.y + 0.5 - OY;
      const xx = q.x + 0.5 - OX;
      const hem = y + 36 - (xx - x) * 0.45;
      if (yy > hem) return tono(ORO, yy > hem + 2 ? 2 : 4);
      const collar = y + 12 - (xx - x) * 0.25;
      if (Math.abs(yy - collar) < 2.2) return tono(ROJO, 3);
      if (Math.abs(yy - collar - 4) < 1.8) return tono(AZUL, 3);
      return c;
    },
  });
  for (let k = 0; k < 5; k++) cascabel(p, x - 24 + k * 9, y + 19 - k * 2.2, 2.4);
  // Las volutas de oro del pecho.
  voluta(p, x - 14, y + 28, 4, 1);
  voluta(p, x + 2, y + 30, 3.4, -1);
  // La oreja caída de atrás.
  p.volumen(cuerno(x - 16, y - 8, x - 30, y, x - 26, y + 16, 7, 4.5), rampa("#c8b89a"), { alto: 4, ...op, sombra: 0.3 });
  // La cabeza: el cráneo fundido con el hocico largo.
  const cabeza = fundir(el(x, y - 5, 23, 19), cap(x + 10, y + 4, x + 32, y + 12, 11, 8.5), 7);
  p.volumen(cabeza, BLANCO, { alto: 13, ...op, sombra: 0.35 });
  // La máscara pintada de la frente: el rojo con el borde azul, la joya y las volutas de oro.
  const masc = pol([x - 19, y - 9], [x - 12, y - 22], [x + 4, y - 25], [x + 16, y - 16], [x + 12, y - 7], [x - 2, y - 3]);
  p.volumen(masc, ROJO, { alto: 3, ...op, base: 0.4 });
  p.volumen(pol([x - 19, y - 9], [x - 14, y - 4], [x - 2, y + 1], [x + 12, y - 7], [x + 7, y - 8], [x - 2, y - 5], [x - 13, y - 8]), AZUL, { alto: 2, ...op });
  voluta(p, x - 8, y - 15, 3.4, 1);
  voluta(p, x + 7, y - 17, 3, -1);
  p.volumen(ci(x - 1, y - 11, 2.4), rampa("#2fb8b0"), { alto: 1, brillo: 1, ...op });
  // El ojo de este lado, contento, con la ceja.
  const [ex, ey] = P(x + 9, y - 1);
  ojo(p, ex, ey, 10, 4, 3, 1, { iris: rampa("#5a3a22"), pestanas: 2, mira: 1.4 });
  curvaP(p, x + 3, y - 8, x + 9, y - 11, x + 15, y - 7, LINEA, 1.4);
  // La nariz negra brillante en la punta del hocico.
  p.volumen(el(x + 38, y + 8, 5.6, 4.6, -0.3), NEGRO, { alto: 3, brillo: 1, ...op });
  p.plano(el(x + 36.4, y + 10, 1.1, 0.8), tono(NEGRO, 0));
  // El labio de arriba que sonríe, y el cachete rosado.
  curvaP(p, x + 10, y + 13, x + 22, y + 20, x + 35, y + 14, LINEA, 1.4);
  mejilla(p, x + 6 + OX, y + 8 + OY, 4.4, 2.6, tono(rampa("#f08aa0"), 3));
}

/** La quijada del perro (aparte, para que abra la boca): la boca roja, la lengua y el labio de abajo. */
function quijadaPerro(p: Pintura) {
  const { x, y } = D;
  p.volumen(pol([x + 10, y + 14], [x + 35, y + 15], [x + 31, y + 23], [x + 14, y + 23]), rampa("#7a1d33"), { alto: 2, ...op });
  p.volumen(el(x + 22, y + 20, 9, 3.6, 0.05), rampa("#ef6a82"), { alto: 2, brillo: 0.8, ...op });
  p.volumen(cap(x + 11, y + 24, x + 31, y + 23, 3.6, 2.6), BLANCO, { alto: 3, ...op, sombra: 0.3 });
}

/** El gorrito de juglar del perro: dos puntas azules con cascabeles. */
function gorroPerro(p: Pintura) {
  const { x, y } = D;
  p.volumen(cuerno(x - 8, y - 19, x - 24, y - 34, x - 33, y - 20, 7.5, 2.4), AZUL, { alto: 4, ...op, sombra: 0.35 });
  p.volumen(cuerno(x + 5, y - 21, x + 7, y - 40, x + 20, y - 38, 7, 2.2), AZUL2, { alto: 4, ...op, sombra: 0.35 });
  p.volumen(cap(x - 13, y - 19, x + 12, y - 22, 3.2), ORO, { alto: 2, brillo: 0.9, ...op });
  cascabel(p, x - 34, y - 17, 3.6);
  cascabel(p, x + 22, y - 38, 3.6);
}

// ---------- El juglar ----------

/** Las piernas (sentado, las rodillas al frente) con las medias de rayas y los zapatos de punta. */
function piernas(p: Pintura) {
  const { x, y } = J;
  const rayas = (q: { x: number; y: number }) => (Math.floor((q.x - OX + (q.y - OY) * 0.9) / 5) % 2 ? AZUL : ROJO);
  for (const [hx, kx, ky, fx, fy] of [
    [x - 10, x - 16, y + 18, x - 18, y + 40],
    [x + 12, x + 24, y + 22, x + 26, y + 44],
  ] as const) {
    p.volumen(cap(hx, y, kx, ky, 10, 9), ROJO, { alto: 7, ...op, patron: rayas, sombra: 0.3 });
    p.volumen(cap(kx, ky, fx, fy, 8.5, 7), ROJO, { alto: 6, ...op, patron: rayas, sombra: 0.3 });
    // El zapato de punta enroscada con su cascabel.
    p.volumen(union(el(fx, fy + 4, 9, 4.5), cuerno(fx + 6, fy + 4, fx + 14, fy + 6, fx + 13, fy - 2, 3.6, 1.6)), AZUL, { alto: 3, ...op, sombra: 0.3 });
    cascabel(p, fx + 13, fy - 3, 2.2);
  }
}

/** El torso de arlequín, la gola y los brazos de arriba; devuelve dónde quedan los codos. */
function torso(p: Pintura) {
  const { x, y } = J;
  const forma = union(pol([x - 22, y + 2], [x + 22, y + 4], [x + 24, y - 26], [x + 12, y - 38], [x - 14, y - 38], [x - 24, y - 26]), el(x, y - 2, 25, 10));
  p.volumen(forma, ROJO, {
    alto: 14,
    ...op,
    // Los rombos del arlequín: rojo y azul, con la costura dorada.
    patron: (q) => {
      const u = (q.x - OX - x) / 9;
      const v = (q.y - OY - y) / 9;
      return (Math.floor(u + v) + Math.floor(u - v)) % 2 ? AZUL : ROJO;
    },
    pinta: (q, c) => {
      const u = (q.x - OX - x) / 9;
      const v = (q.y - OY - y) / 9;
      const f1 = u + v - Math.floor(u + v);
      const f2 = u - v - Math.floor(u - v);
      if (f1 < 0.07 || f2 < 0.07) return tono(ORO, 3);
      return c;
    },
  });
  // El cinturón dorado y los botones grandes.
  p.volumen(cap(x - 23, y - 2, x + 23, y, 2.6), ORO, { alto: 2, brillo: 0.9, ...op });
  for (let k = 0; k < 3; k++) cascabel(p, x + 1, y - 30 + k * 9, 2.6);
  // Los brazos de arriba (del hombro al codo): mangas azules con la costura roja.
  const codos = { izq: { x: x - 32, y: y - 6 }, der: { x: x + 34, y: y - 14 } };
  p.volumen(cap(x - 20, y - 32, codos.izq.x, codos.izq.y, 9, 8), AZUL, { alto: 6, ...op, sombra: 0.35, patron: (q) => (Math.abs(q.x - OX - (x - 26) + (q.y - OY - y) * 0.2) < 1.6 ? ROJO : AZUL) });
  p.volumen(cap(x + 18, y - 32, codos.der.x, codos.der.y, 9, 8), AZUL2, { alto: 6, ...op, sombra: 0.35, patron: (q) => (Math.abs(q.x - OX - (x + 26) - (q.y - OY - y) * 0.3) < 1.6 ? ROJO : AZUL2) });
  // La gola: el cuello de pliegues en abanico, rojo con la orilla dorada, ondulado.
  const gx = K.x;
  const gy = y - 33;
  const gola: Forma = {
    d: (px, py) => {
      const dx = (px - OX - gx) / 30;
      const dy = (py - OY - gy) / 9;
      const a = Math.atan2(dy, dx);
      return (Math.hypot(dx, dy) - 1 - Math.abs(Math.sin(a * 7)) * 0.1) * 9;
    },
    x0: gx - 34 + OX,
    y0: gy - 11 + OY,
    x1: gx + 34 + OX,
    y1: gy + 11 + OY,
  };
  p.volumen(gola, ROJO, {
    alto: 5,
    ...op,
    sombra: 0.35,
    pinta: (q, c) => {
      const dx = (q.x + 0.5 - OX - gx) / 30;
      const dy = (q.y + 0.5 - OY - gy) / 9;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      if (r > 0.86 + Math.abs(Math.sin(a * 7)) * 0.1) return tono(ORO, 4);
      // Los pliegues: rayas que salen del cuello.
      const f = ((a * 7) / Math.PI + 10) % 1;
      if (f < 0.16) return tono(ROJO, 1);
      if (f > 0.84) return tono(ROJO, 5);
      return c;
    },
  });
  p.volumen(el(gx, gy - 2, 9, 3), BLANCO, { alto: 2, ...op });
  return codos;
}

/** El guante blanco de payaso agarrando la caja: el puño, la mano y los dedos doblados encima. */
function guante(p: Pintura, x: number, y: number, lado: 1 | -1) {
  p.volumen(el(x - lado * 7, y + 1, 4, 5.6, lado * 0.3), BLANCO, { alto: 2, ...op, sombra: 0.3 });
  p.volumen(el(x - lado * 2, y, 6, 6.4), BLANCO, { alto: 4, ...op, brillo: 0.5, sombra: 0.3 });
  for (let k = 0; k < 4; k++) p.volumen(cap(x - lado * 1, y - 5 + k * 3.2, x + lado * 4.6, y - 4.4 + k * 3.2, 1.8, 1.6), BLANCO, { alto: 1.5, ...op, sombra: 0.3 });
  // El pulgar por delante.
  p.volumen(cap(x - lado * 4, y + 3, x + lado * 1, y + 5.4, 1.9, 1.6), BLANCO, { alto: 1.5, ...op, base: 0.4 });
}

/** El acordeón: la caja de la derecha (fija) con los botones, y el fuelle de pliegues. */
const ACC = { x0: 12, x1: 22, x2: 46, x3: 56, y0: -6, y1: 20 };
function cajaAcordeon(p: Pintura, x0: number, x1: number, botones: boolean) {
  p.volumen(caja(x0 + OX, ACC.y0 + OY, x1 + OX, ACC.y1 + OY, 1.5), ROJO, { alto: 3, ...op, sombra: 0.35 });
  p.plano(caja(x0 + 1 + OX, ACC.y0 + 1 + OY, x1 - 1 + OX, ACC.y0 + 2 + OY), tono(ORO, 4));
  p.plano(caja(x0 + 1 + OX, ACC.y1 - 2 + OY, x1 - 1 + OX, ACC.y1 - 1 + OY), tono(ORO, 3));
  if (botones) for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) p.volumen(ci(x0 + 3 + c * 3.2, ACC.y0 + 4.6 + r * 3.6, 1.1), BLANCO, { alto: 1, brillo: 1, borde: false });
  else for (let r = 0; r < 3; r++) p.volumen(ci((x0 + x1) / 2, ACC.y0 + 5 + r * 5, 1.4), ORO, { alto: 1, brillo: 1, borde: false });
}
function fuelle(p: Pintura) {
  p.volumen(caja(ACC.x1 - 2 + OX, ACC.y0 + 1 + OY, ACC.x2 + 1 + OX, ACC.y1 - 1 + OY), AZUL, {
    alto: 4,
    ...op,
    pinta: (q, c) => {
      const f = (q.x - OX - ACC.x1) % 3;
      if (f < 0.9) return tono(AZUL, 1);
      if (f > 2.2) return tono(AZUL2, 5);
      if (q.y - OY < ACC.y0 + 2.6 || q.y - OY > ACC.y1 - 3.6) return tono(ORO, 3);
      return c;
    },
  });
}

/** La cara del juglar: el pelo rizado, la cara blanca de payaso, los ojos, la nariz roja y la sonrisa. */
function cara(p: Pintura) {
  const { x, y } = K;
  // Los rizos negros a los lados (mechones enroscados en capas).
  for (const l of [-1, 1]) {
    for (let k = 0; k < 7; k++) {
      const a = (k / 6) * 1.7 - 0.6;
      const rx = x + l * (18 + Math.cos(a) * 4 + (k % 2) * 2);
      const ry = y - 6 + k * 3.4;
      p.volumen(el(rx, ry, 4.6, 3.8, l * 0.6), NEGRO, { alto: 2, ...op, base: 0.6, sombra: 0.25 });
      p.plano(el(rx - 1, ry - 1, 1.4, 0.8, l * 0.6), tono(NEGRO, 4));
    }
  }
  const forma = union(el(x, y, 18, 18.5), el(x, y + 7, 15, 13));
  p.volumen(forma, BLANCO, { alto: 10, ...op, brillo: 0.4 });
  // Las cejas negras muy altas, los ojos y las mejillas.
  for (const l of [-1, 1] as const) {
    curvaP(p, x + l * 2.6, y - 11, x + l * 7, y - 18, x + l * 13, y - 12, LINEA, 1.8);
    const [ex, ey] = P(x + l * 7, y - 4);
    ojo(p, ex, ey, 10.5, 4.6, 3.6, l, { iris: rampa("#4a2a1a"), pestanas: 3, mira: 0.6 });
    mejilla(p, x + l * 11.5 + OX, y + 5 + OY, 3.6, 2.6, tono(rampa("#f06a8a"), 3));
  }
  // La sonrisa grande de labios rojos.
  sonrisa(p, x + OX, y + 9 + OY, 20, 8, rampa("#e0283c"));
  // La nariz roja de payaso, con su brillo.
  p.volumen(ci(x, y + 2, 5.2), NARIZ, { alto: 4, brillo: 1, ...op, sombra: 0.3 });
}
function parpadosJuglar(p: Pintura) {
  for (const l of [-1, 1] as const) {
    const [ex, ey] = P(K.x + l * 7, K.y - 4);
    parpado(p, ex, ey, 10.5, 4.6, 3.6, l, BLANCO);
  }
}

/** El gorro de juglar: la banda dorada con las joyas, la punta azul (cae a la izquierda) y la roja (a la derecha). */
function gorro(p: Pintura) {
  const { x, y } = K;
  p.volumen(cuerno(x - 6, y - 16, x - 24, y - 52, x - 34, y - 22, 13, 3), AZUL, { alto: 8, ...op, sombra: 0.3 });
  p.volumen(cuerno(x + 6, y - 16, x + 16, y - 64, x + 40, y - 34, 13, 3), ROJO, { alto: 8, ...op, sombra: 0.3 });
  // La banda dorada con los picos y las joyas.
  const banda = union(cap(x - 16, y - 14, x + 16, y - 14, 4), ...[-12, -4, 4, 12].map((dx) => pol([x + dx - 4, y - 16], [x + dx, y - 22], [x + dx + 4, y - 16])));
  p.volumen(banda, ORO, { alto: 3, brillo: 0.9, ...op });
  [-8, 0, 8].forEach((dx, k) => p.volumen(pol([x + dx, y - 17], [x + dx - 2.2, y - 14], [x + dx, y - 11], [x + dx + 2.2, y - 14]), k === 1 ? ROJO : AZUL2, { alto: 1, brillo: 1, ...op }));
  cascabel(p, x - 35, y - 19, 4.2);
  cascabel(p, x + 41, y - 31, 4.2);
}

// ---------- La banda ----------

function musicos(f: Figura, id: string, lista: { x: number; y: number; s: number; pose: "trompeta" | "trombon"; lado: 1 | -1; gorro: "kepi" | "plumas"; k: number }[], fase: number): Parte {
  const p = f.lienzo();
  for (const m of lista) {
    const [cx, by] = P(m.x, m.y);
    persona(p, cx, by, m.s, {
      piel: PIELES[m.k % 3]!,
      pelo: NEGRO,
      chaqueta: m.k % 2 ? AZUL : ROJO,
      mangas: m.k % 2 ? ROJO : AZUL,
      pantalon: AZUL,
      ribete: ORO,
      gorro: m.gorro,
      gorroColor: AZUL2,
      plumas: PLUMAS,
      pose: m.pose,
      lado: m.lado,
    });
  }
  const a = lista[0]!;
  return f.parte(id, p, ...P(a.x, a.y), { mov: { gira: { amp: 0.035, periodo: 1300, fase } } });
}

export function juglar(): CarrozaArte {
  const s = escena(LARGO, 20);
  plataforma(
    s,
    LARGO,
    {
      faldon: (u, v) => {
        const k = Math.floor(u / 7);
        if (v < 2.2) return tono(ORO, 3);
        return tono(k % 2 ? AZUL : ROJO, 3 + (Math.abs((u % 7) - 3.5) < 1 ? 1 : 0));
      },
      cubierta: (u) => tono(MADERA, Math.floor(u / 4) % 2 ? 3 : 2),
      flecos: [ROJO, ORO, AZUL],
    },
    false,
  );
  const f = fig();
  const partes: Parte[] = [parteBase(s)];

  // Atrás: las trompetas y el trombón de la banda.
  partes.push(
    musicos(
      f,
      "banda-atras",
      [
        { x: -4, y: 6, s: 0.95, pose: "trompeta", lado: -1, gorro: "plumas", k: 0 },
        { x: -22, y: 16, s: 0.95, pose: "trombon", lado: -1, gorro: "kepi", k: 1 },
      ],
      0,
    ),
  );
  partes.push(
    musicos(
      f,
      "banda-frente",
      [
        { x: 66, y: 34, s: 0.95, pose: "trompeta", lado: 1, gorro: "kepi", k: 3 },
        { x: 84, y: 30, s: 0.95, pose: "trompeta", lado: 1, gorro: "plumas", k: 2 },
      ],
      0.4,
    ),
  );

  // Los dos tambores de la izquierda (atrás de la carroza), cada uno con sus palitos que golpean.
  [
    { x: -38, y: 24, k: 0 },
    { x: -16, y: 30, k: 1 },
  ].forEach((t, i) => {
    const pb = f.lienzo();
    const [cx, by] = P(t.x, t.y);
    persona(pb, cx, by, 0.9, { piel: PIELES[(i + 1) % 3]!, pelo: NEGRO, chaqueta: ROJO, mangas: AZUL, pantalon: AZUL, ribete: ORO, gorro: i ? "kepi" : "plumas", gorroColor: AZUL2, plumas: PLUMAS, pose: "tambor" });
    tambor(pb, cx, by + 1, 9, ROJO, AZUL);
    partes.push(f.parte(`tambor-${i}`, pb, cx, by, { mov: { gira: { amp: 0.02, periodo: 1700, fase: i * 0.3 } } }));
    const pp = f.lienzo();
    palitos(pp, cx, by + 1 - 9 * 1.15, 9, 0.9);
    partes.push(f.parte(`palitos-${i}`, pp, cx, by - 12, { padre: `tambor-${i}`, mov: { vaiven: { dy: -2.5, periodo: 420, fase: i * 0.5 } } }));
  });

  // El juglar: el cuerpo (piernas, torso, gola, brazos de arriba y la mano derecha con su caja).
  const cuerpo = f.lienzo();
  piernas(cuerpo);
  const codos = torso(cuerpo);
  cuerpo.volumen(cap(codos.der.x, codos.der.y, ACC.x3 + 2, ACC.y0 + 8, 8, 6.5), AZUL2, { alto: 5, ...op, sombra: 0.3 });
  cuerpo.volumen(el(ACC.x3 + 4, ACC.y0 + 8, 4, 6, 0.4), ROJO, { alto: 2, ...op });
  cajaAcordeon(cuerpo, ACC.x2, ACC.x3, true);
  guante(cuerpo, ACC.x3 - 1, ACC.y0 + 11, -1);
  partes.push(f.parte("cuerpo", cuerpo, ...P(J.x, J.y + 30), { mov: { gira: { amp: 0.012, periodo: 2600 } } }));
  // El fuelle se abre y se cierra, y la mano izquierda (con su caja) va y viene con él.
  const pf = f.lienzo();
  fuelle(pf);
  const PER = 1500;
  partes.push(f.parte("fuelle", pf, ...P(ACC.x2, (ACC.y0 + ACC.y1) / 2), { padre: "cuerpo", mov: { escala: { sx: 3 / (ACC.x2 - ACC.x1), periodo: PER } } }));
  const pm = f.lienzo();
  pm.volumen(cap(codos.izq.x, codos.izq.y, ACC.x0 - 2, ACC.y1 - 6, 8, 6.5), AZUL, { alto: 5, ...op });
  pm.volumen(el(ACC.x0 - 3, ACC.y1 - 6, 4, 6, -0.4), ROJO, { alto: 2, ...op });
  cajaAcordeon(pm, ACC.x0, ACC.x1, false);
  guante(pm, ACC.x0 + 1, ACC.y1 - 8, 1);
  partes.push(f.parte("mano-izq", pm, ...P(codos.izq.x, codos.izq.y), { padre: "cuerpo", mov: { vaiven: { dx: -3, periodo: PER } } }));

  // La cabeza (con el gorro) se mece al son; los párpados parpadean.
  const cab = f.lienzo();
  gorro(cab);
  cara(cab);
  partes.push(f.parte("cabeza", cab, ...P(K.x, K.y + 16), { padre: "cuerpo", mov: { gira: { amp: 0.07, periodo: PER * 2 } } }));
  const parp = f.lienzo();
  parpadosJuglar(parp);
  partes.push(f.parte("parpados", parp, ...P(K.x, K.y + 16), { padre: "cabeza", contorno: false, mov: { parpadeo: { cada: 3400, dura: 200 } } }));

  // El niño del tocado de plumas, adelante, que baila.
  const pn = f.lienzo();
  const [nx, ny] = P(-4, 34);
  persona(pn, nx, ny, 0.62, { piel: PIELES[2]!, pelo: NEGRO, chaqueta: rampa("#8a3cc8"), pantalon: AZUL, falda: [rampa("#f7c518"), ROJO], ribete: ORO, gorro: "plumas", plumas: PLUMAS, pose: "baila", canta: true });
  partes.push(f.parte("nino", pn, nx, ny, { mov: { vaiven: { dy: -2, periodo: 600 } } }));

  // La baranda barroca del lado de la calle.
  const bar = f.lienzo();
  baranda(bar);
  partes.push(f.parte("baranda", bar, ...P(FC().x, FC().y)));

  // El perro del frente: la cabeza se mece y la quijada abre la boca.
  const pp = f.lienzo();
  perro(pp);
  gorroPerro(pp);
  partes.push(f.parte("perro", pp, ...P(D.x - 6, D.y + 30), { mov: { gira: { amp: 0.025, periodo: 2800 } } }));
  const pq = f.lienzo();
  quijadaPerro(pq);
  partes.push(f.parte("quijada", pq, ...P(D.x + 12, D.y + 18), { padre: "perro", mov: { vaiven: { dy: 1.6, periodo: 900 } } }));

  void [BRILLO];
  return { largo: LARGO, partes, luces: [], marco: { x0: -ANCHO - 40, x1: LARGO + 40 } };
}

const FC = () => pantalla(LARGO, ANCHO, -10);
