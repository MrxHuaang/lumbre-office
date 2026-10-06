// La Familia Castañeda llega (pixel art pintado): la abuela viajera gigante, de canas rizadas y la sonrisa
// grande, con el sombrero morado de plumas rosadas y turquesa, el abrigo morado de ribete dorado, los
// collares de perlas y el bastón; detrás, la sombrilla de rayas moradas y crema que da vueltas. A su lado,
// el loro de colores parado en los baúles de viaje (cafés, morados, turquesa y dorados, con sus herrajes),
// y la familia que saluda: el señor de canotier, la señora del sombrero de flores y el niño de gorra. La
// carrocería son cortinas recogidas moradas, rosadas y turquesa con borlas de oro, con una máscara de
// monstruo sonriente al frente y dos cabezas de pájaro de plumas en las esquinas.
import type { Ramp, RGBA } from "../pixel";
import { BRILLO, cuentas, Figura, LINEA, mejilla, ojo, parpado, pluma } from "./figuras";
import { persona } from "./gentecita";
import type { CarrozaArte, Parte } from "./partes";
import { ANCHO, escena, ORO, pantalla, parteBase, plataforma } from "./plataforma";
import { caja, capsula, circulo, elipse, fundir, Pintura, poligono, rampa, resta, tono, union } from "./pintura";

const LARGO = 104;
const MORADO = rampa("#7a3ca8");
const LILA = rampa("#a86ad0");
const TURQUESA = rampa("#1fa8a0");
const ROSA = rampa("#e0509a");
const CREMA = rampa("#f0e6d0");
const CAFE = rampa("#7a4220");
const CAFE2 = rampa("#9a5a2a");
const CANAS = rampa("#d8d4dc");
const PIEL = rampa("#e8a878");
const VERDE = rampa("#3db842");
const NARANJA = rampa("#f2861c");
const AMARILLO = rampa("#f6c81c");
const ROJO = rampa("#d8283a");
const AZUL = rampa("#2f6fd6");
const BOCA = rampa("#6a1430");
const DIENTE = rampa("#f6f0e0");
const PIELES = [rampa("#e8b088"), rampa("#c98a5a"), rampa("#a8704a")];

const OX = 80;
const OY = 175;
const fig = () => new Figura(230, 280, OX, OY, [0, 0, 0]);
const P = (x: number, y: number): [number, number] => [x + OX, y + OY];
const curvaP = (p: Pintura, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, c: RGBA, g = 1) => p.curva(x0 + OX, y0 + OY, cx + OX, cy + OY, x1 + OX, y1 + OY, c, g);
const pol = (...pts: [number, number][]) => poligono(pts.map(([x, y]) => P(x, y)));
const el = (x: number, y: number, rx: number, ry: number, a = 0) => elipse(x + OX, y + OY, rx, ry, a);
const ci = (x: number, y: number, r: number) => circulo(x + OX, y + OY, r);
const cap = (ax: number, ay: number, bx: number, by: number, ra: number, rb = ra) => capsula(ax + OX, ay + OY, bx + OX, by + OY, ra, rb);
const op = { planos: true, borde: "oscuro" as const };
/** Un punto del mundo de la carroza en px de pantalla. */
const W = (x: number, y: number, z: number): [number, number] => {
  const s = pantalla(x, y, z);
  return [s.x, s.y];
};

/** La cara de la abuela (centro) y la base de la sombrilla. */
const G = { x: 36, y: -38 };
const SOMB = { bx: 14, by: -6, tx: 0, ty: -74 };

// ---------- Los baúles ----------

/** Un baúl en 3D (alineado con la carroza): tapa, costado y frente, con esquineros y correas de oro. */
function baul(p: Pintura, x: number, y: number, z: number, w: number, d: number, h: number, r: Ramp) {
  const X1 = x + w;
  const Y1 = y + d;
  const Z1 = z + h;
  const cara = { alto: 1.2, planos: true, borde: false as const, brillo: 0, contraste: 1.2 };
  // La tapa (con la luz), el ribete de oro alrededor.
  p.volumen(pol(W(x, y, Z1), W(X1, y, Z1), W(X1, Y1, Z1), W(x, Y1, Z1)), r, {
    ...cara,
    base: 0.3,
    pinta: (q, c) => {
      const sx = q.x + 0.5 - OX;
      const sy = q.y + 0.5 - OY;
      const wx = (sx + 2 * (sy + Z1)) / 2;
      const wy = (2 * (sy + Z1) - sx) / 2;
      if (wx - x < 0.8 || X1 - wx < 0.8 || wy - y < 0.8 || Y1 - wy < 0.8) return tono(ORO, 4);
      return c;
    },
  });
  // El costado de la calle: los esquineros, la tapa marcada, una correa y la chapa.
  p.volumen(pol(W(x, Y1, z), W(X1, Y1, z), W(X1, Y1, Z1), W(x, Y1, Z1)), r, {
    ...cara,
    base: -0.6,
    pinta: (q, c) => {
      const sx = q.x + 0.5 - OX;
      const sy = q.y + 0.5 - OY;
      const wx = sx + Y1;
      const u = wx - x;
      const v = (wx + Y1) / 2 - sy - z;
      if ((u < 1.6 || u > w - 1.6) && (v < 2.4 || v > h - 2.4)) return tono(ORO, 4);
      if (Math.abs(v - h * 0.7) < 0.55) return tono(r, 0);
      if (v > h - 0.8) return tono(ORO, 3);
      if (Math.abs(u - w / 2) < 1.4 && v > h * 0.48 && v < h * 0.72) return tono(ORO, 5);
      return c;
    },
  });
  // El frente, a la sombra.
  p.volumen(pol(W(X1, y, z), W(X1, Y1, z), W(X1, Y1, Z1), W(X1, y, Z1)), r, {
    ...cara,
    base: -1.6,
    pinta: (q, c) => {
      const sx = q.x + 0.5 - OX;
      const sy = q.y + 0.5 - OY;
      const wy = X1 - sx;
      const v = (X1 + wy) / 2 - sy - z;
      if (v > h - 0.8 || ((wy - y < 1.4 || Y1 - wy < 1.4) && (v < 2.4 || v > h - 2.4))) return tono(ORO, 2);
      if (Math.abs(v - h * 0.7) < 0.55) return tono(r, 0);
      return c;
    },
  });
  // La línea oscura de la esquina de adelante.
  const a0 = W(X1, Y1, z);
  const a1 = W(X1, Y1, Z1);
  p.trazo(a0[0] + OX, a0[1] + OY, a1[0] + OX, a1[1] + OY, tono(r, 0), 1);
}

// ---------- La carrocería: las cortinas, la máscara y los pájaros ----------

/** Las cortinas recogidas de la carrocería (cara de la calle y frente): morado, rosado y turquesa con perlas. */
function cortinas(p: Pintura) {
  const alto = (u: number) => 12 + Math.abs(Math.sin(u / 5.1)) * 2;
  const pts: [number, number][] = [];
  for (let u = 0; u <= LARGO; u += 2) pts.push(W(u, ANCHO + 1, alto(u)));
  for (let v = ANCHO; v >= 0; v -= 2) pts.push(W(LARGO + 1, v, alto(LARGO + ANCHO - v)));
  pts.push(W(LARGO + 1, 0, -11), W(LARGO + 1, ANCHO + 1, -11), W(0, ANCHO + 1, -11));
  const forma = pol(...pts);
  p.volumen(forma, MORADO, {
    alto: 6,
    ...op,
    pinta: (q, c) => {
      const sx = q.x + 0.5 - OX;
      const sy = q.y + 0.5 - OY;
      // Por qué cara: la de la calle o el frente.
      let u: number;
      let z: number;
      const fc = pantalla(LARGO, ANCHO, 0);
      if (sx <= fc.x) {
        const wx = sx + ANCHO + 1;
        u = wx;
        z = (wx + ANCHO + 1) / 2 - sy;
      } else {
        const wy = LARGO + 1 - sx;
        u = LARGO + ANCHO - wy;
        z = (LARGO + 1 + wy) / 2 - sy;
      }
      if (z < -9) return tono(ORO, z < -10 ? 2 : 4);
      if (z > alto(u) - 1.6) return tono(ORO, 4);
      // Los recogidos: tres caídas (morado, rosado, turquesa) en arco entre borla y borla.
      const f = (u / 16) % 1;
      const caida = Math.sin(f * Math.PI) * 7;
      const t = alto(u) - 2 - z - caida * 0.6;
      const capas: [Ramp, number][] = [
        [LILA, 3.4],
        [ROSA, 3.2],
        [TURQUESA, 3.2],
      ];
      let acc = 0;
      for (const [r, g] of capas) {
        if (t >= acc && t < acc + g) {
          if (t > acc + g - 0.9) return tono(ORO, 4);
          const pliegue = Math.floor((u * 1.3 + t) % 3) === 0 ? -1 : 0;
          return tono(r, 3 + pliegue + (c[0] + c[1] > tono(MORADO, 3)[0] + tono(MORADO, 3)[1] ? 1 : 0));
        }
        acc += g;
      }
      // Debajo, el faldón morado de pliegues hasta la calle.
      return Math.floor(u * 0.9) % 3 === 0 ? tono(MORADO, 2) : c;
    },
  });
  // Las borlas de oro entre caída y caída, y rosetas de flores.
  for (let u = 0; u <= LARGO; u += 16) {
    const [bx, by] = W(u, ANCHO + 1, alto(u) - 2);
    p.volumen(ci(bx, by, 2.6), ROSA, { alto: 2, ...op, brillo: 0.6 });
    p.volumen(ci(bx, by, 1.1), AMARILLO, { alto: 1, ...op, brillo: 1 });
    p.volumen(cap(bx, by + 2, bx, by + 7, 0.9), ORO, { alto: 1, ...op });
    p.volumen(pol([bx - 1.4, by + 7], [bx + 1.4, by + 7], [bx + 2.6, by + 13], [bx - 2.6, by + 13]), ORO, { alto: 1.5, ...op, brillo: 0.8, pinta: (q, c) => (q.x % 2 ? tono(ORO, 2) : c) });
  }
}

/** La máscara del frente: el monstruo de papel maché que sonríe con todos los dientes. */
const M = { x: 46, y: 50 };
function mascara(p: Pintura) {
  const { x, y } = M;
  // El marco de remolinos morados y lilas alrededor (como melena) y las volutas de oro a los lados.
  for (let k = 0; k < 12; k++) {
    const a = Math.PI * (0.92 + (k / 11) * 1.16);
    const rx = x + Math.cos(a) * 28;
    const ry = y - 2 + Math.sin(a) * 20;
    p.volumen(el(rx, ry, 8, 6, a), k % 2 ? LILA : MORADO, { alto: 3, ...op, sombra: 0.3 });
    p.plano(el(rx + Math.cos(a) * 1.4, ry + Math.sin(a) * 1.4, 3.2, 2, a), tono(TURQUESA, 3));
  }
  for (const l of [-1, 1]) {
    p.volumen(el(x + l * 28, y + 8, 7, 11), ORO, { alto: 4, ...op, brillo: 0.9 });
    curvaP(p, x + l * 26, y + 16, x + l * 33, y + 6, x + l * 26, y + 2, tono(ORO, 1), 1.6);
  }
  // La cara turquesa.
  const cara = fundir(el(x, y - 2, 25, 17), el(x, y + 10, 22, 12), 6);
  p.volumen(cara, TURQUESA, { alto: 12, ...op, sombra: 0.35 });
  // Las cejas pesadas moradas que se enroscan.
  for (const l of [-1, 1]) p.volumen(union(el(x + l * 10, y - 13, 10, 4.4, l * 0.25), el(x + l * 19, y - 15, 4, 4)), MORADO, { alto: 3, ...op, sombra: 0.35 });
  // Los ojos grandes cafés.
  for (const l of [-1, 1] as const) {
    const [ex, ey] = P(x + l * 10, y - 5);
    ojo(p, ex, ey, 12, 5.4, 4.4, l, { iris: rampa("#8a5a22"), pestanas: 0, mira: 1 });
  }
  // La nariz dorada, ancha.
  p.volumen(union(el(x, y + 2, 7, 5), el(x, y - 4, 3.4, 5)), ORO, { alto: 4, brillo: 0.9, ...op, sombra: 0.4 });
  for (const l of [-1, 1]) p.plano(el(x + l * 2.8, y + 4.4, 1.4, 1), tono(CAFE, 1));
  // La boca abierta: la encía, la lengua y los dientes de arriba.
  p.volumen(el(x, y + 13, 19, 8.5), BOCA, { alto: 3, base: -0.6, ...op });
  p.volumen(el(x + 1, y + 16, 10, 4), rampa("#e0607a"), { alto: 2, brillo: 0.7, borde: false });
  dientes(p, x - 17, x + 17, y + 7.5, 9, 5.5, false);
  p.volumen(resta(el(x, y + 9, 22, 6), el(x, y + 13, 19, 6)), ORO, { alto: 2, ...op, brillo: 0.9 });
  // Flores en la frente.
  for (const [dx, r] of [
    [-10, ROSA],
    [0, LILA],
    [10, ROSA],
  ] as const) {
    flor(p, x + dx, y - 22 + Math.abs(dx) * 0.2, 3.6, r);
  }
}

/** Los dientes puntiagudos (fila de arriba o de abajo). */
function dientes(p: Pintura, x0: number, x1: number, y: number, n: number, alto: number, abajo: boolean) {
  const w = (x1 - x0) / n;
  for (let k = 0; k < n; k++) {
    const cx = x0 + w * (k + 0.5);
    const t = (k + 0.5) / n;
    const yy = y + Math.sin(t * Math.PI) * 3 * (abajo ? -1 : 1);
    const h = alto * (0.75 + Math.sin(t * Math.PI) * 0.25);
    const tri = abajo ? pol([cx - w / 2 + 0.4, yy], [cx + w / 2 - 0.4, yy], [cx, yy - h]) : pol([cx - w / 2 + 0.4, yy], [cx + w / 2 - 0.4, yy], [cx, yy + h]);
    p.volumen(tri, DIENTE, { alto: 1.5, ...op, brillo: 0.9 });
  }
}

/** La quijada de la máscara (aparte): los dientes de abajo y el labio dorado. */
function quijadaMascara(p: Pintura) {
  const { x, y } = M;
  p.volumen(resta(el(x, y + 21, 19, 4.6), el(x, y + 16, 17, 5)), ORO, { alto: 2, ...op, brillo: 0.9 });
  dientes(p, x - 14, x + 14, y + 20, 7, 5, true);
}

/** Una flor de cinco pétalos. */
function flor(p: Pintura, x: number, y: number, r: number, petalo: Ramp) {
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    p.volumen(el(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, r * 0.62, r * 0.45, a), petalo, { alto: 1.5, brillo: 0.3, ...op });
  }
  p.volumen(ci(x, y, r * 0.42), AMARILLO, { alto: 1.2, brillo: 0.8, ...op });
}

/** La cabeza de pájaro de la esquina: el penacho de plumas, la cabeza lila y turquesa y el pico abierto. */
function pajaro(p: Pintura, x: number, y: number, lado: 1 | -1) {
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 - lado * (0.9 - k * 0.3);
    pluma(p, x - lado * 4 + OX, y - 8 + OY, a, 16 - Math.abs(k - 2.5) * 1.6, 6, [ROSA, NARANJA, TURQUESA, LILA, AMARILLO, ROSA][k]!, { brillo: 0.3 });
  }
  p.volumen(fundir(el(x, y, 11, 10), el(x - lado * 4, y + 12, 8, 9), 5), LILA, {
    alto: 7,
    ...op,
    sombra: 0.35,
    patron: (q) => ((Math.floor((q.y - OY - y) / 3.2) + 20) % 3 === 0 ? TURQUESA : null),
  });
  // El pico curvo abierto (arriba y abajo) con la lengua.
  p.volumen(pol([x + lado * 6, y - 2], [x + lado * 20, y + 2], [x + lado * 16, y + 4], [x + lado * 6, y + 3]), AMARILLO, { alto: 2, ...op, brillo: 0.8 });
  p.volumen(pol([x + lado * 6, y + 5], [x + lado * 15, y + 7], [x + lado * 6, y + 9]), rampa("#e0a428"), { alto: 1.5, ...op });
  p.plano(pol([x + lado * 7, y + 3.6], [x + lado * 14, y + 5], [x + lado * 7, y + 5.6]), tono(BOCA, 2));
  const [ex, ey] = P(x + lado * 2, y - 2);
  ojo(p, ex, ey, 6.4, 3, 2.4, lado, { iris: rampa("#f2a21c"), pestanas: 0, mira: lado * 0.8 });
  curvaP(p, x - lado * 2, y - 6, x + lado * 2, y - 8, x + lado * 6, y - 5, tono(MORADO, 1), 1.4);
  p.volumen(ci(x - lado * 2, y + 14, 2.6), ROSA, { alto: 1, ...op, brillo: 0.6 });
}

// ---------- La abuela ----------

/** El cuerpo de la abuela: el abrigo morado de ribete dorado, la blusa turquesa y los collares de perlas. */
function cuerpoAbuela(p: Pintura) {
  const { x, y } = G;
  const forma = union(pol([x - 26, y + 58], [x + 26, y + 58], [x + 24, y + 26], [x + 12, y + 18], [x - 12, y + 18], [x - 24, y + 26]), el(x, y + 26, 25, 10));
  p.volumen(forma, MORADO, {
    alto: 12,
    ...op,
    pinta: (q, c) => {
      const dx = q.x + 0.5 - OX - x;
      const dy = q.y + 0.5 - OY - y;
      // La blusa turquesa en V y las solapas con ribete dorado.
      const v = Math.abs(dx) - (dy - 18) * 0.42;
      if (v < 0) return tono(TURQUESA, 3 + (dx < 0 ? 0.5 : -0.5));
      if (v < 2) return tono(ORO, 4);
      // El brocado del abrigo: puntitos dorados.
      if ((Math.floor(q.x) * 3 + Math.floor(q.y) * 5) % 17 === 0) return tono(LILA, 5);
      return c;
    },
  });
  // Los collares de perlas.
  cuentas(p, x - 9 + OX, y + 19 + OY, x + OX, y + 29 + OY, x + 9 + OX, y + 19 + OY, 1.4, [CREMA]);
  cuentas(p, x - 11 + OX, y + 20 + OY, x + OX, y + 36 + OY, x + 11 + OX, y + 20 + OY, 1.5, [CREMA, CREMA, rampa("#f2b8d0")]);
  // El brazo izquierdo, que se apoya en los baúles junto al loro.
  p.volumen(cap(x - 22, y + 26, x - 32, y + 44, 7, 6.4), MORADO, { alto: 5, ...op, sombra: 0.3, pinta: (q, c) => (Math.abs((q.x - OX - (x - 30)) * 0.8 + (q.y - OY - (y + 40))) < 1.6 ? tono(ORO, 4) : c) });
  p.volumen(el(x - 31, y + 48, 5, 3.6), PIEL, { alto: 2, ...op });
}

/** La cabeza de la abuela: las canas rizadas, la cara, los ojos, la sonrisa, los aretes y el sombrero de plumas. */
function cabezaAbuela(p: Pintura) {
  const { x, y } = G;
  // Las canas: rizos en capas alrededor de la cara.
  for (let k = 0; k < 15; k++) {
    const a = Math.PI * (0.78 + (k / 14) * 1.44);
    const rx = x + Math.cos(a) * 18;
    const ry = y + 1 + Math.sin(a) * 16;
    p.volumen(el(rx, ry, 5.6, 4.6, a), CANAS, { alto: 2, ...op, sombra: 0.25 });
    curvaP(p, rx - 2, ry, rx, ry - 2, rx + 2, ry, tono(CANAS, 1), 1);
  }
  p.volumen(capsula(x + OX, y + 14 + OY, x + OX, y + 20 + OY, 6), PIEL, { alto: 2, ...op });
  p.volumen(fundir(el(x, y + 1, 16, 15.5), el(x, y + 9, 13, 9), 5), PIEL, { alto: 10, ...op, brillo: 0.4 });
  // Los ojos risueños, las cejas canosas, las mejillas y la nariz.
  for (const l of [-1, 1] as const) {
    const [ex, ey] = P(x + l * 6.4, y - 1);
    ojo(p, ex, ey, 9, 4, 2.8, l, { iris: rampa("#6a3a1a"), pestanas: 2, mira: 0.4 });
    curvaP(p, x + l * 2.4, y - 7, x + l * 6.4, y - 10, x + l * 11, y - 6.6, tono(CANAS, 1), 1.6);
    mejilla(p, x + l * 10 + OX, y + 6 + OY, 3.6, 2.4, tono(rampa("#ef6b80"), 3));
    // Los aretes de oro con turquesa.
    p.volumen(ci(x + l * 16, y + 9, 2), ORO, { alto: 1, ...op, brillo: 1 });
    p.volumen(el(x + l * 16, y + 13, 1.8, 2.4), TURQUESA, { alto: 1, ...op, brillo: 1 });
  }
  p.volumen(union(el(x + 0.5, y + 4, 3, 3.4), el(x + 0.5, y + 1, 2, 3)), PIEL, { alto: 3, ...op, base: 0.3, sombra: 0.3 });
  // La sonrisa abierta.
  p.volumen(el(x + 0.5, y + 10, 7, 3.8), BOCA, { alto: 2, ...op });
  p.plano(el(x + 0.5, y + 8.2, 5.6, 1.4), tono(DIENTE, 4));
  p.plano(el(x + 1, y + 12, 3.4, 1.4), tono(rampa("#e0607a"), 3));
  // El sombrero: el ala ancha inclinada, la copa, la cinta lila, la flor y el penacho de plumas.
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + 0.2 + k * 0.22;
    pluma(p, x + 10 + OX, y - 26 + OY, a, 26 - k * 1.8, 8.5, [ROSA, TURQUESA, ROSA, LILA, TURQUESA, ROSA][k]!, { brillo: 0.35 });
  }
  p.volumen(el(x + 2, y - 14, 31, 8, -0.1), MORADO, { alto: 4, ...op, sombra: 0.35, pinta: (q, c) => (Math.abs((q.x - OX - x) * 0.04 + (q.y - OY - (y - 9))) < 1.4 ? tono(ORO, 3) : c) });
  p.volumen(union(el(x + 2, y - 24, 17, 10), caja(x - 15 + OX, y - 24 + OY, x + 19 + OX, y - 15 + OY, 3)), MORADO, { alto: 7, ...op, sombra: 0.3, pinta: (q, c) => (q.y - OY > y - 21 && q.y - OY < y - 17 ? tono(LILA, 4) : c) });
  flor(p, x + 14, y - 20, 4.6, ROSA);
  flor(p, x + 7, y - 19, 3.2, TURQUESA);
  p.volumen(ci(x + 19, y - 16, 2), CREMA, { alto: 1, ...op, brillo: 1 });
}
function parpadosAbuela(p: Pintura) {
  for (const l of [-1, 1] as const) {
    const [ex, ey] = P(G.x + l * 6.4, G.y - 1);
    parpado(p, ex, ey, 9, 4, 2.8, l, PIEL);
  }
}

/** El brazo derecho con el bastón de madera de puño curvo. */
function brazoBaston(p: Pintura) {
  const { x, y } = G;
  const mano = { x: x + 32, y: y + 28 };
  p.volumen(cap(mano.x + 1, mano.y - 12, mano.x + 4, mano.y + 46, 1.8), CAFE2, { alto: 1.5, ...op, brillo: 0.8 });
  p.volumen(union(cap(mano.x + 1, mano.y - 12, mano.x - 1, mano.y - 18, 1.9), cap(mano.x - 1, mano.y - 18, mano.x - 6, mano.y - 19, 1.9), cap(mano.x - 6, mano.y - 19, mano.x - 9, mano.y - 15, 1.8)), CAFE2, { alto: 1.5, ...op, brillo: 0.8 });
  p.volumen(cap(x + 22, y + 26, mano.x - 2, mano.y + 4, 7, 6), MORADO, { alto: 5, ...op, sombra: 0.3 });
  p.volumen(el(mano.x - 1, mano.y + 4, 5, 3), ORO, { alto: 1.5, ...op, brillo: 0.9 });
  p.volumen(el(mano.x + 1.4, mano.y - 1, 4.6, 5.4), PIEL, { alto: 3, ...op, brillo: 0.5 });
  for (let k = 0; k < 3; k++) p.plano(cap(mano.x - 1 + OX, mano.y - 4 + k * 2.4 + OY, mano.x + 4 + OX, mano.y - 4 + k * 2.4 + OY, 0.5), tono(PIEL, 1));
  return mano;
}

// ---------- La sombrilla ----------

/** La tela de la sombrilla: la cúpula de rayas (corridas `fase`, para que dé vueltas). */
function tela(p: Pintura, fase: number) {
  const { tx, ty } = SOMB;
  const cx = tx;
  const cy = ty + 18;
  const rx = 34;
  const ry = 20;
  const cupula = union(resta(el(cx, cy, rx, ry), caja(cx - rx - 1 + OX, cy + OY, cx + rx + 1 + OX, cy + ry + 1 + OY)), el(cx, cy, rx, 5));
  p.volumen(cupula, CREMA, {
    alto: 10,
    ...op,
    patron: (q) => {
      const dx = q.x + 0.5 - OX - cx;
      const dy = Math.min(0, q.y + 0.5 - OY - cy);
      const media = rx * Math.sqrt(Math.max(0.02, 1 - (dy / ry) ** 2));
      const phi = Math.asin(Math.max(-1, Math.min(1, dx / media)));
      const k = Math.floor((phi + fase) / (Math.PI / 8) + 64);
      return k % 2 ? MORADO : CREMA;
    },
  });
}
function sombrilla(p: Pintura) {
  const { bx, by, tx, ty } = SOMB;
  p.volumen(cap(bx, by, tx, ty, 1.4), CAFE, { alto: 1, ...op, brillo: 0.8 });
  tela(p, 0);
  // El ruedo turquesa de ondas con las borlitas doradas, y la punta.
  const cy = ty + 18;
  for (let k = 0; k < 11; k++) {
    const t = k / 10;
    const x = tx - 32 + t * 64;
    const y = cy + 2 + Math.sin(t * Math.PI) * 4;
    p.volumen(el(x, y, 3.6, 2.4), TURQUESA, { alto: 1.5, ...op });
    p.volumen(ci(x, y + 4, 1.4), ORO, { alto: 1, ...op, brillo: 1 });
  }
  p.volumen(union(ci(tx, ty - 1, 2.4), cap(tx, ty - 1, tx, ty - 7, 1)), ORO, { alto: 1.5, ...op, brillo: 1 });
}

// ---------- El loro ----------

const L = { x: 2, y: -10 };
function loro(p: Pintura) {
  const { x, y } = L;
  // La cola larga que cuelga sobre los baúles: plumas rojas, azules y amarillas.
  [ROJO, AZUL, AMARILLO, ROJO].forEach((r, k) => pluma(p, x - 2 + k + OX, y + 8 + OY, Math.PI / 2 + 0.35 - k * 0.12, 28 - k * 3, 6.4, r, { brillo: 0.3 }));
  // Las patas agarradas al baúl.
  for (const d of [-1, 1]) p.volumen(cap(x + d * 2.4, y + 9, x + d * 3, y + 14, 1.2), rampa("#5a5a6a"), { alto: 1, ...op });
  // El cuerpo verde y el pecho amarillo.
  p.volumen(el(x, y, 9, 12.5, 0.15), VERDE, { alto: 7, ...op, sombra: 0.3 });
  p.volumen(el(x + 3.4, y + 2, 4.6, 8, 0.15), AMARILLO, { alto: 3, ...op, base: 0.3 });
}
function cabezaLoro(p: Pintura) {
  const { x, y } = L;
  p.volumen(el(x + 3, y - 15, 8, 7.4), VERDE, { alto: 5, ...op, sombra: 0.3, base: 0.3 });
  // El pico curvo, crema arriba y gris abajo.
  p.volumen(union(el(x + 11, y - 15, 4.6, 4), pol([x + 11, y - 19], [x + 17, y - 15], [x + 14, y - 10])), CREMA, { alto: 2, ...op, brillo: 0.9 });
  p.volumen(el(x + 11, y - 10.6, 3, 2), rampa("#7a7a8a"), { alto: 1, ...op });
  p.volumen(el(x + 5, y - 17, 3.6, 3.4), CREMA, { alto: 1, borde: false, base: 1 });
  p.plano(ci(x + 5.6, y - 17, 1.6), LINEA);
  p.punto(Math.round(x + 5 + OX), Math.round(y - 18 + OY), BRILLO);
  p.volumen(el(x + 1, y - 21, 4, 2.6, -0.3), AMARILLO, { alto: 1, ...op });
}
function alaLoro(p: Pintura) {
  const { x, y } = L;
  const ala = el(x - 3, y + 1, 6.4, 12, -0.25);
  p.volumen(ala, ROJO, {
    alto: 4,
    ...op,
    sombra: 0.35,
    patron: (q) => {
      const t = (q.y + 0.5 - OY - (y - 10)) / 24;
      return t < 0.3 ? VERDE : t < 0.55 ? ROJO : t < 0.75 ? NARANJA : t < 0.88 ? AMARILLO : AZUL;
    },
  });
}

// ---------- La familia ----------

function familiar(f: Figura, id: string, x: number, y: number, s: number, o: Parameters<typeof persona>[4], fase: number): Parte {
  const p = f.lienzo();
  const [cx, by] = P(x, y);
  persona(p, cx, by, s, o);
  return f.parte(id, p, cx, by, { mov: { gira: { amp: 0.06, periodo: 1500, fase }, vaiven: { dy: -1, periodo: 750, fase } } });
}

export function castaneda(): CarrozaArte {
  const s = escena(LARGO, 20);
  plataforma(s, LARGO, { faldon: (u) => tono(Math.floor(u / 6) % 2 ? MORADO : ROSA, 3), cubierta: (u, v) => tono((Math.floor(u / 6) + Math.floor(v / 6)) % 2 ? CAFE : CAFE2, 3), flecos: [ORO, ROSA, TURQUESA, LILA] }, false);
  const f = fig();
  const partes: Parte[] = [parteBase(s)];

  // La familia de atrás (el niño y la señora a la izquierda, el señor a la derecha).
  partes.push(familiar(f, "nino", -36, 4, 0.92, { piel: PIELES[1]!, pelo: rampa("#2b1b12"), chaqueta: CAFE2, pantalon: CAFE, camisa: CREMA, monono: ROJO, gorro: "gorra", gorroColor: rampa("#2a3a5a"), pose: "saluda", lado: -1, canta: true }, 0));
  partes.push(familiar(f, "senora", -14, -2, 0.95, { piel: PIELES[0]!, pelo: rampa("#4a2a1a"), chaqueta: TURQUESA, pantalon: TURQUESA, vestido: true, ribete: ORO, gorro: "flores", gorroColor: TURQUESA, pose: "saluda", lado: -1, canta: true }, 0.3));
  partes.push(familiar(f, "senor", 80, 16, 0.98, { piel: PIELES[2]!, pelo: rampa("#2b1b12"), chaqueta: CREMA, pantalon: CREMA, camisa: rampa("#ffffff"), monono: ROJO, gorro: "canotier", gorroColor: rampa("#e8c87a"), pose: "saluda", lado: 1, canta: true }, 0.6));

  // La sombrilla da vueltas: la base y dos cuadros de las rayas corridas que se turnan.
  const ps = f.lienzo();
  sombrilla(ps);
  partes.push(f.parte("sombrilla", ps, ...P(SOMB.bx, SOMB.by), { mov: { gira: { amp: 0.05, periodo: 3200 } } }));
  [1, 2].forEach((k) => {
    const pt = f.lienzo();
    tela(pt, (k * Math.PI) / 12);
    partes.push(f.parte(`sombrilla-giro-${k}`, pt, ...P(SOMB.bx, SOMB.by), { padre: "sombrilla", mov: { parpadeo: { cada: 960, dura: 320, fase: k === 1 ? 1 / 3 : 0 } } }));
  });

  // La abuela: el cuerpo, la cabeza que se mece, los párpados y el brazo del bastón.
  const pc = f.lienzo();
  cuerpoAbuela(pc);
  partes.push(f.parte("abuela", pc, ...P(G.x, G.y + 50), { mov: { gira: { amp: 0.015, periodo: 3000 } } }));
  const ph = f.lienzo();
  cabezaAbuela(ph);
  partes.push(f.parte("cabeza", ph, ...P(G.x, G.y + 18), { padre: "abuela", mov: { gira: { amp: 0.06, periodo: 2600 } } }));
  const pp = f.lienzo();
  parpadosAbuela(pp);
  partes.push(f.parte("parpados", pp, ...P(G.x, G.y + 18), { padre: "cabeza", contorno: false, mov: { parpadeo: { cada: 3800, dura: 200 } } }));
  const pb = f.lienzo();
  brazoBaston(pb);
  partes.push(f.parte("baston", pb, ...P(G.x + 22, G.y + 26), { padre: "abuela", mov: { vaiven: { dy: -2, periodo: 1300 } } }));

  // Los baúles (de atrás hacia adelante) con el loro encima.
  const pbaul = f.lienzo();
  // De atrás hacia adelante y, en cada fila, de la cola a la trompa (cada uno con lo que lleva encima).
  const DORADO = rampa("#b8862e");
  for (const [x, y, z, w, d, h, r] of [
    [2, 6, 0, 18, 12, 20, CAFE],
    [40, 6, 0, 18, 12, 22, CAFE2],
    [58, 6, 0, 16, 12, 20, MORADO],
    [2, 24, 0, 16, 14, 16, MORADO],
    [4, 26, 16, 12, 10, 10, CAFE2],
    [18, 24, 0, 22, 14, 15, TURQUESA],
    [20, 24, 15, 18, 12, 12, DORADO],
    [40, 22, 0, 28, 16, 17, CAFE],
    [44, 24, 17, 16, 12, 12, TURQUESA],
    [46, 25, 29, 12, 10, 8, DORADO],
    [68, 22, 0, 16, 16, 14, CAFE2],
    [70, 24, 14, 12, 12, 10, LILA],
    [84, 20, 0, 14, 16, 12, MORADO],
  ] as const)
    baul(pbaul, x, y, z, w, d, h, r);
  partes.push(f.parte("baules", pbaul, ...P(...W(50, 30, 0))));

  const pl = f.lienzo();
  loro(pl);
  partes.push(f.parte("loro", pl, ...P(L.x, L.y + 14), { mov: { gira: { amp: 0.03, periodo: 2100 } } }));
  const pa = f.lienzo();
  alaLoro(pa);
  partes.push(f.parte("ala", pa, ...P(L.x - 2, L.y - 8), { padre: "loro", mov: { gira: { amp: 0.16, periodo: 700 } } }));
  const plc = f.lienzo();
  cabezaLoro(plc);
  partes.push(f.parte("cabeza-loro", plc, ...P(L.x + 2, L.y - 9), { padre: "loro", mov: { gira: { amp: 0.12, periodo: 1700, fase: 0.2 } } }));

  // La carrocería: las cortinas con la máscara del frente; la quijada y los párpados de la máscara aparte.
  const pcar = f.lienzo();
  cortinas(pcar);
  mascara(pcar);
  partes.push(f.parte("carroceria", pcar, ...P(...W(LARGO / 2, ANCHO, 0))));
  const pmp = f.lienzo();
  for (const l of [-1, 1] as const) {
    const [ex, ey] = P(M.x + l * 10, M.y - 5);
    parpado(pmp, ex, ey, 12, 5.4, 4.4, l, MORADO);
  }
  partes.push(f.parte("parpados-mascara", pmp, ...P(M.x, M.y), { contorno: false, mov: { parpadeo: { cada: 4300, dura: 260, fase: 0.5 } } }));
  const pq = f.lienzo();
  quijadaMascara(pq);
  partes.push(f.parte("quijada", pq, ...P(M.x, M.y + 16), { mov: { vaiven: { dy: 1.6, periodo: 1000 } } }));

  // Los pájaros de las esquinas: atrás (mira a la izquierda) y adelante (a la derecha).
  const pj1 = f.lienzo();
  pajaro(pj1, ...W(-2, ANCHO + 2, 14), -1);
  partes.push(f.parte("pajaro-atras", pj1, ...P(...W(0, ANCHO, 6)), { mov: { gira: { amp: 0.05, periodo: 2300 } } }));
  const pj2 = f.lienzo();
  pajaro(pj2, ...W(LARGO + 2, 6, 14), 1);
  partes.push(f.parte("pajaro-frente", pj2, ...P(...W(LARGO, 6, 6)), { mov: { gira: { amp: 0.05, periodo: 2300, fase: 0.5 } } }));

  return { largo: LARGO, partes, luces: [], marco: { x0: -ANCHO - 40, x1: LARGO + 40 } };
}
