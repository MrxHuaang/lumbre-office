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
    <div className="pointer-events-none absolute top-16 left-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 gap-2 overflow-x-auto pb-1">
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
      className="group pointer-events-auto relative h-[96px] w-[170px] shrink-0 cursor-zoom-in overflow-hidden rounded-xl border-2 border-line bg-black shadow-lg hover:border-accent"
      title="Ver en grande"
    >
      {track ? <VideoView track={track} contain /> : <span className="text-xs text-muted">Cargando…</span>}
      <span className="absolute bottom-1 left-1 max-w-[calc(100%-0.5rem)] truncate rounded bg-ink/80 px-1.5 py-0.5 text-[11px]">
        📺 {name}
      </span>
      <span className="absolute top-1 right-1 rounded bg-ink/80 px-1.5 py-0.5 text-[10px] opacity-0 transition group-hover:opacity-100">
        Ampliar ⤢
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
    <div className="absolute inset-0 z-20 flex flex-col bg-ink/95 p-3 sm:p-4" role="dialog" aria-label={isScreen ? "Pantalla compartida" : "Cámara"}>
      <div className="mb-2 flex items-center gap-2 text-sm">
        <span className="flex-1 truncate">
          {isScreen ? `📺 ${focused.identity ? `${name} está compartiendo su pantalla` : "Tu pantalla"}` : `🎥 ${name}`}
        </span>
        <button
          onClick={() => void boxRef.current?.requestFullscreen?.()}
          className="rounded-lg border border-line px-3 py-1 hover:border-muted"
        >
          Pantalla completa
        </button>
        <button onClick={() => setFocused(null)} className="rounded-lg border border-line px-3 py-1 hover:border-muted">
          Cerrar (Esc)
        </button>
      </div>
      <div ref={boxRef} className="min-h-0 flex-1 overflow-hidden rounded-xl bg-black">
        <VideoView track={track} contain={isScreen} mirror={!isScreen && focused.identity === null} />
      </div>
    </div>
  );
}
