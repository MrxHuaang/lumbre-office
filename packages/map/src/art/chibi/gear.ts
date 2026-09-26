// Accesorios de cuello y espalda del chibi (usan el color de acento; el collar lleva cadena dorada).
import type { PixelCanvas, RGBA } from "../pixel";
import { three, type Ctx, type Row, type Three, type Tones, type View } from "./kit";

/** Cadena dorada del collar y broche de la capa. */
const GOLD = three("#e8b84a");

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
 * detrás, visto de frente) y `over` al final (lo que se ve encima, visto de espaldas).
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
  if (view === "front") {
    // La punta cuelga por delante, con flecos.
    c.rect(9, y(14), 2, 2, a[1]);
    c.rect(10, y(14), 1, 2, a[0]);
    c.set(9, y(16), a[0]);
    c.set(10, y(16), a[1]);
  } else {
    c.rect(5, y(14), 2, 1, a[1]);
    c.set(5, y(15), a[0]);
  }
}

/** Corbata: nudo bajo el cuello y la hoja que se ensancha hacia la punta. De espaldas no se ve. */
function drawTie({ c, t, view, y }: Ctx) {
  if (view !== "front") return;
  const [a0, a1, a2] = t.accent;
  c.set(7, y(13), a2);
  c.set(8, y(13), a1);
  c.set(8, y(14), a1);
  c.rect(7, y(15), 2, 2, a1);
  c.rect(8, y(15), 1, 2, a0);
  c.set(8, y(17), a0);
}

/** Corbatín: dos alas y el nudo al medio, bajo el mentón. De espaldas no se ve. */
function drawBowtie({ c, t, view, y }: Ctx) {
  if (view !== "front") return;
  const [a0, a1, a2] = t.accent;
  c.set(6, y(13), a2);
  c.set(9, y(13), a1);
  c.rect(6, y(14), 4, 1, a1);
  c.rect(7, y(14), 2, 1, a0);
  c.set(6, y(15), a1);
  c.set(9, y(15), a0);
}

/** Collar: cadena dorada en U con un dije del color de acento. De espaldas, el broche en la nuca. */
function drawNecklace({ c, t, view, y }: Ctx) {
  const [g0, g1, g2] = GOLD;
  if (view === "front") {
    c.set(6, y(13), g2);
    c.set(9, y(13), g1);
    c.set(7, y(14), g1);
    c.set(8, y(14), g0);
    c.set(7, y(15), t.accent[2]);
    c.set(8, y(15), t.accent[0]);
    return;
  }
  // Solo sobre la nuca que se ve: con pelo largo la cadena queda tapada.
  for (const x of [7, 8]) if (isSkin(c, x, y(12), t)) c.set(x, y(12), x === 7 ? g1 : g0);
}

// ---------- Espalda ----------

/** Morral visto de frente: asoma detrás del hombro de atrás. */
function drawPackSide({ c, t, y }: Ctx) {
  const [a0, a1, a2] = t.accent;
  c.rect(2, y(12), 2, 1, a1);
  c.set(2, y(12), a2);
  c.rect(1, y(13), 3, 6, a1);
  c.rect(1, y(13), 1, 6, a0);
  c.rect(1, y(18), 3, 1, a0);
  c.rect(1, y(15), 2, 1, a0);
}

/** Tirantes del morral sobre el pecho (de frente). */
function drawPackStraps({ c, t, y }: Ctx) {
  const [a0, a1] = t.accent;
  c.set(5, y(13), a1);
  c.rect(5, y(14), 1, 2, a0);
  c.set(10, y(13), a1);
  c.rect(10, y(14), 1, 3, a0);
}

/** Morral completo visto de espaldas, con solapa, hebilla y bolsillo. El pelo largo cae por encima. */
function drawPackBack({ c, t, y }: Ctx) {
  const [a0, a1, a2] = t.accent;
  const put = under(c, t, y);
  // Tirantes en los hombros.
  put(4, 13, a0);
  put(11, 13, a0);
  // Cuerpo con la tapa redondeada.
  for (let x = 6; x <= 9; x++) put(x, 12, x === 6 ? a2 : a1);
  for (let r = 13; r <= 18; r++)
    for (let x = 5; x <= 10; x++) put(x, r, x === 10 || r === 18 ? a0 : x === 5 && r <= 15 ? a2 : a1);
  // Solapa con la hebilla dorada y el bolsillo de abajo.
  for (let x = 5; x <= 10; x++) put(x, 14, a0);
  put(7, 15, GOLD[2]);
  put(8, 15, GOLD[1]);
  for (let x = 6; x <= 9; x++) put(x, 16, a0);
  put(6, 17, a0);
  put(9, 17, a0);
}

/** Capa vista de frente: cuelga detrás del cuerpo; asoma a los lados y ondea al caminar. */
function drawCapeBehind({ c, t, frame, sit, y }: Ctx) {
  const [a0, a1] = t.accent;
  // Sentado, la capa queda debajo: solo baja hasta el asiento.
  const bottom = sit ? 19 : 21;
  const wave = frame === 0 ? 0 : 1;
  for (let r = 13; r <= bottom; r++) {
    const left = r <= 15 ? 3 : r <= 18 ? 2 : 2 - wave;
    // Por fuera (a la izquierda) se ve la tela; al fondo, el forro más oscuro.
    c.rect(left, y(r), 13 - left, 1, a0);
    c.set(left, y(r), a1);
    if (r >= 16) c.set(left + 1, y(r), a1);
  }
}

/** Capa de frente: los bordes sobre los hombros y el broche dorado. */
function drawCapeCollar({ c, t, y }: Ctx) {
  const [a0, a1, a2] = t.accent;
  c.rect(4, y(12), 2, 1, a1);
  c.set(4, y(12), a2);
  c.rect(10, y(12), 2, 1, a0);
  c.set(4, y(13), a1);
  c.set(11, y(13), a0);
  c.set(6, y(13), a0);
  c.set(9, y(13), a0);
  c.set(7, y(13), GOLD[2]);
  c.set(8, y(13), GOLD[1]);
}

/** Capa vista de espaldas: cubre la espalda y los brazos, con pliegues y el borde que ondea. */
function drawCapeBack({ c, t, frame, sit, y }: Ctx) {
  const [a0, a1, a2] = t.accent;
  const put = under(c, t, y);
  const bottom = sit ? 19 : 21;
  for (let r = 13; r <= bottom; r++) {
    const [from, to] = r === 13 ? [4, 11] : [3, 12];
    for (let x = from; x <= to; x++) {
      const fold = r >= 16 && (x === 6 || x === 9);
      put(x, r, x === to || fold ? a0 : x <= from + 1 && r <= 16 ? a2 : a1);
    }
  }
  // El borde de abajo ondea al caminar.
  const shift = frame === 2 ? 1 : 0;
  for (let x = 3; x <= 12; x++) if ((x + shift) % 3 === 0) put(x, bottom, a0);
}

// ---------- Utilidades ----------

/** ¿El píxel es del mismo color? */
function isColor(c: PixelCanvas, x: number, yy: number, col: RGBA): boolean {
  if (x < 0 || yy < 0 || x >= c.width || yy >= c.height) return false;
  const i = (yy * c.width + x) * 4;
  return c.data[i] === col[0] && c.data[i + 1] === col[1] && c.data[i + 2] === col[2] && c.data[i + 3] === col[3];
}

const isSkin = (c: PixelCanvas, x: number, yy: number, t: Tones) => t.skin.some((s) => isColor(c, x, yy, s));

/**
 * ¿Ese píxel es pelo? Se reconoce por el color. Si coincide con un tono de la ropa o la piel (se eligió
 * el mismo color, o la cinta es del color de la camisa) no se puede saber: se toma como ropa, para que
 * la capa o el morral no queden con huecos.
 */
function isHair(c: PixelCanvas, x: number, yy: number, t: Tones): boolean {
  const is = (tones: readonly RGBA[]) => tones.some((h) => isColor(c, x, yy, h));
  if (!is([...t.hair, t.ribbon[1]])) return false;
  return !is([...t.shirt, ...t.top2, ...t.pants, ...t.skin, ...t.accent, ...t.shoes, ...t.cream]);
}

/** Pinta por debajo del pelo: lo que va en la espalda no tapa el pelo largo que cae encima. */
function under(c: PixelCanvas, t: Tones, y: Row) {
  return (x: number, row: number, col: RGBA) => {
    if (!isHair(c, x, y(row), t)) c.set(x, y(row), col);
  };
}
