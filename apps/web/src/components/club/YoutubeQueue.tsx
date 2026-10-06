"use client";

// La cola de videos de YouTube del club: pegar un link, ver lo que suena (con reacciones y "saltar"),
// ordenar lo que viene arrastrando (o con las flechas), quitar, y volver a poner lo que ya sonó. Lo
// valida el servidor: cualquiera dentro del club puede tocar la cola.
import { drawReaction } from "@hyvento/map/art";
import { CLUB_REACTION_NAMES, CLUB_REACTIONS, CLUB_VIDEO, KARAOKE, karaokeSearchUrl, parseYoutubeId, type ClubVideoView } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { sendClubQueue, sendClubReact } from "@/game/club/net";
import { clubElapsed, useClubStore } from "@/game/club/store";
import { useOfficeStore } from "@/game/store";
import { ArtImage } from "../casino/PixelArt";
import { NEON } from "./neon";
import { PixelIcon } from "../Cozy";

/** Miniatura de YouTube (la chiquita, 120x90, recortada a 16:9). */
const thumb = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/default.jpg`;

/** 3:07, 1:02:09. */
export function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function YoutubeQueue({ inClub }: { inClub: boolean }) {
  const now = useClubStore((s) => s.now);
  const queue = useClubStore((s) => s.queue);
  const history = useClubStore((s) => s.history);
  const paused = useClubStore((s) => s.paused);
  const [url, setUrl] = useState("");
  const [bad, setBad] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const karaoke = useOfficeStore((s) => s.karaoke);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parseYoutubeId(url)) {
      setBad(true);
      return;
    }
    sendClubQueue({ action: "add", url });
    setUrl("");
  };

  return (
    <div className="flex flex-col gap-3">
      {!inClub && <p className="text-[13px]" style={{ color: NEON.gold }}>Entra al club (sótano) para poner videos o tocar la cola.</p>}

      {karaoke && <KaraokeSearch />}

      <form onSubmit={add} className="flex gap-2">
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setBad(false);
          }}
          placeholder={karaoke ? "Pega el link de tu canción (karaoke)" : "Pega un link de YouTube"}
          aria-label="Link de YouTube"
          aria-invalid={bad}
          disabled={!inClub}
          className="min-w-0 flex-1 border-2 px-2 py-1.5 text-[14px] outline-none"
          style={{ background: NEON.ink, borderColor: bad ? NEON.pink : NEON.edge, color: NEON.paper }}
        />
        <button
          type="submit"
          disabled={!inClub || !url.trim()}
          className="border-2 px-3 py-1.5 text-[14px] disabled:opacity-40"
          style={{ borderColor: NEON.pink, background: "#4f2672", color: NEON.paper, boxShadow: `2px 2px 0 ${NEON.edge}` }}
        >
          Agregar
        </button>
      </form>
      {bad && <p className="-mt-2 text-[12px]" style={{ color: NEON.pink }}>Eso no parece un link de un video de YouTube.</p>}

      <NowPlaying now={now} paused={paused} inClub={inClub} />

      <section aria-label="Lo que viene">
        <h3 className="mb-1 flex items-baseline justify-between text-[14px]" style={{ color: NEON.cyan }}>
          <span>Lo que viene</span>
          <span className="text-[11px] opacity-70">
            {queue.length}/{CLUB_VIDEO.maxQueue} · arrastra para ordenar
          </span>
        </h3>
        {queue.length === 0 ? (
          <p className="border-2 border-dashed px-3 py-2 text-[12px] opacity-75" style={{ borderColor: NEON.edge }}>
            La cola está vacía. Lo que agregues suena después del video de ahora.
          </p>
        ) : (
          <QueueList queue={queue} inClub={inClub} />
        )}
      </section>

      {history.length > 0 && (
        <section aria-label="Lo que sonó">
          <button type="button" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory} className="text-[13px] underline decoration-dotted" style={{ color: NEON.cyan }}>
            {showHistory ? "▾" : "▸"} Lo que sonó ({history.length})
          </button>
          {showHistory && (
            <ul className="mt-1 flex flex-col gap-1">
              {history.map((v) => (
                <li key={v.id} className="flex items-center gap-2 border-2 px-2 py-1" style={{ borderColor: NEON.edge, background: NEON.ink }}>
                  <Thumb videoId={v.videoId} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px]">{v.title}</span>
                    <span className="block truncate text-[11px] opacity-70">la puso {v.by}</span>
                  </span>
                  <SmallButton disabled={!inClub} onClick={() => sendClubQueue({ action: "replay", id: v.id })} label={`Volver a poner ${v.title}`}>
                    Otra vez
                  </SmallButton>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * Viernes de karaoke: se busca la canción en YouTube con "karaoke" (se abre en otra pestaña) y se pega
 * el link abajo. Quien la pone canta: lleva el micrófono mientras suena.
 */
function KaraokeSearch() {
  const [song, setSong] = useState("");
  const search = (e: React.FormEvent) => {
    e.preventDefault();
    if (!song.trim()) return;
    window.open(karaokeSearchUrl(song), "_blank", "noopener,noreferrer");
  };
  return (
    <div className="flex flex-col gap-2 border-4 px-3 py-2" style={{ background: "#0c1024", borderColor: NEON.pink }}>
      <p className="text-[14px] tracking-wide" style={{ color: NEON.pink }}>
        VIERNES DE KARAOKE
      </p>
      <p className="text-[12px] leading-snug opacity-85">
        Busca tu canción en versión «{KARAOKE.searchSuffix}», copia el link y pégalo abajo. Mientras suena, tú cantas: llevas el micrófono.
      </p>
      <form onSubmit={search} className="flex gap-2">
        <input
          value={song}
          onChange={(e) => setSong(e.target.value)}
          placeholder="Canción o artista"
          aria-label="Buscar canción de karaoke en YouTube"
          className="min-w-0 flex-1 border-2 px-2 py-1.5 text-[14px] outline-none"
          style={{ background: NEON.ink, borderColor: NEON.edge, color: NEON.paper }}
        />
        <button
          type="submit"
          disabled={!song.trim()}
          className="border-2 px-3 py-1.5 text-[14px] disabled:opacity-40"
          style={{ borderColor: NEON.cyan, background: "#4f2672", color: NEON.paper, boxShadow: `2px 2px 0 ${NEON.edge}` }}
        >
          Buscar
        </button>
      </form>
    </div>
  );
}

function NowPlaying({ now, paused, inClub }: { now: ClubVideoView | null; paused: boolean; inClub: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  const karaoke = useOfficeStore((s) => s.karaoke);
  useEffect(() => {
    if (!now) return;
    const tick = () => setElapsed(clubElapsed() ?? 0);
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [now]);
  if (!now) {
    return (
      <div className="border-4 px-3 py-2 text-[13px]" style={{ background: "#0c1024", borderColor: NEON.edge }}>
        No suena ningún video. Pega un link arriba y arranca al instante.
      </div>
    );
  }
  const total = now.durationMs;
  return (
    <div className="flex flex-col gap-2 border-4 px-3 py-2" style={{ background: "#0c1024", borderColor: NEON.edge }}>
      <div className="flex items-center gap-3">
        <Thumb videoId={now.videoId} big />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] opacity-75" style={{ color: NEON.pink }}>
            {paused ? "EN PAUSA" : "SUENA"}
          </p>
          <p className="line-clamp-2 text-[15px] leading-tight" style={{ color: NEON.cyan }}>
            {now.title}
          </p>
          <p className="truncate text-[11px] opacity-75">
            {karaoke ? "canta" : "la puso"} {now.by} · {clock(elapsed)}
            {total ? ` / ${clock(total)}` : ""}
          </p>
        </div>
        <SmallButton disabled={!inClub} onClick={() => sendClubQueue({ action: "skip", id: now.id })} label="Saltar al siguiente">
          Saltar ⏭
        </SmallButton>
      </div>
      {total > 0 && (
        <div className="h-1.5 w-full" style={{ background: NEON.edge }}>
          <div className="h-full" style={{ width: `${Math.min(100, (elapsed / total) * 100)}%`, background: NEON.pink }} />
        </div>
      )}
      <Reactions disabled={!inClub || paused} />
    </div>
  );
}

/** Botones de reacción (dibujos pixel-art propios): suben sobre quien reacciona, lo ven los del sótano. */
export function Reactions({ disabled, compact = false }: { disabled?: boolean; compact?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Reaccionar">
      {CLUB_REACTIONS.map((e) => (
        <button
          key={e}
          type="button"
          disabled={disabled}
          onClick={() => sendClubReact(e)}
          aria-label={`Reaccionar: ${CLUB_REACTION_NAMES[e]}`}
          title={CLUB_REACTION_NAMES[e]}
          className={`grid place-items-center border-2 leading-none disabled:opacity-40 ${compact ? "p-0.5" : "p-1"}`}
          style={{ borderColor: NEON.edge, background: NEON.ink }}
        >
          <ArtImage id={`reaccion-${e}`} make={() => drawReaction(e)} scale={compact ? 2 : 3} alt="" />
        </button>
      ))}
    </div>
  );
}

/**
 * La cola: se arrastra una fila a otra posición (y también se mueve con ▲▼, para teclado y pantallas
 * táctiles, donde el arrastre de HTML no funciona).
 */
function QueueList({ queue, inClub }: { queue: ClubVideoView[]; inClub: boolean }) {
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const move = (id: string, to: number) => sendClubQueue({ action: "move", id, to: Math.max(0, to) });

  return (
    <ol className="flex flex-col gap-1" onDragLeave={(e) => e.currentTarget === e.target && setOver(null)}>
      {queue.map((v, i) => {
        const dragging = drag === v.id;
        const target = over === i && drag !== null && !dragging;
        return (
          <li
            key={v.id}
            draggable={inClub}
            onDragStart={(e) => {
              setDrag(v.id);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", v.id);
            }}
            onDragOver={(e) => {
              if (!drag) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (over !== i) setOver(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (drag && drag !== v.id) move(drag, i);
              setDrag(null);
              setOver(null);
            }}
            onDragEnd={() => {
              setDrag(null);
              setOver(null);
            }}
            className="flex items-center gap-2 border-2 px-2 py-1"
            style={{
              borderColor: target ? NEON.pink : NEON.edge,
              background: dragging ? "#4f2672" : NEON.ink,
              opacity: dragging ? 0.6 : 1,
              boxShadow: target ? `0 -3px 0 ${NEON.pink}` : "none",
              cursor: inClub ? "grab" : "default",
            }}
          >
            <span aria-hidden className="w-4 text-center text-[13px] opacity-60">
              ⠿
            </span>
            <span className="w-5 text-right text-[12px] opacity-70">{i + 1}</span>
            <Thumb videoId={v.videoId} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px]">{v.title}</span>
              <span className="block truncate text-[11px] opacity-70">
                la puso {v.by}
                {v.durationMs ? ` · ${clock(v.durationMs)}` : ""}
              </span>
            </span>
            <span className="flex gap-0.5">
              <SmallButton disabled={!inClub || i === 0} onClick={() => move(v.id, i - 1)} label={`Subir ${v.title}`}>
                ▲
              </SmallButton>
              <SmallButton disabled={!inClub || i === queue.length - 1} onClick={() => move(v.id, i + 1)} label={`Bajar ${v.title}`}>
                ▼
              </SmallButton>
              <SmallButton disabled={!inClub} onClick={() => sendClubQueue({ action: "remove", id: v.id })} label={`Quitar ${v.title}`}>
                <PixelIcon name="close" size={10} />
              </SmallButton>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Thumb({ videoId, big = false }: { videoId: string; big?: boolean }) {
  return (
    // Miniaturas del propio YouTube: no son arte del juego, son la tapa de cada video.
    <img
      src={thumb(videoId)}
      alt=""
      loading="lazy"
      draggable={false}
      className={`shrink-0 border-2 object-cover ${big ? "h-[45px] w-[80px]" : "h-[27px] w-[48px]"}`}
      style={{ borderColor: NEON.edge, background: "#000" }}
    />
  );
}

function SmallButton({ children, disabled, onClick, label }: { children: React.ReactNode; disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="border-2 px-1.5 py-0.5 text-[12px] disabled:opacity-30"
      style={{ borderColor: NEON.cyan, background: NEON.ink, color: NEON.cyan }}
    >
      {children}
    </button>
  );
}
