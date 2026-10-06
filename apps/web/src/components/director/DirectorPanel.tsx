"use client";

// El panel del director (VIR-175; menú → Administración → "Panel del director", o Ctrl+K): para mostrar la
// cabaña sin esperar el calendario. Prende festivales, fija el clima, mueve la hora y salta de día, y
// dispara momentos (el registro `DIRECTOR_ACCIONES` de shared: un festival nuevo suma los suyos ahí, sin
// tocar este panel). Solo con el permiso `director` (los admins siempre); el servidor valida cada acción y
// cada cambio sale en el chat global.
import {
  DIAS_POR_SEMANA,
  DIRECTOR_ACCIONES,
  DIRECTOR_CLIMA_MINUTOS,
  DIRECTOR_HORAS,
  FESTIVALES,
  SEASONS,
  SEASON_TEXT,
  WEATHERS,
  WEATHER_TEXT,
  climaPermitido,
  diaCorto,
  fechaCorta,
  fechaDelJuego,
  festivalById,
  formatGameTime,
  puede,
  type DirectorAccionDef,
  type DirectorAction,
  type DirectorResult,
  type FestivalId,
  type Season,
  type Weather,
} from "@hyvento/shared";
import { useState } from "react";
import { listaParaEscuchar } from "@/game/carnaval/musica";
import { openDirector, sendDirector, sonarPieza, useDirectorStore } from "@/game/director";
import { useGameTime } from "@/game/gameClock";
import { usePermisosStore, usePuedo } from "@/game/permisos";
import { useOfficeStore } from "@/game/store";
import { useCommands } from "@/lib/commands";
import { calendarioDelAño, directorCommands, fechaDelFestival } from "@/lib/director";
import { PixelIcon, type PixelIconName } from "../Cozy";
import { PanelShell } from "../PointsPanels";

const SEASON_ICON: Record<Season, PixelIconName> = { primavera: "flower", verano: "sun", otono: "leaf", invierno: "snow" };
const WEATHER_ICON: Record<Weather, PixelIconName> = { despejado: "sun", nublado: "cloud", lluvia: "rain", tormenta: "storm", niebla: "fog", nieve: "snow" };

type Tab = "festival" | "clima" | "dia" | "hora" | "momentos" | "musica";
const TABS: { id: Tab; nombre: string; icon: PixelIconName }[] = [
  { id: "festival", nombre: "Festival", icon: "party" },
  { id: "clima", nombre: "Clima", icon: "cloud" },
  { id: "dia", nombre: "Día y estación", icon: "leaf" },
  { id: "hora", nombre: "Hora", icon: "sun" },
  { id: "momentos", nombre: "Momentos", icon: "star" },
  { id: "musica", nombre: "Música", icon: "note" },
];

/** Monta el panel (si está abierto y hay permiso) y sus comandos de la paleta. */
export function DirectorOverlay() {
  const director = usePuedo("director");
  const open = useDirectorStore((s) => s.open);
  useCommands(() =>
    directorCommands(puede(usePermisosStore.getState(), "director"), useOfficeStore.getState().festival.id, {
      open: () => openDirector(),
      festival: (id) => sendDirector({ kind: "festival", id }),
    }),
  );
  if (!director || !open) return null;
  return <DirectorPanel onClose={() => openDirector(false)} />;
}

function DirectorPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("festival");
  return (
    <PanelShell title="Panel del director" icon="clapper" onClose={onClose} wide>
      <Ahora />
      <div role="tablist" aria-label="Secciones del panel" className="mt-3 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} data-on={tab === t.id || undefined} onClick={() => setTab(t.id)} className="cozy-btn gap-1.5 px-2.5 py-1 text-[13px]">
            <PixelIcon name={t.icon} size={12} />
            {t.nombre}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-3">
        {tab === "festival" && <FestivalTab />}
        {tab === "clima" && <ClimaTab />}
        {tab === "dia" && <DiaTab />}
        {tab === "hora" && <HoraTab />}
        {tab === "momentos" && <MomentosTab />}
        {tab === "musica" && <MusicaTab />}
      </div>
      <Respuesta />
      <p className="mt-3 text-[12px] leading-snug text-cozy-ink-soft">Todo lo que cambies aquí lo ven todos y sale como aviso en el chat global.</p>
    </PanelShell>
  );
}

/** Cómo está la cabaña ahora: fecha, hora, clima y festival. */
function Ahora() {
  const t = useGameTime();
  const weather = useOfficeStore((s) => s.weather);
  const festival = useOfficeStore((s) => s.festival);
  const f = festivalById(festival.id);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2 text-[13px]">
      <span className="font-semibold">Ahora</span>
      <span className="tabular-nums">{t ? `${fechaCorta(fechaDelJuego(t.day))}, ${formatGameTime(t.minuteOfDay)}` : "…"}</span>
      <span className="flex items-center gap-1">
        <PixelIcon name={WEATHER_ICON[weather]} size={12} color="var(--color-cozy-wood)" />
        {WEATHER_TEXT[weather]}
      </span>
      <span className="flex items-center gap-1">
        <PixelIcon name="party" size={12} color="var(--color-cozy-wood)" />
        {f ? `${f.nombre}${festival.fase === "fiesta" ? "" : " (cerrado)"}` : "Sin festival"}
      </span>
    </div>
  );
}

/** Lo que contestó el servidor, con el atajo para arreglarlo si hace falta. */
function Respuesta() {
  const last = useDirectorStore((s) => s.last);
  if (!last) return null;
  const fix = arreglo(last);
  return (
    <div role="status" className={`mt-3 flex flex-wrap items-center gap-2 border-2 px-3 py-2 text-[13px] ${last.ok ? "border-cozy-paper-dark" : "border-cozy-red"}`}>
      <PixelIcon name={last.ok ? "check" : "bell"} size={12} color={last.ok ? "var(--color-cozy-wood)" : "var(--color-cozy-red)"} />
      <span className="min-w-0 flex-1">{last.texto}</span>
      {fix && (
        <button type="button" className="cozy-btn cozy-btn-primary py-0.5 text-[13px]" onClick={() => sendDirector(fix.action)}>
          {fix.label}
        </button>
      )}
    </div>
  );
}

/** El paso que falta según el rechazo: prender el festival, ir al invierno o abrir la fiesta. */
function arreglo(r: DirectorResult): { label: string; action: DirectorAction } | null {
  if (r.error === "festival" && r.festival) return { label: `Prender ${festivalById(r.festival)!.nombre}`, action: { kind: "festival", id: r.festival } };
  if (r.error === "nieve") return { label: "Ir al invierno", action: { kind: "estacion", estacion: "invierno" } };
  if (r.error === "cerrado") return { label: "Poner las 10:00", action: { kind: "hora", minuteOfDay: 10 * 60 } };
  return null;
}

function FestivalTab() {
  const pending = useDirectorStore((s) => s.pending);
  const festival = useOfficeStore((s) => s.festival.id);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-[13px] text-cozy-ink-soft">"Prender ahora" lo pone ya, con la fiesta abierta; "Ir a su día" mueve el calendario hasta su fecha.</p>
        <button type="button" disabled={pending} className="cozy-btn py-0.5 text-[13px]" onClick={() => sendDirector({ kind: "festival", id: null })}>
          Volver al calendario
        </button>
      </div>
      <ul className="flex flex-col gap-1.5">
        {FESTIVALES.map((f) => {
          const now = f.id === festival;
          return (
            <li key={f.id} className={`flex flex-wrap items-center gap-2 border-2 px-2.5 py-1.5 ${now ? "border-cozy-red bg-cozy-paper-light" : "border-cozy-paper-dark"}`}>
              <span className="h-3 w-3 shrink-0 outline outline-2 outline-cozy-frame" style={{ background: f.color }} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">
                  {f.nombre}
                  {now && <span className="ml-1.5 text-[12px] font-normal text-cozy-red">ahora</span>}
                </p>
                <p className="text-[12px] text-cozy-ink-soft">{fechaDelFestival(f, SEASON_TEXT[f.estacion].toLowerCase())}</p>
              </div>
              <button type="button" disabled={pending} className="cozy-btn cozy-btn-primary py-0.5 text-[13px]" onClick={() => sendDirector({ kind: "festival", id: f.id })}>
                Prender ahora
              </button>
              <button type="button" disabled={pending} className="cozy-btn py-0.5 text-[13px]" onClick={() => sendDirector({ kind: "irFestival", id: f.id })}>
                Ir a su día
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ClimaTab() {
  const pending = useDirectorStore((s) => s.pending);
  const weather = useOfficeStore((s) => s.weather);
  const t = useGameTime();
  const season = t ? fechaDelJuego(t.day).estacion : null;
  // 0 = hasta volver al clima natural.
  const [minutes, setMinutes] = useState(0);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1.5 text-[13px] text-cozy-ink-soft">¿Cuánto dura?</p>
        <div className="flex flex-wrap gap-1.5">
          {[0, ...DIRECTOR_CLIMA_MINUTOS].map((m) => (
            <button key={m} type="button" data-on={minutes === m || undefined} aria-pressed={minutes === m} className="cozy-btn py-0.5 text-[13px]" onClick={() => setMinutes(m)}>
              {m ? `${m} min` : "Hasta que lo sueltes"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {WEATHERS.map((w) => {
          const ok = !season || climaPermitido(w, season);
          return (
            <button
              key={w}
              type="button"
              disabled={pending || !ok}
              data-on={weather === w || undefined}
              title={ok ? undefined : "Solo nieva en invierno"}
              className="cozy-btn justify-start gap-2 py-1.5 text-[14px]"
              onClick={() => sendDirector(minutes ? { kind: "clima", weather: w, minutes } : { kind: "clima", weather: w })}
            >
              <PixelIcon name={WEATHER_ICON[w]} size={14} />
              {WEATHER_TEXT[w]}
            </button>
          );
        })}
      </div>
      {season && season !== "invierno" && (
        <p className="flex flex-wrap items-center gap-2 text-[12px] text-cozy-ink-soft">
          Solo nieva en invierno.
          <button type="button" disabled={pending} className="cozy-btn py-0.5 text-[12px]" onClick={() => sendDirector({ kind: "estacion", estacion: "invierno" })}>
            Ir al invierno
          </button>
        </p>
      )}
      <button type="button" disabled={pending} className="cozy-btn self-start" onClick={() => sendDirector({ kind: "clima", weather: null })}>
        Volver al clima natural
      </button>
    </div>
  );
}

function DiaTab() {
  const pending = useDirectorStore((s) => s.pending);
  const t = useGameTime();
  const hoy = t ? fechaDelJuego(t.day) : null;
  const [ver, setVer] = useState<Season>(hoy?.estacion ?? "primavera");
  const cal = calendarioDelAño().find((c) => c.estacion === ver)!;
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1.5 text-[13px] text-cozy-ink-soft">Saltar a una estación (al día 1, a la misma hora):</p>
        <div className="flex flex-wrap gap-1.5">
          {SEASONS.map((s) => (
            <button key={s} type="button" disabled={pending || hoy?.estacion === s} className="cozy-btn gap-1.5 py-0.5 text-[13px]" onClick={() => sendDirector({ kind: "estacion", estacion: s })}>
              <PixelIcon name={SEASON_ICON[s]} size={12} />
              {SEASON_TEXT[s]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <p className="mr-1 text-[13px] text-cozy-ink-soft">Calendario:</p>
          {SEASONS.map((s) => (
            <button key={s} type="button" data-on={ver === s || undefined} aria-pressed={ver === s} className="cozy-btn py-0 text-[12px]" onClick={() => setVer(s)}>
              {SEASON_TEXT[s]}
            </button>
          ))}
        </div>
        <table className="w-full max-w-sm table-fixed border-separate border-spacing-[3px] text-center">
          <thead>
            <tr>
              {Array.from({ length: DIAS_POR_SEMANA }, (_, d) => (
                <th key={d} scope="col" className="text-[11px] font-normal text-cozy-ink-soft">
                  {diaCorto(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2].map((w) => (
              <tr key={w}>
                {cal.dias.slice(w * DIAS_POR_SEMANA, (w + 1) * DIAS_POR_SEMANA).map((d) => {
                  const today = hoy?.estacion === ver && hoy.diaDeEstacion === d.dia;
                  const title = [today ? "Hoy" : "", d.festival?.nombre ?? ""].filter(Boolean).join(" · ");
                  return (
                    <td key={d.dia} className="p-0">
                      <button
                        type="button"
                        disabled={pending || today}
                        title={title || `Ir al ${d.dia} de ${SEASON_TEXT[ver].toLowerCase()}`}
                        aria-label={`Ir al ${d.dia} de ${SEASON_TEXT[ver].toLowerCase()}${d.festival ? `, ${d.festival.nombre}` : ""}`}
                        onClick={() => sendDirector({ kind: "dia", estacion: ver, dia: d.dia })}
                        className={`relative h-8 w-full border-2 text-[13px] tabular-nums ${today ? "border-cozy-red font-semibold" : "border-cozy-paper-dark hover:border-cozy-wood"} bg-cozy-paper-light`}
                      >
                        {d.dia}
                        {d.festival && (
                          <span className="absolute right-[2px] bottom-[2px] h-[5px] w-[5px] outline outline-1 outline-cozy-frame" style={{ background: d.festival.color }} aria-hidden />
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-[12px] text-cozy-ink-soft">El calendario siempre va para adelante: un día que ya pasó es el del año que viene. El huerto sigue con la estación nueva.</p>
      </div>
      <div>
        <p className="mb-1.5 text-[13px] text-cozy-ink-soft">Ir al día de un festival (con la fiesta abierta):</p>
        <div className="flex flex-wrap gap-1.5">
          {FESTIVALES.map((f) => (
            <button key={f.id} type="button" disabled={pending} className="cozy-btn gap-1.5 py-0.5 text-[12px]" onClick={() => sendDirector({ kind: "irFestival", id: f.id })}>
              <span className="h-2 w-2 outline outline-1 outline-cozy-frame" style={{ background: f.color }} aria-hidden />
              {f.nombre}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function HoraTab() {
  const pending = useDirectorStore((s) => s.pending);
  const [hora, setHora] = useState("10:00");
  const poner = () => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hora);
    if (!m) return;
    const minuto = Number(m[1]) * 60 + Number(m[2]);
    if (minuto >= 0 && minuto < 24 * 60) sendDirector({ kind: "hora", minuteOfDay: minuto });
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {DIRECTOR_HORAS.map((h) => (
          <button key={h.id} type="button" disabled={pending} className="cozy-btn py-1 text-[13px]" onClick={() => sendDirector({ kind: "hora", minuteOfDay: h.minuto })}>
            {h.nombre} <span className="text-cozy-ink-soft tabular-nums">{formatGameTime(h.minuto)}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[13px]">
          Otra hora
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="cozy-input w-28 py-0.5" />
        </label>
        <button type="button" disabled={pending} className="cozy-btn py-0.5 text-[13px]" onClick={poner}>
          Poner
        </button>
        <button type="button" disabled={pending} className="cozy-btn py-0.5 text-[13px]" onClick={() => sendDirector({ kind: "adelantar", minutes: 60 })}>
          Adelantar 1 h
        </button>
      </div>
      <p className="text-[12px] text-cozy-ink-soft">La hora siempre va para adelante: si ya pasó hoy, es la de mañana.</p>
    </div>
  );
}

function MomentosTab() {
  const pending = useDirectorStore((s) => s.pending);
  const festival = useOfficeStore((s) => s.festival);
  return (
    <ul className="flex flex-col gap-1.5">
      {DIRECTOR_ACCIONES.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center gap-2 border-2 border-cozy-paper-dark px-2.5 py-1.5">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">{a.nombre}</p>
            <p className="text-[12px] text-cozy-ink-soft">{a.descripcion}</p>
          </div>
          <MomentoBoton accion={a} festival={festival} pending={pending} />
        </li>
      ))}
    </ul>
  );
}

/** Disparar el momento, o primero prender su festival si no está. */
function MomentoBoton({ accion, festival, pending }: { accion: DirectorAccionDef; festival: { id: string; fase: string }; pending: boolean }) {
  const falta: FestivalId | null = accion.festival && festival.id !== accion.festival ? accion.festival : null;
  if (falta)
    return (
      <button type="button" disabled={pending} className="cozy-btn py-0.5 text-[13px]" onClick={() => sendDirector({ kind: "festival", id: falta })}>
        Prender {festivalById(falta)!.nombre} primero
      </button>
    );
  const sinFestival = accion.conFestival && !festival.id;
  return (
    <button
      type="button"
      disabled={pending || sinFestival}
      title={sinFestival ? "Primero prende un festival" : undefined}
      className="cozy-btn cozy-btn-primary py-0.5 text-[13px]"
      onClick={() => sendDirector({ kind: "momento", id: accion.id })}
    >
      Ahora
    </button>
  );
}

const CONJUNTO_TEXT = { murga: "Murga", colectivo: "Colectivo andino" } as const;
const minSeg = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** La música del Carnaval: escucharla aquí solo o ponerla a sonar para todos. */
function MusicaTab() {
  const pending = useDirectorStore((s) => s.pending);
  const sonando = useDirectorStore((s) => s.sonando);
  const piezas = listaParaEscuchar();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-[13px] text-cozy-ink-soft">"Escuchar" la toca solo para ti; "Para todos" la oyen todos los que están conectados.</p>
        <button type="button" disabled={pending || !sonando} className="cozy-btn py-0.5 text-[13px]" onClick={() => (sonando?.paraTodos ? sendDirector({ kind: "musica", pieza: null }) : sonarPieza(null))}>
          <PixelIcon name="pause" size={11} />
          Parar
        </button>
      </div>
      <ul className="flex flex-col gap-1.5">
        {piezas.map((p) => {
          const suena = sonando?.pieza === p.id;
          return (
            <li key={p.id} className={`flex flex-wrap items-center gap-2 border-2 px-2.5 py-1.5 ${suena ? "border-cozy-red bg-cozy-paper-light" : "border-cozy-paper-dark"}`}>
              <PixelIcon name="note" size={14} color={suena ? "var(--color-cozy-red)" : "var(--color-cozy-wood)"} />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">
                  {p.nombre}
                  {suena && <span className="ml-1.5 text-[12px] font-normal text-cozy-red">{sonando?.paraTodos ? "sonando para todos" : "sonando"}</span>}
                </p>
                <p className="text-[12px] text-cozy-ink-soft">
                  {CONJUNTO_TEXT[p.conjunto]} · {minSeg(p.duracionS)}
                  {p.original ? "" : " · tradicional"}
                </p>
              </div>
              <button type="button" className="cozy-btn py-0.5 text-[13px]" onClick={() => sonarPieza(suena && !sonando?.paraTodos ? null : p.id)}>
                <PixelIcon name={suena && !sonando?.paraTodos ? "pause" : "play"} size={11} />
                {suena && !sonando?.paraTodos ? "Parar" : "Escuchar"}
              </button>
              <button type="button" disabled={pending} className="cozy-btn cozy-btn-primary py-0.5 text-[13px]" onClick={() => sendDirector({ kind: "musica", pieza: p.id, nombre: p.nombre })}>
                Para todos
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
