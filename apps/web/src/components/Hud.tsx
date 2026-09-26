"use client";

import { placeLabel } from "@hyvento/map";
import { PRESENCE_STATUSES, type PresenceStatus } from "@hyvento/shared";
import Link from "next/link";
import { useState } from "react";
import { sendStatus } from "@/game/network";
import { useShallow } from "zustand/react/shallow";
import { selectMyOffice, useOfficeStore } from "@/game/store";

const STATUS_LABEL: Record<PresenceStatus, string> = {
  available: "Disponible",
  busy: "Ocupado",
  dnd: "No molestar",
  away: "Ausente",
};
const STATUS_DOT: Record<PresenceStatus, string> = {
  available: "bg-[#3ddc84]",
  busy: "bg-[#ffb020]",
  dnd: "bg-[#ff4d5e]",
  away: "bg-[#8a8fa3]",
};

interface HudProps {
  isAdmin: boolean;
  onEditProfile: () => void;
  onLogout: () => void;
}

export function Hud({ isAdmin, onEditProfile, onLogout }: HudProps) {
  const zone = useOfficeStore((s) => s.zone);
  const players = useOfficeStore((s) => s.players);
  const sessionId = useOfficeStore((s) => s.sessionId);
  const me = sessionId ? players[sessionId] : undefined;
  const [showPeople, setShowPeople] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const myOffice = useOfficeStore(useShallow(selectMyOffice));
  const walkToZone = useOfficeStore((s) => s.walkToZone);
  const place = useOfficeStore((s) => s.place);
  const zoneNames = useOfficeStore((s) => s.zoneNames);
  const labelOf = (p: string) => placeLabel(p, (id) => zoneNames[id]);
  // Yo primero; el resto por nombre.
  const people = Object.values(players).sort((a, b) =>
    a.sessionId === sessionId ? -1 : b.sessionId === sessionId ? 1 : a.name.localeCompare(b.name),
  );

  return (
    <div className="absolute top-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-wrap items-start gap-2 text-sm">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-panel/90 px-3 py-2 backdrop-blur">
        <span className="text-xs font-bold tracking-[0.18em] text-accent uppercase">Hyvento</span>
        <span className="h-4 w-px bg-line" />
        <span className="flex items-center gap-1.5" title={zone?.isolated ? "Zona privada: solo te oyen quienes están aquí" : undefined}>
          {zone?.isolated && <LockIcon />}
          {labelOf(place)}
        </span>
      </div>

      <div className="relative">
        <button
          onClick={() => setShowPeople((v) => !v)}
          className="flex items-center gap-2 rounded-xl border border-line bg-panel/90 px-3 py-2 backdrop-blur hover:border-muted"
        >
          <span className="h-2 w-2 rounded-full bg-[#3ddc84]" />
          {people.length} {people.length === 1 ? "conectado" : "conectados"}
        </button>
        {showPeople && (
          <ul className="absolute top-full left-0 mt-2 max-h-80 w-64 overflow-auto rounded-xl border border-line bg-panel p-2 shadow-xl">
            {people.map((p) => (
              <li key={p.sessionId} className="flex items-start gap-2 rounded-lg px-2 py-1.5">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[p.status] ?? STATUS_DOT.available}`}
                  title={STATUS_LABEL[p.status]}
                />
                <span className="min-w-0">
                  <span className="block truncate">
                    {p.name} {p.sessionId === sessionId && <span className="text-xs text-muted">(tú)</span>}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    📍 {labelOf(p.sessionId === sessionId ? place : p.place)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {me && (
        <label className="flex items-center gap-2 rounded-xl border border-line bg-panel/90 px-3 py-2 backdrop-blur">
          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[me.status] ?? STATUS_DOT.available}`} />
          <span className="sr-only">Estado</span>
          <select
            value={me.status}
            onChange={(e) => sendStatus(e.target.value as PresenceStatus)}
            className="bg-transparent outline-none"
          >
            {PRESENCE_STATUSES.map((s) => (
              <option key={s} value={s} className="bg-panel">
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      )}

      {myOffice && zone?.id !== myOffice.zoneId && (
        <button
          onClick={() => walkToZone(myOffice.zoneId)}
          className="rounded-xl border border-line bg-panel/90 px-3 py-2 backdrop-blur hover:border-muted"
          title={`Caminar hasta ${myOffice.name}`}
        >
          🏠 Mi oficina
        </button>
      )}

      <div className="relative">
        <button
          onClick={() => setShowMenu((v) => !v)}
          aria-label="Menú"
          className="rounded-xl border border-line bg-panel/90 px-3 py-2 text-muted backdrop-blur hover:text-text"
        >
          ☰
        </button>
        {showMenu && (
          <div className="absolute top-full right-0 mt-2 w-44 rounded-xl border border-line bg-panel p-1 shadow-xl">
            <MenuItem onClick={onEditProfile}>Editar perfil</MenuItem>
            {isAdmin && <MenuItem href="/admin">Administrar equipo</MenuItem>}
            <MenuItem onClick={onLogout}>Cerrar sesión</MenuItem>
          </div>
        )}
      </div>
    </div>
  );
}

function MenuItem({ children, onClick, href }: { children: React.ReactNode; onClick?: () => void; href?: string }) {
  const cls = "block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-panel-2";
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

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
