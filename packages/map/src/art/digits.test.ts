import { describe, expect, it } from "vitest";
import { DIGITS, GLYPH_H, drawText, glyph, textMask, textWidth } from "./digits";
import { PixelCanvas } from "./pixel";

/** Cuántos puntos cambian entre dos dígitos. */
const distance = (a: number, b: number) => {
  let d = 0;
  for (let y = 0; y < GLYPH_H; y++) for (let x = 0; x < 5; x++) if (DIGITS[a]![y]![x] !== DIGITS[b]![y]![x]) d++;
  return d;
};

describe("números pixel del casino", () => {
  it("los diez dígitos miden 5x7", () => {
    expect(DIGITS).toHaveLength(10);
    for (const g of DIGITS) {
      expect(g).toHaveLength(GLYPH_H);
      for (const row of g) expect(row).toMatch(/^[.#]{5}$/);
    }
  });

  it("ningún par de dígitos se parece demasiado", () => {
    for (let a = 0; a < 10; a++) for (let b = a + 1; b < 10; b++) expect(distance(a, b), `${a} y ${b}`).toBeGreaterThanOrEqual(4);
  });

  it("los pares que más se confunden quedan bien distintos", () => {
    for (const [a, b] of [
      [1, 7],
      [3, 8],
      [6, 9],
      [0, 8],
      [5, 6],
    ] as const)
      expect(distance(a, b), `${a} y ${b}`).toBeGreaterThanOrEqual(6);
  });

  it("todas las letras tienen 7 filas del mismo ancho", () => {
    for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ-+:./! ") {
      const g = glyph(ch);
      expect(g, ch).toBeDefined();
      expect(g).toHaveLength(GLYPH_H);
      for (const row of g!) expect(row.length, ch).toBe(g![0]!.length);
    }
  });

  it("mide y escribe el texto a escala 1 y 2", () => {
    expect(textWidth("17")).toBe(11);
    expect(textWidth("17", { scale: 2 })).toBe(22);
    expect(textWidth("2:1")).toBe(14);
    const m = textMask("10");
    expect(m.w).toBe(11);
    const c = new PixelCanvas(30, 20);
    drawText(c, "8", 2, 3, [255, 255, 255, 255], { scale: 2 });
    // La cintura del 8: fila 3 del dibujo, columnas 1 a 3 → píxeles (4..9, 9..10) prendidos.
    expect(c.alphaAt(4, 9)).toBe(255);
    expect(c.alphaAt(2, 9)).toBe(0);
  });
});
