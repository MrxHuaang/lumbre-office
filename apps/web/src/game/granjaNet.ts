// La granja en el cliente (red): los avisos del gallinero, el molino y la parrilla, el panel del gallinero
// (votos y lo de hoy) y la despensa de la parrilla. Las reglas las valida el servidor; esto solo muestra.
import {
  GRANJA_MSG,
  granjaNoticeText,
  grillNoticeText,
  PARRILLA_MSG,
  type CoopState,
  type GranjaNotice,
  type GrillNotice,
  type GrillState,
  type PortionShared,
} from "@hyvento/shared";
import type { Room } from "colyseus.js";
import { create } from "zustand";
import { sfx } from "./sfx";
import { useOfficeStore } from "./store";

interface GranjaStore {
  coop: CoopState | null;
  grill: GrillState | null;
  setCoop: (s: CoopState) => void;
  setGrill: (s: GrillState) => void;
}

export const useGranjaStore = create<GranjaStore>((set) => ({
  coop: null,
  grill: null,
  setCoop: (coop) => set({ coop }),
  setGrill: (grill) => set({ grill }),
}));

const portionListeners = new Set<(e: PortionShared) => void>();
/** Alguien de mi nivel le dio una porción a otro (para la animación). */
export function onPortionShared(cb: (e: PortionShared) => void) {
  portionListeners.add(cb);
  return () => portionListeners.delete(cb);
}

const GOOD_GRANJA = new Set<GranjaNotice["code"]>(["fed", "eggs", "flour", "voted"]);
const GOOD_GRILL = new Set<GrillNotice["code"]>(["cooking", "done", "doneBag", "bought", "gotPortion", "gavePortion"]);

let room: Room | null = null;

export function bindGranja(r: Room) {
  room = r;
  r.onMessage(GRANJA_MSG.coopState, (s: CoopState) => useGranjaStore.getState().setCoop(s));
  r.onMessage(GRANJA_MSG.notice, (n: GranjaNotice) => {
    // Votar ya se ve en el panel: no hace falta el aviso.
    if (n.code !== "voted") useOfficeStore.getState().notify(granjaNoticeText(n), GOOD_GRANJA.has(n.code) ? "success" : "info");
    if (n.code === "eggs" || n.code === "flour") sfx.uiOpen();
  });
  r.onMessage(PARRILLA_MSG.state, (s: GrillState) => useGranjaStore.getState().setGrill(s));
  r.onMessage(PARRILLA_MSG.notice, (n: GrillNotice) => {
    useOfficeStore.getState().notify(grillNoticeText(n), GOOD_GRILL.has(n.code) ? "success" : "info");
    // Lo que cambia la despensa se vuelve a pedir si el panel está abierto.
    if (n.code === "done" || n.code === "doneBag" || n.code === "bought") requestGrill();
  });
  r.onMessage(PARRILLA_MSG.shared, (e: PortionShared) => portionListeners.forEach((cb) => cb(e)));
}

export const requestCoop = () => room?.send(GRANJA_MSG.coopOpen);
export const sendVote = (animal: string, option: number) => room?.send(GRANJA_MSG.vote, { animal, option });
export const requestGrill = () => room?.send(PARRILLA_MSG.open);
export const sendGrillCook = (recipe: string) => room?.send(PARRILLA_MSG.cook, { recipe });
export const sendGrillBuy = (item: string, quantity: number) => room?.send(PARRILLA_MSG.buy, { item, quantity });
export const sendPortion = (sessionId: string) => room?.send(PARRILLA_MSG.portion, { sessionId });

/** La "E" de pedir una porción (como la de las mascotas, un usable sin mueble). */
export const PORTION_USABLE_PREFIX = "porcion:";
