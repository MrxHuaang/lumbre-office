// Retención del chat global: los mensajes guardados (ChatMessage) de más de CHAT_RETENTION_DAYS días se
// borran. Corre al crear la sala y después cada CHAT_PRUNE_EVERY_MS. Es idempotente (borrar lo viejo dos
// veces no cambia nada) y barata: el borrado usa el índice (scope, createdAt) que ya existe.
import { logError, logInfo } from "../log";
import type { ChatRetentionRepository } from "../repo/types";

/** Cuántos días se guarda el chat global. */
export const CHAT_RETENTION_DAYS = 30;
/** Cada cuánto se poda (la sala vive días: basta con unas pocas veces por día). */
export const CHAT_PRUNE_EVERY_MS = 6 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Lo que se creó antes de esta fecha ya se puede borrar. */
export function chatCutoff(now: number, days = CHAT_RETENTION_DAYS): Date {
  return new Date(now - days * DAY_MS);
}

/** Borra los mensajes viejos y devuelve cuántos. Si la base falla, lo anota y sigue (vuelve a probar la próxima vez). */
export async function pruneOldChat(repo: ChatRetentionRepository, now: number, days = CHAT_RETENTION_DAYS): Promise<number> {
  const cutoff = chatCutoff(now, days);
  try {
    const deleted = await repo.pruneChatBefore(cutoff);
    if (deleted > 0) logInfo("chatRetention", `mensajes viejos del chat borrados: ${deleted}`, { antesDe: cutoff.toISOString() });
    return deleted;
  } catch (err) {
    logError("chatRetention", err, { antesDe: cutoff.toISOString() });
    return 0;
  }
}

/** Reloj mínimo que se necesita (el de Colyseus, `room.clock`). */
interface IntervalClock {
  setInterval(fn: () => void, ms: number): unknown;
}

/** Poda ahora (sin esperar: no demora la creación de la sala) y programa las siguientes. */
export function startChatRetention(clock: IntervalClock, repo: () => ChatRetentionRepository, now: () => number = Date.now): void {
  const run = () => void pruneOldChat(repo(), now());
  run();
  clock.setInterval(run, CHAT_PRUNE_EVERY_MS);
}
