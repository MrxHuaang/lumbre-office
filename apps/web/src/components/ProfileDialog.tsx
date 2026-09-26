"use client";

import { useState } from "react";
import { sendProfileChanged } from "@/game/network";
import type { Profile } from "@/game/store";
import { saveProfile } from "@/lib/profile";
import { RISO } from "@/lib/riso";
import { CharacterEditor, type Appearance } from "./CharacterEditor";
import { OfficeDialog } from "./OfficeDialog";

/**
 * Editar el perfil (nombre y personaje) o solo el personaje, sin salir de la oficina: se guarda y
 * todos ven el cambio al instante.
 */
export function ProfileDialog({
  profile,
  withName,
  onClose,
  onSaved,
}: {
  profile: Profile;
  /** true = "Editar perfil" (con el nombre); false = "Mi personaje". */
  withName: boolean;
  onClose: () => void;
  onSaved: (p: Profile) => void;
}) {
  const [name, setName] = useState(profile.name);
  const [appearance, setAppearance] = useState<Appearance>({ avatar: profile.avatar, look: profile.look });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();

  const save = async () => {
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const next = { name: trimmed, ...appearance };
      await saveProfile(next);
      sendProfileChanged();
      onSaved(next);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
      setSaving(false);
    }
  };

  return (
    <OfficeDialog
      title={withName ? "Editar perfil" : "Tu personaje"}
      onClose={onClose}
      shadow={RISO.pink}
      footer={
        <>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !trimmed}
            className="riso-pill riso-press bg-riso-pink px-5 py-2.5"
          >
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
        </>
      }
    >
      <div className="min-h-0 overflow-y-auto px-5 py-4">
        {withName && (
          <label className="mb-5 flex max-w-sm flex-col gap-2 text-xs font-semibold tracking-[0.12em] uppercase">
            Tu nombre
            <input
              autoFocus
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void save()}
              placeholder="¿Cómo te llaman?"
              className="riso-input px-3.5 py-2.5 text-base font-normal tracking-normal normal-case"
            />
          </label>
        )}
        <CharacterEditor value={appearance} onChange={setAppearance} />
      </div>
    </OfficeDialog>
  );
}
