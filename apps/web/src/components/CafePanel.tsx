"use client";

// Fase 3a: la carta de la barra de la cafetería y, con el rediseño, la del bar del club (sótano). Se paga
// con puntos, lo pedido se lleva en la mano y se usa con F (pitadas, sorbos, mordiscos).
import { drawMenuItem } from "@hyvento/map/art";
import { BAR_MENU, CAFE, CAFE_MENU, consumeActionOf, heldParts, usesOf, type BarItemId, type CafeItemId, type MenuItem } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { sendBarOrder, sendCafeOrder } from "@/game/network";
import { PixelIcon } from "./Cozy";
import { PanelShell, useMyPoints } from "./PointsPanels";

/** Si no llega respuesta del servidor en este tiempo, el botón vuelve a estar disponible. */
const PENDING_MS = 3000;

const USE_WORD = { smoke: "pitadas", sip: "sorbos", bite: "mordiscos" } as const;

/** "4 sorbos", "5 pitadas y 3 sorbos": cuánto rinde lo que se pide. */
function usesText(item: MenuItem) {
  return heldParts(item.id)
    .map((art) => `${usesOf(art)} ${USE_WORD[consumeActionOf(art)]}`)
    .join(" y ");
}

export function CafePanel({ atObject, onClose }: { atObject: boolean; onClose: () => void }) {
  return (
    <MenuPanel
      title="Cafetería"
      items={CAFE_MENU}
      atObject={atObject}
      onClose={onClose}
      order={(id) => sendCafeOrder(id as CafeItemId)}
      farHint="Para pedir, acércate a la barra de la cafetería (planta baja)."
    />
  );
}

/** La carta del bar del club: la misma mecánica, con la luz de neón del sótano. */
export function BarPanel({ atObject, onClose }: { atObject: boolean; onClose: () => void }) {
  return (
    <MenuPanel
      title="Bar del club"
      items={BAR_MENU}
      atObject={atObject}
      onClose={onClose}
      order={(id) => sendBarOrder(id as BarItemId)}
      farHint="Para pedir, acércate a la barra del club (sótano)."
      night
    />
  );
}

function MenuPanel({
  title,
  items,
  atObject,
  onClose,
  order,
  farHint,
  night = false,
}: {
  title: string;
  items: readonly MenuItem[];
  atObject: boolean;
  onClose: () => void;
  order: (id: string) => void;
  farHint: string;
  night?: boolean;
}) {
  const points = useMyPoints();
  const [pending, setPending] = useState<string | null>(null);

  // Si sale bien, el panel se cierra solo (ver network.ts); si no, se puede volver a intentar.
  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => setPending(null), PENDING_MS);
    return () => clearTimeout(id);
  }, [pending]);

  const ask = (id: string) => {
    setPending(id);
    order(id);
  };

  const intro = (
    <p className={`text-[14px] ${night ? "text-[#e9d8ff]" : "text-cozy-ink-soft"}`}>
      Lo que pidas lo llevas en la mano {Math.round(CAFE.heldMs / 60_000)} minutos y todos lo ven. Con <kbd className="cozy-kbd">F</kbd> lo usas.
      {!atObject && ` ${farHint}`}
    </p>
  );

  const list = (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => {
        const short = points < item.price;
        return (
          <li
            key={item.id}
            className={
              night
                ? "flex items-center gap-3 border-2 border-[#6e3a96] bg-[#241238] px-3 py-2.5 shadow-[inset_0_0_0_1px_#34194f]"
                : "flex items-center gap-3 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2.5"
            }
          >
            <ItemArt id={item.id} night={night} />
            <div className="min-w-0 flex-1">
              <p className={`text-[15px] leading-tight font-semibold ${night ? "text-[#ffe0f6]" : ""}`}>{item.name}</p>
              <p className={`text-[12px] leading-snug ${night ? "text-[#c9b2e6]" : "text-cozy-ink-soft"}`}>{item.blurb}</p>
              <p className={`text-[11px] leading-snug ${night ? "text-[#8ef0f0]" : "text-cozy-green"}`}>{usesText(item)}</p>
            </div>
            <button
              type="button"
              onClick={() => ask(item.id)}
              disabled={!atObject || short || pending !== null}
              title={short ? "No te alcanzan los puntos" : !atObject ? "Acércate a la barra" : `Pedir ${item.name}`}
              className="cozy-btn cozy-btn-primary flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-[14px]"
            >
              <PixelIcon name="coin" size={12} color="var(--color-cozy-gold)" />
              {pending === item.id ? "…" : item.price}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <PanelShell title={title} icon="cup" onClose={onClose} wide>
      {night ? (
        // De noche en el club: pizarra violeta con un letrero de neón.
        <div className="-mx-4 -my-4 flex flex-col gap-3 bg-[#1e1030] px-4 py-4">
          <p
            aria-hidden
            className="self-center border-2 border-[#ff5fd2] px-3 py-0.5 text-[20px] tracking-[0.25em] text-[#ffe0f6] shadow-[0_0_0_2px_#5a0f4a,0_0_12px_#ff5fd2] [text-shadow:0_0_6px_#ff5fd2]"
          >
            BAR
          </p>
          {intro}
          {list}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {intro}
          {list}
        </div>
      )}
    </PanelShell>
  );
}

const artCache = new Map<string, string>();

/** El producto en pixel-art (en los combos, las dos cosas), ampliado sin suavizar. Se dibuja en el navegador. */
function ItemArt({ id, night }: { id: string; night: boolean }) {
  const [src, setSrc] = useState(() => artCache.get(id) ?? null);
  useEffect(() => {
    if (artCache.has(id)) return;
    const url = toHtmlCanvas(drawMenuItem(id)).toDataURL();
    artCache.set(id, url);
    setSrc(url);
  }, [id]);
  return (
    <span className={`grid h-12 w-12 shrink-0 place-items-center border-2 ${night ? "border-[#ff5fd2] bg-[#34194f]" : "border-cozy-wood bg-cozy-paper-dark"}`}>
      {src && <img src={src} alt="" className="h-9 w-10 object-contain [image-rendering:pixelated]" />}
    </span>
  );
}
