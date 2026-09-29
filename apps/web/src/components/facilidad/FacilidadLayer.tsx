"use client";

// Todo lo de "facilidad de uso" montado junto a la cabaña (Office.tsx): la paleta de comandos (Ctrl+K /
// ⌘K), los ajustes, la ayuda de atajos (?), el mapa de la cabaña, los controles táctiles, los avisos del
// viaje rápido y la marca de "menos movimiento". Y dos piezas para el HUD: `GameOnly` (lo que se esconde
// en el modo trabajo) y `PaletteButton` (la lupa, para abrir la paleta sin teclado).
import { useEffect, type ReactNode } from "react";
import { useFacilidadStore } from "@/game/facilidad";
import { useOfficeStore } from "@/game/store";
import { bindViajeNet } from "@/game/viaje";
import { applyMotionAttr, usePrefsStore } from "@/lib/prefs";
import { isTypingTarget, paletteKey } from "@/lib/shortcuts";
import { PixelIcon } from "../Cozy";
import { CommandPalette } from "../palette/CommandPalette";
import { useDefaultCommands, type DefaultCommandProps } from "../palette/defaultCommands";
import { SettingsPanel } from "./SettingsPanel";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { TouchControls } from "./TouchControls";
import { WorldMap } from "./WorldMap";

export function FacilidadLayer(props: DefaultCommandProps) {
  const open = useFacilidadStore((s) => s.open);
  const close = useFacilidadStore((s) => s.close);
  useDefaultCommands(props);
  useEffect(() => bindViajeNet(), []);
  useEffect(() => {
    applyMotionAttr();
    return () => {
      delete document.documentElement.dataset.motion;
    };
  }, []);
  useHotkeys();
  // Con el PC prendido la paleta y lo demás se cierran (el PC tiene su propio teclado).
  const pcOn = useOfficeStore((s) => s.pcOn);
  useEffect(() => {
    if (pcOn) useFacilidadStore.getState().close();
  }, [pcOn]);
  return (
    <>
      <TouchControls />
      {open === "palette" && <CommandPalette onClose={close} />}
      {open === "settings" && <SettingsPanel onClose={close} />}
      {open === "shortcuts" && <ShortcutsHelp onClose={close} />}
      {open === "worldmap" && <WorldMap onClose={close} />}
    </>
  );
}

/**
 * Ctrl+K / ⌘K abre y cierra la paleta (también escribiendo en el chat: es el atajo para "ir a algo"), y
 * ? abre la ayuda de atajos con el juego libre. No usan Tab (la barra de la mochila) ni letras sueltas
 * del juego (E, F, T, P, N, I, R, B).
 */
function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const f = useFacilidadStore.getState();
      const s = useOfficeStore.getState();
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        if (s.pcOn) return;
        e.preventDefault();
        if (!e.repeat) f.toggle("palette");
        return;
      }
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat) {
        if (s.typing || s.pcOn || isTypingTarget(e.target) || (f.open && f.open !== "shortcuts")) return;
        e.preventDefault();
        f.toggle("shortcuts");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Lo de juego del HUD (puntos, avisos de logros): no se ve en el modo trabajo. */
export function GameOnly({ children }: { children: ReactNode }) {
  const work = usePrefsStore((s) => s.workMode);
  return work ? null : <>{children}</>;
}

/** La lupa del HUD: abre la paleta (en el celular no hay Ctrl+K). En el modo trabajo, con el maletín. */
export function PaletteButton() {
  const work = usePrefsStore((s) => s.workMode);
  return (
    <button
      type="button"
      onClick={() => useFacilidadStore.getState().toggle("palette")}
      className="cozy-btn h-[34px] gap-1.5 px-2"
      title={`Buscar personas, lugares y acciones (${paletteKey()})`}
      aria-label="Buscar personas, lugares y acciones"
      aria-keyshortcuts="Control+K Meta+K"
    >
      <PixelIcon name="search" size={14} />
      <kbd className="cozy-kbd text-[11px] max-lg:hidden">{paletteKey()}</kbd>
      {work && <PixelIcon name="briefcase" size={12} color="var(--color-cozy-wood)" />}
    </button>
  );
}
