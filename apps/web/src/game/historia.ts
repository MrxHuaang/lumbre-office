// La historia en el navegador (ver historia.ts de @hyvento/shared): la bienvenida de Doña Aurora (llega del
// servidor solo a quien recién entró; si vino en el Megabús, se muestra al bajarse), saltar el capítulo,
// avisar que se leyó el tablón (paso 5; el servidor revisa que esté junto a él), la carta que llega al buzón
// y el paso de la historia que va ahora (para la flechita y el cuadro de Doña Aurora). La bienvenida y el
// final del capítulo se ven como cinemáticas (cinematicas/); sin cinemáticas, la bienvenida va en la tira.
import {
  AURORA_WELCOME,
  AURORA_WELCOME_BUS,
  BUS,
  CAPITULO_1,
  CAPITULOS,
  EVELIO_INSISTE,
  HISTORIA_MSG,
  LAGO_CINE,
  LAGO_PASOS,
  QUEST_GIVERS,
  RELOJ_PASOS,
  questById,
  questGiverNpc,
  type HistoriaAsk,
  type HistoriaCine,
  type HistoriaLetter,
  type HistoriaPrologue,
  type QuestView,
  STORY_PERIOD,
} from "@hyvento/shared";
import { create } from "zustand";
import { pasoDeHistoria } from "@/lib/encargosCharla";
import { cineWanted, onCineAction, playCinematic, whenCineReady } from "./cinematicas/puerta";
import { abrirDialogo, retratoDe } from "./dialogo";
import { questSfx } from "./encargosSonidos";
import { useEncargos } from "./encargos";
import { getRoom, onAnyInteract, onRoom } from "./network";
import { useOfficeStore } from "./store";

interface HistoriaStore {
  /** La bienvenida que espera a que se baje del bus (al bajarse sale como cinemática o en la tira). */
  prologue: (HistoriaPrologue & { open: boolean }) | null;
}

export const useHistoria = create<HistoriaStore>(() => ({ prologue: null }));

/** El paso de la historia que va ahora (el abierto o el cumplido por entregar), o null si terminó. */
export const currentStoryStep = (quests: readonly QuestView[]): QuestView | null => pasoDeHistoria(quests);

export function skipStory() {
  getRoom()?.send(HISTORIA_MSG.skip);
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
    room.onMessage(HISTORIA_MSG.cine, (c: HistoriaCine) => void playStoryCine(c));
    room.onMessage(HISTORIA_MSG.aviso, (a: { text: string }) => useOfficeStore.getState().notify(a.text, "info"));
  });
  // Quien llegó en el bus ve la bienvenida al bajarse.
  useOfficeStore.subscribe(() => {
    const p = useHistoria.getState().prologue;
    if (p && !p.open && !onBus()) showPrologue({ ...p, open: true });
  });}

/**
 * La bienvenida: la cinemática de Doña Aurora si se pueden ver, si no su tira (las dos esperan a que la
 * escena esté lista: el aviso llega apenas se entra). En el bus, espera a que se baje.
 */
function showPrologue(p: HistoriaPrologue & { open: boolean }) {
  if (!p.open) return useHistoria.setState({ prologue: p });
  useHistoria.setState({ prologue: null });
  if (cineWanted("prologo")) {
    void whenCineReady().then(() => playCinematic("prologo"));
    return;
  }
  void whenCineReady().then(() => bienvenidaEnTira(p.byBus));
}

/** La bienvenida sin cinemáticas: Doña Aurora en la tira, con el primer paso, "¡Vamos!" y "Saltar historia". */
function bienvenidaEnTira(byBus: boolean | undefined) {
  const aurora = questGiverNpc("aurora");
  const step = currentStoryStep(useEncargos.getState().quests);
  const def = step ? questById(step.questId) : undefined;
  const lineas = [
    ...(byBus ? [AURORA_WELCOME_BUS] : []),
    ...AURORA_WELCOME,
    ...(def ? [`El primer paso: ${def.title}. ${def.text}`] : []),
    "Me encuentra en el recibidor de la planta baja, junto a la escalera. La flechita le muestra a dónde ir.",
  ];
  abrirDialogo({
    quien: "historia:bienvenida",
    nombre: QUEST_GIVERS.aurora.name,
    rol: `Capítulo 1 · ${CAPITULO_1.title}`,
    retrato: aurora ? retratoDe(aurora.id) : null,
    voz: aurora?.voz,
    lineas,
    opciones: [
      { id: "vamos", label: "¡Vamos!" },
      { id: "saltar", label: "Saltar historia" },
    ],
    alElegir: (id) => {
      if (id === "saltar" && window.confirm("¿Saltar la historia? Los pasos quedan entregados sin puntos, pero te llegan el logro y la carta igual.")) skipStory();
      return false;
    },
  });
}

// ---------- Capítulo 2: el reloj de pie ----------

/** ¿Anda buscando el péndulo? (el Man del Sombrero se lo ofrece). */
export function usePenduloBuscado(): boolean {
  return useEncargos((s) => s.quests.some((q) => q.questId === RELOJ_PASOS.pendulo && q.period === STORY_PERIOD && q.status === "ACTIVE" && q.progress < q.goal));
}

export function buyPendulum() {
  getRoom()?.send(HISTORIA_MSG.pendulo);
}

// ---------- Preguntarle a quien da el paso (capítulo 3 en adelante) ----------

/** ¿Tiene abierto (sin cumplir) ese paso de historia? */
export const storyStepOpen = (quests: readonly QuestView[], questId: string) =>
  quests.some((q) => q.questId === questId && q.period === STORY_PERIOD && q.status === "ACTIVE" && q.progress < q.goal);

export function useStoryStepOpen(...questIds: string[]): boolean {
  return useEncargos((s) => questIds.some((id) => storyStepOpen(s.quests, id)));
}

/** El botón del cuadro de quien da el paso ("Preguntarle por…"): lo que pasa lo decide la sala. */
export function askStory(questId: string) {
  getRoom()?.send(HISTORIA_MSG.ask, { questId } satisfies HistoriaAsk);
}

/** La pausa de la sala entre dos preguntas: si la cinemática no se vio, se espera antes de insistir. */
const ASK_PAUSE_MS = 1100;

/**
 * Una cinemática de la sala del capítulo. Si Don Evelio se hizo el loco y se eligió mostrarle la carta (o
 * se saltó la escena: vale la primera opción), se le vuelve a preguntar y suelta la receta.
 */
async function playStoryCine(c: HistoriaCine) {
  const started = performance.now();
  const choice = await playCinematic(c.id, c.vars ?? {});
  if (c.id !== LAGO_CINE.evelioLoco || choice !== EVELIO_INSISTE) return;
  const wait = Math.max(0, ASK_PAUSE_MS - (performance.now() - started));
  setTimeout(() => askStory(LAGO_PASOS.evelio), wait);
}
