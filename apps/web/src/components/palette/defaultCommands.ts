// Los comandos de siempre de la paleta: personas (ir hasta, perfil, invitar), lugares (viaje rápido a
// cada sala y nivel), abrir (mochila, perfil, ajustes, atajos, mapa…), estado, emotes y ajustes rápidos.
// Otros paquetes suman los suyos con `registerCommand` / `registerCommandSource` (ver lib/commands.ts).
import { placeLabel } from "@hyvento/map";
import { EMOTES, MANUAL_STATUSES, type PresenceStatus } from "@hyvento/shared";
import { useAchievementStore } from "@/game/achievements";
import { useFacilidadStore } from "@/game/facilidad";
import { getMixer, setMixer } from "@/game/mixer";
import { sendEmote, sendInvite, sendStatus } from "@/game/network";
import { NAME_TAG_LABEL, selectMyOffice, useOfficeStore } from "@/game/store";
import { destinations, officeOpenFor, goToPlace, travelBlockFor, travelBlockText, travelToPerson } from "@/game/viaje";
import { useCommands, type Command } from "@/lib/commands";
import { lessMotion, usePrefsStore } from "@/lib/prefs";

export const STATUS_TEXT: Record<PresenceStatus, string> = {
  available: "Disponible",
  busy: "Ocupado",
  dnd: "No molestar",
  away: "Ausente",
  meeting: "En reunión",
};

export interface DefaultCommandProps {
  isAdmin: boolean;
  onEditProfile: () => void;
  onEditCharacter: () => void;
  onAdmin: () => void;
}

/** Nombre para mostrar de un destino: las oficinas con su dueño ("Oficina de Juan"). */
function placeName(d: ReturnType<typeof destinations>[number]): string {
  if (d.zoneType !== "office" || !d.zoneId) return d.name;
  const office = useOfficeStore.getState().offices[d.zoneId];
  return office?.ownerName ? `Oficina de ${office.ownerName}` : office?.name || d.name;
}

function peopleCommands(): Command[] {
  const s = useOfficeStore.getState();
  const label = (p: string) => placeLabel(p, (id) => s.zoneNames[id]);
  const out: Command[] = [];
  const others = Object.values(s.players)
    .filter((p) => p.sessionId !== s.sessionId)
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const p of others) {
    const where = `${label(p.place)} · ${STATUS_TEXT[p.status]}`;
    const block = travelBlockFor({ kind: "person", userId: p.userId });
    out.push({
      id: `persona:ir:${p.userId}`,
      group: "Personas",
      title: `Ir hasta ${p.name}`,
      subtitle: where,
      keywords: ["viajar", "caminar", "junto a"],
      icon: "steps",
      disabled: block && block !== "here" && block !== "cooldown" ? travelBlockText(block) : null,
      run: () => travelToPerson(p.sessionId),
    });
  }
  for (const p of others) {
    out.push({
      id: `persona:perfil:${p.userId}`,
      group: "Personas",
      title: `Ver el perfil de ${p.name}`,
      subtitle: "Estadísticas y logros",
      icon: "trophy",
      run: () => useAchievementStore.getState().openProfile(p.userId),
    });
    out.push({
      id: `persona:invitar:${p.userId}`,
      group: "Personas",
      title: `Invitar a ${p.name} a donde estoy`,
      subtitle: s.zone?.name ? `A ${s.zone.name}` : undefined,
      keywords: ["llamar", "venir"],
      icon: "mail",
      run: () => sendInvite(p.userId),
    });
  }
  return out;
}

function placeCommands(): Command[] {
  const s = useOfficeStore.getState();
  const mine = selectMyOffice(s);
  const list = destinations();
  // Mi oficina primero.
  const sorted = mine ? [...list.filter((d) => d.zoneId === mine.zoneId), ...list.filter((d) => d.zoneId !== mine.zoneId)] : list;
  return sorted.map((d) => {
    const block = travelBlockFor({ kind: "place", id: d.id });
    const name = d.zoneId && d.zoneId === mine?.zoneId ? "Mi oficina" : placeName(d);
    const locked = !officeOpenFor(d);
    return {
      id: `lugar:${d.id}`,
      group: "Lugares",
      title: `Ir a ${name}`,
      subtitle: d.kind === "area" ? "Todo el nivel" : `${d.areaName}${locked ? " · cerrada: llegas a la puerta" : ""}`,
      keywords: ["viajar", "sala", d.areaName, d.name],
      icon: d.kind === "area" ? "map" : d.zoneType === "office" ? (locked ? "lock" : "home") : "steps",
      disabled: block && block !== "cooldown" ? travelBlockText(block) : null,
      run: () => goToPlace(d.id),
    } satisfies Command;
  });
}

/** Registra los comandos de siempre mientras la cabaña está montada. */
export function useDefaultCommands(props: DefaultCommandProps) {
  useCommands(() => {
    const s = useOfficeStore.getState();
    const f = useFacilidadStore.getState();
    const prefs = usePrefsStore.getState();
    const me = s.sessionId ? s.players[s.sessionId] : undefined;
    const open: Command[] = [
      { id: "abrir:mochila", group: "Abrir", title: "Mochila y estadísticas", keywords: ["inventario", "bolsa", "stats"], icon: "bag", hint: "I", run: () => s.openPanel("backpack", false) },
      { id: "abrir:mapa", group: "Abrir", title: "Mapa de la cabaña", subtitle: "Todos los niveles, quién está dónde", keywords: ["minimapa", "niveles", "viajar"], icon: "map", run: () => f.show("worldmap") },
      { id: "abrir:perfil", group: "Abrir", title: "Mi perfil y logros", icon: "trophy", run: () => useAchievementStore.getState().openProfile("me") },
      { id: "abrir:personaje", group: "Abrir", title: "Mi personaje", keywords: ["ropa", "look", "avatar"], icon: "smile", run: props.onEditCharacter },
      { id: "abrir:editar-perfil", group: "Abrir", title: "Editar perfil", keywords: ["nombre", "cumpleaños"], icon: "tag", run: props.onEditProfile },
      { id: "abrir:ajustes", group: "Abrir", title: "Ajustes", subtitle: "Sonido, movimiento, modo trabajo, avisos", keywords: ["volumen", "configuracion", "opciones"], icon: "gear", run: () => f.show("settings") },
      { id: "abrir:atajos", group: "Abrir", title: "Atajos del teclado y ayuda", keywords: ["teclas", "controles", "ayuda"], icon: "keyboard", hint: "?", run: () => f.show("shortcuts") },
      { id: "abrir:chat", group: "Abrir", title: s.chatOpen ? "Cerrar el chat" : "Abrir el chat", keywords: ["mensajes"], icon: "chat", hint: "Enter", run: () => s.setChatOpen(!useOfficeStore.getState().chatOpen) },
      { id: "abrir:dispositivos", group: "Abrir", title: "Audio y video", subtitle: "Micrófono, cámara y parlantes", keywords: ["microfono", "camara", "parlantes", "dispositivos"], icon: "mic", run: () => f.setDevices(true) },
      { id: "abrir:pesca", group: "Abrir", title: "Álbum de pesca", keywords: ["peces"], icon: "fish", run: () => s.openPanel("fishAlbum", false) },
      { id: "abrir:diario", group: "Abrir", title: "Diario de exploración", keywords: ["observatorio"], icon: "star", run: () => s.openPanel("logbook", false) },
      {
        id: "abrir:pc",
        group: "Abrir",
        title: "Prender el PC",
        subtitle: "Hyvento OS: notas, calendario",
        keywords: ["computador", "notas", "hyvento os"],
        icon: "screen",
        when: () => useOfficeStore.getState().atComputer && !useOfficeStore.getState().pcOn,
        run: () => useOfficeStore.getState().setPcOn(true),
      },
      { id: "abrir:admin", group: "Abrir", title: "Administrar equipo", icon: "board", when: () => props.isAdmin, run: props.onAdmin },
      { id: "abrir:editar-casa", group: "Abrir", title: "Editar la casa", keywords: ["muebles", "editor"], icon: "home", when: () => props.isAdmin, run: () => useOfficeStore.getState().setWorldEditing(true) },
    ];
    const status: Command[] = MANUAL_STATUSES.map((st) => ({
      id: `estado:${st}`,
      group: "Estado",
      title: `Estado: ${STATUS_TEXT[st]}`,
      subtitle: me?.status === st ? "Es tu estado ahora" : undefined,
      keywords: ["presencia", "estado"],
      icon: st === "dnd" ? "bell" : st === "away" ? "moon" : st === "busy" ? "briefcase" : "smile",
      run: () => sendStatus(st),
    }));
    const emotes: Command[] = EMOTES.map((e) => ({
      id: `emote:${e.id}`,
      group: "Emotes",
      title: e.name,
      keywords: ["emote", "reaccion", e.id],
      icon: "smile",
      run: () => sendEmote(e.id),
    }));
    const mixer = getMixer();
    const settings: Command[] = [
      {
        id: "ajuste:trabajo",
        group: "Ajustes",
        title: prefs.workMode ? "Salir del modo trabajo" : "Modo trabajo",
        subtitle: prefs.workMode ? "Vuelven los puntos y los avisos de juego" : "Sin puntos ni avisos de juego en pantalla",
        keywords: ["concentrar", "oficina", "juego", "puntos"],
        icon: "briefcase",
        run: () => usePrefsStore.getState().setWorkMode(!usePrefsStore.getState().workMode),
      },
      {
        id: "ajuste:movimiento",
        group: "Ajustes",
        title: lessMotion() ? "Volver al movimiento de siempre" : "Menos movimiento",
        subtitle: "Sin sacudidas, menos lluvia, hojas y bichos",
        keywords: ["animaciones", "mareo", "accesibilidad"],
        icon: "leaf",
        run: () => usePrefsStore.getState().setMotion(lessMotion() ? "full" : "reduce"),
      },
      {
        id: "ajuste:silencio",
        group: "Ajustes",
        title: mixer.muted ? "Activar el sonido" : "Silenciar todo",
        keywords: ["sonido", "volumen", "mute"],
        icon: "sound",
        run: () => setMixer({ muted: !getMixer().muted }),
      },
      {
        id: "ajuste:paredes",
        group: "Ajustes",
        title: s.privateWalls ? "Bajar las paredes" : "Subir las paredes",
        subtitle: "Adentro de la casa",
        keywords: ["paredes", "privado"],
        icon: "walls",
        when: () => useOfficeStore.getState().indoors,
        run: () => useOfficeStore.getState().setPrivateWalls(!useOfficeStore.getState().privateWalls),
      },
      {
        id: "ajuste:nombres",
        group: "Ajustes",
        title: `Nombres: ${NAME_TAG_LABEL[s.nameTags].toLowerCase()}`,
        subtitle: "Cambia entre completos, cortos y ocultos",
        keywords: ["etiquetas"],
        icon: "tag",
        hint: "N",
        run: () => useOfficeStore.getState().cycleNameTags(),
      },
    ];
    return [...peopleCommands(), ...placeCommands(), ...open, ...status, ...emotes, ...settings];
  });
}
