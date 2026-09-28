// Red y estado del ajedrez y las damas en el cliente: las mesas (posición, turno, jugadores, reloj)
// vienen en el estado de la sala; el ranking se pide aparte. network.ts llama a `bindBoardGames` con
// cada sala nueva. Las reglas las valida el servidor; acá solo se muestran (y se resaltan las jugadas).
import {
  BOARD_ERROR_TEXT,
  BOARD_REASON_TEXT,
  MSG,
  type BoardGameKind,
  type BoardRanking,
  type BoardReason,
  type BoardResult,
  type BoardSettled,
  type BoardSide,
  type ChessPromo,
} from "@hyvento/shared";
import { getStateCallbacks, type Room } from "colyseus.js";
import { create } from "zustand";
import { playClack } from "./casaSonidos";
import { sfx } from "./sfx";
import { useOfficeStore } from "./store";

export interface BoardSeatView {
  userId: string;
  name: string;
  ready: boolean;
  awaySince: number;
}

export interface BoardTableView {
  id: string;
  game: BoardGameKind;
  phase: "idle" | "playing" | "over";
  match: number;
  position: string;
  turn: BoardSide;
  last: number[];
  check: boolean;
  plies: number;
  clock: number;
  turnEndsAt: number;
  drawOffer: number;
  winner: number;
  reason: BoardReason | "";
  endsAt: number;
  seats: [BoardSeatView, BoardSeatView];
}

interface RemoteSeat {
  userId: string;
  name: string;
  ready: boolean;
  awaySince: number;
}

interface RemoteTable {
  id: string;
  game: string;
  phase: string;
  match: number;
  position: string;
  turn: number;
  last: string;
  check: boolean;
  plies: number;
  clock: number;
  turnEndsAt: number;
  drawOffer: number;
  winner: number;
  reason: string;
  endsAt: number;
  seats: RemoteSeat[];
}

interface BoardGamesStore {
  tables: Record<string, BoardTableView>;
  rankings: Partial<Record<BoardGameKind, BoardRanking>>;
  lastSettled: BoardSettled | null;
}

export const useBoardGamesStore = create<BoardGamesStore>(() => ({ tables: {}, rankings: {}, lastSettled: null }));

const EMPTY_SEAT: BoardSeatView = { userId: "", name: "", ready: false, awaySince: 0 };

function view(t: RemoteTable): BoardTableView {
  const seats = [...t.seats].map((s) => ({ userId: s.userId, name: s.name, ready: s.ready, awaySince: s.awaySince }));
  return {
    id: t.id,
    game: t.game as BoardGameKind,
    phase: t.phase as BoardTableView["phase"],
    match: t.match,
    position: t.position,
    turn: (t.turn === 1 ? 1 : 0) as BoardSide,
    last: t.last ? t.last.split(",").map(Number) : [],
    check: t.check,
    plies: t.plies,
    clock: t.clock,
    turnEndsAt: t.turnEndsAt,
    drawOffer: t.drawOffer,
    winner: t.winner,
    reason: t.reason as BoardReason | "",
    endsAt: t.endsAt,
    seats: [seats[0] ?? EMPTY_SEAT, seats[1] ?? EMPTY_SEAT],
  };
}

/** Lado donde juego yo en esa mesa (o null). */
export function myBoardSide(t: BoardTableView | undefined, userId: string | null): BoardSide | null {
  if (!t || !userId) return null;
  if (t.seats[0].userId === userId) return 0;
  if (t.seats[1].userId === userId) return 1;
  return null;
}

let room: Room | null = null;

export function bindBoardGames(r: Room) {
  room = r;
  useBoardGamesStore.setState({ tables: {} });
  const $ = getStateCallbacks(r as Room<{ boards: Map<string, RemoteTable> }>);
  const sync = (t: RemoteTable) => {
    const prev = useBoardGamesStore.getState().tables[t.id];
    const next = view(t);
    // Suena la pieza apoyada cuando cambia la última jugada de una partida (para todos los que miran).
    if (prev && next.phase === "playing" && next.plies > prev.plies && next.match === prev.match) playClack(0.8);
    useBoardGamesStore.setState((s) => ({ tables: { ...s.tables, [t.id]: next } }));
  };
  $(r.state as { boards: Map<string, RemoteTable> }).boards.onAdd((t: RemoteTable) => {
    const t$ = $(t);
    t$.onChange(() => sync(t));
    t$.seats.onAdd((seat: RemoteSeat) => {
      $(seat).onChange(() => sync(t));
      sync(t);
    });
    sync(t);
  });
  r.onMessage(MSG.boardResult, (res: BoardResult) => useOfficeStore.getState().notify(BOARD_ERROR_TEXT[res.error], "warning"));
  r.onMessage(MSG.boardSettled, (s: BoardSettled) => {
    useBoardGamesStore.setState({ lastSettled: s });
    const why = BOARD_REASON_TEXT[s.reason];
    const text =
      s.outcome === "win"
        ? `¡Ganaste! (${why})${s.counted ? " Suma una victoria en el ranking." : ""}`
        : s.outcome === "draw"
          ? `Tablas: ${why}.`
          : `Perdiste la partida (${why}).`;
    useOfficeStore.getState().notify(text, s.outcome === "win" ? "success" : "info");
    if (s.outcome === "win") sfx.win();
    else if (s.outcome === "draw") sfx.push();
    else sfx.lose();
    requestBoardRanking(s.game);
  });
  r.onMessage(MSG.boardRankingResult, (ranking: BoardRanking) =>
    useBoardGamesStore.setState((s) => ({ rankings: { ...s.rankings, [ranking.game]: ranking } })),
  );
}

export function sendBoardReady(table: string, ready = true, clock?: number) {
  room?.send(MSG.boardReady, clock === undefined ? { table, ready } : { table, ready, clock });
}

export function sendBoardMove(table: string, path: number[], promo?: ChessPromo) {
  room?.send(MSG.boardMove, promo ? { table, path, promo } : { table, path });
}

export function sendBoardResign(table: string) {
  room?.send(MSG.boardResign, { table });
}

export function sendBoardDraw(table: string) {
  room?.send(MSG.boardDraw, { table });
}

export function requestBoardRanking(game: BoardGameKind) {
  room?.send(MSG.boardRanking, { game });
}
