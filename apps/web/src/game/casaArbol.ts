// La casa del árbol en el cliente (reglas en CASA_ARBOL de @hyvento/shared; las decide el servidor):
// el estado de la escalera y del pomodoro para el panel de adentro, los mensajes, anticipar si se puede
// subir (así no se funde a negro para rebotar). La escalera recogida del jardín (Phaser) está en
// casaArbolLayer.ts: este archivo lo importa también el HUD.
import {
  CASA_ARBOL,
  CASA_ARBOL_BLOCK_TEXT,
  CASA_ARBOL_MSG,
  casaArbolBlock,
  type CasaArbolBlock,
  type CasaArbolFocus,
  type CasaArbolNotice,
  type CasaArbolView,
} from "@hyvento/shared";
import { getStateCallbacks } from "colyseus.js";
import { create } from "zustand";
import { getRoom, type OfficeRoom } from "./network";
import { useOfficeStore } from "./store";

export const useCasaArbolStore = create<CasaArbolView & { set: (v: CasaArbolView) => void }>((set) => ({
  locked: false,
  lockedBy: "",
  focus: "",
  focusEndsAt: 0,
  set: (v) => set(v),
}));

interface TreeHouseRemote {
  locked: boolean;
  lockedBy: string;
  focus: string;
  focusEndsAt: number;
}

/** Engancha el estado de la casa del árbol y el aviso de "no se pudo subir" (en cada conexión). */
export function bindCasaArbol(r: OfficeRoom) {
  const $ = getStateCallbacks(r);
  const push = () => {
    const t = (r.state as unknown as { treeHouse?: TreeHouseRemote }).treeHouse;
    if (!t) return;
    const focus: CasaArbolFocus = t.focus === "focus" || t.focus === "break" ? t.focus : "";
    const before = useCasaArbolStore.getState().focus;
    useCasaArbolStore.getState().set({ locked: t.locked, lockedBy: t.lockedBy, focus, focusEndsAt: t.focusEndsAt });
    // A los de adentro, el aviso de que cambió la fase del pomodoro.
    if (before !== focus && useOfficeStore.getState().area === CASA_ARBOL.area) {
      if (focus === "break") useOfficeStore.getState().notify(`Terminó el bloque de foco: ${CASA_ARBOL.breakMs / 60_000} minutos de descanso.`, "success");
      else if (focus === "focus" && before === "") useOfficeStore.getState().notify(`Pomodoro de la casa: ${CASA_ARBOL.focusMs / 60_000} minutos de concentración.`, "info");
      else if (focus === "" && before === "break") useOfficeStore.getState().notify("Terminó el descanso.", "info");
    }
  };
  ($(r.state) as unknown as { listen(field: string, cb: (v: TreeHouseRemote | undefined) => void): () => void }).listen("treeHouse", (t) => {
    if (!t) return;
    ($(t as never) as unknown as { onChange(cb: () => void): () => void }).onChange(push);
    push();
  });
  r.onMessage(CASA_ARBOL_MSG.notice, (n: CasaArbolNotice) => useOfficeStore.getState().notify(CASA_ARBOL_BLOCK_TEXT[n.code], "warning"));
}

/** Recoger (`up`) o bajar la escalera, desde adentro. */
export function sendCasaArbolLadder(up: boolean) {
  getRoom()?.send(CASA_ARBOL_MSG.ladder, { up });
}

export function sendCasaArbolFocus(action: "start" | "break" | "stop") {
  getRoom()?.send(CASA_ARBOL_MSG.focus, { action });
}

/** ¿Me dejarían subir? (lo mismo que valida el servidor, con lo que se ve del estado). */
export function casaArbolBlockFor(myUserId: string | null): CasaArbolBlock | null {
  const room = getRoom();
  if (!room) return null;
  let inside = 0;
  room.state.players.forEach((p) => {
    if (p.area === CASA_ARBOL.area && p.userId !== myUserId) inside++;
  });
  return casaArbolBlock(inside, useCasaArbolStore.getState().locked);
}
