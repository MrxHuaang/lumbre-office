"use client";

import type { ChatScope } from "@hyvento/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { sendChat } from "@/game/network";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "./Cozy";
import { COZY, nameInk } from "@/lib/cozy";

const time = (ts: number) => new Date(ts).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

export function ChatPanel() {
  const messages = useOfficeStore((s) => s.messages);
  const scope = useOfficeStore((s) => s.chatScope);
  const open = useOfficeStore((s) => s.chatOpen);
  const zone = useOfficeStore((s) => s.zone);
  const sessionId = useOfficeStore((s) => s.sessionId);
  const { setChatScope, setChatOpen, setTyping } = useOfficeStore.getState();

  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => messages.filter((m) => m.scope === scope), [messages, scope]);

  // Enter enfoca el chat desde el juego (no mientras se escribe en otro lado ni con el PC prendido).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { typing, pcOn } = useOfficeStore.getState();
      if (e.key !== "Enter" || typing || pcOn || e.defaultPrevented) return;
      const active = document.activeElement as HTMLElement | null;
      const tag = (active?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || active?.isContentEditable) return;
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
    <section className="cozy-panel absolute bottom-[var(--cozy-bar-top,7rem)] left-3 z-10 flex h-[min(380px,calc(100%_-_var(--cozy-bar-top,7rem)_-_7rem))] w-[min(330px,calc(100%-1.5rem))] flex-col p-1.5">
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
        <button onClick={() => setChatOpen(false)} className="ml-auto p-1" aria-label="Cerrar chat" title="Cerrar chat">
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
        {visible.map((m) => (
          <div key={m.id} className="flex flex-col gap-0.5">
            <span className="text-[12px] font-semibold">
              <span style={{ color: m.fromId === sessionId ? COZY.ink : nameInk(m.fromId) }}>
                {m.fromId === sessionId ? "Tú" : m.fromName}
              </span>
              <span className="ml-2 font-normal text-cozy-ink-soft">{time(m.ts)}</span>
            </span>
            <p className="text-[14px] leading-snug break-words">{m.text}</p>
          </div>
        ))}
      </div>

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
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setTyping(true)}
          onBlur={() => setTyping(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") inputRef.current?.blur();
          }}
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
