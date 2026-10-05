// Lo que va en la cabeza del chibi (encima del pelo): gorra, gorro, sombrero, audÃ­fonos, moÃ±o, corona,
// flor y paÃ±oleta. Lo que se apoya arriba (corona, moÃ±o, audÃ­fonos, flor) sigue la altura del peinado
// (restRow) para no quedar flotando sobre una cabeza rapada; lo que tapa esconde el pelo (ver hair.ts).
import type { HairStyle, HeadItem } from "@hyvento/shared";
import { C } from "../palette";
import { alpha, hex, type PixelCanvas, type RGBA } from "../pixel";
import { CROWN_W, CROWN_X, crownRest, restRow } from "./hair";
import { LEAF, PETAL, PETAL_DARK, POLLEN, type Ctx, type Row, type Three, type Tones, type View } from "./kit";

/** Peinados sin pelo a los costados: ahÃ­ se ven las patas de los audÃ­fonos. */
const BARE_SIDES: ReadonlySet<HairStyle> = new Set(["buzz", "bald", "mohawk", "undercut"]);

export function drawHeadwear({ c, t, look, view, y }: Ctx) {
  const a = t.accent;
  const rest = restRow(look.hairStyle);
  switch (look.head) {
    case "cap":
      c.rect(4, y(1), 8, 1, a[1]);
      c.rect(3, y(2), 10, 3, a[1]);
      c.rect(5, y(1), 3, 1, a[2]);
      c.rect(11, y(2), 2, 3, a[0]);
      if (view === "front") c.rect(8, y(5), 7, 1, a[0]);
      else c.rect(7, y(4), 2, 1, a[2]);
      return;
    case "straw-hat":
      return drawStrawHat(c, t, view, y);
    case "beanie":
      return drawBeanie(c, a, y);
    case "headphones":
      return drawHeadphones(c, a, y, rest - 1, BARE_SIDES.has(look.hairStyle));
    case "flower":
      return drawFlower(c, view === "front" ? 4 : 11, y(rest + 1));
    case "bow":
      return drawBow(c, a, view, y, rest);
    case "crown":
      return drawCrown(c, y, crownRest(look.hairStyle));
    case "bandana":
      return drawBandana(c, t, view, y);
    default: {
      const draw = MORE_HATS[look.head];
      return draw?.({ c, t, view, y, rest });
    }
  }
}

function drawStrawHat(c: PixelCanvas, t: Tones, view: View, y: Row) {
  const [s0, s1, s2] = t.straw;
  // Copa con cinta roja y un ala ancha (mÃ¡s larga hacia donde mira).
  c.rect(5, y(-1), 6, 1, s1);
  c.rect(4, y(0), 8, 2, s1);
  c.rect(11, y(-1), 1, 3, s0);
  c.rect(5, y(-1), 2, 2, s2);
  c.rect(4, y(2), 8, 1, t.ribbon[1]);
  c.rect(11, y(2), 1, 1, t.ribbon[0]);
  const far = view === "front" ? 14 : 13;
  c.rect(1, y(3), far, 1, s1);
  c.rect(2, y(4), far - 1, 1, s0);
  // Trenzado de la paja.
  for (let x = 2; x <= far; x += 2) c.set(x, y(3), s2);
  for (const x of [6, 9]) c.set(x, y(0), s0);
}

function drawBeanie(c: PixelCanvas, a: Three, y: Row) {
  c.rect(6, y(-1), 3, 1, a[2]);
  c.rect(5, y(0), 6, 1, a[1]);
  c.rect(4, y(1), 8, 1, a[1]);
  c.rect(3, y(2), 10, 2, a[1]);
  c.rect(11, y(1), 2, 3, a[0]);
  c.rect(5, y(1), 2, 2, a[2]);
  // Borde doblado con el tejido en canalÃ©.
  for (let x = 3; x <= 12; x++) {
    c.set(x, y(4), x % 2 ? a[0] : a[1]);
    c.set(x, y(5), x % 2 ? a[0] : a[1]);
  }
}

/** AudÃ­fonos: la diadema se apoya en el pelo (fila `band`) y las copas tapan las orejas. */
function drawHeadphones(c: PixelCanvas, a: Three, y: Row, band: number, bareSides: boolean) {
  c.rect(4, y(band), 8, 1, a[0]);
  c.set(3, y(band + 1), a[0]);
  c.set(12, y(band + 1), a[0]);
  // Sin pelo a los lados se ven las patas que bajan hasta las copas.
  if (bareSides)
    for (let r = band + 2; r <= 4; r++) {
      c.set(3, y(r), a[0]);
      c.set(12, y(r), a[0]);
    }
  c.rect(2, y(5), 2, 4, a[1]);
  c.rect(12, y(5), 2, 4, a[0]);
}

function drawFlower(c: PixelCanvas, x: number, row: number) {
  c.set(x, row - 1, PETAL);
  c.set(x - 1, row, PETAL);
  c.set(x + 1, row, PETAL_DARK);
  c.set(x, row + 1, PETAL_DARK);
  c.set(x, row, POLLEN);
  c.set(x + 1, row + 1, LEAF);
}

/** MoÃ±o grande (color de acento): dos lazos y el nudo, arriba de la cabeza hacia atrÃ¡s. */
function drawBow(c: PixelCanvas, a: Three, view: View, y: Row, rest: number) {
  const x = view === "front" ? 2 : 7;
  const top = rest - 2;
  // Lazos de 2 de ancho que se abren a 3 al lado del nudo: luz arriba y sombra abajo.
  for (const lx of [x, x + 5]) {
    c.rect(lx, y(top), 2, 3, a[1]);
    c.rect(lx, y(top + 3), 2, 1, a[0]);
  }
  c.rect(x + 2, y(top + 1), 1, 2, a[1]);
  c.rect(x + 4, y(top + 1), 1, 2, a[1]);
  c.rect(x, y(top), 2, 1, a[2]);
  c.set(x + 5, y(top), a[2]);
  c.set(x + 1, y(top + 1), a[2]);
  c.rect(x + 6, y(top + 1), 1, 2, a[0]);
  // Nudo al medio y las dos puntas que cuelgan.
  c.rect(x + 3, y(top + 1), 1, 2, a[0]);
  c.set(x + 2, y(top + 3), a[0]);
  c.set(x + 4, y(top + 3), a[0]);
}

/** Corona dorada (fija, no sigue el color de acento) con un rubÃ­ al medio. */
function drawCrown(c: PixelCanvas, y: Row, rest: number) {
  const gold = C.gold;
  const top = rest - 2;
  const x0 = CROWN_X;
  const x1 = CROWN_X + CROWN_W - 1;
  const mid = CROWN_X + (CROWN_W >> 1);
  // Tres puntas y la banda; la luz a la izquierda y la sombra a la derecha, como la cabeza.
  for (const x of [x0, mid, x1]) c.set(x, y(top), gold[4]!);
  c.rect(x0, y(top + 1), CROWN_W, 1, gold[3]!);
  c.rect(x0, y(top + 2), CROWN_W, 1, gold[2]!);
  c.set(x0, y(top + 1), gold[5]!);
  c.set(x1, y(top + 1), gold[2]!);
  c.set(x1, y(top + 2), gold[1]!);
  c.set(mid, y(top + 1), RUBY);
  c.set(mid - 2, y(top + 2), SAPPHIRE);
  c.set(mid + 2, y(top + 2), SAPPHIRE);
}

const RUBY = hex("#c0392b");
const SAPPHIRE = hex("#4a70a0");

/** PaÃ±oleta (color de acento con pintas crema): amarrada atrÃ¡s, con las dos puntas colgando. */
function drawBandana(c: PixelCanvas, t: Tones, view: View, y: Row) {
  const a = t.accent;
  const dot = t.cream[1];
  c.rect(4, y(1), 8, 1, a[1]);
  c.rect(3, y(2), 10, 3, a[1]);
  c.rect(11, y(2), 2, 3, a[0]);
  c.rect(5, y(1), 3, 1, a[2]);
  c.rect(3, y(4), 10, 1, a[0]);
  if (view === "front") {
    for (const [x, r] of [
      [5, 3],
      [8, 2],
      [10, 3],
      [7, 4],
    ] as const)
      c.set(x, y(r), dot);
    // Nudo detrÃ¡s de la cabeza (a la izquierda) y las puntas.
    c.rect(2, y(3), 1, 2, a[1]);
    c.set(1, y(5), a[1]);
    c.set(2, y(5), a[0]);
    c.set(1, y(6), a[0]);
    return;
  }
  for (const [x, r] of [
    [5, 2],
    [9, 3],
    [4, 4],
    [11, 4],
  ] as const)
    c.set(x, y(r), dot);
  // De espaldas se ve el nudo en la nuca y las puntas que caen sobre el pelo.
  c.rect(7, y(4), 2, 2, a[1]);
  c.set(7, y(4), a[2]);
  c.set(6, y(6), a[1]);
  c.set(6, y(7), a[0]);
  c.set(9, y(6), a[0]);
  c.set(9, y(7), a[0]);
  c.set(10, y(8), a[0]);
}

// ---------- Sombreros de los trajes ----------

type Hat = { c: PixelCanvas; t: Tones; view: View; y: Row; rest: number };
const front = (v: View) => v === "front";

/** Rellena filas [fila, desde, hasta] con sombra en la Ãºltima columna y luz a la izquierda en las primeras `lit` filas. */
function rows(c: PixelCanvas, y: Row, spans: readonly (readonly [number, number, number])[], k: Three, lit = 2) {
  const top = spans[0]![0];
  for (const [r, x0, x1] of spans)
    for (let x = x0; x <= x1; x++) c.set(x, y(r), x === x1 ? k[0] : x <= x0 + 1 && r < top + lit ? k[2] : k[1]);
}

const PINK_GEM = hex("#f28fad");

/** Fieltro gris del sombrero del Man del Sombrero y su cinta oscura (fijos, como la paja). */
const FELT: Three = [hex("#5f6168"), hex("#8a8c92"), hex("#b4b6ba")];
const FELT_BAND = hex("#2e2a30");
/** Cinta naranja del sombrero de bruja (fija: el sombrero va en el color de acento). */
const WITCH_BAND: Three = [hex("#c8601a"), hex("#f08a2a"), hex("#f6a548")];

/** Oscurece un píxel ya pintado (lo vacío no se toca): la sombra del ala sobre la cara. */
function darken(c: PixelCanvas, x: number, cy: number, k: number) {
  const i = (cy * c.width + x) * 4;
  if (x < 0 || cy < 0 || x >= c.width || cy >= c.height || !c.data[i + 3]) return;
  c.data[i] = Math.round(c.data[i]! * (1 - k));
  c.data[i + 1] = Math.round(c.data[i + 1]! * (1 - k));
  c.data[i + 2] = Math.round(c.data[i + 2]! * (1 - k * 0.8));
}

const MORE_HATS: Partial<Record<HeadItem, (h: Hat) => void>> = {
  // Sombrero de fieltro: copa con el pellizco arriba, cinta oscura y un ala corta que baja hacia donde
  // mira. El ala deja la frente y los ojos en sombra (se oscurece lo que ya estaba dibujado debajo).
  fedora({ c, view, y }) {
    const [f0, f1, f2] = FELT;
    for (const [row, k] of [
      [5, 0.45],
      [6, 0.25],
    ] as const)
      for (let x = 3; x <= 12; x++) darken(c, x, y(row), k);
    c.rect(5, y(-1), 6, 1, f1);
    c.rect(7, y(-1), 2, 1, f0);
    c.rect(4, y(0), 8, 2, f1);
    c.rect(5, y(0), 2, 1, f2);
    c.set(7, y(0), f0);
    c.rect(11, y(-1), 1, 3, f0);
    c.rect(4, y(2), 8, 1, FELT_BAND);
    const far = view === "front" ? 13 : 12;
    c.rect(2, y(3), far, 1, f1);
    c.rect(3, y(3), 3, 1, f2);
    c.rect(3, y(4), far - 2, 1, f0);
    if (view === "front") c.set(far + 1, y(4), f0);
  },
  // Gorro de chef: la banda plisada y el bollo alto y blanco.
  "chef-hat"({ c, t, y }) {
    const w = t.white;
    rows(c, y, [[-5, 4, 11], [-4, 2, 13], [-3, 2, 13], [-2, 2, 13], [-1, 2, 13], [0, 3, 12]], w, 3);
    c.set(6, y(-2), w[0]);
    c.set(10, y(-3), w[0]);
    rows(c, y, [[1, 3, 12], [2, 3, 12], [3, 3, 12]], w, 0);
    for (const x of [6, 9]) c.rect(x, y(1), 1, 3, w[0]);
    c.rect(3, y(3), 10, 1, w[0]);
  },
  // Chistera negra con la cinta del color de acento y el ala.
  "top-hat"({ c, t, view, y }) {
    rows(c, y, [[-5, 4, 11], [-4, 4, 11], [-3, 4, 11], [-2, 4, 11], [-1, 4, 11]], t.ink, 3);
    c.rect(4, y(0), 8, 2, t.accent[1]);
    c.rect(11, y(0), 1, 2, t.accent[0]);
    c.set(5, y(0), t.accent[2]);
    const [x0, x1] = front(view) ? [2, 14] : [1, 13];
    c.rect(x0, y(2), x1 - x0 + 1, 1, t.ink[0]);
    c.rect(x0 + 1, y(2), 4, 1, t.ink[1]);
  },
  // Casco de bombero: cÃºpula con la cresta, el escudo dorado adelante y el ala larga atrÃ¡s.
  "fire-helmet"({ c, t, view, y }) {
    const a = t.accent;
    rows(c, y, [[-1, 5, 10], [0, 4, 11], [1, 3, 12], [2, 3, 12], [3, 3, 12]], a, 3);
    c.rect(7, y(-2), 2, 1, a[1]);
    c.set(7, y(-1), a[2]);
    c.set(7, y(0), a[2]);
    if (front(view)) {
      const g = t.gold;
      c.set(9, y(1), g[2]);
      c.set(10, y(1), g[1]);
      c.set(9, y(2), g[1]);
      c.set(10, y(2), g[0]);
      c.rect(3, y(4), 11, 1, a[0]);
      c.rect(1, y(4), 2, 2, a[0]);
    } else {
      c.rect(2, y(4), 12, 1, a[1]);
      c.rect(2, y(5), 12, 1, a[0]);
    }
  },
  // Casco de obra con la nervadura al medio y la visera.
  "hard-hat"({ c, t, view, y }) {
    const a = t.accent;
    rows(c, y, [[0, 5, 10], [1, 4, 11], [2, 3, 12], [3, 3, 12]], a, 2);
    const rib = front(view) ? 7 : 8;
    c.rect(rib, y(0), 1, 4, a[2]);
    c.rect(2, y(4), 12, 1, a[0]);
    if (front(view)) c.set(14, y(4), a[0]);
  },
  // Sombrero de lluvia: copa baja, costura y el ala que cae larga por detrÃ¡s.
  "rain-hat"({ c, t, view, y }) {
    const a = t.accent;
    rows(c, y, [[0, 4, 11], [1, 4, 11], [2, 4, 11]], a, 2);
    c.rect(8, y(0), 1, 3, a[0]);
    c.rect(2, y(3), 12, 1, a[1]);
    if (front(view)) {
      c.rect(1, y(4), 3, 1, a[0]);
      c.rect(1, y(5), 2, 1, a[0]);
      c.set(13, y(3), a[0]);
    } else {
      c.rect(3, y(4), 10, 1, a[0]);
      c.rect(4, y(5), 8, 1, a[0]);
    }
  },
  // Gorro de marinero blanco con el ala doblada hacia arriba.
  "sailor-hat"({ c, t, y }) {
    const w = t.white;
    rows(c, y, [[0, 5, 10], [1, 4, 11]], w, 1);
    c.rect(3, y(2), 10, 1, w[2]);
    c.rect(3, y(3), 10, 1, w[1]);
    c.set(12, y(2), w[1]);
    c.set(12, y(3), w[0]);
  },
  // Sombrero de apicultor con el velo de malla hasta el cuello.
  "bee-hat"({ c, t, y }) {
    const w = t.white;
    rows(c, y, [[-1, 5, 10], [0, 5, 10], [1, 5, 10]], w, 1);
    c.rect(1, y(2), 14, 1, w[1]);
    c.set(14, y(2), w[0]);
    c.set(1, y(2), w[2]);
    // Malla oscura y transparente: se ve la cara (y el pelo) detrÃ¡s; el borde del velo es de tela.
    const dark = t.ink[0];
    for (let r = 3; r <= 11; r++)
      for (let x = 2; x <= 13; x++) {
        if (x === 2 || x === 13) c.set(x, y(r), w[0]);
        else c.set(x, y(r), alpha(dark, (x + r) % 2 ? 0.5 : 0.25));
      }
    c.rect(3, y(12), 10, 1, w[0]);
  },
  // Casco de astronauta: la burbuja blanca que encierra la cabeza, con el visor de vidrio adelante.
  "space-helmet"({ c, t, view, y }) {
    const w = t.white;
    const spans: [number, number, number][] = [[-2, 5, 10], [-1, 3, 12], [0, 2, 13]];
    for (let r = 1; r <= 10; r++) spans.push([r, 1, 14]);
    spans.push([11, 2, 13], [12, 3, 12]);
    const glass = (x: number, r: number) => front(view) && r >= 3 && r <= 10 && x >= 4 && x <= 12;
    for (const [r, x0, x1] of spans)
      for (let x = x0; x <= x1; x++) {
        if (glass(x, r)) continue;
        c.set(x, y(r), x >= x1 - 1 ? w[0] : x <= x0 + 1 && r <= 4 ? w[2] : w[1]);
      }
    if (front(view)) {
      // Vidrio: un tinte celeste sobre la cara, el borde del visor y dos brillos.
      const tint: RGBA = alpha(hex("#9fdcff"), 0.35);
      for (let r = 3; r <= 10; r++) for (let x = 4; x <= 12; x++) c.set(x, y(r), tint);
      for (let x = 4; x <= 12; x++) c.set(x, y(2), t.metal[1]);
      for (let r = 3; r <= 10; r++) c.set(13, y(r), t.metal[1]);
      c.set(5, y(3), alpha(hex("#ffffff"), 0.85));
      c.set(6, y(3), alpha(hex("#ffffff"), 0.6));
      c.set(5, y(4), alpha(hex("#ffffff"), 0.6));
    } else c.rect(5, y(3), 6, 5, w[0]);
    c.rect(3, y(12), 10, 1, t.metal[1]);
    c.set(12, y(12), t.metal[0]);
  },
  // Gorro de fiesta en cono con una franja y el pompÃ³n, apoyado en el pelo.
  "party-hat"({ c, t, y, rest }) {
    const a = t.accent;
    const r = rest;
    rows(c, y, [[r - 5, 7, 8], [r - 4, 7, 8], [r - 3, 6, 9], [r - 2, 6, 9], [r - 1, 5, 10]], a, 2);
    c.rect(6, y(r - 3), 4, 1, t.cream[2]);
    c.set(9, y(r - 3), t.cream[1]);
    c.set(6, y(r - 1), t.cream[2]);
    c.set(9, y(r - 1), t.cream[1]);
    c.set(7, y(r - 6), t.gold[2]);
    c.set(8, y(r - 6), t.gold[1]);
  },
  // Boina ladeada con su piquito.
  beret({ c, t, view, y }) {
    const a = t.accent;
    const [x0, x1] = front(view) ? [3, 13] : [2, 12];
    c.rect(4, y(0), 8, 1, a[1]);
    c.rect(5, y(0), 2, 1, a[2]);
    c.rect(x0, y(1), x1 - x0 + 1, 1, a[1]);
    c.set(x1, y(1), a[0]);
    c.rect(3, y(2), 10, 1, a[0]);
    c.set(8, y(-1), a[0]);
  },
  // Sombrero de pescador (de tela) con el ala caÃ­da.
  "bucket-hat"({ c, t, y }) {
    const a = t.accent;
    rows(c, y, [[0, 4, 11], [1, 4, 11]], a, 1);
    c.rect(4, y(2), 8, 1, a[0]);
    c.rect(3, y(3), 10, 1, a[1]);
    c.set(12, y(3), a[0]);
    c.rect(2, y(4), 12, 1, a[0]);
  },
  // Sombrero vueltiao: la copa y el ala anchÃ­sima con las franjas negras tejidas.
  vueltiao({ c, t, y }) {
    const [p0, p1, p2] = t.cream;
    const black = t.ink[1];
    for (let r = -2; r <= 2; r++)
      for (let x = 4; x <= 11; x++) c.set(x, y(r), r % 2 ? black : x === 11 ? p0 : x === 5 && r < 0 ? p2 : p1);
    c.rect(0, y(3), 16, 1, p1);
    for (let x = 0; x < 16; x += 3) c.set(x, y(3), black);
    c.rect(1, y(4), 14, 1, p0);
    c.set(15, y(3), p0);
  },
  // Gorro de dormir: la punta cae hacia atrÃ¡s con su pompÃ³n; ribete blanco en la frente.
  nightcap({ c, t, view, y }) {
    const a = t.accent;
    rows(c, y, [[0, 4, 11], [1, 3, 12], [2, 3, 12], [3, 3, 12]], a, 2);
    c.rect(3, y(4), 10, 1, t.cream[2]);
    c.set(12, y(4), t.cream[1]);
    const tail: [number, number][] = front(view)
      ? [[4, -1], [3, -1], [2, 0], [1, 1], [1, 2]]
      : [[11, -1], [12, -1], [13, 0], [14, 1], [14, 2]];
    tail.forEach(([x, r], i) => c.set(x, y(r), i < 2 ? a[1] : a[0]));
    const px = front(view) ? 0 : 14;
    c.rect(px, y(3), 2, 1, t.cream[2]);
    c.set(px + (front(view) ? 0 : 1), y(4), t.cream[1]);
  },
  // Cinta deportiva en la frente.
  headband({ c, t, view, y }) {
    const a = t.accent;
    c.rect(3, y(3), 10, 1, a[1]);
    c.rect(3, y(4), 10, 1, a[0]);
    c.set(12, y(3), a[0]);
    if (front(view)) c.set(9, y(3), t.cream[2]);
  },
  // Gorro de lana con pompÃ³n y el borde doblado crema.
  "pompom-beanie"({ c, t, y }) {
    const a = t.accent;
    rows(c, y, [[-1, 5, 10], [0, 4, 11], [1, 3, 12], [2, 3, 12], [3, 3, 12]], a, 3);
    for (let x = 3; x <= 12; x++) {
      c.set(x, y(4), x % 2 ? t.cream[1] : t.cream[2]);
      c.set(x, y(5), x % 2 ? t.cream[0] : t.cream[1]);
    }
    c.rect(7, y(-3), 2, 1, t.cream[2]);
    c.rect(6, y(-2), 4, 1, t.cream[1]);
    c.set(9, y(-2), t.cream[0]);
  },
  // Tiara dorada con una gema rosada, apoyada en el pelo.
  tiara({ c, t, y, rest }) {
    const g = t.gold;
    const r = rest;
    c.rect(5, y(r - 1), 6, 1, g[1]);
    c.set(5, y(r - 1), g[2]);
    c.set(10, y(r - 1), g[0]);
    c.set(5, y(r - 2), g[2]);
    c.set(10, y(r - 2), g[1]);
    c.set(7, y(r - 2), PINK_GEM);
    c.set(8, y(r - 2), g[1]);
    c.set(7, y(r - 3), g[2]);
  },
  // Sombrero de pirata de tres puntas, con el ribete dorado y la calavera adelante.
  "pirate-hat"({ c, t, view, y }) {
    const k = t.ink;
    c.rect(5, y(-1), 6, 1, k[1]);
    c.set(2, y(0), k[1]);
    c.set(13, y(0), k[0]);
    c.rect(4, y(0), 8, 1, k[1]);
    c.rect(2, y(1), 12, 1, k[1]);
    c.rect(2, y(2), 12, 1, k[0]);
    c.rect(3, y(3), 10, 1, t.gold[1]);
    c.set(12, y(3), t.gold[0]);
    if (front(view)) {
      c.set(7, y(0), t.white[2]);
      c.set(8, y(0), t.white[1]);
      c.set(7, y(1), t.white[1]);
      c.set(8, y(1), t.white[0]);
    }
  },
  // Sombrero de bruja: el cono torcido con la punta doblada hacia atrás, la cinta naranja con su hebilla
  // dorada y el ala bien ancha.
  "witch-hat"({ c, t, view, y }) {
    const a = t.accent;
    rows(c, y, [[-5, 7, 8], [-4, 6, 9], [-3, 6, 9], [-2, 5, 10], [-1, 5, 10], [0, 4, 11], [1, 4, 11]], a, 9);
    // La punta se dobla hacia atrás: a la izquierda de frente, a la derecha de espaldas.
    const tip: [number, number][] = front(view) ? [[6, -6], [5, -7], [4, -7]] : [[9, -6], [10, -7], [11, -7]];
    tip.forEach(([x, r], i) => c.set(x, y(r), i === 2 ? a[0] : a[1]));
    c.rect(4, y(2), 8, 1, WITCH_BAND[1]);
    c.set(11, y(2), WITCH_BAND[0]);
    if (front(view)) c.set(9, y(2), t.gold[2]);
    c.rect(0, y(3), 16, 1, a[1]);
    c.rect(1, y(3), 3, 1, a[2]);
    c.set(15, y(3), a[0]);
  },
  // Sombrero de mago: el cono alto con la punta doblada, la cinta dorada y estrellitas.
  "wizard-hat"({ c, t, y }) {
    const a = t.accent;
    rows(c, y, [[-6, 8, 9], [-5, 7, 8], [-4, 7, 9], [-3, 6, 9], [-2, 6, 9], [-1, 5, 10], [0, 5, 10], [1, 4, 11], [2, 4, 11]], a, 9);
    c.set(9, y(-7), a[0]);
    c.rect(4, y(2), 8, 1, t.gold[1]);
    c.rect(1, y(3), 14, 1, a[1]);
    c.set(14, y(3), a[0]);
    c.set(6, y(0), t.gold[2]);
    c.set(8, y(-3), t.gold[2]);
  },
};
