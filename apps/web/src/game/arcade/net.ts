// Red del arcade: pedir la tabla de récords, empezar una partida (el servidor da la semilla) y mandar el
// puntaje al terminar. network.ts llama a `bindArcade` con cada sala nueva.
import { MSG, type ArcadeBoard, type ArcadeResult, type ArcadeStarted } from "@hyvento/shared";
import type { Room } from "colyseus.js";
import { create } from "zustand";

interface ArcadeStore {
  board: ArcadeBoard | null;
  started: ArcadeStarted | null;
  /** Respuesta a la última partida o al intento de empezar (cambia `seq` en cada una). */
  result: (ArcadeResult & { seq: number }) | null;
  reset: () => void;
}

let seq = 0;

export const useArcadeStore = create<ArcadeStore>((set) => ({
  board: null,
  started: null,
  result: null,
  reset: () => set({ board: null, started: null, result: null }),
}));

let room: Room | null = null;

export function bindArcade(r: Room) {
  room = r;
  r.onMessage(MSG.arcadeBoardResult, (board: ArcadeBoard) => useArcadeStore.setState({ board }));
  r.onMessage(MSG.arcadeStarted, (started: ArcadeStarted) => useArcadeStore.setState({ started }));
  r.onMessage(MSG.arcadeResult, (res: ArcadeResult) => {
    useArcadeStore.setState((s) => ({ result: { ...res, seq: ++seq }, board: res.ok && s.board ? { ...s.board, board: res.board } : s.board }));
  });
}

export function sendArcadeBoard(machine: number) {
  room?.send(MSG.arcadeBoard, { machine });
}

export function sendArcadeStart(machine: number) {
  useArcadeStore.setState({ started: null });
  room?.send(MSG.arcadeStart, { machine });
}

export function sendArcadeFinish(token: string, score: number) {
  room?.send(MSG.arcadeFinish, { token, score });
}
