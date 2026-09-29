// Qué ventana de "facilidad de uso" está abierta: la paleta de comandos, los ajustes, la ayuda de atajos
// o el mapa de la cabaña (una a la vez), y el panel de audio y video (que vive en la barra de abajo pero
// también se abre desde los ajustes y la paleta).
import { create } from "zustand";

export type FacilidadView = "palette" | "settings" | "shortcuts" | "worldmap";

interface FacilidadStore {
  open: FacilidadView | null;
  devices: boolean;
  show: (v: FacilidadView) => void;
  toggle: (v: FacilidadView) => void;
  close: () => void;
  setDevices: (on: boolean) => void;
}

export const useFacilidadStore = create<FacilidadStore>((set, get) => ({
  open: null,
  devices: false,
  show: (open) => set({ open }),
  toggle: (v) => set({ open: get().open === v ? null : v }),
  close: () => set({ open: null }),
  setDevices: (devices) => set({ devices }),
}));
