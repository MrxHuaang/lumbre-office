// Eventos del calendario de la cabaña: los cumpleaños (con felicitaciones que dan puntos) y los viernes
// de karaoke en el club. Todo se cuenta con la hora de Bogotá, igual que los puntos (ver points.ts).
import { z } from "zod";

const OFFSET_MS = -5 * 3_600_000;

/** Fecha y hora de Bogotá de `ts` (mes 1-12, día de la semana 0 = domingo). */
export function bogotaDate(ts: number) {
  const d = new Date(ts + OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), weekday: d.getUTCDay(), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
}

// ---------- Cumpleaños ----------

export const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"] as const;

/** Días de cada mes (febrero con el 29: el año no se guarda). */
const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** El cumpleaños se guarda como "MM-DD" (sin año). */
export const BIRTHDAY_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** "MM-DD" válido (un 31 de abril no existe) o null. */
export function parseBirthday(raw: unknown): { month: number; day: number } | null {
  if (typeof raw !== "string" || !BIRTHDAY_RE.test(raw)) return null;
  const [month, day] = raw.split("-").map(Number) as [number, number];
  return day <= MONTH_DAYS[month - 1]! ? { month, day } : null;
}

export const birthdayKey = (month: number, day: number) => `${pad2(month)}-${pad2(day)}`;

/** Lo que manda el perfil: "MM-DD" o null para borrarlo. */
export const BirthdayField = z
  .string()
  .refine((s) => parseBirthday(s) !== null, "Fecha inválida")
  .nullable();

/** "27 de septiembre". */
export function formatBirthday(birthday: string): string {
  const b = parseBirthday(birthday);
  return b ? `${b.day} de ${MONTH_NAMES[b.month - 1]}` : "";
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/**
 * ¿Qué cumpleaños ("MM-DD") se celebran el día de Bogotá de `ts`? Normalmente uno; el 28 de febrero de
 * un año no bisiesto, también el 29 (así quien nació ese día igual tiene su fiesta).
 */
export function birthdayKeysOn(ts: number): string[] {
  const d = bogotaDate(ts);
  const keys = [birthdayKey(d.month, d.day)];
  if (d.month === 2 && d.day === 28 && !isLeap(d.year)) keys.push("02-29");
  return keys;
}

export const isBirthdayOn = (birthday: string | null | undefined, ts: number) => Boolean(birthday) && birthdayKeysOn(ts).includes(birthday!);

/** Número de día de Bogotá (cambia a la medianoche de Bogotá): la clave de "hoy" para los eventos. */
export const eventDay = (ts: number) => Math.floor((ts + OFFSET_MS) / 86_400_000);

export const BIRTHDAY = {
  /** Lo que da cada felicitación a quien cumple (motivo GIFT: el ranking no lo cuenta). */
  congratsPoints: 5,
  /** Felicitaciones con puntos por día para quien cumple (después se agradecen igual, sin puntos). */
  congratsDailyCap: 10,
  /** Cuánto dura el confeti en pantalla. */
  confettiMs: 4_500,
} as const;

/** `refId` del premio de una felicitación: una por persona que felicita, por cumpleañero y por día. */
export const congratsRefPrefix = (day: number, toUserId: string) => `cumple:${day}:${toUserId}:`;
export const congratsRef = (day: number, toUserId: string, fromUserId: string) => `${congratsRefPrefix(day, toUserId)}${fromUserId}`;

/** Cliente → servidor (`MSG.congrats`): felicitar a quien cumple hoy. */
export const CongratsMessage = z.object({ userId: z.string().min(1).max(64) });
export type CongratsMessage = z.infer<typeof CongratsMessage>;

export type CongratsError = "not-birthday" | "self" | "already" | "failed";

/** Servidor → quien felicita. */
export type CongratsResult = { ok: true; toName: string } | { ok: false; error: CongratsError };

export const CONGRATS_ERROR_TEXT: Record<CongratsError, string> = {
  "not-birthday": "Hoy no es su cumpleaños.",
  self: "Felicitarse uno mismo no vale (aunque te lo mereces).",
  already: "Ya le deseaste feliz cumpleaños hoy.",
  failed: "No se pudo mandar la felicitación. Intenta de nuevo.",
};

/**
 * Servidor → todos: alguien felicitó a quien cumple. Quien cumple lo ve con los puntos; los del mismo
 * nivel ven confeti sobre su avatar.
 */
export interface CongratsEvent {
  fromName: string;
  toUserId: string;
  toName: string;
  /** Puntos que recibió (0 si ya llegó al tope del día). */
  points: number;
}

// ---------- Viernes de karaoke ----------

export const KARAOKE = {
  /** Viernes (0 = domingo). */
  weekday: 5,
  /** Desde las 17:00 de Bogotá hasta la medianoche. */
  fromHour: 17,
  /** Lo que se le suma a la búsqueda de YouTube para encontrar la versión para cantar. */
  searchSuffix: "karaoke",
} as const;

/** ¿El club está en modo karaoke a esta hora? (viernes desde las 17:00 de Bogotá). */
export function isKaraokeTime(ts: number): boolean {
  const d = bogotaDate(ts);
  return d.weekday === KARAOKE.weekday && d.hour >= KARAOKE.fromHour;
}

/** ¿Ese día (año, mes 1-12, día) hay karaoke? Para el calendario. */
export const isKaraokeDay = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day)).getUTCDay() === KARAOKE.weekday;

/** Búsqueda de YouTube de la versión karaoke de una canción. */
export function karaokeSearchUrl(song: string): string {
  const q = `${song.trim()} ${KARAOKE.searchSuffix}`.trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}
