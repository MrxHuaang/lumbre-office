// El panel del director en el navegador (VIR-175): si está abierto, lo que se pidió y la última respuesta
// del servidor. El servidor valida el permiso `director` y cada acción; aquí solo se manda y se muestra.
import { DIRECTOR_MSG, type DirectorAction, type DirectorResult } from "@hyvento/shared";
import type { Room } from "colyseus.js";
import { create } from "zustand";
import { useOfficeStore } from "./store";

interface DirectorStore {
  open: boolean;
  /** Esperando la respuesta del servidor (se desactivan los botones). */
  pending: boolean;
  /** La última respuesta (el aviso del panel). */
  last: DirectorResult | null;
}

export const useDirectorStore = create<DirectorStore>(() => ({ open: false, pending: false, last: null }));

let room: Room | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

export function openDirector(open = true) {
  useDirectorStore.setState(open ? { open } : { open, last: null });
}

/** Manda una acción al servidor (si no contesta en unos segundos, se sueltan los botones). */
export function sendDirector(action: DirectorAction) {
  if (!room) return;
  room.send(DIRECTOR_MSG.action, action);
  useDirectorStore.setState({ pending: true });
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => useDirectorStore.setState({ pending: false }), 4000);
}

export function bindDirector(r: Room) {
  room = r;
  r.onMessage(DIRECTOR_MSG.result, (res: DirectorResult) => {
    if (pendingTimer) clearTimeout(pendingTimer);
    useDirectorStore.setState({ pending: false, last: res });
    // Con el panel cerrado (un comando del chat), el aviso sale como siempre.
    if (!useDirectorStore.getState().open) useOfficeStore.getState().notify(res.texto, res.ok ? "success" : "warning");
  });
}

export function resetDirector() {
  room = null;
  useDirectorStore.setState({ open: false, pending: false, last: null });
}
