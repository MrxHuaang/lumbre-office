"use client";

// Ventana de intercambio a dos columnas: a la izquierda lo que pongo (puntos y objetos de la mochila), a
// la derecha lo que pone la otra persona. Cualquier cambio desmarca el "Listo" de los dos; con los dos
// listos aparece el "Confirmar" final. Cerrarla cancela el intercambio.
import { itemName, stackUnits, TRADE, TRADE_ERROR_TEXT, tradeGap, type ItemStack, type TradeSideView, type TradeView } from "@hyvento/shared";
import { useEffect, useRef, useState } from "react";
import { sendTradeCancel, sendTradeConfirm, sendTradeOffer, sendTradeReady, useSocialStore } from "@/game/social";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "../Cozy";
import { PanelShell } from "../PointsPanels";
import { ItemArt, useBackpack, useMyBalance } from "./common";

interface Draft {
  points: number;
  items: ItemStack[];
}

const draftOf = (side: TradeSideView): Draft => ({ points: side.points, items: side.items.map((i) => ({ ...i })) });
const sameDraft = (a: Draft, b: Draft) =>
  a.points === b.points && a.items.length === b.items.length && a.items.every((it) => b.items.some((o) => o.itemId === it.itemId && o.quantity === it.quantity));

export function TradeWindow({ trade }: { trade: TradeView }) {
  const balance = useMyBalance();
  const { inventory } = useBackpack();
  const problem = useSocialStore((s) => s.problem);
  const [draft, setDraft] = useState<Draft>(() => draftOf(trade.you));
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lo que aceptó el servidor manda, salvo mientras se está escribiendo un cambio.
  useEffect(() => {
    if (!pending.current) setDraft(draftOf(trade.you));
  }, [trade]);
  // Si rechazó la oferta (sin saldo, sin el objeto), se vuelve a la última que aceptó.
  const problemId = problem?.id;
  useEffect(() => {
    if (problemId) setDraft(draftOf(useSocialStore.getState().trade?.you ?? trade.you));
  }, [problemId]);

  const change = (next: Draft) => {
    setDraft(next);
    if (pending.current) clearTimeout(pending.current);
    // Se manda al rato de dejar de tocar: un número que se escribe no manda una oferta por tecla.
    pending.current = setTimeout(() => {
      pending.current = null;
      sendTradeOffer({ points: next.points, items: next.items });
    }, 350);
  };
  useEffect(() => () => void (pending.current && clearTimeout(pending.current)), []);

  const have = (itemId: string) => inventory?.find((e) => e.itemId === itemId)?.quantity ?? 0;
  const inOffer = (itemId: string) => draft.items.find((i) => i.itemId === itemId)?.quantity ?? 0;
  const add = (itemId: string) => {
    const q = inOffer(itemId);
    if (q >= Math.min(have(itemId), TRADE.maxQuantity)) return;
    if (q === 0 && draft.items.length >= TRADE.maxSlots) return;
    if (stackUnits(draft.items) >= TRADE.maxUnits) return;
    const items = q === 0 ? [...draft.items, { itemId, quantity: 1 }] : draft.items.map((i) => (i.itemId === itemId ? { ...i, quantity: q + 1 } : i));
    change({ ...draft, items });
  };
  const remove = (itemId: string) => {
    const q = inOffer(itemId);
    const items = q <= 1 ? draft.items.filter((i) => i.itemId !== itemId) : draft.items.map((i) => (i.itemId === itemId ? { ...i, quantity: q - 1 } : i));
    change({ ...draft, items });
  };

  // Mientras dura, no se abren otros paneles (quedarían tapados y Esc cerraría los dos).
  const panel = useOfficeStore((s) => s.panel);
  useEffect(() => {
    if (panel) useOfficeStore.getState().closePanel();
  }, [panel]);

  const editing = !sameDraft(draft, draftOf(trade.you));
  const you = trade.you;
  const them = trade.them;
  const confirmStage = trade.stage === "confirm";
  // El servidor no confirma si un lado no pone nada: se avisa antes (dar sin recibir es un regalo).
  const gap = tradeGap(you, them);

  return (
    // Por encima de los otros paneles (z-40): la ventana del intercambio no puede quedar tapada.
    <div className="absolute inset-0 z-[45]">
      <PanelShell title={`Intercambio con ${them.name}`} icon="swap" onClose={sendTradeCancel} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Lo mío */}
          <section className={`flex flex-col gap-2.5 border-2 p-3 ${you.ready ? "border-cozy-green" : "border-cozy-wood"} bg-cozy-paper-light`}>
            <SideHeader title="Tú pones" side={you} />
            <label className="flex items-center gap-2 text-[14px]">
              <PixelIcon name="coin" size={14} color="var(--color-cozy-gold)" />
              <input
                type="number"
                min={0}
                max={Math.min(TRADE.maxPoints, balance)}
                value={draft.points}
                onChange={(e) => change({ ...draft, points: Math.max(0, Math.min(TRADE.maxPoints, balance, Math.floor(Number(e.target.value) || 0))) })}
                className="cozy-input w-24 px-2.5 py-1 text-[14px]"
                aria-label="Puntos que pones"
              />
              <span className="text-[12px] text-cozy-ink-soft">de {balance}</span>
            </label>
            <OfferList items={draft.items} onRemove={remove} />
            <p className="mt-1 text-[13px] font-semibold text-cozy-ink-soft">
              Tu mochila{" "}
              <span className="font-normal">
                ({stackUnits(draft.items)}/{TRADE.maxUnits} muebles)
              </span>
            </p>
            {!inventory ? (
              <p className="text-[13px] text-cozy-ink-soft">Abriendo la mochila…</p>
            ) : inventory.length === 0 ? (
              <p className="text-[13px] text-cozy-ink-soft">Está vacía: puedes ofrecer puntos.</p>
            ) : (
              <ul className="cozy-scroll flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                {inventory.map((e) => {
                  const left = e.quantity - inOffer(e.itemId);
                  return (
                    <li key={e.itemId}>
                      <button
                        type="button"
                        onClick={() => add(e.itemId)}
                        disabled={left <= 0}
                        title={`Poner ${itemName(e.itemId)} (te quedan ${left})`}
                        className="cozy-btn relative p-0.5"
                      >
                        <ItemArt itemId={e.itemId} size={40} />
                        <span className="absolute right-0.5 bottom-0 text-[11px] tabular-nums">×{left}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Lo de la otra persona */}
          <section className={`flex flex-col gap-2.5 border-2 p-3 ${them.ready ? "border-cozy-green" : "border-cozy-wood"} bg-cozy-paper-light`}>
            <SideHeader title={`${them.name} pone`} side={them} />
            <p className="flex items-center gap-2 text-[14px]">
              <PixelIcon name="coin" size={14} color="var(--color-cozy-gold)" />
              <span className="font-semibold tabular-nums">{them.points}</span> puntos
            </p>
            <OfferList items={them.items} />
            {them.points === 0 && them.items.length === 0 && <p className="text-[13px] text-cozy-ink-soft">Todavía no puso nada.</p>}
          </section>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {confirmStage ? (
            <>
              <button type="button" onClick={sendTradeConfirm} disabled={you.confirmed || gap !== "ok"} className="cozy-btn cozy-btn-primary px-4 py-2">
                <PixelIcon name="swap" size={13} />
                {you.confirmed ? "Confirmado" : "Confirmar el intercambio"}
              </button>
              <button type="button" onClick={() => sendTradeReady(false)} className="cozy-btn">
                Cambiar algo
              </button>
            </>
          ) : (
            <button type="button" onClick={() => sendTradeReady(!you.ready)} disabled={editing} aria-pressed={you.ready} className="cozy-btn px-4 py-2">
              {you.ready ? (
                <span className="inline-flex items-center gap-1">
                  Listo <PixelIcon name="check" size={12} />
                </span>
              ) : (
                "Estoy listo"
              )}
            </button>
          )}
          <button type="button" onClick={sendTradeCancel} className="cozy-btn cozy-btn-danger ml-auto">
            Cancelar
          </button>
        </div>
        <p className="mt-2 text-[13px] text-cozy-ink-soft">
          {editing
            ? "Guardando tu oferta…"
            : gap !== "ok" && (confirmStage || you.ready)
              ? TRADE_ERROR_TEXT[gap]
              : confirmStage
                ? you.confirmed
                  ? `Esperando que ${them.name} confirme.`
                  : them.confirmed
                    ? `${them.name} ya confirmó. Revisa y confirma.`
                    : "Los dos están listos: revisen y confirmen."
                : you.ready
                  ? `Esperando que ${them.name} esté listo.`
                  : "Cualquier cambio desmarca el Listo de los dos. Si se alejan, se cancela."}
        </p>
      </PanelShell>
    </div>
  );
}

function SideHeader({ title, side }: { title: string; side: TradeSideView }) {
  return (
    <p className="flex items-center justify-between text-[15px] font-semibold">
      {title}
      <span className={`cozy-chip px-2 py-0.5 text-[12px] font-normal ${side.ready ? "text-cozy-green" : "text-cozy-ink-soft"}`}>
        {side.confirmed ? "Confirmó" : side.ready ? "Listo" : "Armando"}
      </span>
    </p>
  );
}

function OfferList({ items, onRemove }: { items: ItemStack[]; onRemove?: (itemId: string) => void }) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1">
      {items.map((it) => (
        <li key={it.itemId} className="flex items-center gap-2 text-[14px]">
          <ItemArt itemId={it.itemId} size={30} />
          <span className="min-w-0 flex-1 truncate">{itemName(it.itemId)}</span>
          <span className="tabular-nums">× {it.quantity}</span>
          {onRemove && (
            <button type="button" onClick={() => onRemove(it.itemId)} aria-label={`Sacar un ${itemName(it.itemId)}`} className="cozy-btn cozy-hit h-6 w-6 p-0">
              −
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
