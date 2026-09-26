"use client";

import { respondKnock, sendKnock } from "@/game/network";
import { useOfficeStore } from "@/game/store";
import { RISO } from "@/lib/riso";

/** Frente a la puerta de una oficina cerrada: ofrecer tocar. */
export function DoorPrompt() {
  const zoneId = useOfficeStore((s) => s.doorPrompt);
  const office = useOfficeStore((s) => (s.doorPrompt ? s.offices[s.doorPrompt] : undefined));
  const pending = useOfficeStore((s) => s.pendingKnock);
  if (!zoneId || !office) return null;
  const waiting = pending === zoneId;

  return (
    <div className="riso-panel absolute bottom-24 left-1/2 z-10 flex w-max max-md:top-1/2 max-md:bottom-auto max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-3 px-4 py-2.5 text-[13px]">
      <span>
        La oficina de <strong>{office.ownerName}</strong> está cerrada
      </span>
      <button
        onClick={() => sendKnock(zoneId)}
        disabled={waiting}
        className="riso-pill riso-press bg-riso-pink px-3.5 py-1.5 text-xs"
      >
        {waiting ? "Esperando respuesta…" : "Tocar la puerta"}
      </button>
    </div>
  );
}

/** Para el dueño: alguien toca la puerta de su oficina. */
export function KnockRequests() {
  const requests = useOfficeStore((s) => s.knockRequests);
  if (requests.length === 0) return null;
  return (
    <div className="absolute top-1/3 left-1/2 z-20 flex w-[min(360px,calc(100%-1.5rem))] -translate-x-1/2 flex-col gap-3">
      {requests.map((r) => (
        <div
          key={r.requestId}
          role="alert"
          className="riso-panel p-3.5"
          style={{ "--riso-shadow": RISO.pink } as React.CSSProperties}
        >
          <p className="text-[13px]">
            <strong>{r.fromName}</strong> toca la puerta de tu oficina
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => respondKnock(r.requestId, true)}
              className="riso-pill riso-press bg-riso-pink px-3.5 py-1.5 text-xs"
            >
              Dejar pasar
            </button>
            <button onClick={() => respondKnock(r.requestId, false)} className="text-xs underline underline-offset-2">
              Ahora no
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Color de la sombra de cada aviso según su tono. */
const TONE: Record<string, string> = {
  info: RISO.blue,
  success: RISO.green,
  warning: RISO.orange,
};

export function Notices() {
  const notices = useOfficeStore((s) => s.notices);
  const dismiss = useOfficeStore((s) => s.dismissNotice);
  if (notices.length === 0) return null;
  return (
    <div className="flex w-full flex-col gap-3" aria-live="polite">
      {notices.map((n) => (
        <div
          key={n.id}
          className="riso-panel pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 text-[13px]"
          style={{ "--riso-shadow": TONE[n.tone] ?? RISO.navy } as React.CSSProperties}
        >
          <span className="flex-1">{n.text}</span>
          {n.action && (
            <button
              onClick={() => {
                n.action!.run();
                dismiss(n.id);
              }}
              className="riso-pill riso-press shrink-0 bg-riso-yellow px-3 py-1 text-xs"
            >
              {n.action.label}
            </button>
          )}
          <button onClick={() => dismiss(n.id)} aria-label="Cerrar aviso" className="shrink-0 px-1 text-riso-muted hover:text-riso-navy">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

/** Ayuda de la tecla E junto a un asiento libre o estando sentado (solo con teclado). */
export function SeatPrompt() {
  const prompt = useOfficeStore((s) => s.seatPrompt);
  const doorPrompt = useOfficeStore((s) => s.doorPrompt);
  if (!prompt || doorPrompt) return null;
  return (
    <div className="riso-chip pointer-events-none absolute bottom-24 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 px-3 py-1.5 text-xs font-semibold max-md:hidden">
      <kbd className="rounded-[3px] border-[1.5px] border-riso-navy bg-riso-yellow px-1.5 font-plex text-[11px]">E</kbd>
      {prompt === "sit" ? "sentarte" : "levantarte (o muévete)"}
    </div>
  );
}
