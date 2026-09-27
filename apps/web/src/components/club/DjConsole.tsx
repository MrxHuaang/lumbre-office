"use client";

// La consola del club: la cola de videos de YouTube (desde cualquier parte del club) y, junto a la cabina,
// las pistas generadas, pausar y parar para todos (lo sincroniza el servidor). El volumen y el silencio
// son solo tuyos.
import { CLUB_TRACKS, clubTrack, loopMs, type ClubTrackId } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { sendClubDj } from "@/game/club/net";
import { clubElapsed, useClubStore } from "@/game/club/store";
import { useOfficeStore } from "@/game/store";
import { NEON } from "./neon";
import { YoutubeQueue } from "./YoutubeQueue";

type Tab = "youtube" | "tracks";
const TAB_KEY = "hyvento:club-tab";

function loadTab(): Tab {
  try {
    return localStorage.getItem(TAB_KEY) === "tracks" ? "tracks" : "youtube";
  } catch {
    return "youtube";
  }
}

export function DjConsole({ atObject, onClose }: { atObject: boolean; onClose: () => void }) {
  const track = useClubStore((s) => s.track);
  const paused = useClubStore((s) => s.paused);
  const dj = useClubStore((s) => s.dj);
  const videoOn = useClubStore((s) => Boolean(s.now));
  const inClub = useClubStore((s) => s.here.inClub);
  const current = clubTrack(track);
  const [tab, setTab] = useState<Tab>(loadTab);
  const pick = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      // sin almacenamiento: vale solo para esta visita
    }
  };

  useEffect(() => {
    const { setTyping } = useOfficeStore.getState();
    setTyping(true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      setTyping(false);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const play = (id: ClubTrackId) => sendClubDj({ action: "play", track: id });

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgb(20_12_30/0.6)] p-3" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section
        role="dialog"
        aria-modal
        aria-label="Cabina de DJ"
        className="cozy-scroll flex max-h-full w-[min(520px,100%)] flex-col gap-3 overflow-y-auto border-4 p-3 font-pixel text-[14px]"
        style={{
          background: NEON.panel,
          borderColor: NEON.edge,
          color: NEON.paper,
          boxShadow: `0 0 0 3px ${NEON.pink}55, 6px 6px 0 ${NEON.edge}`,
        }}
      >
        <header className="flex items-center gap-3 border-4 px-3 py-2" style={{ background: NEON.ink, borderColor: NEON.edge }}>
          <h2
            className="flex-1 text-[22px] leading-none tracking-wider"
            style={{
              color: NEON.pink,
              textShadow: `0 0 6px ${NEON.pink}, 2px 2px 0 #000`,
            }}
          >
            CABINA DJ
          </h2>
          <button type="button" onClick={onClose} className="px-1 text-[13px]" aria-label="Cerrar la consola">
            Esc ✕
          </button>
        </header>

        <div role="tablist" aria-label="Qué poner" className="flex gap-1.5">
          {(
            [
              ["youtube", "Videos de YouTube"],
              ["tracks", "Pistas de la cabina"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => pick(id)}
              className="flex-1 border-2 px-2 py-1.5 text-[14px]"
              style={{
                borderColor: tab === id ? NEON.pink : NEON.edge,
                background: tab === id ? "#4f2672" : NEON.ink,
                color: tab === id ? NEON.paper : NEON.cyan,
                boxShadow: tab === id ? `0 0 8px ${NEON.pink}88` : "none",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "youtube" && <YoutubeQueue inClub={inClub} />}

        {tab === "tracks" && (
          <>
            {/* Lo que suena, con su barra de avance del loop y un ecualizador. */}
            <div className="flex items-center gap-3 border-4 px-3 py-2" style={{ background: "#0c1024", borderColor: NEON.edge }}>
              <Equalizer on={Boolean(current && !paused)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px]" style={{ color: NEON.cyan }}>
                  {current ? `${paused ? "En pausa" : "Suena"}: ${current.name}` : "No suena nada"}
                </p>
                <p className="truncate text-[12px] opacity-80">{current ? `${current.bpm} bpm${dj ? ` · la puso ${dj}` : ""}` : "Elige una pista para el club"}</p>
                {current && <Progress loop={loopMs(current)} />}
              </div>
            </div>

            {!atObject && (
              <p className="text-[13px]" style={{ color: NEON.gold }}>
                Acércate a la cabina del club (sótano) para poner una pista.
              </p>
            )}
            {videoOn && <p className="text-[12px] opacity-80">Suena un video: una pista lo corta y el video vuelve al frente de la cola.</p>}

            <ul className="flex flex-col gap-1.5">
              {CLUB_TRACKS.map((t) => {
                const on = t.id === track;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      disabled={!atObject}
                      onClick={() => play(t.id)}
                      aria-pressed={on}
                      className="flex w-full items-center gap-3 border-2 px-3 py-1.5 text-left disabled:opacity-50"
                      style={{
                        borderColor: on ? NEON.pink : NEON.edge,
                        background: on ? "#4f2672" : NEON.ink,
                        boxShadow: on ? `0 0 8px ${NEON.pink}88` : "none",
                      }}
                    >
                      <span className="w-4 text-center" style={{ color: on ? NEON.pink : NEON.cyan }}>
                        {on && !paused ? "♪" : "▶"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px]">{t.name}</span>
                        <span className="block truncate text-[11px] opacity-75">{t.hint}</span>
                      </span>
                      <span className="text-[11px] opacity-70">{t.bpm}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap gap-2">
              <NeonButton disabled={!atObject || !current} onClick={() => sendClubDj({ action: paused ? "resume" : "pause" })}>
                {paused ? "Seguir" : "Pausar"}
              </NeonButton>
              <NeonButton disabled={!atObject || !current} onClick={() => sendClubDj({ action: "stop" })}>
                Parar
              </NeonButton>
            </div>
          </>
        )}
        {tab === "youtube" && videoOn && (
          <div className="flex flex-wrap items-center gap-2">
            <NeonButton disabled={!atObject} onClick={() => sendClubDj({ action: paused ? "resume" : "pause" })}>
              {paused ? "Seguir" : "Pausar"}
            </NeonButton>
            {!atObject && <span className="text-[12px] opacity-75">Pausar se hace desde la cabina.</span>}
          </div>
        )}
        <LocalVolume />
      </section>
    </div>
  );
}

function NeonButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="border-2 px-4 py-1.5 text-[14px] disabled:opacity-40"
      style={{
        borderColor: NEON.cyan,
        background: NEON.ink,
        color: NEON.cyan,
        boxShadow: `2px 2px 0 ${NEON.edge}`,
      }}
    >
      {children}
    </button>
  );
}

/** Volumen de la música para mí (y silenciarla): se guarda en el navegador. */
export function LocalVolume({ compact = false }: { compact?: boolean }) {
  const volume = useClubStore((s) => s.volume);
  const muted = useClubStore((s) => s.muted);
  const { setVolume, setMuted } = useClubStore.getState();
  return (
    <label className={`flex items-center gap-2 ${compact ? "text-[12px]" : "text-[13px]"}`}>
      <button
        type="button"
        onClick={() => setMuted(!muted)}
        aria-pressed={muted}
        className="border-2 px-2 py-0.5"
        style={{
          borderColor: muted ? NEON.pink : NEON.edge,
          background: NEON.ink,
          color: muted ? NEON.pink : NEON.paper,
        }}
      >
        {muted ? "Sin sonido" : "Sonido"}
      </button>
      {!compact && <span>Mi volumen</span>}
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        onChange={(e) => setVolume(Number(e.target.value) / 100)}
        aria-label="Volumen de la música del club"
        className="flex-1 accent-[#ff5fd2]"
        disabled={muted}
      />
    </label>
  );
}

/** Barra del loop de la pista (se mueve sola). */
function Progress({ loop }: { loop: number }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT(((clubElapsed() ?? 0) % loop) / loop), 200);
    return () => clearInterval(id);
  }, [loop]);
  return (
    <div className="mt-1 h-1.5 w-full" style={{ background: NEON.edge }}>
      <div className="h-full" style={{ width: `${t * 100}%`, background: NEON.pink }} />
    </div>
  );
}

/** Ecualizador de adorno: barras que saltan mientras suena. */
function Equalizer({ on }: { on: boolean }) {
  const [k, setK] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setK((n) => n + 1), 140);
    return () => clearInterval(id);
  }, [on]);
  return (
    <div className="flex h-8 items-end gap-0.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => {
        const h = on ? 20 + 80 * Math.abs(Math.sin(k * 0.9 + i * 1.7)) : 12;
        return (
          <span
            key={i}
            className="w-1.5"
            style={{
              height: `${h}%`,
              background: i % 2 ? NEON.cyan : NEON.pink,
            }}
          />
        );
      })}
    </div>
  );
}
