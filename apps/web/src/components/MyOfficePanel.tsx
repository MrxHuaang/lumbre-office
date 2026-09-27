"use client";

import { OFFICE_NOTE_MAX } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { sendOfficeLock, sendOfficeNote } from "@/game/network";
import { selectMyOffice, useOfficeStore } from "@/game/store";
import { PixelIcon } from "./Cozy";

/**
 * Dentro de tu oficina: su nombre, el candado, el botón para decorarla y la nota de la placa de la puerta
 * ("Vuelvo a las 3"). Las notas de trabajo viven en el PC.
 */
export function MyOfficePanel() {
  const myOffice = useOfficeStore(useShallow(selectMyOffice));
  const zoneId = useOfficeStore((s) => s.zone?.id);
  const decorating = useOfficeStore((s) => s.decorating);
  const setDecorating = useOfficeStore((s) => s.setDecorating);
  // En el celular no caben el chat y este panel a la vez: el chat abierto tiene prioridad.
  const chatOpen = useOfficeStore((s) => s.chatOpen);
  // Decorando, el panel del editor ocupa su lugar.
  if (!myOffice || zoneId !== myOffice.zoneId || decorating) return null;

  return (
    <section
      className={`cozy-panel absolute right-3 bottom-28 z-10 flex items-center gap-3 px-4 py-3 xl:bottom-16 ${chatOpen ? "max-md:hidden" : ""}`}
    >
      <div className="min-w-0">
        <p className="text-[12px] text-cozy-ink-soft">Tu oficina</p>
        <p className="truncate text-[17px] font-semibold">{myOffice.name}</p>
      </div>
      <button onClick={() => setDecorating(true)} className="cozy-btn shrink-0" title="Poner, mover y quitar muebles; elegir piso y papel tapiz">
        <PixelIcon name="home" size={14} />
        Decorar
      </button>
      <button
        onClick={() => sendOfficeLock(!myOffice.locked)}
        data-on={myOffice.locked}
        className="cozy-btn shrink-0"
        title={myOffice.locked ? "Nadie puede entrar sin tocar la puerta" : "Cualquiera puede entrar"}
      >
        <PixelIcon name={myOffice.locked ? "lock" : "unlock"} size={14} />
        {myOffice.locked ? "Cerrada" : "Abierta"}
      </button>
      <DoorNote note={myOffice.note} />
    </section>
  );
}

/** La nota de la placa: se escribe y se guarda con Enter o al salir del campo. */
function DoorNote({ note }: { note: string }) {
  const [draft, setDraft] = useState(note);
  const setTyping = useOfficeStore((s) => s.setTyping);
  useEffect(() => setDraft(note), [note]);
  const save = () => draft.trim() !== note && sendOfficeNote(draft);
  return (
    <label className="flex min-w-0 flex-col gap-0.5 text-[12px] text-cozy-ink-soft">
      Nota en la puerta
      <input
        value={draft}
        maxLength={OFFICE_NOTE_MAX}
        placeholder="Vuelvo a las 3…"
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setTyping(true)}
        onBlur={() => {
          setTyping(false);
          save();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(note);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="cozy-input w-40 px-2 py-1 text-[13px]"
      />
    </label>
  );
}
