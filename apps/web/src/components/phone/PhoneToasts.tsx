"use client";

// Con el celular guardado, un mensaje nuevo del chat aparece un rato arriba a la derecha, como un SMS
// que entra: quién lo manda y el comienzo. Clic lo abre en Mensajes, en su pestaña. Los globos sobre
// las cabezas siguen como siempre (los dibuja la escena).
import type { ChatScope } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { selectChatMuted, usePhoneStore } from "@/game/phone/state";
import { useOfficeStore } from "@/game/store";
import { nameInk } from "@/lib/cozy";
import { PixelIcon } from "../Cozy";

interface Toast {
  id: string;
  from: string;
  fromId: string;
  text: string;
  scope: ChatScope;
}

const TOAST_MS = 6000;
const MAX_TOASTS = 3;
const PREVIEW = 70;

export function MessageToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(
    () =>
      useOfficeStore.subscribe((s, prev) => {
        if (s.messages === prev.messages) return;
        const known = new Set(prev.messages.map((m) => m.id));
        const fresh = s.messages.filter(
          // El historial al conectar llega viejo: no avisa (el mismo criterio que el sonido del chat).
          (m) => !known.has(m.id) && m.fromId !== s.sessionId && Date.now() - m.ts < 10_000,
        );
        if (fresh.length === 0 || usePhoneStore.getState().mounted || selectChatMuted(s)) return;
        const add = fresh.map((m) => ({ id: m.id, from: m.fromName, fromId: m.fromId, text: m.text, scope: m.scope }));
        setToasts((t) => [...t, ...add].slice(-MAX_TOASTS));
        for (const m of add) setTimeout(() => setToasts((t) => t.filter((x) => x.id !== m.id)), TOAST_MS);
      }),
    [],
  );

  // Al sacar el celular, los avisos sobran (ahí está todo).
  const phoneOut = usePhoneStore((s) => s.mounted);
  useEffect(() => {
    if (phoneOut) setToasts([]);
  }, [phoneOut]);

  if (toasts.length === 0) return null;
  return (
    <div className="flex w-full flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => usePhoneStore.getState().show({ app: "mensajes", scope: t.scope })}
          title="Leer en el celular"
          className="cozy-panel pointer-events-auto flex w-full items-start gap-2 px-3 py-2 text-left text-[13px] leading-snug"
        >
          <span className="mt-0.5 shrink-0">
            <PixelIcon name="mail" size={14} color="var(--color-cozy-wood)" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate font-semibold" style={{ color: nameInk(t.fromId) }}>
                {t.from}
              </span>
              <span className="shrink-0 text-[11px] text-cozy-ink-soft">{t.scope === "global" ? "Global" : "Cerca"}</span>
            </span>
            <span className="line-clamp-2 break-words">{t.text.length > PREVIEW ? `${t.text.slice(0, PREVIEW)}…` : t.text}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
