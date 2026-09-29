// Comunicación rápida: llamar a cualquiera sin teléfono (y sumar a más gente a la llamada), saludar con un
// toque en el hombro y el anuncio de un admin a toda la cabaña (texto y voz). Las llamadas reutilizan el
// teléfono (phone.ts: el mismo timbre, Contestar/Colgar y `MSG.phoneEvent`); lo nuevo va en `COM_MSG`.
// Seguir a alguien es solo del navegador (el movimiento ya lo valida el servidor).
// El servidor lo lleva en apps/server/src/rooms/llamadas.ts, saludos.ts y anuncio.ts.
import { z } from "zod";

export const COM_MSG = {
  /** Cliente → servidor: llamar a una persona conectada desde cualquier parte (`ComPersonMessage`). */
  call: "com:call",
  /** Cliente → servidor: sumar a alguien a la llamada en la que estoy hablando (`ComPersonMessage`). */
  add: "com:add",
  /** Cliente → servidor: saludar (toque en el hombro) a alguien (`ComPersonMessage`). */
  wave: "com:wave",
  /** Servidor → cliente: alguien te saluda (`WaveEvent`). */
  waved: "com:waved",
  /** Servidor → cliente: cómo le fue a mi saludo (`WaveResult`). */
  waveResult: "com:wave-result",
  /** Cliente → servidor (permiso `anunciar`): aviso de texto a toda la cabaña (`AnnounceMessage`). */
  announce: "com:announce",
  /** Servidor → todos: el aviso grande en pantalla (`Announcement`). */
  announcement: "com:announcement",
  /** Cliente → servidor (admins): empezar o terminar de hablarle por voz a toda la cabaña. */
  broadcastStart: "com:broadcast-start",
  broadcastStop: "com:broadcast-stop",
  /** Servidor → todos: empezó o terminó el anuncio por voz (`BroadcastEvent`). */
  broadcastEvent: "com:broadcast",
  /** Servidor → quien anuncia: por qué no salió el anuncio (`AnnounceResult`). */
  announceResult: "com:announce-result",
} as const;

export const COMUNICACION = {
  /** Pausa entre llamadas (sin teléfono o sumando a alguien) de la misma persona. */
  callCooldownMs: 4_000,
  /** Cupo de una llamada grupal, contando a quien llama y a quienes les está sonando. */
  maxCallMembers: 6,
  /** Pausa entre saludos a la misma persona. */
  waveCooldownMs: 30_000,
  /** Cuánto se ve el saludo en pantalla si no se contesta. */
  waveShowMs: 20_000,
  /** Largo máximo del aviso de texto. */
  announceMaxChars: 280,
  /** Pausa entre avisos de texto de la misma persona, y entre un anuncio por voz y el siguiente. */
  announceCooldownMs: 10_000,
  /** Pausa global: entre un anuncio de cualquiera y el siguiente (texto, o que empiece una voz). */
  announceGapMs: 20_000,
  /** Cuánto se ve el aviso grande (se puede cerrar antes). */
  announceShowMs: 15_000,
  /** Tope del anuncio por voz: pasado este tiempo se corta solo. */
  broadcastMaxMs: 10 * 60_000,
} as const;

/** "desde …" de una llamada sin teléfono (completa "Ana te llama desde su celular"). */
export const CELL_ORIGIN = "su celular";

/** A quién va una llamada, un saludo o una suma a la llamada: el userId de la persona. */
export const ComPersonMessage = z.object({ userId: z.string().min(1).max(64) });
export type ComPersonMessage = z.infer<typeof ComPersonMessage>;

export const AnnounceMessage = z.object({ text: z.string().max(2000) });
export type AnnounceMessage = z.infer<typeof AnnounceMessage>;

/** El texto del aviso como se publica: sin espacios de más y con el tope de largo (null = vacío). */
export function cleanAnnouncement(text: string): string | null {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length > COMUNICACION.announceMaxChars ? `${clean.slice(0, COMUNICACION.announceMaxChars - 1)}…` : clean;
}

/** Alguien te saluda: "Ir" camina hasta `fromSessionId`, "Llamar" llama a `fromUserId`. */
export interface WaveEvent {
  waveId: string;
  fromUserId: string;
  fromSessionId: string;
  fromName: string;
  /** Hora del servidor. */
  at: number;
}

export type WaveOutcome = "sent" | "offline" | "dnd" | "too-soon" | "self";
export interface WaveResult {
  toUserId: string;
  toName: string;
  outcome: WaveOutcome;
}

export const WAVE_RESULT_TEXT: Record<WaveOutcome, (name: string) => string> = {
  sent: (n) => `Le diste un toquecito en el hombro a ${n}.`,
  offline: (n) => `${n || "Esa persona"} ya no está conectada.`,
  dnd: (n) => `${n || "Esa persona"} está en "No molestar": mejor más tarde.`,
  "too-soon": (n) => `Ya saludaste a ${n || "esa persona"} hace un ratico.`,
  self: () => "Te saludaste a ti mismo. Hola, ¿cómo vas?",
};

/** El aviso de texto de un admin (lo reciben todos los conectados, en todos los niveles). */
export interface Announcement {
  id: string;
  fromUserId: string;
  fromName: string;
  text: string;
  /** Hora del servidor. */
  at: number;
}

/** El anuncio por voz: quién habla y hasta cuándo, o que terminó (y por qué). */
export type BroadcastEvent =
  /** `resumed`: el anuncio ya estaba sonando (llega al entrar o al recargar la página). */
  | { kind: "start"; userId: string; name: string; endsAt: number; resumed?: boolean }
  | { kind: "end"; userId: string; name: string; reason: BroadcastEndReason };

/** Terminó a mano, se venció el tope o quien anunciaba se fue. */
export type BroadcastEndReason = "stop" | "timeout" | "left";

export type AnnounceError = "admin" | "too-soon" | "recent" | "empty" | "busy";
export interface AnnounceResult {
  error: AnnounceError;
  /** En "busy": quién está anunciando. */
  name?: string;
}

export const ANNOUNCE_ERROR_TEXT: Record<AnnounceError, (name: string) => string> = {
  admin: () => "Necesitas el permiso para anunciar (se lo pides a un admin).",
  "too-soon": () => "Espera unos segundos antes de mandar otro anuncio.",
  recent: () => "Hace un momento hubo otro anuncio: espera unos segundos.",
  empty: () => "Escribe algo para el aviso.",
  busy: (n) => `${n || "Otra persona"} ya le está hablando a toda la cabaña.`,
};

export function broadcastEndText(e: { name: string; reason: BroadcastEndReason }, mine: boolean): string {
  if (mine) return e.reason === "timeout" ? "Se acabó el tiempo del anuncio: ya no te oye toda la cabaña." : "Terminaste el anuncio.";
  return `${e.name || "El admin"} terminó de hablarle a toda la cabaña.`;
}

/** "3:12" que le quedan al anuncio por voz. */
export function broadcastLeft(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Hora local del aviso ("3:05 p. m."), en la hora de Bogotá como el resto de la cabaña. */
export function announcementTime(at: number): string {
  return new Date(at).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
}

/** ¿Se puede sumar a alguien más a una llamada de `size` personas (contando a quienes les suena)? */
export const callHasRoom = (size: number) => size < COMUNICACION.maxCallMembers;

/**
 * ¿A quién sigo cuando sigo a alguien? Hay que caminar si está en otro nivel o a más de `nearPx`; si ya
 * estoy al lado, me quedo quieto (sin empujar ni rodear).
 */
export function followNeedsWalk(me: { area: string; x: number; y: number }, target: { area: string; x: number; y: number }, nearPx = 2.5 * 32): boolean {
  if (me.area !== target.area) return true;
  return Math.hypot(me.x - target.x, me.y - target.y) > nearPx;
}
