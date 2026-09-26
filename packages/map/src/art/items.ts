// Productos de la cafetería en pixel-art: se llevan en la mano y salen en el menú de la barra.
// Son chiquitos (caben en la mano del chibi); el menú los muestra ampliados.
import { OUT } from "./palette";
import { PixelCanvas, alpha, hex, type RGBA } from "./pixel";

type Legend = Record<string, RGBA>;

const CUP: Legend = { w: hex("#f4ecdc"), W: hex("#cbbba2") };

/** Vapor (bebidas calientes) o humo (el cigarro) que sale del producto en la mano. */
export type HeldEffect = "steam" | "smoke";

/**
 * Cada producto: filas de caracteres ("." = vacío, "o" = contorno), los colores de sus letras y, si echa
 * vapor o humo, desde qué píxel sale (`from`, relativo a la esquina de arriba a la izquierda).
 */
const ITEMS: Record<string, { rows: string[]; colors: Legend; fx?: HeldEffect; from?: [number, number] }> = {
  tinto: {
    fx: "steam",
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
    fx: "steam",
    from: [2, 0],
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
    fx: "steam",
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
    fx: "steam",
    from: [2, 0],
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
  cigarro: {
    fx: "smoke",
    from: [5, 0],
    rows: [
      "oooooo", //
      "ofwwwe",
      "oooooo",
    ],
    colors: { f: hex("#d9923e"), w: hex("#f4ecdc"), e: hex("#ff7a2a") },
  },
  "coca-cola": {
    rows: [
      ".ooo.", //
      "ossso",
      "orrRo",
      "owwro",
      "orwwo",
      "orrRo",
      "ossso",
      ".ooo.",
    ],
    colors: { s: hex("#c9c9d0"), r: hex("#d42a2a"), R: hex("#9c1c1c"), w: hex("#f4ecdc") },
  },
};

export const CAFE_ITEM_ART = Object.keys(ITEMS);

/** Vapor o humo del producto y el píxel del que sale (por defecto, el centro de arriba). */
export function heldEffect(id: string): { fx: HeldEffect; from: [number, number] } | null {
  const item = ITEMS[id];
  if (!item?.fx) return null;
  const w = Math.max(...item.rows.map((r) => r.length));
  return { fx: item.fx, from: item.from ?? [Math.floor(w / 2), 0] };
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

/** Bocanada de vapor (blanca) o de humo (gris): se anima en el juego subiendo y desvaneciéndose. */
export function puff(fx: HeldEffect = "steam"): PixelCanvas {
  const c = new PixelCanvas(3, 4);
  const color = fx === "smoke" ? hex("#b8b0bc") : hex("#fff8e8");
  const s = alpha(color, 0.8);
  c.set(1, 0, s);
  c.set(0, 1, s);
  c.set(1, 2, s);
  c.set(2, 3, alpha(color, 0.5));
  return c;
}
