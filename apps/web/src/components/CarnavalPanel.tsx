"use client";

// El Carnaval de Negros y Blancos en el HUD: el puesto (maicena, espuma, serpentinas, algodón de azúcar y máscaras de recuerdo, por
// puntos, solo con el festival abierto), el concurso de disfraces del palco (los postulados con su chibi,
// postular la pinta de ahora y votar una vez) y el botón de sumarse o salirse de la comparsa cuando pasa
// el desfile. El servidor valida todo; aquí solo se pide y se muestra.
import { drawCharacter, drawHeldItem, FRAME, styleFor } from "@hyvento/map/art";
import { CARNAVAL, CARNAVAL_BUY_ERROR_TEXT, CARNAVAL_SHOP, bagItemInfo, isCarnavalSouvenir, objItemId, type CarnavalShopId } from "@hyvento/shared";
import { useEffect, useMemo, useState } from "react";
import { useBagStore } from "@/game/bag";
import { carnavalAhora, postularme, salirseComparsa, sendCarnavalBuy, setNoTalco, sumarseComparsa, useCarnavalStore, votarPor, type CandidatoView } from "@/game/carnaval";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { parseLook } from "@/game/looks";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "./Cozy";
import { PanelShell, useMyPoints } from "./PointsPanels";

/** Si no llega respuesta del servidor en este tiempo, el botón vuelve a estar disponible. */
const PENDING_MS = 3000;

const useCarnavalAbierto = () => useOfficeStore((s) => s.festival.id === CARNAVAL.id && s.festival.fase === "fiesta");

/** "No quiero que me echen maicena, espuma ni serpentinas" (se guarda en este navegador y lo respeta la sala). */
function TalcoToggle() {
  const off = useCarnavalStore((s) => s.noTalco);
  return (
    <label className="mt-3 flex cursor-pointer items-center gap-2 text-[14px] text-cozy-ink">
      <input type="checkbox" checked={off} onChange={(e) => setNoTalco(e.target.checked)} className="h-4 w-4 accent-cozy-red" />
      Prefiero que no me echen maicena, espuma ni serpentinas.
    </label>
  );
}

export function CarnavalShopPanel({ atObject, onClose }: { atObject: boolean; onClose: () => void }) {
  const points = useMyPoints();
  const slots = useBagStore((s) => s.slots);
  const overflow = useBagStore((s) => s.overflow);
  const lastBuy = useCarnavalStore((s) => s.lastBuy);
  const open = useCarnavalAbierto();
  const [pending, setPending] = useState<CarnavalShopId | null>(null);
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
    setError(lastBuy.ok ? null : CARNAVAL_BUY_ERROR_TEXT[lastBuy.error]);
  }, [lastBuy]);
  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => setPending(null), PENDING_MS);
    return () => clearTimeout(id);
  }, [pending]);

  const buy = (id: CarnavalShopId) => {
    setError(null);
    setPending(id);
    sendCarnavalBuy(id);
  };

  return (
    <PanelShell title="Puesto del carnaval" icon="shop" onClose={onClose} wide>
      <div className="flex items-center gap-3 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2">
        <p className="flex-1 text-[15px] leading-snug text-cozy-ink">
          «Maicena para el talco, espuma, serpentinas, algodón de azúcar y máscaras de papel maché. Con F se le echa a quien esté al lado, pero pregunte primero: no a todos les gusta quedar blanquitos.»
        </p>
        <span className="cozy-chip flex shrink-0 items-center gap-1 text-[13px]">
          <PixelIcon name="coin" size={12} color="var(--color-cozy-gold)" />
          {points} pts
        </span>
      </div>
      {!open && <p className="mt-3 text-[14px] text-cozy-ink-soft">El puesto abre en el Carnaval, de las 9:00 a las 18:30 del reloj de la cabaña.</p>}
      {open && !atObject && <p className="mt-3 text-[14px] text-cozy-ink-soft">Para comprar, arrímate al puesto, en la vereda junto al sendero del portón.</p>}
      {error && (
        <p role="alert" className="mt-2 border-2 border-cozy-red bg-cozy-paper-light px-3 py-1.5 text-[14px] text-cozy-red">
          {error}
        </p>
      )}
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {CARNAVAL_SHOP.map((item) => {
          const have = count(item.id);
          const owned = isCarnavalSouvenir(item.id) && have > 0;
          const why = !open ? "Cerrado" : owned ? "Ya es tuya" : !atObject ? "Arrímate al puesto" : points < item.price ? "No te alcanzan los puntos" : have === 0 && free === 0 ? "La mochila está llena" : "";
          return (
            <li key={item.id} className="flex items-center gap-3 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2.5">
              <ItemArt id={item.id} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-tight font-semibold text-cozy-ink">
                  {item.name}
                  {item.gives > 1 ? ` (x${item.gives})` : ""}
                </p>
                <p className="text-[12px] leading-snug text-cozy-ink-soft">{bagItemInfo(objItemId(item.id)).blurb}</p>
                <p className="text-[12px] leading-snug text-cozy-ink-soft">{owned ? "Ya la tienes." : have > 0 ? `Tienes ${have}.` : "No tienes."}</p>
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
                {pending === item.id ? "…" : owned ? "Tuya" : item.price}
              </button>
            </li>
          );
        })}
      </ul>
      <TalcoToggle />
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

const chibiCache = new Map<string, string>();

/** El chibi con la pinta con que se postuló (de frente, quieto). */
function CandidatoChibi({ c }: { c: CandidatoView }) {
  const key = `${c.avatar}|${c.look}`;
  const [src, setSrc] = useState(() => chibiCache.get(key) ?? null);
  useEffect(() => {
    const hit = chibiCache.get(key);
    if (hit) return setSrc(hit);
    const sheet = toHtmlCanvas(drawCharacter(styleFor(c.avatar, parseLook(c.look))));
    const out = document.createElement("canvas");
    out.width = FRAME;
    out.height = FRAME;
    out.getContext("2d")?.drawImage(sheet, 0, 0, FRAME, FRAME, 0, 0, FRAME, FRAME);
    const url = out.toDataURL();
    chibiCache.set(key, url);
    setSrc(url);
  }, [key, c.avatar, c.look]);
  return (
    <span className="grid h-20 w-20 shrink-0 place-items-center border-2 border-cozy-paper-dark bg-cozy-paper">
      {src && <img src={src} alt="" className="h-20 w-20 object-contain [image-rendering:pixelated]" />}
    </span>
  );
}

/** El palco: el concurso de disfraces del Carnaval. */
export function ConcursoPanel({ onClose }: { onClose: () => void }) {
  const open = useCarnavalAbierto();
  const candidatos = useCarnavalStore((s) => s.candidatos);
  const ganador = useCarnavalStore((s) => s.ganador);
  const cerrado = useCarnavalStore((s) => s.cerrado);
  const miVoto = useCarnavalStore((s) => s.miVoto);
  const me = useOfficeStore((s) => (s.sessionId ? s.players[s.sessionId]?.userId : undefined));
  const yaPostulado = candidatos.some((c) => c.userId === me);
  const ganadorNombre = candidatos.find((c) => c.userId === ganador)?.name;
  return (
    <PanelShell title="Concurso de disfraces" icon="trophy" onClose={onClose} wide>
      <div className="border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2 text-[15px] leading-snug text-cozy-ink">
        Postula tu pinta de ahora (la que llevas puesta) y vota por la que más te guste: un voto por persona. A las {CARNAVAL.concursoCierre}:00 del reloj de la cabaña se premia al rey o la reina del Carnaval.
      </div>
      {!open && !cerrado && <p className="mt-3 text-[14px] text-cozy-ink-soft">El concurso es solo en el Carnaval, el día 18 del verano.</p>}
      {cerrado && (
        <p className="mt-3 flex items-center gap-2 border-2 border-cozy-gold bg-cozy-paper-light px-3 py-1.5 text-[15px] text-cozy-ink">
          <PixelIcon name="trophy" size={14} color="var(--color-cozy-gold)" />
          {ganadorNombre ? `Ganó la pinta de ${ganadorNombre}.` : "El concurso cerró sin votos."}
        </p>
      )}
      {open && !cerrado && (
        <button type="button" onClick={postularme} className="cozy-btn cozy-btn-primary mt-3 flex items-center gap-2 px-3 py-1.5 text-[14px]">
          <PixelIcon name="star" size={12} />
          {yaPostulado ? "Actualizar mi pinta" : "Postular mi pinta"}
        </button>
      )}
      {candidatos.length === 0 ? (
        <p className="mt-3 text-[14px] text-cozy-ink-soft">Todavía no se postula nadie.</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {candidatos.map((c) => {
            const mio = c.userId === me;
            const voted = miVoto === c.userId;
            const why = !open || cerrado ? "El concurso no está abierto" : mio ? "No puedes votar por ti" : miVoto ? "Ya votaste" : "";
            return (
              <li key={c.userId} className="flex items-center gap-3 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2" data-on={ganador === c.userId || undefined}>
                <CandidatoChibi c={c} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-cozy-ink">{c.name}</p>
                  <p className="flex items-center gap-1 text-[13px] text-cozy-ink-soft">
                    <PixelIcon name="heart" size={10} color="var(--color-cozy-red)" />
                    {c.votos === 1 ? "1 voto" : `${c.votos} votos`}
                    {voted ? " · tu voto" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => votarPor(c.userId)}
                  disabled={Boolean(why)}
                  title={why || `Votar por ${c.name}`}
                  className="cozy-btn flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-[14px]"
                  aria-pressed={voted}
                >
                  <PixelIcon name="heart" size={10} />
                  Votar
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <TalcoToggle />
    </PanelShell>
  );
}

/** Cuando pasa el desfile: sumarse a la comparsa desde la vereda, o salirse si ya se va bailando. */
export function ComparsaPrompt() {
  const puede = useCarnavalStore((s) => s.puedoSumarme);
  const voy = useCarnavalStore((s) => s.enComparsa);
  const panel = useOfficeStore((s) => s.panel);
  if ((!puede && !voy) || panel || !carnavalAhora()) return null;
  return voy ? (
    <button type="button" onClick={salirseComparsa} className="cozy-chip pointer-events-auto flex items-center gap-2 px-3 py-1.5 text-[14px]">
      <PixelIcon name="close" size={12} />
      Salir de la comparsa <span className="cozy-kbd">Esc</span>
    </button>
  ) : (
    <button type="button" onClick={sumarseComparsa} className="cozy-chip pointer-events-auto flex items-center gap-2 px-3 py-1.5 text-[14px]">
      <span className="cozy-kbd">E</span>
      Sumarse a la comparsa
    </button>
  );
}
