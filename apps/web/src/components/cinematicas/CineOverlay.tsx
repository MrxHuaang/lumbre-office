"use client";

// Lo que se ve de una cinemática encima del juego (VIR-155): las franjas de cine, el título grande y el botón
// "Saltar". Lo que se dice y las opciones van por la tira de conversación (VIR-171, components/dialogo/
// TiraDialogo.tsx, que se para encima de la franja de abajo): E, Enter o Espacio siguen y Esc salta la
// cinemática. Lo que pasa en la escena (cámara, actores, efectos) lo hace game/cinematicas/player.ts.
import { useEffect } from "react";
import { skip, useCineStore } from "@/game/cinematicas/store";

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

  // Esc salta la cinemática (en cualquier momento). En una de historia, además, ninguna tecla sigue hasta
  // los atajos del juego (el celular con Enter, los emotes, la foto): las usa solo la escena. Se corta en
  // la captura de window, así la tira (también en captura sobre window) sigue oyéndolas.
  useEffect(() => {
    if (!playing) return;
    const story = playing.kind === "historia";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        skip();
        return;
      }
      if (story) e.stopPropagation();
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
