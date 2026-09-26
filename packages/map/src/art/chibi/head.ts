// Lo que va en la cabeza del chibi (encima del pelo): gorra, gorro, sombrero, audífonos, flor…
import type { PixelCanvas } from "../pixel";
import { LEAF, PETAL, PETAL_DARK, POLLEN, type Ctx, type Row, type Three, type Tones, type View } from "./kit";

export function drawHeadwear({ c, t, look, view, y }: Ctx) {
  const a = t.accent;
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
      c.rect(4, y(0), 8, 1, a[0]);
      c.set(3, y(1), a[0]);
      c.set(12, y(1), a[0]);
      c.rect(2, y(5), 2, 4, a[1]);
      c.rect(12, y(5), 2, 4, a[0]);
      return;
    case "flower":
      return drawFlower(c, view === "front" ? 4 : 11, y(2));
    default:
      // "none" y lo que todavía no tiene dibujo.
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

function drawFlower(c: PixelCanvas, x: number, row: number) {
  c.set(x, row - 1, PETAL);
  c.set(x - 1, row, PETAL);
  c.set(x + 1, row, PETAL_DARK);
  c.set(x, row + 1, PETAL_DARK);
  c.set(x, row, POLLEN);
  c.set(x + 1, row + 1, LEAF);
}
