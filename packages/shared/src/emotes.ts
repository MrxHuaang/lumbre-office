// Emotes: un globo animado sobre la cabeza y, en algunos, un gesto corto del personaje (un saltito,
// agitar el brazo, bailar). Los ve quien está en el mismo nivel de la cabaña.
import { z } from "zod";

/**
 * Gesto del personaje mientras dura el emote (se dibuja encima del sprite, sin tocar las hojas):
 * - `wave`: levanta el brazo y lo agita;
 * - `hop`: saltitos; `jump`: un salto de sorpresa;
 * - `sway`: se balancea de lado a lado; `shake`: tiembla (enojo);
 * - `nod`: asiente; `dance`: baila girando.
 */
export type EmoteGesture = "none" | "wave" | "hop" | "jump" | "sway" | "shake" | "nod" | "dance";

/** En este orden salen en el selector: los nueve primeros tienen atajo (1 a 9). */
export const EMOTES = [
  { id: "wave", name: "Saludar", gesture: "wave" },
  { id: "laugh", name: "Jaja", gesture: "hop" },
  { id: "heart", name: "Corazón", gesture: "none" },
  { id: "clap", name: "Aplausos", gesture: "hop" },
  { id: "ok", name: "¡Listo!", gesture: "nod" },
  { id: "idea", name: "Idea", gesture: "jump" },
  { id: "question", name: "¿Qué?", gesture: "sway" },
  { id: "party", name: "Fiesta", gesture: "hop" },
  { id: "dance", name: "Bailar", gesture: "dance" },
  { id: "surprise", name: "Sorpresa", gesture: "jump" },
  { id: "cry", name: "Llorar", gesture: "sway" },
  { id: "angry", name: "Enojo", gesture: "shake" },
  { id: "sleep", name: "Dormir", gesture: "none" },
  { id: "music", name: "Música", gesture: "sway" },
  { id: "coffee", name: "Café", gesture: "none" },
  { id: "star", name: "¡Genial!", gesture: "hop" },
] as const satisfies readonly { id: string; name: string; gesture: EmoteGesture }[];

export type EmoteId = (typeof EMOTES)[number]["id"];
export const EMOTE_IDS = EMOTES.map((e) => e.id) as [EmoteId, ...EmoteId[]];

export const emoteInfo = (id: string) => EMOTES.find((e) => e.id === id);

export const EMOTE = {
  /** Cuánto se ve el globo. */
  showMs: 2600,
  /** Cuánto dura el baile. */
  danceMs: 4000,
  /** Cuánto dura el gesto del personaje (saltitos, brazo, balanceo). */
  gestureMs: 1200,
  /** Tiempo mínimo entre dos emotes de la misma persona (el servidor ignora los que lleguen antes). */
  cooldownMs: 1000,
  /** Y como mucho `burst` emotes cada `burstWindowMs` (para que no se pueda llenar la pantalla). */
  burst: 5,
  burstWindowMs: 10_000,
} as const;

/**
 * ¿Se acepta un emote ahora? `times` son los últimos aceptados de esa persona (se actualiza si sí).
 * Lo usa el servidor; el cliente no lo necesita (solo se ve lo que el servidor reenvía).
 */
export function acceptEmote(times: number[], now: number): boolean {
  const last = times[times.length - 1];
  if (last !== undefined && now - last < EMOTE.cooldownMs) return false;
  const recent = times.filter((t) => now - t < EMOTE.burstWindowMs);
  if (recent.length >= EMOTE.burst) return false;
  recent.push(now);
  times.splice(0, times.length, ...recent);
  return true;
}

/** Cliente → servidor (`MSG.emote`). */
export const EmoteMessage = z.object({ emote: z.enum(EMOTE_IDS) });
export type EmoteMessage = z.infer<typeof EmoteMessage>;

/** Servidor → clientes del mismo nivel (`MSG.emoteEvent`), también a quien lo hizo. */
export interface EmoteEvent {
  sessionId: string;
  emote: EmoteId;
}
