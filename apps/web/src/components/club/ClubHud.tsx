"use client";

// En el club: lo que suena (con tu volumen, las reacciones y el botón de la cola de videos), el botón
// "Bailar" y los pasos cuando estás parado sobre la pista con música, y "Soltar el tubo" mientras bailas
// en el tubo.
import { clubTrack, DANCE_MOVES, isPlaying, type DanceMoveId } from "@hyvento/shared";
import { useShallow } from "zustand/react/shallow";
import { tapVideos } from "@/game/youtube";
import { sendClubDance, sendClubPole } from "@/game/club/net";
import { useClubStore } from "@/game/club/store";
import { useOfficeStore } from "@/game/store";
import { LocalVolume } from "./DjConsole";
import { Reactions } from "./YoutubeQueue";

export function ClubHud() {
  const here = useClubStore((s) => s.here);
  const music = useClubStore(useShallow((s) => ({ track: s.track, video: s.video, paused: s.paused, startedAt: s.startedAt, pausedAt: s.pausedAt })));
  const video = useClubStore((s) => s.now);
  const queued = useClubStore((s) => s.queue.length);
  const needsTap = useClubStore((s) => s.needsTap);
  const myMove = useClubStore((s) => {
    const id = useOfficeStore.getState().sessionId;
    const d = id ? s.dancers[id] : undefined;
    return d?.kind === "floor" ? (d.move as DanceMoveId) : null;
  });
  const chosen = useClubStore((s) => s.move);
  const panel = useOfficeStore((s) => s.panel);
  const pcOn = useOfficeStore((s) => s.pcOn);
  if (!here.inClub || panel || pcOn) return null;
  const playing = isPlaying(music);
  const current = clubTrack(music.track);

  const dance = (move: DanceMoveId) => {
    useClubStore.getState().setMove(move);
    sendClubDance(move);
  };

  return (
    <div className="pointer-events-auto flex w-max max-w-full flex-col items-center gap-1.5 font-pixel">
      {here.dancing === "pole" && (
        <button type="button" onClick={() => sendClubPole(false)} className="cozy-chip flex items-center gap-2 px-3 py-1.5 text-[14px]">
          <kbd className="cozy-kbd">Esc</kbd>
          Soltar el tubo
        </button>
      )}
      {here.onFloor && here.dancing !== "pole" && playing && (
        <div className="cozy-chip flex flex-wrap items-center justify-center gap-1.5 px-2 py-1.5 text-[13px]">
          {myMove ? (
            <button type="button" onClick={() => sendClubDance(null)} className="cozy-btn px-2.5 py-1 text-[13px]">
              <kbd className="cozy-kbd mr-1.5">E</kbd>
              Dejar de bailar
            </button>
          ) : (
            <button type="button" onClick={() => dance(chosen)} className="cozy-btn cozy-btn-primary px-2.5 py-1 text-[13px]">
              <kbd className="cozy-kbd mr-1.5">E</kbd>
              Bailar
            </button>
          )}
          {DANCE_MOVES.map((m) => (
            <button key={m.id} type="button" onClick={() => dance(m.id)} aria-pressed={(myMove ?? chosen) === m.id} className="cozy-btn px-2 py-1 text-[12px]">
              {m.name}
            </button>
          ))}
        </div>
      )}
      {here.onFloor && !playing && <p className="cozy-chip px-3 py-1 text-[12px]">Para bailar, pon música en la cabina del DJ.</p>}
      {needsTap && (
        <button type="button" onClick={() => tapVideos()} className="cozy-btn cozy-btn-primary px-3 py-1.5 text-[13px]">
          ▶ Activar el sonido del video
        </button>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2 border-2 border-[#1d1128] bg-[#1e1030] px-2.5 py-1 text-[12px] text-[#fdf0c8] shadow-[2px_2px_0_#1d1128]">
        {(current || video) && (
          <>
            <span className="text-[#ff5fd2]">{playing ? "♪" : "❚❚"}</span>
            <span className="max-w-48 truncate" title={video?.title}>
              {video ? video.title : current!.name}
            </span>
          </>
        )}
        {playing && <Reactions compact />}
        <button
          type="button"
          onClick={() => useOfficeStore.getState().openPanel("dj", false)}
          className="border-2 border-[#3fd0dd] px-2 py-0.5 text-[#3fd0dd]"
          title="Poner videos de YouTube y ordenar la cola"
        >
          {current || video ? `Cola${queued ? ` (${queued})` : ""}` : "Poner un video"}
        </button>
        {(current || video) && (
          <span className="w-36">
            <LocalVolume compact />
          </span>
        )}
      </div>
    </div>
  );
}
