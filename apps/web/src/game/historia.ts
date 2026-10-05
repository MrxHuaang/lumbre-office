// La historia en el navegador (ver historia.ts de @hyvento/shared): la bienvenida de Doña Aurora (llega del
// servidor solo a quien recién entró; si vino en el Megabús, se muestra al bajarse), saltar el capítulo,
// avisar que se leyó el tablón (paso 5; el servidor revisa que esté junto a él), la carta que llega al buzón
// y el paso de la historia que va ahora (para la flechita y el cuadro de Doña Aurora). La bienvenida y el
// final del capítulo se ven como cinemáticas (cinematicas/); sin cinemáticas, la bienvenida es el cuadro.
import {
  BUS,
  CAPITULO_1,
  CAPITULOS,
  HISTORIA_MSG,
  RELOJ_PASOS,
  STORY_PERIOD,
  isStoryQuest,
  type HistoriaCine,
  type HistoriaLetter,
  type HistoriaPrologue,
  type QuestView,
} from "@hyvento/shared";
import { cineWanted, onCineAction, playCinematic, whenCineReady } from "./cinematicas/puerta";
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
  // "Ya me conozco la casa" en la bienvenida: lo mismo que "Saltar historia".
  onCineAction("saltar-historia", skipStory);
  onRoom((room) => {
    useHistoria.setState({ prologue: null });
    room.onMessage(HISTORIA_MSG.prologue, (p: HistoriaPrologue) => showPrologue({ ...p, open: !onBus() }));
    room.onMessage(HISTORIA_MSG.letter, (l: HistoriaLetter) => {
      useOfficeStore.getState().notify("Te llegó una carta al buzón del jardín. Viene sin remitente… solo una inicial.", "success");
      questSfx.claim();
      const cap = CAPITULOS.find((c) => c.id === l?.chapter) ?? CAPITULO_1;
      void playCinematic("capitulo", { n: cap.n, titulo: cap.title });
    });
    // Lo que manda la sala de cada capítulo: una cinemática (el reloj, una pieza) o un aviso.
    room.onMessage(HISTORIA_MSG.cine, (c: HistoriaCine) => void playCinematic(c.id, c.vars ?? {}));
    room.onMessage(HISTORIA_MSG.aviso, (a: { text: string }) => useOfficeStore.getState().notify(a.text, "info"));
  });
  // Quien llegó en el bus ve la bienvenida al bajarse.
  useOfficeStore.subscribe(() => {
    const p = useHistoria.getState().prologue;
    if (p && !p.open && !onBus()) showPrologue({ ...p, open: true });
  });
}

/**
 * La bienvenida: la cinemática de Doña Aurora si se pueden ver (espera a que la escena esté lista: el aviso
 * llega apenas se entra), si no el cuadro.
 */
function showPrologue(p: HistoriaPrologue & { open: boolean }) {
  if (p.open && cineWanted("prologo")) {
    useHistoria.setState({ prologue: null });
    void whenCineReady().then(() => playCinematic("prologo"));
    return;
  }
  useHistoria.setState({ prologue: p });
}

// ---------- Capítulo 2: el reloj de pie ----------

/** ¿Anda buscando el péndulo? (el Man del Sombrero se lo ofrece). */
export function usePenduloBuscado(): boolean {
  return useEncargos((s) => s.quests.some((q) => q.questId === RELOJ_PASOS.pendulo && q.period === STORY_PERIOD && q.status === "ACTIVE" && q.progress < q.goal));
}

export function buyPendulum() {
  getRoom()?.send(HISTORIA_MSG.pendulo);
}
