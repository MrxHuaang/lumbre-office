// Los comandos de la comunicación rápida en la paleta (Ctrl+K): llamar, saludar y seguir a cada persona
// conectada, sumarla a la llamada, dejar de seguir y el anuncio a toda la cabaña. Esta función es pura
// (recibe el estado y las acciones) para poder probar qué aparece según el estado; la registra
// `useComunicacionCommands` (components/comunicacion/ComunicacionOverlays.tsx). El servidor igual valida todo.
import { callHasRoom } from "@hyvento/shared";
import type { Command } from "./commands";

export interface ComPerson {
  sessionId: string;
  userId: string;
  name: string;
  status: string;
  /** Fase del teléfono ("" = libre). */
  call: string;
}

export interface ComCommandsState {
  mySessionId: string | null;
  people: readonly ComPerson[];
  /** Mi llamada: fase y los demás que están en ella (hablando o sonándoles). */
  call: { phase: "calling" | "ringing" | "talking"; members: readonly { userId: string }[] } | null;
  following: { userId: string; name: string } | null;
  /** ¿Puedo anunciar? (lo que dice el permiso "anunciar"; el servidor lo valida igual). */
  canAnnounce: boolean;
}

export interface ComCommandsActions {
  callPerson: (userId: string) => void;
  addToCall: (userId: string) => void;
  wavePerson: (userId: string) => void;
  followPerson: (userId: string) => void;
  stopFollowing: () => void;
  openAnnounce: () => void;
}

const DND = "Está en No molestar";

export function comunicacionCommands(s: ComCommandsState, a: ComCommandsActions): Command[] {
  const out: Command[] = [];
  const others = s.people.filter((p) => p.sessionId !== s.mySessionId && p.userId);
  const inMyCall = new Set((s.call?.members ?? []).map((m) => m.userId));
  const talking = s.call?.phase === "talking";

  if (s.following) {
    const f = s.following;
    out.push({ id: "com:dejar-de-seguir", group: "Personas", title: `Dejar de seguir a ${f.name}`, keywords: ["seguir", "soltar"], icon: "steps", run: () => a.stopFollowing() });
  }

  for (const p of others) {
    const dnd = p.status === "dnd" ? DND : null;
    // Llamar (o sumar, si ya hablo): no a quien ya está en mi llamada.
    if (!inMyCall.has(p.userId)) {
      if (talking) {
        const full = !callHasRoom(inMyCall.size + 1);
        out.push({
          id: `com:sumar:${p.userId}`,
          group: "Personas",
          title: `Sumar a ${p.name} a la llamada`,
          keywords: ["llamada", "grupal", "telefono"],
          icon: "phone",
          disabled: full ? "La llamada está llena" : (dnd ?? (p.call ? "Está en otra llamada" : null)),
          run: () => a.addToCall(p.userId),
        });
      } else {
        out.push({
          id: `com:llamar:${p.userId}`,
          group: "Personas",
          title: `Llamar a ${p.name}`,
          keywords: ["telefono", "llamada", "celular"],
          icon: "phone",
          disabled: dnd ?? (p.call ? "Está en otra llamada" : s.call ? "Ya estás en una llamada" : null),
          run: () => a.callPerson(p.userId),
        });
      }
    }
    out.push({
      id: `com:saludar:${p.userId}`,
      group: "Personas",
      title: `Saludar a ${p.name}`,
      keywords: ["toque", "hombro", "hola"],
      icon: "wave",
      disabled: dnd,
      run: () => a.wavePerson(p.userId),
    });
    if (s.following?.userId !== p.userId)
      out.push({ id: `com:seguir:${p.userId}`, group: "Personas", title: `Seguir a ${p.name}`, keywords: ["seguir", "acompañar"], icon: "steps", run: () => a.followPerson(p.userId) });
  }

  if (s.canAnnounce)
    out.push({ id: "com:anunciar", group: "Abrir", title: "Anunciar a toda la cabaña", keywords: ["anuncio", "megafono", "aviso", "todos"], icon: "megaphone", run: () => a.openAnnounce() });
  return out;
}
