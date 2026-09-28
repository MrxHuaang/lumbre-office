"use client";

import { useSyncExternalStore } from "react";
import { getSfxSettings, setSfxSettings, sfx, subscribeSfx, type SfxSettings } from "@/game/sfx";
import { PixelIcon } from "./Cozy";

/** En el servidor no hay navegador: se dibuja con lo de siempre y se corrige al hidratar. */
const SERVER_SETTINGS: SfxSettings = { volume: 0.7, muted: false };

/**
 * Los efectos de sonido (van en el menú, sección Ajustes): el botón silencia y el deslizador elige el
 * volumen. Se recuerda en este navegador.
 */
export function SoundSettings() {
  const settings = useSyncExternalStore(subscribeSfx, getSfxSettings, () => SERVER_SETTINGS);
  const silent = settings.muted || settings.volume <= 0;
  const percent = Math.round(settings.volume * 100);

  return (
    <div className="flex items-center gap-2 text-[13px]">
      <button
        type="button"
        onClick={() => setSfxSettings({ muted: !settings.muted })}
        aria-pressed={settings.muted}
        aria-label={settings.muted ? "Activar los efectos de sonido" : "Silenciar los efectos de sonido"}
        title={settings.muted ? "Activar sonidos" : "Silenciar"}
        className="cozy-btn h-7 w-7 shrink-0 p-0"
      >
        <PixelIcon name="sound" size={14} off={silent} />
      </button>
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <span className="sr-only">Volumen de los efectos</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={percent}
          disabled={settings.muted}
          onChange={(e) => setSfxSettings({ volume: Number(e.target.value) / 100 })}
          // Al soltar se oye cómo quedó.
          onPointerUp={() => sfx.notice("info")}
          onKeyUp={() => sfx.notice("info")}
          className="min-w-0 flex-1 accent-[var(--color-cozy-wood)] disabled:opacity-50"
        />
        <span className="w-9 text-right text-cozy-ink-soft tabular-nums">{settings.muted ? "—" : `${percent}%`}</span>
      </label>
    </div>
  );
}
