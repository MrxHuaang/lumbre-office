"use client";

import {
  DIAS_POR_ESTACION,
  DIAS_POR_SEMANA,
  GAME_DAY_REAL_MS,
  SEASON_TEXT,
  SEMANAS_POR_ESTACION,
  calendarMarks,
  cumpleañosEnEstacion,
  diaCorto,
  type FechaDelJuego,
  type MarcaCalendario,
  type Season,
} from "@hyvento/shared";
import { useEffect, useMemo, useState } from "react";
import { loadBirthdays, type BirthdaysDTO } from "@/lib/birthdays";
import { PixelIcon, type PixelIconName } from "./Cozy";

const SEASON_ICON: Record<Season, PixelIconName> = { primavera: "flower", verano: "sun", otono: "leaf", invierno: "snow" };
const MARK_COLOR: Record<MarcaCalendario["tipo"], string> = { festival: "var(--color-cozy-gold)", cumpleaños: "var(--color-cozy-red)" };

/**
 * El calendario de la estación (se abre con la placa del reloj): 3 semanas de 7 días, hoy marcado, y lo
 * que cae en cada día: los festivales (`calendarMarks`, todavía vacíos) y los cumpleaños del equipo
 * (su día y mes real caen en un día del año del juego, ver `cumpleañosEnEstacion`).
 */
export function CalendarioPanel({ fecha }: { fecha: FechaDelJuego }) {
  const people = useBirthdays();
  const marks = useMemo(
    () => [...calendarMarks(fecha.estacion), ...cumpleañosEnEstacion(people, fecha.estacion)].sort((a, b) => a.dia - b.dia),
    [fecha.estacion, people],
  );
  const byDay = useMemo(() => {
    const m = new Map<number, MarcaCalendario[]>();
    for (const mark of marks) m.set(mark.dia, [...(m.get(mark.dia) ?? []), mark]);
    return m;
  }, [marks]);
  const weeks = Array.from({ length: SEMANAS_POR_ESTACION }, (_, w) => Array.from({ length: DIAS_POR_SEMANA }, (_, d) => w * DIAS_POR_SEMANA + d + 1));
  const hours = Math.round(GAME_DAY_REAL_MS / 3_600_000);

  return (
    <div role="dialog" aria-label={`Calendario: ${SEASON_TEXT[fecha.estacion]}, año ${fecha.año}`} className="cozy-panel absolute top-full left-0 z-30 mt-3 w-[19rem] max-w-[calc(100vw-1.5rem)] p-3">
      <div className="mb-2.5 flex items-center gap-2">
        <PixelIcon name={SEASON_ICON[fecha.estacion]} size={20} color="var(--color-cozy-wood)" />
        <div className="min-w-0 flex-1">
          <p className="font-pixel text-[18px] leading-none">{SEASON_TEXT[fecha.estacion]}</p>
          <p className="mt-1 text-[12px] text-cozy-ink-soft">
            Año {fecha.año} · día {fecha.diaDeEstacion} de {DIAS_POR_ESTACION}
          </p>
        </div>
      </div>

      <table className="w-full table-fixed border-separate border-spacing-[3px] text-center">
        <thead>
          <tr>
            {Array.from({ length: DIAS_POR_SEMANA }, (_, d) => (
              <th key={d} scope="col" className="pb-0.5 text-[11px] font-normal text-cozy-ink-soft">
                {diaCorto(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((days, w) => (
            <tr key={w}>
              {days.map((day) => {
                const today = day === fecha.diaDeEstacion;
                const past = day < fecha.diaDeEstacion;
                const dayMarks = byDay.get(day) ?? [];
                const title = [today ? "Hoy" : "", ...dayMarks.map((m) => m.texto)].filter(Boolean).join(" · ");
                return (
                  <td
                    key={day}
                    aria-current={today ? "date" : undefined}
                    title={title || undefined}
                    className={`relative h-8 border-2 text-[13px] tabular-nums ${
                      today
                        ? "border-cozy-red bg-cozy-paper-light font-semibold"
                        : past
                          ? "border-cozy-paper-dark bg-cozy-paper-dark/60 text-cozy-ink-soft"
                          : "border-cozy-paper-dark bg-cozy-paper-light"
                    }`}
                  >
                    {day}
                    {dayMarks.length > 0 && (
                      <span className="absolute right-[2px] bottom-[2px] flex gap-[2px]" aria-hidden>
                        {dayMarks.slice(0, 2).map((m, i) => (
                          <span key={i} className="h-[4px] w-[4px] outline outline-1 outline-cozy-frame" style={{ background: MARK_COLOR[m.tipo] }} />
                        ))}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2.5 border-t-2 border-cozy-paper-dark pt-2 text-[12px]">
        {marks.length ? (
          <ul className="cozy-scroll flex max-h-24 flex-col gap-1 overflow-y-auto">
            {marks.map((m, i) => (
              <li key={i} className={`flex items-center gap-1.5 ${m.dia < fecha.diaDeEstacion ? "text-cozy-ink-soft" : ""}`}>
                <span className="h-[6px] w-[6px] shrink-0 outline outline-1 outline-cozy-frame" style={{ background: MARK_COLOR[m.tipo] }} aria-hidden />
                <span className="tabular-nums">{m.dia}</span>
                <span className="truncate">{m.texto}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-cozy-ink-soft">Nada marcado esta estación.</p>
        )}
        <p className="mt-2 text-[11px] leading-snug text-cozy-ink-soft">
          Cada estación dura {DIAS_POR_ESTACION} días del juego y un día, {hours === 1 ? "una hora real" : `${hours} horas reales`}. El reloj solo corre con gente en la cabaña.
        </p>
      </div>
    </div>
  );
}

/** Los cumpleaños del equipo (día y mes), una vez por apertura del calendario; si falla, sin cumpleaños. */
function useBirthdays(): BirthdaysDTO["people"] {
  const [people, setPeople] = useState<BirthdaysDTO["people"]>([]);
  useEffect(() => {
    let alive = true;
    loadBirthdays()
      .then((b) => alive && setPeople(b.people))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return people;
}
