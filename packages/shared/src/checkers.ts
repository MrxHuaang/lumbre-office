// Damas en tablero de 8x8, con las reglas internacionales simplificadas: se juega en las casillas
// oscuras, empiezan las blancas, los peones avanzan en diagonal de a una y capturan hacia adelante y
// hacia atrás, la captura es obligatoria y hay que tomar la mayor cantidad de piezas (ley de la
// mayoría), las capturas múltiples se hacen enteras en la misma jugada, y el peón que termina la jugada
// en la última fila se corona dama, que vuela (se mueve y captura a cualquier distancia). Pierde quien no
// puede mover; tablas si pasan 50 jugadas seguidas solo de damas y sin capturas. Puro: lo usan el
// servidor y el navegador.

/**
 * Casillas 0..63: índice = fila * 8 + columna, con la fila 0 arriba (la casa de las negras) y la 7
 * abajo (la de las blancas). Solo se usan las oscuras: (fila + columna) impar. Piezas: "w" peón
 * blanco, "W" dama blanca, "b" peón negro, "B" dama negra, "" vacía.
 */
export type CheckersBoard = string[];
export type CheckersColor = "w" | "b";

export interface CheckersGame {
  board: CheckersBoard;
  turn: CheckersColor;
  /** Jugadas seguidas (medios movimientos) solo de damas y sin capturas. */
  quiet: number;
}

export interface CheckersMove {
  /** Casillas por las que pasa la pieza: la de salida, las de cada salto y la de llegada. */
  path: number[];
  /** Piezas que se captura (en orden). */
  captured: number[];
}

/** Jugadas tranquilas (solo damas, sin capturas) para las tablas. */
export const CHECKERS_QUIET_LIMIT = 50;

export const isDarkSquare = (sq: number) => ((sq >> 3) + (sq & 7)) % 2 === 1;
const colorOf = (p: string): CheckersColor | null => (p === "" ? null : (p.toLowerCase() as CheckersColor));
const isKing = (p: string) => p === "W" || p === "B";
const other = (c: CheckersColor): CheckersColor => (c === "w" ? "b" : "w");
const DIAGONALS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;

function offset(sq: number, dr: number, dc: number): number {
  const r = (sq >> 3) + dr;
  const c = (sq & 7) + dc;
  return r < 0 || r > 7 || c < 0 || c > 7 ? -1 : r * 8 + c;
}

export function newCheckers(): CheckersGame {
  const board: CheckersBoard = new Array(64).fill("");
  for (let sq = 0; sq < 64; sq++) {
    if (!isDarkSquare(sq)) continue;
    const row = sq >> 3;
    if (row <= 2) board[sq] = "b";
    else if (row >= 5) board[sq] = "w";
  }
  return { board, turn: "w", quiet: 0 };
}

/** El tablero en 64 letras (".", w, W, b, B), fila por fila desde arriba. */
export const checkersToText = (board: CheckersBoard) => board.map((p) => p || ".").join("");

export function checkersFromText(text: string, turn: CheckersColor = "w", quiet = 0): CheckersGame {
  if (text.length !== 64 || /[^.wWbB]/.test(text)) throw new Error("Tablero de damas inválido");
  return { board: [...text].map((ch) => (ch === "." ? "" : ch)), turn, quiet };
}

/**
 * Capturas que siguen desde `sq` con la pieza `piece` (que ya capturó `taken`). Las piezas capturadas
 * siguen en el tablero hasta el final de la jugada: no se saltan dos veces y estorban.
 */
function captureChains(board: CheckersBoard, sq: number, piece: string, taken: number[], path: number[], out: CheckersMove[]) {
  const me = colorOf(piece)!;
  let extended = false;
  for (const [dr, dc] of DIAGONALS) {
    if (isKing(piece)) {
      // La dama vuela: busca la primera pieza en la diagonal y aterriza en cualquier casilla libre detrás.
      let s = offset(sq, dr, dc);
      while (s >= 0 && !board[s]) s = offset(s, dr, dc);
      if (s < 0 || colorOf(board[s]!) === me || taken.includes(s)) continue;
      let land = offset(s, dr, dc);
      while (land >= 0 && !board[land]) {
        extended = true;
        captureChains(board, land, piece, [...taken, s], [...path, land], out);
        land = offset(land, dr, dc);
      }
    } else {
      const over = offset(sq, dr, dc);
      const land = offset(sq, dr * 2, dc * 2);
      if (over < 0 || land < 0 || board[land] || taken.includes(over)) continue;
      if (colorOf(board[over]!) !== other(me)) continue;
      extended = true;
      captureChains(board, land, piece, [...taken, over], [...path, land], out);
    }
  }
  if (!extended && taken.length) out.push({ path, captured: taken });
}

/** Jugadas legales del que mueve: si hay capturas, solo las más largas; si no, los pasos simples. */
export function checkersMoves(g: CheckersGame): CheckersMove[] {
  const captures: CheckersMove[] = [];
  const steps: CheckersMove[] = [];
  const forward = g.turn === "w" ? -1 : 1;
  for (let sq = 0; sq < 64; sq++) {
    const p = g.board[sq]!;
    if (colorOf(p) !== g.turn) continue;
    // Mientras dura la captura la pieza ya no está en su casilla (se puede pasar por ahí de nuevo).
    const board = [...g.board];
    board[sq] = "";
    captureChains(board, sq, p, [], [sq], captures);
    for (const [dr, dc] of DIAGONALS) {
      if (!isKing(p) && dr !== forward) continue;
      let s = offset(sq, dr, dc);
      while (s >= 0 && !g.board[s]) {
        steps.push({ path: [sq, s], captured: [] });
        if (!isKing(p)) break;
        s = offset(s, dr, dc);
      }
    }
  }
  if (!captures.length) return steps;
  const most = Math.max(...captures.map((m) => m.captured.length));
  return captures.filter((m) => m.captured.length === most);
}

const samePath = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Juega el recorrido `path` si es una jugada legal y devuelve la posición nueva (o null). */
export function playCheckers(g: CheckersGame, path: readonly number[]): CheckersGame | null {
  const move = checkersMoves(g).find((m) => samePath(m.path, path));
  if (!move) return null;
  const board = [...g.board];
  const from = path[0]!;
  const to = path.at(-1)!;
  let piece = board[from]!;
  board[from] = "";
  for (const c of move.captured) board[c] = "";
  // Se corona solo si la jugada termina en la última fila (pasar por ella en una captura no alcanza).
  const lastRow = g.turn === "w" ? 0 : 7;
  const crowned = !isKing(piece) && to >> 3 === lastRow;
  if (crowned) piece = piece.toUpperCase();
  board[to] = piece;
  const quiet = move.captured.length || !isKing(g.board[from]!) ? 0 : g.quiet + 1;
  return { board, turn: other(g.turn), quiet };
}

/** ¿Terminó? Pierde quien no puede mover (sin piezas o bloqueado); tablas por jugadas tranquilas. */
export function checkersOutcome(g: CheckersGame): { end: "blocked" | "quiet"; winner: CheckersColor | null } | null {
  if (!checkersMoves(g).length) return { end: "blocked", winner: other(g.turn) };
  if (g.quiet >= CHECKERS_QUIET_LIMIT) return { end: "quiet", winner: null };
  return null;
}
