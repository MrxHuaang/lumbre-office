"use client";

import { HUMAN_AVATARS, type HumanAvatar } from "@hyvento/shared";
import { useState } from "react";
import type { Profile } from "@/game/store";
import { RISO } from "@/lib/riso";
import { Overprint, RisoLogo, Sprite } from "./Riso";

/** Tinta de la tarjeta de cada personaje (semitono + disco). */
const AVATAR_INK: Record<HumanAvatar, string> = {
  ada: RISO.pink,
  bruno: RISO.blue,
  carla: RISO.yellow,
  dario: RISO.green,
  eva: RISO.orange,
  fede: RISO.violet,
};

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
  const [avatar, setAvatar] = useState<HumanAvatar>(initial?.avatar ?? "ada");
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
        if (trimmed && !saving) onJoin({ name: trimmed, avatar });
      }}
    >
      <header className="flex items-center justify-between gap-4">
        <RisoLogo dots={false} />
        <span className="text-[13px] text-riso-muted">{firstTime ? "Paso 2 de 2" : "Tu perfil"}</span>
      </header>

      <div className="grid flex-1 items-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:gap-14">
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

        <fieldset className="min-w-0">
          <legend className="sr-only">Avatar</legend>
          <div className="grid grid-cols-3 gap-3 sm:gap-[18px]">
            {HUMAN_AVATARS.map((a) => {
              const selected = a === avatar;
              const ink = AVATAR_INK[a];
              return (
                <button
                  key={a}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setAvatar(a)}
                  className="flex aspect-[1/1.1] cursor-pointer flex-col overflow-hidden border-2 border-riso-navy bg-riso-cream p-0 transition-[transform,box-shadow] duration-[120ms]"
                  style={{
                    boxShadow: selected ? `6px 6px 0 ${RISO.navy}` : "none",
                    transform: selected ? "translate(-3px, -3px)" : "none",
                  }}
                >
                  <span
                    className="relative grid flex-1 place-items-center"
                    style={{ background: `radial-gradient(circle, ${ink} 2px, transparent 2.4px) 0 0 / 9px 9px` }}
                  >
                    <span
                      className="absolute aspect-square w-[62%] rounded-full opacity-90 mix-blend-multiply"
                      style={{ background: ink }}
                    />
                    <Sprite avatar={a} className="relative w-[46%]" />
                  </span>
                  <span className="flex items-center justify-between border-t-2 border-riso-navy px-3 py-2.5 text-[13px] font-semibold">
                    <span className="capitalize">{a}</span>
                    <span aria-hidden>{selected ? "●" : "○"}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="md:hidden">{actions}</div>
      </div>
    </form>
  );
}
