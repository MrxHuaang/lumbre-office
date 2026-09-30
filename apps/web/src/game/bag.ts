// La mochila en el navegador: lo que manda el servidor (casillas, lo que no cabe, la casilla elegida) y
// lo que se le pide (elegir casilla, mover, tirar). La barra de abajo muestra una fila de 12; Tab cambia la
// fila y 1–9, 0, -, = eligen la casilla. El servidor valida todo y pone lo de la mano en `Player.held`.
import { BAG, BAG_MSG, BAG_NOTICES, bagCol, bagRow, nextBagRow, type BagNotice, type BagSlots, type BagView, type ItemStack } from "@hyvento/shared";
import type { Room } from "colyseus.js";
import { create } from "zustand";
import { useOfficeStore } from "./store";

interface BagState {
  slots: BagSlots;
  overflow: ItemStack[];
  /** La casilla elegida (lo de la mano). La fila que muestra la barra es la suya. */
  selected: number;
  /** Títulos de las hojas impresas de mis notas (itemId → título); ver `bagItemName`. */
  titles: Readonly<Record<string, string>>;
  /** Ya llegó la mochila del servidor. */
  loaded: boolean;
  /** Sube con cada cambio de fila (la barra anima la fila nueva) y hacia dónde fue. */
  rowTurn: number;
  rowStep: 1 | -1;
  apply(view: BagView): void;
}

const empty = (): BagSlots => Array.from({ length: BAG.slots }, () => null);

/** Hacia dónde gira la barra al pasar de una casilla a otra (null = misma fila): Tab va de 3 a 1 "hacia abajo". */
function rowStep(from: number, to: number): 1 | -1 | null {
  const a = bagRow(from);
  const b = bagRow(to);
  if (a === b) return null;
  return b === (a + 1) % BAG.rows ? 1 : -1;
}

export const useBagStore = create<BagState>()((set, get) => ({
  slots: empty(),
  overflow: [],
  selected: 0,
  titles: {},
  loaded: false,
  rowTurn: 0,
  rowStep: 1,
  apply: (view) => {
    const s = get();
    // La casilla la maneja el cliente (así la rueda no salta con respuestas atrasadas), salvo que el
    // servidor la haya elegido (al entrar, o porque llegó algo con las manos libres).
    const selected = view.pick || !s.loaded ? view.selected : s.selected;
    const step = s.loaded ? rowStep(s.selected, selected) : null;
    set({ slots: view.slots, overflow: view.overflow, selected, titles: view.titles ?? {}, loaded: true, ...(step ? { rowTurn: s.rowTurn + 1, rowStep: step } : {}) });
  },
}));

let room: Room | null = null;

/** Engancha la mochila a la sala (al conectar y al reconectar). */
export function bindBag(r: Room) {
  room = r;
  r.onMessage(BAG_MSG.state, (view: BagView) => useBagStore.getState().apply(view));
  r.onMessage(BAG_MSG.notice, (n: BagNotice) => {
    const text = BAG_NOTICES[n.code];
    if (text) useOfficeStore.getState().notify(text, "info");
  });
}

/** Elegir una casilla (lo que haya queda en la mano; lo confirma el servidor). */
export function selectSlot(slot: number) {
  const s = useBagStore.getState();
  if (slot < 0 || slot >= BAG.slots || slot === s.selected) return;
  const step = rowStep(s.selected, slot);
  useBagStore.setState({ selected: slot, ...(step ? { rowTurn: s.rowTurn + 1, rowStep: step } : {}) });
  room?.send(BAG_MSG.select, { slot });
}

/** 1–12 de la fila que se ve en la barra. */
export const selectColumn = (col: number) => selectSlot(bagRow(useBagStore.getState().selected) * BAG.cols + col);

/** Tab: la fila siguiente (o la anterior), en la misma columna. */
export const turnRow = (step: 1 | -1 = 1) => selectSlot(nextBagRow(useBagStore.getState().selected, step));

/** La rueda del mouse sobre la barra: la casilla de al lado dentro de la misma fila. */
export function stepColumn(step: 1 | -1) {
  const sel = useBagStore.getState().selected;
  selectSlot(bagRow(sel) * BAG.cols + ((bagCol(sel) + step + BAG.cols) % BAG.cols));
}

/** Llevar algo a otra casilla (intercambia con lo que haya). Se ve al instante; el servidor lo guarda. */
export function moveItem(itemId: string, to: number) {
  const s = useBagStore.getState();
  const from = s.slots.findIndex((x) => x?.itemId === itemId);
  if (from === to) return;
  const slots = [...s.slots];
  const moving = from >= 0 ? slots[from] : s.overflow.find((x) => x.itemId === itemId);
  if (!moving) return;
  const other = slots[to];
  slots[to] = moving;
  let overflow = s.overflow.filter((x) => x.itemId !== itemId);
  if (from >= 0) slots[from] = other ?? null;
  else if (other) overflow = [...overflow, other];
  useBagStore.setState({ slots, overflow });
  room?.send(BAG_MSG.move, { itemId, to });
}

/** Tirar unidades de un objeto (los muebles no se tiran). */
export function dropItem(itemId: string, quantity: number) {
  room?.send(BAG_MSG.drop, { itemId, quantity });
}
