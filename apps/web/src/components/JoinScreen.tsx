"use client";

import { useState } from "react";
import type { Profile } from "@/game/store";
import { RISO } from "@/lib/riso";
import { CharacterEditor, type Appearance } from "./CharacterEditor";
import { Overprint, RisoLogo } from "./Riso";

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
        className="riso-cta border-2 border-riso-navy bg-riso-pink text-riso-navy"
      >
        {saving ? "Guardando…" : firstTime ? "Entrar a la oficina →" : "Guardar y entrar →"}
      </button>
      <button type="button" onClick={onBack} className="p-[18px] text-sm underline underline-offset-2">
        Volver
      </button>
    </div>
  );

  return (
    <form
      className="riso-grain flex min-h-full flex-col gap-9 px-6 py-8 sm:px-10 md:px-14 md:py-10"
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed && !saving) onJoin({ name: trimmed, ...appearance });
      }}
    >
      <header className="flex items-center justify-between gap-4">
        <RisoLogo dots={false} />
        <span className="text-[13px] text-riso-muted">{firstTime ? "Paso 2 de 2" : "Tu perfil"}</span>
      </header>

      <div className="grid flex-1 items-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] md:gap-14">
        <div className="flex flex-col gap-7">
          <div className="flex flex-col gap-4">
            <Overprint
              as="h1"
              lines={firstTime ? ["Elige tu", "tinta"] : ["Tu", "perfil"]}
              back={RISO.pink}
              front={RISO.blue}
              offset={[4, 3]}
              className="text-[clamp(48px,6vw,96px)] leading-[0.88] tracking-[-0.03em]"
            />
            <p className="text-[15px]">Elige cómo te verán tus compañeros.</p>
          </div>

          <label className="flex flex-col gap-2 text-xs font-semibold tracking-[0.12em] uppercase">
            Tu nombre
            <input
              autoFocus
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
              placeholder="¿Cómo te llaman?"
              className="riso-input px-4 py-3.5 text-xl font-normal tracking-normal normal-case"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="riso-panel px-4 py-3 text-sm"
              style={{ "--riso-shadow": RISO.pink } as React.CSSProperties}
            >
              {error}
            </p>
          )}

          <div className="max-md:hidden">{actions}</div>
        </div>

        <fieldset className="min-w-0 self-start">
          <legend className="sr-only">Personaje</legend>
          <CharacterEditor value={appearance} onChange={setAppearance} />
        </fieldset>

        <div className="md:hidden">{actions}</div>
      </div>
    </form>
  );
}
