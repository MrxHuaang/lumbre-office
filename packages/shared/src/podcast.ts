// El estudio de grabación (podcast): un nivel aparte (`podcast`) al que se entra por la puerta del final
// del pasillo del piso 3. Todo el estudio es una sala aislada. "E · Grabar" en la consola de la mesa (o el
// botón del HUD) pide permiso a todos los de adentro; solo si todos aceptan se graba, y el archivo lo arma
// el navegador de quien pidió grabar (MediaRecorder sobre las voces de LiveKit) y se descarga ahí mismo.
// Al servidor no llega audio: lleva el estado ("pidiendo permiso", "grabando"), los permisos de cada uno y
// el cartel "EN EL AIRE" de la puerta, que ven todos. Mientras se pide permiso o se graba, la puerta no deja
// entrar; si alguien dice que no, retira su permiso o entra alguien nuevo, no se graba (o se deja de grabar).
import { z } from "zod";

export const PODCAST = {
  /** Nivel y zona de adentro (una sala aislada que ocupa todo el estudio). */
  area: "podcast",
  zone: "podcast",
  /** Portal del piso 3 que entra al estudio (la puerta con el cartel). */
  portal: "piso-3-estudio",
  /** Punto de la consola de la mesa: "E · Grabar". */
  point: "podcast",
  /** Cuántos caben adentro: uno por silla de la mesa grande. */
  capacity: 8,
  /** Cuánto se espera a que todos respondan antes de desistir. */
  askTimeoutMs: 45_000,
  /** Una grabación se corta sola a la hora (el archivo ya es grande). */
  maxRecordMs: 60 * 60_000,
  /** Pausa entre dos pedidos de grabar de la misma persona (para no llenar de diálogos a los demás). */
  askCooldownMs: 5000,
} as const;

/** "idle" (libre), "asking" (esperando el permiso de todos) o "recording" (EN EL AIRE). */
export type PodcastPhase = "idle" | "asking" | "recording";

/** Por qué no se puede entrar al estudio: está lleno o están pidiendo permiso o grabando. */
export type PodcastBlock = "full" | "onAir";

/**
 * ¿Puede entrar alguien? `inside` = cuántos hay adentro sin contar a quien quiere entrar. Mientras se pide
 * permiso o se graba no entra nadie (rompería el acuerdo); si no, hasta llenar las sillas.
 */
export function podcastBlock(inside: number, phase: PodcastPhase): PodcastBlock | null {
  if (phase !== "idle") return "onAir";
  if (inside >= PODCAST.capacity) return "full";
  return null;
}

/** El cartel de afuera: prendido mientras se graba y titilando mientras se pide permiso. */
export function podcastSignLit(phase: PodcastPhase, frame: number): boolean {
  return phase === "recording" || (phase === "asking" && frame % 2 === 0);
}

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
  | "started"
  | PodcastBlock;

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
      return "Para eso tienes que estar adentro del estudio.";
    case "busy":
      return "Ya se está pidiendo permiso o grabando.";
    case "wait":
      return "Espera un momento antes de volver a pedir permiso.";
    case "declined":
      return `${who} prefiere que no se grabe: no se grabó nada.`;
    case "timeout":
      return "No respondieron todos a tiempo: no se grabó nada.";
    case "joined":
      return `Entró ${who} al estudio: se detuvo la grabación.`;
    case "stopped":
      return `${who} detuvo la grabación.`;
    case "hostLeft":
      return `${who} salió del estudio: se detuvo la grabación.`;
    case "tooLong":
      return "La grabación llegó a una hora y se detuvo sola.";
    case "started":
      return "Todos aceptaron: ¡EN EL AIRE!";
    case "full":
      return `El estudio está lleno: hay ${PODCAST.capacity} sillas. Espera a que salga alguien.`;
    case "onAir":
      return "EN EL AIRE: están grabando (o pidiendo permiso para grabar). Entra cuando se apague el cartel.";
  }
}

/** Nombre del archivo que se descarga (fecha y hora de cuando empezó, en la hora del navegador). */
export function podcastFileName(startedAt: number, ext: string): string {
  const d = new Date(startedAt);
  const p = (n: number) => String(n).padStart(2, "0");
  return `podcast-hyvento-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.${ext}`;
}
