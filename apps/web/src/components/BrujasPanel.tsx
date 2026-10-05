"use client";

// La Noche de brujas en el HUD: el puesto del caldero (los dulces y el sombrero de bruja de recuerdo, por
// puntos, solo con el festival abierto) y el botón de "¡Dulce o truco!" junto a un NPC o la puerta de una
// oficina cuando se lleva la canasta en la mano. El servidor valida todo; aquí solo se pide y se muestra.
import { drawHeldItem } from "@hyvento/map/art";
import { BRUJAS_BUY_ERROR_TEXT, BRUJAS_SHOP, SOMBRERO_BRUJA, bagItemInfo, objItemId, type BrujasShopId } from "@hyvento/shared";
import { useEffect, useMemo, useState } from "react";
import { useBagStore } from "@/game/bag";
import { brujasNow, sendBrujasBuy, trickOrTreat, useBrujasStore } from "@/game/brujas";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "./Cozy";
import { PanelShell, useMyPoints } from "./PointsPanels";

/** Si no llega respuesta del servidor en este tiempo, el botón vuelve a estar disponible. */
const PENDING_MS = 3000;

export function BrujasPanel({ atObject, onClose }: { atObject: boolean; onClose: () => void }) {
  const points = useMyPoints();
  const slots = useBagStore((s) => s.slots);
  const overflow = useBagStore((s) => s.overflow);
  const lastBuy = useBrujasStore((s) => s.lastBuy);
  const open = useOfficeStore((s) => s.festival.id === "brujas" && s.festival.fase === "fiesta");
  const [pending, setPending] = useState<BrujasShopId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const count = useMemo(() => {
    const have = new Map<string, number>();
    for (const s of [...slots, ...overflow]) if (s) have.set(s.itemId, (have.get(s.itemId) ?? 0) + s.quantity);
    return (id: string) => have.get(objItemId(id)) ?? 0;
  }, [slots, overflow]);
  const free = slots.filter((s) => !s).length;

  useEffect(() => {
    if (!lastBuy) return;
    setPending(null);
    setError(lastBuy.ok ? null : BRUJAS_BUY_ERROR_TEXT[lastBuy.error]);
  }, [lastBuy]);
  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => setPending(null), PENDING_MS);
    return () => clearTimeout(id);
  }, [pending]);

  const buy = (id: BrujasShopId) => {
    setError(null);
    setPending(id);
    sendBrujasBuy(id);
  };

  return (
    <PanelShell title="Puesto del caldero" icon="flame" onClose={onClose} wide>
      <div className="flex items-center gap-3 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2">
        <p className="flex-1 text-[15px] leading-snug text-cozy-ink">
          «Dulces para la canasta y el sombrero de la bruja, de recuerdo. Solo esta noche: cuando cierre el festival, el caldero se apaga.»
        </p>
        <span className="cozy-chip flex shrink-0 items-center gap-1 text-[13px]">
          <PixelIcon name="coin" size={12} color="var(--color-cozy-gold)" />
          {points} pts
        </span>
      </div>
      {!open && <p className="mt-3 text-[14px] text-cozy-ink-soft">El puesto abre en la Noche de brujas, de las 9:00 a las 22:00 del reloj de la cabaña.</p>}
      {open && !atObject && <p className="mt-3 text-[14px] text-cozy-ink-soft">Para comprar, arrímate al caldero, junto al laberinto de maíz.</p>}
      {error && (
        <p role="alert" className="mt-2 border-2 border-cozy-red bg-cozy-paper-light px-3 py-1.5 text-[14px] text-cozy-red">
          {error}
        </p>
      )}
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {BRUJAS_SHOP.map((item) => {
          const have = count(item.id);
          const owned = item.id === SOMBRERO_BRUJA && have > 0;
          const why = !open ? "Cerrado" : owned ? "Ya es tuyo" : !atObject ? "Arrímate al caldero" : points < item.price ? "No te alcanzan los puntos" : have === 0 && free === 0 ? "La mochila está llena" : "";
          return (
            <li key={item.id} className="flex items-center gap-3 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2.5">
              <ItemArt id={item.id} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-tight font-semibold text-cozy-ink">{item.name}</p>
                <p className="text-[12px] leading-snug text-cozy-ink-soft">{bagItemInfo(objItemId(item.id)).blurb}</p>
                <p className="text-[12px] leading-snug text-cozy-ink-soft">{owned ? "Ya lo tienes." : have > 0 ? `Tienes ${have}.` : "No tienes."}</p>
              </div>
              <button
                type="button"
                onClick={() => buy(item.id)}
                disabled={Boolean(why) || pending !== null}
                title={why || `Comprar ${item.name}`}
                aria-label={`Comprar ${item.name} por ${item.price} puntos`}
                className="cozy-btn cozy-btn-primary flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-[14px]"
              >
                <PixelIcon name="coin" size={12} color="var(--color-cozy-gold)" />
                {pending === item.id ? "…" : owned ? "Tuyo" : item.price}
              </button>
            </li>
          );
        })}
      </ul>
    </PanelShell>
  );
}

const artCache = new Map<string, string>();

/** El producto en pixel-art, ampliado sin suavizar. */
function ItemArt({ id }: { id: string }) {
  const [src, setSrc] = useState(() => artCache.get(id) ?? null);
  useEffect(() => {
    if (artCache.has(id)) return setSrc(artCache.get(id)!);
    const url = toHtmlCanvas(drawHeldItem(id)).toDataURL();
    artCache.set(id, url);
    setSrc(url);
  }, [id]);
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center border-2 border-cozy-paper-dark bg-cozy-paper">
      {src && <img src={src} alt="" className="h-10 w-10 object-contain [image-rendering:pixelated]" />}
    </span>
  );
}

/** Junto a un NPC o la puerta de una oficina, con la canasta en la mano: pedir dulce o truco. */
export function BrujasTrickPrompt() {
  const target = useBrujasStore((s) => s.target);
  const panel = useOfficeStore((s) => s.panel);
  const decorating = useOfficeStore((s) => s.decorating);
  if (!target || panel || decorating || !brujasNow()) return null;
  return (
    <button type="button" onClick={trickOrTreat} className="cozy-chip pointer-events-auto flex items-center gap-2 px-3 py-1.5 text-[14px]">
      <PixelIcon name="gift" size={14} color="var(--color-cozy-gold)" />
      ¡Dulce o truco! · {target.name}
    </button>
  );
}
