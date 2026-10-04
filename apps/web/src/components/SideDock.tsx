"use client";

// Panel lateral plegable (borde derecho, abajo): lo del lugar donde estoy sin tenerlo siempre en
// pantalla. En el club, lo que suena; en el cine, la función; en una oficina o la sala de reuniones, lo de la sala;
// en una casa, quién entra y quién está de visita. Cerrado queda
// una pestaña con flecha (y una nota si suena algo); abierto o cerrado se recuerda en el navegador.
import { isPlaying, isShowing } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { useClubStore } from "@/game/club/store";
import { useOfficeStore } from "@/game/store";
import { useCinemaStore } from "@/game/cinema/store";
import { usePhoneStore } from "@/game/phone/state";
import { ClubSection } from "./club/ClubDock";
import { CinemaSection } from "./cinema/CinemaPanel";
import { PixelIcon } from "./Cozy";
import { inRoom, RoomSection, useRoomTitle } from "./RoomPanel";
import { CasaSection, useCasaHere, useCasaTitle } from "./casa/CasaSection";
import { useCasasStore } from "@/game/casaVisitas";

const KEY = "hyvento:panel-lateral";

function loadOpen(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function SideDock() {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(loadOpen()), []);
  const toggle = () => {
    setOpen((v) => {
      try {
        localStorage.setItem(KEY, v ? "0" : "1");
      } catch {
        // sin almacenamiento: vale solo para esta visita
      }
      return !v;
    });
  };

  const inClub = useClubStore((s) => s.here.inClub);
  const clubPlaying = useClubStore((s) => isPlaying(s));
  const inCinema = useCinemaStore((s) => s.here.inCinema);
  const showing = useCinemaStore((s) => isShowing(s));
  const zoneType = useOfficeStore((s) => s.zone?.type);
  const radioOn = useOfficeStore((s) => Boolean(s.zone?.type === "office" && s.offices[s.zone.id]?.radio && !s.offices[s.zone.id]!.radio!.paused));
  const roomTitle = useRoomTitle();
  const casaHere = useCasaHere();
  const inCasa = Boolean(casaHere);
  const casaMusic = useCasasStore((s) => Boolean(casaHere && s.casas[casaHere.ownerId]?.radio && !s.casas[casaHere.ownerId]!.radio!.paused));
  const casaTitle = useCasaTitle();
  const decorating = useOfficeStore((s) => s.decorating);
  const worldEditing = useOfficeStore((s) => s.worldEditing);
  const pcOn = useOfficeStore((s) => s.pcOn);
  const panel = useOfficeStore((s) => s.panel);
  // En pantallas chicas no caben el celular (con el chat) y este panel a la vez: el celular tiene prioridad.
  const phoneOut = usePhoneStore((s) => s.mounted);

  // Solo en una oficina o la sala de reuniones (las paredes altas se cambian en el menú principal).
  const room = inRoom(zoneType);
  if ((!inClub && !inCinema && !room && !inCasa) || decorating || worldEditing || pcOn || panel) return null;
  const title = inClub ? "Club" : inCinema ? "Cine" : inCasa ? casaTitle : roomTitle;
  const sounding = inClub ? clubPlaying : inCinema ? showing : inCasa ? casaMusic : radioOn;

  return (
    <div className={`pointer-events-none absolute right-0 bottom-[var(--cozy-bar-top,7rem)] z-10 flex items-end ${phoneOut && open ? "max-md:hidden" : ""}`}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="panel-lateral"
        title={open ? "Esconder el panel" : `Mostrar: ${title}`}
        className="cozy-btn pointer-events-auto mb-2 flex h-auto flex-col items-center gap-1 rounded-none border-r-0 px-1.5 py-2 text-[12px]"
      >
        <span aria-hidden>{open ? "▶" : "◀"}</span>
        {!open && (
          <>
            <PixelIcon name={inClub ? "sound" : inCinema ? "screen" : "home"} size={14} />
            {sounding && (
              <span className="text-cozy-red" aria-label="suena algo">
                ♪
              </span>
            )}
          </>
        )}
      </button>
      {open && (
        <section id="panel-lateral" aria-label={title} className="cozy-panel pointer-events-auto mr-3 flex w-[min(320px,calc(100vw-4.5rem))] flex-col gap-2 px-3 py-2.5">
          <p className="text-[12px] text-cozy-ink-soft">{title}</p>
          {inClub ? <ClubSection /> : inCinema ? <CinemaSection /> : inCasa ? <CasaSection /> : <RoomSection />}
        </section>
      )}
    </div>
  );
}
