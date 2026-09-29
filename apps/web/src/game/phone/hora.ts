// La hora del celular es la de Bogotá (la del equipo), no la del computador de cada quien.
// Colombia no cambia la hora en el año: UTC-5 fijo, así que se calcula sin depender de Intl.

const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export interface BogotaTime {
  h: number;
  m: number;
  s: number;
  weekday: string;
  day: number;
  month: string;
  /** "2026-09-27": para saber si la alarma ya sonó hoy. */
  dayKey: string;
}

export function bogotaTime(ms: number = Date.now()): BogotaTime {
  const d = new Date(ms + BOGOTA_OFFSET_MS);
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  const day = d.getUTCDate();
  return {
    h: d.getUTCHours(),
    m: d.getUTCMinutes(),
    s: d.getUTCSeconds(),
    weekday: DIAS[d.getUTCDay()]!,
    day,
    month: MESES[mo]!,
    dayKey: `${y}-${String(mo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

export const pad2 = (n: number) => String(n).padStart(2, "0");
export const hhmm = (t: { h: number; m: number }) => `${pad2(t.h)}:${pad2(t.m)}`;

export interface Alarm {
  on: boolean;
  h: number;
  m: number;
  /** Día (de Bogotá) en que ya sonó: suena una vez por día. */
  firedOn: string;
}

/** ¿Tiene que sonar ahora? (en el minuto exacto o hasta 2 más tarde, por si la pestaña estaba dormida). */
export function alarmDue(a: Alarm, now: BogotaTime): boolean {
  if (!a.on || a.firedOn === now.dayKey) return false;
  const late = now.h * 60 + now.m - (a.h * 60 + a.m);
  return late >= 0 && late <= 2;
}

/** "0730" → 07:30 (lo que se escribe con el teclado); null si no es una hora. */
export function parseAlarmDigits(digits: string): { h: number; m: number } | null {
  if (!/^\d{4}$/.test(digits)) return null;
  const h = Number(digits.slice(0, 2));
  const m = Number(digits.slice(2));
  return h < 24 && m < 60 ? { h, m } : null;
}
