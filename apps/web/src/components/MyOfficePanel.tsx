"use client";

import { useShallow } from "zustand/react/shallow";
import { sendOfficeLock } from "@/game/network";
import { selectMyOffice, useOfficeStore } from "@/game/store";
import { PixelIcon } from "./Cozy";

/** Dentro de tu oficina: su nombre y el candado. Las notas viven en el PC. */
export function MyOfficePanel() {
  const myOffice = useOfficeStore(useShallow(selectMyOffice));
  const zoneId = useOfficeStore((s) => s.zone?.id);
  // En el celular no caben el chat y este panel a la vez: el chat abierto tiene prioridad.
  const chatOpen = useOfficeStore((s) => s.chatOpen);
  if (!myOffice || zoneId !== myOffice.zoneId) return null;

  return (
    <section
      className={`cozy-panel absolute right-3 bottom-28 z-10 flex items-center gap-3 px-4 py-3 xl:bottom-16 ${chatOpen ? "max-md:hidden" : ""}`}
    >
      <div className="min-w-0">
        <p className="text-[12px] text-cozy-ink-soft">Tu oficina</p>
        <p className="truncate text-[17px] font-semibold">{myOffice.name}</p>
      </div>
      <button
        onClick={() => sendOfficeLock(!myOffice.locked)}
        data-on={myOffice.locked}
        className="cozy-btn shrink-0"
        title={myOffice.locked ? "Nadie puede entrar sin tocar la puerta" : "Cualquiera puede entrar"}
      >
        <PixelIcon name={myOffice.locked ? "lock" : "unlock"} size={14} />
        {myOffice.locked ? "Cerrada" : "Abierta"}
      </button>
    </section>
  );
}
