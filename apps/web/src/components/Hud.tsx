"use client";

import { placeLabel } from "@hyvento/map";
import { PRESENCE_STATUSES, type PresenceStatus } from "@hyvento/shared";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMediaStore } from "@/game/media";
import { sendStatus } from "@/game/network";
import { selectMyOffice, useOfficeStore } from "@/game/store";
import { STATUS_HEX } from "@/lib/cozy";
import { PixelIcon } from "./Cozy";
import { PointsCounter } from "./PointsPanels";

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
  onAdmin: () => void;
  onLogout: () => void;
}

const useLabelOf = () => {
  const zoneNames = useOfficeStore((s) => s.zoneNames);
  return (p: string) => placeLabel(p, (id) => zoneNames[id]);
};

/** Fichas de arriba a la izquierda: marca, puntos, dónde estás, a quién oyes, estado, mochila, noche y menú. */
export function Hud({ isAdmin, onEditProfile, onEditCharacter, onAdmin, onLogout }: HudProps) {
  const zone = useOfficeStore((s) => s.zone);
  const players = useOfficeStore((s) => s.players);
  const sessionId = useOfficeStore((s) => s.sessionId);
  const me = sessionId ? players[sessionId] : undefined;
  const [showMenu, setShowMenu] = useState(false);
  const myOffice = useOfficeStore(useShallow(selectMyOffice));
  const walkToZone = useOfficeStore((s) => s.walkToZone);
  const place = useOfficeStore((s) => s.place);
  const night = useOfficeStore((s) => s.night);
  const setNight = useOfficeStore((s) => s.setNight);
  const openPanel = useOfficeStore((s) => s.openPanel);
  const labelOf = useLabelOf();

  return (
    <div className="absolute top-3 left-3 flex max-w-[calc(100%-13rem)] flex-wrap items-center gap-2.5 text-[14px] md:max-w-[calc(100%-20rem)]">
      <div className="cozy-panel flex items-center gap-2 px-3.5 py-2">
        <PixelIcon name="cabin" size={18} color="var(--color-cozy-wood)" />
        <span className="text-[18px] leading-none font-semibold">Hyvento</span>
      </div>

      <PointsCounter />

      <div
        className="cozy-chip flex items-center gap-1.5 px-3 py-1.5"
        title={zone?.isolated ? "Zona privada: solo te oyen quienes están aquí" : undefined}
      >
        {zone?.isolated && <PixelIcon name="lock" size={13} color="var(--color-cozy-wood)" />}
        {labelOf(place)}
      </div>

      <HearingChip />

      {me && (
        <label className="cozy-chip flex items-center gap-2 px-2.5 py-1">
          <StatusDot status={me.status} />
          <span className="sr-only">Estado</span>
          <select
            value={me.status}
            onChange={(e) => sendStatus(e.target.value as PresenceStatus)}
            className="cursor-pointer bg-transparent py-0.5 outline-none"
          >
            {PRESENCE_STATUSES.map((s) => (
              <option key={s} value={s} className="bg-cozy-paper-light">
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      )}

      {myOffice && zone?.id !== myOffice.zoneId && (
        <button onClick={() => walkToZone(myOffice.zoneId)} className="cozy-btn" title={`Caminar hasta ${myOffice.name}`}>
          <PixelIcon name="home" size={14} />
          Mi oficina
        </button>
      )}

      <button
        onClick={() => openPanel("backpack", false)}
        className="cozy-btn h-[34px] w-[34px] p-0"
        title="Mochila: tus muebles guardados"
        aria-label="Mochila"
      >
        <PixelIcon name="bag" size={16} color="var(--color-cozy-wood)" />
      </button>

      <button
        onClick={() => openPanel("fishAlbum", false)}
        className="cozy-btn h-[34px] w-[34px] p-0"
        title="Álbum de pesca: los peces que has sacado del lago"
        aria-label="Álbum de pesca"
      >
        <PixelIcon name="fish" size={16} color="var(--color-cozy-sky)" />
      </button>

      <button
        onClick={() => setNight(!night)}
        aria-pressed={night}
        className="cozy-btn h-[34px] w-[34px] p-0"
        title={night ? "Volver al día" : "Encender las luces (noche)"}
        aria-label={night ? "Volver al día" : "Modo noche"}
      >
        <PixelIcon name={night ? "moon" : "sun"} size={16} color={night ? "#4a3f8a" : "var(--color-cozy-gold)"} />
      </button>

      <div className="relative">
        <button onClick={() => setShowMenu((v) => !v)} aria-label="Menú" aria-expanded={showMenu} className="cozy-btn h-[34px] w-[34px] p-0">
          <PixelIcon name="menu" size={16} />
        </button>
        {showMenu && (
          <div className="cozy-panel absolute top-full right-0 z-30 mt-3 w-52 p-2" onClick={() => setShowMenu(false)}>
            <MenuItem onClick={onEditCharacter}>Mi personaje</MenuItem>
            <MenuItem onClick={onEditProfile}>Editar perfil</MenuItem>
            {isAdmin && <MenuItem onClick={onAdmin}>Administrar equipo</MenuItem>}
            {isAdmin && <MenuItem onClick={() => useOfficeStore.getState().setWorldEditing(true)}>Editar la casa</MenuItem>}
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

  if (status === "connecting") return <div className="cozy-chip px-3 py-1.5 text-cozy-ink-soft">Conectando audio…</div>;
  if (status === "unavailable") return <div className="cozy-chip px-3 py-1.5 text-cozy-ink-soft">Audio y video no disponibles</div>;
  if (names.length === 0) return null;

  const shown = names.length > 3 ? `${names.slice(0, 2).join(", ")} y ${names.length - 2} más` : names.join(", ");
  return (
    <div
      className="cozy-chip flex max-w-full items-center gap-2 truncate px-3 py-1.5"
      title={
        zone?.isolated
          ? `En ${zone.name} se oye a todos los que están adentro, sin importar la distancia`
          : "Personas que te pueden oír y ver"
      }
    >
      <span className="h-2.5 w-2.5 shrink-0 bg-[#5ea247] outline-2 outline-cozy-frame" />
      <span className="truncate">{zone?.isolated ? `En ${zone.name} con ${shown}` : `Cerca de ${shown}`}</span>
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
    <section className="cozy-panel pointer-events-auto w-full p-1.5">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 bg-cozy-wood px-3 py-2 text-cozy-paper-light"
      >
        <span className="text-[16px] font-semibold">Conectados</span>
        <span className="flex items-center gap-2 text-[14px]">
          {people.length}
          <PixelIcon name="chevron" size={12} className={open ? "rotate-180" : ""} />
        </span>
      </button>
      {open && (
        <ul className="cozy-scroll max-h-[45vh] overflow-y-auto">
          {people.map((p) => (
            <li key={p.sessionId} className="flex items-center gap-2.5 border-b-2 border-cozy-paper-dark px-2.5 py-2 last:border-b-0">
              <StatusDot status={p.status} title={STATUS_LABEL[p.status]} />
              <span className="min-w-0 flex-1 truncate text-[14px]">
                {p.name}
                {p.sessionId === sessionId && " (tú)"}
              </span>
              <span className="max-w-[45%] truncate text-[12px] text-cozy-ink-soft">
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
      className="h-3 w-3 shrink-0 border-2 border-cozy-frame"
      style={{ background: STATUS_HEX[status] ?? STATUS_HEX.available }}
    />
  );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="block w-full px-3 py-2 text-left text-[14px] hover:bg-cozy-paper-dark">
      {children}
    </button>
  );
}
