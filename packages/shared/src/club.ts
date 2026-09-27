// El club del sótano: la música de la cabina de DJ, el baile en la pista y el tubo. El servidor guarda
// qué suena (y desde cuándo, con su hora) y quién baila; cada cliente genera la música con WebAudio y
// dibuja los pasos en el mismo compás, porque todos cuentan el tiempo desde el mismo `startedAt`.
import { z } from "zod";

/** Pistas de la cabina: cada una es un loop de `bars` compases de 4 tiempos, generado por código. */
export const CLUB_TRACKS = [
  { id: "house", name: "House", bpm: 124, bars: 8, hint: "Bombo en cada tiempo y acordes que laten" },
  { id: "reggaeton", name: "Reggaetón suave", bpm: 94, bars: 8, hint: "Dembow tranquilo con marimba" },
  { id: "lofi", name: "Lofi", bpm: 78, bars: 8, hint: "Teclado cálido y crujido de vinilo" },
  { id: "disco", name: "Disco", bpm: 116, bars: 8, hint: "Bajo en octavas y cuerdas" },
  { id: "synthwave", name: "Synthwave", bpm: 100, bars: 8, hint: "Arpegios de los ochenta" },
] as const;

export type ClubTrackId = (typeof CLUB_TRACKS)[number]["id"];
export type ClubTrack = (typeof CLUB_TRACKS)[number];
export const CLUB_TRACK_IDS = CLUB_TRACKS.map((t) => t.id) as [ClubTrackId, ...ClubTrackId[]];
export const clubTrack = (id: string): ClubTrack | undefined => CLUB_TRACKS.find((t) => t.id === id);

/** Pasos de la pista de baile (se elige uno y se repite al ritmo de la música). */
export const DANCE_MOVES = [
  { id: "vaiven", name: "Vaivén" },
  { id: "brazos", name: "Brazos arriba" },
  { id: "giro", name: "Giro" },
  { id: "robot", name: "Robot" },
] as const;

export type DanceMoveId = (typeof DANCE_MOVES)[number]["id"];
export const DANCE_MOVE_IDS = DANCE_MOVES.map((m) => m.id) as [DanceMoveId, ...DanceMoveId[]];

export const CLUB = {
  /** Nivel y zona del club: la música solo se oye dentro de la zona. */
  area: "sotano",
  zone: "club",
  /** Pausa mínima entre dos cambios de la cabina de la misma persona. */
  djCooldownMs: 800,
  /** Pausa mínima entre dos cambios de paso (o subirse y bajarse del tubo). */
  danceCooldownMs: 300,
  /** Si los pies se alejan más que esto (px de mundo) de donde empezó a bailar, deja de bailar. */
  leavePx: 10,
  /** Hasta dónde (px de mundo, desde el centro del tubo) se puede engancharse al tubo. */
  poleReachPx: 1.6 * 32,
  /** Tempo de la rutina del tubo cuando no suena nada (con música sigue a la pista). */
  poleBpm: 96,
} as const;

/** Duración de un loop de la pista, en ms. */
export const loopMs = (t: { bpm: number; bars: number }) => (t.bars * 4 * 60_000) / t.bpm;

/** Lo que el servidor sincroniza de la música (espejo de `ClubState`). */
export interface ClubMusicState {
  track: string;
  startedAt: number;
  paused: boolean;
  pausedAt: number;
}

/**
 * Tiempo transcurrido de la pista (ms, sin dar la vuelta al loop) a la hora del servidor `serverNow`,
 * o null si no suena nada. En pausa se queda donde se pausó.
 */
export function trackElapsed(s: ClubMusicState, serverNow: number): number | null {
  if (!s.track || !clubTrack(s.track)) return null;
  if (s.paused) return s.pausedAt;
  return Math.max(0, serverNow - s.startedAt);
}

/** ¿Está sonando algo (y no en pausa)? */
export const isPlaying = (s: ClubMusicState) => Boolean(s.track && clubTrack(s.track) && !s.paused);

/** Tiempo (en negras, con decimales) a la hora `serverNow`; null si no suena. */
export function beatAt(s: ClubMusicState, serverNow: number): number | null {
  const t = clubTrack(s.track);
  const elapsed = trackElapsed(s, serverNow);
  if (!t || elapsed === null) return null;
  return (elapsed * t.bpm) / 60_000;
}

// ---------- Mensajes ----------

/** Cliente → servidor (`MSG.clubDj`): lo que se hace en la consola de la cabina. */
export const ClubDjMessage = z.discriminatedUnion("action", [
  z.object({ action: z.literal("play"), track: z.enum(CLUB_TRACK_IDS) }),
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("stop") }),
]);
export type ClubDjMessage = z.infer<typeof ClubDjMessage>;

/** Cliente → servidor (`MSG.clubDance`): bailar en la pista con un paso, o dejar de bailar (`null`). */
export const ClubDanceMessage = z.object({ move: z.enum(DANCE_MOVE_IDS).nullable() });
export type ClubDanceMessage = z.infer<typeof ClubDanceMessage>;

/** Cliente → servidor (`MSG.clubPole`): engancharse al tubo o soltarlo. */
export const ClubPoleMessage = z.object({ on: z.boolean() });
export type ClubPoleMessage = z.infer<typeof ClubPoleMessage>;

export type ClubError = "far" | "busy" | "taken" | "silence" | "seated" | "invalid";

/** Servidor → cliente (`MSG.clubResult`) cuando no se pudo. */
export interface ClubResult {
  ok: false;
  error: ClubError;
}

export const CLUB_ERROR_TEXT: Record<ClubError, string> = {
  far: "Acércate un poco más.",
  busy: "Un momento…",
  taken: "Alguien ya está bailando en el tubo.",
  silence: "Para bailar en la pista tiene que sonar música: pon algo en la cabina del DJ.",
  seated: "Primero levántate.",
  invalid: "Eso no se puede hacer aquí.",
};

/** Llave de un tubo (su tile), para saber quién baila en cuál. */
export const poleKey = (x: number, y: number) => `${x},${y}`;

// ---------- Hora del servidor ----------

/** Cliente → servidor (`MSG.clockPing`): pide la hora; `id` es para reconocer la respuesta. */
export const ClockPingMessage = z.object({ id: z.number().int().min(0).max(1_000_000_000) });
export type ClockPingMessage = z.infer<typeof ClockPingMessage>;

/** Servidor → cliente (`MSG.clockPong`). */
export interface ClockPong {
  id: number;
  now: number;
}

/** Una medida: cuándo se mandó el ping y cuándo volvió (hora local) y la hora que dio el servidor. */
export interface ClockSample {
  sentAt: number;
  receivedAt: number;
  serverNow: number;
}

/**
 * Diferencia entre la hora del servidor y la local (ms). Se queda con la medida de menor ida y vuelta (la
 * menos afectada por la red) y supone que el servidor respondió a mitad de camino.
 */
export function clockOffset(samples: readonly ClockSample[]): number | null {
  let best: ClockSample | null = null;
  for (const s of samples) if (s.receivedAt >= s.sentAt && (!best || s.receivedAt - s.sentAt < best.receivedAt - best.sentAt)) best = s;
  return best ? best.serverNow - (best.sentAt + best.receivedAt) / 2 : null;
}
