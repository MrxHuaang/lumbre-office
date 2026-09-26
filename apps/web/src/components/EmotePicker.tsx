"use client";

// Selector de emotes (sobre la barra de abajo): T lo abre y lo cierra, 1–7 o clic manda uno.
import { drawEmote } from "@hyvento/map/art";
import { EMOTES, type EmoteId } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { sendEmote } from "@/game/network";
import { useOfficeStore } from "@/game/store";

/** La tecla T abre y cierra el selector (no mientras se escribe, con el PC prendido o un panel abierto). */
export function useEmoteKey(toggle: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "t" || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const { typing, pcOn, panel } = useOfficeStore.getState();
      if (typing || pcOn || panel) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);
}

export function EmotePicker({ onClose }: { onClose: () => void }) {
  const send = (id: EmoteId) => {
    sendEmote(id);
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useOfficeStore.getState().typing) return;
      if (e.key === "Escape") return onClose();
      const n = Number(e.key);
      const emote = Number.isInteger(n) && n >= 1 ? EMOTES[n - 1] : undefined;
      if (!emote) return;
      e.preventDefault();
      sendEmote(emote.id);
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="menu" aria-label="Emotes" className="cozy-panel absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 gap-1 p-1.5">
      {EMOTES.map((e, i) => (
        <button
          key={e.id}
          type="button"
          role="menuitem"
          onClick={() => send(e.id)}
          title={`${e.name} (${i + 1})`}
          aria-label={e.name}
          className="cozy-btn relative h-11 w-11 p-0"
        >
          <span className="absolute top-0 left-1 text-[10px] text-cozy-ink-soft">{i + 1}</span>
          <EmoteArt id={e.id} />
        </button>
      ))}
    </div>
  );
}

const artCache = new Map<string, string>();

function EmoteArt({ id }: { id: string }) {
  const [src, setSrc] = useState(() => artCache.get(id) ?? null);
  useEffect(() => {
    if (artCache.has(id)) return;
    const url = toHtmlCanvas(drawEmote(id)).toDataURL();
    artCache.set(id, url);
    setSrc(url);
  }, [id]);
  return src ? <img src={src} alt="" className="h-7 w-7 [image-rendering:pixelated]" /> : null;
}
