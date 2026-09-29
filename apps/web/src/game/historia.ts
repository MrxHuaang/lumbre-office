// La historia en el navegador (ver historia.ts de @hyvento/shared): la bienvenida de Doña Aurora (llega del
// servidor solo a quien recién entró; si vino en el Megabús, se muestra al bajarse), saltar el capítulo,
// avisar que se leyó el tablón (paso 5; el servidor revisa que esté junto a él), la carta que llega al buzón
// y el paso de la historia que va ahora (para la flechita y el cuadro de Doña Aurora).
import { BUS, HISTORIA_MSG, STORY_PERIOD, isStoryQuest, type HistoriaPrologue, type QuestView } from "@hyvento/shared";
import { create } from "zustand";
import { questSfx } from "./encargosSonidos";
import { useEncargos } from "./encargos";
import { getRoom, onAnyInteract, onRoom } from "./network";
import { useOfficeStore } from "./store";

interface HistoriaStore {
  /** La bienvenida pendiente (se muestra fuera del bus) y si ya se está mostrando. */
  prologue: (HistoriaPrologue & { open: boolean }) | null;
}

export const useHistoria = create<HistoriaStore>(() => ({ prologue: null }));

/** El paso de la historia que va ahora (el abierto o el cumplido por entregar), o null si terminó. */
export function currentStoryStep(quests: readonly QuestView[]): QuestView | null {
  return quests.find((q) => q.period === STORY_PERIOD && isStoryQuest(q.questId) && q.status !== "CLAIMED") ?? null;
}

export function skipStory() {
  getRoom()?.send(HISTORIA_MSG.skip);
  useHistoria.setState({ prologue: null });
}

export function closePrologue() {
  useHistoria.setState({ prologue: null });
}

/** ¿Estoy en el Megabús? (la bienvenida espera a que se baje). */
const onBus = () => {
  const s = useOfficeStore.getState();
  return s.sessionId ? s.players[s.sessionId]?.area === BUS.area : false;
};

if (typeof window !== "undefined") {
  // El tablón: además de sus misiones, cuenta como leído para la historia (el servidor mide la distancia).
  onAnyInteract((kind) => {
    if (kind !== "board") return;
    const step = currentStoryStep(useEncargos.getState().quests);
    if (step?.questId === "llegada-5" && step.status === "ACTIVE") getRoom()?.send(HISTORIA_MSG.board);
  });
  onRoom((room) => {
    useHistoria.setState({ prologue: null });
    room.onMessage(HISTORIA_MSG.prologue, (p: HistoriaPrologue) => useHistoria.setState({ prologue: { ...p, open: !onBus() } }));
    room.onMessage(HISTORIA_MSG.letter, () => {
      useOfficeStore.getState().notify("Te llegó una carta al buzón del jardín. Viene sin remitente… solo una inicial.", "success");
      questSfx.claim();
    });
  });
  // Quien llegó en el bus ve la bienvenida al bajarse.
  useOfficeStore.subscribe(() => {
    const p = useHistoria.getState().prologue;
    if (p && !p.open && !onBus()) useHistoria.setState({ prologue: { ...p, open: true } });
  });
}
