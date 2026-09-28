// El libro abierto en pantalla (lado del navegador): al leer en una estantería se abre el mismo que
// anuncia el globo (la semilla del servidor). Sin Phaser: lo usan casaViva.ts y el lector (BookReader).
import { create } from "zustand";

interface BookStore {
  /** Semilla del libro abierto (null = ninguno). */
  seed: number | null;
  open: (seed: number) => void;
  close: () => void;
}

export const useBookStore = create<BookStore>((set) => ({
  seed: null,
  open: (seed) => set({ seed }),
  close: () => set({ seed: null }),
}));
