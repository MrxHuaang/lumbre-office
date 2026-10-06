"use client";

// La Feria de las flores en el HUD: la mesa del silletero (se eligen las flores y dónde va cada una en la
// grilla, con la vista previa de la silleta), el puesto de las semillas y el exhibidor (exhibir la silleta
// de la mano o votar por la de otro, con la lista de las exhibidas). El servidor valida todo.
import { drawHeldItem } from "@hyvento/map/art";
import {
  FERIA_SHOP,
  FLOWER_CROPS,
  SILLETA,
  SILLETA_LETRAS,
  SILLETA_VACIA,
  bagItemInfo,
  missingFlowers,
  objItemId,
  silletaFlowerCount,
  silletaName,
  validSilletaCode,
  type SilletaLetra,
} from "@hyvento/shared";
import { useEffect, useMemo, useState } from "react";
import { useBagStore } from "@/game/bag";
import { feriaNow, heldSilleta, sendFeriaBuy, sendSilletaBuild, sendSilletaExhibit, sendSilletaVote, useFeriaStore } from "@/game/feriaFlores";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { selectMyUserId, useOfficeStore } from "@/game/store";
import { PixelIcon } from "./Cozy";
import { PanelShell, useMyPoints } from "./PointsPanels";

/** Si no llega respuesta del servidor en este tiempo, los botones vuelven a estar disponibles. */
const PENDING_MS = 3000;

type FeriaKind = "feriaTable" | "feriaShop" | "silletaStand";

export function FeriaPanel({ kind, atObject, onClose }: { kind: FeriaKind; atObject: boolean; onClose: () => void }) {
  const open = useOfficeStore((s) => s.festival.id === "feria-flores" && s.festival.fase === "fiesta");
  const title = kind === "feriaTable" ? "Mesa del silletero" : kind === "feriaShop" ? "Puesto de las flores" : "Exhibidor de silletas";
  return (
    <PanelShell title={title} icon="flower" onClose={onClose} wide>
      {!open && <p className="mb-3 text-[14px] text-cozy-ink-soft">La feria abre el 15 de la primavera, de las 9:00 a las 22:00 del reloj de la cabaña.</p>}
      {kind === "feriaTable" && <Mesa atObject={atObject} open={open} />}
      {kind === "feriaShop" && <Puesto atObject={atObject} open={open} />}
      {kind === "silletaStand" && <Exhibidor atObject={atObject} open={open} />}
    </PanelShell>
  );
}

/** Lo que hay de cada cosa en la mochila. */
function useBagCount() {
  const slots = useBagStore((s) => s.slots);
  const overflow = useBagStore((s) => s.overflow);
  return useMemo(() => {
    const have = new Map<string, number>();
    for (const s of [...slots, ...overflow]) if (s) have.set(s.itemId, (have.get(s.itemId) ?? 0) + s.quantity);
    return (id: string) => have.get(objItemId(id)) ?? 0;
  }, [slots, overflow]);
}

/** Un botón que espera la respuesta del servidor: se suelta al llegar (o a los 3 s). */
function usePending(kind: "build" | "exhibit" | "vote" | "buy") {
  const last = useFeriaStore((s) => s.last);
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    if (last?.kind === kind) setPending(null);
  }, [last, kind]);
  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => setPending(null), PENDING_MS);
    return () => clearTimeout(id);
  }, [pending]);
  return [pending, setPending] as const;
}

const LETRAS = Object.keys(SILLETA_LETRAS) as SilletaLetra[];
const EMPTY = SILLETA_VACIA.repeat(SILLETA.cells);

function Mesa({ atObject, open }: { atObject: boolean; open: boolean }) {
  const count = useBagCount();
  const [code, setCode] = useState(EMPTY);
  const [brush, setBrush] = useState<SilletaLetra | typeof SILLETA_VACIA>("c");
  const [pending, setPending] = usePending("build");
  const missing = missingFlowers(code, count);
  const flores = silletaFlowerCount(code);
  const why = !open ? "La mesa abre en la feria" : !atObject ? "Arrímate a la mesa del silletero" : flores < SILLETA.minFlores ? `Pon por lo menos ${SILLETA.minFlores} flores` : Object.keys(missing).length ? "Te faltan flores" : "";

  const paint = (i: number) => setCode((c) => c.slice(0, i) + (c[i] === brush ? SILLETA_VACIA : brush) + c.slice(i + 1));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] leading-snug text-cozy-ink">
        Elige una flor y toca las casillas del marco. Cada flor sale de tu mochila: se siembran en el huerto con las semillas del puesto de la feria.
      </p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Flor">
        {[...LETRAS, SILLETA_VACIA].map((l) => {
          const flower = SILLETA_LETRAS[l as SilletaLetra];
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={brush === l}
              data-on={brush === l || undefined}
              onClick={() => setBrush(l as SilletaLetra)}
              className="cozy-btn flex items-center gap-1.5 px-2 py-1 text-[14px]"
            >
              {flower ? <ItemArt id={flower} small /> : <PixelIcon name="close" size={12} />}
              {flower ? `${bagItemInfo(objItemId(flower)).name} (${count(flower)})` : "Quitar"}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-start gap-4">
        <div className="grid gap-1 border-4 border-cozy-wood bg-cozy-wood p-1" style={{ gridTemplateColumns: `repeat(${SILLETA.cols}, 2.75rem)` }}>
          {[...code].map((ch, i) => {
            const flower = SILLETA_LETRAS[ch as SilletaLetra];
            return (
              <button
                key={i}
                type="button"
                onClick={() => paint(i)}
                aria-label={`Casilla ${i + 1}: ${flower ? bagItemInfo(objItemId(flower)).name : "vacía"}`}
                className="grid h-11 w-11 place-items-center bg-cozy-paper-light hover:bg-cozy-paper"
              >
                {flower && <ItemArt id={flower} small />}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col items-center gap-1">
          <ItemArt id={`silleta:${validSilletaCode(code) ? code : "cagh" + "hgac" + "cagh"}`} big faded={!validSilletaCode(code)} />
          <span className="text-[13px] text-cozy-ink-soft">{validSilletaCode(code) ? silletaName(code) : "Vista previa"}</span>
        </div>
      </div>
      <p className="text-[14px] text-cozy-ink-soft">
        {flores} de {SILLETA.cells} casillas con flor.
        {Object.keys(missing).length > 0 && ` Te faltan: ${Object.entries(missing).map(([f, n]) => `${n} ${bagItemInfo(objItemId(f)).name.toLowerCase()}`).join(", ")}.`}
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setCode(EMPTY)} className="cozy-btn px-3 py-1.5 text-[14px]">
          Vaciar
        </button>
        <button
          type="button"
          disabled={Boolean(why) || pending !== null}
          title={why || "Armar la silleta"}
          onClick={() => {
            setPending("build");
            sendSilletaBuild(code);
          }}
          className="cozy-btn cozy-btn-primary flex items-center gap-1.5 px-3 py-1.5 text-[14px]"
        >
          <PixelIcon name="flower" size={12} />
          {pending ? "Armando..." : "Armar la silleta"}
        </button>
      </div>
    </div>
  );
}

function Puesto({ atObject, open }: { atObject: boolean; open: boolean }) {
  const points = useMyPoints();
  const count = useBagCount();
  const [pending, setPending] = usePending("buy");
  return (
    <div>
      <div className="flex items-center gap-3 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2">
        <p className="flex-1 text-[15px] leading-snug text-cozy-ink">
          «Semillas de flores, solo en la feria. Se siembran en el huerto y en primavera se dan rapidito: cada mata da un ramito.»
        </p>
        <span className="cozy-chip flex shrink-0 items-center gap-1 text-[13px]">
          <PixelIcon name="coin" size={12} color="var(--color-cozy-gold)" />
          {points} pts
        </span>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {FERIA_SHOP.map((item) => {
          const have = count(item.id);
          const why = !open ? "Cerrado" : !atObject ? "Arrímate al puesto" : points < item.price ? "No te alcanzan los puntos" : "";
          const crop = FLOWER_CROPS.find((c) => item.id.endsWith(c.id));
          return (
            <li key={item.id} className="flex items-center gap-3 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2.5">
              <ItemArt id={item.id} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-tight font-semibold text-cozy-ink">{item.name}</p>
                <p className="text-[12px] leading-snug text-cozy-ink-soft">{crop ? `Crece en ${Math.round(crop.growMs / 60_000)} min (menos en primavera) y da ${crop.yield ?? 1}.` : ""}</p>
                <p className="text-[12px] leading-snug text-cozy-ink-soft">{have > 0 ? `Tienes ${have}.` : "No tienes."}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPending(item.id);
                  sendFeriaBuy(item.id);
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

function Exhibidor({ atObject, open }: { atObject: boolean; open: boolean }) {
  const stand = useFeriaStore((s) => s.stand);
  const exhibits = useFeriaStore((s) => s.exhibits);
  const mine = useFeriaStore((s) => s.mine);
  const winner = useFeriaStore((s) => s.winner);
  const me = useOfficeStore(selectMyUserId);
  const holding = useOfficeStore((s) => (s.sessionId ? s.players[s.sessionId]?.held : "")) ?? "";
  const [pending, setPending] = usePending(stand && exhibits[stand] ? "vote" : "exhibit");
  const here = stand ? exhibits[stand] : undefined;
  const code = holding ? heldSilleta() : null;
  const already = Object.values(exhibits).some((e) => e.ownerId === me);
  const all = Object.values(exhibits).sort((a, b) => b.votes - a.votes);

  let action: React.ReactNode = null;
  if (stand && !here) {
    const why = !open ? "La exhibición es durante la feria" : !atObject ? "Arrímate al exhibidor" : already ? "Tu silleta ya está exhibida" : !code ? "Lleva tu silleta en la mano" : "";
    action = (
      <button
        type="button"
        disabled={Boolean(why) || pending !== null}
        title={why || "Exhibir mi silleta"}
        onClick={() => {
          setPending("exhibit");
          sendSilletaExhibit(stand);
        }}
        className="cozy-btn cozy-btn-primary flex items-center gap-1.5 px-3 py-1.5 text-[14px]"
      >
        <PixelIcon name="flower" size={12} />
        {why || "Exhibir mi silleta aquí"}
      </button>
    );
  } else if (stand && here) {
    const own = here.ownerId === me;
    const why = !open ? "La votación es durante la feria" : own ? "Es tu silleta" : mine.voted ? (mine.stand === stand ? "Votaste por esta" : "Ya votaste") : !atObject ? "Arrímate a la silleta" : "";
    action = (
      <button
        type="button"
        disabled={Boolean(why) || pending !== null}
        title={why || "Votar por esta silleta"}
        onClick={() => {
          setPending("vote");
          sendSilletaVote(stand);
        }}
        className="cozy-btn cozy-btn-primary flex items-center gap-1.5 px-3 py-1.5 text-[14px]"
      >
        <PixelIcon name="heart" size={12} />
        {why || "Votar por esta"}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {winner.name && (
        <p className="flex items-center gap-2 border-2 border-cozy-gold bg-cozy-paper-light px-3 py-2 text-[15px] text-cozy-ink">
          <PixelIcon name="trophy" size={14} color="var(--color-cozy-gold)" />
          Silletero de oro: {winner.name}, con {winner.votes} {winner.votes === 1 ? "voto" : "votos"}.
        </p>
      )}
      {stand && (
        <div className="flex items-center gap-4 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-3">
          {here ? <ItemArt id={`silleta:${here.code}`} big /> : <span className="grid h-24 w-24 place-items-center border-2 border-dashed border-cozy-paper-dark text-[13px] text-cozy-ink-soft">Libre</span>}
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
            <p className="text-[16px] font-semibold text-cozy-ink">{here ? silletaName(here.code) : "Exhibidor libre"}</p>
            <p className="text-[14px] text-cozy-ink-soft">
              {here ? `De ${here.ownerName} · ${here.votes} ${here.votes === 1 ? "voto" : "votos"}` : "Trae tu silleta en la mano y exhíbela aquí: una por persona."}
            </p>
            {action}
          </div>
        </div>
      )}
      <div>
        <h3 className="mb-1 text-[15px] font-semibold text-cozy-ink">Las silletas de la feria</h3>
        {all.length === 0 && <p className="text-[14px] text-cozy-ink-soft">Todavía no hay ninguna exhibida.</p>}
        <ul className="grid gap-2 sm:grid-cols-2">
          {all.map((e) => (
            <li key={e.stand} className="flex items-center gap-2 border-2 border-cozy-paper-dark bg-cozy-paper-light px-2 py-1.5">
              <ItemArt id={`silleta:${e.code}`} />
              <div className="min-w-0 flex-1 text-[13px] leading-tight text-cozy-ink">
                <p className="font-semibold">{e.ownerName}</p>
                <p className="text-cozy-ink-soft">
                  {e.votes} {e.votes === 1 ? "voto" : "votos"}
                  {mine.stand === e.stand ? " · tu voto" : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[13px] text-cozy-ink-soft">Cada quien vota una vez. Al cierre (22:00) gana la más votada.</p>
      </div>
    </div>
  );
}

const artCache = new Map<string, string>();

/** Algo de la mochila en pixel-art, ampliado sin suavizar. */
function ItemArt({ id, small = false, big = false, faded = false }: { id: string; small?: boolean; big?: boolean; faded?: boolean }) {
  const [src, setSrc] = useState(() => artCache.get(id) ?? null);
  useEffect(() => {
    if (artCache.has(id)) return setSrc(artCache.get(id)!);
    const url = toHtmlCanvas(drawHeldItem(id)).toDataURL();
    artCache.set(id, url);
    setSrc(url);
  }, [id]);
  const box = small ? "h-7 w-7" : big ? "h-24 w-24" : "h-12 w-12";
  const img = small ? "h-6 w-6" : big ? "h-20 w-20" : "h-10 w-10";
  return (
    <span className={`grid ${box} shrink-0 place-items-center ${small ? "" : "border-2 border-cozy-paper-dark bg-cozy-paper"} ${faded ? "opacity-40" : ""}`}>
      {src && <img src={src} alt="" className={`${img} object-contain [image-rendering:pixelated]`} />}
    </span>
  );
}
