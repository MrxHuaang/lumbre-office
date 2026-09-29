"use client";

import { useSyncExternalStore } from "react";
import { getMixer, MIXER_DEFAULTS, setMixer, SOUND_CATEGORIES, subscribeMixer, type MixerSettings, type SoundCategory } from "@/game/mixer";
import { sfx } from "@/game/sfx";
import { PixelIcon } from "./Cozy";

/** El mezclador para React (en el servidor, lo de fábrica; se corrige al hidratar). */
export function useMixer(): MixerSettings {
  return useSyncExternalStore(subscribeMixer, getMixer, () => MIXER_DEFAULTS);
}

/**
 * El volumen general (va en el menú, sección Ajustes): el botón silencia todo y el deslizador elige el
 * volumen. Los de cada tipo de sonido están en Ajustes (`MixerSliders`). Se recuerda en este navegador.
 */
export function SoundSettings() {
  const m = useMixer();
  const silent = m.muted || m.master <= 0;
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <button
        type="button"
        onClick={() => setMixer({ muted: !m.muted })}
        aria-pressed={m.muted}
        aria-label={m.muted ? "Activar el sonido" : "Silenciar todo el sonido"}
        title={m.muted ? "Activar sonidos" : "Silenciar"}
        className="cozy-btn cozy-hit h-7 w-7 shrink-0 p-0"
      >
        <PixelIcon name="sound" size={14} off={silent} />
      </button>
      <VolumeSlider label="Volumen general" value={m.master} disabled={m.muted} onChange={(v) => setMixer({ master: v })} />
    </div>
  );
}

/** Un volumen por tipo de sonido (música, ambiente, efectos, avisos), debajo del general. */
export function MixerSliders() {
  const m = useMixer();
  return (
    <div className="flex flex-col gap-2">
      <SoundSettings />
      {SOUND_CATEGORIES.map((c) => (
        <div key={c.id} className="flex flex-col gap-0.5 pl-9 text-[13px]">
          <span className="flex items-baseline justify-between gap-2">
            <span>{c.label}</span>
            <span className="truncate text-[11px] text-cozy-ink-soft">{c.hint}</span>
          </span>
          <VolumeSlider label={`Volumen de ${c.label.toLowerCase()}`} value={m[c.id]} disabled={m.muted} onChange={(v) => setMixer({ [c.id]: v } as Partial<Record<SoundCategory, number>>)} probe={c.id} />
        </div>
      ))}
    </div>
  );
}

function VolumeSlider({ label, value, disabled, onChange, probe }: { label: string; value: number; disabled: boolean; onChange: (v: number) => void; probe?: SoundCategory }) {
  const percent = Math.round(value * 100);
  // Al soltar se oye cómo quedó (los avisos con un aviso; lo demás, con un clic de la interfaz).
  const hear = () => (probe === "notify" || !probe ? sfx.notice("info") : sfx.click());
  return (
    <label className="flex min-w-0 flex-1 items-center gap-2">
      <span className="sr-only">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={percent}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        onPointerUp={hear}
        onKeyUp={hear}
        className="min-w-0 flex-1 accent-[var(--color-cozy-wood)] disabled:opacity-50"
      />
      <span className="w-9 text-right text-cozy-ink-soft tabular-nums">{disabled ? "—" : `${percent}%`}</span>
    </label>
  );
}
