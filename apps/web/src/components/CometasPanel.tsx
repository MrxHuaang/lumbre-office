"use client";

// El Festival de cometas en el HUD: el taller (se eligen la forma, los dos colores de papel y la cola, con
// la vista previa de la cometa y lo que gasta), el puesto de Chepe y el carrito del raspao (dos pestañas) y
// el tablero del concurso (inscribir la de la mano, votar por la más bonita y el récord del día). Y el
// minijuego del vuelo (`CometaVuelo`): la tensión del hilo, la altura y el viento. El servidor valida todo.
import { drawHeldItem } from "@hyvento/map/art";
import {
  COLOR_LETRAS,
  COMETA_COLORES,
  COMETAS_SHOP,
  FORMA_LETRAS,
  VUELO,
  bagItemInfo,
  cometaCode,
  cometaMateriales,
  cometaName,
  faltanMateriales,
  objItemId,
  type CometaColorLetra,
  type CometaFormaLetra,
} from "@hyvento/shared";
import { useEffect, useMemo, useState } from "react";
import { useBagStore } from "@/game/bag";
import { heldCometa, jalar, recogerCometa, sendCometaArmar, sendCometaInscribir, sendCometasComprar, sendCometaVotar, useCometasStore } from "@/game/cometas";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { selectMyUserId, useOfficeStore } from "@/game/store";
import { PixelIcon } from "./Cozy";
import { PanelShell, useMyPoints } from "./PointsPanels";

const PENDING_MS = 3000;

type CometasKind = "cometasTaller" | "cometasShop" | "cometasConcurso";

const TITULO: Record<CometasKind, string> = { cometasTaller: "Taller de cometas", cometasShop: "Puesto de cometas", cometasConcurso: "Concurso de cometas" };

export function CometasPanel({ kind, atObject, onClose }: { kind: CometasKind; atObject: boolean; onClose: () => void }) {
  const open = useOfficeStore((s) => s.festival.id === "cometas" && s.festival.fase === "fiesta");
  return (
    <PanelShell title={TITULO[kind]} icon="cometa" onClose={onClose} wide>
      {!open && <p className="mb-3 text-[14px] text-cozy-ink-soft">El Festival de cometas es el 9 del verano, de las 9:00 a las 22:00 del reloj de la cabaña, en la loma del observatorio.</p>}
      {kind === "cometasTaller" && <Taller atObject={atObject} open={open} />}
      {kind === "cometasShop" && <Puesto atObject={atObject} open={open} />}
      {kind === "cometasConcurso" && <Concurso atObject={atObject} open={open} />}
    </PanelShell>
  );
}

function useBagCount() {
  const slots = useBagStore((s) => s.slots);
  const overflow = useBagStore((s) => s.overflow);
  return useMemo(() => {
    const have = new Map<string, number>();
    for (const s of [...slots, ...overflow]) if (s) have.set(s.itemId, (have.get(s.itemId) ?? 0) + s.quantity);
    return (id: string) => have.get(objItemId(id)) ?? 0;
  }, [slots, overflow]);
}

function usePending(kind: "armar" | "comprar" | "concurso") {
  const last = useCometasStore((s) => s.last);
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

const FORMA_NOMBRE: Record<CometaFormaLetra, string> = { r: "Rombo", h: "Hexagonal", p: "Pájaro", z: "Pez" };
const COLA_NOMBRE: Record<1 | 2 | 3, string> = { 1: "Corta: sube rápido, se zarandea", 2: "Media", 3: "Larga: calmada, sube despacio" };

function Taller({ atObject, open }: { atObject: boolean; open: boolean }) {
  const count = useBagCount();
  const [forma, setForma] = useState<CometaFormaLetra>("r");
  const [color1, setColor1] = useState<CometaColorLetra>("r");
  const [color2, setColor2] = useState<CometaColorLetra>("a");
  const [cola, setCola] = useState<1 | 2 | 3>(2);
  const [pending, setPending] = usePending("armar");
  const code = cometaCode({ forma, color1, color2, cola });
  const faltan = faltanMateriales(code, count);
  const why = !open ? "El taller abre en el festival" : !atObject ? "Arrímate a la mesa del taller" : Object.keys(faltan).length ? "Te faltan materiales" : "";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] leading-snug text-cozy-ink">Elige la forma, los dos colores del papel de seda y el largo de la cola de trapitos. Los materiales se consiguen en el puesto de Chepe.</p>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex flex-col gap-2">
          <Opciones label="Forma">
            {FORMA_LETRAS.map((f) => (
              <Opcion key={f} on={forma === f} onClick={() => setForma(f)}>
                <ItemArt id={`cometa:${cometaCode({ forma: f, color1, color2, cola })}`} small />
                {FORMA_NOMBRE[f]}
              </Opcion>
            ))}
          </Opciones>
          <Colores label="Papel de la cara" value={color1} onChange={setColor1} />
          <Colores label="Papel de los bordes y la cola" value={color2} onChange={setColor2} />
          <Opciones label="Cola de trapitos">
            {([1, 2, 3] as const).map((c) => (
              <Opcion key={c} on={cola === c} onClick={() => setCola(c)}>
                {COLA_NOMBRE[c]}
              </Opcion>
            ))}
          </Opciones>
        </div>
        <div className="flex flex-col items-center gap-1">
          <ItemArt id={`cometa:${code}`} big />
          <span className="text-center text-[13px] text-cozy-ink-soft">{cometaName(code)}</span>
        </div>
      </div>
      <p className="text-[14px] text-cozy-ink-soft">
        Gasta: {Object.entries(cometaMateriales(code)).map(([item, n]) => `${n} de ${bagItemInfo(objItemId(item)).name.toLowerCase()} (tienes ${count(item)})`).join(", ")}.
      </p>
      <div>
        <button
          type="button"
          disabled={Boolean(why) || pending !== null}
          title={why || "Armar la cometa"}
          onClick={() => {
            setPending("armar");
            sendCometaArmar(code);
          }}
          className="cozy-btn cozy-btn-primary flex items-center gap-1.5 px-3 py-1.5 text-[14px]"
        >
          <PixelIcon name="cometa" size={12} />
          {pending ? "Armando..." : why || "Armar la cometa"}
        </button>
      </div>
    </div>
  );
}

function Opciones({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[13px] font-semibold text-cozy-ink">{label}</p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

function Opcion({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={on} data-on={on || undefined} onClick={onClick} className="cozy-btn flex items-center gap-1.5 px-2 py-1 text-[13px]">
      {children}
    </button>
  );
}

function Colores({ label, value, onChange }: { label: string; value: CometaColorLetra; onChange: (c: CometaColorLetra) => void }) {
  return (
    <Opciones label={label}>
      {COLOR_LETRAS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={COMETA_COLORES[c].name}
          title={COMETA_COLORES[c].name}
          data-on={value === c || undefined}
          onClick={() => onChange(c)}
          className="cozy-btn h-8 w-8 p-1"
        >
          <span className="block h-full w-full border-2 border-cozy-ink" style={{ background: COMETA_COLORES[c].hex }} />
        </button>
      ))}
    </Opciones>
  );
}

function Puesto({ atObject, open }: { atObject: boolean; open: boolean }) {
  const points = useMyPoints();
  const count = useBagCount();
  const [tab, setTab] = useState<"cometas" | "refrescos">("cometas");
  const [pending, setPending] = usePending("comprar");
  return (
    <div>
      <div className="mb-3 flex gap-2" role="tablist">
        {(["cometas", "refrescos"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} data-on={tab === t || undefined} onClick={() => setTab(t)} className="cozy-btn px-3 py-1 text-[14px]">
            {t === "cometas" ? "Cometas y carretes" : "Raspao y salpicón"}
          </button>
        ))}
        <span className="cozy-chip ml-auto flex items-center gap-1 text-[13px]">
          <PixelIcon name="coin" size={12} color="var(--color-cozy-gold)" />
          {points} pts
        </span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {COMETAS_SHOP.filter((i) => i.tab === tab).map((item) => {
          const why = !open ? "Cerrado" : !atObject ? "Arrímate al puesto" : points < item.price ? "No te alcanzan los puntos" : "";
          const have = count(item.id);
          return (
            <li key={item.id} className="flex items-center gap-3 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2.5">
              <ItemArt id={item.id} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-tight font-semibold text-cozy-ink">{item.name}</p>
                <p className="text-[12px] leading-snug text-cozy-ink-soft">{bagItemInfo(objItemId(item.id)).blurb}</p>
                <p className="text-[12px] leading-snug text-cozy-ink-soft">{have > 0 ? `Tienes ${have}.` : "No tienes."}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPending(item.id);
                  sendCometasComprar(item.id);
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

function Concurso({ atObject, open }: { atObject: boolean; open: boolean }) {
  const inscritas = useCometasStore((s) => s.inscritas);
  const record = useCometasStore((s) => s.record);
  const mine = useCometasStore((s) => s.mine);
  const me = useOfficeStore(selectMyUserId);
  const holding = useOfficeStore((s) => (s.sessionId ? s.players[s.sessionId]?.held : "")) ?? "";
  const [pending, setPending] = usePending("concurso");
  const code = holding ? heldCometa() : null;
  const ya = Boolean(me && inscritas[me]);
  const todas = Object.values(inscritas).sort((a, b) => b.votes - a.votes);
  const whyInscribir = !open ? "El concurso es durante el festival" : !atObject ? "Arrímate al tablero" : ya ? "Tu cometa ya está inscrita" : !code ? "Lleva tu cometa en la mano" : "";

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 border-2 border-cozy-gold bg-cozy-paper-light px-3 py-2 text-[15px] text-cozy-ink">
        <PixelIcon name="trophy" size={14} color="var(--color-cozy-gold)" />
        {record.altura > 0 ? `Récord del día: ${record.name}, a ${record.altura} metros.` : "Todavía nadie ha subido una cometa hoy."}
      </p>
      <div className="flex flex-wrap items-center gap-3 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2">
        {code && <ItemArt id={`cometa:${code}`} />}
        <p className="min-w-0 flex-1 text-[14px] text-cozy-ink">{code ? `Llevas en la mano: ${cometaName(code)}.` : "Inscriba la cometa que lleva en la mano: una por persona."}</p>
        <button
          type="button"
          disabled={Boolean(whyInscribir) || pending !== null}
          title={whyInscribir || "Inscribir mi cometa"}
          onClick={() => {
            setPending("inscribir");
            sendCometaInscribir();
          }}
          className="cozy-btn cozy-btn-primary flex items-center gap-1.5 px-3 py-1.5 text-[14px]"
        >
          <PixelIcon name="cometa" size={12} />
          {whyInscribir || "Inscribir mi cometa"}
        </button>
      </div>
      <div>
        <h3 className="mb-1 text-[15px] font-semibold text-cozy-ink">La más bonita</h3>
        {todas.length === 0 && <p className="text-[14px] text-cozy-ink-soft">Todavía no hay ninguna inscrita.</p>}
        <ul className="grid gap-2 sm:grid-cols-2">
          {todas.map((e) => {
            const own = e.ownerId === me;
            const why = !open ? "Cerrado" : own ? "Es la suya" : mine.voto ? (mine.voto === e.ownerId ? "Su voto" : "Ya votó") : !atObject ? "Arrímate al tablero" : "";
            return (
              <li key={e.ownerId} className="flex items-center gap-2 border-2 border-cozy-paper-dark bg-cozy-paper-light px-2 py-1.5">
                <ItemArt id={`cometa:${e.code}`} />
                <div className="min-w-0 flex-1 text-[13px] leading-tight text-cozy-ink">
                  <p className="font-semibold">{e.ownerName}</p>
                  <p className="text-cozy-ink-soft">
                    {cometaName(e.code)} · {e.votes} {e.votes === 1 ? "voto" : "votos"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={Boolean(why) || pending !== null}
                  title={why || "Votar por esta"}
                  onClick={() => {
                    setPending(e.ownerId);
                    sendCometaVotar(e.ownerId);
                  }}
                  className="cozy-btn flex shrink-0 items-center gap-1 px-2 py-1 text-[13px]"
                >
                  <PixelIcon name="heart" size={12} />
                  {why || "Votar"}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[13px] text-cozy-ink-soft">Cada quien vota una vez. Al cierre (22:00) se premian la más alta del día y la más bonita.</p>
      </div>
    </div>
  );
}

/**
 * El minijuego del vuelo (mientras hay una cometa mía en el aire): la tensión del hilo con su punto bueno,
 * la altura, el viento y el tiempo que queda. Se jala apretando el botón, la barra espaciadora o F; soltando
 * se da hilo. "Recoger" (o Esc) la baja con lo que subió.
 */
export function CometaVuelo() {
  const vuelo = useCometasStore((s) => s.vuelo);
  if (!vuelo) return null;
  const pct = (v: number) => `${Math.max(0, Math.min(100, v * 100))}%`;
  const peligro = vuelo.tension >= VUELO.alta;
  const flojo = vuelo.tension < VUELO.baja;
  return (
    <div className="pointer-events-auto fixed bottom-[calc(var(--cozy-bar-top,96px)+12px)] left-1/2 z-40 w-[min(92vw,420px)] -translate-x-1/2 cozy-panel px-4 py-3" role="group" aria-label="Volar la cometa">
      <div className="mb-2 flex items-center gap-2">
        <ItemArt id={`cometa:${vuelo.code}`} small />
        <p className="flex-1 text-[15px] font-semibold text-cozy-ink">{Math.floor(vuelo.altura)} metros</p>
        <span className="cozy-chip text-[12px]">Viento {vuelo.rafaga > vuelo.viento * 0.9 ? "fuerte" : vuelo.rafaga < vuelo.viento * 0.55 ? "flojito" : "parejo"}</span>
        <span className="cozy-chip text-[12px]">{Math.ceil(vuelo.quedan)} s</span>
      </div>
      <p className="mb-1 text-[12px] text-cozy-ink-soft">Tensión de la cabuya</p>
      <div className="relative h-5 border-2 border-cozy-ink bg-cozy-paper-light" aria-label={`Tensión ${Math.round(vuelo.tension * 100)} por ciento`}>
        <div className="absolute inset-y-0 bg-cozy-green-light/60" style={{ left: pct(VUELO.baja), width: `${(VUELO.alta - VUELO.baja) * 100}%` }} />
        <div className="absolute inset-y-0 bg-cozy-red/40" style={{ left: pct(VUELO.alta), right: 0 }} />
        <div className={`absolute inset-y-0 w-1.5 -translate-x-1/2 ${peligro ? "bg-cozy-red" : flojo ? "bg-cozy-ink-soft" : "bg-cozy-ink"}`} style={{ left: pct(vuelo.tension) }} />
      </div>
      <p className="mt-1 text-[12px] text-cozy-ink-soft">{peligro ? "¡La cabuya cruje! Dele hilo." : flojo ? "Se está cayendo: jale un poquito." : "Así, en su punto: va subiendo."}</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            jalar(true, "boton");
          }}
          onPointerUp={() => jalar(false, "boton")}
          onPointerLeave={() => jalar(false, "boton")}
          onPointerCancel={() => jalar(false, "boton")}
          data-on={vuelo.hold || undefined}
          className="cozy-btn cozy-btn-primary flex-1 select-none px-3 py-2 text-[15px]"
        >
          Jalar (mantener apretado)
        </button>
        <button type="button" onClick={recogerCometa} className="cozy-btn px-3 py-2 text-[14px]">
          Recoger
        </button>
      </div>
      <p className="mt-1 text-[11px] text-cozy-ink-soft">
        <kbd className="cozy-kbd">Espacio</kbd> o <kbd className="cozy-kbd">F</kbd> jalan · <kbd className="cozy-kbd">Esc</kbd> recoge
      </p>
    </div>
  );
}

const artCache = new Map<string, string>();

function ItemArt({ id, small = false, big = false }: { id: string; small?: boolean; big?: boolean }) {
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
    <span className={`grid ${box} shrink-0 place-items-center ${small ? "" : "border-2 border-cozy-paper-dark bg-cozy-paper"}`}>
      {src && <img src={src} alt="" className={`${img} object-contain [image-rendering:pixelated]`} />}
    </span>
  );
}
