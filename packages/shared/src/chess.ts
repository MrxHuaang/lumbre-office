// Ajedrez completo para la mesa de la sala de juegos: movimientos legales (sin dejar al rey en jaque),
// enroque, captura al paso, coronación (a elección; si no se dice, dama), jaque, mate, ahogado y tablas
// por 50 movimientos, material insuficiente y triple repetición. Lo usan el servidor (que valida cada
// jugada) y el navegador (que resalta las casillas legales). Sin dependencias: todo puro.

/**
 * Casillas 0..63: índice = fila * 8 + columna, con la fila 0 = la "1" (la de las blancas) y la columna
 * 0 = la "a". Piezas en letras como en FEN: mayúsculas blancas (PNBRQK), minúsculas negras; "" vacía.
 */
export type ChessBoard = string[];
export type ChessColor = "w" | "b";
export type ChessPromo = "q" | "r" | "b" | "n";

export interface ChessGame {
  board: ChessBoard;
  turn: ChessColor;
  /** Enroques que quedan: subconjunto de "KQkq" ("" si ninguno). */
  castling: string;
  /** Casilla donde se puede capturar al paso (la que saltó el peón), o -1. */
  ep: number;
  /** Medios movimientos desde la última captura o jugada de peón (regla de los 50). */
  halfmove: number;
  fullmove: number;
}

export interface ChessMove {
  from: number;
  to: number;
  /** Solo si es coronación: a qué pieza. */
  promo?: ChessPromo;
}

export type ChessEnd = "mate" | "stalemate" | "fifty" | "material" | "repetition";

export const CHESS_START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const fileOf = (sq: number) => sq & 7;
export const rankOf = (sq: number) => sq >> 3;
const FILES = "abcdefgh";

/** 12 → "e2". */
export const squareName = (sq: number) => `${FILES[fileOf(sq)]}${rankOf(sq) + 1}`;
/** "e2" → 12 (o -1 si no es una casilla). */
export function squareIndex(name: string): number {
  const f = FILES.indexOf(name[0] ?? "");
  const r = Number(name[1]) - 1;
  return f < 0 || !(r >= 0 && r < 8) || name.length !== 2 ? -1 : r * 8 + f;
}

const isWhite = (p: string) => p !== "" && p === p.toUpperCase();
const colorOfPiece = (p: string): ChessColor | null => (p === "" ? null : isWhite(p) ? "w" : "b");
const other = (c: ChessColor): ChessColor => (c === "w" ? "b" : "w");

// ---------- FEN ----------

export function chessFromFen(fen: string): ChessGame {
  const [placement = "", turn = "w", castling = "-", ep = "-", half = "0", full = "1"] = fen.trim().split(/\s+/);
  const board: ChessBoard = new Array(64).fill("");
  const rows = placement.split("/");
  if (rows.length !== 8) throw new Error(`FEN inválido: ${fen}`);
  rows.forEach((row, i) => {
    const rank = 7 - i;
    let file = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) file += Number(ch);
      else {
        if (!/[pnbrqkPNBRQK]/.test(ch) || file > 7) throw new Error(`FEN inválido: ${fen}`);
        board[rank * 8 + file] = ch;
        file++;
      }
    }
    if (file !== 8) throw new Error(`FEN inválido: ${fen}`);
  });
  return {
    board,
    turn: turn === "b" ? "b" : "w",
    castling: castling === "-" ? "" : [..."KQkq"].filter((c) => castling.includes(c)).join(""),
    ep: ep === "-" ? -1 : squareIndex(ep),
    halfmove: Number(half) || 0,
    fullmove: Number(full) || 1,
  };
}

/** La parte de la posición que cuenta para la repetición (sin los contadores). */
function placementOf(board: ChessBoard): string {
  const rows: string[] = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = "";
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const p = board[rank * 8 + file]!;
      if (!p) empty++;
      else {
        if (empty) row += empty;
        empty = 0;
        row += p;
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return rows.join("/");
}

export function chessToFen(g: ChessGame): string {
  return `${placementOf(g.board)} ${g.turn} ${g.castling || "-"} ${g.ep >= 0 ? squareName(g.ep) : "-"} ${g.halfmove} ${g.fullmove}`;
}

/**
 * Clave para la triple repetición: piezas, turno, enroques y al paso (solo si de verdad se puede
 * capturar al paso, como pide el reglamento).
 */
export function chessPositionKey(g: ChessGame): string {
  const epLive = g.ep >= 0 && pseudoMoves(g).some((m) => m.to === g.ep && g.board[m.from]!.toLowerCase() === "p");
  return `${placementOf(g.board)} ${g.turn} ${g.castling || "-"} ${epLive ? squareName(g.ep) : "-"}`;
}

export const newChess = () => chessFromFen(CHESS_START_FEN);

// ---------- Ataques ----------

const KNIGHT = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
] as const;
const KING = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
] as const;
const ROOK_DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const BISHOP_DIRS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

/** Casilla a (df, dr) de `sq`, o -1 si se sale del tablero. */
function offset(sq: number, df: number, dr: number): number {
  const f = fileOf(sq) + df;
  const r = rankOf(sq) + dr;
  return f < 0 || f > 7 || r < 0 || r > 7 ? -1 : r * 8 + f;
}

/** ¿Ataca alguna pieza de `by` la casilla `sq`? */
export function isAttacked(board: ChessBoard, sq: number, by: ChessColor): boolean {
  const own = (p: string) => colorOfPiece(p) === by;
  const is = (p: string, kind: string) => own(p) && p.toLowerCase() === kind;
  // Peones: atacan en diagonal hacia adelante (se mira desde la casilla atacada hacia atrás).
  const back = by === "w" ? -1 : 1;
  for (const df of [-1, 1]) {
    const s = offset(sq, df, back);
    if (s >= 0 && is(board[s]!, "p")) return true;
  }
  for (const [df, dr] of KNIGHT) {
    const s = offset(sq, df, dr);
    if (s >= 0 && is(board[s]!, "n")) return true;
  }
  for (const [df, dr] of KING) {
    const s = offset(sq, df, dr);
    if (s >= 0 && is(board[s]!, "k")) return true;
  }
  const slide = (dirs: readonly (readonly [number, number])[], kinds: string) => {
    for (const [df, dr] of dirs) {
      let s = offset(sq, df, dr);
      while (s >= 0) {
        const p = board[s]!;
        if (p) {
          if (own(p) && kinds.includes(p.toLowerCase())) return true;
          break;
        }
        s = offset(s, df, dr);
      }
    }
    return false;
  };
  return slide(ROOK_DIRS, "rq") || slide(BISHOP_DIRS, "bq");
}

const kingSquare = (board: ChessBoard, c: ChessColor) => board.indexOf(c === "w" ? "K" : "k");

/** ¿Está en jaque el rey de `c` (por defecto, el que mueve)? */
export function inCheck(g: ChessGame, c: ChessColor = g.turn): boolean {
  const k = kingSquare(g.board, c);
  return k >= 0 && isAttacked(g.board, k, other(c));
}

// ---------- Movimientos ----------

/** Jugadas que siguen las reglas de cada pieza, sin mirar si dejan al rey propio en jaque. */
function pseudoMoves(g: ChessGame): ChessMove[] {
  const out: ChessMove[] = [];
  const { board, turn } = g;
  const mine = (p: string) => colorOfPiece(p) === turn;
  const theirs = (p: string) => colorOfPiece(p) === other(turn);
  const addPawn = (from: number, to: number) => {
    const last = turn === "w" ? 7 : 0;
    if (rankOf(to) === last) for (const promo of ["q", "r", "b", "n"] as const) out.push({ from, to, promo });
    else out.push({ from, to });
  };
  for (let from = 0; from < 64; from++) {
    const p = board[from]!;
    if (!mine(p)) continue;
    const kind = p.toLowerCase();
    if (kind === "p") {
      const dir = turn === "w" ? 1 : -1;
      const one = offset(from, 0, dir);
      if (one >= 0 && !board[one]) {
        addPawn(from, one);
        const start = turn === "w" ? 1 : 6;
        const two = offset(from, 0, dir * 2);
        if (rankOf(from) === start && !board[two]!) out.push({ from, to: two });
      }
      for (const df of [-1, 1]) {
        const to = offset(from, df, dir);
        if (to < 0) continue;
        if (theirs(board[to]!)) addPawn(from, to);
        else if (to === g.ep) out.push({ from, to });
      }
    } else if (kind === "n" || kind === "k") {
      for (const [df, dr] of kind === "n" ? KNIGHT : KING) {
        const to = offset(from, df, dr);
        if (to >= 0 && !mine(board[to]!)) out.push({ from, to });
      }
      if (kind === "k") castles(g, from, out);
    } else {
      const dirs = kind === "r" ? ROOK_DIRS : kind === "b" ? BISHOP_DIRS : [...ROOK_DIRS, ...BISHOP_DIRS];
      for (const [df, dr] of dirs) {
        let to = offset(from, df, dr);
        while (to >= 0) {
          const q = board[to]!;
          if (mine(q)) break;
          out.push({ from, to });
          if (q) break;
          to = offset(to, df, dr);
        }
      }
    }
  }
  return out;
}

/**
 * Enroques: el rey y la torre sin moverse (los derechos), las casillas del medio vacías, y el rey no
 * puede estar en jaque ni pasar ni caer en una casilla atacada.
 */
function castles(g: ChessGame, from: number, out: ChessMove[]) {
  const white = g.turn === "w";
  const home = white ? 4 : 60;
  if (from !== home) return;
  const foe = other(g.turn);
  const b = g.board;
  if (isAttacked(b, home, foe)) return;
  const rook = white ? "R" : "r";
  if (g.castling.includes(white ? "K" : "k") && b[home + 3] === rook && !b[home + 1] && !b[home + 2] && !isAttacked(b, home + 1, foe) && !isAttacked(b, home + 2, foe))
    out.push({ from, to: home + 2 });
  if (g.castling.includes(white ? "Q" : "q") && b[home - 4] === rook && !b[home - 1] && !b[home - 2] && !b[home - 3] && !isAttacked(b, home - 1, foe) && !isAttacked(b, home - 2, foe))
    out.push({ from, to: home - 2 });
}

/** Aplica una jugada sin validarla (ya se sabe que sigue las reglas de la pieza). */
function applyRaw(g: ChessGame, m: ChessMove): ChessGame {
  const board = [...g.board];
  const p = board[m.from]!;
  const kind = p.toLowerCase();
  const white = g.turn === "w";
  const captured = board[m.to]!;
  board[m.to] = p;
  board[m.from] = "";
  let epCapture = false;
  if (kind === "p") {
    // Al paso: el peón capturado está detrás de la casilla de llegada.
    if (m.to === g.ep && !captured) {
      board[m.to + (white ? -8 : 8)] = "";
      epCapture = true;
    }
    if (rankOf(m.to) === (white ? 7 : 0)) {
      const promo = m.promo ?? "q";
      board[m.to] = white ? promo.toUpperCase() : promo;
    }
  }
  // Enroque: la torre salta al otro lado del rey.
  if (kind === "k" && Math.abs(m.to - m.from) === 2) {
    const kingSide = m.to > m.from;
    const rookFrom = kingSide ? m.from + 3 : m.from - 4;
    const rookTo = kingSide ? m.from + 1 : m.from - 1;
    board[rookTo] = board[rookFrom]!;
    board[rookFrom] = "";
  }
  // Los derechos de enroque se pierden al mover el rey o la torre, o si capturan la torre en su casilla.
  let castling = g.castling;
  const drop = (sq: number) => {
    if (sq === 4) castling = castling.replace("K", "").replace("Q", "");
    if (sq === 60) castling = castling.replace("k", "").replace("q", "");
    if (sq === 7) castling = castling.replace("K", "");
    if (sq === 0) castling = castling.replace("Q", "");
    if (sq === 63) castling = castling.replace("k", "");
    if (sq === 56) castling = castling.replace("q", "");
  };
  drop(m.from);
  drop(m.to);
  const double = kind === "p" && Math.abs(m.to - m.from) === 16;
  return {
    board,
    turn: other(g.turn),
    castling,
    ep: double ? (m.from + m.to) / 2 : -1,
    halfmove: kind === "p" || captured || epCapture ? 0 : g.halfmove + 1,
    fullmove: g.fullmove + (white ? 0 : 1),
  };
}

/** Jugadas legales del que mueve (todas, o solo las de la pieza en `from`). */
export function chessMoves(g: ChessGame, from?: number): ChessMove[] {
  return pseudoMoves(g).filter((m) => (from === undefined || m.from === from) && !inCheck(applyRaw(g, m), g.turn));
}

/**
 * Juega `move` si es legal y devuelve la posición nueva (o null). Una coronación sin pieza elegida
 * corona a dama; `promo` en una jugada que no corona no cuenta.
 */
export function playChess(g: ChessGame, move: ChessMove): ChessGame | null {
  const legal = chessMoves(g, move.from).filter((m) => m.to === move.to);
  if (!legal.length) return null;
  const promo = legal[0]!.promo ? (move.promo ?? "q") : undefined;
  const m = legal.find((x) => x.promo === promo);
  return m ? applyRaw(g, m) : null;
}

/** ¿Esa jugada corona (un peón que llega a la última fila)? */
export function isPromotion(g: ChessGame, from: number, to: number): boolean {
  return chessMoves(g, from).some((m) => m.to === to && m.promo);
}

/**
 * Material insuficiente (tablas simples): rey contra rey, rey y un alfil o un caballo contra rey, o
 * reyes con alfiles que andan todos por casillas del mismo color.
 */
export function insufficientMaterial(board: ChessBoard): boolean {
  const pieces = board.map((p, sq) => ({ p: p.toLowerCase(), sq })).filter((x) => x.p && x.p !== "k");
  if (pieces.some((x) => x.p === "p" || x.p === "r" || x.p === "q")) return false;
  if (pieces.length <= 1) return true;
  if (pieces.every((x) => x.p === "b")) {
    const shade = (sq: number) => (fileOf(sq) + rankOf(sq)) % 2;
    return pieces.every((x) => shade(x.sq) === shade(pieces[0]!.sq));
  }
  return false;
}

/**
 * ¿Terminó la partida en esta posición? `seen` son las claves (`chessPositionKey`) de las posiciones
 * anteriores, para la triple repetición. `winner`: "w", "b" o null (tablas).
 */
export function chessOutcome(g: ChessGame, seen: readonly string[] = []): { end: ChessEnd; winner: ChessColor | null } | null {
  if (!chessMoves(g).length) return inCheck(g) ? { end: "mate", winner: other(g.turn) } : { end: "stalemate", winner: null };
  if (insufficientMaterial(g.board)) return { end: "material", winner: null };
  if (g.halfmove >= 100) return { end: "fifty", winner: null };
  const key = chessPositionKey(g);
  if (seen.filter((k) => k === key).length >= 2) return { end: "repetition", winner: null };
  return null;
}
