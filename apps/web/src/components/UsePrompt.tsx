"use client";

// Rediseño: usar lo que se tiene en la mano (F, o el casillero junto a la barra de abajo), brindar (B,
// al lado del casillero) y la ayuda "E" junto a un mueble que se usa (tele, lámparas, tocadiscos, piano…).
import { drawHeldItem } from "@hyvento/map/art";
import { consumeActionOf, EMPTY_CAN, FREE_NAMES, heldParts, isHuertoTool, menuItem, parseHeldLeft, sombreroItem } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { sendFurnitureUse, sendToast, sendUseHeld } from "@/game/network";
import { useOfficeStore } from "@/game/store";

const VERB = { smoke: "Fumar", sip: "Tomar", bite: "Comer", spoon: "Comer", sniff: "Esnifar" } as const;

/**
 * Casillero de lo que tengo en la mano, al final de la barra de herramientas (como el inventario de
 * Stardew): va dentro de MediaControls, así se acomoda solo cuando cambia el ancho de la barra.
 */
export function HeldSlot() {
  const mine = useOfficeStore(
    useShallow((s) => {
      const p = s.sessionId ? s.players[s.sessionId] : undefined;
      return { held: p?.held ?? "", left: p?.heldLeft ?? "" };
    }),
  );
  const panel = useOfficeStore((s) => s.panel);
  const pcOn = useOfficeStore((s) => s.pcOn);
  const toast = useOfficeStore((s) => s.toastPrompt);
  const parts = heldParts(mine.held);
  const left = parseHeldLeft(mine.left);
  const total = left.reduce((a, b) => a + b, 0);
  if (!parts.length || total <= 0 || pcOn) return null;
  // Se muestra la mano que tiene más usos (en los combos se alterna: lo decide el servidor).
  const i = left.length > 1 && (left[1] ?? 0) > (left[0] ?? 0) ? 1 : 0;
  const art = parts[i]!;
  // Las herramientas del huerto no se usan con F: se usan con E en las parcelas, el barril o el pozo.
  const tool = isHuertoTool(mine.held);
  const verb = tool ? "Huerto" : parts.length > 1 ? "Usar" : VERB[consumeActionOf(art)];
  // Lo gratis de la casa (nevera, cafetera, fogata) no está en ninguna carta.
  const name = menuItem(mine.held)?.name ?? FREE_NAMES[mine.held] ?? sombreroItem(mine.held)?.name ?? "";
  return (
    // Separado de los botones de la barra por una raya, como otra sección del inventario.
    <span className="ml-1 flex self-stretch items-center border-l-2 border-cozy-ink-soft/40 pl-2.5">
      <button
        type="button"
        onClick={() => !tool && sendUseHeld()}
        disabled={Boolean(panel)}
        title={tool ? `${name}: úsala con E en el huerto` : `${verb}: ${name} (F)`}
        aria-label={`${verb} ${name}, quedan ${total} usos`}
        className="cozy-btn relative h-[58px] w-[62px] flex-col gap-0.5 p-1 text-[12px] max-sm:h-12 max-sm:w-12"
      >
        <kbd className="cozy-kbd absolute top-0.5 left-0.5 px-1 text-[10px] leading-none">{tool ? "E" : "F"}</kbd>
        <HeldArt art={art} left={left[i] ?? 1} />
        <span className="max-sm:hidden">{verb}</span>
        {/* Usos que quedan, como la cantidad de un objeto en el inventario. */}
        <span className="absolute right-0.5 bottom-0 text-[12px] font-semibold text-cozy-ink [text-shadow:1px_1px_0_var(--color-cozy-paper-light)]">
          {mine.held === EMPTY_CAN ? 0 : total}
        </span>
      </button>
      {toast && <ToastButton mode={toast.mode} name={toast.name} disabled={Boolean(panel)} />}
    </span>
  );
}

const TOAST_LABEL = { invite: "Brindar", join: "¡Salud!", waiting: "Esperando…" } as const;

/** Brindar (B): con alguien cerca con bebida invita; si alguien de al lado invitó, se suma. */
function ToastButton({ mode, name, disabled }: { mode: "invite" | "join" | "waiting"; name?: string; disabled: boolean }) {
  const title =
    mode === "join" ? `Brindar con ${name ?? "los de al lado"} (B)` : mode === "waiting" ? "Esperando a que brinden contigo" : "Invitar a brindar a los de al lado (B)";
  return (
    <button
      type="button"
      onClick={() => sendToast()}
      disabled={disabled || mode === "waiting"}
      title={title}
      aria-label={title}
      data-on={mode === "join" ? "" : undefined}
      className={`cozy-btn relative ml-1.5 h-[58px] min-w-[62px] flex-col gap-0.5 p-1 text-[12px] max-sm:h-12 max-sm:min-w-12 ${mode === "join" ? "cozy-btn-primary animate-pulse" : ""}`}
    >
      <kbd className="cozy-kbd absolute top-0.5 left-0.5 px-1 text-[10px] leading-none">B</kbd>
      <span aria-hidden className="mt-2 text-[15px] leading-none">{mode === "waiting" ? "…" : "¡!"}</span>
      <span className="max-sm:hidden">{TOAST_LABEL[mode]}</span>
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
      className="cozy-chip pointer-events-auto flex items-center gap-2 px-3 py-1.5 text-[14px]"
    >
      <kbd className="cozy-kbd">E</kbd>
      {usable.label}
    </button>
  );
}
