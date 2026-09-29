"use client";

import type { ChatScope } from "@hyvento/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { sendChat } from "@/game/network";
import { useOfficeStore } from "@/game/store";
import { focusOwnsKey } from "@/lib/keyboardFocus";
import { PixelIcon } from "./Cozy";
import { chatSuggestions } from "@/lib/chatCommands";
import { COZY, nameInk } from "@/lib/cozy";

const time = (ts: number) => new Date(ts).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
/** Los comandos de desarrollo (/ir, /clima) solo se ofrecen fuera de producción. */
const DEV = process.env.NODE_ENV !== "production";

export function ChatPanel({ isAdmin = false }: { isAdmin?: boolean }) {
  const messages = useOfficeStore((s) => s.messages);
  const scope = useOfficeStore((s) => s.chatScope);
  const open = useOfficeStore((s) => s.chatOpen);
  const zone = useOfficeStore((s) => s.zone);
  const sessionId = useOfficeStore((s) => s.sessionId);
  const { setChatScope, setChatOpen, setTyping } = useOfficeStore.getState();

  const [text, setText] = useState("");
  const [picked, setPicked] = useState(0);
  const suggestions = useMemo(() => chatSuggestions(text, { admin: isAdmin, dev: DEV }), [text, isAdmin]);
  const selected = Math.min(picked, Math.max(0, suggestions.length - 1));
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => messages.filter((m) => m.scope === scope), [messages, scope]);

  // Enter enfoca el chat desde el juego (no mientras se escribe en otro lado ni con el PC prendido).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { typing, pcOn } = useOfficeStore.getState();
      if (e.key !== "Enter" || typing || pcOn || e.defaultPrevented) return;
      // Un campo, o un botón con foco (Enter lo aprieta): no se roba el Enter.
      if (focusOwnsKey(e.key)) return;
      e.preventDefault();
      setChatOpen(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setChatOpen]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [visible.length, open]);

  const placeholder =
    scope === "global"
      ? "Mensaje para toda la cabaña"
      : zone?.isolated
        ? `Mensaje para ${zone.name}`
        : "Mensaje para quienes están cerca";

  // Cerrado: se abre desde la barra de llamada (botón "Chat") o con Enter.
  if (!open) return null;

  return (
    <section className="cozy-panel absolute bottom-[var(--cozy-bar-top,7rem)] left-3 z-10 flex h-[min(380px,calc(100%_-_var(--cozy-bar-top,7rem)_-_var(--cozy-hud-bottom,3rem)_-_1rem))] w-[min(330px,calc(100%-1.5rem))] flex-col p-1.5">
      <header className="flex items-center gap-2 bg-cozy-wood px-3 py-2 text-cozy-paper-light">
        <span className="text-[16px] font-semibold">Chat</span>
        <div className="ml-1 flex gap-1" role="tablist" aria-label="Canal">
          {(["proximity", "global"] as ChatScope[]).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={s === scope}
              onClick={() => setChatScope(s)}
              className={`max-w-28 truncate border-2 px-2 py-0.5 text-[12px] ${
                s === scope ? "border-cozy-paper-light bg-cozy-paper-light text-cozy-ink" : "border-cozy-wood-light hover:bg-cozy-wood-light"
              }`}
            >
              {s === "proximity" ? (zone?.isolated ? zone.name : "Cerca") : "Global"}
            </button>
          ))}
        </div>
        <button onClick={() => setChatOpen(false)} className="cozy-hit ml-auto p-1" aria-label="Cerrar chat" title="Cerrar chat">
          <PixelIcon name="close" size={12} />
        </button>
      </header>

      <div ref={listRef} className="cozy-scroll flex flex-1 flex-col gap-2.5 overflow-y-auto px-2.5 py-3">
        {visible.length === 0 && (
          <p className="pt-8 text-center text-[13px] text-cozy-ink-soft">
            {scope === "global"
              ? "Nadie ha escrito en el canal global todavía."
              : "Acércate a alguien (o entra a una sala) y escribe."}
          </p>
        )}
        {visible.map((m) =>
          // Sin autor (fromId vacío): aviso del sistema, como la respuesta del reloj a /time.
          m.fromId === "" ? (
            <p
              key={m.id}
              role="status"
              className="flex items-start gap-1.5 border-l-4 border-cozy-gold bg-cozy-paper-dark/60 px-2 py-1 text-[13px] leading-snug text-cozy-ink-soft"
            >
              <PixelIcon name="star" size={11} color="var(--color-cozy-gold)" className="mt-0.5 shrink-0" />
              <span className="min-w-0 break-words">
                <span className="font-semibold text-cozy-ink">{m.fromName}:</span> {m.text}
              </span>
            </p>
          ) : (
            <div key={m.id} className="flex flex-col gap-0.5">
              <span className="text-[12px] font-semibold">
                <span style={{ color: m.fromId === sessionId ? COZY.ink : nameInk(m.fromId) }}>
                  {m.fromId === sessionId ? "Tú" : m.fromName}
                </span>
                <span className="ml-2 font-normal text-cozy-ink-soft">{time(m.ts)}</span>
              </span>
              <p className="text-[14px] leading-snug break-words">{m.text}</p>
            </div>
          ),
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="mx-1 border-2 border-cozy-frame bg-cozy-paper-light text-[12px]">
          <ul id="chat-comandos" role="listbox" aria-label="Comandos" className="cozy-scroll max-h-32 overflow-y-auto">
            {suggestions.map((sug, i) => (
              <li key={sug.label} role="option" aria-selected={i === selected}>
                <button
                  type="button"
                  // mousedown: que el input no pierda el foco antes del clic.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setText(sug.insert);
                    setPicked(0);
                    inputRef.current?.focus();
                  }}
                  className={`flex w-full flex-col px-2 py-1 text-left ${i === selected ? "bg-cozy-paper-dark" : "hover:bg-cozy-paper-dark"}`}
                >
                  <span className="font-pixel break-words text-cozy-ink">{sug.label}</span>
                  <span className="text-cozy-ink-soft">{sug.help}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="border-t-2 border-cozy-paper-dark px-2 py-0.5 text-[11px] text-cozy-ink-soft">
            <kbd className="cozy-kbd">Tab</kbd> completa · <kbd className="cozy-kbd">↑↓</kbd> elige
          </p>
        </div>
      )}

      <form
        className="flex gap-1.5 p-1"
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return;
          sendChat(t, scope);
          setText("");
        }}
      >
        <input
          ref={inputRef}
          value={text}
          maxLength={500}
          onChange={(e) => {
            setText(e.target.value);
            setPicked(0);
          }}
          onFocus={() => setTyping(true)}
          onBlur={() => setTyping(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") inputRef.current?.blur();
            if (!suggestions.length) return;
            if (e.key === "Tab") {
              e.preventDefault();
              setText(suggestions[selected]!.insert);
              setPicked(0);
            } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const n = suggestions.length;
              setPicked((selected + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
            }
          }}
          aria-controls={suggestions.length ? "chat-comandos" : undefined}
          placeholder={placeholder}
          className="cozy-input min-w-0 flex-1 px-3 py-2 text-[14px]"
        />
        <button type="submit" disabled={!text.trim()} className="cozy-btn cozy-btn-primary px-3">
          Enviar
        </button>
      </form>
    </section>
  );
}
