// Juegos de mesa por turnos de la sala de juegos (piso 3): ajedrez y damas. Una partida por mesa entre
// las dos sillas (la del oeste juega con blancas y la del este con negras). El servidor tiene la partida
// y valida cada jugada con estas mismas reglas (chess.ts, checkers.ts); el navegador las usa para
// resaltar las casillas legales. Las victorias se guardan en la tabla de récords del arcade (ArcadeScore)
// con su propio "juego" ("ajedrez" / "damas"): un punto por victoria. Sin apuestas.
import { z } from "zod";
import {
  chessFromFen,
  chessMoves,
  chessOutcome,
  chessPositionKey,
  chessToFen,
  inCheck,
  newChess,
  playChess,
  type ChessEnd,
  type ChessGame,
  type ChessPromo,
} from "./chess";
import { checkersFromText, checkersMoves, checkersOutcome, checkersToText, newCheckers, playCheckers, type CheckersGame } from "./checkers";

export const BOARD_GAMES = ["ajedrez", "damas"] as const;
export type BoardGameKind = (typeof BOARD_GAMES)[number];

export const BOARD_GAME_NAME: Record<BoardGameKind, string> = { ajedrez: "Ajedrez", damas: "Damas" };

/** Lado de la mesa: 0 = blancas (juegan primero), 1 = negras. */
export type BoardSide = 0 | 1;
export const BOARD_SIDE_NAME = ["blancas", "negras"] as const;

export const BOARD_GAME = {
  /** Reloj por jugada que se puede elegir (segundos; 0 = sin reloj). Si se acaba, pierde la partida. */
  clockOptions: [0, 60, 120, 300] as const,
  defaultClock: 120,
  /**
   * Cuánto puede estar alguien fuera de su silla (se levantó, se le cayó la conexión) sin perder: la
   * partida sigue y, si vuelve a sentarse a tiempo, sigue jugando.
   */
  awayMs: 3 * 60_000,
  /** Cuánto se ve el resultado antes de que la mesa quede libre. */
  overMs: 15_000,
  /** Una victoria cuenta para el ranking solo si la partida tuvo al menos estas jugadas (medios movimientos). */
  minPliesToCount: 6,
  /** Cada cuánto revisa el servidor quién está sentado, los relojes y los ausentes. */
  sweepMs: 500,
  /** Puestos del ranking. */
  rankingSize: 5,
  /** Cuánto se guarda en memoria el ranking antes de volver a leerlo. */
  rankingCacheMs: 5000,
} as const;

// ---------- Motor común: el servidor y el navegador hablan de "recorridos" de casillas ----------

/** Una jugada: las casillas que recorre (en ajedrez, salida y llegada) y, si corona, a qué. */
export interface BoardMove {
  path: number[];
  promo?: ChessPromo;
}

export type BoardEnd = ChessEnd | "blocked" | "quiet";

/** Una partida en curso de cualquiera de los dos juegos. */
export type BoardPosition = { game: "ajedrez"; g: ChessGame } | { game: "damas"; g: CheckersGame };

export function newBoardPosition(game: BoardGameKind): BoardPosition {
  return game === "ajedrez" ? { game, g: newChess() } : { game, g: newCheckers() };
}

/** Lo que va en el estado de la sala: FEN en ajedrez, las 64 casillas en damas. */
export const encodeBoard = (p: BoardPosition) => (p.game === "ajedrez" ? chessToFen(p.g) : checkersToText(p.g.board));

/** El texto del estado de vuelta a una partida (el turno de damas va aparte). */
export function decodeBoard(game: BoardGameKind, text: string, turn: BoardSide): BoardPosition {
  return game === "ajedrez" ? { game, g: chessFromFen(text) } : { game, g: checkersFromText(text, turn === 0 ? "w" : "b") };
}

export const turnOf = (p: BoardPosition): BoardSide => (p.g.turn === "w" ? 0 : 1);

/** Jugadas legales del que mueve, como recorridos. */
export function legalBoardMoves(p: BoardPosition): BoardMove[] {
  if (p.game === "damas") return checkersMoves(p.g).map((m) => ({ path: m.path }));
  // En ajedrez las cuatro coronaciones son una sola jugada con elección.
  const seen = new Set<string>();
  const out: BoardMove[] = [];
  for (const m of chessMoves(p.g)) {
    const key = `${m.from}-${m.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m.promo ? { path: [m.from, m.to], promo: "q" } : { path: [m.from, m.to] });
  }
  return out;
}

/** Juega si es legal y devuelve la posición nueva (o null). */
export function playBoardMove(p: BoardPosition, move: BoardMove): BoardPosition | null {
  if (p.game === "ajedrez") {
    if (move.path.length !== 2) return null;
    const g = playChess(p.g, { from: move.path[0]!, to: move.path[1]!, promo: move.promo });
    return g ? { game: "ajedrez", g } : null;
  }
  const g = playCheckers(p.g, move.path);
  return g ? { game: "damas", g } : null;
}

/** Clave para contar repeticiones (solo el ajedrez las usa). */
export const boardPositionKey = (p: BoardPosition) => (p.game === "ajedrez" ? chessPositionKey(p.g) : `${checkersToText(p.g.board)} ${p.g.turn}`);

/** ¿El rey del que mueve está en jaque? (en damas, nunca). */
export const boardInCheck = (p: BoardPosition) => p.game === "ajedrez" && inCheck(p.g);

/** ¿Terminó? `winner`: 0, 1 o -1 (tablas). */
export function boardOutcome(p: BoardPosition, seen: readonly string[] = []): { end: BoardEnd; winner: BoardSide | -1 } | null {
  const o = p.game === "ajedrez" ? chessOutcome(p.g, seen) : checkersOutcome(p.g);
  if (!o) return null;
  return { end: o.end, winner: o.winner === "w" ? 0 : o.winner === "b" ? 1 : -1 };
}

// ---------- Cómo terminó ----------

/** Motivo del final: los de las reglas y los de la mesa (rendirse, reloj, abandono, tablas acordadas). */
export type BoardReason = BoardEnd | "resign" | "time" | "away" | "agreed";

export const BOARD_REASON_TEXT: Record<BoardReason, string> = {
  mate: "jaque mate",
  stalemate: "tablas por ahogado",
  fifty: "tablas por la regla de los 50 movimientos",
  material: "tablas por material insuficiente",
  repetition: "tablas por triple repetición",
  blocked: "sin jugadas posibles",
  quiet: "tablas: 50 jugadas sin capturas",
  resign: "abandono",
  time: "se acabó el tiempo",
  away: "se fue de la mesa",
  agreed: "tablas de mutuo acuerdo",
};

// ---------- Mensajes ----------

const tableId = z.string().min(1).max(40);

/**
 * Cliente → servidor (`MSG.boardReady`): listo para jugar en la silla donde está sentado (o ya no, con
 * `ready: false`). `clock` cambia el reloj por jugada de la mesa (y los dos tienen que volver a decir listo).
 */
export const BoardReadyMessage = z.object({
  table: tableId,
  ready: z.boolean().optional(),
  clock: z
    .number()
    .int()
    .refine((s) => (BOARD_GAME.clockOptions as readonly number[]).includes(s))
    .optional(),
});
export type BoardReadyMessage = z.infer<typeof BoardReadyMessage>;

/** Cliente → servidor (`MSG.boardMove`): una jugada (recorrido de casillas y, si corona, a qué). */
export const BoardMoveMessage = z.object({
  table: tableId,
  path: z.array(z.number().int().min(0).max(63)).min(2).max(24),
  promo: z.enum(["q", "r", "b", "n"]).optional(),
});
export type BoardMoveMessage = z.infer<typeof BoardMoveMessage>;

/** Cliente → servidor: rendirse (`MSG.boardResign`) u ofrecer / aceptar tablas (`MSG.boardDraw`). */
export const BoardTableMessage = z.object({ table: tableId });
export type BoardTableMessage = z.infer<typeof BoardTableMessage>;

/** Cliente → servidor (`MSG.boardRanking`): el ranking de victorias de un juego. */
export const BoardRankingMessage = z.object({ game: z.enum(BOARD_GAMES) });

export interface BoardRankingEntry {
  name: string;
  wins: number;
}

/** Servidor → cliente (`MSG.boardRankingResult`): victorias de la semana y de siempre. */
export interface BoardRanking {
  game: BoardGameKind;
  week: BoardRankingEntry[];
  all: BoardRankingEntry[];
}

export type BoardError = "seat" | "busy" | "self" | "turn" | "illegal" | "state";

export const BOARD_ERROR_TEXT: Record<BoardError, string> = {
  seat: "Siéntate en una de las sillas de la mesa para jugar.",
  busy: "Esa silla ya tiene su partida.",
  self: "Para jugar necesitas a otra persona en la otra silla.",
  turn: "Todavía no es tu turno.",
  illegal: "Esa jugada no vale.",
  state: "Eso no se puede hacer en este momento de la partida.",
};

/** Servidor → cliente (`MSG.boardResult`): un pedido que no se pudo hacer. */
export interface BoardResult {
  ok: false;
  error: BoardError;
}

/** Servidor → cada jugador (`MSG.boardSettled`): cómo terminó su partida. */
export interface BoardSettled {
  table: string;
  game: BoardGameKind;
  outcome: "win" | "lose" | "draw";
  reason: BoardReason;
  /** Si la victoria quedó en el ranking (las partidas muy cortas no cuentan). */
  counted: boolean;
}

/** 2:00 */
export const boardClockText = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
