"use client";

// La radio de la oficina donde estoy: qué suena y mi volumen; si es mi oficina, además poner un link de
// YouTube, pausar, seguir y apagar. Suena solo para los que están adentro.
import { parseYoutubeId } from "@hyvento/shared";
import { useState } from "react";
import { sendOfficeRadio } from "@/game/network";
import { useRadioStore } from "@/game/radio";
import { selectMyUserId, useOfficeStore } from "@/game/store";
import { tapVideos } from "@/game/youtube";

export function OfficeRadio() {
  const office = useOfficeStore((s) => (s.zone?.type === "office" ? s.offices[s.zone.id] : undefined));
  const mine = useOfficeStore((s) => Boolean(office && office.ownerId && office.ownerId === selectMyUserId(s)));
  const panel = useOfficeStore((s) => s.panel);
  const pcOn = useOfficeStore((s) => s.pcOn);
  const decorating = useOfficeStore((s) => s.decorating);
  const { volume, muted, needsTap, setVolume, setMuted } = useRadioStore();
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState("");
  const [bad, setBad] = useState(false);
  const setTyping = useOfficeStore((s) => s.setTyping);
  const radio = office?.radio ?? null;
  if (!office || panel || pcOn || decorating || (!radio && !mine)) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parseYoutubeId(url)) {
      setBad(true);
      return;
    }
    sendOfficeRadio({ action: "set", url });
    setUrl("");
    setEditing(false);
    setTyping(false);
  };

  return (
    <div className="absolute bottom-[10.5rem] left-1/2 z-10 flex w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-col items-center gap-1.5 font-pixel max-md:bottom-[12rem]">
      {needsTap && radio && (
        <button type="button" onClick={() => tapVideos()} className="cozy-btn cozy-btn-primary px-3 py-1.5 text-[13px]">
          ▶ Activar el sonido de la radio
        </button>
      )}
      {editing && (
        <form onSubmit={submit} className="cozy-panel flex items-center gap-2 px-2 py-1.5">
          <input
            autoFocus
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setBad(false);
            }}
            onFocus={() => setTyping(true)}
            onBlur={() => setTyping(false)}
            onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
            placeholder="Link de YouTube (música, un lofi en vivo…)"
            aria-label="Link de YouTube para la radio"
            aria-invalid={bad}
            className="cozy-input w-72 px-2 py-1 text-[13px]"
          />
          <button type="submit" className="cozy-btn cozy-btn-primary px-2 py-1 text-[13px]" disabled={!url.trim()}>
            Poner
          </button>
        </form>
      )}
      <div className="cozy-chip flex flex-wrap items-center justify-center gap-2 px-2.5 py-1 text-[12px]">
        <span aria-hidden>📻</span>
        <span className="max-w-52 truncate" title={radio?.title}>
          {radio ? `${radio.paused ? "En pausa · " : ""}${radio.title}` : "Radio apagada"}
        </span>
        {mine && (
          <>
            <button type="button" onClick={() => setEditing((v) => !v)} className="cozy-btn px-2 py-0.5 text-[12px]">
              {radio ? "Cambiar" : "Poner música"}
            </button>
            {radio && (
              <button type="button" onClick={() => sendOfficeRadio({ action: radio.paused ? "resume" : "pause" })} className="cozy-btn px-2 py-0.5 text-[12px]">
                {radio.paused ? "Seguir" : "Pausar"}
              </button>
            )}
            {radio && (
              <button type="button" onClick={() => sendOfficeRadio({ action: "stop" })} className="cozy-btn px-2 py-0.5 text-[12px]">
                Apagar
              </button>
            )}
          </>
        )}
        {radio && (
          <>
            <button type="button" onClick={() => setMuted(!muted)} aria-pressed={muted} className="cozy-btn px-2 py-0.5 text-[12px]">
              {muted ? "Sin sonido" : "Sonido"}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
              aria-label="Volumen de la radio"
              disabled={muted}
              className="w-24 accent-[#b3571a]"
            />
          </>
        )}
      </div>
    </div>
  );
}
