"use client";

// La Feria de la cosecha en el HUD: el puesto del mercado que se abrió (lo que compra con el precio de ahora,
// lo que vende y cuánto lleva vendido), la olla del sancocho (lo que lleva, lo que falta y echarle lo de la
// mochila), la báscula y el tablero del concurso de la ahuyama y la tómbola de la junta. El servidor valida
// todo; aquí solo se pide y se muestra.
import { drawFurniture, drawHeldItem } from "@hyvento/map/art";
import {
  AHUYAMA,
  COSECHA,
  OLLA_RECETA,
  TOMBOLA_PREMIO,
  bagItemInfo,
  baseDeVenta,
  objIdOf,
  objItemId,
  ollaProgreso,
  pesoTexto,
  precioDeCompra,
  puestoById,
  puestoQueMasPaga,
  rankingAhuyamas,
} from "@hyvento/shared";
import { useEffect, useMemo, useState } from "react";
import { useBagStore } from "@/game/bag";
import { bailarBambuco, cosechaNow, heldAhuyama, sendAportar, sendBoleta, sendComprar, sendPesar, sendVender, useCosechaStore } from "@/game/cosecha";
import { useGameTime } from "@/game/gameClock";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { selectMyUserId, useOfficeStore } from "@/game/store";
import { PixelIcon, type PixelIconName } from "./Cozy";
import { PanelShell, useMyPoints } from "./PointsPanels";

/** Si no llega respuesta del servidor en este tiempo, los botones vuelven a estar disponibles. */
const PENDING_MS = 3000;

export type CosechaKind = "cosechaPuesto" | "cosechaOlla" | "cosechaBascula" | "cosechaTablero" | "cosechaTombola";

const TITULOS: Record<CosechaKind, [string, PixelIconName]> = {
  cosechaPuesto: ["Mercado campesino", "shop"],
  cosechaOlla: ["La olla del sancocho", "pot"],
  cosechaBascula: ["La báscula del concurso", "trophy"],
  cosechaTablero: ["La ahuyama más grande", "trophy"],
  cosechaTombola: ["La tómbola de la junta", "megaphone"],
};

export function CosechaPanel({ kind, atObject, onClose }: { kind: CosechaKind; atObject: boolean; onClose: () => void }) {
  const open = useOfficeStore((s) => s.festival.id === COSECHA.id && s.festival.fase === "fiesta");
  const puesto = useCosechaStore((s) => s.puesto);
  const [title, icon] = TITULOS[kind];
  return (
    <PanelShell title={kind === "cosechaPuesto" ? (puestoById(puesto)?.nombre ?? title) : title} icon={icon} onClose={onClose} wide>
      {!open && <p className="mb-3 text-[14px] text-cozy-ink-soft">La Feria de la cosecha es el 10 del otoño, de las 9:00 a las 22:00 del reloj de la cabaña.</p>}
      {kind === "cosechaPuesto" && <Puesto atObject={atObject} open={open} />}
      {kind === "cosechaOlla" && <Olla atObject={atObject} open={open} />}
      {(kind === "cosechaBascula" || kind === "cosechaTablero") && <Concurso pesa={kind === "cosechaBascula"} atObject={atObject} open={open} />}
      {kind === "cosechaTombola" && <Tombola atObject={atObject} open={open} />}
    </PanelShell>
  );
}

/** Lo que hay en la mochila (itemId → unidades). */
function useBag() {
  const slots = useBagStore((s) => s.slots);
  const overflow = useBagStore((s) => s.overflow);
  return useMemo(() => {
    const have = new Map<string, number>();
    for (const s of [...slots, ...overflow]) if (s) have.set(s.itemId, (have.get(s.itemId) ?? 0) + s.quantity);
    return have;
  }, [slots, overflow]);
}

/** Un botón que espera la respuesta del servidor: se suelta al llegar (o a los 3 s). */
function usePending(kind: "vender" | "comprar" | "aportar" | "pesar" | "boleta") {
  const last = useCosechaStore((s) => s.last);
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

function Fila({ children }: { children: React.ReactNode }) {
  return <li className="flex items-center gap-3 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2">{children}</li>;
}

// ---------- El puesto ----------

function Puesto({ atObject, open }: { atObject: boolean; open: boolean }) {
  const id = useCosechaStore((s) => s.puesto);
  const mine = useCosechaStore((s) => s.mine);
  const p = puestoById(id);
  const bag = useBag();
  const points = useMyPoints();
  const t = useGameTime();
  const [vPending, setV] = usePending("vender");
  const [cPending, setC] = usePending("comprar");
  if (!p) return null;
  const day = t?.day ?? 0;
  const minuto = t?.minuteOfDay ?? 12 * 60;
  const top = puestoQueMasPaga(day, minuto) === p.id;
  // Lo de la mochila que este puesto compra (cada ahuyama pesada va por su lado).
  const vendibles = [...bag.entries()]
    .map(([itemId, n]) => ({ item: objIdOf(itemId) ?? "", n }))
    .filter(({ item }) => item && p.compra.includes(baseDeVenta(item)));
  const queda = Math.max(0, COSECHA.topeVentas - mine.vendido);
  const why = !open ? "Cerrado" : !atObject ? "Arrímese al puesto" : queda <= 0 ? "Ya vendió lo de esta feria" : "";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2">
        <p className="flex-1 text-[15px] leading-snug text-cozy-ink">
          Compra {p.compra.map((c) => bagItemInfo(objItemId(c)).name.toLowerCase()).join(", ")}. Cada puesto paga distinto y cada dos horas cambia el que paga mejor: recorra el mercado.
        </p>
        {top && (
          <span className="cozy-chip flex items-center gap-1 text-[13px]">
            <PixelIcon name="star" size={12} color="var(--color-cozy-gold)" />
            Ahora paga más
          </span>
        )}
      </div>
      <p className="text-[13px] text-cozy-ink-soft">
        En esta feria ha vendido {mine.vendido} de {COSECHA.topeVentas} puntos.
      </p>
      <section>
        <h3 className="mb-1 text-[15px] font-semibold text-cozy-ink">Le compro</h3>
        {vendibles.length === 0 && <p className="text-[14px] text-cozy-ink-soft">No lleva nada de lo que compra este puesto. Coseche en el huerto y vuelva.</p>}
        <ul className="grid gap-2 sm:grid-cols-2">
          {vendibles.map(({ item, n }) => {
            const precio = precioDeCompra(p.id, item, day, minuto) ?? 0;
            const todo = Math.min(n, COSECHA.ventaMax);
            return (
              <Fila key={item}>
                <ItemArt id={item} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] leading-tight font-semibold text-cozy-ink">{bagItemInfo(objItemId(item)).name}</p>
                  <p className="text-[12px] text-cozy-ink-soft">
                    {precio} pts cada uno · tiene {n}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  {[1, todo].filter((k, i, a) => a.indexOf(k) === i).map((k) => (
                    <button
                      key={k}
                      type="button"
                      disabled={Boolean(why) || vPending !== null}
                      title={why || `Vender ${k}`}
                      onClick={() => {
                        setV(`${item}:${k}`);
                        sendVender(p.id, item, k);
                      }}
                      className="cozy-btn cozy-btn-primary px-2 py-1 text-[13px]"
                    >
                      {vPending === `${item}:${k}` ? "..." : k === 1 ? "Vender 1" : `Vender ${k}`}
                    </button>
                  ))}
                </div>
              </Fila>
            );
          })}
        </ul>
      </section>
      {p.vende.length > 0 && (
        <section>
          <h3 className="mb-1 flex items-center gap-2 text-[15px] font-semibold text-cozy-ink">
            Le vendo
            <span className="cozy-chip flex items-center gap-1 text-[13px] font-normal">
              <PixelIcon name="coin" size={12} color="var(--color-cozy-gold)" />
              {points} pts
            </span>
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {p.vende.map((v) => {
              const w = !open ? "Cerrado" : !atObject ? "Arrímese al puesto" : points < v.price ? "No le alcanzan los puntos" : "";
              const have = bag.get(v.mueble ? v.id : objItemId(v.id)) ?? 0;
              return (
                <Fila key={v.id}>
                  <ItemArt id={v.id} furniture={v.mueble} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] leading-tight font-semibold text-cozy-ink">{v.name}</p>
                    <p className="text-[12px] text-cozy-ink-soft">{have > 0 ? `Tiene ${have}.` : v.mueble ? "Para la oficina." : "No tiene."}</p>
                  </div>
                  <button
                    type="button"
                    disabled={Boolean(w) || cPending !== null}
                    title={w || `Comprar ${v.name}`}
                    aria-label={`Comprar ${v.name} por ${v.price} puntos`}
                    onClick={() => {
                      setC(v.id);
                      sendComprar(p.id, v.id);
                    }}
                    className="cozy-btn cozy-btn-primary flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-[14px]"
                  >
                    <PixelIcon name="coin" size={12} color="var(--color-cozy-gold)" />
                    {cPending === v.id ? "..." : v.price}
                  </button>
                </Fila>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------- La olla ----------

function Olla({ atObject, open }: { atObject: boolean; open: boolean }) {
  const aportado = useCosechaStore((s) => s.aportado);
  const fase = useCosechaStore((s) => s.ollaFase);
  const olla = useCosechaStore((s) => s.olla);
  const bag = useBag();
  const [pending, setPending] = usePending("aportar");
  const avance = Math.round(ollaProgreso(aportado) * 100);
  const estado =
    fase === "acabada"
      ? "Ya se sirvieron todas las ollas de la feria."
      : fase === "hirviendo"
        ? "¡La olla está llena y hierve! Quédese cerca: Doña Rubiela le sirve un plato a cada quien."
        : `Olla ${olla} de ${COSECHA.ollasMax}: va en ${avance} %. Cuando se llene, hierve un ratico y se sirve.`;
  return (
    <div className="flex flex-col gap-3">
      <p className="border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2 text-[15px] leading-snug text-cozy-ink">
        El sancocho es de todos: échele a la olla lo que traiga de la huerta y de la granja. La gallina se cambia por huevo criollo. El plato da energía para caminar más rápido.
      </p>
      <div className="h-3 w-full border-2 border-cozy-wood bg-cozy-paper-dark" role="progressbar" aria-valuenow={avance} aria-valuemin={0} aria-valuemax={100} aria-label="Lo que lleva la olla">
        <div className={`h-full ${fase === "hirviendo" ? "bg-cozy-gold" : "bg-cozy-green"}`} style={{ width: `${fase === "llenando" ? avance : 100}%` }} />
      </div>
      <p className="text-[14px] text-cozy-ink-soft">{estado}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {Object.entries(OLLA_RECETA).map(([item, need]) => {
          const tiene = bag.get(objItemId(item)) ?? 0;
          const lleva = Math.min(need, aportado[item] ?? 0);
          const falta = need - lleva;
          const n = Math.min(falta, tiene);
          const why = !open ? "Cerrado" : !atObject ? "Arrímese a la olla" : fase !== "llenando" ? "Ahora no" : falta <= 0 ? "Ya está completo" : tiene <= 0 ? "No lleva de eso" : "";
          return (
            <Fila key={item}>
              <ItemArt id={item} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-tight font-semibold text-cozy-ink">{bagItemInfo(objItemId(item)).name}</p>
                <p className="text-[12px] text-cozy-ink-soft">
                  {lleva} de {need} en la olla · tiene {tiene}
                </p>
              </div>
              <button
                type="button"
                disabled={Boolean(why) || pending !== null}
                title={why || `Echar ${n}`}
                onClick={() => {
                  setPending(item);
                  sendAportar(item, n);
                }}
                className="cozy-btn cozy-btn-primary shrink-0 px-2.5 py-1.5 text-[14px]"
              >
                {pending === item ? "..." : falta <= 0 ? "Listo" : `Echar ${Math.max(1, n)}`}
              </button>
            </Fila>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- El concurso ----------

function Concurso({ pesa, atObject, open }: { pesa: boolean; atObject: boolean; open: boolean }) {
  const ahuyamas = useCosechaStore((s) => s.ahuyamas);
  const ganador = useCosechaStore((s) => s.ganadorAhuyama);
  const ganadorDag = useCosechaStore((s) => s.ganadorDag);
  const mine = useCosechaStore((s) => s.mine);
  const me = useOfficeStore(selectMyUserId);
  const holding = useOfficeStore((s) => (s.sessionId ? s.players[s.sessionId]?.held : "")) ?? "";
  const [pending, setPending] = usePending("pesar");
  const dag = holding ? heldAhuyama() : null;
  const ranking = rankingAhuyamas(ahuyamas);
  const why = !open ? "La báscula pesa solo en la feria" : !atObject ? "Arrímese a la báscula" : dag === null ? "Lleve una ahuyama en la mano" : mine.dag >= dag ? "La suya inscrita pesa más" : "";
  return (
    <div className="flex flex-col gap-3">
      {ganador && (
        <p className="flex items-center gap-2 border-2 border-cozy-gold bg-cozy-paper-light px-3 py-2 text-[15px] text-cozy-ink">
          <PixelIcon name="trophy" size={14} color="var(--color-cozy-gold)" />
          La ahuyama más grande: la de {ganador}, con {pesoTexto(ganadorDag)}.
        </p>
      )}
      {pesa && (
        <div className="flex items-center gap-4 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-3">
          {dag !== null ? <ItemArt id={`${AHUYAMA.prefix}${dag}`} big /> : <span className="grid h-24 w-24 place-items-center border-2 border-dashed border-cozy-paper-dark text-center text-[13px] text-cozy-ink-soft">Sin ahuyama</span>}
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
            <p className="text-[15px] leading-snug text-cozy-ink">
              Las ahuyamas salen del huerto con su peso: regadas y en otoño crecen más grandes. Al cierre se premia la más pesada.
            </p>
            {mine.dag > 0 && <p className="text-[13px] text-cozy-ink-soft">La suya inscrita: {pesoTexto(mine.dag)}.</p>}
            <button
              type="button"
              disabled={Boolean(why) || pending !== null}
              title={why || "Pesar e inscribir"}
              onClick={() => {
                setPending("pesar");
                sendPesar();
              }}
              className="cozy-btn cozy-btn-primary flex items-center gap-1.5 px-3 py-1.5 text-[14px]"
            >
              <PixelIcon name="trophy" size={12} />
              {pending ? "Pesando..." : why || `Pesar (${pesoTexto(dag ?? 0)})`}
            </button>
          </div>
        </div>
      )}
      <section>
        <h3 className="mb-1 text-[15px] font-semibold text-cozy-ink">El tablero</h3>
        {ranking.length === 0 && <p className="text-[14px] text-cozy-ink-soft">Todavía nadie ha pesado su ahuyama.</p>}
        <ol className="flex flex-col gap-1">
          {ranking.slice(0, 10).map((e, i) => (
            <li key={e.userId} className={`flex items-center gap-2 border-2 px-2 py-1 text-[14px] text-cozy-ink ${i === 0 ? "border-cozy-gold" : "border-cozy-paper-dark"} bg-cozy-paper-light`}>
              <span className="w-6 text-right font-semibold">{i + 1}.</span>
              <ItemArt id={`${AHUYAMA.prefix}${e.dag}`} small />
              <span className="flex-1 truncate">
                {e.name}
                {e.userId === me ? " (usted)" : ""}
              </span>
              <span className="font-semibold">{pesoTexto(e.dag)}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

// ---------- La tómbola ----------

function Tombola({ atObject, open }: { atObject: boolean; open: boolean }) {
  const total = useCosechaStore((s) => s.boletas);
  const ganador = useCosechaStore((s) => s.ganadorTombola);
  const mine = useCosechaStore((s) => s.mine);
  const points = useMyPoints();
  const [pending, setPending] = usePending("boleta");
  const why = !open ? "La tómbola juega solo en la feria" : !atObject ? "Arrímese a la tómbola" : mine.boletas >= COSECHA.boletasMax ? "Ya tiene sus boletas" : points < COSECHA.boletaPrecio ? "No le alcanzan los puntos" : "";
  return (
    <div className="flex flex-col gap-3">
      {ganador && (
        <p className="flex items-center gap-2 border-2 border-cozy-gold bg-cozy-paper-light px-3 py-2 text-[15px] text-cozy-ink">
          <PixelIcon name="gift" size={14} color="var(--color-cozy-gold)" />
          La boleta ganadora fue la de {ganador}.
        </p>
      )}
      <div className="flex items-center gap-4 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-3">
        <ItemArt id={TOMBOLA_PREMIO} furniture big />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
          <p className="text-[15px] leading-snug text-cozy-ink">
            El premio de la junta es la carreta de la cosecha, cargada de ahuyamas: un mueble que no se consigue en otro lado. El sorteo es al cierre (22:00).
          </p>
          <p className="text-[13px] text-cozy-ink-soft">
            Tiene {mine.boletas} de {COSECHA.boletasMax} boletas · van {total} vendidas en la feria.
          </p>
          <button
            type="button"
            disabled={Boolean(why) || pending !== null}
            title={why || "Comprar una boleta"}
            onClick={() => {
              setPending("boleta");
              sendBoleta();
            }}
            className="cozy-btn cozy-btn-primary flex items-center gap-1.5 px-3 py-1.5 text-[14px]"
          >
            <PixelIcon name="coin" size={12} color="var(--color-cozy-gold)" />
            {pending ? "..." : why || `Boleta por ${COSECHA.boletaPrecio} puntos`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- El baile ----------

/**
 * El chip del baile: con el bambuco andando y yo en la pista del patio, un botón para bailar (el emote
 * "Bailar") y cuántos pasos llevo. Solo se monta cuando se ve.
 */
export function BaileCosechaPrompt() {
  const baile = useCosechaStore((s) => s.baile);
  const enPista = useCosechaStore((s) => s.enPista);
  const pasos = useCosechaStore((s) => s.mine.pasos);
  const bailado = useCosechaStore((s) => s.mine.bailado);
  const pareja = useCosechaStore((s) => s.pareja);
  const panel = useOfficeStore((s) => s.panel);
  if (!baile || !enPista || panel || !cosechaNow()) return null;
  return (
    <button type="button" onClick={bailarBambuco} className="cozy-chip pointer-events-auto flex items-center gap-2 px-3 py-1.5 text-[14px]">
      <PixelIcon name="note" size={12} color="var(--color-cozy-gold)" />
      {bailado ? "Seguir bailando el bambuco" : `Bailar el bambuco · ${pasos} de ${COSECHA.bailePasos} pasos${pareja ? " (en pareja, doble)" : ""}`}
    </button>
  );
}

const artCache = new Map<string, string>();

/** Algo de la mochila en pixel-art, ampliado sin suavizar (un mueble, con su dibujo del catálogo). */
function ItemArt({ id, small = false, big = false, furniture = false }: { id: string; small?: boolean; big?: boolean; furniture?: boolean }) {
  const [src, setSrc] = useState(() => artCache.get(id) ?? null);
  useEffect(() => {
    if (artCache.has(id)) return setSrc(artCache.get(id)!);
    const url = toHtmlCanvas(furniture ? drawFurniture(id, "front").canvas : drawHeldItem(id)).toDataURL();
    artCache.set(id, url);
    setSrc(url);
  }, [id, furniture]);
  const box = small ? "h-7 w-7" : big ? "h-24 w-24" : "h-12 w-12";
  const img = small ? "h-6 w-6" : big ? "h-20 w-20" : "h-10 w-10";
  return (
    <span className={`grid ${box} shrink-0 place-items-center ${small ? "" : "border-2 border-cozy-paper-dark bg-cozy-paper"}`}>
      {src && <img src={src} alt="" className={`${img} object-contain [image-rendering:pixelated]`} />}
    </span>
  );
}
