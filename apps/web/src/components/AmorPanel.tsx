"use client";

// Amor y amistad en el HUD: el cofre del amigo secreto (anotarse, a quién le tocó, dejarle un detalle de la
// mochila con una notita y lo que le han dejado a uno), el trío de la serenata (a quién y con cuánta
// propina), el puesto de chocolates y flores, y la carta anónima del buzón (la lleva Cupido). El servidor
// valida todo (rooms/amorAmistad.ts); aquí solo se pide y se muestra.
import { drawHeldItem } from "@hyvento/map/art";
import { AMOR, AMOR_SHOP, SERENATA, bagItemInfo, objItemId, regalable } from "@hyvento/shared";
import { useEffect, useMemo, useState } from "react";
import { sendAmorCompra, sendAnotar, sendRegalo, sendSerenata, useAmorStore } from "@/game/amorAmistad";
import { Persona, usePending } from "./AmorCarta";
import { useBagStore } from "@/game/bag";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "./Cozy";
import { PanelShell, useMyPoints } from "./PointsPanels";

type AmorKind = "amorCofre" | "amorShop" | "amorSerenata";

const TITULO: Record<AmorKind, string> = { amorCofre: "Cofre del amigo secreto", amorShop: "Puesto de chocolates y flores", amorSerenata: "Los Trovadores de la Vereda" };

export function AmorPanel({ kind, atObject, onClose }: { kind: AmorKind; atObject: boolean; onClose: () => void }) {
  const open = useOfficeStore((s) => s.festival.id === AMOR.id && s.festival.fase === "fiesta");
  return (
    <PanelShell title={TITULO[kind]} icon="heart" onClose={onClose} wide={kind === "amorCofre"}>
      {!open && <p className="mb-3 text-[14px] text-cozy-ink-soft">Amor y amistad es el 7 de la primavera, de las 9:00 a las 22:00 del reloj de la cabaña.</p>}
      {kind === "amorCofre" && <Cofre atObject={atObject} open={open} />}
      {kind === "amorShop" && <Puesto atObject={atObject} open={open} />}
      {kind === "amorSerenata" && <Serenata atObject={atObject} open={open} />}
    </PanelShell>
  );
}

/** Lo que se puede regalar de la mochila (con cuántos hay). */
function useRegalables() {
  const slots = useBagStore((s) => s.slots);
  const overflow = useBagStore((s) => s.overflow);
  return useMemo(() => {
    const have = new Map<string, number>();
    for (const s of [...slots, ...overflow]) if (s && regalable(s.itemId, bagItemInfo(s.itemId))) have.set(s.itemId, (have.get(s.itemId) ?? 0) + s.quantity);
    return [...have].map(([itemId, n]) => ({ itemId, n, name: bagItemInfo(itemId).name }));
  }, [slots, overflow]);
}

function Cofre({ atObject, open }: { atObject: boolean; open: boolean }) {
  const e = useAmorStore((s) => s.estado);
  const items = useRegalables();
  const [pendingA, setPendingA] = usePending("anotar");
  const [pendingR, setPendingR] = usePending("regalo");
  const [para, setPara] = useState<string>("");
  const [item, setItem] = useState<string>("");
  const [nota, setNota] = useState("");
  const amigo = e.amigos.find((a) => a.userId === para) ?? e.amigos[0];
  const elegido = items.find((i) => i.itemId === item) ?? null;
  const whyAnotar = !open ? "Abre en la fiesta" : !atObject ? "Acérquese al cofre" : "";
  const whyRegalo = !open
    ? "Abre en la fiesta"
    : !atObject
      ? "Acérquese al cofre"
      : !amigo
        ? "Todavía no hay sorteo"
        : !amigo.online
          ? `${amigo.name} no está en la cabaña`
          : !elegido
            ? "Elija qué le deja"
            : e.regalosDados >= AMOR.regalosMax
              ? "Ya dejó todos los detalles de hoy"
              : "";

  return (
    <div className="flex flex-col gap-4">
      <p className="border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2 text-[15px] leading-snug text-cozy-ink">
        «Anótese y a las 10:00 se sortea quién le regala a quién. Durante el día déjele detalles de su mochila con una notita, sin firma. Al cierre se sabe todo.»
      </p>
      {!e.anotado ? (
        <button
          type="button"
          disabled={Boolean(whyAnotar) || pendingA !== null}
          title={whyAnotar || "Anotarme"}
          onClick={() => {
            setPendingA("anotar");
            sendAnotar();
          }}
          className="cozy-btn cozy-btn-primary flex items-center gap-1.5 self-start px-3 py-1.5 text-[15px]"
        >
          <PixelIcon name="heart" size={12} />
          {whyAnotar || "Anotarme al amigo secreto"}
        </button>
      ) : (
        <section className="flex flex-col gap-2">
          <p className="text-[15px] font-semibold text-cozy-ink">
            {e.sorteado ? (e.amigos.length ? `Su amigo secreto: ${e.amigos.map((a) => a.name).join(" y ")}` : "Ya hubo sorteo: en un ratico le toca el suyo.") : `Anotados: ${e.anotados}. El sorteo es a las 10:00.`}
          </p>
          {e.amigos.length > 1 && (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Para quién">
              {e.amigos.map((a) => (
                <button key={a.userId} type="button" role="radio" aria-checked={amigo?.userId === a.userId} data-on={amigo?.userId === a.userId || undefined} onClick={() => setPara(a.userId)} className="cozy-btn px-2 py-1 text-[14px]">
                  {a.name}
                </button>
              ))}
            </div>
          )}
          {amigo && (
            <>
              <p className="text-[14px] text-cozy-ink-soft">Elija qué le deja (de su mochila):</p>
              {items.length === 0 ? (
                <p className="text-[14px] text-cozy-ink-soft">No tiene nada para regalar. En el puesto de Doña Rubiela hay chocolatinas, rosas y tarjetas.</p>
              ) : (
                <ul className="cozy-scroll grid max-h-44 gap-1.5 overflow-y-auto sm:grid-cols-2">
                  {items.map((i) => (
                    <li key={i.itemId}>
                      <button
                        type="button"
                        aria-pressed={item === i.itemId}
                        data-on={item === i.itemId || undefined}
                        onClick={() => setItem(i.itemId)}
                        className="cozy-btn flex w-full items-center gap-2 px-2 py-1 text-left text-[14px]"
                      >
                        <ItemArt id={i.itemId.slice(4)} small />
                        <span className="min-w-0 flex-1 truncate">{i.name}</span>
                        <span className="text-[12px] text-cozy-ink-soft">x{i.n}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <label className="flex flex-col gap-1 text-[14px] text-cozy-ink">
                Notita (opcional, sin firma)
                <input className="cozy-input px-2 py-1 text-[15px]" value={nota} maxLength={AMOR.notaMax} onChange={(ev) => setNota(ev.target.value)} placeholder="Para que le endulce el día" />
              </label>
              <button
                type="button"
                disabled={Boolean(whyRegalo) || pendingR !== null}
                title={whyRegalo || "Dejar el detalle"}
                onClick={() => {
                  if (!amigo || !elegido) return;
                  setPendingR("regalo");
                  sendRegalo(amigo.userId, elegido.itemId, nota);
                  setNota("");
                }}
                className="cozy-btn cozy-btn-primary flex items-center gap-1.5 self-start px-3 py-1.5 text-[15px]"
              >
                <PixelIcon name="gift" size={12} />
                {whyRegalo || `Dejarle ${elegido?.name.toLowerCase() ?? "el detalle"}`}
              </button>
              <p className="text-[13px] text-cozy-ink-soft">
                Detalles dejados hoy: {e.regalosDados} de {AMOR.regalosMax}.
              </p>
            </>
          )}
        </section>
      )}
      <section className="flex flex-col gap-1.5">
        <p className="text-[15px] font-semibold text-cozy-ink">Lo que le han dejado</p>
        {e.recibidos.length === 0 ? (
          <p className="text-[14px] text-cozy-ink-soft">Todavía nada. Paciencia, que su amigo secreto anda pensando.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {e.recibidos.map((r, i) => (
              <li key={i} className="flex items-center gap-2 border-2 border-cozy-paper-dark bg-cozy-paper-light px-2 py-1 text-[14px] text-cozy-ink">
                <ItemArt id={r.item.slice(4)} small />
                <span className="font-semibold">{bagItemInfo(r.item).name}</span>
                {r.nota && <span className="min-w-0 flex-1 truncate text-cozy-ink-soft">«{r.nota}»</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Serenata({ atObject, open }: { atObject: boolean; open: boolean }) {
  const hasta = useAmorStore((s) => s.estado.serenataHasta);
  const points = useMyPoints();
  const [para, setPara] = useState("");
  const [propina, setPropina] = useState<number>(SERENATA.propinas[0]);
  const [anonima, setAnonima] = useState(false);
  const [pending, setPending] = usePending("serenata");
  const ocupado = hasta > 0;
  const why = !open ? "Abre en la fiesta" : !atObject ? "Acérquese al trío" : !para ? "Elija a quién" : ocupado ? "El trío está tocando o descansando" : points < propina ? "No le alcanzan los puntos" : "";
  return (
    <div className="flex flex-col gap-3">
      <p className="border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2 text-[15px] leading-snug text-cozy-ink">
        «Tiple, guitarra y requinto. Díganos a quién y le llegamos a donde esté con un pasillo que compusimos para la cabaña. Una serenata a la vez.»
      </p>
      <Persona value={para} onChange={setPara} />
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Propina">
        <span className="text-[14px] text-cozy-ink">Propina:</span>
        {SERENATA.propinas.map((p) => (
          <button key={p} type="button" role="radio" aria-checked={propina === p} data-on={propina === p || undefined} onClick={() => setPropina(p)} className="cozy-btn flex items-center gap-1 px-2 py-1 text-[14px]">
            <PixelIcon name="coin" size={12} color="var(--color-cozy-gold)" />
            {p}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-[14px] text-cozy-ink">
        <input type="checkbox" checked={anonima} onChange={(ev) => setAnonima(ev.target.checked)} />
        Que no digan de parte de quién
      </label>
      <button
        type="button"
        disabled={Boolean(why) || pending !== null}
        title={why || "Pedir la serenata"}
        onClick={() => {
          setPending("serenata");
          sendSerenata(para, propina, anonima);
        }}
        className="cozy-btn cozy-btn-primary flex items-center gap-1.5 self-start px-3 py-1.5 text-[15px]"
      >
        <PixelIcon name="note" size={12} />
        {why || "Pedir la serenata"}
      </button>
    </div>
  );
}

function Puesto({ atObject, open }: { atObject: boolean; open: boolean }) {
  const points = useMyPoints();
  const [pending, setPending] = usePending("comprar");
  return (
    <div>
      <div className="flex items-center gap-3 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2">
        <p className="flex-1 text-[15px] leading-snug text-cozy-ink">«Chocolatinas, rosas y tarjetas para el amigo secreto, y para el que no es tan secreto.»</p>
        <span className="cozy-chip flex shrink-0 items-center gap-1 text-[13px]">
          <PixelIcon name="coin" size={12} color="var(--color-cozy-gold)" />
          {points} pts
        </span>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {AMOR_SHOP.map((item) => {
          const why = !open ? "Cerrado" : !atObject ? "Acérquese al puesto" : points < item.price ? "No le alcanzan los puntos" : "";
          return (
            <li key={item.id} className="flex items-center gap-3 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2.5">
              <ItemArt id={item.id} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-tight font-semibold text-cozy-ink">{item.name}</p>
                <p className="text-[12px] leading-snug text-cozy-ink-soft">{bagItemInfo(objItemId(item.id)).blurb}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPending(item.id);
                  sendAmorCompra(item.id);
                }}
                disabled={Boolean(why) || pending !== null}
                title={why || `Comprar ${item.name}`}
                aria-label={`Comprar ${item.name} por ${item.price} puntos`}
                className="cozy-btn cozy-btn-primary flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-[14px]"
              >
                <PixelIcon name="coin" size={12} color="var(--color-cozy-gold)" />
                {pending === item.id ? "..." : item.price}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const artCache = new Map<string, string>();

/** Algo de la mochila en pixel-art, ampliado sin suavizar. */
function ItemArt({ id, small = false }: { id: string; small?: boolean }) {
  const [src, setSrc] = useState(() => artCache.get(id) ?? null);
  useEffect(() => {
    if (artCache.has(id)) return setSrc(artCache.get(id)!);
    const url = toHtmlCanvas(drawHeldItem(id)).toDataURL();
    artCache.set(id, url);
    setSrc(url);
  }, [id]);
  const box = small ? "h-7 w-7" : "h-12 w-12";
  const img = small ? "h-6 w-6" : "h-10 w-10";
  return (
    <span className={`grid ${box} shrink-0 place-items-center ${small ? "" : "border-2 border-cozy-paper-dark bg-cozy-paper"}`}>
      {src && <img src={src} alt="" className={`${img} object-contain [image-rendering:pixelated]`} />}
    </span>
  );
}
