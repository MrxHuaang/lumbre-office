// Las marcas de los encargos sobre quien los da (solo las ve cada quien): "!" en papel crema cuando uno
// suyo está en curso y "?" dorado cuando está listo para entregar. Filas de letras, como items.ts: `o` es el
// contorno, el resto se pinta con luz de arriba a la izquierda (el borde de arriba más claro).
import { hex, PixelCanvas, type RGBA } from "./pixel";

export type QuestMarkKind = "active" | "ready";

const BANG = [
  ".ooo.",
  "oxxxo",
  "oxxxo",
  "oxxxo",
  "oxxxo",
  ".oxo.",
  ".oxo.",
  "..o..",
  ".ooo.",
  "oxxxo",
  "oxxxo",
  ".ooo.",
];

const ASK = [
  "..oooo..",
  ".oxxxxo.",
  "oxxooxxo",
  "oxo..oxo",
  ".o..oxxo",
  "...oxxo.",
  "..oxxo..",
  "..oxxo..",
  "...oo...",
  "..oooo..",
  "..oxxo..",
  "..oxxo..",
  "..oooo..",
];

const COLORS: Record<QuestMarkKind, { hi: RGBA; mid: RGBA; lo: RGBA; line: RGBA }> = {
  // Papel crema con borde de madera (como las notas del tablón).
  active: { hi: hex("#fffaf0"), mid: hex("#f4e6c4"), lo: hex("#d8c294"), line: hex("#4a2e1c") },
  // Dorado de moneda con el contorno café oscuro.
  ready: { hi: hex("#fff2a8"), mid: hex("#f2c230"), lo: hex("#c8871c"), line: hex("#3e2410") },
};

/** La marca de un encargo (ancla abajo al centro), con un pixel de sombra abajo a la derecha. */
export function questMark(kind: QuestMarkKind): PixelCanvas {
  const rows = kind === "active" ? BANG : ASK;
  const w = Math.max(...rows.map((r) => r.length)) + 1;
  const h = rows.length + 1;
  const c = new PixelCanvas(w, h);
  const col = COLORS[kind];
  const shadow: RGBA = [30, 16, 8, 90];
  // La sombra: toda la forma corrida un pixel.
  rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== "." && c.set(x + 1, y + 1, shadow)));
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      if (ch === "o") return c.set(x, y, col.line);
      // Luz de arriba a la izquierda: el borde de arriba/izquierda aclara, el de abajo/derecha oscurece.
      const up = rows[y - 1]?.[x] !== "x";
      const left = row[x - 1] !== "x";
      const down = rows[y + 1]?.[x] !== "x";
      const right = row[x + 1] !== "x";
      c.set(x, y, up || left ? col.hi : down || right ? col.lo : col.mid);
    }),
  );
  return c;
}
