// El puesto de pesca del lago en el cliente: comprar (el servidor valida que estés junto al mostrador,
// que quepa en la mochila, que la caña no sea repetida y el saldo), la respuesta para el panel y lo que
// dice Don Evelio cuando alguien compra (llega a todos los del nivel con la misma semilla).
import {
  PESCA_ERROR_TEXT,
  PESCA_MSG,
  pescaItem,
  pescaSoldLine,
  type PescaBuyResult,
  type PescaItemId,
  type PescaSoldEvent,
} from "@hyvento/shared";
import { create } from "zustand";
import { getRoom, type OfficeRoom } from "./network";
import { useOfficeStore } from "./store";

interface PescaStore {
  lastResult: (PescaBuyResult & { seq: number }) | null;
  /** Lo último que le toca decir a Don Evelio en su burbuja (al vender). */
  speech: { text: string; seq: number } | null;
  setResult: (r: PescaBuyResult) => void;
  speak: (text: string) => void;
}

let seq = 0;

export const usePescaStore = create<PescaStore>((set) => ({
  lastResult: null,
  speech: null,
  setResult: (r) => set({ lastResult: { ...r, seq: ++seq } }),
  speak: (text) => set({ speech: { text, seq: ++seq } }),
}));

/** Comprar en el puesto de pesca. */
export function sendPescaBuy(item: PescaItemId) {
  getRoom()?.send(PESCA_MSG.buy, { item });
}

/** Engancha la respuesta de la compra y las ventas de los demás (en cada conexión). */
export function bindPesca(r: OfficeRoom) {
  r.onMessage(PESCA_MSG.result, (res: PescaBuyResult) => {
    usePescaStore.getState().setResult(res);
    const store = useOfficeStore.getState();
    if (!res.ok) return store.notify(PESCA_ERROR_TEXT[res.error], "warning");
    const item = pescaItem(res.item);
    if (!item) return;
    store.notify(
      item.kind === "rod" ? `${item.name}: ya es tuya. Se usa sola al pescar (o la eliges en la barra).` : `${item.gives} de ${item.name.toLowerCase()} a la mochila: se gasta una por lance.`,
      "success",
    );
  });
  r.onMessage(PESCA_MSG.sold, (sold: PescaSoldEvent) => usePescaStore.getState().speak(pescaSoldLine(sold)));
}
