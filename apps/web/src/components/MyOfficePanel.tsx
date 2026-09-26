"use client";

import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { sendOfficeLock } from "@/game/network";
import { selectMyOffice, useOfficeStore } from "@/game/store";

type SaveState = "idle" | "saving" | "saved" | "error";

/** Panel personal: aparece dentro de tu oficina (candado + notas). */
export function MyOfficePanel() {
  const myOffice = useOfficeStore(useShallow(selectMyOffice));
  const zoneId = useOfficeStore((s) => s.zone?.id);
  const setTyping = useOfficeStore((s) => s.setTyping);
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
    <section className="absolute bottom-3 left-3 w-[min(300px,calc(100%-1.5rem))] rounded-2xl border border-line bg-panel/92 p-3 shadow-2xl backdrop-blur">
      <header className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.18em] text-accent uppercase">Tu oficina</p>
          <p className="text-sm font-semibold">{myOffice.name}</p>
        </div>
        <button
          onClick={() => sendOfficeLock(!myOffice.locked)}
          aria-pressed={myOffice.locked}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            myOffice.locked ? "bg-[#ffb4a2]/15 text-[#ffb4a2]" : "bg-panel-2 text-text hover:bg-line"
          }`}
          title={myOffice.locked ? "Nadie puede entrar sin tocar la puerta" : "Cualquiera puede entrar"}
        >
          {myOffice.locked ? "🔒 Cerrada" : "🔓 Abierta"}
        </button>
      </header>
      <label className="mt-3 block">
        <span className="flex justify-between text-xs text-muted">
          Notas
          <span>{save === "saving" ? "Guardando…" : save === "saved" ? "Guardado" : save === "error" ? "Error al guardar" : ""}</span>
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
          className="mt-1 w-full resize-none rounded-lg border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>
    </section>
  );
}
