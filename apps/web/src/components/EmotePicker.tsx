"use client";

// Selector de emotes (sobre la barra de abajo): T lo abre y lo cierra. Grilla de 8x2 (4x4 en pantallas
// angostas); 1–9 mandan los nueve primeros, las flechas eligen y Enter manda. El elegido se anima.
import { drawEmote, emoteFrames } from "@hyvento/map/art";
import { EMOTES, type EmoteId } from "@hyvento/shared";
import { useEffect, useRef, useState } from "react";
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

/** ¿Es un campo donde se escribe? (ahí las teclas son del texto, no del selector). */
const isField = (el: EventTarget | Element | null) =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable);

/** Columnas de la grilla según el ancho (las flechas arriba/abajo saltan de a una fila). */
const columns = () => (typeof window !== "undefined" && window.innerWidth < 640 ? 4 : 8);

export function EmotePicker({ onClose }: { onClose: () => void }) {
  const [active, setActive] = useState(0);
  const activeRef = useRef(active);
  activeRef.current = active;
  const send = (id: EmoteId) => {
    sendEmote(id);
    onClose();
  };

  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Abierto, el teclado es del selector: Phaser lee las flechas antes que este listener, así que se marca
  // "escribiendo" para que el personaje no camine mientras se elige. Al cerrar se suelta (salvo que el foco
  // haya quedado en un campo, como el chat, que maneja su propio "escribiendo").
  useEffect(() => {
    const { setTyping } = useOfficeStore.getState();
    setTyping(true);
    return () => {
      if (!isField(document.activeElement)) useOfficeStore.getState().setTyping(false);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isField(e.target)) return;
      if (e.key === "Escape") return onClose();
      // La T también lo cierra (el atajo general la ignora mientras está marcado "escribiendo").
      if (e.key.toLowerCase() === "t" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (!e.repeat) closeRef.current();
        return;
      }
      const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns(), ArrowDown: columns() }[e.key];
      if (move !== undefined) {
        e.preventDefault();
        setActive((i) => (i + move + EMOTES.length) % EMOTES.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        sendEmote(EMOTES[activeRef.current]!.id);
        onClose();
        return;
      }
      const n = Number(e.key);
      const emote = Number.isInteger(n) && n >= 1 && n <= 9 ? EMOTES[n - 1] : undefined;
      if (!emote) return;
      e.preventDefault();
      sendEmote(emote.id);
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const current = EMOTES[active]!;
  return (
    <div role="menu" aria-label="Emotes" className="cozy-panel absolute bottom-full left-1/2 mb-2 w-max -translate-x-1/2 p-1.5">
      <div className="grid grid-cols-4 gap-1 sm:grid-cols-8">
        {EMOTES.map((e, i) => (
          <button
            key={e.id}
            type="button"
            role="menuitem"
            onClick={() => send(e.id)}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            title={i < 9 ? `${e.name} (${i + 1})` : e.name}
            aria-label={e.name}
            data-on={i === active || undefined}
            className="cozy-btn relative h-11 w-11 p-0"
          >
            {i < 9 && <span className="absolute top-0 left-1 text-[10px] leading-tight text-cozy-ink-soft">{i + 1}</span>}
            <EmoteArt id={e.id} animate={i === active} />
          </button>
        ))}
      </div>
      <p className="mt-1.5 flex items-center justify-between gap-3 px-1 text-[13px]">
        <span className="font-semibold">{current.name}</span>
        <span className="text-cozy-ink-soft">
          <kbd className="cozy-kbd">1</kbd>–<kbd className="cozy-kbd">9</kbd> · flechas y <kbd className="cozy-kbd">Enter</kbd>
        </span>
      </p>
    </div>
  );
}

const artCache = new Map<string, string>();

/** Un frame del emote como data URL (se dibuja una sola vez). */
function frameUrl(id: string, frame: number) {
  const key = `${id}-${frame}`;
  let url = artCache.get(key);
  if (!url) {
    url = toHtmlCanvas(drawEmote(id, frame)).toDataURL();
    artCache.set(key, url);
  }
  return url;
}

/** El dibujo del emote; el elegido pasa por sus frames como sobre la cabeza. */
export function EmoteArt({ id, animate = false, className = "h-8 w-8" }: { id: string; animate?: boolean; className?: string }) {
  const [frame, setFrame] = useState(0);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!animate) return setFrame(0);
    const { count, ms } = emoteFrames(id);
    if (count < 2) return;
    const timer = setInterval(() => setFrame((f) => (f + 1) % count), ms);
    return () => clearInterval(timer);
  }, [animate, id]);
  // El canvas solo existe en el navegador: se dibuja después de montar.
  useEffect(() => setSrc(frameUrl(id, frame)), [id, frame]);
  return src ? <img src={src} alt="" className={`${className} [image-rendering:pixelated]`} /> : null;
}
