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
  | "in-call"
  /** Para sumar a alguien hay que estar hablando en una llamada (ver comunicacion.ts). */
  | "not-in-call"
  /** La llamada ya tiene el cupo lleno (`COMUNICACION.maxCallMembers`). */
  | "full"
  /** Llamaste hace un momento: una pausa corta para que no se llame en ráfaga. */
  | "too-soon";

/** Alguien de la llamada (para el chip y el aviso de "te suman a la llamada"): hablando o sonándole. */
export interface CallMember {
  userId: string;
  name: string;
  phase: "calling" | "ringing" | "talking";
}

/** Qué cambió en una llamada grupal, para los que siguen en ella. */
export type CallMemberChange = "joined" | "left" | "declined" | "timeout" | "invited";

/** Cómo terminó una llamada: colgaron, no contestó (rechazo o tiempo) o alguien se desconectó. */
export type CallEndReason = "hangup" | "declined" | "timeout" | "left";

/** Servidor → cliente (`MSG.phoneEvent`). */
export type PhoneEvent =
  /**
   * A quien llaman: le suena. `from` completa "te llama desde …" ("su oficina", "la recepción"). Si lo
   * suman a una llamada en curso, `members` trae a los que ya están hablando.
   */
  | { kind: "ringing"; callId: string; withUserId: string; withName: string; from: string; endsAt: number; members?: CallMember[] }
  /** A quien llama: está sonando del otro lado. */
  | { kind: "calling"; callId: string; withUserId: string; withName: string; endsAt: number; members?: CallMember[] }
  /**
   * A todos los de la llamada: contestaron (`since` = hora del servidor, para el reloj de la llamada).
   * Se repite cada vez que alguien entra, sale o le empieza a sonar a alguien nuevo: `members` son los
   * demás (sin mí).
   */
  | { kind: "connected"; callId: string; withUserId: string; withName: string; since: number; members?: CallMember[] }
  /** A los que siguen en una llamada grupal: alguien entró, salió, no contestó o le está sonando. */
  | { kind: "member"; callId: string; name: string; change: CallMemberChange }
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
  "not-in-call": () => "Para sumar a alguien tienes que estar hablando en una llamada.",
  full: () => "La llamada ya está llena.",
  "too-soon": () => "Espera un momentico antes de volver a llamar.",
};

/** Aviso de una llamada grupal para los que siguen en ella (a quien entra o sale ya le llega lo suyo). */
export const CALL_MEMBER_TEXT: Record<CallMemberChange, (name: string) => string> = {
  joined: (n) => `${n} se sumó a la llamada.`,
  left: (n) => `${n} salió de la llamada.`,
  declined: (n) => `${n} no quiso sumarse a la llamada.`,
  timeout: (n) => `${n} no contestó.`,
  invited: (n) => `Le está sonando a ${n}…`,
};

/** "Ana", "Ana y Bob", "Ana, Bob y Carla". */
export function namesList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
}

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
