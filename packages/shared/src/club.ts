// El club del sótano: la música de la cabina de DJ, el baile en la pista y el tubo. El servidor guarda
// qué suena (y desde cuándo, con su hora) y quién baila; cada cliente genera la música con WebAudio y
// dibuja los pasos en el mismo compás, porque todos cuentan el tiempo desde el mismo `startedAt`.
// Además de las pistas generadas suena una cola de videos de YouTube (se ven en la pantalla sobre la
// cabina): cualquiera en el club agrega, reordena, quita o salta, y el servidor lleva el reloj.
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
  /** Video de YouTube que suena ("" = ninguno); nunca a la vez que una pista. */
  video?: string;
  startedAt: number;
  paused: boolean;
  pausedAt: number;
}

/** ¿Hay algo puesto (pista o video), sonando o en pausa? */
const hasMusic = (s: ClubMusicState) => Boolean(s.video || (s.track && clubTrack(s.track)));

/**
 * Tiempo transcurrido de la pista o del video (ms, sin dar la vuelta al loop) a la hora del servidor
 * `serverNow`, o null si no suena nada. En pausa se queda donde se pausó.
 */
export function trackElapsed(s: ClubMusicState, serverNow: number): number | null {
  if (!hasMusic(s)) return null;
  if (s.paused) return s.pausedAt;
  return Math.max(0, serverNow - s.startedAt);
}

/** ¿Está sonando algo (y no en pausa)? */
export const isPlaying = (s: ClubMusicState) => hasMusic(s) && !s.paused;

/** Tiempo (en negras, con decimales) a la hora `serverNow`; null si no suena. Un video va a `CLUB_VIDEO.bpm`. */
export function beatAt(s: ClubMusicState, serverNow: number): number | null {
  const bpm = s.video ? CLUB_VIDEO.bpm : clubTrack(s.track)?.bpm;
  const elapsed = trackElapsed(s, serverNow);
  if (!bpm || elapsed === null) return null;
  return (elapsed * bpm) / 60_000;
}

// ---------- Videos de YouTube ----------

export const CLUB_VIDEO = {
  /** Largo máximo de la cola. */
  maxQueue: 50,
  /** Lo que se guarda de "lo que sonó" (lo último primero). */
  historySize: 20,
  /** Largo máximo del título que se guarda. */
  maxTitle: 120,
  /** Duración que se acepta de un reproductor (menos o más se toma como el borde). */
  minDurationMs: 5_000,
  maxDurationMs: 3 * 60 * 60_000,
  /** Margen después del final antes de que el servidor pase solo al siguiente. */
  endGraceMs: 2_500,
  /** Sin duración conocida (nadie en el club la informó) se pasa al siguiente a esta hora. */
  unknownMaxMs: 20 * 60_000,
  /** Un "terminó" que llega antes de esto (sin duración conocida) no se cree. */
  minPlayMs: 10_000,
  /** Con la duración conocida, un "terminó" que llega más de esto antes del final no se cree. */
  endSlackMs: 4_000,
  /** Tempo con el que laten las luces y se baila con un video (no se sabe el suyo). */
  bpm: 120,
  /** Pausa mínima entre dos reacciones de la misma persona. */
  reactCooldownMs: 700,
} as const;

/** Ids de YouTube: 11 caracteres de letras, números, "-" y "_". */
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Id del video de un link de YouTube (watch, youtu.be, shorts, embed, live, music) o de un id suelto;
 * null si no es de YouTube.
 */
export function parseYoutubeId(input: string): string | null {
  const text = input.trim();
  if (YT_ID.test(text)) return text;
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.split("/")[1] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [, first, second] = url.pathname.split("/");
    if (first === "watch") id = url.searchParams.get("v");
    else if (first === "shorts" || first === "embed" || first === "live" || first === "v") id = second ?? null;
  }
  return id && YT_ID.test(id) ? id : null;
}

/** Un video en la cola (o el que suena, o uno que ya sonó). */
export interface ClubVideoView {
  /** Id de la entrada (el mismo video puede volver a entrar con otro id). */
  id: string;
  videoId: string;
  title: string;
  /** Quién lo puso. */
  by: string;
  /** User.id de quien lo puso (en el karaoke, quien canta; "" si no se sabe). */
  byId?: string;
  /** Duración (ms) si algún reproductor ya la dijo; 0 si no se sabe. */
  durationMs: number;
}

/**
 * Reacciones que se pueden mandar mientras suena algo (flotan sobre quien reacciona). Cada una tiene su
 * dibujo pixel-art (art/reactions.ts de @hyvento/map); el nombre es para leerlas en voz alta.
 */
export const CLUB_REACTIONS = ["fuego", "corazon", "risa", "aplauso", "fiesta", "baile"] as const;
export type ClubReaction = (typeof CLUB_REACTIONS)[number];
export const CLUB_REACTION_NAMES: Record<ClubReaction, string> = {
  fuego: "Fuego",
  corazon: "Corazón",
  risa: "Risa",
  aplauso: "Aplauso",
  fiesta: "Fiesta",
  baile: "A bailar",
};

const entryId = z.string().min(1).max(40);

/** Cliente → servidor (`MSG.clubQueue`): la cola de videos. */
export const ClubQueueMessage = z.discriminatedUnion("action", [
  /** Agregar un link (o un id) al final; si no suena nada (o suena una pista generada), arranca ya. */
  z.object({ action: z.literal("add"), url: z.string().min(1).max(400) }),
  /** Volver a poner uno de "lo que sonó" (va al final de la cola). */
  z.object({ action: z.literal("replay"), id: entryId }),
  /** Mover una entrada de la cola a la posición `to` (0 = la siguiente en sonar). */
  z.object({ action: z.literal("move"), id: entryId, to: z.number().int().min(0).max(1000) }),
  z.object({ action: z.literal("remove"), id: entryId }),
  /** Saltar el que suena (con su id, para que dos saltos a la vez no se lleven dos videos). */
  z.object({ action: z.literal("skip"), id: entryId }),
  /** El reproductor terminó el video `id` (lo avisan los clientes; vale el primero). */
  z.object({ action: z.literal("ended"), id: entryId }),
  /** Duración que dio el reproductor del video `id`. */
  z.object({ action: z.literal("duration"), id: entryId, ms: z.number().int().min(0).max(24 * 3600_000) }),
]);
export type ClubQueueMessage = z.infer<typeof ClubQueueMessage>;

/** Cliente → servidor (`MSG.clubReact`): una reacción a lo que suena. */
export const ClubReactMessage = z.object({ emoji: z.enum(CLUB_REACTIONS) });
export type ClubReactMessage = z.infer<typeof ClubReactMessage>;

/** Servidor → clientes del sótano (`MSG.clubReaction`): alguien reaccionó. */
export interface ClubReactionEvent {
  sessionId: string;
  name: string;
  emoji: ClubReaction;
}

/** Lo que el servidor averigua de un video al agregarlo (oEmbed de YouTube, sin clave). */
export type YoutubeInfo = { ok: true; title: string } | { ok: false; error: "not-found" | "not-embeddable" };

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

export type ClubError =
  | "far"
  | "busy"
  | "taken"
  | "silence"
  | "seated"
  | "invalid"
  | "not-youtube"
  | "not-found"
  | "not-embeddable"
  | "queue-full"
  | "queued";

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
  "not-youtube": "Ese link no es de un video de YouTube.",
  "not-found": "No encontré ese video (¿es privado o lo borraron?).",
  "not-embeddable": "Ese video no deja ponerse fuera de YouTube. Prueba con otro.",
  "queue-full": `La cola está llena (${CLUB_VIDEO.maxQueue} videos).`,
  queued: "Ese video ya está en la cola.",
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
