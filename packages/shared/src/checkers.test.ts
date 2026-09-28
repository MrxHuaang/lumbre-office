import { describe, expect, it } from "vitest";
import { checkersMoves, checkersOutcome, isDarkSquare, newCheckers, playCheckers, CHECKERS_QUIET_LIMIT, type CheckersGame } from "./checkers";

/** Casilla de (fila, columna). */
const at = (r: number, c: number) => r * 8 + c;

/** Tablero vacío con esas piezas; mueve `turn`. */
function position(pieces: Record<number, string>, turn: "w" | "b" = "w"): CheckersGame {
  const board = new Array(64).fill("");
  for (const [sq, p] of Object.entries(pieces)) {
    expect(isDarkSquare(Number(sq))).toBe(true);
    board[Number(sq)] = p;
  }
  return { board, turn, quiet: 0 };
}

describe("damas: posición inicial", () => {
  it("doce peones por lado en las casillas oscuras y siete jugadas para empezar", () => {
    const g = newCheckers();
    expect(g.board.filter((p) => p === "w")).toHaveLength(12);
    expect(g.board.filter((p) => p === "b")).toHaveLength(12);
    expect(g.board.every((p, sq) => !p || isDarkSquare(sq))).toBe(true);
    expect(checkersMoves(g)).toHaveLength(7);
    // Los peones solo avanzan: las blancas hacia arriba.
    expect(checkersMoves(g).every((m) => m.path[1]! < m.path[0]!)).toBe(true);
  });

  it("no se mueve fuera de turno ni a una casilla que no sea legal", () => {
    const g = newCheckers();
    expect(playCheckers(g, [at(2, 1), at(3, 0)])).toBeNull();
    expect(playCheckers(g, [at(5, 0), at(3, 2)])).toBeNull();
    const next = playCheckers(g, [at(5, 0), at(4, 1)])!;
    expect(next.turn).toBe("b");
    expect(next.board[at(4, 1)]).toBe("w");
  });
});

describe("damas: capturas", () => {
  it("la captura es obligatoria", () => {
    const g = position({ [at(5, 2)]: "w", [at(4, 3)]: "b", [at(6, 7)]: "w", [at(0, 1)]: "b" });
    const moves = checkersMoves(g);
    expect(moves).toEqual([{ path: [at(5, 2), at(3, 4)], captured: [at(4, 3)] }]);
    expect(playCheckers(g, [at(6, 7), at(5, 6)])).toBeNull();
  });

  it("captura múltiple en una sola jugada, y la ley de la mayoría", () => {
    const g = position({
      [at(5, 0)]: "w",
      [at(4, 1)]: "b",
      [at(2, 3)]: "b",
      // Otra captura posible, pero de una sola pieza: no vale.
      [at(5, 4)]: "w",
      [at(4, 5)]: "b",
    });
    const moves = checkersMoves(g);
    expect(moves).toEqual([{ path: [at(5, 0), at(3, 2), at(1, 4)], captured: [at(4, 1), at(2, 3)] }]);
    expect(playCheckers(g, [at(5, 4), at(3, 6)])).toBeNull();
    // A medias tampoco: la captura se hace entera.
    expect(playCheckers(g, [at(5, 0), at(3, 2)])).toBeNull();
    const next = playCheckers(g, [at(5, 0), at(3, 2), at(1, 4)])!;
    expect(next.board[at(4, 1)]).toBe("");
    expect(next.board[at(2, 3)]).toBe("");
    expect(next.board[at(1, 4)]).toBe("w");
    expect(next.board.filter((p) => p === "b")).toHaveLength(1);
  });

  it("los peones capturan también hacia atrás", () => {
    const g = position({ [at(3, 2)]: "w", [at(4, 3)]: "b" });
    expect(checkersMoves(g)).toEqual([{ path: [at(3, 2), at(5, 4)], captured: [at(4, 3)] }]);
  });

  it("no se salta dos veces la misma pieza", () => {
    // Un anillo: la dama podría dar la vuelta, pero cada pieza se captura una sola vez.
    const g = position({ [at(7, 0)]: "W", [at(6, 1)]: "b", [at(0, 7)]: "b" }, "w");
    for (const m of checkersMoves(g)) expect(new Set(m.captured).size).toBe(m.captured.length);
  });
});

describe("damas: coronación y damas voladoras", () => {
  it("el peón que llega a la última fila se corona", () => {
    const g = position({ [at(1, 2)]: "w", [at(7, 0)]: "b" });
    const next = playCheckers(g, [at(1, 2), at(0, 1)])!;
    expect(next.board[at(0, 1)]).toBe("W");
  });

  it("pasar por la última fila en medio de una captura no corona", () => {
    const g = position({ [at(2, 1)]: "w", [at(1, 2)]: "b", [at(1, 4)]: "b" });
    const [move] = checkersMoves(g);
    expect(move).toEqual({ path: [at(2, 1), at(0, 3), at(2, 5)], captured: [at(1, 2), at(1, 4)] });
    const next = playCheckers(g, move!.path)!;
    expect(next.board[at(2, 5)]).toBe("w");
  });

  it("la dama se mueve a cualquier distancia en diagonal y captura de lejos", () => {
    const free = position({ [at(7, 0)]: "W", [at(0, 1)]: "b" });
    expect(checkersMoves(free).map((m) => m.path[1])).toEqual([at(6, 1), at(5, 2), at(4, 3), at(3, 4), at(2, 5), at(1, 6), at(0, 7)]);
    const far = position({ [at(7, 0)]: "W", [at(4, 3)]: "b" });
    const landings = checkersMoves(far).map((m) => m.path[1]);
    expect(landings).toEqual([at(3, 4), at(2, 5), at(1, 6), at(0, 7)]);
    const next = playCheckers(far, [at(7, 0), at(1, 6)])!;
    expect(next.board[at(4, 3)]).toBe("");
    expect(next.board[at(1, 6)]).toBe("W");
  });

  it("la dama encadena capturas", () => {
    const g = position({ [at(7, 0)]: "W", [at(5, 2)]: "b", [at(2, 3)]: "b", [at(0, 7)]: "b" });
    const moves = checkersMoves(g);
    expect(moves.every((m) => m.captured.length === 2)).toBe(true);
    expect(moves.map((m) => m.path)).toContainEqual([at(7, 0), at(3, 4), at(1, 2)]);
  });
});

describe("damas: finales", () => {
  it("pierde quien no puede mover (sin piezas o bloqueado)", () => {
    expect(checkersOutcome(position({ [at(0, 1)]: "b" }, "w"))).toEqual({ end: "blocked", winner: "b" });
    // El peón negro no tiene a dónde ir: las blancas le tapan el paso y el salto.
    const stuck = position({ [at(0, 1)]: "b", [at(1, 0)]: "w", [at(1, 2)]: "w", [at(2, 3)]: "w" }, "b");
    expect(checkersOutcome(stuck)).toEqual({ end: "blocked", winner: "w" });
  });

  it("tablas tras muchas jugadas solo de damas y sin capturas", () => {
    const g = { ...position({ [at(7, 0)]: "W", [at(0, 7)]: "B" }), quiet: CHECKERS_QUIET_LIMIT - 1 };
    const next = playCheckers(g, [at(7, 0), at(6, 1)])!;
    expect(next.quiet).toBe(CHECKERS_QUIET_LIMIT);
    expect(checkersOutcome(next)).toEqual({ end: "quiet", winner: null });
  });
});
