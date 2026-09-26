"use client";

import { placeLabel } from "@hyvento/map";
import { PRESENCE_STATUSES, type PresenceStatus } from "@hyvento/shared";
import Link from "next/link";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMediaStore } from "@/game/media";
import { sendStatus } from "@/game/network";
import { selectMyOffice, useOfficeStore } from "@/game/store";
import { STATUS_HEX } from "@/lib/riso";

const STATUS_LABEL: Record<PresenceStatus, string> = {
  available: "Disponible",
  busy: "Ocupado",
  dnd: "No molestar",
  away: "Ausente",
};

interface HudProps {
  isAdmin: boolean;
  onEditProfile: () => void;
  onEditCharacter: () => void;
  onLogout: () => void;
}

const useLabelOf = () => {
  const zoneNames = useOfficeStore((s) => s.zoneNames);
  return (p: string) => placeLabel(p, (id) => zoneNames[id]);
};

/** Fichas de arriba a la izquierda: marca, dónde estás, a quién oyes, estado y menú. */
export function Hud({ isAdmin, onEditProfile, onEditCharacter, onLogout }: HudProps) {
  const zone = useOfficeStore((s) => s.zone);
  const players = useOfficeStore((s) => s.players);
  const sessionId = useOfficeStore((s) => s.sessionId);
  const me = sessionId ? players[sessionId] : undefined;
  const [showMenu, setShowMenu] = useState(false);
  const myOffice = useOfficeStore(useShallow(selectMyOffice));
  const walkToZone = useOfficeStore((s) => s.walkToZone);
  const place = useOfficeStore((s) => s.place);
  const labelOf = useLabelOf();

  return (
    <div className="absolute top-3 left-3 flex max-w-[calc(100%-13rem)] flex-wrap items-center gap-2.5 text-[13px] font-semibold md:max-w-[calc(100%-20rem)]">
      <div className="riso-chip flex items-center gap-2 px-3.5 py-2">
        <span className="h-3.5 w-3.5 rounded-full bg-riso-pink mix-blend-multiply" />
        <span className="-ml-4 h-3.5 w-3.5 rounded-full bg-riso-blue mix-blend-multiply" />
        <span className="font-display text-[17px] leading-none">Hyvento</span>
      </div>

      <div
        className="riso-chip flex items-center gap-1.5 bg-riso-yellow px-3.5 py-2"
        title={zone?.isolated ? "Zona privada: solo te oyen quienes están aquí" : undefined}
      >
        {zone?.isolated && <LockIcon />}
        Estás en: {labelOf(place)}
      </div>

      <HearingChip />

      {me && (
        <label className="riso-chip flex items-center gap-2 px-3 py-1.5">
          <StatusDot status={me.status} />
          <span className="sr-only">Estado</span>
          <select
            value={me.status}
            onChange={(e) => sendStatus(e.target.value as PresenceStatus)}
            className="cursor-pointer bg-transparent py-0.5 outline-none"
          >
            {PRESENCE_STATUSES.map((s) => (
              <option key={s} value={s} className="bg-riso-paper">
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      )}

      {myOffice && zone?.id !== myOffice.zoneId && (
        <button
          onClick={() => walkToZone(myOffice.zoneId)}
          className="riso-pill riso-press rounded-none px-3.5"
          title={`Caminar hasta ${myOffice.name}`}
        >
          <HomeIcon />
          Mi oficina
        </button>
      )}

      <div className="relative">
        <button
          onClick={() => setShowMenu((v) => !v)}
          aria-label="Menú"
          aria-expanded={showMenu}
          className="riso-pill riso-press h-[38px] w-[38px] rounded-none p-0"
        >
          <MenuIcon />
        </button>
        {showMenu && (
          <div className="riso-panel absolute top-full right-0 z-30 mt-3 w-48 p-1" onClick={() => setShowMenu(false)}>
            <MenuItem onClick={onEditCharacter}>Mi personaje</MenuItem>
            <MenuItem onClick={onEditProfile}>Editar perfil</MenuItem>
            {isAdmin && <MenuItem href="/admin">Administrar equipo</MenuItem>}
            <MenuItem onClick={onLogout}>Cerrar sesión</MenuItem>
          </div>
        )}
      </div>
    </div>
  );
}

/** Con quién tienes audio ahora mismo (o el estado de la conexión de audio/video). */
function HearingChip() {
  const status = useMediaStore((s) => s.status);
  const names = useMediaStore(
    useShallow((s) => Object.keys(s.hearing).map((id) => s.participants[id]?.name ?? "Alguien")),
  );
  const zone = useOfficeStore((s) => s.zone);

  if (status === "connecting") return <div className="riso-chip px-3.5 py-2 text-riso-muted">Conectando audio…</div>;
  if (status === "unavailable") return <div className="riso-chip px-3.5 py-2 text-riso-muted">Audio/video no disponible</div>;
  if (names.length === 0) return null;

  const shown = names.length > 3 ? `${names.slice(0, 2).join(", ")} y ${names.length - 2} más` : names.join(", ");
  return (
    <div
      className="riso-chip max-w-full truncate bg-riso-pink px-3.5 py-2"
      title={
        zone?.isolated
          ? `En ${zone.name} se oye a todos los que están adentro, sin importar la distancia`
          : "Personas que te pueden oír y ver"
      }
    >
      {zone?.isolated ? `En ${zone.name} con ${shown}` : `Cerca de ${shown}`} · audio activo
    </div>
  );
}

/** Panel de conectados (arriba a la derecha): quién está y dónde. */
export function PeoplePanel() {
  const players = useOfficeStore((s) => s.players);
  const sessionId = useOfficeStore((s) => s.sessionId);
  const place = useOfficeStore((s) => s.place);
  const labelOf = useLabelOf();
  // En pantallas angostas empieza plegado para no tapar el mapa.
  const [open, setOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 900);
  // Yo primero; el resto por nombre.
  const people = Object.values(players).sort((a, b) =>
    a.sessionId === sessionId ? -1 : b.sessionId === sessionId ? 1 : a.name.localeCompare(b.name),
  );

  return (
    <section className="riso-panel pointer-events-auto w-full">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-3 bg-riso-blue px-3.5 py-2.5 text-riso-paper ${
          open ? "border-b-2 border-riso-navy" : ""
        }`}
      >
        <span className="font-display text-[15px]">Conectados</span>
        <span className="flex items-center gap-2 text-[13px] font-semibold">
          {people.length}
          <ChevronIcon open={open} />
        </span>
      </button>
      {open && (
        <ul className="max-h-[45vh] overflow-y-auto">
          {people.map((p) => (
            <li
              key={p.sessionId}
              className="flex items-center gap-2.5 border-b border-dashed border-riso-navy/35 px-3.5 py-2 last:border-b-0"
            >
              <StatusDot status={p.status} title={STATUS_LABEL[p.status]} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                {p.name}
                {p.sessionId === sessionId && " (tú)"}
              </span>
              <span className="max-w-[45%] truncate text-[11px] text-riso-muted">
                {labelOf(p.sessionId === sessionId ? place : p.place)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusDot({ status, title }: { status: PresenceStatus; title?: string }) {
  return (
    <span
      title={title}
      className="h-3 w-3 shrink-0 rounded-full border-[1.5px] border-riso-navy"
      style={{ background: STATUS_HEX[status] ?? STATUS_HEX.available }}
    />
  );
}

function MenuItem({ children, onClick, href }: { children: React.ReactNode; onClick?: () => void; href?: string }) {
  const cls = "block w-full px-3 py-2 text-left text-[13px] font-semibold hover:bg-riso-yellow";
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <button onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

const icon = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function LockIcon() {
  return (
    <svg {...icon} aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg {...icon} aria-hidden>
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg {...icon} width={16} height={16} aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg {...icon} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
