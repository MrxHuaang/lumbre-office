"use client";

// Contactos: todo el equipo (también quien no está conectado), con su estado y dónde anda en la
// cabaña: hace las veces del panel de Conectados que había arriba a la derecha. Desde el contacto se le
// escribe (al chat, con su nombre adelante), se le llama (o se suma a la llamada), se saluda, se sigue,
// se le invita a donde uno está (a la propia casa, si se está en ella), se le toca el timbre de su casa,
// se le regala algo o se abre su perfil.
import { placeLabel } from "@hyvento/map";
import { casaAreaOf, casaOwnerOf, type PresenceStatus } from "@hyvento/shared";
import { useEffect, useMemo, useState } from "react";
import { useAchievementStore } from "@/game/achievements";
import { callPerson, followPerson, stopFollowing, useComStore, wavePerson } from "@/game/comunicacion";
import { usePhoneStore as useCallStore } from "@/game/phone";
import { sendInvite, sendKnock } from "@/game/network";
import { useSocialStore } from "@/game/social";
import { useOfficeStore, type PlayerInfo } from "@/game/store";
import { STATUS_HEX } from "@/lib/cozy";
import { ScreenTitle, SelectList, usePhone, usePhoneKeys } from "../kit";

const STATUS_LABEL: Record<PresenceStatus, string> = {
  available: "Disponible",
  busy: "Ocupado",
  dnd: "No molestar",
  away: "Ausente",
  meeting: "En reunión",
};
const STATUS_ORDER: Record<PresenceStatus, number> = { available: 0, meeting: 1, busy: 2, dnd: 3, away: 4 };

interface Contact {
  userId: string;
  name: string;
  online: PlayerInfo | null;
}

// El equipo cambia poco: se pide una vez por visita (la lista de conectados sí es en vivo).
let teamCache: { id: string; name: string }[] | null = null;

function useTeam(): { id: string; name: string }[] | null {
  const [team, setTeam] = useState(teamCache);
  useEffect(() => {
    if (teamCache) return;
    let alive = true;
    fetch("/api/gifts/recipients", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ people: { id: string; name: string }[] }>) : null))
      .then((b) => {
        // Si falló, quedan solo los conectados (y se vuelve a pedir la próxima vez).
        if (b) teamCache = b.people.map((p) => ({ id: p.id, name: p.name }));
        if (alive) setTeam(teamCache ?? []);
      })
      .catch(() => alive && setTeam([]));
    return () => {
      alive = false;
    };
  }, []);
  return team;
}

export function ContactosApp() {
  const { back, go, close } = usePhone();
  const players = useOfficeStore((s) => s.players);
  const sessionId = useOfficeStore((s) => s.sessionId);
  const zoneNames = useOfficeStore((s) => s.zoneNames);
  const team = useTeam();
  const [i, setI] = useState(0);
  const [open, setOpen] = useState<Contact | null>(null);
  const [rawOpt, setOpt] = useState(0);
  const call = useCallStore((s) => s.call);
  const dialing = useCallStore((s) => s.dialing);
  const following = useComStore((s) => s.following?.userId);

  const contacts = useMemo(() => {
    const online = new Map(Object.values(players).filter((p) => p.sessionId !== sessionId).map((p) => [p.userId, p]));
    const byId = new Map<string, Contact>();
    for (const p of team ?? []) byId.set(p.id, { userId: p.id, name: p.name, online: online.get(p.id) ?? null });
    for (const p of online.values()) if (!byId.has(p.userId)) byId.set(p.userId, { userId: p.userId, name: p.name, online: p });
    // Conectados primero (los disponibles arriba), después el resto por nombre.
    return [...byId.values()].sort((a, b) => {
      const sa = a.online ? STATUS_ORDER[a.online.status] : 9;
      const sb = b.online ? STATUS_ORDER[b.online.status] : 9;
      return sa - sb || a.name.localeCompare(b.name, "es");
    });
  }, [players, sessionId, team]);

  const myArea = useOfficeStore((s) => s.area);
  const me = sessionId ? players[sessionId]?.userId : undefined;
  const inMyCasa = Boolean(me && casaOwnerOf(myArea) === me);
  const where = (c: Contact) => {
    if (!c.online) return "Desconectado";
    // La casa de alguien no dice dónde queda adentro: es suya.
    const casa = casaOwnerOf(c.online.area);
    if (casa) return casa === c.userId ? "En su casa" : "De visita en una casa";
    return placeLabel(c.online.place, (id) => zoneNames[id]) || "En la cabaña";
  };
  const write = (c: Contact) =>
    go({ kind: "app", id: "mensajes", params: { compose: { scope: "global", text: `@${c.name.split(" ")[0]} ` } } });
  const profile = (c: Contact) => close(() => useAchievementStore.getState().openProfile(c.userId));
  const gift = (c: Contact) => close(() => useSocialStore.getState().openGift({ userId: c.userId, name: c.name }));
  const current = open ? (contacts.find((c) => c.userId === open.userId) ?? open) : null;
  // La comunicación rápida (game/comunicacion.ts) solo con quien está conectado; el servidor igual valida.
  const quick = current?.online
    ? [
        ...(call?.members.some((m) => m.userId === current.userId)
          ? []
          : [{ label: call?.phase === "talking" ? "Sumar a la llamada" : "Llamar", run: (c: Contact) => ring(c, current.online!) }]),
        { label: "Saludar", run: (c: Contact) => close(() => wavePerson(c.userId)) },
        following === current.userId
          ? { label: "Dejar de seguir", run: (c: Contact) => close(() => stopFollowing(`Dejaste de seguir a ${c.name}.`)) }
          : { label: "Seguir", run: (c: Contact) => close(() => followPerson(c.userId)) },
        { label: inMyCasa ? "Invitar a mi casa" : "Invitar a donde estoy", run: (c: Contact) => close(() => sendInvite(c.userId)) },
        // Está en su casa y yo no: el timbre (si abre, me lleva hasta allá).
        ...(casaOwnerOf(current.online.area) === current.userId && casaOwnerOf(myArea) !== current.userId
          ? [{ label: "Tocar el timbre de su casa", run: (c: Contact) => close(() => sendKnock(casaAreaOf(c.userId))) }]
          : []),
      ]
    : [];
  const options = [
    { label: "Escribir mensaje", run: write },
    ...quick,
    { label: "Regalar algo", run: gift },
    { label: "Ver perfil", run: profile },
  ];
  // Las opciones cambian con la llamada o el seguir: la elegida no se sale de la lista.
  const opt = Math.min(rawOpt, options.length - 1);
  // Como el telefonito que había en Conectados: si no se puede, se dice por qué en vez de marcar.
  function ring(c: Contact, p: PlayerInfo) {
    const talking = call?.phase === "talking";
    const blocked =
      p.status === "dnd" ? "Está en No molestar." : p.call ? "Está en otra llamada." : (call && !talking) || dialing ? "Ya estás en una llamada." : "";
    if (blocked) return useOfficeStore.getState().notify(`${c.name}: ${blocked}`, "info");
    close(() => callPerson(c.userId));
  }

  usePhoneKeys(
    (k) => {
      if (current) {
        if (k === "up") return setOpt((v) => (v - 1 + options.length) % options.length), true;
        if (k === "down") return setOpt((v) => (v + 1) % options.length), true;
        if (k === "ok" || k === "softL") return options[opt]!.run(current), true;
        if (k === "call") return write(current), true;
        if (k === "softR" || k === "back") return setOpen(null), true;
        return false;
      }
      if (k === "up") return setI((v) => Math.max(0, v - 1)), true;
      if (k === "down") return setI((v) => Math.min(contacts.length - 1, v + 1)), true;
      const c = contacts[i];
      if (c && (k === "ok" || k === "softL")) return setOpen(c), setOpt(0), true;
      if (c && k === "call") return write(c), true;
      if (k === "softR" || k === "back") return back(), true;
      return false;
    },
    current ? { left: "Elegir", right: "Atrás" } : { left: contacts.length ? "Ver" : undefined, right: "Atrás" },
  );

  if (current) {
    const status = current.online?.status;
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-cozy-paper">
        <ScreenTitle>{current.name}</ScreenTitle>
        <div className="flex flex-col gap-0.5 px-1.5 py-1 text-[11px] text-cozy-ink">
          <span className="flex items-center gap-1">
            <Dot status={status} />
            {status ? STATUS_LABEL[status] : "Desconectado"}
          </span>
          {current.online && <span className="truncate text-cozy-ink-soft">{where(current)}</span>}
        </div>
        <SelectList
          items={options}
          index={opt}
          onPick={(n) => (n === opt ? options[n]!.run(current) : setOpt(n))}
          render={(o) => o.label}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-cozy-paper">
      <ScreenTitle right={`${contacts.filter((c) => c.online).length}/${contacts.length}`}>Contactos</ScreenTitle>
      <SelectList
        items={contacts}
        index={i}
        empty={team === null ? "Buscando al equipo…" : "Todavía no hay nadie más en la cabaña."}
        onPick={(n) => (n === i ? (setOpen(contacts[n]!), setOpt(0)) : setI(n))}
        render={(c, sel) => (
          <span className="flex items-center gap-1">
            <Dot status={c.online?.status} />
            <span className="min-w-0 flex-1 truncate">{c.name}</span>
            <span className={`max-w-[45%] truncate text-[9px] ${sel ? "" : "text-cozy-ink-soft"}`}>{c.online ? where(c) : "off"}</span>
          </span>
        )}
      />
    </div>
  );
}

function Dot({ status }: { status?: PresenceStatus }) {
  return <span className="h-2 w-2 shrink-0 border border-cozy-frame" style={{ background: status ? STATUS_HEX[status] : "#6d6570" }} />;
}
