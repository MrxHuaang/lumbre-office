// El cine del sótano: una cola de videos de YouTube propia (separada de la del club) que se proyecta en
// la pantalla de la pared oeste. El servidor lleva el reloj (qué se ve y desde cuándo), así la función va
// al mismo segundo para todos; cualquiera dentro de la sala programa o salta, y desde la cabina del
// proyector se pausa y se sigue. Las reglas de la cola (largo, duración, cuándo se cree un "terminó") son
// las de los videos del club (`CLUB_VIDEO`).
import { z } from "zod";
import { CLUB_ERROR_TEXT, ClubQueueMessage, type ClubError } from "./club";

export const CINEMA = {
  /** Nivel y zona de la sala: la función solo se oye (y se controla) adentro. */
  area: "sotano",
  zone: "cine",
  /** Punto del mapa junto al proyector (la cabina): desde ahí se pausa y se sigue. */
  boothPoint: "cinema",
  /** Pausa mínima entre dos "pausar/seguir" de la misma persona (evita dobles clics). */
  controlCooldownMs: 800,
} as const;

/**
 * La cartelera: películas abiertas de la Blender Foundation (licencia libre, publicadas por ellos mismos
 * en YouTube), para programar una función con un clic. Cualquier otro link de YouTube también sirve.
 */
export const CINEMA_BILLBOARD = [
  { videoId: "YE7VzlLtp-4", title: "Big Buck Bunny", minutes: 10, blurb: "Un conejo gigante y tres roedores que se pasan de listos." },
  { videoId: "TLkA0RELQ1g", title: "Elephants Dream", minutes: 11, blurb: "Dos hombres perdidos en una máquina que no termina." },
  { videoId: "eRsGyueVLvQ", title: "Sintel", minutes: 15, blurb: "Una joven busca al dragón que crió de pequeño." },
  { videoId: "R6MlUcmOul8", title: "Tears of Steel", minutes: 12, blurb: "Ciencia ficción en Ámsterdam, con robots gigantes." },
  { videoId: "Y-rmzh0PI3c", title: "Cosmos Laundromat", minutes: 12, blurb: "Una oveja que quiere morir recibe una oferta rara." },
  { videoId: "WhWc3b3KhnY", title: "Spring", minutes: 8, blurb: "Una pastora y su perro frente a los espíritus del bosque." },
  { videoId: "_cMxraX_5RE", title: "Sprite Fright", minutes: 10, blurb: "Excursionistas contra los duendes del musgo. Terror cómico." },
  { videoId: "mN0zPOpADL4", title: "Agent 327", minutes: 4, blurb: "Un agente secreto holandés en una barbería sospechosa." },
  { videoId: "PVGeM40dABA", title: "Coffee Run", minutes: 3, blurb: "Una carrera desesperada por el primer café del día." },
  { videoId: "UXqq0ZvbOnk", title: "Charge", minutes: 4, blurb: "Una persecución en un mundo sin energía." },
] as const;

export type CinemaBillboardItem = (typeof CINEMA_BILLBOARD)[number];

/** Lo que el servidor sincroniza de la función (espejo de `CinemaState`). */
export interface CinemaShowState {
  /** Video que se proyecta ("" = ninguno). */
  video: string;
  startedAt: number;
  paused: boolean;
  /** En pausa: en qué punto del video quedó (ms). */
  pausedAt: number;
}

/** Punto del video (ms) a la hora del servidor `serverNow`; null si no hay función. */
export function showElapsed(s: CinemaShowState, serverNow: number): number | null {
  if (!s.video) return null;
  if (s.paused) return s.pausedAt;
  return Math.max(0, serverNow - s.startedAt);
}

/** ¿Hay función corriendo (y no en pausa)? Con función se bajan las luces de la sala. */
export const isShowing = (s: CinemaShowState) => Boolean(s.video) && !s.paused;

/**
 * Cliente → servidor (`MSG.cinemaQueue`): la cola del cine. Las mismas acciones que la del club
 * (agregar, volver a poner, mover, quitar, saltar y los avisos del reproductor) más pausar y seguir la
 * función, que se hace desde la cabina del proyector.
 */
export const CinemaMessage = z.discriminatedUnion("action", [
  ...ClubQueueMessage.options,
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("resume") }),
]);
export type CinemaMessage = z.infer<typeof CinemaMessage>;

export type CinemaError = ClubError | "booth";

/** Servidor → cliente (`MSG.cinemaResult`) cuando no se pudo. */
export interface CinemaResult {
  ok: false;
  error: CinemaError;
}

export const CINEMA_ERROR_TEXT: Record<CinemaError, string> = {
  ...CLUB_ERROR_TEXT,
  far: "Entra a la sala del cine para programar la función.",
  booth: "La función se pausa y se sigue desde la cabina del proyector.",
  queued: "Esa película ya está en la cartelera de hoy.",
  "queue-full": CLUB_ERROR_TEXT["queue-full"].replace("videos", "películas"),
};
