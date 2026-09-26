// Emotes: un globo con un dibujo sobre la cabeza (y "bailar", que además hace saltar al personaje).
// Los ve quien está en el mismo nivel de la cabaña.
import { z } from "zod";

export const EMOTES = [
  { id: "wave", name: "Saludar" },
  { id: "heart", name: "Corazón" },
  { id: "laugh", name: "Jaja" },
  { id: "clap", name: "¡Bien!" },
  { id: "idea", name: "Idea" },
  { id: "question", name: "¿Qué?" },
  { id: "dance", name: "Bailar" },
] as const;

export type EmoteId = (typeof EMOTES)[number]["id"];
export const EMOTE_IDS = EMOTES.map((e) => e.id) as [EmoteId, ...EmoteId[]];

export const EMOTE = {
  /** Cuánto se ve el globo. */
  showMs: 2600,
  /** Cuánto dura el baile. */
  danceMs: 4000,
  /** Tiempo mínimo entre dos emotes de la misma persona (el servidor ignora los que lleguen antes). */
  cooldownMs: 1000,
} as const;

/** Cliente → servidor (`MSG.emote`). */
export const EmoteMessage = z.object({ emote: z.enum(EMOTE_IDS) });
export type EmoteMessage = z.infer<typeof EmoteMessage>;

/** Servidor → clientes del mismo nivel (`MSG.emoteEvent`), también a quien lo hizo. */
export interface EmoteEvent {
  sessionId: string;
  emote: EmoteId;
}
