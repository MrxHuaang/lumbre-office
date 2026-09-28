// Teléfono de escritorio: llamadas entre oficinas. Se llama desde un teléfono (el de tu escritorio o el de
// la recepción) a la oficina de alguien, pero la llamada es a la persona dueña: le suena esté donde esté.
// Mientras hablan, los dos se oyen sin importar la distancia ni el nivel (ver `hearing` en proximity.ts).
// El servidor lleva las llamadas (apps/server/src/rooms/phones.ts) y el estado queda en cada `Player`.
import { z } from "zod";

export const PHONE = {
  /** Cuánto suena antes de darse por no contestada. */
  ringMs: 30_000,
} as const;

/** Cliente → servidor (`MSG.phoneCall`): llamar a la oficina `zoneId` (a quien es su dueño). */
export const PhoneCallMessage = z.object({ zoneId: z.string().min(1).max(64) });
export type PhoneCallMessage = z.infer<typeof PhoneCallMessage>;

/** Cliente → servidor (`MSG.phoneAnswer`): contestar o colgar una llamada que me suena. */
export const PhoneAnswerMessage = z.object({ callId: z.string().min(1).max(64), accept: z.boolean() });
export type PhoneAnswerMessage = z.infer<typeof PhoneAnswerMessage>;

/** Cómo está cada persona con el teléfono (`Player.call`): "" nada. */
export type CallPhase = "" | "calling" | "ringing" | "talking";

/** Por qué no se pudo llamar. */
export type PhoneError =
  /** Lejos de un teléfono. */
  | "far"
  /** Esa oficina no existe o no tiene dueño. */
  | "invalid"
  /** Es tu propia oficina. */
  | "self"
  /** La persona no está conectada. */
  | "offline"
  /** La persona ya está en una llamada (o le está sonando otra). */
  | "busy"
  /** La persona está en "No molestar". */
  | "dnd"
  /** Tú ya estás en una llamada. */
  | "in-call";

/** Cómo terminó una llamada: colgaron, no contestó (rechazo o tiempo) o alguien se desconectó. */
export type CallEndReason = "hangup" | "declined" | "timeout" | "left";

/** Servidor → cliente (`MSG.phoneEvent`). */
export type PhoneEvent =
  /** A quien llaman: le suena. `from` completa "te llama desde …" ("su oficina", "la recepción"). */
  | { kind: "ringing"; callId: string; withUserId: string; withName: string; from: string; endsAt: number }
  /** A quien llama: está sonando del otro lado. */
  | { kind: "calling"; callId: string; withUserId: string; withName: string; endsAt: number }
  /** A los dos: contestaron (`since` = hora del servidor, para el reloj de la llamada). */
  | { kind: "connected"; callId: string; withUserId: string; withName: string; since: number }
  /** A los dos: terminó (`byMe` = la colgué yo; `caller` = yo era quien llamaba). */
  | { kind: "ended"; callId: string; withName: string; reason: CallEndReason; byMe: boolean; caller: boolean }
  /** A quien quiso llamar: por qué no se pudo. */
  | { kind: "failed"; error: PhoneError; withName: string };

export const PHONE_ERROR_TEXT: Record<PhoneError, (name: string) => string> = {
  far: () => "Acércate a un teléfono para llamar.",
  invalid: () => "Esa oficina no tiene a quién llamar.",
  self: () => "Esa es tu propia oficina.",
  offline: (n) => `${n || "Esa persona"} no está conectada ahora.`,
  busy: (n) => `${n || "Esa persona"} está en otra llamada. Suena ocupado.`,
  dnd: (n) => `${n || "Esa persona"} está en "No molestar".`,
  "in-call": () => "Ya estás en una llamada.",
};

/** Aviso al terminar, para quien no colgó (a quien colgó le basta con que se cierre el chip). */
export function callEndText(e: { reason: CallEndReason; withName: string; byMe: boolean; caller: boolean }): string | null {
  const who = e.withName || "La otra persona";
  // Sin contestar: quien llamó oye "no contestó"; a quien le sonaba le queda la llamada perdida.
  if (e.reason === "timeout") return e.caller ? `${who} no contestó.` : `Llamada perdida de ${who}.`;
  if (e.reason === "declined") return e.byMe ? null : e.caller ? `${who} no contestó.` : `${who} colgó antes de que contestaras.`;
  if (e.reason === "left") return `Se cortó la llamada con ${who}.`;
  return e.byMe ? null : `${who} colgó.`;
}

/** Cómo está el dueño de una oficina en el directorio del teléfono. */
export type DirectoryStatus = "office" | "elsewhere" | "away" | "dnd" | "busy" | "offline";

export const DIRECTORY_TEXT: Record<DirectoryStatus, string> = {
  office: "En su oficina",
  elsewhere: "En otra parte",
  away: "Ausente",
  dnd: "No molestar",
  busy: "En una llamada",
  offline: "Desconectado",
};

/** ¿Se le puede llamar? (misma regla que el servidor, para apagar el botón "Llamar"). */
export const canCallStatus = (s: DirectoryStatus) => s !== "offline" && s !== "dnd" && s !== "busy";

/**
 * Estado de la persona dueña de una oficina: sin conectar, en una llamada, en "No molestar", ausente, o
 * disponible (en su oficina o en otra parte).
 */
export function directoryStatus(owner: { status: string; zoneId: string; call: string } | undefined, officeZoneId: string): DirectoryStatus {
  if (!owner) return "offline";
  if (owner.call) return "busy";
  if (owner.status === "dnd") return "dnd";
  if (owner.status === "away") return "away";
  return owner.zoneId === officeZoneId ? "office" : "elsewhere";
}

/** Reloj de la llamada: "02:13" (o "1:02:13" pasada la hora). */
export function callClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60) % 60).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return s >= 3600 ? `${Math.floor(s / 3600)}:${mm}:${ss}` : `${mm}:${ss}`;
}
