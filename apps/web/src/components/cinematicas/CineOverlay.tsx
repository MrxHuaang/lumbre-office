"use client";

// Lo que se ve de una cinemática encima del juego (VIR-155): las franjas de cine, el título grande, el
// cuadro de diálogo con el retrato y el texto que se va escribiendo, y las opciones. Clic, Enter, Espacio o
// E siguen (si el texto se estaba escribiendo, primero lo completa); Esc salta la cinemática. Lo que pasa en
// la escena (cámara, actores, efectos) lo hace game/cinematicas/player.ts.
import { CINE_MS } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { advance, choose, skip, useCineStore } from "@/game/cinematicas/store";
import { lessMotion } from "@/lib/prefs";

/** El texto que se escribe letra a letra (con menos movimiento, de una). */
function useTyped(text: string, key: number): [string, boolean, () => void] {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (lessMotion()) return setN(text.length);
    setN(0);
    const step = 1000 / CINE_MS.typeCps;
    const id = setInterval(() => setN((v) => (v >= text.length ? (clearInterval(id), v) : v + 1)), step);
    return () => clearInterval(id);
  }, [text, key]);
  return [text.slice(0, n), n >= text.length, () => setN(text.length)];
}

function DialogBox() {
  const line = useCineStore((s) => s.line);
  const [shown, done, complete] = useTyped(line?.text ?? "", line?.key ?? 0);
  const choice = useCineStore((s) => s.choice);

  useEffect(() => {
    if (!line?.wait) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " " && e.key.toLowerCase() !== "e") return;
      e.preventDefault();
      e.stopPropagation();
      if (!done) complete();
      else advance();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [line, done, complete]);

  if (!line || choice) return null;
  return (
    <button
      type="button"
      onClick={() => (done ? advance() : complete())}
      className="cozy-panel pointer-events-auto mx-auto flex w-[min(640px,calc(100vw-32px))] items-start gap-3 p-3 text-left"
      aria-live="polite"
    >
      {line.portrait && (
        <img
          src={line.portrait}
          alt=""
          className="size-20 shrink-0 border-2 border-cozy-wood bg-cozy-paper-dark object-cover object-top [image-rendering:pixelated]"
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {line.name && <span className="font-pixel text-[15px] text-cozy-wood">{line.name}</span>}
        <span className="min-h-[3.2em] text-[15px] leading-snug text-cozy-ink">{shown}</span>
        {line.wait && done && <span className="self-end text-[12px] text-cozy-ink-soft motion-safe:animate-pulse">▼ seguir</span>}
      </span>
    </button>
  );
}

function Choices() {
  const choice = useCineStore((s) => s.choice);
  const lastSaid = useCineStore((s) => s.lastSaid);
  if (!choice) return null;
  const prompt = choice.prompt ?? lastSaid;
  return (
    <div className="cozy-panel pointer-events-auto mx-auto flex w-[min(520px,calc(100vw-32px))] flex-col gap-2 p-3">
      {prompt && <p className="text-[14px] leading-snug">{prompt}</p>}
      {choice.options.map((o, i) => (
        <button key={o.id} type="button" autoFocus={i === 0} onClick={() => choose(o.id)} className="cozy-btn justify-start px-3 py-2 text-left text-[14px]">
          ▸ {o.label}
        </button>
      ))}
    </div>
  );
}

function Title() {
  const title = useCineStore((s) => s.title);
  if (!title) return null;
  return (
    <div key={title.key} className="pointer-events-none absolute inset-x-0 top-[28%] flex flex-col items-center gap-1 px-4 text-center motion-safe:animate-[cineTitle_0.5s_ease-out]">
      <p className="font-pixel text-[clamp(26px,5vw,46px)] leading-none text-cozy-gold [text-shadow:3px_3px_0_#2a1a10]">{title.text}</p>
      {title.sub && <p className="font-pixel text-[clamp(14px,2.4vw,20px)] text-cozy-paper-light [text-shadow:2px_2px_0_#2a1a10]">{title.sub}</p>}
    </div>
  );
}

export function CineOverlay() {
  const playing = useCineStore((s) => s.playing);
  const bars = useCineStore((s) => s.bars);

  // Esc salta la cinemática (en cualquier momento).
  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      skip();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [playing]);

  if (!playing) return null;
  const story = playing.kind === "historia";
  return (
    <div className={`fixed inset-0 z-40 ${story ? "pointer-events-auto" : "pointer-events-none"}`} aria-label="Cinemática">
      <div
        className={`absolute inset-x-0 top-0 h-[11vh] bg-black transition-transform duration-300 motion-reduce:transition-none ${bars ? "translate-y-0" : "-translate-y-full"}`}
      />
      <div
        className={`absolute inset-x-0 bottom-0 h-[11vh] bg-black transition-transform duration-300 motion-reduce:transition-none ${bars ? "translate-y-0" : "translate-y-full"}`}
      />
      <Title />
      <div className="absolute inset-x-0 bottom-[calc(11vh+12px)] flex flex-col gap-2 px-4">
        <Choices />
        <DialogBox />
      </div>
      {story && (
        <button
          type="button"
          onClick={skip}
          className="cozy-chip pointer-events-auto absolute top-3 right-3 px-2.5 py-1 text-[12px]"
          title="Saltar la escena (Esc)"
        >
          Saltar <kbd className="cozy-kbd ml-1">Esc</kbd>
        </button>
      )}
    </div>
  );
}
