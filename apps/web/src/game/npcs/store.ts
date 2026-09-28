// El Man del Sombrero en el cliente: la copia de `state.sombrero` (si está y dónde) y la respuesta a la
// última compra (el panel la usa para soltar el botón y cambiar la frase).
import type { SombreroBuyResult } from "@hyvento/shared";
import { create } from "zustand";

export interface SombreroView {
  present: boolean;
  hideout: number;
  area: string;
  x: number;
  y: number;
  facing: string;
}

interface SombreroStore {
  man: SombreroView;
  lastResult: (SombreroBuyResult & { seq: number }) | null;
  /** Lo último que le toca decir en su burbuja (el saludo, las gracias, la despedida). */
  speech: { text: string; seq: number } | null;
  setMan: (man: SombreroView) => void;
  setResult: (r: SombreroBuyResult) => void;
  speak: (text: string) => void;
}

let seq = 0;

export const useSombreroStore = create<SombreroStore>((set) => ({
  man: { present: false, hideout: -1, area: "", x: 0, y: 0, facing: "down" },
  lastResult: null,
  speech: null,
  setMan: (man) => set({ man }),
  setResult: (r) => set({ lastResult: { ...r, seq: ++seq } }),
  speak: (text) => set({ speech: { text, seq: ++seq } }),
}));
