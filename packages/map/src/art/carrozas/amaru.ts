// El Amaru (pixel art pintado): la serpiente sagrada de los Andes, enroscada en dos vueltas que tapan el
// camión, con las escamas de todos los colores del arcoíris en bandas y un hilo de cuentas de oro por el
// lomo. Al frente levanta la cabeza de dragón dorada: los ojos grandes y turquesa, las cejas y los cuernos
// de oro, la oreja rosada, la trompa con la nariz rosada y la boca abierta con colmillos, y detrás el
// penacho de plumas del arcoíris. Por las vueltas bailan cuatro muchachos con tocado de plumas, y en el
// borde de la cubierta van matas de hojas con flores.
// Todo se dibuja de frente a la pantalla en 3/4 (el lado izquierdo con luz, el derecho en sombra), en
// coordenadas de pantalla desde el origen de la carroza.
import type { Ramp, RGBA } from "../pixel";
import { abanico, ARCOIRIS, BRILLO, Figura, LINEA, ojo, parpado, pluma } from "./figuras";
import { figurita } from "./munecos";
import type { CarrozaArte, Parte } from "./partes";
import { ANCHO, escena, ORO, pantalla, parteBase, plataforma } from "./plataforma";
import { capsula, circulo, elipse, Pintura, poligono, rampa, tono, union, type Forma } from "./pintura";

const LARGO = 112;
const TEAL = rampa("#1f9a9a");
const AMARILLO = rampa("#f6c81c");
const DORADO = rampa("#e8a820");
const NARANJA = rampa("#f2861c");
const VERDE = rampa("#3db842");
const HOJA = rampa("#2f9a3a");
const ROSA = rampa("#f07a9a");
const ROJO = rampa("#d8283a");
const BOCA = rampa("#8a1a30");
const LENGUA = rampa("#e85a7a");
const DIENTE = rampa("#f6f0e0");
const MORADO = rampa("#8a3cc8");
const MARFIL = rampa("#f4ead8");
const PIEL = [rampa("#c98a5a"), rampa("#8a5a3a"), rampa("#e0ac69")];

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
/** El centro de la cabeza. */
const H = { x: 62, y: -64 };

/** Ajusta un color hacia más oscuro (k < 0) o más claro (k > 0). */
function mixTono(c: RGBA, k: number): RGBA {
  const f = k < 0 ? 1 + k * 0.17 : 1 + k * 0.14;
  return [Math.min(255, Math.round(c[0] * f)), Math.min(255, Math.round(c[1] * f)), Math.min(255, Math.round(c[2] * f)), 255];
}

/** Un punto del lomo: posición (pantalla) y grosor. */
type Nudo = { x: number; y: number; r: number };

/**
 * Un tramo del cuerpo de la serpiente (una sola forma, así no se ven costuras adentro): las escamas en
 * bandas del arcoíris que cruzan el cuerpo en diagonal, cada escama con su orilla oscura, y el hilo de
 * cuentas de oro por el lomo. `s0` es lo largo que ya se pintó (las bandas siguen de un tramo al otro).
 */
function tramo(p: Pintura, nudos: Nudo[], s0: number): number {
  const segs: { a: Nudo; b: Nudo; s: number; len: number }[] = [];
  let s = s0;
  for (let i = 0; i + 1 < nudos.length; i++) {
    const a = nudos[i]!;
    const b = nudos[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segs.push({ a, b, s, len });
    s += len;
  }
  const forma = union(...segs.map((g) => cap(g.a.x, g.a.y, g.b.x, g.b.y, g.a.r, g.b.r)));
  /** Lo largo, lo de través (hacia arriba es negativo) y el grosor del cuerpo en un píxel. */
  const donde = (q: { x: number; y: number }) => {
    const x = q.x + 0.5 - OX;
    const y = q.y + 0.5 - OY;
    let best = { d: Infinity, s: 0, lat: 0, r: 1 };
    for (const g of segs) {
      const vx = g.b.x - g.a.x;
      const vy = g.b.y - g.a.y;
      const h = Math.max(0, Math.min(1, ((x - g.a.x) * vx + (y - g.a.y) * vy) / (g.len * g.len || 1)));
      const r = g.a.r + (g.b.r - g.a.r) * h;
      const px = g.a.x + vx * h;
      const py = g.a.y + vy * h;
      const d = Math.hypot(x - px, y - py) - r;
      if (d < best.d) {
        let nx = -vy / (g.len || 1);
        let ny = vx / (g.len || 1);
        if (ny > 0 || (ny === 0 && nx > 0)) {
          nx = -nx;
          ny = -ny;
        }
        best = { d, s: g.s + g.len * h, lat: (x - px) * nx + (y - py) * ny, r };
      }
    }
    return best;
  };
  p.volumen(forma, ARCOIRIS[0]!, {
    alto: 12,
    planos: true,
    borde: "oscuro",
    sombra: 0.4,
    brillo: 0.5,
    patron: (q) => {
      const w = donde(q);
      const k = Math.floor((w.s - w.lat * 0.7) / 9);
      return ARCOIRIS[((k % 7) + 7) % 7]!;
    },
    pinta: (q, c) => {
      const w = donde(q);
      // El hilo de cuentas de oro por el lomo.
      const lomo = w.lat - w.r * 0.62;
      if (Math.abs(lomo) < 1.3 && w.r > 6) return ((w.s % 4) + 4) % 4 < 2.2 ? tono(ORO, 5) : tono(ORO, 2);
      // Las escamas: filas a lo largo, corridas media escama entre fila y fila.
      const a = w.s / 3.6;
      const fila = Math.floor(a);
      const b = w.lat / 3.4 + (((fila % 2) + 2) % 2) * 0.5;
      const fa = a - fila;
      const fb = b - Math.floor(b);
      const r = Math.hypot((fb - 0.5) * 1.1, fa * 0.95);
      if (r > 0.6) return mixTono(c, -1.6);
      if (r < 0.22 && fa < 0.3) return mixTono(c, 0.9);
      return c;
    },
  });
  return s;
}

/** Un punto del mundo de la carroza en pantalla. */
const W = (x: number, y: number, z: number) => pantalla(x, y, z);

/**
 * El lomo enroscado: una espiral que sube en tres vueltas (cada una más chica y más alta), desde la cola
 * atrás a la derecha hasta el cuello adelante. Se corta en tramos de atrás y de adelante de cada vuelta
 * (por la profundidad en pantalla), así lo de adelante tapa a lo de atrás.
 */
function espiral(): Nudo[][] {
  const tramos: Nudo[][] = [];
  let actual: Nudo[] = [];
  let adelante: boolean | null = null;
  const fin = Math.PI * 2 * 2.18;
  for (let th = -0.75; th <= fin + 1e-6; th += 0.12) {
    const k = Math.max(0, th) / (Math.PI * 2);
    const ax = 50 - 12 * k;
    const ay = 15 - 3.5 * k;
    const z = 15 + 16 * k;
    const cola = Math.min(1, (th + 0.75) / 2.2);
    const r = (15.5 - 1.6 * k) * (0.25 + 0.75 * cola);
    const c = Math.cos(th);
    const sn = Math.sin(th);
    const q = W(56 + ax * c, 20 + ay * sn, z);
    const esAdelante = ax * c + ay * sn > 0;
    const n = { x: q.x, y: q.y, r };
    if (adelante !== null && esAdelante !== adelante) {
      actual.push(n);
      tramos.push(actual);
      actual = [];
    }
    adelante = esAdelante;
    actual.push(n);
  }
  tramos.push(actual);
  return tramos;
}

/** El cuerpo enroscado (sin el cuello). Devuelve lo largo pintado y el último nudo (de ahí sale el cuello). */
function cuerpo(p: Pintura): { s: number; fin: Nudo } {
  let s = 0;
  let fin: Nudo = { x: 0, y: 0, r: 1 };
  for (const t of espiral()) {
    s = tramo(p, t, s);
    fin = t[t.length - 1]!;
  }
  return { s, fin };
}

/** El cuello que se levanta hasta la cabeza (va con la cabeza y se mece). */
function cuello(p: Pintura, s: number, desde: Nudo) {
  tramo(
    p,
    [
      desde,
      { x: desde.x + 10, y: desde.y - 12, r: 12.5 },
      { x: H.x + 8, y: H.y + 36, r: 12 },
      { x: H.x + 6, y: H.y + 16, r: 11.5 },
    ],
    s,
  );
}

/** Los cuernos de oro, gruesos, que suben y se curvan hacia atrás, con sus anillos. */
function cuernos(p: Pintura) {
  for (const [bx, by, l] of [
    [H.x - 4, H.y - 18, 0],
    [H.x + 14, H.y - 20, 1],
  ] as const) {
    const pts: Nudo[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      // Sube derecho y al final se dobla hacia atrás (a la derecha) en gancho.
      pts.push({ x: bx + Math.sin(t * 2.1) * 16 + l * t * 2, y: by - t * 30 + (t > 0.6 ? (t - 0.6) * 14 : 0), r: 5 - t * 3.8 });
    }
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      p.volumen(cap(a.x, a.y, b.x, b.y, a.r, b.r), AMARILLO, { alto: 2.5, brillo: 0.9, planos: true, borde: "oscuro", sombra: i === 1 ? 0.35 : 0, base: i % 3 === 0 ? -1.4 : 0.5 });
    }
  }
}

/** Las escamitas de la cabeza: filas corridas, cada escama con su orilla oscura. */
function escamitas(q: { x: number; y: number }, c: RGBA): RGBA {
  const a = (q.y - OY) / 3.4;
  const fila = Math.floor(a);
  const b = (q.x - OX) / 4 + (((fila % 2) + 2) % 2) * 0.5;
  const fa = a - fila;
  const fb = b - Math.floor(b);
  const r = Math.hypot((fb - 0.5) * 1.15, fa * 0.9);
  if (r > 0.6) return mixTono(c, -1.3);
  return r < 0.25 && fa < 0.3 ? mixTono(c, 0.8) : c;
}

/** Los ojos (centro, ancho y lado). */
const OJOS = [
  [H.x - 12, H.y - 7, 15, -1],
  [H.x + 13, H.y - 9, 13, 1],
] as const;
/** La bisagra de la quijada y la punta de la trompa. */
const BISAGRA = { x: H.x + 12, y: H.y + 14 };
const PUNTA = { x: H.x - 38, y: H.y + 12 };

/**
 * La cabeza de dragón: los cuernos, la oreja rosada, la boca abierta por dentro (con la lengua), el cráneo
 * de oro con escamitas (verde en las mejillas, naranja atrás), la cresta, los ojos grandes con su ceja de
 * oro, la trompa ancha con la nariz rosada y los colmillos de arriba.
 */
function cabeza(p: Pintura) {
  const { x, y } = H;
  cuernos(p);
  // La oreja rosada, como una hoja, hacia atrás.
  p.volumen(pol([x + 20, y - 4], [x + 46, y - 22], [x + 36, y + 6]), ROSA, { alto: 3, planos: true, borde: "oscuro", sombra: 0.35 });
  p.volumen(pol([x + 25, y - 3], [x + 40, y - 16], [x + 34, y + 2]), ROJO, { alto: 1.5, borde: false });
  // La boca por dentro: una cuña que se abre hacia la punta.
  p.volumen(pol([PUNTA.x + 2, PUNTA.y + 2], [BISAGRA.x, BISAGRA.y], [PUNTA.x + 6, PUNTA.y + 21]), BOCA, { alto: 3, base: -0.8, borde: "oscuro" });
  p.volumen(el(x - 14, y + 26, 13, 4, -0.18), LENGUA, { alto: 2.5, brillo: 0.8, borde: false });
  // El cráneo y la trompa ancha (una sola forma), con escamitas.
  const craneo = union(el(x + 2, y - 4, 25, 19), el(x - 17, y + 4, 22, 11, 0.12));
  p.volumen(craneo, AMARILLO, {
    alto: 16,
    planos: true,
    borde: "oscuro",
    sombra: 0.4,
    brillo: 0.6,
    patron: (q) => {
      const dx = q.x - OX - x;
      const dy = q.y - OY - y;
      if (dy > 2 && dx > 0) return VERDE;
      if (dx > 18) return NARANJA;
      return AMARILLO;
    },
    pinta: escamitas,
  });
  // El labio de arriba, de oro, de la punta a la bisagra, con los colmillos.
  p.volumen(cap(PUNTA.x + 1, PUNTA.y + 2, BISAGRA.x, BISAGRA.y, 2.6, 2), DORADO, { alto: 1.5, brillo: 0.9, planos: true, borde: "oscuro" });
  for (let k = 0; k < 8; k++) {
    const t = (k + 0.5) / 8.5;
    const tx = PUNTA.x + 3 + (BISAGRA.x - PUNTA.x - 3) * t;
    const ty = PUNTA.y + 3.5 + (BISAGRA.y - PUNTA.y - 2) * t;
    const largo = k === 1 || k === 5 ? 11 : 5.5;
    p.volumen(pol([tx - 2.4, ty], [tx + 2.4, ty], [tx - 0.4, ty + largo]), DIENTE, { alto: 1.4, brillo: 1, planos: true, borde: "oscuro" });
  }
  // La cresta de escamas moradas y naranjas por la frente.
  for (let k = 0; k < 6; k++) p.volumen(el(x - 12 + k * 5.4, y - 22 + Math.abs(k - 2.5) * 1.4, 3.2, 4.4), k % 2 ? MORADO : NARANJA, { alto: 2, planos: true, borde: "oscuro", sombra: 0.3 });
  // El aro de piel de los ojos, los ojos y las cejas de oro en arco.
  for (const [cx, cy, w, l] of OJOS) {
    p.volumen(el(cx, cy, w * 0.66, w * 0.52), NARANJA, { alto: 2.5, planos: true, borde: "oscuro", sombra: 0.35 });
    const [ex, ey] = P(cx, cy);
    ojo(p, ex, ey, w, w * 0.42, w * 0.36, l, { iris: TEAL, pestanas: 0, mira: -1.4 });
    const tramoCeja: Nudo[] = [0, 1, 2, 3, 4].map((i) => {
      const t = i / 4;
      return { x: cx - w * 0.62 + t * w * 1.24, y: cy - w * 0.5 - Math.sin(t * Math.PI) * 3.2 - l * t * 1.2, r: 2.6 - Math.abs(t - 0.4) * 1.4 };
    });
    for (let i = 1; i < tramoCeja.length; i++) {
      const a2 = tramoCeja[i - 1]!;
      const b2 = tramoCeja[i]!;
      p.volumen(cap(a2.x, a2.y, b2.x, b2.y, a2.r, b2.r), DORADO, { alto: 2, brillo: 0.9, planos: true, borde: "oscuro", sombra: i === 1 ? 0.4 : 0 });
    }
  }
  // La nariz rosada en la punta de la trompa, con las ventanas.
  p.volumen(el(PUNTA.x + 1, PUNTA.y - 7, 7.5, 6.2), ROSA, { alto: 3, brillo: 0.8, planos: true, borde: "oscuro", sombra: 0.35 });
  for (const l of [-1, 1]) p.plano(el(PUNTA.x + 1 + l * 3, PUNTA.y - 6, 1.3, 1.9), tono(BOCA, 0));
  // Remolinos pintados en la mejilla y flores junto a la oreja.
  curvaP(p, x + 4, y + 6, x + 12, y, x + 15, y + 8, tono(AMARILLO, 5), 1.4);
  flor(p, x + 24, y + 10, 5.6, MARFIL, AMARILLO);
  flor(p, x + 17, y + 18, 3.8, ROSA, AMARILLO);
  flor(p, x + 30, y + 19, 3.4, MORADO, AMARILLO);
}

/** La quijada de abajo, que se abre (gira en la bisagra): verde de escamitas, los dientes de abajo y las barbas. */
function quijada(p: Pintura) {
  const lo = { x: PUNTA.x + 6, y: PUNTA.y + 21 };
  p.volumen(union(pol([lo.x - 3, lo.y - 1], [BISAGRA.x, BISAGRA.y + 1], [BISAGRA.x + 2, BISAGRA.y + 7], [lo.x + 16, lo.y + 9], [lo.x - 1, lo.y + 7]), el(lo.x + 3, lo.y + 4, 6, 4.5)), NARANJA, { alto: 4, planos: true, borde: "oscuro", pinta: escamitas, sombra: 0.3 });
  p.volumen(cap(lo.x - 2, lo.y, BISAGRA.x, BISAGRA.y + 1, 1.8, 1.4), DORADO, { alto: 1, brillo: 0.9, borde: "oscuro" });
  for (let k = 0; k < 6; k++) {
    const t = (k + 0.4) / 6.5;
    const tx = lo.x + (BISAGRA.x - lo.x) * t;
    const ty = lo.y + (BISAGRA.y - lo.y) * t - 0.5;
    p.volumen(pol([tx - 2.2, ty], [tx + 2.2, ty], [tx + 0.4, ty - (k === 0 || k === 4 ? 9 : 5)]), DIENTE, { alto: 1.4, brillo: 1, planos: true, borde: "oscuro" });
  }
  // Las barbas que cuelgan, como cintas verdes con la borla amarilla.
  for (const [bx, by, l] of [
    [lo.x + 2, lo.y + 8, -1],
    [lo.x + 16, lo.y + 6, 1],
  ] as const) {
    curvaP(p, bx, by, bx + l * 3, by + 5, bx - l * 1, by + 10, tono(MORADO, 3), 2.2);
    p.volumen(ci(bx - l * 1, by + 11, 2.2), AMARILLO, { alto: 1.2, borde: "oscuro" });
  }
}

/** Una flor de cinco pétalos. */
function flor(p: Pintura, x: number, y: number, r: number, petalo: Ramp, centro: Ramp) {
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    p.volumen(el(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, r * 0.62, r * 0.45, a), petalo, { alto: 1.5, brillo: 0.3, borde: "oscuro" });
  }
  p.volumen(ci(x, y, r * 0.42), centro, { alto: 1.2, brillo: 0.8, borde: "oscuro" });
}

/** Una mata de hojas con flores para el borde de la cubierta. */
function mata(p: Pintura, x: number, y: number, k: number) {
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.55;
    p.volumen(el(x + Math.cos(a) * 6, y + Math.sin(a) * 5, 6, 2.6, a), i % 2 ? HOJA : VERDE, { alto: 2, planos: true, borde: "oscuro", sombra: 0.3 });
  }
  flor(p, x - 3, y - 4, 3.6, [MORADO, ROJO, NARANJA, ROSA][k % 4]!, AMARILLO);
  flor(p, x + 4, y - 2, 3, [MARFIL, AMARILLO, MORADO, ROJO][k % 4]!, NARANJA);
}

/** Un bailarín chico con tocado de plumas, parado en una vuelta del cuerpo. */
function bailarin(f: Figura, id: string, x: number, y: number, k: number, fase: number): Parte {
  const p = f.lienzo();
  const [cx, cy] = P(x, y);
  const s = 0.56;
  figurita(p, cx, cy, s, { piel: PIEL[k % 3]!, ropa: [TEAL, MORADO, NARANJA, ROJO][k % 4]!, pelo: rampa("#2a1a22"), falda: k % 2 === 1 });
  abanico(p, cx, cy - 30, 3, 11, -Math.PI + 0.35, -0.35, 5, ARCOIRIS.slice(k % 3), 4);
  p.volumen(cap(cx - 5 - OX, cy - 28 - OY, cx + 5 - OX, cy - 28 - OY, 1.5), ORO, { alto: 1, borde: "oscuro" });
  return f.parte(id, p, cx, cy, { padre: "cuerpo", mov: { gira: { amp: 0.08, periodo: 1300 + k * 170, fase }, vaiven: { dy: -1.5, periodo: 650 + k * 40, fase } } });
}

/** El faldón: azul petróleo con festones de oro, el ruedo rojo y florecitas. */
function festones(u: number, v: number, alto: number): RGBA {
  const cell = 8;
  const fu = (((u % cell) + cell) % cell) / cell;
  const arco = alto - 2.4 - Math.sin(fu * Math.PI) * 3.4;
  if (Math.abs(v - arco) < 0.7) return tono(ORO, 4);
  if (v > arco) return tono(ROJO, 3 + (Math.floor(u) % 2 ? 0.4 : 0));
  const k = Math.floor(u / cell);
  const r = Math.hypot((fu - 0.5) * cell, v - (arco - 3));
  if (r < 0.9) return tono(AMARILLO, 5);
  if (r < 2.1) return tono([ROSA, AMARILLO, MARFIL][k % 3]!, 4);
  return tono(TEAL, 3);
}

export function amaru(): CarrozaArte {
  const s = escena(LARGO, 20);
  plataforma(s, LARGO, { faldon: festones, cubierta: (u, v) => tono(HOJA, 3 + ((Math.floor(u / 3) + Math.floor(v / 3)) % 2 ? 0.4 : -0.3)), flecos: [ROJO, AMARILLO, MORADO, TEAL] }, false);
  const f = fig();
  const partes: Parte[] = [parteBase(s)];

  // El penacho detrás de la cabeza (se mece con ella).
  const pen = f.lienzo();
  abanico(pen, H.x + 8 + OX, H.y - 14 + OY, 6, 44, -Math.PI + 0.45, -0.2, 9, ARCOIRIS, 10);

  // El cuerpo enroscado, con la punta de la cola que se menea.
  const cuer = f.lienzo();
  const { s: s0, fin } = cuerpo(cuer);
  const c0 = W(56 + 50 * Math.cos(-0.75), 20 + 15 * Math.sin(-0.75), 15);
  const cola = f.lienzo();
  cola.volumen(pol([c0.x + 2, c0.y - 1], [c0.x + 12, c0.y - 12], [c0.x + 6, c0.y + 2]), ORO, { alto: 1.5, brillo: 0.9, planos: true, borde: "oscuro" });
  cola.volumen(pol([c0.x + 3, c0.y], [c0.x + 14, c0.y - 4], [c0.x + 5, c0.y + 4]), NARANJA, { alto: 1.5, brillo: 0.9, planos: true, borde: "oscuro" });
  partes.push(f.parte("cola", cola, ...P(c0.x + 2, c0.y), { mov: { gira: { amp: 0.25, periodo: 1500 } } }));
  partes.push(f.parte("cuerpo", cuer, ...P(FC.x - 30, FC.y - 10), { mov: { gira: { amp: 0.006, periodo: 5400 } } }));
  const sobre = (x: number, y: number, z: number) => W(x, y, z);
  const b1 = sobre(26, 16, 44);
  const b2 = sobre(92, 15, 44);
  partes.push(bailarin(f, "bailarin-1", b1.x, b1.y, 0, 0), bailarin(f, "bailarin-2", b2.x, b2.y, 1, 0.3));
  partes.push(f.parte("penacho", pen, ...P(H.x + 8, H.y - 14), { padre: "cuello", mov: { gira: { amp: 0.05, periodo: 2100 } } }));

  // El cuello y la cabeza se mecen juntos, como la serpiente que se levanta a mirar.
  const cue = f.lienzo();
  cuello(cue, s0, fin);
  partes.push(f.parte("cuello", cue, ...P(fin.x, fin.y), { padre: "cuerpo", mov: { gira: { amp: 0.05, periodo: 3600 } } }));
  const cab = f.lienzo();
  cabeza(cab);
  partes.push(f.parte("cabeza", cab, ...P(H.x + 4, H.y + 20), { padre: "cuello", mov: { gira: { amp: 0.04, periodo: 2700, fase: 0.2 } } }));
  const parp = f.lienzo();
  for (const [cx, cy, w, l] of OJOS) {
    const [ex, ey] = P(cx, cy);
    parpado(parp, ex, ey, w, w * 0.4, w * 0.34, l, ROSA);
  }
  partes.push(f.parte("parpados", parp, ...P(H.x + 4, H.y + 20), { padre: "cabeza", contorno: false, mov: { parpadeo: { cada: 3900, dura: 220 } } }));
  const qui = f.lienzo();
  quijada(qui);
  partes.push(f.parte("quijada", qui, ...P(BISAGRA.x, BISAGRA.y), { padre: "cabeza", mov: { gira: { amp: 0.08, periodo: 1300, centro: -0.04 } } }));

  // Adelante: las matas de flores del borde y dos bailarines más.
  const mat = f.lienzo();
  for (const [t, k] of [
    [0.03, 0],
    [0.97, 1],
  ] as const) {
    const q = { x: FL.x + (FC.x - FL.x) * t, y: FL.y - 8 + (FC.y - FL.y) * t };
    mata(mat, q.x, q.y, k);
  }
  const q = { x: FC.x + (FR.x - FC.x) * 0.55, y: FC.y - 8 + (FR.y - FC.y) * 0.55 };
  mata(mat, q.x, q.y, 3);
  partes.push(f.parte("matas", mat, ...P(FC.x, FC.y)));
  const b3 = sobre(19, 30, 36);
  const b4 = sobre(100, 27, 31);
  partes.push(bailarin(f, "bailarin-3", b3.x, b3.y, 2, 0.6));
  partes.push(bailarin(f, "bailarin-4", b4.x, b4.y, 3, 0.15));
  void [BRILLO, LINEA, pluma, BK];
  return { largo: LARGO, partes, luces: [], marco: { x0: -ANCHO - 40, x1: LARGO + 40 } };
}

export type { Forma };
