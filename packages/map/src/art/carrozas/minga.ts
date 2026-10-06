// La Minga de la cosecha (pixel art pintado): la Pachamama sentada sobre el camión, de piel verde como el
// monte, que se ríe con la boca abierta y los ojos grandes, con la cara pintada de espirales y puntos
// blancos, la vincha tejida, las trenzas con chaquiras y un tocado enorme de plumas de todos los colores.
// Lleva collares de cuentas en filas y una ruana tejida de zigzag que se le abre en falda y tapa toda la
// plataforma. Con las dos manos sostiene una totuma llena de agua que se le derrama por el borde hasta la
// calle. Alrededor, la gente de la minga: un guagua con la canasta de papas, uno con las mazorcas, dos que
// saludan desde atrás, el maizal, las flores y el montón de papas.
// Todo de frente a la pantalla en 3/4 (la luz de arriba a la izquierda), en coordenadas de pantalla desde
// el origen de la carroza.
import type { Ramp, RGBA } from "../pixel";
import { abanico, BRILLO, ceja, cuentas, Figura, LINEA, mejilla, ojo, parpado, sonrisa } from "./figuras";
import { figurita, mazorca, papa } from "./munecos";
import type { CarrozaArte, Parte } from "./partes";
import { ANCHO, escena, pantalla, parteBase, plataforma, rombosAndinos } from "./plataforma";
import { capsula, circulo, corte, elipse, girada, Pintura, poligono, rampa, resta, tono, union, type Forma } from "./pintura";

const LARGO = 104;
const PIEL = rampa("#52b07c");
const PINTURA = rampa("#f6eed8");
const PELO = rampa("#4a2a1a");
const TOTUMA = rampa("#a8642c");
const AGUA = rampa("#3aa6ea");
const ESPUMA = rampa("#dff4ff");
const ROJO = rampa("#d8283a");
const NARANJA = rampa("#f2861c");
const AMARILLO = rampa("#f6c81c");
const VERDE = rampa("#3db842");
const HOJA = rampa("#3f9a3a");
const TURQUESA = rampa("#1fb8b0");
const AZUL = rampa("#2f6fd6");
const MORADO = rampa("#7a2ab8");
const MAGENTA = rampa("#d0287a");
const PAJA = rampa("#d0a24a");
const CANASTA = rampa("#c08a3a");
const IRIS = rampa("#8a4a1a");
const PAPA = rampa("#d8b070");
const PIELES = [rampa("#c98a5a"), rampa("#a86a3a"), rampa("#e0a878")];
/** Los colores del tejido de la ruana, en el orden de las bandas. */
const TEJIDO: readonly Ramp[] = [MAGENTA, NARANJA, MORADO, AMARILLO, TURQUESA, ROJO, AZUL, VERDE];
const PLUMAS: readonly Ramp[] = [ROJO, NARANJA, AMARILLO, VERDE, TURQUESA, AZUL, MORADO, MAGENTA];

const OX = 90;
const OY = 230;
const fig = () => new Figura(270, 340, OX, OY, [0, 0, 0]);
const P = (x: number, y: number): [number, number] => [x + OX, y + OY];
const curvaP = (p: Pintura, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, c: RGBA, g = 1) => p.curva(x0 + OX, y0 + OY, cx + OX, cy + OY, x1 + OX, y1 + OY, c, g);
const pol = (...pts: [number, number][]) => poligono(pts.map(([x, y]) => P(x, y)));
const el = (x: number, y: number, rx: number, ry: number, a = 0) => elipse(x + OX, y + OY, rx, ry, a);
const ci = (x: number, y: number, r: number) => circulo(x + OX, y + OY, r);
const cap = (ax: number, ay: number, bx: number, by: number, ra: number, rb = ra) => capsula(ax + OX, ay + OY, bx + OX, by + OY, ra, rb);
const pt = (p: Pintura, x: number, y: number, c: RGBA) => p.punto(Math.round(x + OX), Math.round(y + OY), c);

// Las esquinas de la cubierta en pantalla.
const TL = pantalla(0, ANCHO, 0);
const TC = pantalla(LARGO, ANCHO, 0);
const TR = pantalla(LARGO, 0, 0);
/** El centro de la cara. */
const H = { x: 28, y: -66 };
/** La totuma (centro de la boca). */
const T = { x: 54, y: -16 };

/** Una flor de cinco pétalos redondos. */
function flor(p: Pintura, x: number, y: number, r: number, petalo: Ramp, centro: Ramp) {
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    p.volumen(el(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, r * 0.62, r * 0.45, a), petalo, { alto: 1.5, brillo: 0.3, borde: "oscuro" });
  }
  p.volumen(ci(x, y, r * 0.42), centro, { alto: 1.2, brillo: 0.8, borde: "oscuro" });
}

/** Una hoja larga (de la base hacia `ang`), con la vena clara. */
function hoja(p: Pintura, x: number, y: number, ang: number, largo: number, ancho: number, r: Ramp = HOJA) {
  const cx = x + Math.cos(ang) * largo * 0.5;
  const cy = y + Math.sin(ang) * largo * 0.5;
  p.volumen(el(cx, cy, largo / 2, ancho / 2, ang), r, { alto: ancho * 0.4, planos: true, borde: "oscuro", sombra: 0.3 });
  curvaP(p, x + Math.cos(ang) * 2, y + Math.sin(ang) * 2, cx, cy, x + Math.cos(ang) * largo * 0.85, y + Math.sin(ang) * largo * 0.85, tono(r, 4), 1);
}

/** Una espiral pintada (la pintura de la cara). */
function espiral(p: Pintura, cx: number, cy: number, r: number, c: RGBA, vueltas = 1.6) {
  let px = cx;
  let py = cy;
  const n = 40;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const a = t * vueltas * Math.PI * 2;
    const x = cx + Math.cos(a) * r * t;
    const y = cy + Math.sin(a) * r * t * 0.9;
    p.trazo(px + OX, py + OY, x + OX, y + OY, c, 1);
    px = x;
    py = y;
  }
}

/** El tejido de zigzag de la ruana: bandas de colores con picos y rombitos, en coordenadas de pantalla. */
const tejido = (desde: number, ancho = 5) => (q: { x: number; y: number }) => {
  const x = q.x - OX;
  const y = q.y - OY;
  const zz = Math.abs((((x % 12) + 12) % 12) - 6) * 0.7;
  const k = Math.floor((y - desde + zz) / ancho);
  return TEJIDO[((k % TEJIDO.length) + TEJIDO.length) % TEJIDO.length]!;
};
/** Los puntitos y rombos bordados encima del tejido. */
const bordado = (desde: number, ancho = 5) => (q: { x: number; y: number }, c: RGBA): RGBA | null => {
  const x = q.x - OX;
  const y = q.y - OY;
  const zz = Math.abs((((x % 12) + 12) % 12) - 6) * 0.7;
  const f = (y - desde + zz) / ancho;
  const k = Math.floor(f);
  const r = f - k;
  // La línea oscura entre banda y banda.
  if (r < 0.16) return tono(MORADO, 0);
  // Rombitos claros en las bandas pares.
  if (k % 2 === 0 && Math.abs((((x + k * 3) % 8) + 8) % 8 - 4) + Math.abs(r - 0.58) * 6 < 1.4) return tono(PINTURA, 5);
  return c;
};

/** Atrás: el maizal de la derecha y las matas y flores de la izquierda. */
function atras(p: Pintura) {
  // Las matas de la izquierda (hojas grandes y flores).
  for (const [x, y, a, l] of [
    [-34, 22, -2.2, 26],
    [-30, 20, -1.7, 30],
    [-24, 20, -1.2, 24],
    [-38, 26, -2.6, 20],
    [-14, 14, -1.9, 26],
  ] as const)
    hoja(p, x, y, a, l, 8);
  flor(p, -36, 2, 4.5, MAGENTA, AMARILLO);
  flor(p, -26, -6, 4, NARANJA, ROJO);
  flor(p, -40, 14, 3.5, AMARILLO, NARANJA);
  flor(p, -16, -4, 3.6, ROJO, AMARILLO);
  // El maizal de la derecha: cañas con hojas largas, mazorcas amarillas y la espiga arriba.
  for (const [x, y, h, k] of [
    [70, 16, 56, 0],
    [84, 22, 62, 1],
    [96, 32, 54, 2],
    [62, 8, 46, 3],
    [104, 44, 42, 4],
  ] as const) {
    const top = y - h;
    p.volumen(cap(x, y, x + 2, top, 2.2, 1.4), HOJA, { alto: 1.5, planos: true, borde: "oscuro" });
    for (let j = 0; j < 4; j++) {
      const yy = y - h * (0.25 + j * 0.2);
      const l = j % 2 ? 1 : -1;
      hoja(p, x + 1, yy, -Math.PI / 2 + l * (1.0 - j * 0.12), 22 - j * 3, 5.5, k % 2 ? HOJA : VERDE);
    }
    mazorca(p, x + 3 + OX, y - h * 0.45 + OY, 17, AMARILLO, 0.35);
    if (k % 2 === 0) mazorca(p, x - 2 + OX, y - h * 0.3 + OY, 14, rampa("#f2a21c"), -0.4);
    // La espiga.
    for (let j = -1; j <= 1; j++) p.trazo(x + 2 + OX, top + OY, x + 2 + j * 4 + OX, top - 6 + OY, tono(PAJA, 4), 1);
  }
}

/** Una persona de la minga que saluda con los dos brazos arriba (detrás de la Pachamama). */
function saludando(f: Figura, id: string, x: number, y: number, k: number, fase: number): Parte {
  const p = f.lienzo();
  const s = 0.82;
  // El brazo de la izquierda también arriba.
  p.volumen(cap(x - 6, y - 25, x - 13, y - 37, 2), [MAGENTA, NARANJA][k % 2]!, { alto: 1.6, borde: "oscuro" });
  p.volumen(ci(x - 13.5, y - 38.5, 2), PIELES[k % 3]!, { alto: 1.4, borde: "oscuro" });
  const [cx, cy] = P(x, y);
  figurita(p, cx, cy, s, { piel: PIELES[k % 3]!, ropa: [MAGENTA, NARANJA][k % 2]!, sombrero: PAJA, pelo: PELO });
  return f.parte(id, p, cx, cy, { mov: { gira: { amp: 0.08, periodo: 1300 + k * 160, fase }, vaiven: { dy: -1.4, periodo: 650, fase } } });
}

/** La ruana que cae en falda sobre toda la plataforma, el torso con su ruana y los collares. */
function cuerpo(p: Pintura) {
  // La falda: de la cintura a las orillas de la cubierta (con el ruedo un poquito por fuera).
  const falda = union(pol([H.x - 32, -18], [H.x + 36, -18], [TR.x - 4, TR.y - 14], [TR.x + 2, TR.y + 2], [TC.x, TC.y + 3], [TL.x - 3, TL.y + 3], [TL.x + 2, TL.y - 8]), el(H.x + 4, 0, 46, 22));
  const desde = -20;
  p.volumen(falda, MAGENTA, {
    alto: 26,
    planos: true,
    borde: "oscuro",
    patron: tejido(desde, 6),
    pinta: (q, c) => {
      const x = q.x - OX;
      const y = q.y - OY;
      // El ruedo de flecos de colores, siguiendo la orilla de la cubierta.
      const orilla = x < TC.x ? TL.y + ((TC.y - TL.y) * (x - TL.x)) / (TC.x - TL.x) : TC.y + ((TR.y - TC.y) * (x - TC.x)) / (TR.x - TC.x);
      if (y > orilla - 1) return tono(TEJIDO[(Math.floor((x + 80) / 2) % TEJIDO.length + TEJIDO.length) % TEJIDO.length]!, Math.floor(x) % 2 ? 4 : 2);
      if (y > orilla - 3) return tono(AMARILLO, 4);
      // Los pliegues hondos que bajan de la cintura.
      const ang = Math.atan2(x - H.x, y + 30);
      const pl = (ang * 7 + 20) % 1;
      if (pl > 0.86) return mixTono(c, -2);
      return bordado(desde, 6)(q, c);
    },
  });
  // El torso: la ruana de arriba con los hombros redondos.
  const torso = union(pol([H.x - 10, -48], [H.x + 10, -48], [H.x + 32, -34], [H.x + 34, -12], [H.x - 32, -12], [H.x - 30, -34]), el(H.x - 25, -34, 9, 8), el(H.x + 26, -34, 9, 8));
  p.volumen(torso, MORADO, { alto: 16, planos: true, borde: "oscuro", sombra: 0.35, patron: tejido(-48, 5), pinta: bordado(-48, 5) });
  // El cuello.
  p.volumen(cap(H.x, -50, H.x, -40, 7.5, 8.5), PIEL, { alto: 4, planos: true, borde: "oscuro" });
  // Los collares de cuentas: filas que bajan, de colores alternados.
  const filas: readonly (readonly Ramp[])[] = [
    [ROJO, AMARILLO],
    [TURQUESA, PINTURA],
    [NARANJA, ROJO, AMARILLO],
    [TURQUESA, AZUL],
    [AMARILLO, MAGENTA],
  ];
  filas.forEach((cols, k) => {
    const w = 11 + k * 3.6;
    const y0 = -44 + k * 1.2;
    cuentas(p, H.x - w + OX, y0 + OY, H.x + OX, y0 + 10 + k * 3.2 + OY, H.x + w + OX, y0 + OY, 1.6, cols);
  });
  // Un dije de oro al centro.
  p.volumen(el(H.x, -24, 3.2, 4), AMARILLO, { alto: 2, brillo: 1, borde: "oscuro" });
}

/** Ajusta un color hacia más oscuro (k < 0) o más claro (k > 0). */
function mixTono(c: RGBA, k: number): RGBA {
  const f = k < 0 ? 1 + k * 0.17 : 1 + k * 0.14;
  return [Math.min(255, Math.round(c[0] * f)), Math.min(255, Math.round(c[1] * f)), Math.min(255, Math.round(c[2] * f)), 255];
}

/** La cabeza: la cara verde pintada, las trenzas, la vincha tejida, los aretes y la boca riéndose. */
function cabeza(p: Pintura) {
  const { x, y } = H;
  // Las trenzas (detrás de los hombros) con sus chaquiras.
  for (const l of [-1, 1]) {
    for (let k = 0; k < 6; k++) p.volumen(el(x + l * (19 + k * 0.6), y + 2 + k * 5.4, 3.6, 3.2, l * 0.3), PELO, { alto: 2, planos: true, borde: "oscuro" });
    p.volumen(ci(x + l * 23, y + 34, 2.2), [TURQUESA, ROJO][l > 0 ? 0 : 1]!, { alto: 1.4, brillo: 1, borde: "oscuro" });
  }
  // El pelo de arriba.
  p.volumen(el(x, y - 10, 21, 15), PELO, { alto: 6, planos: true, borde: "oscuro" });
  // La cara: el óvalo con el mentón redondo.
  const cara = union(el(x, y, 19, 20), el(x, y + 9, 14, 14));
  p.volumen(cara, PIEL, { alto: 12, planos: true, borde: "oscuro", brillo: 0.5 });
  // La mejilla en sombra del lado derecho.
  p.volumen(corte(cara, el(x + 20, y + 4, 9, 22)), PIEL, { alto: 6, base: -1.2, borde: false });
  // Las orejas con los aretes de chaquiras que cuelgan.
  for (const l of [-1, 1]) {
    p.volumen(el(x + l * 19, y + 2, 3.4, 5), PIEL, { alto: 2, planos: true, borde: "oscuro" });
    cuentas(p, x + l * 19.5 + OX, y + 6 + OY, x + l * 20 + OX, y + 10 + OY, x + l * 20 + OX, y + 14 + OY, 1.2, [AMARILLO, TURQUESA, ROJO]);
    p.volumen(pol([x + l * 17, y + 15], [x + l * 23, y + 15], [x + l * 20, y + 22]), ROJO, { alto: 1.4, brillo: 0.8, borde: "oscuro" });
  }
  // La pintura de la cara: espirales en las mejillas, puntos en la frente y una raya en la nariz.
  for (const l of [-1, 1]) {
    espiral(p, x + l * 11, y + 7, 4.4, tono(PINTURA, 5), 1.7);
    for (let k = 0; k < 3; k++) pt(p, x + l * (6 + k * 3), y + 15 + k * 0.6, tono(PINTURA, 5));
  }
  for (let k = -2; k <= 2; k++) pt(p, x + k * 3, y - 12 + Math.abs(k) * 0.6, tono(PINTURA, 5));
  p.plano(ci(x, y - 9, 1.4), tono(AMARILLO, 4));
  // Las mejillas rosadas.
  for (const l of [-1, 1]) mejilla(p, x + l * 11 + OX, y + 9 + OY, 4, 2.4, tono(rampa("#e86a7a"), 3));
  // Las cejas, los ojos grandes y la nariz.
  for (const l of [-1, 1] as const) ceja(p, x + l * 8 + OX, y - 6.5 + OY, 11, l, tono(PELO, 1), 1.6);
  ojos(p, false);
  p.volumen(union(el(x, y + 3, 2.6, 4.6), el(x, y + 6.5, 4.2, 2.4)), PIEL, { alto: 3, base: 0.4, brillo: 0.8, sombra: 0.35 });
  pt(p, x - 2, y + 7.5, tono(PIEL, 0));
  pt(p, x + 2, y + 7.5, tono(PIEL, 0));
  // La boca riéndose, bien abierta.
  sonrisa(p, x + OX, y + 13 + OY, 15, 6.5, rampa("#c8405a"));
  // La vincha tejida sobre la frente (un arco de rombos) con la flor turquesa al lado.
  const banda = corte(resta(el(x, y + 6, 22, 27), el(x, y + 12, 22, 27)), pol([x - 30, y - 40], [x + 30, y - 40], [x + 30, y - 8], [x - 30, y - 8]));
  p.volumen(banda, ROJO, {
    alto: 3,
    planos: true,
    borde: "oscuro",
    patron: (q) => {
      const u = q.x - OX - x;
      const k = Math.floor((u + 40) / 4);
      return [ROJO, TURQUESA, AMARILLO, MAGENTA][k % 4]!;
    },
    pinta: (q, c) => (Math.abs(((q.x - OX + 40) % 4) - 2) + Math.abs(q.y - OY - (y - 18 + Math.abs(q.x - OX - x) * 0.2)) < 1 ? tono(PINTURA, 5) : c),
  });
  flor(p, x - 18, y - 10, 4.2, TURQUESA, AMARILLO);
  flor(p, x - 22, y - 2, 2.8, NARANJA, ROJO);
}

/** Los ojos grandes, cafés (o los párpados, para el parpadeo). */
function ojos(p: Pintura, cerrados: boolean) {
  for (const l of [-1, 1] as const) {
    const [ex, ey] = P(H.x + l * 8, H.y - 1);
    if (cerrados) parpado(p, ex, ey, 11, 5, 4, l, PIEL);
    else ojo(p, ex, ey, 11, 5, 4, l, { iris: IRIS, pestanas: 3, mira: 0.6 });
  }
}

/** El tocado: plumas largas en abanico detrás de la cabeza, en dos capas de colores. */
function plumas(p: Pintura) {
  const [cx, cy] = P(H.x, H.y - 8);
  abanico(p, cx, cy, 14, 58, -Math.PI - 0.3, 0.02, 11, PLUMAS, 18);
  // Una corona chica de plumas cortas pegada a la vincha.
  abanico(p, cx, cy, 12, 30, -Math.PI + 0.2, -0.2, 9, [AMARILLO, TURQUESA, ROJO, NARANJA], 8);
}

/** Los brazos que sostienen la totuma de agua y el agua que se derrama hasta la calle. */
function manos(p: Pintura) {
  const izq = PIEL;
  // El brazo de la izquierda: del hombro baja y cruza por delante a sostener la totuma desde abajo.
  p.volumen(cap(H.x - 26, -32, H.x - 22, -8, 7, 6.5), MORADO, { alto: 4, planos: true, borde: "oscuro", patron: tejido(-40, 5) });
  p.volumen(cap(H.x - 22, -6, T.x - 12, -2, 5.6, 5), izq, { alto: 4, planos: true, borde: "oscuro", sombra: 0.35 });
  cuentas(p, H.x - 20 + OX, -12 + OY, H.x - 17 + OX, -6 + OY, H.x - 20 + OX, -1 + OY, 1.5, [AMARILLO, ROJO, TURQUESA]);
  // El brazo de la derecha: baja del hombro y agarra el borde.
  p.volumen(cap(H.x + 27, -32, T.x + 26, T.y - 8, 7, 6), MORADO, { alto: 4, planos: true, borde: "oscuro", patron: tejido(-40, 5) });
  // La totuma: media esfera de calabazo con su labio, un poquito ladeada hacia la calle.
  const lad = 0.2;
  const cuenco = girada(corte(el(T.x, T.y, 23, 18), pol([T.x - 30, T.y], [T.x + 30, T.y], [T.x + 30, T.y + 30], [T.x - 30, T.y + 30])), T.x + OX, T.y + OY, lad);
  p.volumen(cuenco, TOTUMA, {
    alto: 8,
    planos: true,
    borde: "oscuro",
    sombra: 0.4,
    // Las rayitas grabadas en el calabazo.
    pinta: (q, c) => (Math.abs(q.y - OY - T.y - 6 - (q.x - OX - T.x) * lad) < 0.6 || (Math.abs(((q.x - OX + 60) % 6) - 3) < 0.6 && q.y - OY - T.y - (q.x - OX - T.x) * lad > 7) ? tono(TOTUMA, 1) : c),
  });
  p.volumen(el(T.x, T.y, 23, 7.6, lad), TOTUMA, { alto: 2, base: 1, planos: true, borde: "oscuro" });
  // El agua adentro, con brillos.
  p.volumen(el(T.x, T.y, 19.5, 5.6, lad), AGUA, {
    alto: 2,
    planos: true,
    borde: false,
    pinta: (q, c) => ((q.x * 3 + q.y * 7) % 11 === 0 ? tono(ESPUMA, 5) : (q.x + q.y * 2) % 7 === 0 ? tono(AGUA, 5) : c),
  });
  // Las manos verdes: la de la izquierda por debajo y la de la derecha en el borde, con los dedos.
  p.volumen(el(T.x - 15, T.y + 12, 7.5, 5.5, -0.3), izq, { alto: 3, planos: true, borde: "oscuro", sombra: 0.35 });
  for (let k = 0; k < 4; k++) p.volumen(cap(T.x - 11 + k * 3, T.y + 11, T.x - 9 + k * 3.2, T.y + 5, 1.8, 1.6), izq, { alto: 1.4, planos: true, borde: "oscuro" });
  p.volumen(el(T.x + 23, T.y - 2, 5.8, 7.4, 0.2), izq, { alto: 3, planos: true, borde: "oscuro", sombra: 0.35 });
  for (let k = 0; k < 3; k++) p.volumen(cap(T.x + 19, T.y - 5 + k * 3.2, T.x + 16, T.y - 4 + k * 3.4, 1.7, 1.5), izq, { alto: 1.2, planos: true, borde: "oscuro" });
  cuentas(p, T.x + 26 + OX, T.y - 11 + OY, T.x + 29 + OX, T.y - 8 + OY, T.x + 28 + OX, T.y - 4 + OY, 1.5, [ROJO, AMARILLO, TURQUESA]);
  // El chorro que se derrama por el labio de la derecha y cae hasta la calle, abriéndose en gotas.
  const x0 = T.x + 21;
  const y0 = T.y + 6;
  const fondo = 94;
  const pts: [number, number][] = [];
  const der: [number, number][] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const y = y0 + (fondo - y0) * t;
    const x = x0 + t * 10 + Math.sin(t * 7) * 1.2;
    const w = 1.6 + t * 5.5;
    pts.push([x - w, y]);
    der.unshift([x + w, y]);
  }
  p.volumen(pol(...pts, ...der), AGUA, {
    alto: 3,
    planos: true,
    borde: false,
    pinta: (q, c) => {
      const y = q.y - OY;
      const x = q.x - OX;
      const t = (y - y0) / (fondo - y0);
      // Las vetas blancas que bajan y la espuma que se deshace abajo.
      if (Math.abs(((x - t * 10 + 40) % 4) - 2) < 0.6) return tono(ESPUMA, 4);
      if (t > 0.55 && (q.x * 5 + q.y * 3) % 7 < 3) return null;
      if ((q.x * 7 + q.y * 5) % 13 === 0) return BRILLO;
      return c;
    },
  });
  // Las gotas sueltas alrededor del chorro y el charquito que salpica abajo.
  for (const [dx, dy, r] of [
    [-6, 40, 1.4],
    [9, 52, 1.6],
    [-9, 66, 1.4],
    [14, 74, 1.2],
    [-3, 78, 1.2],
    [17, 84, 1.4],
  ] as const)
    p.volumen(ci(x0 + dx + 4, y0 + dy, r), ESPUMA, { alto: 1, brillo: 1, borde: false });
}

/** Unas gotas que caen del borde de la totuma (se mueven solas). */
function gotas(p: Pintura) {
  const x0 = T.x + 22;
  const y0 = T.y + 8;
  for (const [dx, dy, r] of [
    [0, 0, 1.8],
    [3, 4, 1.4],
    [-2, 6, 1.2],
    [2, -3, 1.1],
  ] as const) {
    p.volumen(ci(x0 + dx, y0 + dy, r), AGUA, { alto: 1, brillo: 1, borde: false });
    pt(p, x0 + dx - 0.4, y0 + dy - 0.6, BRILLO);
  }
}

/** Una canasta tejida llena de papas (la lleva el guagua de adelante). */
function canasta(p: Pintura, x: number, y: number) {
  for (const [dx, dy, r] of [
    [-6, -9, 3.4],
    [0, -10.5, 3.6],
    [6, -9, 3.4],
    [-3, -12.5, 3.2],
    [3.5, -13, 3.2],
    [0, -15.5, 3],
  ] as const)
    papa(p, x + dx + OX, y + dy + 3 + OY, r, PAPA);
  const cuerpo = union(corte(el(x, y - 6, 11, 9), pol([x - 14, y - 6], [x + 14, y - 6], [x + 14, y + 6], [x - 14, y + 6])), el(x, y - 6, 11, 3));
  p.volumen(cuerpo, CANASTA, {
    alto: 4,
    planos: true,
    borde: "oscuro",
    sombra: 0.35,
    // El tejido de la canasta: cruces.
    pinta: (q, c) => ((q.x + q.y) % 3 === 0 || (q.x - q.y + 300) % 3 === 0 ? tono(CANASTA, 2) : c),
  });
  p.volumen(resta(el(x, y - 6, 11, 3.2), el(x, y - 6.5, 9, 2)), CANASTA, { alto: 1.5, base: 0.8, borde: "oscuro" });
}

/** El guagua de adelante con la canasta de papas y las flores de la orilla. */
function ninoPapas(f: Figura): Parte {
  const p = f.lienzo();
  for (const [x, y, c] of [
    [-38, 26, MAGENTA],
    [-30, 30, AMARILLO],
    [-2, 40, NARANJA],
    [6, 44, MAGENTA],
  ] as const) {
    hoja(p, x - 3, y + 1, -2.4, 9, 4);
    hoja(p, x + 3, y + 1, -0.7, 9, 4);
    flor(p, x, y - 2, 3.6, c, AMARILLO);
  }
  const x = -14;
  const y = 36;
  const [cx, cy] = P(x, y);
  figurita(p, cx, cy, 0.86, { piel: PIELES[0]!, ropa: rampa("#e0283c"), sombrero: PAJA, pelo: PELO });
  canasta(p, x + 6, y - 14);
  return f.parte("guagua-papas", p, cx, cy, { mov: { gira: { amp: 0.06, periodo: 1700 }, vaiven: { dy: -1.2, periodo: 850 } } });
}

/** El de las mazorcas (a la derecha) y el montón de papas a sus pies. */
function ninoMaiz(f: Figura): Parte {
  const p = f.lienzo();
  const x = 90;
  const y = 44;
  const [cx, cy] = P(x, y);
  figurita(p, cx, cy, 0.86, { piel: PIELES[1]!, ropa: rampa("#2f6fd6"), sombrero: PAJA, pelo: PELO, mazorca: true });
  // Un atado de mazorcas en el brazo de abajo.
  for (const [dx, a, c] of [
    [-12, -0.5, AMARILLO],
    [-9, -0.2, rampa("#f2a21c")],
    [-6, 0.1, AMARILLO],
  ] as const)
    mazorca(p, cx + dx, cy - 14, 14, c, a);
  for (const [dx, dy, r] of [
    [6, 12, 3.4],
    [12, 10, 3.6],
    [9, 7, 3.2],
    [16, 6, 3.2],
    [3, 15, 3],
    [13, 4, 2.8],
  ] as const)
    papa(p, cx + dx, cy + dy, r, dx % 2 ? PAPA : rampa("#8a4a8a"));
  return f.parte("guagua-maiz", p, cx, cy, { mov: { gira: { amp: 0.07, periodo: 1500, fase: 0.4 }, vaiven: { dy: -1.4, periodo: 750, fase: 0.4 } } });
}

export function minga(): CarrozaArte {
  const s = escena(LARGO, 20);
  plataforma(s, LARGO, { faldon: rombosAndinos([AMARILLO, TURQUESA, MAGENTA, VERDE], ROJO), cubierta: () => tono(HOJA, 2), flecos: [ROJO, AMARILLO, TURQUESA, MAGENTA, VERDE] }, false);
  const f = fig();

  const fondo = f.lienzo();
  atras(fondo);
  const plu = f.lienzo();
  plumas(plu);
  const cue = f.lienzo();
  cuerpo(cue);
  const cab = f.lienzo();
  cabeza(cab);
  const parp = f.lienzo();
  ojos(parp, true);
  const man = f.lienzo();
  manos(man);
  const cuello = P(H.x, -42);

  const partes: Parte[] = [
    parteBase(s),
    f.parte("maizal", fondo, ...P(80, 30), { mov: { gira: { amp: 0.012, periodo: 3400 } } }),
    f.parte("plumas", plu, ...P(H.x, H.y - 8), { padre: "cabeza", mov: { gira: { amp: 0.03, periodo: 2900 } } }),
    saludando(f, "saluda-1", -20, 8, 0, 0),
    saludando(f, "saluda-2", 74, 2, 1, 0.5),
    f.parte("cuerpo", cue, ...P(H.x, 20), { mov: { gira: { amp: 0.006, periodo: 5600 } } }),
    f.parte("cabeza", cab, ...cuello, { padre: "cuerpo", mov: { gira: { amp: 0.045, periodo: 4100 } } }),
    f.parte("parpados", parp, ...cuello, { padre: "cabeza", contorno: false, mov: { parpadeo: { cada: 3900, dura: 200 } } }),
    f.parte("totuma", man, ...P(T.x, T.y), { padre: "cuerpo", mov: { vaiven: { dy: -1.2, periodo: 2700 } } }),
  ];
  for (let k = 0; k < 3; k++) {
    const g = f.lienzo();
    gotas(g);
    partes.push(f.parte(`gotas-${k}`, g, ...P(T.x + 22, T.y + 8), { padre: "totuma", contorno: false, mov: { sube: { dx: 9, dy: 80, periodo: 1200, fase: k / 3, crece: 0.4 } } }));
  }
  partes.push(ninoPapas(f), ninoMaiz(f));
  void [girada, LINEA];
  return { largo: LARGO, partes, luces: [], marco: { x0: -ANCHO - 40, x1: LARGO + 40 } };
}

export type { Forma };
