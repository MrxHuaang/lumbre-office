"use client";

// El Año viejo en el HUD: el puesto de uvas y maletas (lo de los agüeros se regala, lo del muñeco se paga) con
// el diario de los agüeros del año; el muñeco de año viejo (cómo va, qué le falta y darle prendas o relleno);
// el cartel de los testamentos (leerlos y dejar el tuyo); el resumen del año que llega con el año nuevo; y la
// tira de abajo con las doce campanadas (las uvas que van) y la vuelta de la maleta. El servidor valida todo.
import { drawHeldItem, munecoEnSilla } from "@hyvento/map/art";
import {
  AGUEROS,
  AGUERO_INFO,
  ANO_VIEJO,
  ANO_VIEJO_BUY_ERROR_TEXT,
  ANO_VIEJO_SHOP,
  MALETA_OBJ,
  MALETA_RUTA,
  MUNECO,
  PRENDAS_MUNECO,
  RELLENOS_MUNECO,
  TESTAMENTO,
  UVA,
  UVAS,
  anoViejoNoticeText,
  bagItemInfo,
  cleanTestamento,
  faltaMuneco,
  objItemId,
} from "@hyvento/shared";
import { useEffect, useMemo, useState } from "react";
import { anoViejoAbierto, enLaMano, ponerEnLaMano, sendAnoViejoBuy, sendAporte, sendTestamento, useAnoViejoStore } from "@/game/anoViejo";
import { useBagStore } from "@/game/bag";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "./Cozy";
import { PanelShell, useMyPoints } from "./PointsPanels";

/** Si no llega respuesta del servidor en este tiempo, el botón vuelve a estar disponible. */
const PENDING_MS = 3000;

const quemaHora = `${Math.floor(ANO_VIEJO.quemaMinuto / 60)}:${String(ANO_VIEJO.quemaMinuto % 60).padStart(2, "0")}`;
const cuentaHora = `${Math.floor(ANO_VIEJO.cuentaMinuto / 60)}:${String(ANO_VIEJO.cuentaMinuto % 60).padStart(2, "0")}`;

/** ¿Abierto el Año viejo? (para los componentes). */
const useAbierto = () => useOfficeStore((s) => s.festival.id === "ano-viejo" && s.festival.fase === "fiesta");

/** Cuántos tengo de cada cosa en la mochila (por id sin el `obj:`). */
function useCuenta() {
  const slots = useBagStore((s) => s.slots);
  const overflow = useBagStore((s) => s.overflow);
  return useMemo(() => {
    const have = new Map<string, number>();
    for (const s of [...slots, ...overflow]) if (s) have.set(s.itemId, (have.get(s.itemId) ?? 0) + s.quantity);
    return { count: (id: string) => have.get(objItemId(id)) ?? 0, free: slots.filter((s) => !s).length };
  }, [slots, overflow]);
}

const artCache = new Map<string, string>();

/** Un objeto de mano en pixel art, ampliado sin suavizar. */
function Arte({ id, className = "h-10 w-10", dim = false }: { id: string; className?: string; dim?: boolean }) {
  const [src, setSrc] = useState(() => artCache.get(id) ?? null);
  useEffect(() => {
    if (artCache.has(id)) return setSrc(artCache.get(id)!);
    const url = toHtmlCanvas(drawHeldItem(id)).toDataURL();
    artCache.set(id, url);
    setSrc(url);
  }, [id]);
  return src ? <img src={src} alt="" className={`${className} object-contain [image-rendering:pixelated] ${dim ? "opacity-30 grayscale" : ""}`} /> : <span className={className} />;
}

const Aviso = ({ children }: { children: React.ReactNode }) => <p className="mt-3 text-[14px] leading-snug text-cozy-ink-soft">{children}</p>;

function Cita({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2">
      <p className="flex-1 text-[15px] leading-snug text-cozy-ink">{children}</p>
      {aside}
    </div>
  );
}

// ---------- El puesto y el diario de los agüeros ----------

export function AnoViejoShopPanel({ atObject, onClose }: { atObject: boolean; onClose: () => void }) {
  const points = useMyPoints();
  const { count, free } = useCuenta();
  const lastBuy = useAnoViejoStore((s) => s.lastBuy);
  const open = useAbierto();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lastBuy) return;
    setPending(null);
    setError(lastBuy.ok ? null : ANO_VIEJO_BUY_ERROR_TEXT[lastBuy.error]);
  }, [lastBuy]);
  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => setPending(null), PENDING_MS);
    return () => clearTimeout(id);
  }, [pending]);

  const buy = (id: string) => {
    setError(null);
    setPending(id);
    sendAnoViejoBuy(id);
  };

  return (
    <PanelShell title="Puesto de uvas y maletas" icon="briefcase" onClose={onClose} wide>
      <Cita
        aside={
          <span className="cozy-chip flex shrink-0 items-center gap-1 text-[13px]">
            <PixelIcon name="coin" size={12} color="var(--color-cozy-gold)" />
            {points} pts
          </span>
        }
      >
        «Lo de los agüeros va por cuenta de la casa: las doce uvas, la maleta y las lentejas. La ropa vieja y la careta son para vestir el muñeco.»
      </Cita>
      {!open && <Aviso>El puesto abre el día del Año viejo, de las 9:00 a las 22:00 del reloj de la cabaña.</Aviso>}
      {open && !atObject && <Aviso>Para pedir, arrímate al puesto del toldo amarillo, en la plaza del año viejo.</Aviso>}
      {error && (
        <p role="alert" className="mt-2 border-2 border-cozy-red bg-cozy-paper-light px-3 py-1.5 text-[14px] text-cozy-red">
          {error}
        </p>
      )}
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {ANO_VIEJO_SHOP.map((item) => {
          const have = count(item.id);
          const gratis = item.price === 0;
          const tiene = gratis && have > 0;
          const why = !open ? "Cerrado" : tiene ? "Ya lo tienes" : !atObject ? "Arrímate al puesto" : points < item.price ? "No te alcanzan los puntos" : have === 0 && free === 0 ? "La mochila está llena" : "";
          return (
            <li key={item.id} className="flex items-center gap-3 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2.5">
              <span className="grid h-12 w-12 shrink-0 place-items-center border-2 border-cozy-paper-dark bg-cozy-paper">
                <Arte id={item.id} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-tight font-semibold text-cozy-ink">{item.name}</p>
                <p className="text-[12px] leading-snug text-cozy-ink-soft">{bagItemInfo(objItemId(item.id)).blurb}</p>
                <p className="text-[12px] leading-snug text-cozy-ink-soft">{have > 0 ? `Tienes ${have}.` : "No tienes."}</p>
              </div>
              <button
                type="button"
                onClick={() => buy(item.id)}
                disabled={Boolean(why) || pending !== null}
                title={why || (gratis ? `Pedir ${item.name}` : `Comprar ${item.name}`)}
                aria-label={gratis ? `Pedir ${item.name}, gratis` : `Comprar ${item.name} por ${item.price} puntos`}
                className="cozy-btn cozy-btn-primary flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-[14px]"
              >
                {!gratis && <PixelIcon name="coin" size={12} color="var(--color-cozy-gold)" />}
                {pending === item.id ? "…" : gratis ? (tiene ? "Lo tienes" : "Pedir") : item.price}
              </button>
            </li>
          );
        })}
      </ul>
      <Agueros />
    </PanelShell>
  );
}

/** El diario de los agüeros del año: cada uno con cómo se hace y el deseo que deja. */
function Agueros() {
  const hechos = useAnoViejoStore((s) => s.mine.agueros);
  return (
    <section className="mt-4">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold text-cozy-ink">
        <PixelIcon name="note" size={14} />
        Tu diario del año · {hechos.length} de {AGUEROS.length} agüeros
      </h3>
      <ul className="mt-2 grid gap-1.5">
        {AGUEROS.map((id) => {
          const info = AGUERO_INFO[id];
          const listo = hechos.includes(id);
          return (
            <li key={id} className={`flex gap-2.5 border-2 px-3 py-2 ${listo ? "border-cozy-gold bg-cozy-paper-light" : "border-cozy-paper-dark bg-cozy-paper"}`}>
              <PixelIcon name={listo ? "check" : "starEmpty"} size={14} color={listo ? "var(--color-cozy-gold)" : undefined} />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] leading-tight font-semibold text-cozy-ink">{info.nombre}</p>
                <p className="text-[12px] leading-snug text-cozy-ink-soft">{listo ? `Deseo: ${info.deseo}` : info.como}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------- El muñeco ----------

const munecoCache = new Map<number, string>();

/** El muñeco en su silla, como se ve en la plaza. */
function MunecoArte({ etapa }: { etapa: number }) {
  const src = useMemo(() => {
    if (typeof document === "undefined") return "";
    if (!munecoCache.has(etapa)) munecoCache.set(etapa, toHtmlCanvas(munecoEnSilla(etapa).canvas).toDataURL());
    return munecoCache.get(etapa)!;
  }, [etapa]);
  return src ? <img src={src} alt="" className="h-28 w-24 shrink-0 object-contain [image-rendering:pixelated]" /> : <span className="h-28 w-24 shrink-0" />;
}

function Barra({ label, n, de }: { label: string; n: number; de: number }) {
  const k = de ? Math.min(1, n / de) : 1;
  return (
    <div>
      <p className="flex justify-between text-[13px] text-cozy-ink">
        <span>{label}</span>
        <span className="tabular-nums">
          {n}/{de}
        </span>
      </p>
      <div className="h-2.5 border-2 border-cozy-paper-dark bg-cozy-paper">
        <div className="h-full bg-cozy-gold" style={{ width: `${k * 100}%` }} />
      </div>
    </div>
  );
}

export function MunecoPanel({ atObject, onClose }: { atObject: boolean; onClose: () => void }) {
  const { etapa, prendas, rellenos, quemadoAt } = useAnoViejoStore();
  const aportes = useAnoViejoStore((s) => s.mine.aportes);
  const open = useAbierto();
  const { count } = useCuenta();
  const falta = faltaMuneco(prendas, rellenos);
  const req = MUNECO.etapas[Math.min(etapa, MUNECO.etapas.length - 1)]!;
  const tope = aportes >= MUNECO.porPersona;
  const mios = [...PRENDAS_MUNECO, ...RELLENOS_MUNECO].filter((id) => count(id) > 0);

  return (
    <PanelShell title="El muñeco de año viejo" icon="flame" onClose={onClose} wide>
      <div className="flex gap-3">
        <span className="grid shrink-0 place-items-center border-2 border-cozy-paper-dark bg-cozy-paper px-1">
          <MunecoArte etapa={etapa} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-[16px] leading-tight font-semibold text-cozy-ink">{quemadoAt ? "Ya se quemó" : MUNECO.nombres[etapa]}</p>
          <p className="text-[13px] leading-snug text-cozy-ink-soft">
            {quemadoAt
              ? "Se fue con el año viejo y con todo lo que le dejaron en el testamento. Feliz año nuevo."
              : `Entre todos lo vestimos y lo rellenamos. A las ${quemaHora} del reloj de la cabaña se quema en el brasero, con luces de colores y sin pólvora, y a las ${cuentaHora} viene la cuenta regresiva.`}
          </p>
          {!quemadoAt && falta && (
            <div className="grid gap-1.5">
              <Barra label="Prendas" n={prendas} de={req.prendas} />
              <Barra label="Relleno" n={rellenos} de={req.rellenos} />
            </div>
          )}
          {!quemadoAt && !falta && <p className="text-[13px] font-semibold text-cozy-ink">Ya está listo para la quema.</p>}
          {!quemadoAt && (
            <p className="text-[13px] text-cozy-ink-soft">
              Tú le has dado {aportes} de {MUNECO.porPersona}.
            </p>
          )}
        </div>
      </div>
      {!open && <Aviso>El muñeco se arma el día del Año viejo, de las 9:00 a las 22:00.</Aviso>}
      {open && !quemadoAt && !atObject && <Aviso>Arrímate a la silla del muñeco para darle lo que traes.</Aviso>}
      {open && !quemadoAt && (
        <>
          <h3 className="mt-3 text-[14px] font-semibold text-cozy-ink">Lo que traes para el muñeco</h3>
          {mios.length === 0 ? (
            <Aviso>No traes nada que le sirva. La ropa vieja y la careta están en el puesto; la paja, junto a las pacas del gallinero, y el aserrín, junto al banco del taller del garaje.</Aviso>
          ) : (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {mios.map((id) => (
                <li key={id} className="flex items-center gap-3 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2">
                  <Arte id={id} className="h-8 w-8" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] leading-tight font-semibold text-cozy-ink">{bagItemInfo(objItemId(id)).name}</p>
                    <p className="text-[12px] text-cozy-ink-soft">
                      {(RELLENOS_MUNECO as readonly string[]).includes(id) ? "Relleno" : "Prenda"} · tienes {count(id)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => sendAporte(id)}
                    disabled={!atObject || tope}
                    title={tope ? "Ya le diste lo tuyo" : !atObject ? "Arrímate a la silla" : `Darle ${bagItemInfo(objItemId(id)).name}`}
                    className="cozy-btn cozy-btn-primary shrink-0 px-2.5 py-1.5 text-[14px]"
                  >
                    Darle
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PanelShell>
  );
}

// ---------- El cartel de los testamentos ----------

export function CartelPanel({ atObject, onClose }: { atObject: boolean; onClose: () => void }) {
  const testamentos = useAnoViejoStore((s) => s.testamentos);
  const mio = useAnoViejoStore((s) => s.mine.testamento);
  const quemado = useAnoViejoStore((s) => s.quemadoAt > 0);
  const open = useAbierto();
  const [text, setText] = useState("");
  const check = cleanTestamento(text);
  const error = text.trim() && !check.ok ? anoViejoNoticeText({ code: check.error }) : null;
  const largo = [...text.trim()].length;
  const puede = open && !quemado && atObject;

  return (
    <PanelShell title="Cartel de los testamentos" icon="note" onClose={onClose} wide>
      <Cita>«Lo que uno le deja al año viejo para que se lo lleve: la pereza, el trancón, la contraseña que nunca me acuerdo… Cortico, que el cartel es de todos.»</Cita>
      {puede && (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!check.ok) return;
            sendTestamento(check.text);
            setText("");
          }}
        >
          <label className="text-[14px] font-semibold text-cozy-ink" htmlFor="testamento">
            {mio ? "Cambiar tu testamento" : "Tu testamento"}
          </label>
          <input
            id="testamento"
            autoFocus
            value={text}
            maxLength={TESTAMENTO.max + 20}
            onChange={(e) => setText(e.target.value)}
            placeholder="Le dejo al año viejo las reuniones que pudieron ser un correo…"
            className="cozy-input"
          />
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className={`tabular-nums ${largo > TESTAMENTO.max ? "text-cozy-red" : "text-cozy-ink-soft"}`}>
              {largo}/{TESTAMENTO.max}
            </span>
            {error && (
              <span role="alert" className="flex-1 text-right text-cozy-red">
                {error}
              </span>
            )}
            <button type="submit" disabled={!check.ok} className="cozy-btn cozy-btn-primary">
              Clavarlo en el cartel
            </button>
          </div>
        </form>
      )}
      {!open && <Aviso>El cartel recibe testamentos el día del Año viejo, de las 9:00 a las 22:00.</Aviso>}
      {open && quemado && <Aviso>El muñeco ya se quemó y se llevó los testamentos. Aquí quedan para leerlos.</Aviso>}
      {open && !quemado && !atObject && <Aviso>Arrímate al cartel, junto al muñeco, para dejar el tuyo.</Aviso>}
      {mio && <p className="mt-3 border-2 border-cozy-gold bg-cozy-paper-light px-3 py-2 text-[14px] text-cozy-ink">Tu testamento: «{mio}»</p>}
      <ul className="cozy-scroll mt-3 grid max-h-72 gap-1.5 overflow-y-auto pr-1">
        {testamentos.length === 0 && <li className="text-[14px] text-cozy-ink-soft">Todavía no hay ninguno. ¡Sé el primero!</li>}
        {testamentos.map((t) => (
          <li key={t.userId} className="border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-1.5">
            <p className="text-[14px] leading-snug text-cozy-ink">«{t.text}»</p>
            <p className="text-[12px] text-cozy-ink-soft">{t.name}</p>
          </li>
        ))}
      </ul>
    </PanelShell>
  );
}

// ---------- El resumen del año ----------

export function ResumenAnoPanel({ onClose }: { onClose: () => void }) {
  const resumen = useAnoViejoStore((s) => s.resumen);
  if (!resumen) return null;
  return (
    <PanelShell title={`Tu año ${resumen.año} en la cabaña`} icon="party" onClose={onClose}>
      <p className="text-[15px] leading-snug text-cozy-ink">¡Feliz año nuevo! Esto fue lo tuyo {resumen.desdeQueLlego ? "desde que llegaste a la cabaña" : "este año"}:</p>
      <ul className="mt-3 grid gap-1.5">
        {resumen.filas.map((f) => (
          <li key={f.id} className="flex items-center justify-between border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-1.5 text-[14px] text-cozy-ink">
            <span>{f.label}</span>
            <span className="font-semibold tabular-nums">{f.n}</span>
          </li>
        ))}
        <li className="flex items-center justify-between border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-1.5 text-[14px] text-cozy-ink">
          <span>Festivales a los que fuiste</span>
          <span className="font-semibold tabular-nums">{resumen.festivales}</span>
        </li>
      </ul>
      <h3 className="mt-3 text-[14px] font-semibold text-cozy-ink">Los deseos de tu diario</h3>
      {resumen.agueros.length === 0 ? (
        <Aviso>Este año no cumpliste ningún agüero. El próximo Año viejo: uvas, maleta, lentejas y ropa amarilla.</Aviso>
      ) : (
        <ul className="mt-2 grid gap-1">
          {resumen.agueros.map((id) => (
            <li key={id} className="flex items-start gap-2 text-[14px] text-cozy-ink">
              <PixelIcon name="star" size={12} color="var(--color-cozy-gold)" />
              <span>
                <b>{AGUERO_INFO[id].nombre}:</b> {AGUERO_INFO[id].deseo}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={onClose} className="cozy-btn cozy-btn-primary">
          Que venga el año nuevo
        </button>
      </div>
    </PanelShell>
  );
}

// ---------- La tira de las campanadas y la maleta ----------

/** Abajo al centro: las doce campanadas (las uvas que van) y la vuelta de la maleta. */
export function AnoViejoStrip() {
  const campanadas = useAnoViejoStore((s) => s.campanadas);
  const campanada = useAnoViejoStore((s) => s.campanada);
  const fallo = useAnoViejoStore((s) => s.uvasFallo);
  const { uvas, maleta } = useAnoViejoStore((s) => s.mine);
  const area = useOfficeStore((s) => s.area);
  const panel = useOfficeStore((s) => s.panel);
  // Re-render con lo de la mano (el botón de ponerse las uvas).
  useOfficeStore((s) => (s.sessionId ? s.players[s.sessionId]?.held : ""));
  const { count } = useCuenta();
  if (panel || area !== ANO_VIEJO.area || !anoViejoAbierto()) return null;
  const sonando = campanadas && campanada <= campanadas.n;
  if (!sonando && maleta === null) return null;
  return (
    <div className="cozy-panel pointer-events-auto flex max-w-[min(30rem,calc(100vw-1.5rem))] flex-col gap-1.5 px-3 py-2 text-[14px] text-cozy-ink">
      {sonando && (
        <>
          <p className="flex items-center gap-2 font-semibold">
            <PixelIcon name="bell" size={14} color="var(--color-cozy-gold)" />
            {campanada === 0 ? "Ya vienen las doce campanadas" : `Campanada ${campanada} de ${UVAS.n}`}
          </p>
          <div className="flex flex-wrap gap-0.5" aria-label={`${uvas} uvas de ${UVAS.n}`}>
            {Array.from({ length: UVAS.n }, (_, i) => (
              <span key={i} className={`grid h-6 w-6 place-items-center border-2 ${i === campanada - 1 ? "border-cozy-gold" : "border-transparent"}`}>
                <Arte id={UVA} className="h-5 w-5" dim={i >= uvas} />
              </span>
            ))}
          </div>
          <p className="text-[13px] text-cozy-ink-soft">
            {fallo
              ? "Se te pasó una campanada: en la próxima tanda vuelves a intentarlo."
              : uvas >= UVAS.n
                ? "¡Las doce! Doce meses dulces."
                : enLaMano(UVA)
                  ? "Come una con F en cada campanada."
                  : count(UVA) > 0
                    ? "Ponte las uvas en la mano y come una con F en cada campanada."
                    : "Pide el racimo de uvas en el puesto de la plaza."}
          </p>
          {!fallo && uvas < UVAS.n && !enLaMano(UVA) && count(UVA) > 0 && (
            <button type="button" onClick={() => ponerEnLaMano(UVA)} className="cozy-btn self-start px-2.5 py-1 text-[13px]">
              Uvas a la mano
            </button>
          )}
        </>
      )}
      {maleta !== null && (
        <p className="flex items-center gap-2">
          <PixelIcon name="briefcase" size={14} color="var(--color-cozy-gold)" />
          {maleta === 0 ? "Vuelta con la maleta: de regreso a la plaza." : `Vuelta con la maleta: sigue a la parada ${maleta} de ${MALETA_RUTA.length - 1}.`}
          {!enLaMano(MALETA_OBJ) && <span className="text-cozy-red"> Lleva la maleta en la mano.</span>}
        </p>
      )}
    </div>
  );
}

