// La cocina en el cliente: la despensa (la manda el servidor al abrir el panel y después de cada cosa),
// los avisos y la energía de los platos. Las reglas las valida el servidor; esto es solo para mostrar
// y para que el paso local vaya a la velocidad que el servidor va a aceptar.
import { COCINA_MSG, cocinaNoticeText, dishSpeedMul, type CocinaNotice, type CocinaState, type Pantry } from "@hyvento/shared";
import type { Room } from "colyseus.js";
import { create } from "zustand";
import { sfx } from "./sfx";
import { useOfficeStore } from "./store";

interface CocinaStore {
  pantry: Pantry | null;
  pointsToday: number;
  /** Plato con energía ("" = ninguno) y hasta cuándo (hora local). */
  buff: string;
  buffUntil: number;
  setState: (s: CocinaState) => void;
  setBuff: (dish: string) => void;
}

export const useCocinaStore = create<CocinaStore>((set) => ({
  pantry: null,
  pointsToday: 0,
  buff: "",
  buffUntil: 0,
  setState: (s) => set({ pantry: s.pantry, pointsToday: s.pointsToday, buff: s.buff, buffUntil: s.buff ? Date.now() + s.buffLeftMs : 0 }),
  setBuff: (buff) => set((prev) => ({ buff, buffUntil: buff ? (prev.buff === buff && prev.buffUntil > Date.now() ? prev.buffUntil : 0) : 0 })),
}));

/** Cuánto más rápido camino ahora (1 = normal): lo del estado del servidor (`Player.buff`). */
export const localSpeedMul = () => dishSpeedMul(useCocinaStore.getState().buff);

let room: Room | null = null;

export function bindCocina(r: Room) {
  room = r;
  r.onMessage(COCINA_MSG.state, (s: CocinaState) => useCocinaStore.getState().setState(s));
  r.onMessage(COCINA_MSG.notice, (n: CocinaNotice) => {
    const good = n.code === "stored" || n.code === "cooked" || n.code === "capped" || n.code === "energy";
    useOfficeStore.getState().notify(cocinaNoticeText(n), good ? "success" : "info");
    if (n.code === "energy") {
      // El servidor dice cuánto queda al abrir el panel; acá basta con pedirlo para el chip.
      room?.send(COCINA_MSG.open);
    }
    if (good) sfx.uiOpen();
  });
}

/** Pedir cómo está mi despensa (al abrir el panel de la cocina o del cobertizo). */
export function requestPantry() {
  room?.send(COCINA_MSG.open);
}

/** Cocinar una receta (junto a la estufa). */
export function sendCook(recipe: string) {
  room?.send(COCINA_MSG.cook, { recipe });
}
