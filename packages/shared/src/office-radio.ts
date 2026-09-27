// La radio de cada oficina: el dueño pone un video de YouTube (música, un lofi en vivo) y suena en bucle
// solo para quienes están dentro de esa oficina, todos en el mismo segundo (la hora la lleva el servidor).
import { z } from "zod";

/** Cliente → servidor (`MSG.officeRadio`): lo que hace el dueño con la radio de su oficina. */
export const OfficeRadioMessage = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set"), url: z.string().min(1).max(400) }),
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("stop") }),
  /** Duración que dio el reproductor (la informa cualquiera que esté adentro; vale la primera). */
  z.object({ action: z.literal("duration"), videoId: z.string().min(1).max(20), ms: z.number().int().min(0).max(24 * 3600_000) }),
]);
export type OfficeRadioMessage = z.infer<typeof OfficeRadioMessage>;

export type OfficeRadioError = "not-owner" | "not-youtube" | "not-found" | "not-embeddable";

/** Servidor → cliente (`MSG.officeRadioResult`) cuando no se pudo. */
export interface OfficeRadioResult {
  ok: false;
  error: OfficeRadioError;
}

export const OFFICE_RADIO_ERROR_TEXT: Record<OfficeRadioError, string> = {
  "not-owner": "La radio la maneja el dueño de la oficina.",
  "not-youtube": "Ese link no es de un video de YouTube.",
  "not-found": "No encontré ese video (¿es privado o lo borraron?).",
  "not-embeddable": "Ese video no deja ponerse fuera de YouTube. Prueba con otro.",
};

/** Lo que el servidor sincroniza de la radio de una oficina (espejo de sus campos en `OfficeInfo`). */
export interface OfficeRadioState {
  videoId: string;
  title: string;
  startedAt: number;
  paused: boolean;
  pausedAt: number;
  /** 0 = no se sabe (un video en vivo no tiene). */
  durationMs: number;
}

/**
 * En qué punto del video va la radio (ms) a la hora del servidor: da la vuelta al terminar (suena en
 * bucle) y en pausa se queda donde quedó.
 */
export function radioElapsed(r: OfficeRadioState, serverNow: number): number {
  const t = r.paused ? r.pausedAt : Math.max(0, serverNow - r.startedAt);
  return r.durationMs > 0 ? t % r.durationMs : t;
}
