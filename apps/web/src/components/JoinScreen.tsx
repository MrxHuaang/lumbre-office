"use client";

import { HUMAN_AVATARS, type HumanAvatar } from "@hyvento/shared";
import { useState } from "react";
import type { Profile } from "@/game/store";
import { AvatarPreview } from "./AvatarPreview";

interface JoinScreenProps {
  initial: Profile | null;
  onJoin: (p: Profile) => void;
  title?: string;
  submitLabel?: string;
  saving?: boolean;
  error?: string | null;
}

export function JoinScreen({ initial, onJoin, title = "Entrar a la oficina", submitLabel = "Entrar", saving = false, error }: JoinScreenProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [avatar, setAvatar] = useState<HumanAvatar>(initial?.avatar ?? "ada");
  const trimmed = name.trim();

  return (
    <main className="flex min-h-full items-center justify-center p-4">
      <form
        className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-2xl sm:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed && !saving) onJoin({ name: trimmed, avatar });
        }}
      >
        <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">Hyvento</p>
        <h1 className="mt-1 text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted">Elige cómo te verán tus compañeros.</p>

        <div className="mt-6 flex items-center gap-4 rounded-xl bg-panel-2 p-4">
          <div className="rounded-lg bg-ink/60 p-1">
            <AvatarPreview avatar={avatar} scale={3} walking />
          </div>
          <label className="flex-1">
            <span className="text-xs font-medium text-muted">Nombre visible</span>
            <input
              autoFocus
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Juanjo"
              className="mt-1 w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
        </div>

        <fieldset className="mt-5">
          <legend className="text-xs font-medium text-muted">Avatar</legend>
          <div className="mt-2 grid grid-cols-6 gap-2">
            {HUMAN_AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                aria-label={`Avatar ${a}`}
                aria-pressed={a === avatar}
                onClick={() => setAvatar(a)}
                className={`flex items-center justify-center rounded-lg border p-1 transition ${
                  a === avatar ? "border-accent bg-accent/10" : "border-line bg-panel-2 hover:border-muted"
                }`}
              >
                <AvatarPreview avatar={a} scale={1.5} />
              </button>
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!trimmed || saving}
          className="mt-6 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Guardando…" : submitLabel}
        </button>
      </form>
    </main>
  );
}
