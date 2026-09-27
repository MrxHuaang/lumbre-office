"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getSfxSettings, setSfxSettings, sfx, subscribeSfx, type SfxSettings } from "@/game/sfx";
import { PixelIcon } from "./Cozy";

/** En el servidor no hay navegador: se dibuja con lo de siempre y se corrige al hidratar. */
const SERVER_SETTINGS: SfxSettings = { volume: 0.7, muted: false };

/** Botón del HUD para los efectos de sonido: silenciar y elegir el volumen (se recuerda en este navegador). */
export function SoundControl() {
  const settings = useSyncExternalStore(subscribeSfx, getSfxSettings, () => SERVER_SETTINGS);
  const [open, setOpen] = useState(false);
  const silent = settings.muted || settings.volume <= 0;
  const percent = Math.round(settings.volume * 100);
  const box = useRef<HTMLDivElement>(null);

  // Se cierra al tocar fuera.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Efectos de sonido"
        title={silent ? "Efectos de sonido: en silencio" : `Efectos de sonido: ${percent}%`}
        className="cozy-btn h-[34px] w-[34px] p-0"
      >
        <PixelIcon name="sound" size={16} off={silent} />
      </button>
      {open && (
        <div className="cozy-panel absolute top-full right-0 z-30 mt-3 flex w-56 flex-col gap-2.5 p-3 text-[14px]">
          <span className="font-semibold">Efectos de sonido</span>
          <label className="flex items-center gap-2.5">
            <span className="sr-only">Volumen</span>
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
            <span className="w-9 text-right tabular-nums">{percent}%</span>
          </label>
          <button
            onClick={() => setSfxSettings({ muted: !settings.muted })}
            aria-pressed={settings.muted}
            className="cozy-btn justify-center"
          >
            {settings.muted ? "Activar sonidos" : "Silenciar"}
          </button>
        </div>
      )}
    </div>
  );
}
