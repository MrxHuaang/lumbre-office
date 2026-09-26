import { z } from "zod";

export const ROOM_NAME = "office";

/** Velocidad de caminata de las personas, en px/s. */
export const PLAYER_SPEED = 150;
/** Radio de proximidad para chat (y luego audio/video), en px. */
export const PROXIMITY_RADIUS = 5 * 32;
/** Frecuencia máxima con la que el cliente envía su posición. */
export const MOVE_SEND_HZ = 15;

export const HUMAN_AVATARS = ["ada", "bruno", "carla", "dario", "eva", "fede"] as const;
export type HumanAvatar = (typeof HUMAN_AVATARS)[number];

export const DIRECTIONS = ["down", "left", "right", "up"] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const PRESENCE_STATUSES = ["available", "busy", "dnd", "away"] as const;
export type PresenceStatus = (typeof PRESENCE_STATUSES)[number];

// ---------- Cliente → servidor ----------

/** Se entra a la sala con un token firmado por la web (ver game-token.ts). */
export const JoinOptions = z.object({ token: z.string().min(1) });
export type JoinOptions = z.infer<typeof JoinOptions>;

/** Perfil editable por el usuario (onboarding / ajustes). */
export const ProfileUpdate = z.object({
  name: z.string().trim().min(1).max(24),
  avatar: z.enum(HUMAN_AVATARS),
});
export type ProfileUpdate = z.infer<typeof ProfileUpdate>;

/** Códigos de cierre propios (4000–4999). */
export const CLOSE_CODE = {
  /** Otra pestaña/dispositivo del mismo usuario entró a la oficina. */
  replaced: 4001,
} as const;

export const MoveMessage = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  dir: z.enum(DIRECTIONS),
  moving: z.boolean(),
});
export type MoveMessage = z.infer<typeof MoveMessage>;

export const ChatScope = z.enum(["proximity", "global"]);
export type ChatScope = z.infer<typeof ChatScope>;

export const ChatSendMessage = z.object({
  text: z.string().trim().min(1).max(500),
  scope: ChatScope,
});
export type ChatSendMessage = z.infer<typeof ChatSendMessage>;

export const StatusMessage = z.object({ status: z.enum(PRESENCE_STATUSES) });
export type StatusMessage = z.infer<typeof StatusMessage>;

// ---------- Servidor → cliente ----------

export interface ChatEvent {
  id: string;
  fromId: string;
  fromName: string;
  text: string;
  scope: ChatScope;
  /** Zona donde se envió (para chats de oficina/sala). */
  zoneId: string | null;
  ts: number;
}

export interface MoveCorrection {
  x: number;
  y: number;
}

/** Nombres de mensajes Colyseus. */
export const MSG = {
  move: "move",
  moveCorrection: "move:correction",
  chatSend: "chat:send",
  chatEvent: "chat:event",
  chatHistory: "chat:history",
  status: "status",
} as const;
