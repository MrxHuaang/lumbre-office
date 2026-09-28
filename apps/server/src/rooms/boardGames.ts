// Ajedrez y damas de la sala de juegos (reglas en boardgames.ts de @hyvento/shared). Una partida por
// mesa entre las dos sillas: se juega sentado (la silla del oeste lleva blancas). Cuando los dos dicen
// "listo" empieza; el servidor valida cada jugada con las reglas compartidas, lleva el turno, el reloj
// por jugada (si se acaba, pierde) y los que se levantan o se desconectan (la partida sigue: tienen
// BOARD_GAME.awayMs para volver a sentarse). Todo queda en el estado de la sala, así los demás miran en vivo.
// Las victorias van a la tabla de récords del arcade (sin apuestas).
import type { BoardTableDef } from "@hyvento/map";
import {
  BOARD_GAME,
  BoardMoveMessage,
  BoardReadyMessage,
  BoardTableMessage,
  boardInCheck,
  boardOutcome,
  boardPositionKey,
  encodeBoard,
  newBoardPosition,
  playBoardMove,
  turnOf,
  type BoardError,
  type BoardGameKind,
  type BoardPosition,
  type BoardReason,
  type BoardSettled,
  type BoardSide,
} from "@hyvento/shared";
import type { MapSchema } from "@colyseus/schema";
import { BoardTableState } from "../state";

export interface Timer {
  clear(): void;
}

/** Quién está sentado en una silla. */
export interface BoardSitter {
  userId: string;
  name: string;
}

export interface BoardGamesDeps {
  state: MapSchema<BoardTableState>;
  tables: readonly BoardTableDef[];
  now: () => number;
  every: (ms: number, fn: () => void) => Timer;
  /** Quién está sentado en esa silla de ese nivel ahora (null = nadie). */
  sitterAt: (area: string, tx: number, ty: number) => BoardSitter | null;
  /** Guarda una victoria para el ranking. */
  saveWin: (win: { game: BoardGameKind; userId: string; name: string }) => Promise<void>;
  /** Cómo terminó la partida para cada jugador. */
  settled: (userId: string, s: BoardSettled) => void;
}

type Result = { ok: true } | { ok: false; error: BoardError };

/** Lo que el servidor guarda de cada partida además del estado: la posición completa y las repeticiones. */
interface Live {
  pos: BoardPosition;
  seen: string[];
}

export class BoardGames {
  private live = new Map<string, Live>();
  private ticker: Timer | null = null;

  constructor(private readonly d: BoardGamesDeps) {
    for (const def of d.tables) {
      const t = new BoardTableState();
      t.id = def.id;
      t.game = def.game;
      t.clock = BOARD_GAME.defaultClock;
      t.position = encodeBoard(newBoardPosition(def.game));
      d.state.set(def.id, t);
    }
  }

  /** Arranca la revisión periódica (quién está sentado, relojes, ausentes). */
  start() {
    this.ticker?.clear();
    this.ticker = this.d.every(BOARD_GAME.sweepMs, () => this.sweep());
  }

  stop() {
    this.ticker?.clear();
    this.ticker = null;
  }

  private def(id: string) {
    return this.d.tables.find((t) => t.id === id);
  }

  /** Lado de esa mesa en cuya silla está sentado `userId` ahora (o null). */
  private seatedSide(def: BoardTableDef, userId: string): BoardSide | null {
    for (const side of [0, 1] as const) {
      const s = def.seats[side];
      if (this.d.sitterAt(def.area, s.x, s.y)?.userId === userId) return side;
    }
    return null;
  }

  /** Lado donde juega `userId` la partida de ahora de esa mesa (o null). */
  private playerSide(t: BoardTableState, userId: string): BoardSide | null {
    if (t.seats[0]!.userId === userId) return 0;
    if (t.seats[1]!.userId === userId) return 1;
    return null;
  }

  /**
   * Listo (o ya no) en la silla donde está sentado; con `clock` cambia el reloj de la mesa (y los dos
   * tienen que volver a decir listo). Con los dos listos, empieza la partida.
   */
  ready(userId: string, raw: unknown): Result | null {
    const parsed = BoardReadyMessage.safeParse(raw);
    if (!parsed.success) return null;
    const def = this.def(parsed.data.table);
    const t = def && this.d.state.get(def.id);
    if (!def || !t) return null;
    if (t.phase === "playing") return { ok: false, error: this.playerSide(t, userId) === null ? "busy" : "state" };
    // Terminada, "listo" es la revancha: la mesa se libera ya.
    if (t.phase === "over") this.release(t);
    this.syncSeats(def, t);
    const side = this.seatedSide(def, userId);
    if (side === null) return { ok: false, error: "seat" };
    const other = t.seats[side === 0 ? 1 : 0]!;
    if (other.userId === userId) return { ok: false, error: "self" };
    const { clock, ready = true } = parsed.data;
    if (clock !== undefined && clock !== t.clock) {
      t.clock = clock;
      for (const s of t.seats) s.ready = false;
    }
    t.seats[side]!.ready = ready;
    if (t.seats[0]!.ready && t.seats[1]!.ready && t.seats[0]!.userId && t.seats[1]!.userId) this.begin(def, t);
    return { ok: true };
  }

  /** Una jugada del que tiene el turno (sentado en su silla). */
  move(userId: string, raw: unknown): Result | null {
    const parsed = BoardMoveMessage.safeParse(raw);
    if (!parsed.success) return null;
    const def = this.def(parsed.data.table);
    const t = def && this.d.state.get(def.id);
    const live = def && this.live.get(def.id);
    if (!def || !t) return null;
    if (t.phase !== "playing" || !live) return { ok: false, error: "state" };
    const side = this.playerSide(t, userId);
    if (side === null) return { ok: false, error: "busy" };
    if (this.seatedSide(def, userId) !== side) return { ok: false, error: "seat" };
    if (t.turn !== side) return { ok: false, error: "turn" };
    const next = playBoardMove(live.pos, { path: parsed.data.path, promo: parsed.data.promo });
    if (!next) return { ok: false, error: "illegal" };
    live.pos = next;
    t.position = encodeBoard(next);
    t.turn = turnOf(next);
    t.last = parsed.data.path.join(",");
    t.check = boardInCheck(next);
    t.plies += 1;
    t.drawOffer = -1;
    t.turnEndsAt = t.clock ? this.d.now() + t.clock * 1000 : 0;
    const end = boardOutcome(next, live.seen);
    live.seen.push(boardPositionKey(next));
    if (end) void this.finish(def, t, end.winner, end.end);
    return { ok: true };
  }

  /** Rendirse: gana el otro. */
  resign(userId: string, raw: unknown): Result | null {
    const found = this.playing(userId, raw);
    if (!found || "error" in found) return found;
    void this.finish(found.def, found.t, found.side === 0 ? 1 : 0, "resign");
    return { ok: true };
  }

  /** Ofrecer tablas o, si el otro ya las ofreció, aceptarlas. */
  draw(userId: string, raw: unknown): Result | null {
    const found = this.playing(userId, raw);
    if (!found || "error" in found) return found;
    const { def, t, side } = found;
    if (t.drawOffer === (side === 0 ? 1 : 0)) void this.finish(def, t, -1, "agreed");
    else t.drawOffer = side;
    return { ok: true };
  }

  private playing(userId: string, raw: unknown): { def: BoardTableDef; t: BoardTableState; side: BoardSide } | { ok: false; error: BoardError } | null {
    const parsed = BoardTableMessage.safeParse(raw);
    if (!parsed.success) return null;
    const def = this.def(parsed.data.table);
    const t = def && this.d.state.get(def.id);
    if (!def || !t) return null;
    if (t.phase !== "playing") return { ok: false, error: "state" };
    const side = this.playerSide(t, userId);
    if (side === null) return { ok: false, error: "busy" };
    return { def, t, side };
  }

  /** Cada BOARD_GAME.sweepMs: quién está sentado, el reloj de la jugada y los que se fueron de la mesa. */
  sweep() {
    const now = this.d.now();
    for (const def of this.d.tables) {
      const t = this.d.state.get(def.id);
      if (!t) continue;
      if (t.phase === "over") {
        if (now >= t.endsAt) this.release(t);
        else continue;
      }
      if (t.phase !== "playing") {
        this.syncSeats(def, t);
        continue;
      }
      if (t.turnEndsAt && now >= t.turnEndsAt) {
        void this.finish(def, t, t.turn === 0 ? 1 : 0, "time");
        continue;
      }
      for (const side of [0, 1] as const) {
        const seat = t.seats[side]!;
        const here = this.seatedSide(def, seat.userId) === side;
        if (here) {
          if (seat.awaySince) seat.awaySince = 0;
        } else if (!seat.awaySince) seat.awaySince = now;
        else if (now - seat.awaySince >= BOARD_GAME.awayMs) {
          void this.finish(def, t, side === 0 ? 1 : 0, "away");
          break;
        }
      }
    }
  }

  /** Antes de empezar, las sillas son de quien está sentado (si cambia la persona, deja de estar lista). */
  private syncSeats(def: BoardTableDef, t: BoardTableState) {
    for (const side of [0, 1] as const) {
      const s = def.seats[side];
      const who = this.d.sitterAt(def.area, s.x, s.y);
      const seat = t.seats[side]!;
      const userId = who?.userId ?? "";
      const name = who?.name ?? "";
      // Solo se escribe lo que cambió: esto corre cada medio segundo y no debe mandar parches de más.
      if (userId !== seat.userId) {
        seat.ready = false;
        seat.userId = userId;
      }
      if (name !== seat.name) seat.name = name;
      if (seat.awaySince) seat.awaySince = 0;
    }
  }

  private begin(def: BoardTableDef, t: BoardTableState) {
    const pos = newBoardPosition(def.game);
    this.live.set(def.id, { pos, seen: [boardPositionKey(pos)] });
    t.match += 1;
    t.phase = "playing";
    t.position = encodeBoard(pos);
    t.turn = 0;
    t.last = "";
    t.check = false;
    t.plies = 0;
    t.drawOffer = -1;
    t.winner = -1;
    t.reason = "";
    t.endsAt = 0;
    t.turnEndsAt = t.clock ? this.d.now() + t.clock * 1000 : 0;
    for (const s of t.seats) {
      s.ready = false;
      s.awaySince = 0;
    }
  }

  /** Fin de la partida: se ve el resultado un rato, se avisa a los dos y se guarda la victoria. */
  private async finish(def: BoardTableDef, t: BoardTableState, winner: BoardSide | -1, reason: BoardReason) {
    if (t.phase !== "playing") return;
    t.phase = "over";
    t.winner = winner;
    t.reason = reason;
    t.turnEndsAt = 0;
    t.drawOffer = -1;
    t.endsAt = this.d.now() + BOARD_GAME.overMs;
    this.live.delete(def.id);
    const players = t.seats.map((s, i) => ({ side: i as BoardSide, userId: s.userId, name: s.name }));
    // Las partidas muy cortas (alguien se rinde de una) no suben el ranking.
    const counted = winner !== -1 && t.plies >= BOARD_GAME.minPliesToCount;
    for (const p of players) {
      if (!p.userId) continue;
      const outcome = winner === -1 ? "draw" : winner === p.side ? "win" : "lose";
      this.d.settled(p.userId, { table: def.id, game: def.game, outcome, reason, counted: counted && outcome === "win" });
    }
    const w = winner === -1 ? null : players[winner];
    if (counted && w?.userId) await this.d.saveWin({ game: def.game, userId: w.userId, name: w.name }).catch((err) => console.error("saveBoardWin", err));
  }

  /** La mesa queda libre (con el tablero en la posición inicial) para la próxima partida. */
  private release(t: BoardTableState) {
    const def = this.def(t.id);
    t.phase = "idle";
    t.endsAt = 0;
    t.winner = -1;
    t.reason = "";
    t.last = "";
    t.check = false;
    t.turn = 0;
    t.plies = 0;
    if (def) t.position = encodeBoard(newBoardPosition(def.game));
    for (const s of t.seats) {
      s.ready = false;
      s.awaySince = 0;
    }
    if (def) this.syncSeats(def, t);
  }

  /** Para los tests: la posición completa de la partida de esa mesa (o null). */
  debugPosition(id: string): BoardPosition | null {
    return this.live.get(id)?.pos ?? null;
  }
}
