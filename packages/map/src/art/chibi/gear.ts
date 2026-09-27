// Accesorios de cuello y espalda del chibi (usan el color de acento; el collar lleva cadena dorada).
import type { BackItem, NeckItem } from "@hyvento/shared";
import { PixelCanvas, type RGBA } from "../pixel";
import { drawHair } from "./hair";
import { drawTieShape } from "./clothes";
import { three, type Ctx, type Row, type Three, type View } from "./kit";

/** Cadena dorada del collar y broche de la capa. */
const GOLD = three("#e8b84a");

/** Lo del cuello y la espalda que se pinta con el color de acento (el editor lo usa para nombrar su selector). */
export const ACCENT_NECK_ITEMS: readonly NeckItem[] = ["scarf", "tie", "bowtie", "necklace"];
export const ACCENT_BACK_ITEMS: readonly BackItem[] = ["backpack", "cape"];

/** Lo que va en el cuello. De frente va antes del pelo (el pelo largo cae encima); de espaldas, después. */
export function drawNeckGear(ctx: Ctx) {
  const { c, t, look, view, y } = ctx;
  switch (look.neck) {
    case "scarf":
      return drawScarf(c, t.accent, view, y);
    case "tie":
      return drawTie(ctx);
    case "bowtie":
      return drawBowtie(ctx);
    case "necklace":
      return drawNecklace(ctx);
    default:
      return;
  }
}

/**
 * Lo que va en la espalda (morral, capa). Se llama dos veces: `behind` antes del cuerpo (lo que queda
 * detrás, visto de frente) y `over` al final (lo que se ve encima: tirantes, cuello de la capa y, de
 * espaldas, el morral o la capa enteros), siempre por debajo del pelo y de lo del cuello.
 */
export function drawBackGear(ctx: Ctx, layer: "behind" | "over") {
  const { look, view } = ctx;
  if (look.back === "backpack") {
    if (view === "back") {
      if (layer === "over") drawPackBack(ctx);
    } else if (layer === "behind") drawPackSide(ctx);
    else drawPackStraps(ctx);
  } else if (look.back === "cape") {
    if (view === "back") {
      if (layer === "over") drawCapeBack(ctx);
    } else if (layer === "behind") drawCapeBehind(ctx);
    else drawCapeCollar(ctx);
  }
}

// ---------- Cuello ----------

function drawScarf(c: PixelCanvas, a: Three, view: View, y: Row) {
  c.rect(4, y(12), 8, 2, a[1]);
  c.rect(11, y(12), 1, 2, a[0]);
  c.rect(5, y(12), 2, 1, a[2]);
  c.rect(4, y(13), 8, 1, a[0]);
  // Tejido: una raya más clara en la vuelta.
  for (const x of [6, 9]) c.set(x, y(13), a[1]);
  if (view === "front") {
    // La punta cuelga por delante, con flecos.
    c.rect(9, y(14), 2, 3, a[1]);
    c.rect(10, y(14), 1, 3, a[0]);
    c.set(9, y(15), a[2]);
    c.set(9, y(17), a[0]);
    c.set(10, y(17), a[1]);
  } else {
    c.rect(5, y(14), 2, 2, a[1]);
    c.set(5, y(16), a[0]);
    c.set(6, y(16), a[1]);
  }
}

/** Corbata: la misma de la camisa con corbata (nudo, hoja y punta), del color de acento. De espaldas no se ve. */
function drawTie({ c, t, view, y }: Ctx) {
  if (view !== "front") return;
  // Las puntas del cuello asoman a los lados del nudo.
  c.set(6, y(13), t.cream[2]);
  c.set(9, y(13), t.cream[1]);
  drawTieShape(c, t.accent, y);
}

/** Corbatín: dos alas en mariposa (los bordes a la sombra) y el nudo claro al medio, bajo el mentón. De espaldas no se ve. */
function drawBowtie({ c, t, view, y }: Ctx) {
  if (view !== "front") return;
  const [a0, a1, a2] = t.accent;
  for (const r of [13, 14, 15]) {
    c.set(5, y(r), a0);
    c.set(6, y(r), r === 13 ? a2 : a1);
    c.set(9, y(r), a1);
    c.set(10, y(r), a0);
  }
  // El nudo va solo en la fila del medio: arriba y abajo asoma la camisa y se lee la forma de moño.
  c.set(7, y(14), a2);
  c.set(8, y(14), a1);
}

/** Collar: cadena dorada en U con un dije del color de acento. De espaldas, el broche en la nuca. */
function drawNecklace(ctx: Ctx) {
  const { c, t, view, y } = ctx;
  const [g0, g1, g2] = GOLD;
  if (view === "front") {
    c.set(6, y(13), g2);
    c.set(9, y(13), g1);
    c.set(6, y(14), g1);
    c.set(9, y(14), g0);
    c.set(7, y(15), g1);
    c.set(8, y(15), g0);
    // Dije de 2x2 con brillo, colgando de la cadena.
    c.set(7, y(16), t.accent[2]);
    c.set(8, y(16), t.accent[1]);
    c.set(7, y(17), t.accent[1]);
    c.set(8, y(17), t.accent[0]);
    return;
  }
  // Solo sobre la nuca que se ve: con pelo largo la cadena queda tapada.
  const hair = hairMask(ctx);
  for (const x of [7, 8]) if (!hair.alphaAt(x, y(12))) c.set(x, y(12), x === 7 ? g1 : g0);
}

// ---------- Espalda ----------

/** Morral visto de frente: asoma detrás del hombro de atrás. */
function drawPackSide({ c, t, y }: Ctx) {
  const [a0, a1, a2] = t.accent;
  c.rect(2, y(12), 2, 1, a1);
  c.set(2, y(12), a2);
  c.rect(1, y(13), 3, 8, a1);
  c.rect(1, y(13), 1, 8, a0);
  c.rect(1, y(20), 3, 1, a0);
  c.rect(1, y(16), 2, 1, a0);
  c.set(2, y(17), GOLD[1]);
}

/** Tirantes del morral sobre el pecho (de frente), por debajo de la bufanda. */
function drawPackStraps(ctx: Ctx) {
  const [a0, a1] = ctx.t.accent;
  const put = under(ctx);
  put(5, 13, a1);
  for (const r of [14, 15, 16]) put(5, r, a0);
  put(10, 13, a1);
  for (const r of [14, 15, 16, 17]) put(10, r, a0);
  // Hebillas de los tirantes.
  put(5, 16, GOLD[1]);
  put(10, 17, GOLD[0]);
}

/** Morral completo visto de espaldas, con solapa, hebilla y bolsillo. El pelo largo cae por encima. */
function drawPackBack(ctx: Ctx) {
  const [a0, a1, a2] = ctx.t.accent;
  const put = under(ctx);
  // Tirantes en los hombros.
  put(4, 13, a0);
  put(11, 13, a0);
  // Cuerpo con la tapa redondeada.
  for (let x = 6; x <= 9; x++) put(x, 12, x === 6 ? a2 : a1);
  for (let r = 13; r <= 20; r++)
    for (let x = 5; x <= 10; x++) put(x, r, x === 10 || r === 20 ? a0 : x === 5 && r <= 16 ? a2 : a1);
  // Solapa con la hebilla dorada y el bolsillo de abajo, con su cierre.
  for (let x = 5; x <= 10; x++) put(x, 15, a0);
  put(7, 16, GOLD[2]);
  put(8, 16, GOLD[1]);
  for (let x = 6; x <= 9; x++) put(x, 18, a0);
  put(6, 19, a0);
  put(9, 19, a0);
  put(7, 18, GOLD[1]);
}

/** Capa vista de frente: cuelga detrás del cuerpo; asoma a los lados y ondea al caminar. */
function drawCapeBehind({ c, t, frame, sit, y }: Ctx) {
  const [a0, a1] = t.accent;
  const bottom = capeBottom(frame, sit);
  const wave = frame === 0 ? 0 : 1;
  for (let r = 13; r <= bottom; r++) {
    const left = r <= 16 ? 3 : r <= 20 ? 2 : 2 - wave;
    // Por fuera (a la izquierda) se ve la tela; al fondo, el forro más oscuro.
    c.rect(left, y(r), 13 - left, 1, a0);
    c.set(left, y(r), a1);
    if (r >= 17) c.set(left + 1, y(r), a1);
  }
}

/** Capa de frente: los bordes sobre los hombros y el broche dorado (por debajo de lo del cuello). */
function drawCapeCollar(ctx: Ctx) {
  const [a0, a1, a2] = ctx.t.accent;
  const put = under(ctx);
  put(4, 12, a2);
  put(5, 12, a1);
  put(10, 12, a0);
  put(11, 12, a0);
  put(4, 13, a1);
  put(11, 13, a0);
  put(6, 13, a0);
  put(9, 13, a0);
  put(7, 13, GOLD[2]);
  put(8, 13, GOLD[1]);
}

/** Capa vista de espaldas: cubre la espalda y los brazos, con pliegues y el borde que ondea. */
function drawCapeBack(ctx: Ctx) {
  const { t, frame, sit } = ctx;
  const [a0, a1, a2] = t.accent;
  const put = under(ctx);
  const bottom = capeBottom(frame, sit);
  for (let r = 13; r <= bottom; r++) {
    const [from, to] = r === 13 ? [4, 11] : [3, 12];
    for (let x = from; x <= to; x++) {
      const fold = r >= 17 && (x === 6 || x === 9);
      put(x, r, x === to || fold ? a0 : x <= from + 1 && r <= 17 ? a2 : a1);
    }
  }
  // El borde de abajo ondea al caminar.
  const shift = frame === 2 ? 1 : 0;
  for (let x = 3; x <= 12; x++) if ((x + shift) % 3 === 0) put(x, bottom, a0);
}

// ---------- Utilidades ----------

/**
 * Última fila de la capa (en filas del torso, que bajan con el paso). Al caminar el torso baja un
 * píxel: la capa queda una fila más corta para no tapar los pies. Sentada solo llega al asiento.
 */
const capeBottom = (frame: Ctx["frame"], sit: boolean) => (sit ? 21 : frame === 0 ? 24 : 23);

/** El pelo solo, en un lienzo aparte: dice qué píxeles son pelo sin mirar colores. */
function hairMask(ctx: Ctx): PixelCanvas {
  const mask = new PixelCanvas(ctx.c.width, ctx.c.height);
  drawHair({ ...ctx, c: mask });
  return mask;
}

/**
 * Pinta por debajo del pelo y de lo del cuello: lo que va en la espalda no tapa el pelo largo que cae
 * encima ni la bufanda. Se sabe qué es pelo dibujándolo aparte (no por el color, que puede ser el
 * mismo de la ropa o del acento).
 */
function under(ctx: Ctx) {
  const { c, y } = ctx;
  const mask = hairMask(ctx);
  drawNeckGear({ ...ctx, c: mask });
  return (x: number, row: number, col: RGBA) => {
    if (!mask.alphaAt(x, y(row))) c.set(x, y(row), col);
  };
}
