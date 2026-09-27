"use client";

import { useState } from "react";
import type { Profile } from "@/game/store";
import { CharacterEditor, type Appearance } from "./CharacterEditor";
import { CozyTitle, PixelIcon } from "./Cozy";

interface JoinScreenProps {
  initial: Profile | null;
  onJoin: (p: Profile) => void;
  /** "Volver": cerrar sesión (primer ingreso) o regresar a la oficina sin guardar. */
  onBack: () => void;
  /** Primer ingreso (paso 2 de 2 tras el login) o edición del perfil desde la oficina. */
  firstTime: boolean;
  saving?: boolean;
  error?: string | null;
}

export function JoinScreen({ initial, onJoin, onBack, firstTime, saving = false, error }: JoinScreenProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [appearance, setAppearance] = useState<Appearance>({
    avatar: initial?.avatar ?? "ada",
    look: initial?.look ?? null,
  });
  const trimmed = name.trim();

  const actions = (
    <div className="flex flex-wrap items-center gap-3.5">
      <button
        type="submit"
        disabled={!trimmed || saving}
        className="cozy-btn cozy-btn-primary px-6 py-3.5 text-[17px]"
      >
        {saving ? "Guardando…" : firstTime ? "Entrar a la cabaña" : "Guardar y entrar"}
      </button>
      <button type="button" onClick={onBack} className="cozy-btn px-6 py-3.5 text-[17px]">
        Volver
      </button>
    </div>
  );

  return (
    <form
      className="cozy-void flex min-h-full flex-col gap-9 px-4 py-8 font-pixel text-cozy-ink sm:px-10 md:px-14 md:py-10"
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed && !saving) onJoin({ name: trimmed, ...appearance });
      }}
    >
      <header className="flex items-center justify-between gap-4">
        <div className="cozy-panel flex items-center gap-2 px-3.5 py-2">
          <PixelIcon name="cabin" size={18} color="var(--color-cozy-wood)" />
          <span className="text-[18px] leading-none font-semibold">Hyvento</span>
        </div>
        <span className="cozy-chip px-3 py-1.5 text-[14px]">{firstTime ? "Paso 2 de 2" : "Tu perfil"}</span>
      </header>

      <div className="grid flex-1 items-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] md:gap-14">
        <div className="flex flex-col gap-7">
          <div className="flex flex-col gap-4">
            <CozyTitle className="text-[clamp(44px,5.5vw,84px)] leading-[0.95]">{firstTime ? "Tu personaje" : "Tu perfil"}</CozyTitle>
            <p className="text-[17px] text-cozy-paper-dark">Elige cómo te verán tus compañeros en la cabaña.</p>
          </div>

          <label className="flex flex-col gap-2 text-[15px] font-semibold text-cozy-paper-light">
            Tu nombre
            <input
              autoFocus
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
              placeholder="¿Cómo te llaman?"
              className="cozy-input px-4 py-3 text-xl font-normal"
            />
          </label>

          {error && (
            <p role="alert" className="cozy-panel px-5 py-3 text-[15px] text-cozy-red-deep">
              {error}
            </p>
          )}

          <div className="max-md:hidden">{actions}</div>
        </div>

        <fieldset className="cozy-panel min-w-0 self-start p-3 sm:p-5">
          <legend className="sr-only">Personaje</legend>
          <CharacterEditor value={appearance} onChange={setAppearance} />
        </fieldset>

        <div className="md:hidden">{actions}</div>
      </div>
    </form>
  );
}
