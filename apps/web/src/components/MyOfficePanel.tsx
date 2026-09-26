"use client";

import { useShallow } from "zustand/react/shallow";
import { sendOfficeLock } from "@/game/network";
import { selectMyOffice, useOfficeStore } from "@/game/store";
import { RISO } from "@/lib/riso";

/** Dentro de tu oficina: su nombre y el candado. Las notas viven ahora en el PC. */
export function MyOfficePanel() {
  const myOffice = useOfficeStore(useShallow(selectMyOffice));
  const zoneId = useOfficeStore((s) => s.zone?.id);
  // En el celular no caben el chat y este panel a la vez: el chat abierto tiene prioridad.
  const chatOpen = useOfficeStore((s) => s.chatOpen);
  if (!myOffice || zoneId !== myOffice.zoneId) return null;

  return (
    <section
      className={`riso-panel absolute right-3 bottom-24 z-10 flex items-center gap-3 px-3.5 py-2.5 xl:bottom-14 ${
        chatOpen ? "max-md:hidden" : ""
      }`}
      style={{ "--riso-shadow": RISO.blue } as React.CSSProperties}
    >
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-riso-blue uppercase">Tu oficina</p>
        <p className="font-display truncate text-[15px]">{myOffice.name}</p>
      </div>
      <button
        onClick={() => sendOfficeLock(!myOffice.locked)}
        aria-pressed={myOffice.locked}
        className={`riso-pill riso-press shrink-0 px-3 py-1.5 text-xs ${myOffice.locked ? "bg-riso-pink" : ""}`}
        title={myOffice.locked ? "Nadie puede entrar sin tocar la puerta" : "Cualquiera puede entrar"}
      >
        <LockIcon open={!myOffice.locked} />
        {myOffice.locked ? "Cerrada" : "Abierta"}
      </button>
    </section>
  );
}

function LockIcon({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d={open ? "M8 11V7a4 4 0 0 1 7.5-2" : "M8 11V7a4 4 0 0 1 8 0v4"} />
    </svg>
  );
}
