// La cabina de grabación (podcast) del jardín: una sala aislada para tres. "E · Grabar" en la mesa de los
// micrófonos pide permiso a todos los de adentro; solo si todos aceptan se graba, y el archivo lo arma el
// navegador de quien pidió grabar (MediaRecorder sobre las voces de LiveKit) y se descarga ahí mismo. Al
// servidor no llega audio: lleva el estado ("pidiendo permiso", "grabando"), los permisos de cada uno y el
// cartel "EN EL AIRE" que ven todos. Mientras se pide permiso o se graba, la puerta no deja entrar; si
// alguien dice que no, retira su permiso o entra alguien nuevo, no se graba (o se deja de grabar).
import { z } from "zod";

export const PODCAST = {
  area: "jardin",
  zone: "podcast",
  /** Punto de la mesa de los micrófonos: "E · Grabar". */
  point: "podcast",
  /** Cuántos caben adentro. */
  capacity: 3,
  /** Cuánto se espera a que todos respondan antes de desistir. */
  askTimeoutMs: 45_000,
  /** Una grabación se corta sola a la hora (el archivo ya es grande). */
  maxRecordMs: 60 * 60_000,
  /** Pausa entre dos pedidos de grabar de la misma persona (para no llenar de diálogos a los demás). */
  askCooldownMs: 5000,
} as const;

/** "idle" (libre), "asking" (esperando el permiso de todos) o "recording" (EN EL AIRE). */
export type PodcastPhase = "idle" | "asking" | "recording";

export const PODCAST_MSG = {
  /** Cliente → servidor, junto a la mesa: pedir permiso para grabar. */
  start: "podcast:start",
  /** Cliente → servidor, adentro: aceptar o no que se grabe su voz (`PodcastConsentMessage`). */
  consent: "podcast:consent",
  /** Cliente → servidor, adentro: dejar de grabar (cualquiera de adentro puede; es retirar el permiso). */
  stop: "podcast:stop",
  /** Servidor → los de adentro (y quien lo intentó): qué pasó (`PodcastNotice`). */
  notice: "podcast:notice",
} as const;

export const PodcastConsentMessage = z.object({ accept: z.boolean() });
export type PodcastConsentMessage = z.infer<typeof PodcastConsentMessage>;

export type PodcastNoticeCode =
  | "far"
  | "outside"
  | "busy"
  | "wait"
  | "declined"
  | "timeout"
  | "joined"
  | "stopped"
  | "hostLeft"
  | "tooLong"
  | "started";

export interface PodcastNotice {
  code: PodcastNoticeCode;
  /** Quién lo hizo (dijo que no, paró, entró), si aplica. */
  name?: string;
}

export function podcastNoticeText(n: PodcastNotice): string {
  const who = n.name ?? "Alguien";
  switch (n.code) {
    case "far":
      return "Acércate a la mesa de los micrófonos para grabar.";
    case "outside":
      return "Para eso tienes que estar adentro de la cabina.";
    case "busy":
      return "Ya se está pidiendo permiso o grabando.";
    case "wait":
      return "Espera un momento antes de volver a pedir permiso.";
    case "declined":
      return `${who} prefiere que no se grabe: no se grabó nada.`;
    case "timeout":
      return "No respondieron todos a tiempo: no se grabó nada.";
    case "joined":
      return `Entró ${who} a la cabina: se detuvo la grabación.`;
    case "stopped":
      return `${who} detuvo la grabación.`;
    case "hostLeft":
      return `${who} salió de la cabina: se detuvo la grabación.`;
    case "tooLong":
      return "La grabación llegó a una hora y se detuvo sola.";
    case "started":
      return "Todos aceptaron: ¡EN EL AIRE!";
  }
}

/** Nombre del archivo que se descarga (fecha y hora de cuando empezó, en la hora del navegador). */
export function podcastFileName(startedAt: number, ext: string): string {
  const d = new Date(startedAt);
  const p = (n: number) => String(n).padStart(2, "0");
  return `podcast-hyvento-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.${ext}`;
}
