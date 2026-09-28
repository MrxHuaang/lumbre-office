"use client";

// El puesto de pesca del lago: Don Evelio y lo que vende (cañas y carnada), con el precio, lo que ya
// tienes en la mochila y el botón de comprar. El servidor valida que estés junto al mostrador, el saldo,
// que quepa y que la caña no sea repetida; los errores salen en el panel y como aviso.
import { drawHeldItem } from "@hyvento/map/art";
import {
  PESCA,
  PESCA_ERROR_TEXT,
  PESCA_NPC,
  PESCA_SHOP,
  fishingGear,
  objItemId,
  pescaIdleLine,
  ROD_NAME,
  type PescaItem,
  type PescaItemId,
} from "@hyvento/shared";
import { useEffect, useMemo, useState } from "react";
import { useBagStore } from "@/game/bag";
import { useGameTime } from "@/game/gameClock";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { sendPescaBuy, usePescaStore } from "@/game/pesca";
import { useOfficeStore } from "@/game/store";
import { CharacterSprite } from "./CharacterSprite";
import { PixelIcon } from "./Cozy";
import { PanelShell, useMyPoints } from "./PointsPanels";

/** Si no llega respuesta del servidor en este tiempo, el botón vuelve a estar disponible. */
const PENDING_MS = 3000;

export function PescaPanel({ atObject, onClose }: { atObject: boolean; onClose: () => void }) {
  const points = useMyPoints();
  const slots = useBagStore((s) => s.slots);
  const overflow = useBagStore((s) => s.overflow);
  const selected = useBagStore((s) => s.selected);
  const lastResult = usePescaStore((s) => s.lastResult);
  const weather = useOfficeStore((s) => s.weather);
  const hour = useGameTime()?.hour ?? 12;
  const [pending, setPending] = useState<PescaItemId | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cuántas unidades de cada cosa hay en la mochila (y en lo que no cupo).
  const count = useMemo(() => {
    const have = new Map<string, number>();
    for (const s of [...slots, ...overflow]) if (s) have.set(s.itemId, (have.get(s.itemId) ?? 0) + s.quantity);
    return (art: string) => have.get(objItemId(art)) ?? 0;
  }, [slots, overflow]);
  const free = slots.filter((s) => !s).length;
  const inHand = slots[selected]?.itemId.replace(/^obj:/, "") ?? "";
  const gear = fishingGear(count, inHand);

  // La respuesta del servidor suelta el botón; si salió mal, el motivo queda a la vista.
  useEffect(() => {
    if (!lastResult) return;
    setPending(null);
    setError(lastResult.ok ? null : PESCA_ERROR_TEXT[lastResult.error]);
  }, [lastResult]);
  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => setPending(null), PENDING_MS);
    return () => clearTimeout(id);
  }, [pending]);

  const buy = (id: PescaItemId) => {
    setError(null);
    setPending(id);
    sendPescaBuy(id);
  };

  // Lo que dice Don Evelio arriba: un comentario de la hora del juego o del clima.
  const line = pescaIdleLine(hour, weather, Math.floor(hour / 3));

  return (
    <PanelShell title="Puesto de pesca" icon="fish" onClose={onClose} wide>
      <div className="flex items-end gap-3 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 pt-2 pb-2">
        <CharacterSprite avatar="ada" look={PESCA_NPC.look} className="h-20 w-20 shrink-0" />
        <div className="mb-1 flex-1">
          <p className="text-[13px] font-semibold text-cozy-wood">{PESCA_NPC.name}</p>
          <p aria-live="polite" className="text-[15px] leading-snug text-cozy-ink">
            «{line}»
          </p>
        </div>
        <span className="cozy-chip mb-1 flex shrink-0 items-center gap-1 text-[13px]">
          <PixelIcon name="coin" size={12} color="var(--color-cozy-gold)" />
          {points} pts
        </span>
      </div>

      <p className="mt-3 text-[14px] text-cozy-ink-soft">
        La caña de bambú es gratis y siempre está. Al pescar se usa la caña o la carnada que tengas en la mano; si no, la mejor que tengas en la
        mochila. La carnada se gasta una por lance. Ahora pescarías con <strong>{ROD_NAME[gear.rod].toLowerCase()}</strong>
        {gear.bait ? ` y ${gear.bait === "carnada" ? "carnada" : "carnada de la buena"}` : " y sin carnada"}.
        {!atObject && " Para comprar, arrímate al mostrador del puesto (orilla oeste del lago)."}
      </p>

      {error && (
        <p role="alert" className="mt-2 border-2 border-cozy-red bg-cozy-paper-light px-3 py-1.5 text-[14px] text-cozy-red">
          {error}
        </p>
      )}

      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {PESCA_SHOP.map((item: PescaItem) => {
          const have = count(item.id);
          const owned = item.kind === "rod" && have > 0;
          const short = points < item.price;
          const full = have === 0 && free === 0;
          const tooMany = item.kind === "bait" && have + item.gives > PESCA.baitMax;
          const why = owned ? "Ya es tuya" : !atObject ? "Arrímate al mostrador" : short ? "No te alcanzan los puntos" : full ? "La mochila está llena" : tooMany ? "Ya llevas mucha" : "";
          return (
            <li key={item.id} className="flex items-center gap-3 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2.5">
              <ItemArt id={item.id} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-tight font-semibold text-cozy-ink">
                  {item.name}
                  {item.gives > 1 && <span className="font-normal text-cozy-ink-soft"> ×{item.gives}</span>}
                </p>
                <p className="text-[12px] leading-snug text-cozy-ink-soft">{item.blurb}</p>
                <p className="text-[12px] leading-snug text-cozy-green">{item.effect}</p>
                <p className="text-[12px] leading-snug text-cozy-ink-soft">{owned ? "Ya la tienes." : have > 0 ? `Tienes ${have}.` : "No tienes."}</p>
              </div>
              <button
                type="button"
                onClick={() => buy(item.id as PescaItemId)}
                disabled={Boolean(why) || pending !== null}
                title={why || `Comprar ${item.name}`}
                aria-label={`Comprar ${item.name} por ${item.price} puntos`}
                className="cozy-btn cozy-btn-primary flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-[14px]"
              >
                <PixelIcon name="coin" size={12} color="var(--color-cozy-gold)" />
                {pending === item.id ? "…" : owned ? "Tuya" : item.price}
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
