// El panel del director en el navegador (VIR-175): si está abierto, lo que se pidió y la última respuesta
// del servidor. El servidor valida el permiso `director` y cada acción; aquí solo se manda y se muestra.
import { DIRECTOR_MSG, type DirectorAction, type DirectorMusica, type DirectorResult, type PiezaId } from "@hyvento/shared";
import type { Room } from "colyseus.js";
import { create } from "zustand";
import { duracionDe, escucharPieza } from "./carnaval/musica";
import { useOfficeStore } from "./store";

interface DirectorStore {
  open: boolean;
  /** Esperando la respuesta del servidor (se desactivan los botones). */
  pending: boolean;
  /** La última respuesta (el aviso del panel). */
  last: DirectorResult | null;
  /** La pieza que suena (la que puso el director para todos o la que alguien escucha solo). */
  sonando: { pieza: PiezaId; paraTodos: boolean } | null;
}

export const useDirectorStore = create<DirectorStore>(() => ({ open: false, pending: false, last: null, sonando: null }));

let parar: (() => void) | null = null;
let finTimer: ReturnType<typeof setTimeout> | null = null;

/** Toca una pieza en este navegador (o la para con null); `paraTodos` dice si la puso el director para todos. */
export function sonarPieza(pieza: PiezaId | null, paraTodos = false) {
  parar?.();
  parar = null;
  if (finTimer) clearTimeout(finTimer);
  if (!pieza) {
    useDirectorStore.setState({ sonando: null });
    return;
  }
  const stop = escucharPieza(pieza);
  parar = stop;
  useDirectorStore.setState({ sonando: { pieza, paraTodos } });
  // Al acabar la pieza, el botón vuelve a "Escuchar".
  finTimer = setTimeout(() => {
    if (parar === stop) sonarPieza(null);
  }, (duracionDe(pieza) + 1) * 1000);
}

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
  r.onMessage(DIRECTOR_MSG.musica, (m: DirectorMusica) => sonarPieza(m.pieza, true));
}

export function resetDirector() {
  room = null;
  sonarPieza(null);
  useDirectorStore.setState({ open: false, pending: false, last: null });
}
