"use client";

import { respondKnock, sendKnock } from "@/game/network";
import { useOfficeStore } from "@/game/store";

/** Frente a la puerta de una oficina cerrada: ofrecer tocar. */
export function DoorPrompt() {
  const zoneId = useOfficeStore((s) => s.doorPrompt);
  const office = useOfficeStore((s) => (s.doorPrompt ? s.offices[s.doorPrompt] : undefined));
  const pending = useOfficeStore((s) => s.pendingKnock);
  if (!zoneId || !office) return null;
  const waiting = pending === zoneId;

  return (
    <div className="absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-line bg-panel/95 px-4 py-2.5 text-sm shadow-xl backdrop-blur">
      <span>
        🔒 La oficina de <strong>{office.ownerName}</strong> está cerrada
      </span>
      <button
        onClick={() => sendKnock(zoneId)}
        disabled={waiting}
        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink disabled:opacity-60"
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
    <div className="absolute top-[172px] left-1/2 z-10 flex w-[min(360px,calc(100%-1.5rem))] -translate-x-1/2 flex-col gap-2">
      {requests.map((r) => (
        <div key={r.requestId} role="alert" className="rounded-xl border border-accent/40 bg-panel/95 p-3 shadow-xl backdrop-blur">
          <p className="text-sm">
            🚪 <strong>{r.fromName}</strong> toca la puerta de tu oficina
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => respondKnock(r.requestId, true)}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink"
            >
              Dejar pasar
            </button>
            <button
              onClick={() => respondKnock(r.requestId, false)}
              className="rounded-lg border border-line px-3 py-1.5 text-xs"
            >
              Ahora no
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const TONE: Record<string, string> = {
  info: "border-line",
  success: "border-emerald-400/40",
  warning: "border-amber-400/40",
};

export function Notices() {
  const notices = useOfficeStore((s) => s.notices);
  const dismiss = useOfficeStore((s) => s.dismissNotice);
  if (notices.length === 0) return null;
  return (
    <div className="pointer-events-none absolute top-16 right-3 flex w-[min(320px,calc(100%-1.5rem))] flex-col gap-2" aria-live="polite">
      {notices.map((n) => (
        <button
          key={n.id}
          onClick={() => dismiss(n.id)}
          className={`pointer-events-auto rounded-xl border bg-panel/95 px-3 py-2 text-left text-sm shadow-xl backdrop-blur ${TONE[n.tone]}`}
        >
          {n.text}
        </button>
      ))}
    </div>
  );
}
