"use client";

// Fase 3a: el menú de la barra de la cafetería. Se paga con puntos y lo pedido se lleva en la mano.
import { drawCafeItem } from "@hyvento/map/art";
import { CAFE, CAFE_MENU, type CafeItemId } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { sendCafeOrder } from "@/game/network";
import { PixelIcon } from "./Cozy";
import { PanelShell, useMyPoints } from "./PointsPanels";

/** Si no llega respuesta del servidor en este tiempo, el botón vuelve a estar disponible. */
const PENDING_MS = 3000;

export function CafePanel({ atObject, onClose }: { atObject: boolean; onClose: () => void }) {
  const points = useMyPoints();
  const [pending, setPending] = useState<CafeItemId | null>(null);

  // Si sale bien, el panel se cierra solo (ver network.ts); si no, se puede volver a intentar.
  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => setPending(null), PENDING_MS);
    return () => clearTimeout(id);
  }, [pending]);

  const order = (item: CafeItemId) => {
    setPending(item);
    sendCafeOrder(item);
  };

  return (
    <PanelShell title="Cafetería" icon="cup" onClose={onClose} wide>
      <div className="flex flex-col gap-3">
        <p className="text-[14px] text-cozy-ink-soft">
          Lo que pidas lo llevas en la mano {Math.round(CAFE.heldMs / 60_000)} minutos, y todos lo ven.
          {!atObject && " Para pedir, acércate a la barra de la cafetería (planta baja)."}
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {CAFE_MENU.map((item) => {
            const short = points < item.price;
            return (
              <li key={item.id} className="flex items-center gap-3 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2.5">
                <ItemArt id={item.id} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] leading-tight font-semibold">{item.name}</p>
                  <p className="text-[12px] leading-snug text-cozy-ink-soft">{item.blurb}</p>
                </div>
                <button
                  type="button"
                  onClick={() => order(item.id)}
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
      </div>
    </PanelShell>
  );
}

const artCache = new Map<string, string>();

/** El producto en pixel-art, ampliado sin suavizar. Se dibuja en el navegador (necesita un canvas). */
function ItemArt({ id }: { id: string }) {
  const [src, setSrc] = useState(() => artCache.get(id) ?? null);
  useEffect(() => {
    if (artCache.has(id)) return;
    const url = toHtmlCanvas(drawCafeItem(id)).toDataURL();
    artCache.set(id, url);
    setSrc(url);
  }, [id]);
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center border-2 border-cozy-wood bg-cozy-paper-dark">
      {src && <img src={src} alt="" className="h-9 w-9 object-contain [image-rendering:pixelated]" />}
    </span>
  );
}
