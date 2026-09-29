"use client";

// Fase 3b: la tienda (mostrador de la planta baja). Se venden muebles con puntos y quedan en la mochila
// (bag/PlayerMenu.tsx) hasta ponerlos con "Decorar" en tu oficina. La ropa es gratis: va en el probador.
import { drawFurniture } from "@hyvento/map/art";
import { SHOP_FURNITURE, SHOP_MAX_QUANTITY, type InventoryEntry, type ShopItem } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "./Cozy";
import { api, PanelShell, useMyPoints } from "./PointsPanels";

type BuyResponse = { balance: number; inventory: InventoryEntry[] };

/** Lo que hay en la mochila: se lee al abrir el panel y cada compra devuelve la lista nueva. */
function useInventory() {
  const [inventory, setInventory] = useState<InventoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api<{ inventory: InventoryEntry[] }>("/api/inventory").then(
      (r) => alive && setInventory(r.inventory),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, []);
  return { inventory, setInventory, error };
}

// ---------- Tienda ----------

export function ShopPanel({ atObject, onClose }: { atObject: boolean; onClose: () => void }) {
  const { inventory, setInventory, error: loadError } = useInventory();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const notify = useOfficeStore((s) => s.notify);

  // Tras comprar se usa el saldo de la respuesta hasta que el contador del servidor se pone al día.
  const points = useMyPoints();
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => setBalance(null), [points]);
  const money = balance ?? points;

  const owned = (itemId: string) => inventory?.find((e) => e.itemId === itemId)?.quantity ?? 0;

  const buy = async (item: ShopItem, quantity: number) => {
    setPending(item.id);
    setError(null);
    try {
      const r = await api<BuyResponse>("/api/shop/buy", { method: "POST", body: JSON.stringify({ itemId: item.id, quantity }) });
      setInventory(r.inventory);
      setBalance(r.balance);
      setQuantities((q) => ({ ...q, [item.id]: 1 }));
      notify(`Compraste ${quantity > 1 ? `${quantity} × ` : ""}${item.name}. ${quantity > 1 ? "Quedaron" : "Quedó"} en tu mochila.`, "success");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(null);
    }
  };

  return (
    <PanelShell title="Tienda" icon="shop" onClose={onClose} wide>
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <p className="flex-1 text-[14px] text-cozy-ink-soft">
            Muebles para tu oficina. Lo que compres queda en tu mochila y lo pones con Decorar.
            {!atObject && " Para comprar, acércate al mostrador de la tienda (planta baja, junto a la cafetería)."}
          </p>
          <span className="flex shrink-0 items-center gap-1 text-[15px] font-semibold" title="Tus puntos">
            <PixelIcon name="coin" size={14} color="var(--color-cozy-gold)" />
            {money}
          </span>
        </div>

        <p className="flex items-center gap-2.5 border-2 border-cozy-wood bg-cozy-paper-dark px-3 py-2 text-[14px] leading-snug">
          <PixelIcon name="star" size={14} color="var(--color-cozy-wood)" className="shrink-0" />
          <span>
            ¿Ropa nueva? Es gratis: cámbiate en el <strong className="font-semibold">probador</strong>, al fondo de la tienda junto a
            los percheros.
          </span>
        </p>

        {(error ?? loadError) && <p className="text-[14px] font-semibold text-cozy-red-deep">{error ?? loadError}</p>}

        <ul className="grid gap-2 sm:grid-cols-2">
          {SHOP_FURNITURE.map((item) => {
            const quantity = quantities[item.id] ?? 1;
            const total = item.price * quantity;
            const reason = !atObject ? "Acércate al mostrador de la tienda" : money < total ? "No te alcanzan los puntos" : null;
            const have = owned(item.id);
            return (
              <li key={item.id} className="flex gap-3 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2.5">
                <FurnitureArt type={item.id} />
                {/* Texto arriba y compra abajo: en dos columnas el nombre y la descripción no se aprietan. */}
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div>
                    <p className="text-[15px] leading-tight font-semibold">{item.name}</p>
                    <p className="text-[12px] leading-snug text-cozy-ink-soft">{item.blurb}</p>
                    {have > 0 && <p className="mt-0.5 text-[12px] font-semibold text-cozy-green">En tu mochila: {have}</p>}
                  </div>
                  <div className="mt-auto flex items-center justify-end gap-2">
                    <Quantity value={quantity} onChange={(n) => setQuantities((q) => ({ ...q, [item.id]: n }))} label={item.name} />
                    <button
                      type="button"
                      onClick={() => void buy(item, quantity)}
                      disabled={reason !== null || pending !== null}
                      title={reason ?? `Comprar ${quantity > 1 ? `${quantity} × ` : ""}${item.name}`}
                      className="cozy-btn cozy-btn-primary min-w-[4.5rem] gap-1 px-2.5 py-1.5 text-[14px]"
                    >
                      <PixelIcon name="coin" size={12} color="var(--color-cozy-gold)" />
                      {pending === item.id ? "…" : total}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </PanelShell>
  );
}

/** Cuántas unidades de un mueble llevar (1 a SHOP_MAX_QUANTITY). */
function Quantity({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div role="group" aria-label={`Cantidad de ${label}`} className="flex items-center">
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Una menos" className="cozy-btn cozy-hit h-6 w-6 p-0 text-[15px]">
        −
      </button>
      <span className="w-7 text-center text-[14px] tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= SHOP_MAX_QUANTITY}
        aria-label="Una más"
        className="cozy-btn cozy-hit h-6 w-6 p-0 text-[15px]"
      >
        +
      </button>
    </div>
  );
}

// ---------- Dibujo ----------

const furnitureArt = new Map<string, string | null>();

/** El mueble dibujado con el motor (de frente), ampliado sin suavizar. Necesita un canvas: solo en el navegador. */
function FurnitureArt({ type }: { type: string }) {
  const [src, setSrc] = useState(() => furnitureArt.get(type) ?? null);
  useEffect(() => {
    let url = furnitureArt.get(type);
    if (url === undefined) {
      try {
        url = toHtmlCanvas(drawFurniture(type).canvas).toDataURL();
      } catch {
        url = null; // un id que ya no está en el catálogo: sin dibujo
      }
      furnitureArt.set(type, url);
    }
    setSrc(url);
  }, [type]);
  return (
    <span className="grid size-[68px] shrink-0 place-items-center border-2 border-cozy-wood bg-cozy-paper-dark">
      {src && <img src={src} alt="" className="h-14 w-14 object-contain [image-rendering:pixelated]" />}
    </span>
  );
}
