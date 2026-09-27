"use client";

// Rediseño: usar lo que se tiene en la mano (F, o el casillero junto a la barra de abajo) y la ayuda "E"
// junto a un mueble que se usa (tele, lámparas, tocadiscos, piano, guitarra, gato).
import { drawHeldItem } from "@hyvento/map/art";
import { consumeActionOf, heldParts, menuItem, parseHeldLeft } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { sendFurnitureUse, sendUseHeld } from "@/game/network";
import { useOfficeStore } from "@/game/store";

const VERB = { smoke: "Fumar", sip: "Tomar", bite: "Comer" } as const;

/** Casillero de lo que tengo en la mano, al lado de la barra de herramientas (como el inventario de Stardew). */
export function HeldSlot() {
  const mine = useOfficeStore(
    useShallow((s) => {
      const p = s.sessionId ? s.players[s.sessionId] : undefined;
      return { held: p?.held ?? "", left: p?.heldLeft ?? "" };
    }),
  );
  const panel = useOfficeStore((s) => s.panel);
  const pcOn = useOfficeStore((s) => s.pcOn);
  const parts = heldParts(mine.held);
  const left = parseHeldLeft(mine.left);
  const total = left.reduce((a, b) => a + b, 0);
  if (!parts.length || total <= 0 || pcOn) return null;
  // Se muestra la mano que tiene más usos (en los combos se alterna: lo decide el servidor).
  const i = left.length > 1 && (left[1] ?? 0) > (left[0] ?? 0) ? 1 : 0;
  const art = parts[i]!;
  const verb = parts.length > 1 ? "Usar" : VERB[consumeActionOf(art)];
  const name = menuItem(mine.held)?.name ?? "";
  return (
    <button
      type="button"
      onClick={() => sendUseHeld()}
      disabled={Boolean(panel)}
      title={`${verb}: ${name} (F)`}
      aria-label={`${verb} ${name}, quedan ${total} usos`}
      className="cozy-panel absolute bottom-3 left-[calc(50%+188px)] z-10 flex items-center gap-2 p-2.5 max-sm:bottom-[6.25rem] max-sm:left-3"
    >
      <span className="cozy-btn relative h-[58px] w-[62px] flex-col gap-0.5 p-1 text-[12px] max-sm:h-12 max-sm:w-12">
        <kbd className="cozy-kbd absolute top-0.5 left-0.5 px-1 text-[10px] leading-none">F</kbd>
        <HeldArt art={art} left={left[i] ?? 1} />
        <span className="max-sm:hidden">{verb}</span>
        {/* Usos que quedan, como la cantidad de un objeto en el inventario. */}
        <span className="absolute right-0.5 bottom-0 text-[12px] font-semibold text-cozy-ink [text-shadow:1px_1px_0_var(--color-cozy-paper-light)]">
          {total}
        </span>
      </span>
    </button>
  );
}

const artCache = new Map<string, string>();

function HeldArt({ art, left }: { art: string; left: number }) {
  const key = `${art}:${left}`;
  const [src, setSrc] = useState(() => artCache.get(key) ?? null);
  useEffect(() => {
    const cached = artCache.get(key);
    if (cached) return setSrc(cached);
    const url = toHtmlCanvas(drawHeldItem(art, { left })).toDataURL();
    artCache.set(key, url);
    setSrc(url);
  }, [art, left, key]);
  return src ? <img src={src} alt="" className="h-6 w-8 object-contain [image-rendering:pixelated]" /> : <span className="h-6" />;
}

/** Ayuda junto a un mueble que se usa: tecla E o clic. */
export function UsablePrompt() {
  const usable = useOfficeStore((s) => s.usable);
  const panel = useOfficeStore((s) => s.panel);
  const door = useOfficeStore((s) => s.doorPrompt);
  const decorating = useOfficeStore((s) => s.decorating);
  if (!usable || panel || door || decorating) return null;
  return (
    <button
      type="button"
      onClick={() => sendFurnitureUse(usable.type, usable.x, usable.y)}
      className="cozy-chip absolute bottom-28 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 px-3 py-1.5 text-[14px]"
    >
      <kbd className="cozy-kbd">E</kbd>
      {usable.label}
    </button>
  );
}
