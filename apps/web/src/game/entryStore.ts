// Las etapas de la carga al entrar (ver lib/entry.ts): Office.tsx marca el token, la conexión y el motor;
// la escena de Phaser, el arte, el armado del nivel y el primer cuadro. La pantalla de carga lo lee.
import { create } from "zustand";
import type { EntryStageId, EntryState } from "@/lib/entry";

interface EntryStore {
  stages: EntryState;
  /** Vuelve a empezar (cada intento de entrar). */
  reset: () => void;
  start: (id: EntryStageId) => void;
  /** Avance medido de una etapa (0..1); solo sube. */
  progress: (id: EntryStageId, fraction: number) => void;
  done: (id: EntryStageId) => void;
}

const now = () => Date.now();

export const useEntryStore = create<EntryStore>((set) => ({
  stages: {},
  reset: () => set({ stages: {} }),
  start: (id) =>
    set((s) => (s.stages[id]?.startedAt || s.stages[id]?.doneAt ? s : { stages: { ...s.stages, [id]: { ...s.stages[id], startedAt: now() } } })),
  progress: (id, fraction) =>
    set((s) => {
      const st = s.stages[id];
      if (st?.doneAt || fraction <= (st?.fraction ?? 0)) return s;
      return { stages: { ...s.stages, [id]: { startedAt: now(), ...st, fraction: Math.min(1, fraction) } } };
    }),
  done: (id) =>
    set((s) => (s.stages[id]?.doneAt ? s : { stages: { ...s.stages, [id]: { startedAt: now(), ...s.stages[id], doneAt: now() } } })),
}));

/** Atajo fuera de React (la escena de Phaser). */
export const entryStage = {
  start: (id: EntryStageId) => useEntryStore.getState().start(id),
  progress: (id: EntryStageId, fraction: number) => useEntryStore.getState().progress(id, fraction),
  done: (id: EntryStageId) => useEntryStore.getState().done(id),
};
