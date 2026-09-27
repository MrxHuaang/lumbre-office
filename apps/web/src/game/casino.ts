// Estado del casino en el cliente: la mesa de ruleta (copia de lo que sincroniza el servidor), la
// diferencia de hora con el servidor (para los conteos regresivos) y la respuesta a la última apuesta.
import type { BlackjackPhase, BlackjackSettled, CasinoResult, RoulettePhase, RouletteSettled } from "@hyvento/shared";
import { create } from "zustand";

export interface RouletteBetView {
  userId: string;
  name: string;
  kind: string;
  param: number;
  amount: number;
}

export interface RouletteView {
  phase: RoulettePhase;
  round: number;
  /** Fin de la fase en hora del servidor (ms). */
  endsAt: number;
  result: number;
  history: number[];
  bets: RouletteBetView[];
}

export interface BlackjackSeatView {
  userId: string;
  name: string;
  bet: number;
  cards: number[];
  status: string;
  doubled: boolean;
  outcome: string;
  payout: number;
}

export interface BlackjackView {
  phase: BlackjackPhase;
  round: number;
  endsAt: number;
  turn: number;
  dealer: number[];
  seats: BlackjackSeatView[];
}

interface CasinoState {
  /** Hora del servidor menos la local (ms). */
  offset: number;
  roulette: RouletteView;
  /** Respuesta a la última apuesta (cambia `seq` en cada una). */
  lastResult: (CasinoResult & { seq: number }) | null;
  /** Lo que se ganó en la última ronda en la que apostaste. */
  lastSettled: RouletteSettled | null;
  blackjack: BlackjackView;
  lastBlackjack: BlackjackSettled | null;
  /** Ficha elegida en la tira de la mesa (la que se pone al hacer clic en el paño o al apostar). */
  chip: number;
  setChip: (chip: number) => void;
  setBlackjack: (b: BlackjackView) => void;
  setBlackjackSettled: (s: BlackjackSettled) => void;
  setOffset: (serverNow: number) => void;
  setRoulette: (r: RouletteView) => void;
  setResult: (r: CasinoResult) => void;
  setSettled: (s: RouletteSettled) => void;
}

let seq = 0;

export const useCasinoStore = create<CasinoState>((set) => ({
  offset: 0,
  roulette: { phase: "betting", round: 0, endsAt: 0, result: -1, history: [], bets: [] },
  lastResult: null,
  lastSettled: null,
  blackjack: { phase: "waiting", round: 0, endsAt: 0, turn: -1, dealer: [], seats: [] },
  lastBlackjack: null,
  chip: 5,
  setChip: (chip) => set({ chip }),
  setBlackjack: (blackjack) => set({ blackjack }),
  setBlackjackSettled: (lastBlackjack) => set({ lastBlackjack }),
  setOffset: (serverNow) => set({ offset: serverNow - Date.now() }),
  setRoulette: (roulette) => set({ roulette }),
  setResult: (r) => set({ lastResult: { ...r, seq: ++seq } }),
  setSettled: (lastSettled) => set({ lastSettled }),
}));

/** Milisegundos que le quedan a la fase actual de una mesa (ruleta o blackjack), según la hora del servidor. */
export function rouletteRemaining(r: { endsAt: number }, offset: number, now = Date.now()): number {
  return Math.max(0, r.endsAt - (now + offset));
}
