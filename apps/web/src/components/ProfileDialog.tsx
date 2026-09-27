"use client";

import { useState } from "react";
import { sendProfileChanged } from "@/game/network";
import type { Profile } from "@/game/store";
import { saveProfile } from "@/lib/profile";
import { CharacterEditor, type Appearance } from "./CharacterEditor";
import { OfficeDialog } from "./OfficeDialog";

/**
 * Editar el perfil (nombre y personaje) o solo el personaje, sin salir de la cabaña: se guarda y
 * todos ven el cambio al instante. Es el mismo editor que el probador de la tienda (`FittingPanel`).
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
      footer={
        <>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !trimmed}
            className="cozy-btn cozy-btn-primary px-5 py-2.5 text-[15px]"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button type="button" onClick={onClose} className="cozy-btn px-5 py-2.5 text-[15px]">
            Cancelar
          </button>
          {error && (
            <p role="alert" className="text-[14px] font-semibold text-cozy-red-deep">
              {error}
            </p>
          )}
        </>
      }
    >
      {/* El -1rem deja la vista previa pegada arriba del todo al desplazar (compensa el py-4). */}
      <div className="cozy-scroll min-h-0 overflow-y-auto px-4 py-4 [--editor-sticky-top:-1rem]">
        {withName && (
          <label className="mb-5 flex max-w-sm flex-col gap-2 text-[14px] font-semibold">
            Tu nombre
            <input
              autoFocus
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void save()}
              placeholder="¿Cómo te llaman?"
              className="cozy-input px-3.5 py-2.5 text-[16px] font-normal"
            />
          </label>
        )}
        <CharacterEditor value={appearance} onChange={setAppearance} />
      </div>
    </OfficeDialog>
  );
}
