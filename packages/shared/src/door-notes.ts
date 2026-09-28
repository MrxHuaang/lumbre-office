// Notas en la puerta: frente a la oficina de alguien se le deja una nota adhesiva (hasta 280 letras) para
// cuando vuelva. La deja el servidor de juego (valida que estés frente a la puerta y el tope del día); la
// lee y la borra solo el dueño, por la web (/api/door-notes). En la puerta se ven 1 a 3 post-its según
// cuántas tenga sin leer.
import { z } from "zod";
import { dayStart } from "./points";

export const DOOR_NOTES = {
  /** Largo máximo del texto. */
  maxLength: 280,
  /** Notas que una persona puede dejar por día (de Bogotá), sumando todas las puertas. */
  perDay: 10,
  /** Distancia máxima (px de mundo) de los pies al punto frente a la puerta (un poco más que el aviso del cliente). */
  reachPx: 64,
  /** Post-its que se dibujan como mucho en la puerta. */
  maxPostIts: 3,
  /** Notas que se guardan por dueño: al pasarse se borran las más viejas ya leídas. */
  keep: 60,
} as const;

/** Cliente → servidor (`MSG.doorNote`): dejar una nota en la puerta de una oficina. */
export const DoorNoteMessage = z.object({
  zoneId: z.string().min(1).max(64),
  text: z.string().max(DOOR_NOTES.maxLength * 2),
});
export type DoorNoteMessage = z.infer<typeof DoorNoteMessage>;

/**
 * La nota como se guarda: sin espacios de sobra en cada renglón, a lo sumo dos renglones vacíos seguidos
 * y cortada al largo máximo. "" = no hay nada que dejar.
 */
export function cleanDoorNote(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, DOOR_NOTES.maxLength)
    .trim();
}

/** Por qué no se dejó: sin texto, lejos de la puerta, oficina sin dueño o tuya, tope del día o un error. */
export type DoorNoteError = "empty" | "far" | "no-owner" | "own" | "limit" | "busy" | "failed";

/** Servidor → quien dejó la nota (`MSG.doorNoteResult`). `left` = cuántas le quedan hoy. */
export type DoorNoteResult =
  | { ok: true; zoneId: string; ownerName: string; left: number }
  | { ok: false; zoneId: string; error: DoorNoteError };

export const DOOR_NOTE_ERROR_TEXT: Record<DoorNoteError, string> = {
  empty: "Escribe algo antes de pegar la nota.",
  far: "Acércate a la puerta para dejar la nota.",
  "no-owner": "Esa oficina no tiene dueño todavía.",
  own: "Es tu oficina: tus notas las lees aquí mismo.",
  limit: `Ya dejaste ${DOOR_NOTES.perDay} notas hoy. Mañana puedes dejar más.`,
  busy: "Espera un momento: la nota anterior se está pegando.",
  failed: "No se pudo pegar la nota. Intenta de nuevo.",
};

/** Cuántas notas le quedan hoy a quien ya dejó `sentToday`. */
export const doorNotesLeft = (sentToday: number) => Math.max(0, DOOR_NOTES.perDay - sentToday);

/** Desde cuándo se cuentan las notas del día (medianoche de Bogotá). */
export const doorNotesDayStart = (now: number) => dayStart(now);

/** Post-its que se ven en la puerta con `unread` notas sin leer (0 a 3). */
export const doorPostIts = (unread: number) => Math.max(0, Math.min(DOOR_NOTES.maxPostIts, Math.floor(unread)));

/** Una nota como la ve su dueño (GET /api/door-notes). */
export interface DoorNoteDTO {
  id: string;
  fromName: string;
  text: string;
  createdAt: string;
  read: boolean;
}
