// Estado del casino en el cliente: la mesa de ruleta (copia de lo que sincroniza el servidor), la
// diferencia de hora con el servidor (para los conteos regresivos) y la respuesta a la última apuesta.
import type { CasinoResult, RoulettePhase, RouletteSettled } from "@hyvento/shared";
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

interface CasinoState {
  /** Hora del servidor menos la local (ms). */
  offset: number;
  roulette: RouletteView;
  /** Respuesta a la última apuesta (cambia `seq` en cada una). */
  lastResult: (CasinoResult & { seq: number }) | null;
  /** Lo que se ganó en la última ronda en la que apostaste. */
  lastSettled: RouletteSettled | null;
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
  setOffset: (serverNow) => set({ offset: serverNow - Date.now() }),
  setRoulette: (roulette) => set({ roulette }),
  setResult: (r) => set({ lastResult: { ...r, seq: ++seq } }),
  setSettled: (lastSettled) => set({ lastSettled }),
}));

/** Milisegundos que le quedan a la fase actual de la ruleta, según la hora del servidor. */
export function rouletteRemaining(r: RouletteView, offset: number, now = Date.now()): number {
  return Math.max(0, r.endsAt - (now + offset));
}
