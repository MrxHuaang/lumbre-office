import { z } from "zod";
import { Look } from "./look";

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

/** Perfil editable por el usuario (onboarding / ajustes). `look: null` vuelve al personaje fijo. */
export const ProfileUpdate = z.object({
  name: z.string().trim().min(1).max(24),
  avatar: z.enum(HUMAN_AVATARS),
  look: Look.nullable().optional(),
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
  /** Sentado en el asiento cuya posición es (x, y). Opcional: clientes viejos no lo envían. */
  seated: z.boolean().optional(),
});
export type MoveMessage = z.infer<typeof MoveMessage>;

/** Usar un portal (puerta de la cabaña, escaleras) para pasar a otro nivel. */
export const TravelMessage = z.object({ portal: z.string().min(1) });
export type TravelMessage = z.infer<typeof TravelMessage>;

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
  /** Presente cuando el servidor te cambió de nivel (al usar un portal). */
  area?: string;
  /** El servidor te dejó sentado en (x, y) (al despertar de un desmayo). */
  seated?: boolean;
}

// ---------- Oficinas personales ----------

export const OfficeLockMessage = z.object({ locked: z.boolean() });
export type OfficeLockMessage = z.infer<typeof OfficeLockMessage>;

export const KnockMessage = z.object({ zoneId: z.string().min(1) });
export type KnockMessage = z.infer<typeof KnockMessage>;

export const KnockRespondMessage = z.object({ requestId: z.string().min(1), accept: z.boolean() });
export type KnockRespondMessage = z.infer<typeof KnockRespondMessage>;

/** Servidor → dueño de la oficina: alguien toca la puerta. */
export interface KnockRequest {
  requestId: string;
  zoneId: string;
  fromName: string;
}

export type KnockOutcome = "accepted" | "declined" | "timeout" | "owner-away" | "not-locked" | "too-soon";

/** Servidor → quien tocó: resultado. */
export interface KnockResult {
  zoneId: string;
  outcome: KnockOutcome;
  ownerName: string;
}

/** Tiempo que el dueño tiene para responder antes de que el toque expire. */
export const KNOCK_TIMEOUT_MS = 30_000;
/** Mínimo entre toques de la misma persona a la misma oficina. */
export const KNOCK_COOLDOWN_MS = 8_000;

/** Rutas HTTP del servidor de juego (la web avisa cambios con `Authorization: Bearer GAME_TOKEN_SECRET`). */
export const INTERNAL_ROUTES = {
  health: "/health",
  officesChanged: "/internal/offices-changed",
  /** Cambió el saldo de alguien desde la web (buzón, misiones): body `{ userId }`. */
  pointsChanged: "/internal/points-changed",
  /** Cambiaron los ajustes del casino en /admin (límite diario, abierto/cerrado). */
  casinoSettingsChanged: "/internal/casino-settings-changed",
} as const;

/** Nombres de mensajes Colyseus. */
export const MSG = {
  move: "move",
  moveCorrection: "move:correction",
  travel: "travel",
  activity: "activity",
  pointsAwarded: "points:awarded",
  /** Pedir en la barra de la cafetería (`CafeOrderMessage`) y su respuesta (`CafeOrderResult`). */
  cafeOrder: "cafe:order",
  cafeResult: "cafe:result",
  /** Casino: apostar en la ruleta (`RouletteBetMessage`), resultado de una apuesta (`CasinoResult`) y lo
   *  ganado al terminar la ronda (`RouletteSettled`). */
  rouletteBet: "casino:roulette:bet",
  casinoResult: "casino:result",
  rouletteSettled: "casino:roulette:settled",
  /** Blackjack: apostar en tu asiento (`BlackjackBetMessage`) y jugar tu turno (`BlackjackActionMessage`). */
  blackjackBet: "casino:blackjack:bet",
  blackjackAction: "casino:blackjack:action",
  blackjackSettled: "casino:blackjack:settled",
  /** Servidor → cliente al entrar: la hora del servidor (`{ now }`) para los conteos regresivos. */
  clock: "clock",
  /** Editor de oficina (`OfficeEditMessage`) y su respuesta (`OfficeEditResult`). */
  officeEdit: "office:edit",
  officeEditResult: "office:edit:result",
  /** Editor de la casa, solo admins (`WorldEditMessage`) y su respuesta (`WorldEditResult`). */
  worldEdit: "world:edit",
  worldEditResult: "world:edit:result",
  /** Emote sobre la cabeza (`EmoteMessage`) y el aviso a los del mismo nivel (`EmoteEvent`). */
  emote: "emote",
  emoteEvent: "emote:event",
  chatSend: "chat:send",
  chatEvent: "chat:event",
  chatHistory: "chat:history",
  status: "status",
  /** La web guardó el perfil (nombre o personaje): el servidor lo vuelve a leer de la base. */
  profileChanged: "profile:changed",
  officeLock: "office:lock",
  knock: "office:knock",
  knockRequest: "office:knock:request",
  knockRespond: "office:knock:respond",
  knockResult: "office:knock:result",
  /** Pedir en la barra del club (`BarOrderMessage`); responde con `cafeResult`. */
  barOrder: "bar:order",
  /** Usar lo que tengo en la mano (`UseHeldMessage`) y el aviso a los del mismo nivel (`HeldUsedEvent`). */
  useHeld: "held:use",
  heldUsed: "held:used",
  /** Alguien se pasó de tragos: vomita y se desmaya (`DrunkBlackoutEvent`, a los del mismo nivel). */
  drunkBlackout: "drunk:blackout",
  /** Usar un mueble (`FurnitureUseMessage`) y el aviso de instrumentos y gato (`FurnitureEvent`). */
  furnitureUse: "furniture:use",
  furnitureEvent: "furniture:event",
  /** Pesca (fishing.ts): lanzar junto al lago, responder a la picada (`FishHookMessage`), terminar el
   *  minijuego (`FishFinishMessage`) o recoger el sedal; el servidor avisa con `FishingEvent`. */
  fishCast: "fish:cast",
  fishHook: "fish:hook",
  fishFinish: "fish:finish",
  fishCancel: "fish:cancel",
  fishEvent: "fish:event",
  /** Servidor → los del nivel: alguien desbloqueó un logro (ver achievements.ts). */
  achievementUnlocked: "achievement:unlocked",
} as const;
