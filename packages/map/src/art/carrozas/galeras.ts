// El Galeras que fuma (pixel art pintado): el volcán de Pasto tapa todo el camión, de roca café con sus
// cañadas, la nieve que chorrea desde el cráter y el humo de colores que sale en volutas enroscadas. En la
// falda que da a la vereda tiene la cara, enmarcada en lana de colores, que se ríe con los ojos grandes y
// la boca abierta. Abajo, el pasto verde con flores, papas, cuyes y los campesinos de sombrero blanco y
// ruana roja; en las esquinas, penachos de plumas en macetas doradas, y al frente el adorno dorado con la
// piedra roja. El faldón va de festones morados, verde agua, naranjas y verdes.
import type { Ramp, RGBA } from "../pixel";
import { abanico, BRILLO, ceja, Figura, LINEA, mejilla, ojo, parpado } from "./figuras";
import { baranda, festones, flor, hash, hoja, VERDES } from "./guirnaldas";
import { cuy, figurita, papa } from "./munecos";
import type { CarrozaArte, Parte } from "./partes";
import { ANCHO, escena, ORO, pantalla, parteBase, plataforma } from "./plataforma";
import { capsula, circulo, elipse, Pintura, poligono, rampa, tono, union, type Forma } from "./pintura";

const LARGO = 104;
const ROCA = rampa("#7a5e4a");
const ROCA2 = rampa("#5e4a40");
const PIEDRA = rampa("#9a9098");
const NIEVE = rampa("#f4f4fa");
const PASTO = rampa("#4a9a3a");
const PIEL = rampa("#c8905a");
const BOCA = rampa("#7a1d33");
const LENGUA = rampa("#e0607a");
const DIENTES = rampa("#f6f0e6");
const IRIS = rampa("#8a4a1c");
const LANA = [rampa("#e0408a"), rampa("#1fb8b0"), rampa("#8a3cc8"), rampa("#f2861c")];
const HUMO = [rampa("#f28ab8"), rampa("#f2a21c"), rampa("#b48ae8"), rampa("#f7d84a"), rampa("#7ab8f0")];
const MORADO = rampa("#8a3ac8");
const VERDE_AGUA = rampa("#1fa89a");
const NARANJA = rampa("#f2861c");
const FLORES = [rampa("#e8407a"), rampa("#f7c518"), rampa("#f4f0f8"), rampa("#c84ad8"), rampa("#f2711c")];
const PIELES = [rampa("#d89868"), rampa("#b87a4a"), rampa("#8a5a3a")];
const RUANA = rampa("#c8323a");
const SOMBRERO = rampa("#f4ece0");

const OX = 90;
const OY = 160;
const fig = () => new Figura(250, 250, OX, OY, [0, 0, 0]);
const P = (x: number, y: number): [number, number] => [x + OX, y + OY];
const curvaP = (p: Pintura, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, c: RGBA, g = 1) => p.curva(x0 + OX, y0 + OY, cx + OX, cy + OY, x1 + OX, y1 + OY, c, g);
const pol = (...pts: [number, number][]) => poligono(pts.map(([x, y]) => P(x, y)));
const el = (x: number, y: number, rx: number, ry: number, a = 0) => elipse(x + OX, y + OY, rx, ry, a);
const ci = (x: number, y: number, r: number) => circulo(x + OX, y + OY, r);
const cap = (ax: number, ay: number, bx: number, by: number, ra: number, rb = ra) => capsula(ax + OX, ay + OY, bx + OX, by + OY, ra, rb);

const FL = pantalla(0, ANCHO, 0);
const FC = pantalla(LARGO, ANCHO, 0);
const FR = pantalla(LARGO, 0, 0);
/** La boca del cráter. */
const K = { x: 32, y: -62 };
/** El centro de la cara (en la falda que da a la vereda). */
const F = { x: 20, y: -6 };

/** Dónde empieza el pasto (y de pantalla) a cada x: una orilla ondulada que baja hacia los lados. */
const orillaPasto = (x: number) => 12 + Math.abs(x - 34) * 0.12 + Math.sin(x * 0.35) * 3;

/** El color del volcán en cada punto: las cañadas de roca, la nieve que chorrea y el pasto de abajo. */
function volcan(q: { x: number; y: number }): Ramp {
  const x = q.x - OX;
  const y = q.y - OY;
  if (y > orillaPasto(x)) return PASTO;
  const th = Math.atan2(x - K.x, y - K.y + 6);
  const d = Math.hypot(x - K.x, (y - K.y) * 1.1);
  const banda = Math.floor(th * 9 + Math.sin(d * 0.12) * 0.5);
  const nieve = 17 + Math.abs(Math.sin(th * 7 + 1)) * 12 + (banda % 2 ? 7 : 0);
  if (d < nieve) return NIEVE;
  if (hash(Math.floor(x / 5), Math.floor(y / 4)) > 0.86) return PIEDRA;
  return banda % 2 ? ROCA2 : ROCA;
}
function vetas(q: { x: number; y: number }, c: RGBA): RGBA | null {
  const x = q.x - OX;
  const y = q.y - OY;
  if (y > orillaPasto(x)) {
    // Las matas del pasto y las florecitas.
    const h = hash(Math.floor(x / 2), Math.floor(y / 2));
    if (h > 0.93) return tono(FLORES[Math.floor(h * 97) % FLORES.length]!, 4);
    return (x + y * 2) % 5 === 0 ? [Math.round(c[0] * 0.8), Math.round(c[1] * 0.85), Math.round(c[2] * 0.8), 255] : null;
  }
  const th = Math.atan2(x - K.x, y - K.y + 6);
  const d = Math.hypot(x - K.x, (y - K.y) * 1.1);
  const f = th * 9 + Math.sin(d * 0.12) * 0.5;
  // La raya honda de cada cañada.
  if (f - Math.floor(f) < 0.12 && d > 20) return [Math.round(c[0] * 0.7), Math.round(c[1] * 0.68), Math.round(c[2] * 0.74), 255];
  return null;
}

/** El cono del volcán: la cara de la luz (la que da a la vereda) y la del frente, en sombra. */
function cono(p: Pintura) {
  const izq = pol([FL.x - 3, FL.y + 3], [-34, 0], [K.x - 20, K.y + 8], [K.x, K.y - 1], [FC.x - 2, FC.y + 2]);
  const der = pol([K.x, K.y - 1], [K.x + 20, K.y + 7], [92, 8], [FR.x + 3, FR.y + 1], [FC.x - 2, FC.y + 2]);
  p.volumen(izq, ROCA, { alto: 26, base: 0.4, planos: true, borde: "oscuro", patron: volcan, pinta: vetas });
  p.volumen(der, ROCA, { alto: 20, base: -0.6, planos: true, borde: "oscuro", patron: volcan, pinta: vetas });
  // El cráter: la boca oscura con el borde nevado y el resplandor naranja de adentro.
  p.volumen(el(K.x, K.y, 15, 4.6), NIEVE, { alto: 2, planos: true, borde: "oscuro" });
  p.volumen(el(K.x + 1, K.y + 0.5, 11, 2.8), ROCA2, { alto: 1, base: -2, borde: false });
  p.plano(el(K.x + 1, K.y + 1.2, 7, 1.4), tono(NARANJA, 4));
}

/** La cara del volcán: el marco de lana de colores, la cara, los ojos grandes, las cejas, la nariz y la sonrisa. */
function cara(p: Pintura) {
  const { x, y } = F;
  // El marco de lana (como un gorro tejido): franjas en herradura.
  for (let k = 3; k >= 0; k--) {
    const rx = 22 + k * 2.6;
    const ry = 26 + k * 2.6;
    const anillo = el(x, y, rx, ry, 0.12);
    const herradura: Forma = { ...anillo, d: (px, py) => Math.max(anillo.d(px, py), py - OY - (y + 14)) };
    p.volumen(herradura, LANA[k]!, { alto: 3, planos: true, borde: "oscuro", pinta: (q, c) => ((q.x + q.y) % 3 === 0 ? tono(LANA[k]!, 4) : c) });
  }
  // La cara de tierra: un óvalo con la quijada redonda.
  const forma = union(el(x, y - 2, 21, 22, 0.12), el(x + 1, y + 10, 17, 15, 0.12));
  p.volumen(forma, PIEL, { alto: 14, planos: true, borde: "oscuro", brillo: 0.4, pinta: (q, c) => (hash(q.x, q.y) > 0.94 ? tono(PIEL, 2) : c) });
  p.volumen(el(x + 12, y + 4, 8, 16, 0.2), PIEL, { alto: 4, base: -0.9, borde: false, brillo: 0 });
  // Las cejas gruesas, los ojos cafés grandes y alegres.
  for (const [dx, l] of [
    [-8, -1],
    [9, 1],
  ] as const) {
    ceja(p, ...P(x + dx, y - 15), 13, l, tono(rampa("#3a2418"), 1), 2.6);
    ojo(p, ...P(x + dx, y - 6), 14, 6.5, 5.5, l, { iris: IRIS, pestanas: 0, mira: 0.8 });
  }
  // La nariz redonda.
  p.volumen(union(el(x + 1, y + 2, 4, 6), el(x + 1, y + 6, 6.4, 3.4)), PIEL, { alto: 3, base: 0.5, borde: "oscuro", sombra: 0.4 });
  // Los cachetes.
  for (const l of [-1, 1]) mejilla(p, ...P(x + l * 14, y + 6), 4, 2.4, tono(rampa("#e86a6a"), 3));
  // La boca abierta de risa: una D (arriba casi derecha, abajo redonda), lo hondo, los dientes de arriba y
  // la comisura que sube a cada lado.
  const media = el(x + 1, y + 11, 13, 12, 0.08);
  const boca: Forma = { ...media, d: (px, py) => Math.max(media.d(px, py), y + 11 - (py - OY) + (px - OX - x - 1) * 0.08) };
  p.volumen(boca, BOCA, { alto: 4, base: -0.8, borde: "oscuro" });
  p.plano({ ...boca, d: (px, py) => Math.max(boca.d(px, py), py - OY - (y + 14.5)) }, tono(DIENTES, 4));
  p.trazo(...P(x - 12, y + 12), ...P(x + 14, y + 10), tono(BOCA, 0), 1);
  for (const [cx, cy] of [
    [x - 13, y + 11],
    [x + 15, y + 9],
  ] as const)
    curvaP(p, cx - 1, cy + 2, cx, cy - 1, cx + (cx < x ? -2 : 2), cy - 2, tono(PIEL, 1), 1);
}

/** La lengua (se mueve al reír, adentro de la boca). */
function quijada(p: Pintura) {
  const { x, y } = F;
  p.volumen(el(x + 2, y + 20, 6, 2.6), LENGUA, { alto: 2, brillo: 0.6, planos: true, borde: false });
  p.trazo(...P(x + 2, y + 18), ...P(x + 2, y + 21), tono(LENGUA, 1), 1);
}

/** Una caja en coordenadas de pantalla. */
function caja(x0: number, y0: number, x1: number, y1: number): Forma {
  return pol([x0, y0], [x1, y0], [x1, y1], [x0, y1]);
}

/** Una voluta de humo: una espiral gruesa que se enrosca, con su raya de luz. */
function voluta(p: Pintura, x: number, y: number, r: number, color: Ramp, giro: 1 | -1) {
  let f: Forma = ci(x, y, r * 0.2);
  const n = 18;
  let prev = { x: x + r * 0.2, y };
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const a = giro * t * Math.PI * 1.7;
    const rr = r * (0.25 + t * 0.75);
    const q = { x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * 0.9 };
    f = union(f, cap(prev.x, prev.y, q.x, q.y, r * (0.16 + t * 0.14)));
    prev = q;
  }
  // La bocanada de atrás (la nube clara de la voluta) y encima la espiral.
  p.volumen(el(x, y, r * 1.05, r * 0.95), color, { alto: 4, base: 1.2, planos: true, borde: "oscuro", brillo: 0.2 });
  p.volumen(f, color, { alto: 3, planos: true, borde: "oscuro", brillo: 0.4 });
  // La línea de la espiral, más oscura, para que se lea el enroscado.
  prev = { x: x + r * 0.2, y };
  for (let i = 1; i <= n - 2; i++) {
    const t = i / n;
    const a = giro * t * Math.PI * 1.7;
    const rr = r * (0.25 + t * 0.75) - r * 0.08;
    const q = { x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * 0.9 };
    p.trazo(...P(prev.x, prev.y), ...P(q.x, q.y), tono(color, 1), 1);
    prev = q;
  }
}

/** La bocanada que sale del cráter: volutas de colores apiñadas, enroscadas para un lado y para el otro. */
function columna(p: Pintura) {
  ([
    [K.x - 8, K.y - 10, 10, 0, 1],
    [K.x + 9, K.y - 14, 11, 1, -1],
    [K.x - 2, K.y - 28, 10, 2, 1],
    [K.x + 14, K.y - 32, 8, 3, -1],
    [K.x - 14, K.y - 30, 7, 4, -1],
  ] as const).forEach(([x, y, r, c, g]) => voluta(p, x, y, r, HUMO[c]!, g));
}

/** Un penacho de plumas en su maceta dorada (las esquinas de la carroza). */
function penacho(p: Pintura, x: number, y: number) {
  abanico(p, ...P(x, y - 12), 3, 20, -Math.PI * 0.92, -Math.PI * 0.08, 6, [LANA[2]!, VERDE_AGUA, NARANJA, LANA[0]!, rampa("#3db842")], 7);
  p.volumen(union(el(x, y - 8, 7, 3), pol([x - 7, y - 8], [x + 7, y - 8], [x + 5, y], [x - 5, y])), ORO, { alto: 3, brillo: 0.9, planos: true, borde: "oscuro", sombra: 0.3 });
  p.volumen(ci(x, y - 4, 1.6), rampa("#d8283a"), { alto: 1, brillo: 1, borde: "oscuro" });
}

/** El adorno dorado del frente: dos volutas de oro y la piedra roja en el medio. */
function joya(p: Pintura, x: number, y: number) {
  for (const l of [-1, 1]) {
    p.volumen(union(el(x + l * 7, y, 6, 4.6), cap(x + l * 2, y + 3, x + l * 12, y - 3, 1.8)), ORO, { alto: 2.5, brillo: 0.9, planos: true, borde: "oscuro", sombra: 0.35 });
    curvaP(p, x + l * 4, y, x + l * 7, y - 3, x + l * 9, y + 1, tono(ORO, 1), 1);
  }
  p.volumen(el(x, y, 5, 6), ORO, { alto: 2, brillo: 0.9, borde: "oscuro" });
  p.volumen(el(x, y, 3.2, 4.2), rampa("#d8283a"), { alto: 2, brillo: 1, borde: "oscuro" });
  p.punto(Math.round(x - 1 + OX), Math.round(y - 2 + OY), BRILLO);
}

export function galeras(): CarrozaArte {
  const s = escena(LARGO, 20);
  plataforma(s, LARGO, { faldon: festones([MORADO, VERDE_AGUA, NARANJA, rampa("#3db842")], rampa("#5a2a8a"), ORO), cubierta: () => tono(PASTO, 2), flecos: [rampa("#3db842"), NARANJA, ORO] }, false);
  const f = fig();
  const partes: Parte[] = [parteBase(s)];

  // El penacho de atrás, la columna de humo y el volcán.
  const atras = f.lienzo();
  penacho(atras, -2, 2);
  partes.push(f.parte("penacho-atras", atras, ...P(-2, 2), { mov: { gira: { amp: 0.05, periodo: 2200 } } }));
  const col = f.lienzo();
  columna(col);
  partes.push(f.parte("columna", col, ...P(K.x, K.y), { mov: { gira: { amp: 0.06, periodo: 3000 } } }));
  const vol = f.lienzo();
  cono(vol);
  // Las piedras grises de la falda, con su luz.
  for (let k = 0; k < 9; k++) {
    const x = -20 + k * 12 + hash(k, 21) * 6;
    const y = -20 + hash(k, 22) * 30 + Math.abs(x - K.x) * 0.25;
    if (Math.hypot(x - F.x, y - F.y) < 30 || y > orillaPasto(x)) continue;
    vol.volumen(el(x, y, 5 + hash(k, 23) * 3, 3 + hash(k, 24) * 1.6), PIEDRA, { alto: 3, planos: true, borde: "oscuro", sombra: 0.3 });
  }
  // Papas y matas en la falda.
  for (const [x, y] of [
    [52, 22],
    [62, 30],
    [74, 26],
    [-20, 18],
    [40, 44],
  ] as const)
    papa(vol, ...P(x, y), 3.4, rampa("#c8a060"));
  for (let k = 0; k < 14; k++) {
    const x = -30 + k * 9 + hash(k, 3) * 4;
    const y = orillaPasto(x) + 4 + hash(k, 4) * 10;
    if (Math.abs(x - F.x) < 26 && y < F.y + 30) continue;
    hoja(vol, ...P(x, y), -Math.PI / 2 + (hash(k, 5) - 0.5), 8, 3, VERDES[k % 3]!);
    flor(vol, ...P(x + 2, y - 5), 2.4, FLORES[k % FLORES.length]!, rampa("#f7c518"), k);
  }
  partes.push(f.parte("volcan", vol, ...P(K.x, FC.y)));

  // Las volutas de humo que suben del cráter.
  ([
    [K.x - 18, K.y - 44, 7, 1],
    [K.x + 18, K.y - 48, 8, -1],
    [K.x, K.y - 56, 6, 1],
    [K.x + 28, K.y - 30, 5, -1],
  ] as const).forEach(([x, y, r, g], k) => {
    const p = f.lienzo();
    voluta(p, x, y, r, HUMO[k % HUMO.length]!, g);
    partes.push(f.parte(`humo-${k}`, p, ...P(x, y), { mov: { sube: { dx: (k % 2 ? -1 : 1) * 4, dy: -16, periodo: 3200, fase: k / 4, crece: 0.4 } } }));
  });

  // La cara (se mece), la quijada que se abre y los párpados.
  const car = f.lienzo();
  cara(car);
  partes.push(f.parte("cara", car, ...P(F.x, F.y + 24), { mov: { gira: { amp: 0.03, periodo: 3400 } } }));
  const qui = f.lienzo();
  quijada(qui);
  partes.push(f.parte("lengua", qui, ...P(F.x + 2, F.y + 19), { padre: "cara", mov: { vaiven: { dy: 1.2, periodo: 700 } } }));
  const parp = f.lienzo();
  for (const [dx, l] of [
    [-8, -1],
    [9, 1],
  ] as const)
    parpado(parp, ...P(F.x + dx, F.y - 6), 14, 6.5, 5.5, l, PIEL);
  partes.push(f.parte("parpados", parp, ...P(F.x, F.y + 24), { padre: "cara", contorno: false, mov: { parpadeo: { cada: 3200, dura: 200 } } }));

  // Los campesinos de sombrero blanco y ruana roja, en las faldas (dos grupos que bailan aparte).
  const gente = (id: string, lugares: readonly (readonly [number, number])[], k0: number) => {
    const p = f.lienzo();
    lugares.forEach(([x, y], k) => figurita(p, ...P(x, y), 0.38, { piel: PIELES[(k + k0) % 3]!, ropa: (k + k0) % 3 === 2 ? rampa("#2f6fd6") : RUANA, sombrero: SOMBRERO, pelo: rampa("#2a1a22"), ...((k + k0) % 2 ? { mazorca: true } : {}) }));
    return f.parte(id, p, ...P(lugares[0]![0], lugares[0]![1]), { mov: { vaiven: { dy: -1.4, periodo: 820 + k0 * 70, fase: k0 * 0.2 }, gira: { amp: 0.03, periodo: 1600, fase: k0 * 0.3 } } });
  };
  partes.push(gente("campesinos-arriba", [[-14, -2], [54, -24], [66, -8], [-26, 10], [6, -36]], 0));
  partes.push(gente("campesinos-abajo", [[-32, 30], [46, 32], [76, 10], [88, 34], [60, 20]], 1));

  // Los cuyes asomados en el pasto.
  const cuyes = f.lienzo();
  for (const [x, y, c, m] of [
    [-34, 26, "#c98a4a", "#f4ece0"],
    [60, 46, "#f4ece0", "#8a5a3a"],
    [88, 40, "#b8763a", "#f4ece0"],
    [30, 54, "#8a5a3a", "#f4ece0"],
  ] as const)
    cuy(cuyes, ...P(x, y), 0.8, rampa(c), rampa(m));
  partes.push(f.parte("cuyes", cuyes, ...P(30, 50), { mov: { vaiven: { dy: -0.8, periodo: 1300 } } }));

  // Adelante: el penacho de la esquina y el adorno dorado del costado.
  const ade = f.lienzo();
  const L = (q: { x: number; y: number }) => ({ x: q.x + OX, y: q.y + OY });
  const telas = [MORADO, VERDE_AGUA, NARANJA, rampa("#3db842")];
  baranda(ade, L(FL), L(FC), 8, telas, rampa("#5a2a8a"), ORO, FLORES);
  baranda(ade, L(FC), L(FR), 8, telas, rampa("#5a2a8a"), ORO, FLORES);
  penacho(ade, FC.x + 2, FC.y - 2);
  penacho(ade, FR.x - 4, FR.y - 2);
  const jo = pantalla(LARGO * 0.42, ANCHO, 2);
  joya(ade, jo.x, jo.y);
  partes.push(f.parte("penachos", ade, ...P(FC.x, FC.y), { mov: { gira: { amp: 0.015, periodo: 2600 } } }));

  void [LINEA, PIEDRA];
  return { largo: LARGO, partes, luces: [], marco: { x0: -ANCHO - 40, x1: LARGO + 40 } };
}
