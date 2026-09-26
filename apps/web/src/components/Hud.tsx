"use client";

import { PRESENCE_STATUSES, type PresenceStatus } from "@hyvento/shared";
import { useState } from "react";
import { sendStatus } from "@/game/network";
import { useOfficeStore } from "@/game/store";

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

export function Hud({ onExit }: { onExit: () => void }) {
  const zone = useOfficeStore((s) => s.zone);
  const players = useOfficeStore((s) => s.players);
  const sessionId = useOfficeStore((s) => s.sessionId);
  const me = sessionId ? players[sessionId] : undefined;
  const [showPeople, setShowPeople] = useState(false);
  const people = Object.values(players).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="absolute top-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-wrap items-start gap-2 text-sm">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-panel/90 px-3 py-2 backdrop-blur">
        <span className="text-xs font-bold tracking-[0.18em] text-accent uppercase">Hyvento</span>
        <span className="h-4 w-px bg-line" />
        <span className="flex items-center gap-1.5" title={zone?.isolated ? "Zona privada: solo te oyen quienes están aquí" : undefined}>
          {zone?.isolated && <LockIcon />}
          {zone?.name ?? "Pasillo"}
        </span>
      </div>

      <div className="relative">
        <button
          onClick={() => setShowPeople((v) => !v)}
          className="flex items-center gap-2 rounded-xl border border-line bg-panel/90 px-3 py-2 backdrop-blur hover:border-muted"
        >
          <span className="h-2 w-2 rounded-full bg-[#3ddc84]" />
          {people.length} en la oficina
        </button>
        {showPeople && (
          <ul className="absolute top-full left-0 mt-2 max-h-72 w-56 overflow-auto rounded-xl border border-line bg-panel p-2 shadow-xl">
            {people.map((p) => (
              <li key={p.sessionId} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[p.status] ?? STATUS_DOT.available}`} />
                <span className="truncate">{p.name}</span>
                {p.sessionId === sessionId && <span className="text-xs text-muted">(tú)</span>}
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

      <button
        onClick={onExit}
        className="rounded-xl border border-line bg-panel/90 px-3 py-2 text-muted backdrop-blur hover:text-text"
      >
        Salir
      </button>
    </div>
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
