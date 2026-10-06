// El Cóndor de los Andes (pixel art pintado): el cóndor monumental posado sobre las montañas de colores
// de la cordillera (franjas como los cultivos, con la nieve en las puntas) y las nubes de algodón que
// tapan el camión. Negro, con el collar blanco de plumón, la cabeza roja y arrugada, el pico de marfil
// abierto y el pecho bordado de colores; las alas abiertas (aletean) van del plumaje blanco y gris al
// arcoíris en las puntas. En su lomo, entre las alas, bailan los danzantes con sus tocados de plumas.
import type { Ramp, RGBA } from "../pixel";
import { BRILLO, Figura, ojo, parpado, pluma } from "./figuras";
import { danzante, hash } from "./guirnaldas";
import type { CarrozaArte, Parte } from "./partes";
import { ANCHO, escena, ORO, pantalla, parteBase, plataforma, rombosAndinos } from "./plataforma";
import { capsula, circulo, elipse, Pintura, poligono, rampa, tono, union, type Forma } from "./pintura";

const LARGO = 112;
const NEGRO = rampa("#34303e");
const GRIS = rampa("#b8b8c8");
const BLANCO = rampa("#f2eee8");
const CABEZA = rampa("#d8505a");
const CARNE = rampa("#e8907a");
const PICO = rampa("#ece2cc");
const BOCA = rampa("#c8283a");
const IRIS = rampa("#b8681c");
const GARRA = rampa("#d8a84a");
/** Las franjas de las montañas y los colores de las plumas (rojo a morado). */
const ARCO = ["#e0283c", "#f2711c", "#f7c518", "#3db842", "#1fb8b0", "#2f6fd6", "#8a3cc8"].map(rampa);
const NUBE = rampa("#f4f4fa");
const NIEVE = rampa("#f6f6fc");
const ROJO = rampa("#c8243a");
const PIELES = [rampa("#d89868"), rampa("#b87a4a"), rampa("#8a5a3a")];

const OX = 100;
const OY = 140;
const fig = () => new Figura(270, 250, OX, OY, [0, 0, 0]);
const P = (x: number, y: number): [number, number] => [x + OX, y + OY];
const curvaP = (p: Pintura, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, c: RGBA, g = 1) => p.curva(x0 + OX, y0 + OY, cx + OX, cy + OY, x1 + OX, y1 + OY, c, g);
const pol = (...pts: [number, number][]) => poligono(pts.map(([x, y]) => P(x, y)));
const el = (x: number, y: number, rx: number, ry: number, a = 0) => elipse(x + OX, y + OY, rx, ry, a);
const ci = (x: number, y: number, r: number) => circulo(x + OX, y + OY, r);
const cap = (ax: number, ay: number, bx: number, by: number, ra: number, rb = ra) => capsula(ax + OX, ay + OY, bx + OX, by + OY, ra, rb);

const FL = pantalla(0, ANCHO, 0);
const FC = pantalla(LARGO, ANCHO, 0);
const FR = pantalla(LARGO, 0, 0);
/** El centro del cuerpo del cóndor. */
const B = { x: 38, y: -4 };
/** El centro de la cabeza. */
const C = { x: B.x + 40, y: B.y - 30 };
/** Los hombros de las alas (la de atrás y la de adelante). */
const HA = { x: B.x - 12, y: B.y - 22 };
const HD = { x: B.x + 12, y: B.y - 26 };

/**
 * Una montaña de colores: la cara de la luz y la de la sombra separadas por la cresta, las franjas
 * onduladas de los cultivos y la nieve que chorrea desde la punta.
 */
function monte(p: Pintura, x: number, by: number, w: number, h: number, fase: number) {
  const punta: [number, number] = [x, by - h];
  const cresta: [number, number] = [x + w * 0.1, by];
  const franja = (q: { x: number; y: number }) => {
    const yy = by - (q.y - OY);
    const k = Math.floor(yy / (h / 5.5) + Math.sin((q.x - OX) * 0.35 + fase) * 0.35);
    return ARCO[(((k + fase) % ARCO.length) + ARCO.length) % ARCO.length]!;
  };
  const nieve = (q: { x: number; y: number }, c: RGBA): RGBA | null => {
    const xx = q.x - OX;
    const yy = q.y - OY;
    const borde = by - h * 0.72 + Math.abs(Math.sin(xx * 0.9 + fase)) * h * 0.1;
    if (yy < borde) return tono(NIEVE, c[0] + c[1] + c[2] > 420 ? 5 : 3);
    // Las rayitas de la siembra.
    return (Math.floor(xx) + Math.floor(yy) * 3) % 7 === 0 ? [Math.round(c[0] * 0.85), Math.round(c[1] * 0.85), Math.round(c[2] * 0.85), 255] : null;
  };
  const hi: [number, number] = [x - w * 0.27, by - h * 0.52];
  const hd: [number, number] = [x + w * 0.29, by - h * 0.48];
  p.volumen(pol([x - w / 2, by], hi, punta, cresta), ARCO[0]!, { alto: 3, base: 0.6, planos: true, borde: "oscuro", patron: franja, pinta: nieve, sombra: 0.3 });
  p.volumen(pol(cresta, punta, hd, [x + w / 2, by]), ARCO[0]!, { alto: 3, base: -1.1, planos: true, borde: "oscuro", patron: franja, pinta: nieve });
}

/** Una nube de algodón: bolitas blancas apiñadas con la sombra azulita de abajo. */
function nube(p: Pintura, x: number, y: number, w: number, semilla: number) {
  const n = Math.max(3, Math.round(w / 5));
  let f: Forma = el(x, y, w / 2, 4);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const r = 3.6 + hash(i, semilla) * 2.6;
    f = union(f, ci(x - w / 2 + t * w, y - 1 - Math.sin(t * Math.PI) * 3 - hash(semilla, i) * 2, r));
  }
  p.volumen(f, NUBE, { alto: 4, planos: true, borde: "oscuro", brillo: 0.2, pinta: (q, c) => (q.y - OY > y + 1.5 ? tono(rampa("#c8d0e8"), 3) : c) });
}

/**
 * Un ala abierta, como la del cóndor que planea: el borde de adelante (negro, grueso en el hombro) sube
 * hacia afuera hasta la punta, y de él cuelgan las plumas largas, cada vez más largas y más abiertas hacia
 * la punta. Los colores van en franjas a lo largo del ala: el plumón blanco y gris junto al borde y luego
 * morado, azul, turquesa, verde, amarillo, naranja y rojo en las puntas. `lado` -1 abre a la izquierda.
 */
function ala(p: Pintura, h: { x: number; y: number }, lado: -1 | 1, envergadura: number) {
  const T = { x: h.x + lado * envergadura, y: h.y - envergadura * 0.62 };
  // El borde de adelante se arquea un poco hacia arriba.
  const arco = (t: number) => ({ x: h.x + (T.x - h.x) * t, y: h.y + (T.y - h.y) * t - Math.sin(t * Math.PI) * 9 });
  const dir = (a: number) => (lado > 0 ? a : Math.PI - a);
  const n = 16;
  // Las plumas largas, de la punta hacia el cuerpo (las de adentro quedan encima).
  for (let i = n - 1; i >= 0; i--) {
    const t = 0.08 + (i / (n - 1)) * 0.92;
    const b = arco(t);
    const a = dir(1.5 - Math.pow(t, 1.2) * 1.8);
    const largo = 34 + t * 6;
    const ancho = 11 - t * 1.5;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const f = elipse(b.x + ux * largo * 0.5 + OX, b.y + uy * largo * 0.5 + OY, largo / 2 + 1, ancho / 2, a);
    p.volumen(f, ARCO[0]!, {
      alto: 4,
      planos: true,
      borde: "oscuro",
      sombra: 0.3,
      brillo: 0.25,
      patron: (q) => {
        const along = ((q.x - OX - b.x) * ux + (q.y - OY - b.y) * uy) / largo;
        if (along < 0.2) return GRIS;
        const k = Math.floor((along - 0.2) * 8.6);
        return ARCO[Math.max(0, ARCO.length - 1 - k)]!;
      },
      pinta: (q, c) => {
        const along = (q.x - OX - b.x) * ux + (q.y - OY - b.y) * uy;
        const side = -(q.x - OX - b.x) * uy + (q.y - OY - b.y) * ux;
        if (Math.abs(side) < 0.6 && along < largo * 0.92) return [Math.min(255, c[0] + 45), Math.min(255, c[1] + 45), Math.min(255, c[2] + 45), 255];
        if ((((along - Math.abs(side) * 0.8) % 3) + 3) % 3 < 0.7 && Math.abs(side) > 1.4) return [Math.round(c[0] * 0.8), Math.round(c[1] * 0.8), Math.round(c[2] * 0.86), 255];
        return null;
      },
    });
  }
  // Las cobijas: dos filas de plumas blancas y grises sobre la base de las largas.
  for (const [fila, largo, col] of [
    [0, 24, GRIS],
    [1, 15, BLANCO],
  ] as const)
    for (let i = 11; i >= 0; i--) {
      const t = 0.04 + (i / 11) * 0.9;
      const b = arco(t);
      const a = dir(1.45 - Math.pow(t, 1.2) * 1.7);
      pluma(p, b.x + OX - Math.cos(a) * fila * 2, b.y + OY - Math.sin(a) * fila * 2, a, largo * (1 - t * 0.3), 10, (i + fila) % 2 ? col : fila ? GRIS : BLANCO, { brillo: 0.3 });
    }
  // El borde de adelante: negro, grueso en el hombro.
  for (let i = 0; i < 10; i++) {
    const a0 = arco(i / 10);
    const a1 = arco((i + 1) / 10);
    p.volumen(cap(a0.x, a0.y, a1.x, a1.y, 5 - i * 0.35, 5 - (i + 1) * 0.35), i < 3 ? NEGRO : BLANCO, { alto: 3, planos: true, borde: "oscuro", brillo: 0.4 });
  }
}

/** El cuerpo: el plumaje negro en escamas, el pecho bordado de colores y las patas que agarran la peña. */
function cuerpo(p: Pintura) {
  const forma = union(el(B.x, B.y + 4, 33, 26, -0.3), el(B.x + 20, B.y - 14, 18, 15, -0.5), el(B.x - 22, B.y + 12, 14, 10, 0.4));
  p.volumen(forma, NEGRO, {
    alto: 18,
    planos: true,
    borde: "oscuro",
    brillo: 0.3,
    pinta: (q, c) => {
      const xx = q.x - OX;
      const yy = q.y - OY;
      // Las plumas en escamas (medias lunas).
      const fila = Math.floor(yy / 5);
      const u = (((xx + (fila % 2) * 3) % 6) + 6) % 6;
      const v = ((yy % 5) + 5) % 5;
      const d = Math.hypot(u - 3, v + 0.5);
      if (d > 3.4 && d < 4.4 && v > 1.5) return [Math.round(c[0] * 0.66), Math.round(c[1] * 0.66), Math.round(c[2] * 0.72), 255];
      if (d < 1.6) return [Math.min(255, c[0] + 34), Math.min(255, c[1] + 34), Math.min(255, c[2] + 44), 255];
      return null;
    },
  });
  // El bordado del pecho: espirales, soles y pintas de colores, como el de la referencia andina.
  const col = [ARCO[2]!, ARCO[6]!, ARCO[3]!, ARCO[0]!, ARCO[4]!, ARCO[1]!];
  for (let k = 0; k < 6; k++) {
    const cx = B.x + 6 + (k % 3) * 8 + Math.floor(k / 3) * 3;
    const cy = B.y - 6 + Math.floor(k / 3) * 11 + (k % 2) * 2;
    const c = col[k]!;
    curvaP(p, cx - 3, cy + 2, cx - 3, cy - 3, cx + 1, cy - 3, tono(c, 4), 1.2);
    curvaP(p, cx + 1, cy - 3, cx + 4, cy - 1, cx + 1, cy + 1, tono(c, 4), 1.2);
    p.plano(ci(cx, cy - 0.5, 0.9), tono(col[(k + 2) % 6]!, 4));
  }
  // Un sol bordado.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    p.trazo(...P(B.x + 2 + Math.cos(a) * 2.6, B.y + 18 + Math.sin(a) * 2.6), ...P(B.x + 2 + Math.cos(a) * 5, B.y + 18 + Math.sin(a) * 5), tono(ARCO[2]!, 4), 1);
  }
  p.volumen(ci(B.x + 2, B.y + 18, 2.4), ARCO[0]!, { alto: 1, borde: "oscuro", brillo: 0.8 });
  // Las patas: los dedos dorados que agarran la peña.
  for (const dx of [-6, 10]) for (let k = -1; k <= 1; k++) p.volumen(cap(B.x + dx, B.y + 28, B.x + dx + k * 4, B.y + 35, 2, 1.6), GARRA, { alto: 1.5, borde: "oscuro", brillo: 0.6 });
}

/** La escala de la cabeza (todo lo de la cabeza se mide desde C en sus unidades). */
const KC = 1.4;
const cx = (d: number) => C.x + d * KC;
const cy = (d: number) => C.y + d * KC;
const kc = (r: number) => r * KC;

/** La cabeza: el collar blanco de plumón, la cabeza roja con arrugas, el ojo, el pico de marfil y la boca. */
function cabeza(p: Pintura) {
  // El collar de plumón: plumitas blancas en corona alrededor del cuello.
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2;
    p.volumen(el(cx(-7) + Math.cos(a) * kc(12), cy(9) + Math.sin(a) * kc(9.5), kc(5), kc(3.2), a), BLANCO, { alto: 2, planos: true, borde: "oscuro", sombra: 0.25 });
  }
  p.volumen(el(cx(-7), cy(9), kc(12), kc(9.5)), BLANCO, { alto: 4, planos: true, borde: false, pinta: (q, c) => ((q.x + q.y * 2) % 5 === 0 ? tono(GRIS, 3) : c) });
  // La cabeza calva, roja arriba y color carne hacia el pico, con las arrugas.
  const forma = union(el(cx(0), cy(0), kc(12), kc(10.5), -0.2), el(cx(-3), cy(6), kc(8), kc(6)));
  p.volumen(forma, CABEZA, {
    alto: 8,
    planos: true,
    borde: "oscuro",
    patron: (q) => (q.x - OX > cx(2) && q.y - OY > cy(-2) ? CARNE : CABEZA),
    pinta: (q, c) => (Math.floor((q.x - OX) * 0.5 + (q.y - OY)) % 4 === 0 && q.y - OY < cy(-3) ? [Math.round(c[0] * 0.8), Math.round(c[1] * 0.7), Math.round(c[2] * 0.75), 255] : null),
  });
  // La cresta carnosa encima, en lóbulos.
  p.volumen(union(el(cx(-4), cy(-10), kc(5), kc(3.2), -0.3), el(cx(1), cy(-11), kc(4.4), kc(3)), el(cx(6), cy(-9), kc(3.6), kc(2.4), 0.3)), CABEZA, { alto: 2, planos: true, borde: "oscuro", base: -0.4 });
  // El ojo café, grande y alegre, con su anillo rosado y la ceja.
  p.volumen(el(cx(2), cy(-3), kc(6), kc(5.2)), rampa("#f0b0a0"), { alto: 2, borde: false, base: 0.4 });
  ojo(p, ...P(cx(2), cy(-3)), kc(10), kc(4.6), kc(4), 1, { iris: IRIS, pestanas: 0, mira: 1.4 });
  curvaP(p, cx(-4), cy(-8), cx(2), cy(-11), cx(8), cy(-8), tono(CABEZA, 0), 1.6);
  // El pico de arriba: largo y ganchudo, de marfil, con la ventanita de la nariz.
  const pico = union(pol([cx(6), cy(-4)], [cx(19), cy(-3.5)], [cx(25), cy(1)], [cx(25), cy(9)], [cx(21), cy(6)], [cx(19), cy(4)], [cx(7), cy(5)]), el(cx(21), cy(1.5), kc(4.6), kc(4.4)));
  p.volumen(pico, PICO, { alto: 4, brillo: 0.9, planos: true, borde: "oscuro", sombra: 0.35 });
  p.volumen(el(cx(9), cy(0.5), kc(4), kc(4)), rampa("#c8b8a0"), { alto: 2, borde: false, base: -0.4 });
  p.plano(el(cx(12), cy(-0.5), kc(1.4), kc(0.9)), tono(rampa("#5a4a3a"), 2));
  // Lo rojo de la boca abierta, con la lengua.
  p.volumen(pol([cx(7), cy(5)], [cx(19), cy(4.5)], [cx(18), cy(11)], [cx(8), cy(10)]), BOCA, { alto: 2, borde: "oscuro", base: -0.5 });
  p.volumen(el(cx(12), cy(9), kc(4), kc(1.6)), rampa("#f08a9a"), { alto: 1, borde: false });
}

/** El pico de abajo (se abre al graznar). */
function picoAbajo(p: Pintura) {
  p.volumen(pol([cx(7), cy(9)], [cx(19), cy(8)], [cx(16), cy(13)], [cx(8), cy(12.5)]), PICO, { alto: 2, brillo: 0.8, planos: true, borde: "oscuro" });
}

export function condor(): CarrozaArte {
  const s = escena(LARGO, 20);
  plataforma(s, LARGO, { faldon: rombosAndinos(ARCO, ROJO), cubierta: (u, v) => tono(rampa("#3db842"), 3 + (Math.floor((u + v) / 5) % 2 ? 0.5 : -0.3)), flecos: [ROJO, rampa("#e6b02a")] }, false);
  const f = fig();
  const partes: Parte[] = [parteBase(s)];

  // Las montañas de atrás.
  const atras = f.lienzo();
  for (const [u, v, w, h, fz] of [
    [6, 6, 36, 36, 0],
    [24, 4, 38, 44, 2],
    [44, 4, 34, 36, 5],
    [64, 6, 38, 46, 4],
    [84, 6, 36, 40, 1],
    [102, 8, 30, 34, 6],
    [12, 22, 34, 32, 3],
    [92, 22, 34, 34, 2],
    [106, 26, 26, 26, 4],
  ] as const) {
    const q = pantalla(u, v, 0);
    monte(atras, q.x, q.y + 4, w, h, fz);
  }
  partes.push(f.parte("montes-atras", atras, ...P(0, 0)));

  // El ala de atrás (aletea), los danzantes en el lomo y el cuerpo.
  const aa = f.lienzo();
  ala(aa, HA, -1, 56);
  partes.push(f.parte("ala-izq", aa, ...P(HA.x, HA.y), { padre: "cuerpo", mov: { gira: { amp: 0.07, periodo: 2400 } } }));
  const lomo = f.lienzo();
  ([
    [B.x - 30, B.y - 26],
    [B.x - 14, B.y - 34],
    [B.x + 2, B.y - 38],
  ] as const).forEach(([x, y], i) =>
    danzante(lomo, ...P(x, y), 0.85, {
      piel: PIELES[i % 3]!,
      traje: [ARCO[6]!, ARCO[1]!, ARCO[4]!][i]!,
      traje2: [ARCO[2]!, ARCO[5]!, ARCO[0]!][i]!,
      plumas: [ARCO[(i * 2) % 7]!, ARCO[(i * 2 + 2) % 7]!, ARCO[(i * 2 + 4) % 7]!, ARCO[(i * 2 + 1) % 7]!],
      pelo: rampa("#2a1a22"),
      falda: i === 1,
    }),
  );
  partes.push(f.parte("danzantes", lomo, ...P(B.x - 14, B.y - 34), { padre: "cuerpo", mov: { vaiven: { dy: -1.8, periodo: 760 }, gira: { amp: 0.03, periodo: 1500 } } }));
  const cu = f.lienzo();
  cuerpo(cu);
  // Las flores y frutas de colores que llevan los danzantes en el lomo (el nido de la fiesta).
  for (let k = 0; k < 16; k++) cu.volumen(ci(B.x - 34 + (k % 8) * 6.4 + (k >= 8 ? 3 : 0), B.y - 27 + (k >= 8 ? 4 : 0) + Math.abs((k % 8) - 3.5) * 1.4, 3.4), ARCO[(k * 3) % 7]!, { alto: 2, borde: "oscuro", brillo: 0.7, sombra: 0.3 });
  partes.push(f.parte("cuerpo", cu, ...P(B.x, B.y + 30), { mov: { gira: { amp: 0.012, periodo: 4800 } } }));

  // El ala de adelante y la cabeza.
  const ad = f.lienzo();
  ala(ad, HD, 1, 50);
  partes.push(f.parte("ala-der", ad, ...P(HD.x, HD.y), { padre: "cuerpo", mov: { gira: { amp: 0.07, periodo: 2400, fase: 0.5 } } }));
  const cab = f.lienzo();
  cabeza(cab);
  partes.push(f.parte("cabeza", cab, ...P(C.x - 6, C.y + 14), { padre: "cuerpo", mov: { gira: { amp: 0.06, periodo: 3100 } } }));
  const pa = f.lienzo();
  picoAbajo(pa);
  partes.push(f.parte("pico", pa, ...P(cx(8), cy(9)), { padre: "cabeza", mov: { gira: { amp: 0.12, periodo: 1200, centro: 0.12 } } }));
  const parp = f.lienzo();
  parpado(parp, ...P(cx(2), cy(-3)), kc(10), kc(4.6), kc(4), 1, CABEZA);
  partes.push(f.parte("parpados", parp, ...P(C.x - 6, C.y + 14), { padre: "cabeza", contorno: false, mov: { parpadeo: { cada: 3000, dura: 190 } } }));

  // Adelante: las montañas que tapan las patas y las nubes de algodón de la orilla.
  const frente = f.lienzo();
  for (const [u, v, w, h, fz] of [
    [6, 36, 32, 24, 6],
    [24, 36, 36, 30, 3],
    [44, 38, 38, 36, 5],
    [64, 36, 36, 32, 6],
    [84, 36, 34, 28, 1],
    [102, 34, 30, 26, 2],
  ] as const) {
    const q = pantalla(u, v, 0);
    monte(frente, q.x, q.y + 4, w, h, fz);
  }
  for (let k = 0; k < 8; k++) {
    const t = (k + 0.5) / 8;
    nube(frente, FL.x + (FC.x - FL.x) * t, FL.y + (FC.y - FL.y) * t + 1, 16, k);
  }
  for (let k = 0; k < 3; k++) {
    const t = (k + 0.5) / 3;
    nube(frente, FC.x + (FR.x - FC.x) * t, FC.y + (FR.y - FC.y) * t + 1, 14, k + 9);
  }
  partes.push(f.parte("montes", frente, ...P(FC.x, FC.y)));

  void [BRILLO, ORO];
  return { largo: LARGO, partes, luces: [], marco: { x0: -ANCHO - 40, x1: LARGO + 40 } };
}
