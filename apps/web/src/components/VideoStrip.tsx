"use client";

import { Track } from "livekit-client";
import { useEffect, useRef } from "react";
import { media, useMediaStore } from "@/game/media";
import { selectMyUserId, useOfficeStore } from "@/game/store";

type VideoSource = Track.Source.Camera | Track.Source.ScreenShare;

/** Tira superior con las personas que oyes (y tu propia cámara/pantalla). */
export function VideoStrip() {
  const hearing = useMediaStore((s) => s.hearing);
  const participants = useMediaStore((s) => s.participants);
  const speaking = useMediaStore((s) => s.speaking);
  const cam = useMediaStore((s) => s.cam);
  const screen = useMediaStore((s) => s.screen);
  const mic = useMediaStore((s) => s.mic);
  const myId = useOfficeStore(selectMyUserId);
  useMediaStore((s) => s.trackVersion); // re-render cuando cambian los tracks

  const heard = Object.entries(hearing)
    .filter(([id]) => participants[id])
    .sort(([, a], [, b]) => b - a)
    .map(([id]) => participants[id]!);

  const tiles: React.ReactNode[] = [];
  if (cam) tiles.push(<Tile key="me-cam" identity={null} source={Track.Source.Camera} name="Tú" mic={mic} speaking={!!myId && speaking.includes(myId)} />);
  if (screen) tiles.push(<Tile key="me-screen" identity={null} source={Track.Source.ScreenShare} name="Tu pantalla" mic screen />);
  for (const p of heard) {
    tiles.push(
      <Tile key={`${p.identity}-cam`} identity={p.identity} source={Track.Source.Camera} name={p.name} mic={p.mic} speaking={speaking.includes(p.identity)} />,
    );
    if (p.screen) {
      tiles.push(<Tile key={`${p.identity}-screen`} identity={p.identity} source={Track.Source.ScreenShare} name={`${p.name} · pantalla`} mic screen />);
    }
  }
  if (tiles.length === 0) return null;

  return (
    <div className="pointer-events-none absolute top-16 left-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 gap-2 overflow-x-auto pb-1">
      {tiles}
    </div>
  );
}

function Tile({
  identity,
  source,
  name,
  mic,
  speaking = false,
  screen = false,
}: {
  identity: string | null;
  source: VideoSource;
  name: string;
  mic: boolean;
  speaking?: boolean;
  screen?: boolean;
}) {
  const setFocused = useMediaStore((s) => s.setFocused);
  const track = media.videoTrack(identity, source);
  return (
    <button
      onClick={() => screen && identity && setFocused(identity)}
      className={`pointer-events-auto relative h-[90px] w-[150px] shrink-0 overflow-hidden rounded-xl border-2 bg-panel shadow-lg ${
        speaking ? "border-[#3ddc84]" : "border-line"
      } ${screen && identity ? "cursor-zoom-in" : "cursor-default"}`}
      title={screen && identity ? "Ampliar pantalla" : name}
    >
      {track ? (
        <VideoView track={track} mirror={identity === null && source === Track.Source.Camera} contain={screen} />
      ) : (
        <div className="flex h-full items-center justify-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-panel-2 text-lg font-semibold">
            {name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <span className="absolute bottom-1 left-1 flex max-w-[calc(100%-0.5rem)] items-center gap-1 truncate rounded bg-ink/75 px-1.5 py-0.5 text-[11px]">
        {!mic && !screen && <span aria-label="micrófono apagado">🔇</span>}
        {name}
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
      className={`h-full w-full ${contain ? "object-contain bg-black" : "object-cover"} ${mirror ? "-scale-x-100" : ""}`}
    />
  );
}

/** Pantalla compartida ampliada. */
export function ScreenFocus() {
  const focused = useMediaStore((s) => s.focused);
  const setFocused = useMediaStore((s) => s.setFocused);
  const participant = useMediaStore((s) => (s.focused ? s.participants[s.focused] : undefined));
  const heard = useMediaStore((s) => (s.focused ? s.hearing[s.focused] !== undefined : false));
  useMediaStore((s) => s.trackVersion);

  // Si deja de compartir o se aleja, cerrar.
  useEffect(() => {
    if (focused && (!participant?.screen || !heard)) setFocused(null);
  }, [focused, participant?.screen, heard, setFocused]);

  useEffect(() => {
    if (!focused) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFocused(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focused, setFocused]);

  const track = focused ? media.videoTrack(focused, Track.Source.ScreenShare) : undefined;
  if (!focused || !track) return null;
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-ink/95 p-4" role="dialog" aria-label="Pantalla compartida">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span>{participant?.name} está compartiendo su pantalla</span>
        <button onClick={() => setFocused(null)} className="rounded-lg border border-line px-3 py-1">
          Cerrar (Esc)
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl bg-black">
        <VideoView track={track} contain />
      </div>
    </div>
  );
}
