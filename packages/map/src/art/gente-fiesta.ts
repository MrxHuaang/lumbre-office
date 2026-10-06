// Las marquitas sobre la cabeza de la gente de la fiesta (VIR-167), chiquitas y pixel: el paquetico de un
// pedido que se le puede entregar, la chispa de "tiene algo nuevo que contar" y el globito de habla del
// murmullo (los tres puntos que aparecen uno a uno). Filas de letras como encargos.ts: `o` es el contorno.
import { hex, PixelCanvas, type RGBA } from "./pixel";

export type FiestaMarkKind = "pedido" | "nuevo" | "habla";

const PEDIDO = [
  "..o.o..", //
  ".oro.o.",
  "ooooooo",
  "oxxrxxo",
  "oxxrxxo",
  "orrrrro",
  "oxxrxxo",
  "ooooooo",
];

const NUEVO = [
  "...o...", //
  "..oyo..",
  ".oyYyo.",
  "oyYYYyo",
  ".oyYyo.",
  "..oyo..",
  "...o...",
];

const HABLA = [
  ".ooooooooo.", //
  "owwwwwwwwwo",
  "ow1ww2ww3wo",
  "owwwwwwwwwo",
  ".oowooooooo",
  "...ow......",
  "...o.......",
];

const INK: RGBA = hex("#3e2410");
const COLORS: Record<string, RGBA> = {
  o: INK,
  x: hex("#d8a868"),
  r: hex("#c0392b"),
  y: hex("#f2c230"),
  Y: hex("#fff2a8"),
  w: hex("#fffaf0"),
};

/** Cuántos cuadros tiene cada marca (el globito de habla va escribiendo los puntos). */
export const FIESTA_MARK_FRAMES: Record<FiestaMarkKind, number> = { pedido: 1, nuevo: 1, habla: 3 };

/** La marca (ancla abajo al centro), con un pixel de sombra abajo a la derecha. */
export function fiestaMark(kind: FiestaMarkKind, frame = 0): PixelCanvas {
  const rows = kind === "pedido" ? PEDIDO : kind === "nuevo" ? NUEVO : HABLA;
  const w = Math.max(...rows.map((r) => r.length)) + 1;
  const h = rows.length + 1;
  const c = new PixelCanvas(w, h);
  const shadow: RGBA = [30, 16, 8, 80];
  rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== "." && c.set(x + 1, y + 1, shadow)));
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      // Los puntos del globito: el de la posición `n` sale desde el cuadro n-1.
      if (ch >= "1" && ch <= "3") return c.set(x, y, Number(ch) - 1 <= frame ? INK : COLORS.w!);
      const col = COLORS[ch];
      if (col) c.set(x, y, col);
    }),
  );
  return c;
}
