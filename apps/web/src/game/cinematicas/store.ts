// Lo que la cinemática muestra en React encima del juego (franjas, título, cuadro de diálogo con retrato y
// opciones) y cómo se avanza. El reproductor (player.ts) escribe aquí y espera; el cuadro
// (components/cinematicas/CineOverlay.tsx) lee y llama a `advance`, `choose` o `skip`.
import type { CineKind, CineOption } from "@hyvento/shared";
import { create } from "zustand";

export interface CineLine {
  name: string;
  text: string;
  /** Retrato (data URL del pixel art) o null (narrador). */
  portrait: string | null;
  /** Espera a que se lea (historia) o se va solo (momento). */
  wait: boolean;
}

export interface CineUi {
  playing: { id: string; kind: CineKind } | null;
  bars: boolean;
  title: { text: string; sub?: string; key: number } | null;
  line: (CineLine & { key: number }) | null;
  choice: { prompt?: string; options: readonly CineOption[] } | null;
  /** Lo último que se dijo (va encima de las opciones si no traen pregunta propia). */
  lastSaid: string;
}

export const useCineStore = create<CineUi>(() => ({ playing: null, bars: false, title: null, line: null, choice: null, lastSaid: "" }));

let key = 0;
export const nextKey = () => ++key;

// Lo que espera el reproductor: seguir (la línea leída) o la opción elegida.
let onAdvance: (() => void) | null = null;
let onChoose: ((id: string) => void) | null = null;
let onSkip: (() => void) | null = null;

export function waitAdvance(): Promise<void> {
  return new Promise((resolve) => (onAdvance = resolve));
}

export function waitChoice(): Promise<string> {
  return new Promise((resolve) => (onChoose = resolve));
}

export function setSkipHandler(fn: (() => void) | null) {
  onSkip = fn;
}

/** Siguiente línea (clic, Enter, Espacio o E). */
export function advance() {
  const fn = onAdvance;
  onAdvance = null;
  fn?.();
}

export function choose(id: string) {
  const fn = onChoose;
  onChoose = null;
  fn?.(id);
}

/** Saltar lo que queda (Esc): las opciones quedan en la primera. */
export function skip() {
  onSkip?.();
}

/** ¿Hay una cinemática que toma la pantalla? (la escena no deja caminar ni usar cosas). */
export function cineBlocking(): boolean {
  return useCineStore.getState().playing?.kind === "historia";
}
