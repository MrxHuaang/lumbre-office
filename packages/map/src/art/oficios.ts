// Lo de los oficios que se dibuja en la cabaña: la placa chiquita con el nivel de vecino que va junto al
// nombre (números de 3x5 sobre madera) y la chispa dorada de subir de nivel.
import { hex, PixelCanvas, type RGBA } from "./pixel";

const DIGITS: Record<string, string[]> = {
  "0": ["xxx", "x.x", "x.x", "x.x", "xxx"],
  "1": [".x.", "xx.", ".x.", ".x.", "xxx"],
  "2": ["xxx", "..x", "xxx", "x..", "xxx"],
  "3": ["xxx", "..x", ".xx", "..x", "xxx"],
  "4": ["x.x", "x.x", "xxx", "..x", "..x"],
  "5": ["xxx", "x..", "xxx", "..x", "xxx"],
  "6": ["xxx", "x..", "xxx", "x.x", "xxx"],
  "7": ["xxx", "..x", ".x.", ".x.", ".x."],
  "8": ["xxx", "x.x", "xxx", "x.x", "xxx"],
  "9": ["xxx", "x.x", "xxx", "..x", "xxx"],
};

const WOOD = hex("#6b4226");
const EDGE = hex("#3a2214");
const INK = hex("#fff2c8");

/** La placa del nivel de vecino (5 a 50): madera con el número claro, el alto de la insignia (7). */
export function neighborPlate(level: number): PixelCanvas {
  const text = String(Math.max(0, Math.min(99, Math.round(level))));
  const w = text.length * 4 + 3;
  const h = 7;
  const c = new PixelCanvas(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      // Las esquinas quedan vacías (placa redondeada).
      if (edge && (x === 0 || x === w - 1) && (y === 0 || y === h - 1)) continue;
      c.set(x, y, edge ? EDGE : WOOD);
    }
  [...text].forEach((d, i) => DIGITS[d]!.forEach((row, y) => [...row].forEach((ch, x) => ch === "x" && c.set(2 + i * 4 + x, 1 + y, INK))));
  return c;
}

/** Chispa de subir de nivel (7x7): una estrellita dorada con centro claro. */
export function levelSpark(): PixelCanvas {
  const rows = ["...o...", "...y...", ".o.y.o.", "oyyWyyo", ".o.y.o.", "...y...", "...o..."];
  const col: Record<string, RGBA> = { o: hex("#c8871c"), y: hex("#f2c230"), W: hex("#fff8d8") };
  const c = new PixelCanvas(7, 7);
  rows.forEach((r, y) => [...r].forEach((ch, x) => col[ch] && c.set(x, y, col[ch]!)));
  return c;
}
