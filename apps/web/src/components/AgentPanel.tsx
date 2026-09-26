"use client";

import { AGENT_STATUS_ICON, type AgentStatus } from "@hyvento/shared";
import { useEffect, useRef, useState } from "react";
import { sendAgentAsk } from "@/game/network";
import { useOfficeStore, type AgentMsg } from "@/game/store";
import { AvatarPreview } from "./AvatarPreview";
import { MarkdownLite } from "./MarkdownLite";

const STATUS_TEXT: Record<AgentStatus, string> = {
  idle: "Disponible",
  thinking: "Pensando…",
  searching: "Buscando…",
  writing: "Escribiendo…",
  error: "Tuvo un problema",
};

/** Chat directo con un agente (se abre al hacer clic en él). */
export function AgentPanel() {
  const agentId = useOfficeStore((s) => s.openAgentId);
  const agent = useOfficeStore((s) => (s.openAgentId ? s.agents[s.openAgentId] : undefined));
  const thread = useOfficeStore((s) => (s.openAgentId ? s.agentThreads[s.openAgentId] : undefined));
  const { openAgent, setAgentHistory, setTyping } = useOfficeStore.getState();
  const [text, setText] = useState("");
  const [loadError, setLoadError] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Cargar el historial la primera vez que se abre.
  useEffect(() => {
    if (!agentId || thread?.loaded) return;
    let cancelled = false;
    setLoadError(false);
    fetch(`/api/agents/${agentId}/messages`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((b: { messages: AgentMsg[] }) => !cancelled && setAgentHistory(agentId, b.messages))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [agentId, thread?.loaded, setAgentHistory]);

  const messages = thread?.messages ?? [];
  const last = messages.at(-1);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length, last?.text.length]);

  useEffect(() => {
    if (agentId) requestAnimationFrame(() => inputRef.current?.focus());
  }, [agentId]);

  useEffect(() => {
    if (!agentId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && document.activeElement !== inputRef.current) openAgent(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [agentId, openAgent]);

  if (!agentId || !agent) return null;
  const pending = thread?.pending ?? false;
  const canSend = text.trim().length > 0 && !pending && (thread?.loaded ?? false);

  const send = () => {
    const t = text.trim();
    if (!t || !canSend) return;
    sendAgentAsk(agentId, t);
    setText("");
  };

  return (
    <section
      className="absolute top-16 right-3 bottom-3 z-10 flex w-[min(400px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-lab/30 bg-panel/95 shadow-2xl backdrop-blur"
      aria-label={`Chat con ${agent.name}`}
    >
      <header className="flex items-center gap-3 border-b border-line p-3">
        <div className="rounded-lg bg-ink/70 p-0.5">
          <AvatarPreview avatar={agent.sprite} scale={1.25} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {agent.name} <span className="text-xs font-normal text-lab">· IA</span>
          </p>
          <p className="truncate text-xs text-muted">
            {agent.role} · {AGENT_STATUS_ICON[agent.status]} {agent.detail || STATUS_TEXT[agent.status]}
          </p>
        </div>
        <button onClick={() => openAgent(null)} aria-label="Cerrar chat" className="rounded-lg px-2 py-1 text-muted hover:text-text">
          ✕
        </button>
      </header>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
        {!thread?.loaded && !loadError && <p className="text-center text-xs text-muted">Cargando conversación…</p>}
        {loadError && <p className="text-center text-xs text-red-300">No se pudo cargar la conversación.</p>}
        {thread?.loaded && messages.length === 0 && (
          <p className="pt-6 text-center text-xs text-muted">
            Escríbele a {agent.name}. La conversación es privada: solo tú ves sus respuestas.
          </p>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="ml-8 rounded-xl rounded-br-sm bg-accent/15 px-3 py-2 whitespace-pre-wrap">
              {m.text}
            </div>
          ) : (
            <div
              key={m.id}
              className={`mr-4 rounded-xl rounded-bl-sm px-3 py-2 ${m.error ? "border border-red-400/30 bg-red-400/10 text-red-100" : "bg-panel-2"}`}
            >
              {m.text ? <MarkdownLite text={m.text} /> : <TypingDots />}
              {m.streaming && m.text && <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-lab align-middle" />}
            </div>
          ),
        )}
      </div>

      <form
        className="border-t border-line p-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={text}
            rows={1}
            maxLength={4000}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setTyping(true)}
            onBlur={() => setTyping(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              } else if (e.key === "Escape") inputRef.current?.blur();
            }}
            placeholder={pending ? `${agent.name} está respondiendo…` : `Escríbele a ${agent.name}`}
            className="max-h-32 min-h-[38px] flex-1 resize-none rounded-lg border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-lab"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="rounded-lg bg-lab px-3 py-2 text-sm font-semibold text-ink disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
        <p className="mt-1 px-1 text-[10px] text-muted">Enter para enviar · Shift+Enter nueva línea</p>
      </form>
    </section>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-1" aria-label="Escribiendo">
      {[0, 150, 300].map((d) => (
        <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}
