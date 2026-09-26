"use client";

import type { ChatScope } from "@hyvento/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { sendChat } from "@/game/network";
import { useOfficeStore } from "@/game/store";
import { nameInk, RISO } from "@/lib/riso";

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
      ? "Mensaje para toda la oficina"
      : zone?.isolated
        ? `Mensaje para ${zone.name}`
        : "Mensaje para quienes están cerca";

  // Cerrado: se abre desde la barra de llamada (botón "Chat") o con Enter.
  if (!open) return null;

  return (
    <section
      className="riso-panel absolute bottom-24 left-3 z-10 flex h-[min(380px,calc(100%-13rem))] w-[min(330px,calc(100%-1.5rem))] flex-col"
      style={{ "--riso-shadow": RISO.pink } as React.CSSProperties}
    >
      <header className="flex items-center gap-2 border-b-2 border-riso-navy px-3.5 py-2.5">
        <span className="font-display text-[15px]">Chat</span>
        <div className="ml-1 flex gap-1" role="tablist" aria-label="Canal">
          {(["proximity", "global"] as ChatScope[]).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={s === scope}
              onClick={() => setChatScope(s)}
              className={`max-w-28 truncate rounded-full border-[1.5px] border-riso-navy px-2.5 py-0.5 text-[11px] font-semibold ${
                s === scope ? "bg-riso-navy text-riso-paper" : "hover:bg-riso-yellow"
              }`}
            >
              {s === "proximity" ? (zone?.isolated ? zone.name : "Cerca") : "Global"}
            </button>
          ))}
        </div>
        <button onClick={() => setChatOpen(false)} className="ml-auto text-[13px] underline-offset-2 hover:underline">
          cerrar
        </button>
      </header>

      <div ref={listRef} className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-3.5 py-3">
        {visible.length === 0 && (
          <p className="pt-8 text-center text-xs text-riso-muted">
            {scope === "global"
              ? "Nadie ha escrito en el canal global todavía."
              : "Acércate a alguien (o entra a una sala) y escribe."}
          </p>
        )}
        {visible.map((m) => (
          <div key={m.id} className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold">
              <span style={{ color: m.fromId === sessionId ? RISO.navy : nameInk(m.fromId) }}>
                {m.fromId === sessionId ? "Tú" : m.fromName}
              </span>
              <span className="ml-2 font-normal text-riso-muted">{time(m.ts)}</span>
            </span>
            <p className="text-[13px] leading-snug break-words">{m.text}</p>
          </div>
        ))}
      </div>

      <form
        className="flex border-t-2 border-riso-navy"
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
          className="min-w-0 flex-1 bg-riso-cream px-3.5 py-3 text-[13px] outline-none placeholder:text-riso-placeholder"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="border-l-2 border-riso-navy bg-riso-pink px-4 text-[13px] font-semibold disabled:opacity-60"
        >
          Enviar
        </button>
      </form>
    </section>
  );
}
