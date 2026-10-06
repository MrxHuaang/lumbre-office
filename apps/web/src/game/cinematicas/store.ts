// Lo que la cinemática muestra en React encima del juego (las franjas y el título; lo que se dice y las
// opciones van por la tira de conversación, game/dialogo.ts) y cómo se salta. El reproductor (player.ts)
// escribe aquí; el overlay (components/cinematicas/CineOverlay.tsx) lee y llama a `skip`.
import type { CineKind } from "@hyvento/shared";
import { create } from "zustand";

export interface CineUi {
  playing: { id: string; kind: CineKind } | null;
  bars: boolean;
  title: { text: string; sub?: string; key: number } | null;
  /** Lo último que se dijo (va como pregunta de las opciones si no traen una propia). */
  lastSaid: string;
}

export const useCineStore = create<CineUi>(() => ({ playing: null, bars: false, title: null, lastSaid: "" }));

let key = 0;
export const nextKey = () => ++key;

let onSkip: (() => void) | null = null;

export function setSkipHandler(fn: (() => void) | null) {
  onSkip = fn;
}

/** Saltar lo que queda (Esc): las opciones quedan en la primera. */
export function skip() {
  onSkip?.();
}

/** ¿Hay una cinemática que toma la pantalla? (la escena no deja caminar ni usar cosas). */
export function cineBlocking(): boolean {
  return useCineStore.getState().playing?.kind === "historia";
}
