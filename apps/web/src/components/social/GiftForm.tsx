"use client";

// Armar un regalo: a quién (fijo, o elegido de la lista del equipo), puntos, un objeto de la mochila y
// una nota. Lo cobra la web en una transacción (POST /api/gifts).
import { describeBundle, GIFT, itemName, type GiftDTO, type HumanAvatar, type Look } from "@hyvento/shared";
import { useEffect, useState } from "react";
import type { GiftTarget } from "@/game/social";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "../Cozy";
import { ItemArt, socialApi, useBackpack, useMyBalance } from "./common";

interface Recipient {
  id: string;
  name: string;
  avatar: HumanAvatar;
  look: Look | null;
}

export function GiftForm({ to, onSent, onCancel }: { to: GiftTarget | null; onSent: (gift: GiftDTO) => void; onCancel?: () => void }) {
  const balance = useMyBalance();
  const { inventory } = useBackpack();
  const notify = useOfficeStore((s) => s.notify);
  const [people, setPeople] = useState<Recipient[] | null>(null);
  const [toId, setToId] = useState(to?.userId ?? "");
  const [points, setPoints] = useState(0);
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (to) return;
    socialApi<{ people: Recipient[] }>("/api/gifts/recipients").then(
      (r) => setPeople(r.people),
      (e: Error) => setError(e.message),
    );
  }, [to]);

  const have = inventory?.find((e) => e.itemId === itemId)?.quantity ?? 0;
  const maxPoints = Math.min(GIFT.maxPoints, Math.max(0, balance));
  const maxQuantity = Math.min(GIFT.maxQuantity, have);
  const toName = to?.name ?? people?.find((p) => p.id === toId)?.name ?? "";
  const empty = points <= 0 && !itemId;
  const problem = !toId ? "Elige a quién regalarle." : empty ? "Pon puntos, un objeto o las dos cosas." : points > balance ? "No te alcanzan los puntos." : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problem) return setError(problem);
    setSending(true);
    setError(null);
    try {
      const r = await socialApi<{ gift: GiftDTO }>("/api/gifts", {
        method: "POST",
        body: JSON.stringify({ toId, points, itemId: itemId || null, quantity: itemId ? quantity : 0, note }),
      });
      notify(`Le mandaste a ${toName || "alguien"} ${describeBundle(points, itemId ? [{ itemId, quantity }] : [])}. Le llega al buzón.`, "success");
      onSent(r.gift);
    } catch (err) {
      setError((err as Error).message);
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5">
      {to ? (
        <p className="flex items-center gap-2 text-[15px]">
          <PixelIcon name="gift" size={14} color="var(--color-cozy-red)" />
          Para <strong className="font-semibold">{to.name}</strong>
        </p>
      ) : (
        <label className="flex flex-col gap-1 text-[14px] font-semibold">
          Para quién
          <select value={toId} onChange={(e) => setToId(e.target.value)} className="cozy-input px-3 py-2 text-[14px] font-normal">
            <option value="">{people ? "Elige a alguien del equipo" : "Cargando el equipo…"}</option>
            {people?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex items-center gap-3 text-[14px] font-semibold">
        <PixelIcon name="coin" size={14} color="var(--color-cozy-gold)" />
        Puntos
        <input
          type="number"
          min={0}
          max={maxPoints}
          value={points}
          onChange={(e) => setPoints(Math.max(0, Math.min(maxPoints, Math.floor(Number(e.target.value) || 0))))}
          className="cozy-input w-24 px-3 py-1.5 text-[14px] font-normal"
        />
        <span className="text-[13px] font-normal text-cozy-ink-soft">tienes {balance} (hasta {GIFT.maxPoints} por regalo)</span>
      </label>

      <div className="flex flex-col gap-1.5">
        <p className="text-[14px] font-semibold">Un objeto de tu mochila (opcional)</p>
        {!inventory ? (
          <p className="text-[13px] text-cozy-ink-soft">Abriendo la mochila…</p>
        ) : inventory.length === 0 ? (
          <p className="text-[13px] text-cozy-ink-soft">Tu mochila está vacía: en la tienda hay muebles para regalar.</p>
        ) : (
          <ul className="cozy-scroll flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {inventory.map((e) => (
              <li key={e.itemId}>
                <button
                  type="button"
                  aria-pressed={itemId === e.itemId}
                  onClick={() => {
                    setItemId(itemId === e.itemId ? "" : e.itemId);
                    setQuantity(1);
                  }}
                  title={`${itemName(e.itemId)} (tienes ${e.quantity})`}
                  className="cozy-btn relative p-0.5"
                >
                  <ItemArt itemId={e.itemId} size={44} />
                  <span className="absolute right-0.5 bottom-0 text-[11px] tabular-nums">×{e.quantity}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {itemId && (
          <div className="flex items-center gap-2 text-[14px]">
            <span className="flex-1 font-semibold">{itemName(itemId)}</span>
            <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="Uno menos" className="cozy-btn h-6 w-6 p-0">
              −
            </button>
            <span className="w-7 text-center tabular-nums">{quantity}</span>
            <button type="button" onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))} disabled={quantity >= maxQuantity} aria-label="Uno más" className="cozy-btn h-6 w-6 p-0">
              +
            </button>
          </div>
        )}
      </div>

      <label className="flex flex-col gap-1 text-[14px] font-semibold">
        <span className="flex justify-between">
          Nota
          <span className="font-normal text-cozy-ink-soft tabular-nums">
            {note.length}/{GIFT.noteMax}
          </span>
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, GIFT.noteMax))}
          maxLength={GIFT.noteMax}
          rows={2}
          placeholder="¡Gracias por la ayuda de hoy!"
          className="cozy-input resize-none px-3 py-2 text-[14px] font-normal"
        />
      </label>

      {error && <p className="text-[14px] font-semibold text-cozy-red-deep">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={sending || problem !== null} title={problem ?? undefined} className="cozy-btn cozy-btn-primary">
          <PixelIcon name="gift" size={13} />
          {sending ? "Envolviendo…" : "Regalar"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="cozy-btn">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
