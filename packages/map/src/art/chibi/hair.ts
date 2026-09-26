// Peinados del chibi, de frente y de espaldas (el color es el del pelo; la cinta es fija).
import type { HairStyle } from "@hyvento/shared";
import { noise, type PixelCanvas } from "../pixel";
import type { Ctx, Row, Three, Tones, View } from "./kit";

/** Pelo según la vista: de frente enmarca la cara; de espaldas tapa la nuca. */
export function drawHair({ c, t, look, view, y, sway }: Ctx) {
  if (view === "front") drawHairFront(c, look.hairStyle, t, y, sway);
  else drawHairBack(c, look.hairStyle, t, y, sway);
}

/** Trenza de 2px de ancho: el tejido alterna tonos fila por fila. */
function braid(c: PixelCanvas, x: number, from: number, to: number, t: Tones, y: Row) {
  const hr = t.hair;
  for (let r = from; r <= to; r++) {
    c.set(x, y(r), r % 2 ? hr[1] : hr[2]);
    c.set(x + 1, y(r), r % 2 ? hr[0] : hr[1]);
  }
  c.rect(x, y(to + 1), 2, 1, t.ribbon[1]);
  c.set(x + (to % 2), y(to + 2), hr[1]);
}

/** Afro: una nube redonda de rizos; de frente deja ver la cara. */
function drawAfro(c: PixelCanvas, hr: Three, y: Row, view: View) {
  const bottom = view === "front" ? 9 : 10;
  // De espaldas tapa toda la cabeza (la nuca queda a la sombra); los bultos del borde no dejan ver piel.
  if (view === "back") c.rect(3, y(3), 10, 9, hr[0]);
  for (let x = 1; x <= 14; x++)
    for (let r = -1; r <= bottom; r++) {
      const dx = (x + 0.5 - 8) / 6.9;
      const dy = (r + 0.5 - 4) / 5.6;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      if (view === "front" && x >= 5 && r >= 5) continue;
      // Borde con bultos para que se vea esponjado.
      if (d > 0.78 && noise(x, r, 13) < 0.4) continue;
      const shade = r < 2 && x < 8 ? hr[2] : x > 11 || r > 7 ? hr[0] : hr[1];
      c.set(x, y(r), noise(x, r, 21) < 0.12 ? hr[0] : shade);
    }
  if (view === "front") c.rect(5, y(4), 7, 1, hr[1]);
}

function drawHairFront(c: PixelCanvas, style: HairStyle, t: Tones, y: Row, sway: number) {
  const hr = t.hair;
  if (style === "afro") return drawAfro(c, hr, y, "front");
  if (style === "buzz") {
    c.rect(4, y(2), 8, 2, hr[1]);
    c.rect(3, y(3), 1, 2, hr[0]);
    c.rect(12, y(3), 1, 2, hr[0]);
    c.rect(5, y(2), 3, 1, hr[2]);
    return;
  }
  if (style === "curly") {
    for (let x = 2; x <= 13; x++)
      for (let r = 0; r <= 5; r++) {
        const edge = r === 0 || x === 2 || x === 13;
        if (edge && noise(x, r, 5) < 0.45) continue;
        c.set(x, y(r), r < 2 && x < 9 ? hr[2] : x > 10 ? hr[0] : hr[1]);
      }
    c.rect(2, y(6), 2, 4, hr[1]);
    c.rect(12, y(6), 2, 3, hr[0]);
    for (const [x, r] of [
      [3, 1],
      [6, 0],
      [9, 1],
      [12, 2],
      [4, 4],
    ] as const)
      c.set(x, y(r), hr[0]);
    return;
  }
  c.rect(4, y(1), 8, 2, hr[1]);
  c.rect(3, y(2), 10, 3, hr[1]);
  c.rect(5, y(1), 3, 1, hr[2]);
  c.rect(3, y(5), 2, 4, hr[1]);
  c.rect(5, y(5), 3, 1, hr[1]);
  c.set(8, y(5), hr[0]);
  c.rect(12, y(5), 1, 2, hr[0]);
  c.rect(4, y(2), 4, 1, hr[2]);
  if (style === "long") {
    c.rect(2, y(5), 2, 9, hr[1]);
    c.rect(12, y(6), 2, 7, hr[0]);
  }
  if (style === "bun") {
    c.rect(6, y(-1), 4, 2, hr[1]);
    c.set(7, y(-1), hr[2]);
  }
  if (style === "ponytail") {
    // Atada atrás de la cabeza (a la izquierda de frente); la punta se mece al caminar. No pasa de x = 1:
    // en la columna 0 no cabría el contorno.
    c.rect(1, y(3), 2, 6, hr[1]);
    c.rect(2, y(4), 1, 5, hr[0]);
    c.set(1, y(3), hr[2]);
    c.rect(3, y(3), 1, 2, t.ribbon[1]);
    if (sway <= 0) c.set(1, y(9), hr[1]);
    if (sway >= 0) c.set(2, y(9), hr[0]);
  }
  if (style === "braids") {
    braid(c, 2, 5, 12, t, y);
    braid(c, 12, 6, 11, t, y);
  }
}

function drawHairBack(c: PixelCanvas, style: HairStyle, t: Tones, y: Row, sway: number) {
  const hr = t.hair;
  if (style === "afro") return drawAfro(c, hr, y, "back");
  if (style === "buzz") {
    c.rect(4, y(2), 8, 7, hr[1]);
    c.rect(3, y(4), 10, 4, hr[1]);
    c.rect(11, y(3), 2, 5, hr[0]);
    c.rect(5, y(2), 3, 1, hr[2]);
    return;
  }
  if (style === "curly") {
    for (let x = 2; x <= 13; x++)
      for (let r = 0; r <= 11; r++) {
        const edge = r === 0 || x === 2 || x === 13 || r === 11;
        if (edge && noise(x, r, 9) < 0.45) continue;
        c.set(x, y(r), r < 3 && x < 9 ? hr[2] : x > 10 ? hr[0] : hr[1]);
      }
    return;
  }
  c.rect(4, y(1), 8, 2, hr[1]);
  c.rect(3, y(2), 10, 9, hr[1]);
  c.rect(4, y(10), 8, 2, hr[1]);
  c.rect(11, y(4), 2, 7, hr[0]);
  c.rect(5, y(2), 3, 2, hr[2]);
  if (style === "long") c.rect(3, y(11), 10, 4, hr[1]);
  if (style === "bun") {
    c.rect(6, y(0), 4, 3, hr[1]);
    c.set(7, y(0), hr[2]);
    c.rect(6, y(3), 4, 1, hr[0]);
  }
  if (style === "ponytail") {
    // Cinta en la nuca y la cola cayendo por la espalda (con sombra a los lados para que se lea).
    c.rect(7, y(6), 2, 1, t.ribbon[1]);
    c.rect(6, y(7), 4, 4, hr[1]);
    c.rect(6, y(7), 1, 4, hr[0]);
    c.rect(9, y(7), 1, 4, hr[0]);
    c.rect(7, y(7), 1, 2, hr[2]);
    c.rect(7, y(11), 2, 3, hr[1]);
    c.rect(8, y(11), 1, 3, hr[0]);
    c.set(sway > 0 ? 8 : 7, y(14), hr[1]);
  }
  if (style === "braids") {
    braid(c, 4, 10, 14, t, y);
    braid(c, 10, 10, 14, t, y);
  }
}
