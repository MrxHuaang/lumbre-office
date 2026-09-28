"use client";

// La barra de acceso rápido (abajo al centro, como la de Stardew): una fila de 12 casillas de la mochila.
// Tab cambia la fila (Mayús+Tab, la anterior), 1–9, 0, - e = eligen la casilla y la rueda del mouse sobre
// la barra pasa a la de al lado. La casilla elegida es lo que se lleva en la mano (lo valida el servidor);
// un clic en la elegida la usa (en el celular no hay F). I abre el menú del jugador.
import { isPlaceable } from "@hyvento/map";
import { BAG, BAG_KEYS, bagItemInfo, bagRow, consumeActionOf, EMPTY_CAN, parseHeldLeft, type ItemStack } from "@hyvento/shared";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { selectColumn, selectSlot, stepColumn, turnRow, useBagStore } from "@/game/bag";
import { sendToast, sendUseHeld } from "@/game/network";
import { selectMyOffice, useOfficeStore } from "@/game/store";
import { ItemIcon } from "./ItemIcon";

const VERB = { smoke: "Fumar", sip: "Tomar", bite: "Comer", spoon: "Comer", sniff: "Esnifar" } as const;

/** ¿Es un campo donde se escribe? (ahí Tab y los números son del texto). */
const isField = (el: EventTarget | null) =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el instanceof HTMLElement && el.isContentEditable);

/** Lo que llevo en la mano según el servidor (el dibujo y sus usos). */
export function useMyHand() {
  return useOfficeStore(
    useShallow((s) => {
      const p = s.sessionId ? s.players[s.sessionId] : undefined;
      return { held: p?.held ?? "", left: parseHeldLeft(p?.heldLeft ?? "")[0] ?? 0 };
    }),
  );
}

/**
 * Tab, los números y la I, con el juego libre: sin escribir, sin el PC, sin un panel abierto ni el editor
 * (el selector de emotes marca "escribiendo", así sus números no chocan con los de la barra).
 */
function useBagKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isField(e.target)) return;
      const s = useOfficeStore.getState();
      if (s.typing || s.pcOn || s.panel || s.decorating || s.worldEditing) return;
      if (e.key === "Tab") {
        e.preventDefault();
        if (!e.repeat) turnRow(e.shiftKey ? -1 : 1);
        return;
      }
      if (e.key.toLowerCase() === "i" && !e.shiftKey) {
        e.preventDefault();
        if (!e.repeat) s.openPanel("backpack", false);
        return;
      }
      // Por la tecla física (Digit1…), así sirve en cualquier distribución del teclado; - e = por su letra.
      const digit = /^Digit(\d)$/.exec(e.code)?.[1];
      const col = BAG_KEYS.indexOf((digit ?? e.key) as (typeof BAG_KEYS)[number]);
      if (col < 0) return;
      e.preventDefault();
      if (!e.repeat) selectColumn(col);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function Hotbar() {
  useBagKeys();
  const { slots, selected, rowTurn, rowStep } = useBagStore(
    useShallow((s) => ({ slots: s.slots, selected: s.selected, rowTurn: s.rowTurn, rowStep: s.rowStep })),
  );
  const hand = useMyHand();
  const row = bagRow(selected);
  return (
    <div
      className="flex items-center justify-center gap-1.5"
      onWheel={(e) => {
        if (e.deltaY) stepColumn(e.deltaY > 0 ? 1 : -1);
      }}
    >
      <RowPips row={row} />
      <div
        key={rowTurn}
        role="toolbar"
        aria-label={`Barra de la mochila: fila ${row + 1} de ${BAG.rows} (Tab para cambiar)`}
        className={`flex gap-[3px] ${rowTurn ? (rowStep > 0 ? "bag-row-up" : "bag-row-down") : ""}`}
      >
        {Array.from({ length: BAG.cols }, (_, col) => {
          const slot = row * BAG.cols + col;
          return <HotbarSlot key={col} slot={slot} col={col} stack={slots[slot] ?? null} selected={slot === selected} hand={slot === selected ? hand : null} />;
        })}
      </div>
    </div>
  );
}

/**
 * Las tres filas de la mochila: la que se ve, marcada. Clic para ir a otra. Caben en el alto de una
 * casilla (el "Tab" va en el título y en la lista de controles).
 */
function RowPips({ row }: { row: number }) {
  return (
    <div className="flex flex-col items-center gap-[3px]" role="group" aria-label="Filas de la mochila (Tab para cambiar)" title="Filas de la mochila (Tab para cambiar)">
      {Array.from({ length: BAG.rows }, (_, r) => (
        <button
          key={r}
          type="button"
          title={r === row ? `Fila ${r + 1} (Tab para cambiar)` : `Ver la fila ${r + 1}`}
          aria-label={`Fila ${r + 1}`}
          aria-pressed={r === row}
          onClick={() => selectSlot(r * BAG.cols + (useBagStore.getState().selected % BAG.cols))}
          className={`size-2 border-2 border-cozy-frame focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cozy-sky ${r === row ? "bg-cozy-red" : "bg-cozy-paper-light"}`}
        />
      ))}
    </div>
  );
}

function HotbarSlot({
  slot,
  col,
  stack,
  selected,
  hand,
}: {
  slot: number;
  col: number;
  stack: ItemStack | null;
  selected: boolean;
  hand: { held: string; left: number } | null;
}) {
  const info = stack ? bagItemInfo(stack.itemId) : null;
  // La elegida se dibuja como está en la mano (el vaso a medio tomar, la regadera vacía).
  const inHand = selected && hand?.held ? hand : null;
  const title = info
    ? `${info.name}${stack!.quantity > 1 ? ` ×${stack!.quantity}` : ""}${selected && info.use === "consume" ? " · clic o F para usar" : ""}`
    : "Casilla vacía";
  return (
    <button
      type="button"
      data-selected={selected}
      aria-pressed={selected}
      aria-label={`${col + 1}: ${title}`}
      title={title}
      onClick={() => (selected ? info?.use === "consume" && sendUseHeld() : selectSlot(slot))}
      className="bag-slot size-[clamp(1.55rem,calc((100vw-4rem)/12),2.25rem)]"
    >
      <span className="bag-slot-n max-sm:hidden">{BAG_KEYS[col]}</span>
      {stack && <ItemIcon itemId={stack.itemId} art={inHand?.held} left={inHand && info?.use === "consume" ? inHand.left : undefined} />}
      {stack && stack.quantity > 1 && <span className="bag-slot-q">{stack.quantity}</span>}
    </button>
  );
}

/**
 * Lo que se puede hacer con lo de la mano, al lado de los botones de la barra: usarlo (F), las
 * herramientas del huerto (E sobre las parcelas), poner un mueble si estás en tu oficina, y brindar (B).
 */
export function HandActions() {
  const hand = useMyHand();
  const stack = useBagStore((s) => s.slots[s.selected] ?? null);
  const panel = useOfficeStore((s) => s.panel);
  const toast = useOfficeStore((s) => s.toastPrompt);
  const inMyOffice = useOfficeStore((s) => {
    const mine = selectMyOffice(s);
    return Boolean(mine && s.zone?.id === mine.zoneId);
  });
  const info = stack ? bagItemInfo(stack.itemId) : null;
  let action: React.ReactNode = null;
  if (info?.furniture) {
    const placeable = isPlaceable(info.art);
    action = (
      <button
        type="button"
        disabled={!inMyOffice || !placeable || Boolean(panel)}
        onClick={() => {
          const s = useOfficeStore.getState();
          s.setDecorating(true);
          s.pickDecor({ type: info.art });
        }}
        title={inMyOffice ? `Poner ${info.name} en tu oficina` : `${info.name}: se pone en tu oficina (con Decorar)`}
        className="cozy-btn h-9 gap-1.5 px-2 text-[13px] max-sm:h-8"
      >
        <span className="max-w-24 truncate">{inMyOffice ? "Poner" : info.name}</span>
      </button>
    );
  } else if (info && hand.held) {
    const tool = info.use === "tool";
    const verb = info.use === "consume" ? VERB[consumeActionOf(hand.held)] : tool ? "Huerto" : info.name;
    const uses = hand.held === EMPTY_CAN ? 0 : hand.left;
    action = (
      <button
        type="button"
        onClick={() => info.use === "consume" && sendUseHeld()}
        disabled={Boolean(panel) || info.use !== "consume"}
        title={
          info.use === "consume"
            ? `${verb}: ${info.name} (F) · le quedan ${uses}`
            : tool
              ? `${info.name}: úsala con E en las parcelas, el barril o el pozo`
              : `${info.name}: lo llevas en la mano`
        }
        className="cozy-btn h-9 gap-1.5 px-2 text-[13px] disabled:opacity-100 max-sm:h-8"
      >
        {(info.use === "consume" || tool) && <kbd className="cozy-kbd px-1 text-[10px] leading-none">{tool ? "E" : "F"}</kbd>}
        <span className="max-w-24 truncate max-sm:hidden">{verb}</span>
        {info.use && <span className="text-[12px] text-cozy-ink-soft tabular-nums">×{uses}</span>}
      </button>
    );
  }
  if (!action && !toast) return null;
  return (
    // Separado de los botones de la barra por una raya, como otra sección.
    <span className="ml-0.5 flex items-center gap-1.5 self-stretch border-l-2 border-cozy-ink-soft/40 pl-2">
      {action}
      {toast && <ToastButton mode={toast.mode} name={toast.name} disabled={Boolean(panel)} />}
    </span>
  );
}

const TOAST_LABEL = { invite: "Brindar", join: "¡Salud!", waiting: "Esperando…" } as const;

/** Brindar (B): con alguien cerca con bebida invita; si alguien de al lado invitó, se suma. */
function ToastButton({ mode, name, disabled }: { mode: "invite" | "join" | "waiting"; name?: string; disabled: boolean }) {
  const title =
    mode === "join"
      ? `Brindar con ${name ?? "los de al lado"} (B)`
      : mode === "waiting"
        ? "Esperando a que brinden contigo"
        : "Invitar a brindar a los de al lado (B)";
  return (
    <button
      type="button"
      onClick={() => sendToast()}
      disabled={disabled || mode === "waiting"}
      title={title}
      aria-label={title}
      data-on={mode === "join" ? "" : undefined}
      className={`cozy-btn h-9 gap-1.5 px-2 text-[13px] max-sm:h-8 ${mode === "join" ? "cozy-btn-primary animate-pulse" : ""}`}
    >
      <kbd className="cozy-kbd px-1 text-[10px] leading-none">B</kbd>
      <span className="max-sm:hidden">{TOAST_LABEL[mode]}</span>
    </button>
  );
}
