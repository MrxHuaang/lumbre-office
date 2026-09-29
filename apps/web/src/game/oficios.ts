// Los oficios en el navegador: mi experiencia y nivel de cada uno (lo manda el servidor), la subida de
// nivel (fanfarria para mí y chispas sobre quien subió, para todos los del nivel), las ventajas que salen
// (cosecha doble, porción de más), el detalle gratis del día y las pistas del diario. Aquí no hay reglas:
// el servidor suma, sube de nivel y valida; esto solo guarda lo que llega.
import {
  OFICIO_GIFT_ERROR_TEXT,
  OFICIO_INFO,
  OFICIO_MSG,
  OFICIOS,
  bagItemInfo,
  objItemId,
  portionOf,
  rewardsOf,
  type Oficio,
  type OficioGiftResult,
  type OficioGiftedEvent,
  type OficioHints,
  type OficioLevelUpEvent,
  type OficioLevels,
  type OficioNotice,
  type OficioStateEvent,
} from "@hyvento/shared";
import { create } from "zustand";
import { oficioSfx } from "./oficiosSonidos";
import { getRoom, onRoom } from "./network";
import { useOfficeStore } from "./store";

interface OficiosStore {
  state: OficioStateEvent | null;
  /** La última subida de nivel que se vio en este nivel (la escena pone las chispas). */
  levelUp: (OficioLevelUpEvent & { seq: number }) | null;
  hints: OficioHints | null;
}

let seq = 0;

export const useOficios = create<OficiosStore>(() => ({ state: null, levelUp: null, hints: null }));

/** Mis niveles (1 en todos mientras no llega nada). */
export function myLevels(): OficioLevels {
  const s = useOficios.getState().state;
  return Object.fromEntries(OFICIOS.map((o) => [o, s?.skills[o].level ?? 1])) as OficioLevels;
}

/** Para React: mis niveles, que se actualizan solos. */
export const useMyLevels = (): OficioLevels => {
  const s = useOficios((x) => x.state);
  return Object.fromEntries(OFICIOS.map((o) => [o, s?.skills[o].level ?? 1])) as OficioLevels;
};

/** El detalle gratis del día (Social 5) para alguien de al lado. */
export function sendOficioGift(sessionId: string) {
  getRoom()?.send(OFICIO_MSG.gift, { sessionId });
}

/** Pide las pistas del diario (Exploración 5). */
export function askHints() {
  useOficios.setState({ hints: null });
  getRoom()?.send(OFICIO_MSG.hints);
}

function onLevelUp(e: OficioLevelUpEvent) {
  useOficios.setState({ levelUp: { ...e, seq: ++seq } });
  if (e.sessionId !== useOfficeStore.getState().sessionId) return;
  const reward = rewardsOf(e.oficio).find((r) => r.level === e.level);
  const extra = reward ? ` Desbloqueaste: ${reward.label}.` : "";
  useOfficeStore.getState().notify(`¡${OFICIO_INFO[e.oficio].name} nivel ${e.level}!${extra}`, "success");
  oficioSfx.fanfare(e.level);
}

function onNotice(n: OficioNotice) {
  const name = n.code === "harvest" ? bagItemInfo(objItemId(n.item)).name.toLowerCase() : bagItemInfo(objItemId(portionOf(n.item))).name.toLowerCase();
  useOfficeStore.getState().notify(n.code === "harvest" ? `¡Cosecha doble! Buena mano: ${name} de más.` : `Rindió: ${name} de más a la mochila.`, "success");
}

function onGiftResult(r: OficioGiftResult) {
  const store = useOfficeStore.getState();
  if (!r.ok) return store.notify(OFICIO_GIFT_ERROR_TEXT[r.error], "warning");
  store.notify(`Le diste un detalle a ${r.toName}: ${bagItemInfo(r.item).name.toLowerCase()}.`, "success");
}

function onGifted(e: OficioGiftedEvent) {
  useOfficeStore.getState().notify(`${e.fromName} te regaló un detalle: ${bagItemInfo(e.item).name.toLowerCase()}.`, "success");
}

if (typeof window !== "undefined") {
  onRoom((room) => {
    useOficios.setState({ state: null, levelUp: null, hints: null });
    room.onMessage(OFICIO_MSG.state, (e: OficioStateEvent) => useOficios.setState({ state: e }));
    room.onMessage(OFICIO_MSG.levelUp, onLevelUp);
    room.onMessage(OFICIO_MSG.notice, onNotice);
    room.onMessage(OFICIO_MSG.giftResult, onGiftResult);
    room.onMessage(OFICIO_MSG.gifted, onGifted);
    room.onMessage(OFICIO_MSG.hintsResult, (h: OficioHints) => useOficios.setState({ hints: h }));
  });
}

