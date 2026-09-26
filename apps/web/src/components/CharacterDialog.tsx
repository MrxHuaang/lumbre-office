"use client";

import { useEffect, useState } from "react";
import { sendAppearance } from "@/game/network";
import { useOfficeStore, type Profile } from "@/game/store";
import { saveProfile } from "@/lib/profile";
import { RISO } from "@/lib/riso";
import { CharacterEditor, type Appearance } from "./CharacterEditor";

/** Cambiar de personaje sin salir de la oficina: se guarda y todos lo ven al instante. */
export function CharacterDialog({
  profile,
  onClose,
  onSaved,
}: {
  profile: Profile;
  onClose: () => void;
  onSaved: (p: Profile) => void;
}) {
  const [appearance, setAppearance] = useState<Appearance>({ avatar: profile.avatar, look: profile.look });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mientras está abierto, el teclado es del editor (no mueve al personaje).
  useEffect(() => {
    const { setTyping } = useOfficeStore.getState();
    setTyping(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      setTyping(false);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const next = { ...profile, ...appearance };
      await saveProfile(next);
      sendAppearance(appearance);
      onSaved(next);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
      setSaving(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-40 grid place-items-center bg-riso-navy/45 p-3 sm:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal
        aria-label="Tu personaje"
        className="riso-panel flex max-h-full w-full max-w-3xl flex-col"
        style={{ "--riso-shadow": RISO.pink } as React.CSSProperties}
      >
        <header className="flex items-center justify-between gap-3 border-b-2 border-riso-navy px-5 py-3">
          <h2 className="font-display text-[17px]">Tu personaje</h2>
          <button type="button" onClick={onClose} className="text-[13px] underline-offset-2 hover:underline">
            cerrar
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto px-5 py-4">
          <CharacterEditor value={appearance} onChange={setAppearance} />
        </div>
        <footer className="flex flex-wrap items-center gap-4 border-t-2 border-riso-navy px-5 py-3">
          <button type="button" onClick={save} disabled={saving} className="riso-pill riso-press bg-riso-pink px-5 py-2.5">
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button type="button" onClick={onClose} className="text-[13px] underline underline-offset-2">
            Cancelar
          </button>
          {error && (
            <p role="alert" className="text-[13px] font-semibold text-riso-pink-deep">
              {error}
            </p>
          )}
        </footer>
      </section>
    </div>
  );
}
