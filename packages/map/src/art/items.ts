// Productos de la cafetería en pixel-art: se llevan en la mano y salen en el menú de la barra.
// Son chiquitos (caben en la mano del chibi); el menú los muestra ampliados.
import { OUT } from "./palette";
import { PixelCanvas, alpha, hex, type RGBA } from "./pixel";

type Legend = Record<string, RGBA>;

const CUP: Legend = { w: hex("#f4ecdc"), W: hex("#cbbba2") };

/** Cada producto: filas de caracteres ("." = vacío, "o" = contorno) y los colores de sus letras. */
const ITEMS: Record<string, { rows: string[]; colors: Legend; drink: boolean }> = {
  tinto: {
    drink: true,
    rows: [
      ".ooooo.", //
      ".occco.",
      ".owwWoo",
      ".owwWoo",
      "ooooooo",
      "oWwwwWo",
      ".ooooo.",
    ],
    colors: { ...CUP, c: hex("#3b1f14") },
  },
  "cafe-leche": {
    drink: true,
    rows: [
      "oooooo..", //
      "offfFo..",
      "ommmMoo.",
      "ommmMo.o",
      "ommmMoo.",
      "ommmMo..",
      ".oooo...",
    ],
    colors: { f: hex("#f2d9b0"), F: hex("#c9955e"), m: hex("#d0694a"), M: hex("#9c4632") },
  },
  aromatica: {
    drink: true,
    rows: [
      "oooooo", //
      "ohaaao",
      "ohArao",
      "oaaaAo",
      "ohraao",
      ".oooo.",
    ],
    colors: { a: hex("#e8894a"), A: hex("#c9552f"), r: hex("#8cc653"), h: alpha(hex("#fff6dc"), 0.85) },
  },
  chocolate: {
    drink: true,
    rows: [
      "oooooo...", //
      "okkkko...",
      "owwwWoo..",
      "owwwWo.o.",
      "owwwWoooo",
      "owwwWoyyo",
      ".ooooyYyo",
      ".....oooo",
    ],
    colors: { ...CUP, k: hex("#6b3a22"), y: hex("#f6e3a0"), Y: hex("#e0c270") },
  },
  pandebono: {
    drink: false,
    rows: [
      "..oooo..", //
      ".obBbbo.",
      "obBbbdbo",
      "obbdbbbo",
      "obbbbbDo",
      ".oDbbDo.",
      "..oooo..",
    ],
    colors: { b: hex("#ecc070"), B: hex("#f8e0a0"), d: hex("#c98a3a"), D: hex("#b87a30") },
  },
  bunuelo: {
    drink: false,
    rows: [
      "..oooo..", //
      ".obBbbo.",
      "obBbbbbo",
      "obbbbbdo",
      "obbbbddo",
      ".odddDo.",
      "..oooo..",
    ],
    colors: { b: hex("#d99a45"), B: hex("#f0c476"), d: hex("#b0702a"), D: hex("#8c5520") },
  },
  torta: {
    drink: false,
    rows: [
      "...r...", //
      ".ooroo.",
      "owwwwwo",
      "oyyyyYo",
      "owwwwWo",
      "oyyyyYo",
      "ooooooo",
      "oPppppo",
      ".ooooo.",
    ],
    colors: {
      w: hex("#fff4dc"),
      W: hex("#e8d6b0"),
      y: hex("#f0d28a"),
      Y: hex("#d8b264"),
      r: hex("#d93a2b"),
      p: hex("#f4ecdc"),
      P: hex("#cbbba2"),
    },
  },
};

export const CAFE_ITEM_ART = Object.keys(ITEMS);

/** ¿Echa vapor? (las bebidas calientes) */
export function isDrinkArt(id: string): boolean {
  return ITEMS[id]?.drink ?? false;
}

/** Sprite de un producto (sin escalar). Un id desconocido devuelve un lienzo vacío de 1x1. */
export function drawCafeItem(id: string): PixelCanvas {
  const item = ITEMS[id];
  if (!item) return new PixelCanvas(1, 1);
  const w = Math.max(...item.rows.map((r) => r.length));
  const c = new PixelCanvas(w, item.rows.length);
  item.rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      const color = ch === "o" ? OUT : item.colors[ch];
      if (color) c.set(x, y, color);
    }),
  );
  return c;
}

/** Bocanada de vapor (se anima en el juego subiendo y desvaneciéndose). */
export function steamPuff(): PixelCanvas {
  const c = new PixelCanvas(3, 4);
  const s = alpha(hex("#fff8e8"), 0.8);
  c.set(1, 0, s);
  c.set(0, 1, s);
  c.set(1, 2, s);
  c.set(2, 3, alpha(hex("#fff8e8"), 0.5));
  return c;
}
