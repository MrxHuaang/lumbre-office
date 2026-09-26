// Lo que va en la cabeza del chibi (encima del pelo): gorra, gorro, sombrero, audífonos, moño, corona,
// flor y pañoleta. Lo que se apoya arriba (corona, moño, audífonos, flor) sigue la altura del peinado
// (restRow) para no quedar flotando sobre una cabeza rapada; lo que tapa esconde el pelo (ver hair.ts).
import type { HairStyle } from "@hyvento/shared";
import { C } from "../palette";
import { hex, type PixelCanvas } from "../pixel";
import { CROWN_W, CROWN_X, crownRest, restRow } from "./hair";
import { LEAF, PETAL, PETAL_DARK, POLLEN, type Ctx, type Row, type Three, type Tones, type View } from "./kit";

/** Peinados sin pelo a los costados: ahí se ven las patas de los audífonos. */
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
    default:
      return;
  }
}

function drawStrawHat(c: PixelCanvas, t: Tones, view: View, y: Row) {
  const [s0, s1, s2] = t.straw;
  // Copa con cinta roja y un ala ancha (más larga hacia donde mira).
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
  // Borde doblado con el tejido en canalé.
  for (let x = 3; x <= 12; x++) {
    c.set(x, y(4), x % 2 ? a[0] : a[1]);
    c.set(x, y(5), x % 2 ? a[0] : a[1]);
  }
}

/** Audífonos: la diadema se apoya en el pelo (fila `band`) y las copas tapan las orejas. */
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

/** Moño grande (color de acento): dos lazos y el nudo, arriba de la cabeza hacia atrás. */
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

/** Corona dorada (fija, no sigue el color de acento) con un rubí al medio. */
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

/** Pañoleta (color de acento con pintas crema): amarrada atrás, con las dos puntas colgando. */
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
    // Nudo detrás de la cabeza (a la izquierda) y las puntas.
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
