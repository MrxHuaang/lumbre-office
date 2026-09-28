import { describe, expect, it } from "vitest";
import {
  chessFromFen,
  chessMoves,
  chessOutcome,
  chessPositionKey,
  chessToFen,
  CHESS_START_FEN,
  inCheck,
  insufficientMaterial,
  isPromotion,
  newChess,
  playChess,
  squareIndex,
  squareName,
  type ChessGame,
} from "./chess";

const sq = squareIndex;
/** Juega en notación "e2e4" (con la pieza de coronación al final: "a7a8n"). */
function play(g: ChessGame, ...moves: string[]): ChessGame {
  for (const m of moves) {
    const next = playChess(g, { from: sq(m.slice(0, 2)), to: sq(m.slice(2, 4)), promo: (m[4] as "q" | "n" | undefined) ?? undefined });
    if (!next) throw new Error(`Jugada ilegal: ${m} en ${chessToFen(g)}`);
    g = next;
  }
  return g;
}

/** Cuenta las hojas del árbol de jugadas hasta `depth` (el test clásico de los generadores de jugadas). */
function perft(g: ChessGame, depth: number): number {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of chessMoves(g)) {
    const next = playChess(g, m)!;
    n += perft(next, depth - 1);
  }
  return n;
}

describe("ajedrez: casillas y FEN", () => {
  it("nombra las casillas y va y vuelve de FEN", () => {
    expect(squareName(12)).toBe("e2");
    expect(sq("e2")).toBe(12);
    expect(sq("z9")).toBe(-1);
    expect(chessToFen(newChess())).toBe(CHESS_START_FEN);
    const fen = "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1";
    expect(chessToFen(chessFromFen(fen))).toBe(fen);
  });
});

describe("ajedrez: generador de jugadas (perft)", () => {
  it("posición inicial", () => {
    const g = newChess();
    expect(perft(g, 1)).toBe(20);
    expect(perft(g, 2)).toBe(400);
    expect(perft(g, 3)).toBe(8902);
  });

  it("Kiwipete: enroques, al paso, coronaciones y clavadas", () => {
    const g = chessFromFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1");
    expect(perft(g, 1)).toBe(48);
    expect(perft(g, 2)).toBe(2039);
  });

  it("final con al paso y jaques descubiertos", () => {
    const g = chessFromFen("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1");
    expect(perft(g, 1)).toBe(14);
    expect(perft(g, 2)).toBe(191);
    expect(perft(g, 3)).toBe(2812);
  });

  it("posición 4: coronaciones con captura y enroques perdidos", () => {
    const g = chessFromFen("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1");
    expect(perft(g, 1)).toBe(6);
    expect(perft(g, 2)).toBe(264);
    expect(perft(g, 3)).toBe(9467);
  });
});

describe("ajedrez: reglas especiales", () => {
  it("no deja mover una pieza clavada ni dejar al rey en jaque", () => {
    // El caballo de e2 está clavado por la torre de e8.
    const g = chessFromFen("4r1k1/8/8/8/8/8/4N3/4K3 w - - 0 1");
    expect(chessMoves(g, sq("e2"))).toEqual([]);
    expect(playChess(g, { from: sq("e2"), to: sq("c3") })).toBeNull();
  });

  it("enroque corto y largo; no se enroca en jaque ni pasando por una casilla atacada", () => {
    const g = chessFromFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    const king = chessMoves(g, sq("e1")).map((m) => squareName(m.to));
    expect(king).toContain("g1");
    expect(king).toContain("c1");
    const short = play(g, "e1g1");
    expect(short.board[sq("g1")]).toBe("K");
    expect(short.board[sq("f1")]).toBe("R");
    expect(short.board[sq("h1")]).toBe("");
    expect(short.castling).toBe("kq");
    const long = play(g, "e1c1");
    expect(long.board[sq("d1")]).toBe("R");
    expect(long.board[sq("a1")]).toBe("");
    // La torre de f8 ataca f1: el corto no se puede, el largo sí.
    const attacked = chessFromFen("4kr2/8/8/8/8/8/8/R3K2R w KQ - 0 1");
    const moves = chessMoves(attacked, sq("e1")).map((m) => squareName(m.to));
    expect(moves).not.toContain("g1");
    expect(moves).toContain("c1");
    // En jaque, ninguno.
    const check = chessFromFen("4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1");
    expect(chessMoves(check, sq("e1")).map((m) => squareName(m.to))).not.toContain("g1");
    // Mover la torre quita ese enroque.
    expect(play(g, "h1h2").castling).toBe("Qkq");
  });

  it("captura al paso, solo justo después del avance doble", () => {
    let g = play(newChess(), "e2e4", "a7a6", "e4e5", "d7d5");
    expect(g.ep).toBe(sq("d6"));
    const after = play(g, "e5d6");
    expect(after.board[sq("d5")]).toBe("");
    expect(after.board[sq("d6")]).toBe("P");
    // Si se juega otra cosa, se pierde.
    g = play(g, "h2h3", "h7h6");
    expect(playChess(g, { from: sq("e5"), to: sq("d6") })).toBeNull();
  });

  it("coronación: a dama si no se elige, o a la pieza elegida", () => {
    const g = chessFromFen("8/P7/8/8/8/8/8/k6K w - - 0 1");
    expect(isPromotion(g, sq("a7"), sq("a8"))).toBe(true);
    expect(play(g, "a7a8").board[sq("a8")]).toBe("Q");
    expect(play(g, "a7a8n").board[sq("a8")]).toBe("N");
    const black = chessFromFen("K6k/8/8/8/8/8/p7/8 b - - 0 1");
    expect(play(black, "a2a1r").board[sq("a1")]).toBe("r");
  });
});

describe("ajedrez: finales", () => {
  it("mate del pastor", () => {
    const g = play(newChess(), "e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6", "h5f7");
    expect(inCheck(g)).toBe(true);
    expect(chessOutcome(g)).toEqual({ end: "mate", winner: "w" });
  });

  it("jaque que no es mate", () => {
    const g = play(newChess(), "e2e4", "f7f6", "d1h5");
    expect(inCheck(g)).toBe(true);
    expect(chessOutcome(g)).toBeNull();
  });

  it("ahogado", () => {
    const g = chessFromFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    expect(inCheck(g)).toBe(false);
    expect(chessOutcome(g)).toEqual({ end: "stalemate", winner: null });
  });

  it("material insuficiente", () => {
    expect(insufficientMaterial(chessFromFen("4k3/8/8/8/8/8/8/4K3 w - - 0 1").board)).toBe(true);
    expect(insufficientMaterial(chessFromFen("4k3/8/8/8/8/8/8/4KN2 w - - 0 1").board)).toBe(true);
    expect(insufficientMaterial(chessFromFen("4k3/8/8/8/8/8/8/2B1KB2 w - - 0 1").board)).toBe(false);
    // Alfiles de los dos lados en casillas del mismo color: tablas.
    expect(insufficientMaterial(chessFromFen("2b1k3/8/8/8/8/8/8/4KB2 w - - 0 1").board)).toBe(true);
    expect(insufficientMaterial(chessFromFen("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1").board)).toBe(false);
    expect(chessOutcome(chessFromFen("4k3/8/8/8/8/8/8/4KN2 w - - 0 1"))).toEqual({ end: "material", winner: null });
  });

  it("regla de los 50 movimientos", () => {
    const g = chessFromFen("4k3/8/8/8/8/8/8/R3K3 w - - 99 80");
    const next = play(g, "a1a2");
    expect(next.halfmove).toBe(100);
    expect(chessOutcome(next)).toEqual({ end: "fifty", winner: null });
    // Una jugada de peón (o una captura) vuelve a contar desde cero.
    expect(play(newChess(), "e2e4").halfmove).toBe(0);
  });

  it("triple repetición", () => {
    let g = newChess();
    const seen = [chessPositionKey(g)];
    for (const m of ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1"]) {
      g = play(g, m);
      expect(chessOutcome(g, seen)).toBeNull();
      seen.push(chessPositionKey(g));
    }
    g = play(g, "f6g8");
    expect(chessOutcome(g, seen)).toEqual({ end: "repetition", winner: null });
  });
});
