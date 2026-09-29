import { PAINTING_PIXELS } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { blankCanvas, decodeCanvas, encodeCanvas, flipCanvas, floodFill, isBlankCanvas, lineBetween, paintAt } from "./paint";

describe("lienzo de la Pintura", () => {
  it("se codifica en 256 dígitos hexadecimales y vuelve igual", () => {
    const c = paintAt(paintAt(blankCanvas(), 0, 15), 255, 10);
    const hex = encodeCanvas(c);
    expect(hex).toHaveLength(PAINTING_PIXELS);
    expect(hex[0]).toBe("f");
    expect(hex[255]).toBe("a");
    expect(decodeCanvas(hex)).toEqual(c);
    expect(decodeCanvas("xyz")).toEqual(blankCanvas());
  });

  it("pintar el mismo color no cambia el lienzo (no se guarda en el historial)", () => {
    const c = blankCanvas();
    expect(paintAt(c, 3, 0)).toBe(c);
    expect(paintAt(c, 999, 5)).toBe(c);
    expect(paintAt(c, 3, 5)).not.toBe(c);
  });

  it("el balde rellena solo la mancha conectada, sin cruzar la línea", () => {
    // Una columna de tinta en x = 4 divide el lienzo en dos.
    let c = blankCanvas() as readonly number[];
    for (let y = 0; y < 16; y++) c = paintAt(c, y * 16 + 4, 1);
    const filled = floodFill(c, 0, 7);
    expect(filled[0]).toBe(7);
    expect(filled[3 + 15 * 16]).toBe(7);
    expect(filled[4]).toBe(1);
    expect(filled[5]).toBe(0);
    expect(floodFill(filled, 0, 7)).toBe(filled);
  });

  it("el espejo voltea cada fila", () => {
    const c = paintAt(blankCanvas(), 16 + 0, 9);
    const f = flipCanvas(c);
    expect(f[16 + 15]).toBe(9);
    expect(f[16]).toBe(0);
    expect(isBlankCanvas(blankCanvas())).toBe(true);
    expect(isBlankCanvas(f)).toBe(false);
  });

  it("la línea de un arrastre une los dos píxeles sin huecos", () => {
    expect(lineBetween(0, 3)).toEqual([0, 1, 2, 3]);
    expect(lineBetween(5, 5)).toEqual([5]);
    // Diagonal de (0,0) a (3,3).
    expect(lineBetween(0, 51)).toEqual([0, 17, 34, 51]);
    // Hacia atrás también.
    expect(lineBetween(3, 0)).toEqual([3, 2, 1, 0]);
  });
});
