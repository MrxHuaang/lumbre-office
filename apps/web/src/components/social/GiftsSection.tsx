"use client";

// Los regalos en el buzón: "Tienes N regalos" con la caja que se abre, regalarle a alguien del equipo
// (aunque no esté conectado) y el historial de lo recibido y lo enviado.
import { describeBundle, GIFT, type GiftDTO, type GiftsState } from "@hyvento/shared";
import { useCallback, useEffect, useState } from "react";
import { useSocialStore } from "@/game/social";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "../Cozy";
import { GiftBoxArt, ItemArt, socialApi } from "./common";
import { GiftForm } from "./GiftForm";

const bundleOf = (g: GiftDTO) => describeBundle(g.points, g.itemId ? [{ itemId: g.itemId, quantity: g.quantity }] : []);

const ago = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
};

export function GiftsSection() {
  const [data, setData] = useState<GiftsState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [tab, setTab] = useState<"received" | "sent">("received");
  const setUnopened = useSocialStore((s) => s.setUnopened);
  // Si llega un regalo con el buzón abierto, se vuelve a leer.
  const live = useSocialStore((s) => s.unopened);

  const load = useCallback(() => {
    socialApi<GiftsState>("/api/gifts").then(
      (r) => {
        setData(r);
        setUnopened(r.unopened);
      },
      (e: Error) => setError(e.message),
    );
  }, [setUnopened]);
  useEffect(load, [load]);
  useEffect(() => {
    if (data && live !== null && live > data.unopened) load();
  }, [live, data, load]);

  if (!data) return <p className="text-[14px] text-cozy-ink-soft">{error ?? "Buscando regalos…"}</p>;
  const waiting = data.received.filter((g) => !g.openedAt);
  const history = tab === "received" ? data.received.filter((g) => g.openedAt) : data.sent;

  return (
    <section className="flex flex-col gap-3">
      <p className="flex items-center justify-between text-[15px] font-semibold">
        <span className="flex items-center gap-2">
          <PixelIcon name="gift" size={14} color="var(--color-cozy-red)" />
          {data.unopened > 0 ? `Tienes ${data.unopened} ${data.unopened === 1 ? "regalo" : "regalos"}` : "Regalos"}
        </span>
        {!composing && (
          <button type="button" onClick={() => setComposing(true)} className="cozy-btn px-2.5 py-1 text-[13px] font-normal">
            + Regalar a alguien
          </button>
        )}
      </p>

      {composing && (
        <div className="border-2 border-cozy-wood bg-cozy-paper-light p-3.5">
          <GiftForm
            to={null}
            onCancel={() => setComposing(false)}
            onSent={() => {
              setComposing(false);
              setTab("sent");
              load();
            }}
          />
        </div>
      )}

      {waiting.length > 0 && (
        <ul className="flex flex-col gap-2">
          {waiting.map((g) => (
            <UnopenedGift key={g.id} gift={g} onOpened={load} />
          ))}
        </ul>
      )}

      <div role="tablist" className="flex gap-2">
        <button type="button" role="tab" aria-selected={tab === "received"} onClick={() => setTab("received")} className="cozy-btn px-2.5 py-1 text-[13px]">
          Recibidos
        </button>
        <button type="button" role="tab" aria-selected={tab === "sent"} onClick={() => setTab("sent")} className="cozy-btn px-2.5 py-1 text-[13px]">
          Enviados
        </button>
        <span className="ml-auto self-center text-[12px] text-cozy-ink-soft">
          Hoy: {data.today.gifts}/{GIFT.dailyGifts} regalos · {data.today.items}/{GIFT.dailyItems} muebles
        </span>
      </div>
      {history.length === 0 ? (
        <p className="text-[14px] text-cozy-ink-soft">
          {tab === "received" ? "Todavía no abriste ningún regalo." : "Todavía no le regalaste nada a nadie."}
        </p>
      ) : (
        <ul>
          {history.map((g) => (
            <li key={g.id} className="flex items-start gap-2.5 border-b-2 border-cozy-paper-dark py-1.5 text-[14px] last:border-b-0">
              {g.itemId ? <ItemArt itemId={g.itemId} size={30} /> : <PixelIcon name="coin" size={16} color="var(--color-cozy-gold)" className="mt-1 mx-[7px]" />}
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{tab === "received" ? `De ${g.from.name}` : `Para ${g.to.name}`}</span> · {bundleOf(g)}
                {g.note && <span className="block truncate text-[13px] text-cozy-ink-soft italic">“{g.note}”</span>}
                {tab === "sent" && !g.openedAt && <span className="block text-[12px] text-cozy-ink-soft">Sin abrir todavía</span>}
              </span>
              <span className="shrink-0 text-[12px] text-cozy-ink-soft">{ago(g.openedAt ?? g.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Un regalo sin abrir: la caja cerrada; al abrirla se sacude, salta la tapa y se ve lo que trae. */
function UnopenedGift({ gift, onOpened }: { gift: GiftDTO; onOpened: () => void }) {
  const [stage, setStage] = useState<"closed" | "opening" | "open">("closed");
  const [error, setError] = useState<string | null>(null);
  const notify = useOfficeStore((s) => s.notify);

  const open = async () => {
    setStage("opening");
    setError(null);
    try {
      await socialApi(`/api/gifts/${gift.id}/open`, { method: "POST" });
    } catch (e) {
      setError((e as Error).message);
      setStage("closed");
    }
  };

  return (
    <li className="flex items-center gap-3 border-2 border-cozy-wood bg-cozy-paper-light px-3 py-2.5">
      <GiftBoxArt
        opening={stage !== "closed"}
        scale={3}
        onOpened={() => {
          setStage("open");
          notify(`Abriste el regalo de ${gift.from.name}: ${bundleOf(gift)}.`, "success");
        }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">De {gift.from.name}</p>
        {stage === "open" ? (
          <p className="text-[14px] text-cozy-green">¡{bundleOf(gift)}!</p>
        ) : (
          <p className="text-[13px] text-cozy-ink-soft">{ago(gift.createdAt)}</p>
        )}
        {gift.note && stage === "open" && <p className="mt-0.5 text-[13px] leading-snug italic">“{gift.note}”</p>}
        {error && <p className="text-[13px] font-semibold text-cozy-red-deep">{error}</p>}
      </div>
      {stage === "open" ? (
        <button type="button" onClick={onOpened} className="cozy-btn px-2.5 py-1 text-[13px]">
          Guardar
        </button>
      ) : (
        <button type="button" onClick={() => void open()} disabled={stage === "opening"} className="cozy-btn cozy-btn-primary px-3 py-1.5">
          Abrir
        </button>
      )}
    </li>
  );
}
