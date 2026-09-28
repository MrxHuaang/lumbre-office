// Ayuda de los comandos del chat: al escribir "/" se ven los que hay (los de admin solo para admins; los
// de desarrollo solo fuera de producción). Los interpreta el servidor (apps/server: /time, /ir, /clima);
// esto solo sugiere y completa.
import { TIME_NAMES } from "@hyvento/shared";

export interface ChatCommand {
  /** Cómo se escribe (lo que se muestra). */
  usage: string;
  /** Lo que queda en el input al elegirlo. */
  insert: string;
  help: string;
  admin?: boolean;
  dev?: boolean;
}

export const CHAT_COMMANDS: ChatCommand[] = [
  { usage: "/time", insert: "/time", help: "Qué hora es en la cabaña" },
  { usage: "/hora", insert: "/hora", help: "Lo mismo, en español" },
  {
    usage: "/time set <hh:mm|nombre>",
    insert: "/time set ",
    help: "Poner la hora: 18:30, dia, mediodia, tarde, atardecer, noche o medianoche",
    admin: true,
  },
  { usage: "/time add <n|nh>", insert: "/time add ", help: "Adelantar el reloj: minutos (90) u horas (2h)", admin: true },
  { usage: "/ir <nivel> [punto]", insert: "/ir ", help: "Saltar a un nivel (HYVENTO_DEV_TOOLS=1)", dev: true },
  { usage: "/clima <tipo>", insert: "/clima ", help: "Forzar el clima (HYVENTO_DEV_TOOLS=1)", dev: true },
];

/** Los nombres de hora de /time set en español (los de Minecraft también valen, pero no se ofrecen). */
const SET_NAMES = ["amanecer", "dia", "mediodia", "tarde", "atardecer", "noche", "medianoche"].filter((n) => n in TIME_NAMES);

export interface ChatSuggestion {
  label: string;
  insert: string;
  help: string;
}

/**
 * Qué sugerir para lo que va escrito: los comandos que empiezan así, el que ya se está escribiendo (con sus
 * argumentos) y, en "/time set …", los nombres de hora. Nada si no empieza con "/".
 */
export function chatSuggestions(text: string, who: { admin: boolean; dev: boolean }): ChatSuggestion[] {
  const q = text.trimStart().toLowerCase();
  if (!q.startsWith("/")) return [];
  const allowed = CHAT_COMMANDS.filter((c) => (!c.admin || who.admin) && (!c.dev || who.dev));
  const set = /^\/time set (\S*)$/.exec(q);
  if (set && who.admin) {
    const part = set[1]!;
    const names = SET_NAMES.filter((n) => n.startsWith(part) && n !== part).map((n) => ({
      label: `/time set ${n}`,
      insert: `/time set ${n}`,
      help: `Las ${String(Math.floor(TIME_NAMES[n]! / 60)).padStart(2, "0")}:00`,
    }));
    if (names.length) return names;
  }
  return (
    allowed
      // Empieza así, o ya se están escribiendo sus argumentos (los que llevan argumentos terminan en espacio).
      .filter((c) => c.insert.startsWith(q) || (c.insert.endsWith(" ") && q.startsWith(c.insert)))
      .map((c) => ({ label: c.usage, insert: c.insert, help: c.help }))
  );
}
