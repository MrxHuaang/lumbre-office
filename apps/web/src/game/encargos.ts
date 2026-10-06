// Los encargos en el navegador: la libreta (lo que manda el servidor), el encargo fijado en el rastreador
// (guardado en el navegador), con quién estoy hablando y los avisos. Aquí no hay reglas: el servidor lleva
// el progreso, valida que estés junto a quien lo dio y paga; esto solo guarda lo que llega para la libreta,
// la tira de conversación de quien los da (VIR-171: lo que dice y las opciones salen de lib/encargosCharla.ts)
// y las marcas "!" y "?" sobre los personajes (encargosMarcas.ts).
import {
  HISTORIA_MSG,
  QUEST_ERROR_TEXT,
  QUEST_GIVERS,
  QUEST_MSG,
  QUEST_SKILL_TEXT,
  bagItemInfo,
  giverLine,
  questById,
  questGiver,
  questGiverNpc,
  questKey,
  type HistoriaAsk,
  type QuestClaimResult,
  type QuestDoneEvent,
  type QuestGiverId,
  type QuestListEvent,
  type QuestView,
} from "@hyvento/shared";
import { create } from "zustand";
import { accionDeOpcion, charlaDeEncargos } from "@/lib/encargosCharla";
import { abrirDialogo, cerrarDialogo, decirEnDialogo, retratoDe, useDialogo } from "./dialogo";
import { questSfx } from "./encargosSonidos";
import { getRoom, onAnyInteract, onInteract, onRoom, sendEmote } from "./network";
import { useOfficeStore, type Interactable } from "./store";

const PIN_KEY = "hyvento:encargo-fijo";
/** Guardado cuando alguien pidió no seguir ninguno. */
const PIN_NONE = "ninguno";

function loadPin(): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(PIN_KEY) : null;
  } catch {
    return null;
  }
}

interface EncargosStore {
  quests: QuestView[];
  loaded: boolean;
  /** El encargo fijado (`questKey`), "ninguno" o null (el primero sin entregar). */
  pinned: string | null;
  /** Quienes dan encargos al alcance del jugador (lo calcula la escena). */
  near: QuestGiverId[];
  /** Con quién estoy hablando (su cuadro abierto) y lo que dijo. */
  talking: { giver: QuestGiverId; line: string; seq: number } | null;
  /** El encargo que se está entregando (para el botón). */
  claiming: string | null;
}

let seq = 0;

export const useEncargos = create<EncargosStore>(() => ({ quests: [], loaded: false, pinned: loadPin(), near: [], talking: null, claiming: null }));

/** Los encargos de alguien que todavía no entregué (en la libreta). */
export const questsOfGiver = (quests: readonly QuestView[], giver: string) => quests.filter((q) => q.status !== "CLAIMED" && questById(q.questId)?.giver === giver);

/** Qué marca va sobre quien da encargos: "?" (uno listo para entregar), "!" (uno en curso) o nada. */
export function giverMark(quests: readonly QuestView[], giver: string): "ready" | "active" | null {
  const mine = questsOfGiver(quests, giver);
  if (mine.some((q) => q.status === "DONE")) return "ready";
  return mine.length ? "active" : null;
}

/** El encargo que va en el rastreador: el fijado si sigue ahí; si no se eligió, el primero sin entregar. */
export function trackedQuest(quests: readonly QuestView[], pinned: string | null): QuestView | null {
  if (pinned === PIN_NONE) return null;
  const open = quests.filter((q) => q.status !== "CLAIMED");
  return (pinned ? open.find((q) => questKey(q.questId, q.period) === pinned) : undefined) ?? open[0] ?? null;
}

/** Seguir un encargo en el rastreador (o ninguno). */
export function pinQuest(key: string | null) {
  const value = key ?? PIN_NONE;
  useEncargos.setState({ pinned: value });
  try {
    window.localStorage.setItem(PIN_KEY, value);
  } catch {
    // Sin almacenamiento: vale solo por esta visita.
  }
}

/** La tira de quien da encargos (una por persona). */
const tiraDe = (giver: QuestGiverId) => `encargo:${giver}`;

/**
 * Hablar con quien da encargos: la tira con lo que dice (el saludo, cómo voy y el consejo de la historia) y
 * sus opciones (entregar, preguntar, saludar, "Ver encargos", despedirse). La libreta de esa persona (el
 * panel de antes) se abre desde "Ver encargos".
 */
export function talkTo(giver: QuestGiverId) {
  const g = QUEST_GIVERS[giver];
  const day = new Date().toDateString();
  const saludo = giverLine(g.hello, `${giver}:${day}:${seq++}`);
  questSfx.open();
  charlar(giver, saludo);
}

/** Abre la tira (o, si ya está abierta, cambia lo que dice: las gracias después de entregar). */
function charlar(giver: QuestGiverId, saludo: string, o: { entregado?: string; gracias?: boolean } = {}) {
  const { lineas, opciones } = charlaDeEncargos(giver, useEncargos.getState().quests, saludo, o);
  const quien = tiraDe(giver);
  if (useDialogo.getState().actual?.quien === quien && (o.entregado || o.gracias)) return decirEnDialogo(quien, lineas, opciones);
  const npc = questGiverNpc(giver);
  abrirDialogo({
    quien,
    nombre: QUEST_GIVERS[giver].name,
    rol: "Encargos",
    retrato: npc ? retratoDe(npc.id) : null,
    // El tablón es una nota pegada: habla como narrador.
    narrador: giver === "tablon",
    voz: npc?.voz,
    lineas,
    opciones,
    alcance: () => useEncargos.getState().near.includes(giver),
    alElegir: (id) => elegir(giver, saludo, id),
  });
}

/** Lo que pasa al elegir una opción de la tira (true = la tira sigue abierta). */
function elegir(giver: QuestGiverId, saludo: string, id: string): boolean {
  const a = accionDeOpcion(id);
  const s = useEncargos.getState();
  switch (a.tipo) {
    case "entregar": {
      if (s.claiming) return true;
      const q = s.quests.find((x) => questKey(x.questId, x.period) === a.key);
      if (!q) return false;
      claimQuest(q);
      decirEnDialogo(tiraDe(giver), ["…"]);
      return true;
    }
    case "preguntar":
      // Lo que pasa lo decide la sala (casi siempre, una cinemática).
      getRoom()?.send(HISTORIA_MSG.ask, { questId: a.questId } satisfies HistoriaAsk);
      return false;
    case "saludar":
      sendEmote("wave");
      return false;
    case "ver":
      useEncargos.setState({ talking: { giver, line: saludo, seq: ++seq } });
      return false;
    default:
      return false;
  }
}

/** Cierra la libreta de quien da encargos (y su tira, si sigue abierta). */
export function stopTalking() {
  const t = useEncargos.getState().talking;
  if (t) cerrarDialogo(tiraDe(t.giver));
  useEncargos.setState({ talking: null });
}

/** Entregar un encargo cumplido (el servidor valida que estés junto a quien lo dio). */
export function claimQuest(q: Pick<QuestView, "questId" | "period">) {
  useEncargos.setState({ claiming: questKey(q.questId, q.period) });
  getRoom()?.send(QUEST_MSG.claim, { questId: q.questId, period: q.period });
}

/** Lo que pidió la libreta al abrir el menú de la mochila (la pestaña de encargos). */
let logRequested = false;
export function requestQuestLog() {
  logRequested = true;
  useOfficeStore.getState().openPanel("backpack", false);
}
/** ¿Se pidió abrir en la libreta? (se mira al montar el menú y se olvida con `clearQuestLogRequest`). */
export const questLogRequested = () => logRequested;
export function clearQuestLogRequest() {
  logRequested = false;
}

/** Los objetos del juego que también son de alguien que da encargos (E abre lo suyo y, además, lo que te pidió). */
const GIVER_OF_KIND: Partial<Record<Interactable, QuestGiverId>> = {
  board: "tablon",
  pesca: "evelio",
  astronomer: "celeste",
  cashier: "cajera",
  roulette: "crupier",
};

/** ¿Hay alguien al alcance con un encargo mío sin entregar? (para la "E" de los que no tienen otro objeto). */
export function questGiverToTalk(): QuestGiverId | null {
  const { near, quests } = useEncargos.getState();
  return near.find((g) => questsOfGiver(quests, g).length > 0) ?? null;
}

function onList(e: QuestListEvent) {
  useEncargos.setState({ quests: e.quests, loaded: true, claiming: null });
}

/** Solo lo que avanzó: se reemplaza en la libreta (lo que no estaba, se agrega). */
function onProgress(e: QuestListEvent) {
  useEncargos.setState((s) => {
    const byKey = new Map(e.quests.map((q) => [questKey(q.questId, q.period), q]));
    const quests = s.quests.map((q) => byKey.get(questKey(q.questId, q.period)) ?? q);
    for (const [k, q] of byKey) if (!s.quests.some((x) => questKey(x.questId, x.period) === k)) quests.push(q);
    return { quests };
  });
}

function onDone(e: QuestDoneEvent) {
  const def = questById(e.questId);
  if (!def) return;
  const giver = questGiver(def.giver);
  const to = def.giver === "tablon" ? "al tablón" : `a ${giver?.name ?? "quien te lo dio"}`;
  useOfficeStore.getState().notify(`¡Encargo cumplido! «${def.title}». Llévaselo ${to}.`, "success");
  questSfx.done();
}

function onResult(r: QuestClaimResult) {
  useEncargos.setState({ claiming: null });
  const store = useOfficeStore.getState();
  const def = questById(r.questId);
  if (!r.ok) {
    // Por qué no se pudo, en la tira (con las opciones otra vez) si sigue abierta; si no, el aviso.
    if (def && useDialogo.getState().actual?.quien === tiraDe(def.giver)) return charlar(def.giver, QUEST_ERROR_TEXT[r.error], { gracias: true });
    return store.notify(QUEST_ERROR_TEXT[r.error], r.error === "busy" ? "info" : "warning");
  }
  const extra = [r.points > 0 ? `+${r.points} puntos` : null, `+${r.xp} de ${QUEST_SKILL_TEXT[r.skill].toLowerCase()}`, r.item ? bagItemInfo(r.item).name.toLowerCase() : null].filter(Boolean).join(" · ");
  store.notify(`Entregaste «${def?.title ?? "el encargo"}»: ${extra}${r.capped ? " (ya llegaste al tope de puntos de hoy)" : ""}.`, "success");
  questSfx.claim();
  const giver = def ? QUEST_GIVERS[def.giver] : undefined;
  if (!giver || !def) return;
  const thanks = giverLine(giver.thanks, `${r.questId}:${r.period}`);
  // Las gracias en la tira (con lo que queda), y en la libreta si está abierta.
  if (useDialogo.getState().actual?.quien === tiraDe(def.giver)) charlar(def.giver, thanks, { entregado: questKey(r.questId, r.period), gracias: true });
  const talking = useEncargos.getState().talking;
  if (talking?.giver === def.giver) useEncargos.setState({ talking: { ...talking, line: thanks, seq: ++seq } });
}

if (typeof window !== "undefined") {
  onInteract("encargo", () => {
    const giver = questGiverToTalk();
    if (giver) talkTo(giver);
  });
  // El tablón, el mostrador de Don Evelio, la astrónoma, la caja y la ruleta: lo suyo y, si me pidieron algo, el cuadro.
  onAnyInteract((kind) => {
    const giver = GIVER_OF_KIND[kind];
    if (giver && questsOfGiver(useEncargos.getState().quests, giver).length > 0) talkTo(giver);
  });
  onRoom((room) => {
    useEncargos.setState({ quests: [], loaded: false, talking: null, claiming: null });
    room.onMessage(QUEST_MSG.list, onList);
    room.onMessage(QUEST_MSG.progress, onProgress);
    room.onMessage(QUEST_MSG.done, onDone);
    room.onMessage(QUEST_MSG.result, onResult);
  });
}
