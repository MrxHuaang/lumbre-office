"use client";

import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { sendOfficeLock } from "@/game/network";
import { selectMyOffice, useOfficeStore } from "@/game/store";
import { RISO } from "@/lib/riso";

type SaveState = "idle" | "saving" | "saved" | "error";

/** Panel personal: aparece dentro de tu oficina (candado + notas). */
export function MyOfficePanel() {
  const myOffice = useOfficeStore(useShallow(selectMyOffice));
  const zoneId = useOfficeStore((s) => s.zone?.id);
  const setTyping = useOfficeStore((s) => s.setTyping);
  // En el celular no caben el chat y este panel a la vez: el chat abierto tiene prioridad.
  const chatOpen = useOfficeStore((s) => s.chatOpen);
  const inside = Boolean(myOffice && zoneId === myOffice.zoneId);

  const [notes, setNotes] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!inside || notes !== null) return;
    fetch("/api/office", { cache: "no-store" })
      .then((r) => r.json())
      .then((b: { office?: { notes: string } | null }) => setNotes(b.office?.notes ?? ""))
      .catch(() => setNotes(""));
  }, [inside, notes]);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!myOffice || !inside) return null;

  const onChange = (value: string) => {
    setNotes(value);
    setSave("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await fetch("/api/office", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: value }),
      }).catch(() => null);
      setSave(res?.ok ? "saved" : "error");
    }, 700);
  };

  return (
    <section
      className={`riso-panel absolute right-3 bottom-24 z-10 w-[min(300px,calc(100%-1.5rem))] xl:bottom-14 ${chatOpen ? "max-md:hidden" : ""}`}
      style={{ "--riso-shadow": RISO.blue } as React.CSSProperties}
    >
      <header className="flex items-center justify-between gap-2 border-b-2 border-riso-navy px-3.5 py-2.5">
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
      </header>
      <label className="block px-3.5 pt-2.5 pb-3.5">
        <span className="flex justify-between text-[11px] font-semibold tracking-[0.12em] uppercase">
          Notas
          <span className="font-normal tracking-normal text-riso-muted normal-case">
            {save === "saving" ? "Guardando…" : save === "saved" ? "Guardado" : save === "error" ? "Error al guardar" : ""}
          </span>
        </span>
        <textarea
          value={notes ?? ""}
          disabled={notes === null}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setTyping(true)}
          onBlur={() => setTyping(false)}
          maxLength={5000}
          rows={4}
          placeholder="Pendientes, links, ideas…"
          className="riso-input mt-1.5 w-full resize-none px-3 py-2 text-[13px]"
        />
      </label>
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
