"use client";

import type { ChatScope } from "@hyvento/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { sendChat } from "@/game/network";
import { useOfficeStore } from "@/game/store";

const NAME_COLORS = ["#ffd166", "#7bdff2", "#f497da", "#9ef01a", "#ffb4a2", "#b8b8ff", "#80ffdb"];
const colorFor = (id: string) => NAME_COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % NAME_COLORS.length];
const time = (ts: number) => new Date(ts).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

export function ChatPanel() {
  const messages = useOfficeStore((s) => s.messages);
  const scope = useOfficeStore((s) => s.chatScope);
  const open = useOfficeStore((s) => s.chatOpen);
  const unread = useOfficeStore((s) => s.unread);
  const zone = useOfficeStore((s) => s.zone);
  const sessionId = useOfficeStore((s) => s.sessionId);
  const { setChatScope, setChatOpen, setTyping } = useOfficeStore.getState();

  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => messages.filter((m) => m.scope === scope), [messages, scope]);

  // Enter enfoca el chat desde el juego.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || useOfficeStore.getState().typing) return;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
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

  if (!open) {
    return (
      <button
        onClick={() => setChatOpen(true)}
        className="absolute right-3 bottom-3 flex items-center gap-2 rounded-xl border border-line bg-panel/90 px-3 py-2 text-sm backdrop-blur hover:border-muted"
      >
        Chat
        {unread > 0 && (
          <span className="rounded-full bg-accent px-1.5 text-xs font-bold text-accent-ink">{unread}</span>
        )}
      </button>
    );
  }

  return (
    <section className="absolute right-3 bottom-3 flex h-[min(420px,calc(100%-5rem))] w-[min(340px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-line bg-panel/92 shadow-2xl backdrop-blur">
      <header className="flex items-center gap-1 border-b border-line p-2">
        {(["proximity", "global"] as ChatScope[]).map((s) => (
          <button
            key={s}
            onClick={() => setChatScope(s)}
            className={`rounded-lg px-3 py-1 text-xs font-medium ${
              s === scope ? "bg-panel-2 text-text" : "text-muted hover:text-text"
            }`}
          >
            {s === "proximity" ? (zone?.isolated ? zone.name : "Cerca") : "Global"}
          </button>
        ))}
        <button
          onClick={() => setChatOpen(false)}
          aria-label="Cerrar chat"
          className="ml-auto rounded-lg px-2 py-1 text-muted hover:text-text"
        >
          ✕
        </button>
      </header>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
        {visible.length === 0 && (
          <p className="pt-8 text-center text-xs text-muted">
            {scope === "global"
              ? "Nadie ha escrito en el canal global todavía."
              : "Acércate a alguien (o entra a una sala) y escribe."}
          </p>
        )}
        {visible.map((m) => (
          <div key={m.id}>
            <span className="font-semibold" style={{ color: m.fromId === sessionId ? "#ffe08a" : colorFor(m.fromId) }}>
              {m.fromId === sessionId ? "Tú" : m.fromName}
            </span>
            <span className="ml-2 text-[10px] text-muted">{time(m.ts)}</span>
            <p className="break-words text-text/90">{m.text}</p>
          </div>
        ))}
      </div>

      <form
        className="border-t border-line p-2"
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
          className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </form>
    </section>
  );
}
