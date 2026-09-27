"use client";

// El cine del sótano: la cabina del proyector (programar la función con un link de YouTube o desde la
// cartelera, pausar, seguir, saltar y ordenar lo que viene), lo que se proyecta en el panel lateral y el
// aviso de "activar el sonido". Todo lo valida el servidor: se programa dentro de la sala y se pausa
// desde la cabina. El volumen y el silencio son solo tuyos.
import { CINEMA_BILLBOARD, CLUB_VIDEO, isShowing, parseYoutubeId, type ClubVideoView } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { sendCinema } from "@/game/cinema/net";
import { cinemaElapsed, useCinemaStore } from "@/game/cinema/store";
import { useOfficeStore } from "@/game/store";
import { tapVideos } from "@/game/youtube";
import { clock } from "../club/YoutubeQueue";
import { PanelShell } from "../PointsPanels";

/** Miniatura de YouTube (la chiquita, 120x90): es la tapa de cada video, no arte del juego. */
const thumb = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/default.jpg`;

export function CinemaPanel({ onClose }: { onClose: () => void }) {
  const here = useCinemaStore((s) => s.here);
  const now = useCinemaStore((s) => s.now);
  const queue = useCinemaStore((s) => s.queue);
  const history = useCinemaStore((s) => s.history);
  const [url, setUrl] = useState("");
  const [bad, setBad] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const scheduled = new Set([now?.videoId, ...queue.map((v) => v.videoId)]);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parseYoutubeId(url)) {
      setBad(true);
      return;
    }
    sendCinema({ action: "add", url });
    setUrl("");
  };

  return (
    <PanelShell title="Cabina del proyector" icon="screen" onClose={onClose} wide>
      <div className="flex flex-col gap-4 text-[14px]">
        {!here.inCinema && <p className="cozy-chip px-3 py-1.5 text-[13px]">Entra a la sala del cine para programar la función.</p>}

        <NowShowing now={now} />

        <section aria-label="Programar un video">
          <form onSubmit={add} className="flex gap-2">
            <input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setBad(false);
              }}
              placeholder="Pega un link de YouTube"
              aria-label="Link de YouTube"
              aria-invalid={bad}
              disabled={!here.inCinema}
              className="cozy-input min-w-0 flex-1 px-2 py-1.5 text-[14px]"
            />
            <button type="submit" disabled={!here.inCinema || !url.trim()} className="cozy-btn cozy-btn-primary px-3 py-1.5 text-[14px]">
              Programar
            </button>
          </form>
          {bad && <p className="mt-1 text-[12px] text-cozy-red">Eso no parece un link de un video de YouTube.</p>}
        </section>

        <section aria-label="Cartelera">
          <h3 className="mb-1.5 text-[15px] font-semibold">Cartelera</h3>
          <p className="mb-2 text-[12px] text-cozy-ink-soft">Cortos y películas abiertas de la Blender Foundation. Con un clic entran a la cola.</p>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {CINEMA_BILLBOARD.map((m) => {
              const on = scheduled.has(m.videoId);
              return (
                <li key={m.videoId} className="cozy-chip flex items-center gap-2 px-2 py-1.5">
                  <Thumb videoId={m.videoId} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{m.title}</span>
                    <span className="line-clamp-2 block text-[11px] leading-tight text-cozy-ink-soft">
                      {m.minutes} min · {m.blurb}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={!here.inCinema || on}
                    onClick={() => sendCinema({ action: "add", url: m.videoId })}
                    className="cozy-btn shrink-0 px-2 py-1 text-[12px]"
                    aria-label={`Programar ${m.title}`}
                  >
                    {on ? "En cola" : "Programar"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-label="Próximas funciones">
          <h3 className="mb-1.5 flex items-baseline justify-between text-[15px] font-semibold">
            <span>Próximas funciones</span>
            <span className="text-[11px] font-normal text-cozy-ink-soft">
              {queue.length}/{CLUB_VIDEO.maxQueue}
            </span>
          </h3>
          {queue.length === 0 ? (
            <p className="border-2 border-dashed border-cozy-wood px-3 py-2 text-[12px] text-cozy-ink-soft">
              No hay nada programado después. Lo que agregues empieza cuando termine la de ahora.
            </p>
          ) : (
            <ol className="flex flex-col gap-1">
              {queue.map((v, i) => (
                <li key={v.id} className="cozy-chip flex items-center gap-2 px-2 py-1">
                  <span className="w-4 text-right text-[12px] text-cozy-ink-soft">{i + 1}</span>
                  <Thumb videoId={v.videoId} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px]">{v.title}</span>
                    <span className="block truncate text-[11px] text-cozy-ink-soft">
                      la puso {v.by}
                      {v.durationMs ? ` · ${clock(v.durationMs)}` : ""}
                    </span>
                  </span>
                  <span className="flex gap-0.5">
                    <Small disabled={!here.inCinema || i === 0} onClick={() => sendCinema({ action: "move", id: v.id, to: i - 1 })} label={`Subir ${v.title}`}>
                      ▲
                    </Small>
                    <Small
                      disabled={!here.inCinema || i === queue.length - 1}
                      onClick={() => sendCinema({ action: "move", id: v.id, to: i + 1 })}
                      label={`Bajar ${v.title}`}
                    >
                      ▼
                    </Small>
                    <Small disabled={!here.inCinema} onClick={() => sendCinema({ action: "remove", id: v.id })} label={`Quitar ${v.title}`}>
                      ✕
                    </Small>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {history.length > 0 && (
          <section aria-label="Ya se vio">
            <button type="button" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory} className="text-[13px] underline decoration-dotted">
              {showHistory ? "▾" : "▸"} Ya se vio ({history.length})
            </button>
            {showHistory && (
              <ul className="mt-1 flex flex-col gap-1">
                {history.map((v) => (
                  <li key={v.id} className="cozy-chip flex items-center gap-2 px-2 py-1">
                    <Thumb videoId={v.videoId} />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{v.title}</span>
                    <Small disabled={!here.inCinema} onClick={() => sendCinema({ action: "replay", id: v.id })} label={`Volver a poner ${v.title}`}>
                      Otra vez
                    </Small>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <CinemaVolume />
      </div>
    </PanelShell>
  );
}

/** La función de ahora: la tapa, el avance y los controles (pausar y seguir, solo desde la cabina). */
function NowShowing({ now }: { now: ClubVideoView | null }) {
  const paused = useCinemaStore((s) => s.paused);
  const here = useCinemaStore((s) => s.here);
  const big = useCinemaStore((s) => s.big);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!now) return;
    const tick = () => setElapsed(cinemaElapsed() ?? 0);
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [now]);

  if (!now) {
    return (
      <div className="border-4 border-cozy-frame bg-[#1b1426] px-3 py-3 text-center text-[#f3e3c0]">
        <p className="text-[12px] tracking-widest text-[#d9a441]">SALA LIBRE</p>
        <p className="mt-1 text-[14px]">No hay función. Programa una película de la cartelera o pega un link.</p>
      </div>
    );
  }
  const total = now.durationMs;
  return (
    <div className="flex flex-col gap-2 border-4 border-cozy-frame bg-[#1b1426] px-3 py-2.5 text-[#f3e3c0]">
      <div className="flex items-center gap-3">
        <Thumb videoId={now.videoId} big />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] tracking-widest text-[#d9a441]">{paused ? "FUNCIÓN EN PAUSA" : "FUNCIÓN EN CURSO"}</p>
          <p className="line-clamp-2 text-[15px] leading-tight">{now.title}</p>
          <p className="truncate text-[11px] opacity-75">
            la puso {now.by} · {clock(elapsed)}
            {total ? ` / ${clock(total)}` : ""}
          </p>
        </div>
      </div>
      {total > 0 && (
        <div className="h-1.5 w-full bg-[#3a2c44]">
          <div className="h-full bg-[#d9a441]" style={{ width: `${Math.min(100, (elapsed / total) * 100)}%` }} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={!here.atBooth}
          onClick={() => sendCinema({ action: paused ? "resume" : "pause" })}
          className="cozy-btn px-2.5 py-1 text-[13px]"
          title={here.atBooth ? undefined : "Se pausa desde la cabina, junto al proyector"}
        >
          {paused ? "▶ Seguir" : "❚❚ Pausar"}
        </button>
        <button type="button" disabled={!here.inCinema} onClick={() => sendCinema({ action: "skip", id: now.id })} className="cozy-btn px-2.5 py-1 text-[13px]">
          Saltar ⏭
        </button>
        <button type="button" onClick={() => useCinemaStore.getState().setBig(!big)} aria-pressed={big} className="cozy-btn px-2.5 py-1 text-[13px]">
          {big ? "Pantalla chica" : "Ver en grande"}
        </button>
        {!here.atBooth && <span className="text-[11px] opacity-75">Pausar y seguir: desde la cabina.</span>}
      </div>
    </div>
  );
}

/** Mi volumen de la función (y silenciarla): se guarda en el navegador. */
export function CinemaVolume({ compact = false }: { compact?: boolean }) {
  const volume = useCinemaStore((s) => s.volume);
  const muted = useCinemaStore((s) => s.muted);
  const { setVolume, setMuted } = useCinemaStore.getState();
  return (
    <label className={`flex items-center gap-2 ${compact ? "text-[12px]" : "text-[13px]"}`}>
      <button type="button" onClick={() => setMuted(!muted)} aria-pressed={muted} className="cozy-btn px-2 py-0.5 text-[12px]">
        {muted ? "Sin sonido" : "Sonido"}
      </button>
      {!compact && <span>Mi volumen</span>}
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        onChange={(e) => setVolume(Number(e.target.value) / 100)}
        aria-label="Volumen de la función del cine"
        className="flex-1 accent-[#b3571a]"
        disabled={muted}
      />
    </label>
  );
}

/** Para el panel lateral dentro del cine: lo que se proyecta, abrir la cabina, ver en grande y el volumen. */
export function CinemaSection() {
  const show = useCinemaStore(useShallow((s) => ({ video: s.video, paused: s.paused, startedAt: s.startedAt, pausedAt: s.pausedAt })));
  const now = useCinemaStore((s) => s.now);
  const queued = useCinemaStore((s) => s.queue.length);
  const big = useCinemaStore((s) => s.big);
  return (
    <div className="flex flex-col gap-2 text-[12px]">
      <div className="flex items-start gap-2">
        <span className="pt-0.5 text-cozy-red" aria-hidden>
          {now ? (isShowing(show) ? "▶" : "❚❚") : "·"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] tracking-wider text-cozy-ink-soft">{now ? (isShowing(show) ? "Función en curso" : "Función en pausa") : "Sala libre"}</p>
          <p className="line-clamp-2 text-[13px] leading-tight" title={now?.title}>
            {now ? now.title : "No hay función"}
          </p>
          {now && <p className="truncate text-cozy-ink-soft">la puso {now.by}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => useOfficeStore.getState().openPanel("cinema", false)} className="cozy-btn px-2 py-0.5 text-[12px]">
          {now ? `Cartelera${queued ? ` (${queued})` : ""}` : "Programar una función"}
        </button>
        {now && (
          <button type="button" onClick={() => useCinemaStore.getState().setBig(!big)} aria-pressed={big} className="cozy-btn px-2 py-0.5 text-[12px]">
            {big ? "Pantalla chica" : "Ver en grande"}
          </button>
        )}
      </div>
      {now && <CinemaVolume compact />}
    </div>
  );
}

/** Aviso del momento: el navegador no dejó sonar la función sola. */
export function CinemaHud() {
  const inCinema = useCinemaStore((s) => s.here.inCinema);
  const needsTap = useCinemaStore((s) => s.needsTap);
  const panel = useOfficeStore((s) => s.panel);
  if (!inCinema || !needsTap || panel) return null;
  return (
    <button type="button" onClick={() => tapVideos()} className="cozy-btn cozy-btn-primary pointer-events-auto px-3 py-1.5 text-[13px]">
      ▶ Activar el sonido de la función
    </button>
  );
}

function Thumb({ videoId, big = false }: { videoId: string; big?: boolean }) {
  return (
    <img
      src={thumb(videoId)}
      alt=""
      loading="lazy"
      draggable={false}
      className={`shrink-0 border-2 border-cozy-frame bg-black object-cover ${big ? "h-[45px] w-[80px]" : "h-[27px] w-[48px]"}`}
    />
  );
}

function Small({ children, disabled, onClick, label }: { children: React.ReactNode; disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-label={label} title={label} className="cozy-btn px-1.5 py-0.5 text-[12px]">
      {children}
    </button>
  );
}
