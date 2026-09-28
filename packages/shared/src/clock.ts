// Reloj propio del juego, como el de Minecraft: un día del juego dura una hora real (una hora del juego son
// 2,5 minutos reales). Así cada clima (10-25 min reales, ver weather.ts) cabe en una parte del día: la
// niebla de la mañana (5:00-9:00) dura lo mismo que el clima más corto. Lo lleva el servidor de juego y llega a todos por el estado; el cliente solo lo
// proyecta con su propio reloj. Los admins lo cambian en el chat con /time (ver parseTimeCommand).
// La noche del juego manda sobre todo lo que depende de la hora: luces, faroles, peces de noche, el
// telescopio, los buses nocturnos y cuándo sale el Man del Sombrero.

/** Duración real de un día del juego. */
export const GAME_DAY_REAL_MS = 60 * 60_000;
export const GAME_MINUTES_PER_DAY = 24 * 60;
/** Minutos del juego por milisegundo real. */
const SPEED = GAME_MINUTES_PER_DAY / GAME_DAY_REAL_MS;

/**
 * Estado del reloj: en el instante real `anchorReal` iban `anchorMinute` minutos del juego (contados desde
 * el día 0, así que también dice el día). Cambiar la hora es mover el ancla, nunca tocar el reloj real.
 */
export interface GameClockState {
  anchorReal: number;
  anchorMinute: number;
}

/** La noche del juego: de 19:00 a 6:59, como la noche real de antes. */
export const NIGHT_FROM = 19 * 60;
export const NIGHT_UNTIL = 7 * 60;

/** Minutos del juego transcurridos desde el día 0 (con decimales). */
export function gameMinutes(c: GameClockState, now: number): number {
  return c.anchorMinute + (now - c.anchorReal) * SPEED;
}

export interface GameTime {
  /** Día del juego (0, 1, 2…). */
  day: number;
  /** Minuto del día, 0..1439 (entero). */
  minuteOfDay: number;
  hour: number;
  minute: number;
}

export function gameTime(c: GameClockState, now: number): GameTime {
  const total = Math.floor(gameMinutes(c, now));
  const day = Math.floor(total / GAME_MINUTES_PER_DAY);
  const minuteOfDay = total - day * GAME_MINUTES_PER_DAY;
  return { day, minuteOfDay, hour: Math.floor(minuteOfDay / 60), minute: minuteOfDay % 60 };
}

export const isNightMinute = (minuteOfDay: number) => minuteOfDay >= NIGHT_FROM || minuteOfDay < NIGHT_UNTIL;
export const isGameNight = (c: GameClockState, now: number) => isNightMinute(gameTime(c, now).minuteOfDay);

/** "07:05". */
export function formatGameTime(minuteOfDay: number): string {
  const m = ((Math.floor(minuteOfDay) % GAME_MINUTES_PER_DAY) + GAME_MINUTES_PER_DAY) % GAME_MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** El reloj del HUD avanza de a 10 minutos del juego, como el de Stardew Valley. */
export const CLOCK_STEP = 10;
export const clockStep = (minuteOfDay: number) => Math.floor(minuteOfDay / CLOCK_STEP) * CLOCK_STEP;

/** Momento del cielo para el ícono del reloj: amanece de 5 a 7, atardece de 17 a 19 y el resto es noche. */
export type SkyPhase = "amanecer" | "dia" | "atardecer" | "noche";
export function skyPhase(minuteOfDay: number): SkyPhase {
  if (isNightMinute(minuteOfDay)) return minuteOfDay >= 5 * 60 && minuteOfDay < NIGHT_UNTIL ? "amanecer" : "noche";
  return minuteOfDay >= 17 * 60 ? "atardecer" : "dia";
}

/**
 * Día 0 del juego: medianoche de Bogotá del 28 de septiembre de 2026. El reloj de siempre cuenta desde
 * acá, así que reiniciar el servidor no lo vuelve a empezar: la hora y el día salen solo del reloj real.
 */
export const GAME_EPOCH = Date.UTC(2026, 8, 28, 5);

/** El reloj de siempre (sin cambios de /time): el día 0 a las 00:00 fue `GAME_EPOCH`. */
export function initialClock(): GameClockState {
  return { anchorReal: GAME_EPOCH, anchorMinute: 0 };
}

/** Lee un reloj guardado (JSON crudo de la base), o null si no sirve. */
export function parseGameClock(raw: unknown): GameClockState | null {
  if (!raw || typeof raw !== "object") return null;
  const { anchorReal, anchorMinute } = raw as Record<string, unknown>;
  if (typeof anchorReal !== "number" || typeof anchorMinute !== "number") return null;
  if (!Number.isFinite(anchorReal) || !Number.isFinite(anchorMinute) || anchorMinute < 0) return null;
  return { anchorReal, anchorMinute };
}

/**
 * Pone el reloj en un minuto del día. Como en Minecraft, la hora nueva siempre queda hacia adelante: si ya
 * pasó hoy, es la de mañana (el día del juego nunca retrocede).
 */
export function setGameTime(c: GameClockState, now: number, minuteOfDay: number): GameClockState {
  const t = gameTime(c, now);
  const target = t.day * GAME_MINUTES_PER_DAY + minuteOfDay;
  return { anchorReal: now, anchorMinute: target >= gameMinutes(c, now) ? target : target + GAME_MINUTES_PER_DAY };
}

/** Adelanta el reloj (solo hacia adelante). */
export function addGameTime(c: GameClockState, now: number, minutes: number): GameClockState {
  return { anchorReal: now, anchorMinute: gameMinutes(c, now) + Math.max(0, minutes) };
}

/** Nombres de hora que acepta /time set (en español y los de Minecraft). */
export const TIME_NAMES: Record<string, number> = {
  amanecer: 6 * 60,
  dia: 7 * 60,
  day: 7 * 60,
  mediodia: 12 * 60,
  noon: 12 * 60,
  tarde: 15 * 60,
  atardecer: 18 * 60,
  sunset: 18 * 60,
  noche: 20 * 60,
  night: 20 * 60,
  medianoche: 0,
  midnight: 0,
};

export type TimeCommand = { kind: "set"; minuteOfDay: number } | { kind: "add"; minutes: number } | { kind: "query" };

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "/time set 18:30", "/time set noche", "/time add 2h", "/time add 90", "/time" → comando, o null si no es /time. */
export function parseTimeCommand(text: string): TimeCommand | null {
  const parts = strip(text.trim()).split(/\s+/);
  if (parts[0] !== "/time" && parts[0] !== "/hora") return null;
  const [, verb, arg] = parts;
  if (!verb || verb === "query" || verb === "ver") return { kind: "query" };
  if (!arg) return null;
  if (verb === "set" || verb === "poner") {
    if (arg in TIME_NAMES) return { kind: "set", minuteOfDay: TIME_NAMES[arg]! };
    const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(arg);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2] ?? 0);
    if (h > 23 || min > 59) return null;
    return { kind: "set", minuteOfDay: h * 60 + min };
  }
  if (verb === "add" || verb === "sumar") {
    const m = /^(\d+(?:\.\d+)?)(h|m)?$/.exec(arg);
    if (!m) return null;
    const minutes = Number(m[1]) * (m[2] === "h" ? 60 : 1);
    if (!(minutes > 0) || minutes > GAME_MINUTES_PER_DAY * 7) return null;
    return { kind: "add", minutes: Math.round(minutes) };
  }
  return null;
}
