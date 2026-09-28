"use client";

import { Track } from "livekit-client";
import { useEffect, useRef } from "react";
import { media, useMediaStore, type Focus } from "@/game/media";

/**
 * Pantallas compartidas de quienes oyes (y la tuya). Las cámaras se ven sobre los avatares.
 * Clic en una miniatura → vista grande.
 */
export function VideoStrip() {
  const hearing = useMediaStore((s) => s.hearing);
  const participants = useMediaStore((s) => s.participants);
  const screen = useMediaStore((s) => s.screen);
  useMediaStore((s) => s.trackVersion); // re-render cuando cambian los tracks

  const presenters = Object.keys(hearing)
    .map((id) => participants[id])
    .filter((p) => p?.screen)
    .map((p) => ({ identity: p!.identity, name: p!.name }));

  const tiles = [
    ...(screen ? [{ identity: null, name: "Tu pantalla" }] : []),
    ...presenters,
  ];
  if (tiles.length === 0) return null;

  return (
    <div className="pointer-events-none absolute top-[calc(var(--cozy-hud-bottom,3.5rem)_+_0.75rem)] left-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 gap-3 overflow-x-auto p-1 pb-2 md:max-w-[calc(100%-38rem)]">
      {tiles.map((t) => (
        <ScreenTile key={t.identity ?? "me"} identity={t.identity} name={t.name} />
      ))}
    </div>
  );
}

function ScreenTile({ identity, name }: { identity: string | null; name: string }) {
  const setFocused = useMediaStore((s) => s.setFocused);
  const track = media.videoTrack(identity, Track.Source.ScreenShare);
  return (
    <button
      onClick={() => setFocused({ identity, source: "screen" })}
      className="group cozy-panel pointer-events-auto relative h-[100px] w-[176px] shrink-0 cursor-zoom-in overflow-hidden bg-cozy-frame p-[5px]"
      title="Ver en grande"
    >
      {track ? <VideoView track={track} contain /> : <span className="text-[12px] text-cozy-paper-light">Cargando…</span>}
      <span className="cozy-chip absolute bottom-1.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate px-1.5 py-0.5 text-[12px]">{name}</span>
      <span className="cozy-chip absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[11px] opacity-0 transition group-hover:opacity-100">
        Ampliar
      </span>
    </button>
  );
}

function VideoView({ track, mirror = false, contain = false }: { track: Track; mirror?: boolean; contain?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);
  return (
    <video
      ref={ref}
      muted
      playsInline
      autoPlay
      className={`h-full w-full ${contain ? "bg-black object-contain" : "object-cover"} ${mirror ? "-scale-x-100" : ""}`}
    />
  );
}

const sourceOf = (f: Focus) => (f.source === "screen" ? Track.Source.ScreenShare : Track.Source.Camera);

/** Vista grande de una cámara o pantalla compartida (Esc para cerrar, botón de pantalla completa). */
export function ScreenFocus() {
  const focused = useMediaStore((s) => s.focused);
  const setFocused = useMediaStore((s) => s.setFocused);
  const participants = useMediaStore((s) => s.participants);
  const hearing = useMediaStore((s) => s.hearing);
  useMediaStore((s) => s.trackVersion);
  const boxRef = useRef<HTMLDivElement>(null);

  const track = focused ? media.videoTrack(focused.identity, sourceOf(focused)) : undefined;
  const name = focused?.identity ? (participants[focused.identity]?.name ?? "Alguien") : "Tú";
  const stillAvailable =
    !!focused && !!track && (focused.identity === null || hearing[focused.identity] !== undefined);

  // Si deja de compartir, apaga la cámara o se aleja, cerrar.
  useEffect(() => {
    if (focused && !stillAvailable) setFocused(null);
  }, [focused, stillAvailable, setFocused]);

  useEffect(() => {
    if (!focused) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) setFocused(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focused, setFocused]);

  if (!focused || !track) return null;
  const isScreen = focused.source === "screen";

  return (
    <div className="cozy-void absolute inset-0 z-30 flex flex-col p-3 text-cozy-paper-light sm:p-4" role="dialog" aria-label={isScreen ? "Pantalla compartida" : "Cámara"}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex-1 truncate text-[19px] font-semibold">
          {isScreen ? (focused.identity ? `${name} está compartiendo su pantalla` : "Tu pantalla") : name}
        </span>
        <button onClick={() => void boxRef.current?.requestFullscreen?.()} className="cozy-btn">
          Pantalla completa
        </button>
        <button onClick={() => setFocused(null)} className="cozy-btn">
          Cerrar (Esc)
        </button>
      </div>
      <div ref={boxRef} className="cozy-panel min-h-0 flex-1 overflow-hidden bg-cozy-frame p-[6px]">
        <VideoView track={track} contain={isScreen} mirror={!isScreen && focused.identity === null} />
      </div>
    </div>
  );
}
