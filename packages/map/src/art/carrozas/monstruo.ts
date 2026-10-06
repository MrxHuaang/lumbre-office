// El Reloj de E., el monstruo mecánico (pixel art pintado): un simio fantástico de cara rosada y roja,
// pelaje azul en mechones que tapa todo el camión y una cresta naranja como llamarada de pelo, que ruge
// con gracia (colmillos, lengua, cejas pobladas). De la cabeza le salen engranajes que dan vueltas y tubos
// de metal que echan humo de colores; al frente, sus dos manos moradas gigantes sostienen una máscara de
// dientes de oro. Por el costado, rostros tallados naranjas, y atrás máscaras escalonadas en capas.
import type { Ramp, RGBA } from "../pixel";
import { BRILLO, Figura, LINEA, ojo, parpado } from "./figuras";
import type { CarrozaArte, Parte } from "./partes";
import { ANCHO, escena, ORO, pantalla, parteBase, plataforma, zigzag } from "./plataforma";
import { capsula, circulo, elipse, Pintura, poligono, rampa, tono, union, type Forma } from "./pintura";

const LARGO = 112;
const PELO = rampa("#2f5ee0");
const PELO2 = rampa("#1f3aa8");
const PELO3 = rampa("#4a8af0");
const CARA = rampa("#ee5a72");
const HOCICO = rampa("#f49aa0");
const BOCA = rampa("#7a1430");
const LENGUA = rampa("#f06a8a");
const DIENTE = rampa("#f6f0e0");
const FUEGO = [rampa("#f2a21c"), rampa("#f2711c"), rampa("#e0402a"), rampa("#f7d21c")];
const MORADO = rampa("#8a34d0");
const UNA = rampa("#f6a0c8");
const METAL = rampa("#9aaac8");
const BRONCE = rampa("#d8962a");
const TALLA = [rampa("#f2861c"), rampa("#f2b21c"), rampa("#e8602a")];

const OX = 70;
const OY = 220;
const P = (x: number, y: number): [number, number] => [x + OX, y + OY];
/** Una curva en coordenadas de pantalla. */
const curvaP = (p: Pintura, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, c: RGBA, g = 1) => p.curva(x0 + OX, y0 + OY, cx + OX, cy + OY, x1 + OX, y1 + OY, c, g);
const pol = (...pts: [number, number][]) => poligono(pts.map(([x, y]) => P(x, y)));
const el = (x: number, y: number, rx: number, ry: number, a = 0) => elipse(x + OX, y + OY, rx, ry, a);
const ci = (x: number, y: number, r: number) => circulo(x + OX, y + OY, r);
const cap = (ax: number, ay: number, bx: number, by: number, ra: number, rb = ra) => capsula(ax + OX, ay + OY, bx + OX, by + OY, ra, rb);
const fig = () => new Figura(230, 320, OX, OY, [0, 0, 0]);

const FL = pantalla(0, ANCHO, -10);
const FC = pantalla(LARGO, ANCHO, -10);
const FR = pantalla(LARGO, 0, -10);
const BK = pantalla(0, 0, -10);
/** El centro de la cabeza (al frente, arriba). */
const H = (() => {
  const s = pantalla(LARGO * 0.74, ANCHO * 0.55, 66);
  return { x: s.x, y: s.y };
})();

/** Un mechón de pelo: una gota alargada con su punta hacia `ang`. */
function mechon(x: number, y: number, ang: number, largo: number, ancho: number): Forma {
  const tx = x + Math.cos(ang) * largo;
  const ty = y + Math.sin(ang) * largo;
  return union(el(x, y, ancho, ancho * 0.85), pol([x + Math.cos(ang + 1.57) * ancho, y + Math.sin(ang + 1.57) * ancho], [tx, ty], [x + Math.cos(ang - 1.57) * ancho, y + Math.sin(ang - 1.57) * ancho]));
}

/** El pelaje: la masa que tapa el camión, cubierta de mechones por capas (de atrás y arriba hacia adelante y abajo). */
function pelaje(p: Pintura) {
  const masa = union(pol([FL.x - 3, FL.y - 22], [FR.x + 3, FR.y - 8], [FR.x + 2, FR.y + 2], [FC.x, FC.y + 2], [FL.x - 2, FL.y + 2]), el((FL.x + FR.x) / 2 - 6, BK.y - 22, 62, 34, 0.35), el(H.x - 4, H.y + 12, 34, 30));
  p.volumen(masa, PELO, { alto: 30, planos: true, borde: "oscuro" });
  // Mechones: filas de arriba hacia abajo; cada uno con su sombra sobre el de atrás.
  let k = 0;
  for (let fila = 0; fila < 12; fila++) {
    const t = fila / 11;
    // De la orilla de atrás-arriba a la orilla de adelante-abajo.
    const y0 = BK.y - 48 + t * (FL.y - BK.y + 44);
    for (let i = 0; i < 12; i++) {
      const u = (i + (fila % 2) * 0.5) / 11;
      const x = FL.x + 4 + u * (FR.x - FL.x - 12) + t * 10 + Math.sin(i * 5.1 + fila * 1.7) * 3;
      const y = y0 + u * (FR.y - FL.y) * 0.7 + Math.sin(i * 2.3 + fila) * 2;
      const forma = mechon(x, y, Math.PI / 2 + 0.75 - u * 0.4 + Math.sin(i * 2.7 + fila) * 0.25, 9 + ((i * 7 + fila) % 5), 5.5 + ((i + fila) % 3));
      if (forma.d(x + OX, y + OY) > 0) continue;
      k++;
      p.volumen(forma, fila < 2 ? PELO3 : k % 4 === 0 ? PELO2 : PELO, { alto: 5, planos: true, borde: "propio", sombra: 0.3 });
    }
  }
}

/** Un rostro tallado en madera naranja: cejas, ojos hondos con pupila, nariz y la boca abierta con dientes. */
function tallado(p: Pintura, x: number, y: number, r: number, color: Ramp) {
  p.volumen(el(x, y, r, r * 1.25), color, { alto: r * 0.6, planos: true, borde: "oscuro", sombra: 0.4 });
  // Las cejas: un bloque que sobresale.
  p.volumen(cap(x - r * 0.65, y - r * 0.38, x + r * 0.65, y - r * 0.38, r * 0.2), color, { alto: 2, base: 0.8, planos: true, borde: "oscuro", sombra: 0.4 });
  for (const l of [-1, 1]) {
    p.volumen(el(x + l * r * 0.38, y - r * 0.08, r * 0.24, r * 0.18), color, { alto: 2, base: -2, borde: "oscuro" });
    p.plano(ci(x + l * r * 0.38, y - r * 0.06, Math.max(1, r * 0.09)), tono(rampa("#fff2a0"), 4));
  }
  p.volumen(pol([x, y - r * 0.1], [x - r * 0.18, y + r * 0.32], [x + r * 0.18, y + r * 0.32]), color, { alto: 2, base: 0.6, planos: true, borde: "oscuro", sombra: 0.4 });
  p.volumen(el(x, y + r * 0.72, r * 0.5, r * 0.3), BOCA, { alto: 2, base: -0.6, borde: "oscuro" });
  for (let k = -2; k <= 2; k++) p.plano(el(x + k * r * 0.17, y + r * 0.55, r * 0.06, r * 0.1), tono(DIENTE, 4));
}

/** Un engranaje de metal con dientes cuadrados, rayos y el perno del centro. */
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
      return hueco ? 1 : d - (r + (diente ? 3 : 0));
    },
    x0: cx - r - 4,
    y0: cy - r - 4,
    x1: cx + r + 4,
    y1: cy + r + 4,
  };
  p.volumen(forma, metal, { alto: 3, brillo: 0.9, planos: true, borde: "oscuro", sombra: 0.4 });
  p.volumen(circulo(cx, cy, r * 0.28), metal, { alto: 2, base: 0.8, brillo: 1, borde: "oscuro" });
  p.plano(circulo(cx, cy, Math.max(1, r * 0.1)), tono(metal, 0));
}

/** Una mano morada gigante (palma, cinco dedos gruesos con nudillos y uñas rosadas) que agarra desde abajo. */
function mano(p: Pintura, x: number, y: number, lado: -1 | 1) {
  p.volumen(cap(x - lado * 26, y + 6, x - lado * 4, y + 2, 9, 8), MORADO, { alto: 6, planos: true, borde: "oscuro" });
  p.volumen(el(x, y, 10, 8, lado * 0.3), MORADO, { alto: 6, planos: true, borde: "oscuro" });
  for (let k = 0; k < 4; k++) {
    const bx = x + lado * (3 + k * 1.5) + (k - 1.5) * 1.4;
    const by = y - 4 - k * 0.6;
    const ang = -Math.PI / 2 + lado * (0.55 - k * 0.12);
    const mx = bx + Math.cos(ang) * 8;
    const my = by + Math.sin(ang) * 8;
    const a2 = ang + lado * 0.7;
    const tx = mx + Math.cos(a2) * 7;
    const ty = my + Math.sin(a2) * 7;
    p.volumen(cap(bx, by, mx, my, 3.6, 3.3), MORADO, { alto: 2.5, planos: true, borde: "oscuro", sombra: 0.35 });
    p.volumen(cap(mx, my, tx, ty, 3.3, 2.8), MORADO, { alto: 2.5, planos: true, borde: "oscuro", sombra: 0.35 });
    curvaP(p, mx - 2, my - 1, mx, my - 2, mx + 2, my - 1, tono(MORADO, 1), 1);
    p.volumen(el(tx + Math.cos(a2) * 1.6, ty + Math.sin(a2) * 1.6, 2.4, 1.8, a2), UNA, { alto: 1.4, brillo: 0.9, borde: "oscuro" });
  }
  // El pulgar por delante.
  p.volumen(cap(x - lado * 6, y + 2, x - lado * 2, y - 9, 3.8, 3.2), MORADO, { alto: 2.5, base: 0.5, planos: true, borde: "oscuro", sombra: 0.4 });
  p.volumen(el(x - lado * 1.6, y - 11, 2.4, 1.9), UNA, { alto: 1.4, brillo: 0.9, borde: "oscuro" });
}

/** La cara del monstruo: la máscara rosada y roja, ojos amarillos, cejas pobladas, orejas, hocico y la boca que ruge. */
function cara(p: Pintura) {
  const { x, y } = H;
  // La cabeza de pelaje y las orejas.
  p.volumen(el(x - 2, y - 2, 34, 31), PELO, { alto: 18, planos: true, borde: "oscuro" });
  for (const l of [-1, 1]) {
    p.volumen(el(x + l * 31, y - 2, 7, 10), CARA, { alto: 4, planos: true, borde: "oscuro", sombra: 0.35 });
    p.volumen(el(x + l * 31, y - 1, 3.5, 6), rampa("#b8304a"), { alto: 2, borde: false });
  }
  // Mechones alrededor de la cara (la melena).
  for (let k = 0; k < 14; k++) {
    const a = Math.PI * 0.95 + (k / 13) * Math.PI * 1.1;
    p.volumen(mechon(x - 2 + Math.cos(a) * 26, y - 2 + Math.sin(a) * 24, a, 12, 5), [PELO, PELO3, PELO2][k % 3]!, { alto: 3, planos: true, borde: "oscuro", sombra: 0.3 });
  }
  // La máscara rosada (en forma de corazón) con su sombra del lado derecho.
  const mascara = union(el(x - 9, y - 4, 13, 14), el(x + 8, y - 4, 13, 14), el(x, y + 9, 19, 15));
  p.volumen(mascara, CARA, { alto: 10, planos: true, borde: "oscuro", sombra: 0.4 });
  // Los ojos grandes y amarillos.
  for (const [ex, l] of [
    [x - 9, -1],
    [x + 9, 1],
  ] as const) {
    const [cx, cy] = P(ex, y - 5);
    ojo(p, cx, cy, 14, 6, 4.4, l, { iris: rampa("#f7c21c"), pestanas: 0, mira: 1.4 });
  }
  // Las cejas pobladas: mechones azules que se paran.
  for (const l of [-1, 1]) for (let k = 0; k < 4; k++) p.volumen(mechon(x + l * (4 + k * 4), y - 13 + k * 0.6, -Math.PI / 2 + l * (0.5 + k * 0.15), 7, 2.6), PELO3, { alto: 1.5, planos: true, borde: "oscuro" });
  // El hocico con la nariz y las ventanas.
  p.volumen(el(x, y + 9, 15, 9), HOCICO, { alto: 6, planos: true, borde: "oscuro", sombra: 0.35 });
  p.volumen(el(x, y + 3, 6, 3.6), rampa("#c8405a"), { alto: 2, brillo: 0.9, borde: "oscuro" });
  for (const l of [-1, 1]) p.plano(el(x + l * 2.4, y + 4, 1.4, 1), tono(BOCA, 1));
}

/** La boca que ruge: arriba la encía con los dientes y los colmillos; la quijada aparte (se abre). */
function bocaArriba(p: Pintura) {
  const { x, y } = H;
  p.volumen(el(x, y + 16, 15, 6), BOCA, { alto: 3, base: -0.6, borde: "oscuro" });
  for (let k = -4; k <= 4; k++) p.volumen(el(x + k * 3, y + 13.5 + Math.abs(k) * 0.3, 1.5, 2.4), DIENTE, { alto: 1, brillo: 0.9, borde: "oscuro" });
  for (const l of [-1, 1]) p.volumen(pol([x + l * 7.5, y + 12], [x + l * 11, y + 12], [x + l * 9.6, y + 22]), DIENTE, { alto: 1.6, brillo: 1, planos: true, borde: "oscuro" });
}
function quijada(p: Pintura) {
  const { x, y } = H;
  p.volumen(el(x, y + 24, 16, 8), HOCICO, { alto: 5, planos: true, borde: "oscuro" });
  p.volumen(el(x, y + 20, 12, 4.5), BOCA, { alto: 2, base: -0.6, borde: "oscuro" });
  p.volumen(el(x + 1, y + 20.5, 7, 3), LENGUA, { alto: 2, brillo: 0.8, borde: false });
  for (let k = -3; k <= 3; k++) p.volumen(el(x + k * 3, y + 18 - Math.abs(k) * 0.3, 1.4, 2), DIENTE, { alto: 1, brillo: 0.9, borde: "oscuro" });
  for (const l of [-1, 1]) p.volumen(pol([x + l * 9, y + 21], [x + l * 12, y + 21], [x + l * 10.4, y + 13]), DIENTE, { alto: 1.4, brillo: 1, planos: true, borde: "oscuro" });
}

/** La cresta naranja: una llamarada de pelo, lenguas de fuego hacia atrás. */
function cresta(p: Pintura) {
  const { x, y } = H;
  for (let k = 0; k < 11; k++) {
    const bx = x - 4 - k * 4.4;
    const by = y - 30 + k * 0.6 + Math.abs(k - 3) * 0.8;
    const ang = -Math.PI / 2 - 0.45 - k * 0.06;
    const L = 22 - Math.abs(k - 3) * 1.4;
    p.volumen(mechon(bx, by, ang, L, 5.2), FUEGO[k % FUEGO.length]!, { alto: 3, planos: true, borde: "oscuro", sombra: 0.35 });
    p.volumen(mechon(bx + 1, by - 2, ang + 0.15, L * 0.55, 2.6), FUEGO[3]!, { alto: 1.5, base: 0.6, planos: true, borde: false });
  }
}

/** Los tubos de metal que salen de la nuca, con sus anillos de bronce. Devuelve las bocas (para el humo). */
function tubos(p: Pintura): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const [dx, h, a] of [
    [-30, 44, -0.3],
    [-20, 54, -0.12],
    [-40, 34, -0.45],
  ] as const) {
    const b = { x: H.x + dx, y: H.y - 22 };
    const t = { x: b.x + Math.sin(a) * h, y: b.y - Math.cos(a) * h };
    p.volumen(cap(b.x, b.y, t.x, t.y, 4.2), METAL, { alto: 3, brillo: 0.95, planos: true, borde: "oscuro", sombra: 0.35 });
    for (let k = 1; k <= 3; k++) {
      const q = { x: b.x + (t.x - b.x) * (k / 4), y: b.y + (t.y - b.y) * (k / 4) };
      p.volumen(el(q.x, q.y, 5.4, 2.4, a), BRONCE, { alto: 1.5, brillo: 0.9, planos: true, borde: "oscuro" });
    }
    p.volumen(el(t.x, t.y, 6, 3, a), BRONCE, { alto: 2, brillo: 0.9, planos: true, borde: "oscuro" });
    p.plano(el(t.x, t.y, 3.4, 1.4, a), tono(METAL, 0));
    out.push(t);
  }
  return out;
}

export function monstruo(): CarrozaArte {
  const s = escena(LARGO, 20);
  plataforma(s, LARGO, { faldon: zigzag([PELO, MORADO, FUEGO[1]!, METAL]), cubierta: () => tono(PELO2, 2), flecos: [PELO, MORADO, FUEGO[0]!] }, false);
  const f = fig();
  const partes: Parte[] = [parteBase(s)];

  // Atrás: las máscaras escalonadas en capas.
  const atras = f.lienzo();
  tallado(atras, BK.x + 4, BK.y - 64, 9, rampa("#3db842"));
  tallado(atras, BK.x + 22, BK.y - 76, 8, rampa("#d0287a"));
  tallado(atras, BK.x - 10, BK.y - 46, 8, TALLA[1]!);
  partes.push(f.parte("mascaras", atras, ...P(BK.x, BK.y - 40), { mov: { vaiven: { dy: -1, periodo: 2400 } } }));

  // Los engranajes (detrás de la cabeza) y los tubos con el humo.
  const engs: [number, number, number, Ramp, 1 | -1, number][] = [
    [H.x - 62, H.y - 44, 17, BRONCE, 1, 7000],
    [H.x - 36, H.y - 56, 11, METAL, -1, 4600],
    [H.x - 84, H.y - 26, 12, rampa("#d0287a"), -1, 5600],
  ];
  engs.forEach(([x, y, r, m, sentido, periodo], k) => {
    const p = f.lienzo();
    engranaje(p, x, y, r, m);
    partes.push(f.parte(`engranaje-${k}`, p, ...P(x, y), { padre: "cuerpo", mov: { rueda: { periodo, sentido } } }));
  });
  const ptub = f.lienzo();
  const bocas = tubos(ptub);

  // El cuerpo: el pelaje y los rostros tallados del costado.
  const cuerpo = f.lienzo();
  pelaje(cuerpo);
  const a0 = pantalla(LARGO * 0.18, ANCHO + 1, 14);
  const a1 = pantalla(LARGO * 0.38, ANCHO + 1, 18);
  const a2 = pantalla(LARGO * 0.58, ANCHO + 1, 12);
  tallado(cuerpo, a0.x, a0.y, 10, TALLA[0]!);
  tallado(cuerpo, a1.x, a1.y, 11, TALLA[1]!);
  tallado(cuerpo, a2.x, a2.y, 9, TALLA[2]!);
  partes.push(f.parte("cuerpo", cuerpo, ...P(FC.x - 20, FC.y), { mov: { gira: { amp: 0.006, periodo: 5200 } } }));
  partes.push(f.parte("tubos", ptub, ...P(H.x, H.y), { padre: "cabeza" }));
  bocas.forEach((b, k) => {
    const p = f.lienzo();
    const col = [rampa("#f6b8d8"), rampa("#b8e8f6"), rampa("#f6e8a8")][k]!;
    p.volumen(union(el(b.x, b.y - 7, 8, 6.5), el(b.x + 6, b.y - 11, 6, 5.5), el(b.x - 6, b.y - 10, 5.5, 5)), col, { alto: 3, planos: true, borde: "oscuro" });
    partes.push(f.parte(`humo-${k}`, p, ...P(b.x, b.y - 6), { mov: { sube: { dx: 6, dy: -26, periodo: 2600, fase: k / 3, crece: 0.9 } } }));
  });

  // La cabeza: cresta, cara, boca de arriba; los párpados y la quijada aparte.
  const cab = f.lienzo();
  cresta(cab);
  cara(cab);
  bocaArriba(cab);
  partes.push(f.parte("cabeza", cab, ...P(H.x - 6, H.y + 26), { padre: "cuerpo", mov: { gira: { amp: 0.05, periodo: 3700 } } }));
  const parp = f.lienzo();
  for (const [ex, l] of [
    [H.x - 9, -1],
    [H.x + 9, 1],
  ] as const) {
    const [cx, cy] = P(ex, H.y - 5);
    parpado(parp, cx, cy, 14, 6, 4.4, l, CARA);
  }
  partes.push(f.parte("parpados", parp, ...P(H.x - 6, H.y + 26), { padre: "cabeza", contorno: false, mov: { parpadeo: { cada: 3300, dura: 190 } } }));
  const qui = f.lienzo();
  quijada(qui);
  partes.push(f.parte("quijada", qui, ...P(H.x, H.y + 14), { padre: "cabeza", mov: { vaiven: { dy: 2.2, periodo: 1100 } } }));

  // Al frente: la máscara de dientes de oro y las dos manos moradas que la sostienen.
  const M = { x: FC.x + 16, y: FC.y - 36 };
  const man = f.lienzo();
  const masc = union(el(M.x, M.y, 13, 15), el(M.x, M.y + 9, 9, 8));
  man.volumen(masc, rampa("#f4ead8"), { alto: 8, planos: true, borde: "oscuro", sombra: 0.4 });
  for (const l of [-1, 1]) {
    man.volumen(el(M.x + l * 5.4, M.y - 3, 4, 3.4), rampa("#3a2a5a"), { alto: 2, base: -1, borde: "oscuro" });
    man.plano(ci(M.x + l * 5.4, M.y - 2.6, 1.2), tono(rampa("#f7c21c"), 4));
  }
  man.volumen(pol([M.x, M.y + 2], [M.x - 2.4, M.y + 6], [M.x + 2.4, M.y + 6]), rampa("#3a2a5a"), { alto: 1, borde: "oscuro" });
  for (let k = -3; k <= 3; k++) man.volumen(el(M.x + k * 2.6, M.y + 11, 1.2, 2.2), ORO, { alto: 1, brillo: 1, borde: "oscuro" });
  mano(man, M.x - 15, M.y + 10, -1);
  mano(man, M.x + 15, M.y + 12, 1);
  partes.push(f.parte("manos", man, ...P(M.x, M.y + 10), { padre: "cuerpo", mov: { vaiven: { dy: -2.5, periodo: 2600 } } }));
  void [BRILLO, LINEA, ANCHO];
  return { largo: LARGO, partes, luces: [], marco: { x0: -ANCHO - 40, x1: LARGO + 40 } };
}
