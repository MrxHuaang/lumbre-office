// La historia en la sala (ver historia.ts de @hyvento/shared): saltar el capítulo y leer el tablón (paso 5:
// el servidor revisa que esté junto al tablón y suma `board_reads`). El avance, las entregas con Doña Aurora,
// el prólogo y la carta del final los lleva la sala de los encargos (encargos.ts), que ya sabe de historias.
import { nearPointOfType, type OfficeMap } from "@hyvento/map";
import { HISTORIA_MSG, STAT_KEYS } from "@hyvento/shared";
import type { Encargos } from "./encargos";

export interface HistoriaParts {
  encargos: Encargos;
  who(sessionId: string): { userId: string; area: string; x: number; y: number } | undefined;
  mapOf(area: string): OfficeMap;
  bump(userId: string, key: string): void;
}

/** Cada cuánto, como mucho, cuenta una lectura del tablón por persona (abrirlo y cerrarlo no suma de a mucho). */
const BOARD_READ_GAP_MS = 60_000;

export function bindHistoria(room: { onMessage(type: string, cb: (client: { sessionId: string }, raw: unknown) => void): unknown }, parts: HistoriaParts) {
  const lastRead = new Map<string, number>();
  room.onMessage(HISTORIA_MSG.skip, (client) => {
    const p = parts.who(client.sessionId);
    if (p) void parts.encargos.skipStory(p.userId);
  });
  room.onMessage(HISTORIA_MSG.board, (client) => {
    const p = parts.who(client.sessionId);
    if (!p || !nearPointOfType(parts.mapOf(p.area), "task_board", p.x, p.y)) return;
    const now = Date.now();
    if (now - (lastRead.get(p.userId) ?? 0) < BOARD_READ_GAP_MS) return;
    lastRead.set(p.userId, now);
    parts.bump(p.userId, STAT_KEYS.boardReads);
  });
}
