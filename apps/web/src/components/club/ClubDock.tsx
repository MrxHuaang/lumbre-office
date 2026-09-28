"use client";

// Lo que suena en el club, para el panel lateral: el video o la pista, quién la puso, las reacciones, la
// cola, ver el video en grande, mi volumen y las marcas de las propinas del tubo de hoy.
import { clubTrack, isPlaying } from "@hyvento/shared";
import { useShallow } from "zustand/react/shallow";
import { useClubStore } from "@/game/club/store";
import { useOfficeStore } from "@/game/store";
import { LocalVolume } from "./DjConsole";
import { NEON } from "./neon";
import { Reactions } from "./YoutubeQueue";

export function ClubSection() {
  const music = useClubStore(useShallow((s) => ({ track: s.track, video: s.video, paused: s.paused, startedAt: s.startedAt, pausedAt: s.pausedAt })));
  const video = useClubStore((s) => s.now);
  const dj = useClubStore((s) => s.dj);
  const queued = useClubStore((s) => s.queue.length);
  const big = useClubStore((s) => s.videoBig);
  const tips = useClubStore((s) => s.tipStats);
  const playing = isPlaying(music);
  const current = clubTrack(music.track);
  const title = video ? video.title : current?.name;

  return (
    <div className="flex flex-col gap-2 border-2 p-2 text-[12px]" style={{ background: NEON.ink, borderColor: NEON.edge, color: NEON.paper }}>
      <div className="flex items-start gap-2">
        <span className="pt-0.5" style={{ color: NEON.pink }} aria-hidden>
          {title ? (playing ? "♪" : "❚❚") : "·"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[13px] leading-tight" style={{ color: NEON.cyan }} title={title}>
            {title ?? "No suena nada"}
          </p>
          {title && dj && <p className="truncate opacity-75">la puso {dj}</p>}
        </div>
      </div>
      {playing && <Reactions compact />}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => useOfficeStore.getState().openPanel("dj", false)}
          className="border-2 px-2 py-0.5"
          style={{ borderColor: NEON.cyan, color: NEON.cyan }}
          title="Poner videos de YouTube y ordenar la cola"
        >
          {title ? `Cola${queued ? ` (${queued})` : ""}` : "Poner un video"}
        </button>
        {video && (
          <button
            type="button"
            onClick={() => useClubStore.getState().setVideoBig(!big)}
            aria-pressed={big}
            className="border-2 px-2 py-0.5"
            style={{ borderColor: NEON.pink, color: NEON.pink }}
          >
            {big ? "Video chico" : "Video en grande"}
          </button>
        )}
      </div>
      {title && <LocalVolume compact />}
      {tips.best > 0 && (
        <div className="border-t-2 pt-1.5 leading-tight" style={{ borderColor: NEON.edge }}>
          <p style={{ color: NEON.pink }}>Propinas de hoy en el tubo</p>
          <p className="opacity-90">
            La mayor: {tips.best} de {tips.bestFrom} a {tips.bestTo}
          </p>
          {tips.topName && (
            <p className="opacity-90">
              Más recibió: {tips.topName} ({tips.topTotal})
            </p>
          )}
        </div>
      )}
    </div>
  );
}
