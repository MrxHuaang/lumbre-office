// Registro de comandos de la paleta (Ctrl+K / Cmd+K, components/palette/): cualquier parte del HUD o del
// juego suma los suyos sin tocar la paleta. Dos formas:
//   - fijos: `registerCommand({ id, title, group, run })` (devuelve cómo sacarlo);
//   - que dependen del estado (una persona, un lugar): `registerCommandSource(() => [...])`, que se vuelve a
//     llamar cada vez que se abre la paleta o cambia lo que se escribe.
// `when` los esconde cuando no aplican (p. ej. "Prender el PC" solo sentado frente a uno). Dentro de un
// componente de React, `useCommands(() => [...])` los registra al montar y los saca al desmontar.
//
// Ejemplo (lo que falta de game/comunicacion.ts: llamar, saludar y seguir a alguien):
//
//   registerCommandSource(() =>
//     Object.values(useOfficeStore.getState().players)
//       .filter((p) => p.sessionId !== useOfficeStore.getState().sessionId)
//       .map((p) => ({
//         id: `llamar:${p.userId}`,
//         group: "Personas",
//         title: `Llamar a ${p.name}`,
//         keywords: ["telefono", "llamada"],
//         icon: "phone",
//         run: () => llamar(p.userId),
//       })),
//   );
import { useEffect, useRef } from "react";
import type { PixelIconName } from "@/components/Cozy";
import { fuzzyRank } from "./fuzzy";

/** Grupos en el orden en que se muestran (uno nuevo va al final). */
export const COMMAND_GROUPS = ["Personas", "Lugares", "Abrir", "Estado", "Emotes", "Ajustes"] as const;
export type CommandGroup = (typeof COMMAND_GROUPS)[number] | (string & {});

export interface Command {
  /** Único en toda la paleta ("abrir:mochila", "ir:zona:cafeteria"). */
  id: string;
  title: string;
  /** Línea chica debajo (dónde está alguien, en qué nivel queda un lugar). */
  subtitle?: string;
  /** Palabras que también lo encuentran (sin tildes da igual). */
  keywords?: readonly string[];
  group: CommandGroup;
  icon?: PixelIconName;
  /** Atajo que se muestra a la derecha ("I", "Ctrl K"). */
  hint?: string;
  /** Si está pero no se puede ahora (se ve apagado, con el motivo): p. ej. "La casa del árbol está llena". */
  disabled?: string | null;
  /** Deja la paleta abierta al usarlo (un interruptor que se quiere ver cambiar). */
  keepOpen?: boolean;
  run: () => void;
  when?: () => boolean;
}

type Source = () => readonly Command[];

const fixed = new Map<string, Command>();
const sources = new Set<Source>();
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((fn) => fn());

export function registerCommand(cmd: Command): () => void {
  fixed.set(cmd.id, cmd);
  changed();
  return () => {
    if (fixed.get(cmd.id) === cmd) fixed.delete(cmd.id);
    changed();
  };
}

export function registerCommands(cmds: readonly Command[]): () => void {
  const offs = cmds.map(registerCommand);
  return () => offs.forEach((off) => off());
}

export function registerCommandSource(source: Source): () => void {
  sources.add(source);
  changed();
  return () => {
    sources.delete(source);
    changed();
  };
}

/** Avisa cuando se registra o se saca algo (la paleta abierta se vuelve a armar). */
export function subscribeCommands(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const groupRank = (g: string) => {
  const i = (COMMAND_GROUPS as readonly string[]).indexOf(g);
  return i < 0 ? COMMAND_GROUPS.length : i;
};

/** Todos los comandos que aplican ahora, por grupo (el orden de adentro de cada grupo se respeta). */
export function listCommands(): Command[] {
  const seen = new Set<string>();
  const out: Command[] = [];
  const add = (c: Command) => {
    if (seen.has(c.id)) return;
    try {
      if (c.when && !c.when()) return;
    } catch {
      return;
    }
    seen.add(c.id);
    out.push(c);
  };
  for (const c of fixed.values()) add(c);
  for (const source of sources) {
    try {
      source().forEach(add);
    } catch (err) {
      console.error("Comandos de la paleta", err);
    }
  }
  return out.map((c, i) => ({ c, i })).sort((a, b) => groupRank(a.c.group) - groupRank(b.c.group) || a.i - b.i).map((x) => x.c);
}

/** Texto donde busca la paleta: el título manda, después las palabras clave, el grupo y la línea chica. */
export const commandSearchText = (c: Command) => [c.title, ...(c.keywords ?? []), c.group, c.subtitle ?? ""].join(" · ");

/**
 * Lo que muestra la paleta al buscar: por puntaje (el título manda sobre las palabras clave), pero juntos por
 * grupo: primero el grupo del mejor resultado, y así. El primero es el que corre con Enter.
 */
export function rankCommands(query: string, all: readonly Command[], max = Infinity): Command[] {
  const ranked = fuzzyRank(query, all, commandSearchText, (c) => c.title).slice(0, max);
  const order = [...new Set(ranked.map((c) => c.group))];
  return order.flatMap((g) => ranked.filter((c) => c.group === g));
}

/** Registra comandos mientras el componente está montado; `build` se llama cada vez que se abre la paleta. */
export function useCommands(build: () => readonly Command[]) {
  const ref = useRef(build);
  ref.current = build;
  useEffect(() => registerCommandSource(() => ref.current()), []);
}
