// La charla con quien da encargos (VIR-171), lo puro: lo que dice en la tira al hablarle con E (el saludo o
// las gracias, cómo vas con lo que te pidió y el consejo del paso de la historia) y las opciones (entregar,
// preguntar, saludar, "Ver encargos" para la libreta de esa persona y despedirse). El tablón habla como
// narrador (es una nota, no una persona). Lo arma game/encargos.ts; los botones los decide la sala.
import { STORY_ASKS, STORY_LESSONS, STORY_PERIOD, isStoryQuest, questById, questKey, questProgressText, type QuestGiverId, type QuestView } from "@hyvento/shared";
import type { DialogoOpcion } from "./dialogo";

export interface CharlaEncargos {
  lineas: string[];
  opciones: DialogoOpcion[];
}

/** Cuántas cosas listas se ofrecen para entregar en la tira (el resto, en "Ver encargos"). */
export const MAX_ENTREGAS = 3;

/** Los encargos de alguien que todavía no entregué. */
export const encargosDe = (quests: readonly QuestView[], giver: string) => quests.filter((q) => q.status !== "CLAIMED" && questById(q.questId)?.giver === giver);

/** El paso de la historia que va ahora (el abierto o el cumplido por entregar), o null si terminó. */
export const pasoDeHistoria = (quests: readonly QuestView[]): QuestView | null =>
  quests.find((q) => q.period === STORY_PERIOD && isStoryQuest(q.questId) && q.status !== "CLAIMED") ?? null;

const titulo = (q: QuestView) => questById(q.questId)?.title ?? "el encargo";

/** Cómo lo dice cada uno: el tablón como notas pegadas, la gente de usted. */
const FRASES = {
  persona: {
    listo: (t: string) => `Lo de «${t}» ya está listo. ¿Me lo entrega?`,
    listos: (n: number) => `Tiene ${n} encargos listos para entregarme.`,
    curso: (t: string, p: string) => `Lo de «${t}» va en ${p}. Sin afán.`,
    cursos: (n: number) => `Le tengo ${n} encargos en curso. Mírelos cuando quiera.`,
    nada: "Por hoy no le tengo nada pendiente. Vuelva mañana, que siempre hay algo.",
  },
  tablon: {
    listo: (t: string) => `La nota «${t}» ya se puede tachar.`,
    listos: (n: number) => `Hay ${n} notas tuyas listas para tachar.`,
    curso: (t: string, p: string) => `La nota «${t}» sigue pegada: ${p}.`,
    cursos: (n: number) => `Hay ${n} notas tuyas pegadas todavía.`,
    nada: "No queda ninguna nota para ti. Mañana habrá más.",
  },
} as const;

/**
 * La charla con quien da encargos. `saludo` es lo primero que dice (su saludo o, después de entregar, sus
 * gracias); `entregado` saca de la cuenta lo que se acaba de entregar (la libreta llega después).
 */
export function charlaDeEncargos(giver: QuestGiverId, quests: readonly QuestView[], saludo: string, o: { entregado?: string; gracias?: boolean } = {}): CharlaEncargos {
  const f = giver === "tablon" ? FRASES.tablon : FRASES.persona;
  const mine = encargosDe(quests, giver).filter((q) => questKey(q.questId, q.period) !== o.entregado);
  const listos = mine.filter((q) => q.status === "DONE");
  const lineas = [saludo];
  if (listos.length === 1) lineas.push(f.listo(titulo(listos[0]!)));
  else if (listos.length > 1) lineas.push(f.listos(listos.length));
  else if (mine.length === 1) lineas.push(f.curso(titulo(mine[0]!), questProgressText(mine[0]!, questById(mine[0]!.questId))));
  else if (mine.length > 1) lineas.push(f.cursos(mine.length));
  else if (!o.gracias) lineas.push(f.nada);

  // El paso de la historia que da esta persona: su consejo y lo que se le puede preguntar o hacer.
  const paso = pasoDeHistoria(quests);
  const delPaso = paso && questKey(paso.questId, paso.period) !== o.entregado && questById(paso.questId)?.giver === giver ? paso : null;
  const abierto = delPaso?.status === "ACTIVE";
  const consejo = abierto ? STORY_LESSONS[delPaso.questId] : undefined;
  if (consejo) lineas.push(consejo);

  const opciones: DialogoOpcion[] = listos
    .slice(0, MAX_ENTREGAS)
    .map((q) => ({ id: `entregar:${questKey(q.questId, q.period)}`, label: listos.length > 1 ? `Entregar «${titulo(q)}»` : "Entregar" }));
  if (abierto && delPaso.questId === "llegada-3") opciones.push({ id: "saludar", label: "Saludar a Doña Aurora" });
  if (abierto && STORY_ASKS[delPaso.questId]) opciones.push({ id: `preguntar:${delPaso.questId}`, label: STORY_ASKS[delPaso.questId]! });
  if (mine.length) opciones.push({ id: "ver", label: "Ver encargos" });
  opciones.push({ id: "chao", label: giver === "tablon" ? "Dejar el tablón" : "Hasta luego" });
  return { lineas, opciones };
}

/** Lo que pide una opción de la charla (para que game/encargos.ts lo haga). */
export type AccionCharla =
  | { tipo: "entregar"; key: string }
  | { tipo: "preguntar"; questId: string }
  | { tipo: "saludar" }
  | { tipo: "ver" }
  | { tipo: "chao" };

export function accionDeOpcion(id: string): AccionCharla {
  if (id.startsWith("entregar:")) return { tipo: "entregar", key: id.slice("entregar:".length) };
  if (id.startsWith("preguntar:")) return { tipo: "preguntar", questId: id.slice("preguntar:".length) };
  if (id === "saludar" || id === "ver") return { tipo: id };
  return { tipo: "chao" };
}
