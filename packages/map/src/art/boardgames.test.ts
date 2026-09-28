import { describe, expect, it } from "vitest";
import { boardArt, cellOfSquare, checkersPieceArt, chessPieceArt, squareAtCell, squareAtPoint, BOARD_FRAME, BOARD_PX, BOARD_SQ } from "./boardgames";

const painted = (c: { width: number; height: number; alphaAt(x: number, y: number): number }) => {
  let n = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (c.alphaAt(x, y)) n++;
  return n;
};

describe("tablero de la mesa de juego", () => {
  it("todas las piezas tienen dibujo y caben en su casilla", () => {
    for (const p of "PNBRQKpnbrqk") {
      const art = chessPieceArt(p);
      expect([art.width, art.height]).toEqual([BOARD_SQ, BOARD_SQ]);
      expect(painted(art)).toBeGreaterThan(30);
    }
    for (const p of "wWbB") expect(painted(checkersPieceArt(p))).toBeGreaterThan(60);
    // Cada pieza de ajedrez tiene una silueta distinta.
    const shapes = new Set([..."pnbrqk"].map((p) => Array.from(chessPieceArt(p).data.filter((_, i) => i % 4 === 3)).join(",")));
    expect(shapes.size).toBe(6);
  });

  it("casillas ↔ celdas de la pantalla, derecho y dado vuelta", () => {
    for (const game of ["ajedrez", "damas"] as const)
      for (const flipped of [false, true])
        for (let sq = 0; sq < 64; sq++) {
          const { col, row } = cellOfSquare(game, sq, flipped);
          expect(squareAtCell(game, col, row, flipped)).toBe(sq);
          const x = BOARD_FRAME + col * BOARD_SQ + 3;
          const y = BOARD_FRAME + row * BOARD_SQ + 3;
          expect(squareAtPoint(game, x, y, flipped)).toBe(sq);
        }
    // En ajedrez, a1 va abajo a la izquierda mirando desde las blancas y arriba a la derecha desde las negras.
    expect(cellOfSquare("ajedrez", 0, false)).toEqual({ col: 0, row: 7 });
    expect(cellOfSquare("ajedrez", 0, true)).toEqual({ col: 7, row: 0 });
    expect(squareAtPoint("ajedrez", 2, 2, false)).toBe(-1);
  });

  it("dibuja el tablero con piezas y marcas", () => {
    const squares = new Array(64).fill("");
    squares[4] = "K";
    squares[60] = "k";
    const art = boardArt({ game: "ajedrez", squares, selected: 4, targets: [3, 5], last: [52, 60], check: 4 });
    expect([art.width, art.height]).toEqual([BOARD_PX, BOARD_PX]);
    expect(painted(art)).toBe(BOARD_PX * BOARD_PX);
  });
});
