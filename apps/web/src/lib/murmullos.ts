// Los murmullos de la gente de la fiesta (VIR-167), lo puro: quién dice algo en este rato (la misma cuenta en
// todos los navegadores), a quiénes se les ve el texto (como mucho dos en toda la pantalla, primero los más
// cercanos y solo a 3 tiles o menos; los demás, solo el ícono de habla) y cómo contestan a los emotes.
import type { EmoteId } from "@hyvento/shared";

export const MURMULLO = {
  /** Cada cuánto, más o menos, murmura cada uno (ms reales). */
  cadaMs: 24_000,
  /** En un corrillo hablan por turnos: cada cuánto cambia el que habla. */
  turnoMs: 7_000,
  /** Cuánto dura el texto (sube y se desvanece) y el ícono. */
  duraMs: 2_500,
  /** Hasta dónde se lee el texto (tiles). */
  leeTiles: 3,
  /** Textos a la vez en toda la pantalla. */
  maxTextos: 2,
} as const;

/** ¿Le toca murmurar a ese NPC en este rato? `hash` es su semilla; `slot`, el rato. */
export function tocaMurmullo(hash: number, slot: number): boolean {
  // Cada uno tiene su vuelta de 3 a 5 ratos, corrida por su semilla: no hablan todos a la vez.
  const vuelta = 3 + (hash % 3);
  return (slot + (hash % vuelta)) % vuelta === 0;
}

/** El rato de los murmullos para una hora (ms del servidor). */
export const slotMurmullo = (ms: number) => Math.floor(ms / (MURMULLO.cadaMs / 4));

/** En un corrillo de `n`, quién habla en el turno de ahora (índice). */
export const turnoDeCorrillo = (ms: number, n: number) => (n > 0 ? Math.floor(ms / MURMULLO.turnoMs) % n : 0);

/**
 * De los que murmuran ahora (con su distancia al jugador, en tiles), a quiénes se les ve el texto: los más
 * cercanos dentro del alcance, hasta completar el máximo contando los que ya se ven.
 */
export function conTexto(candidatos: readonly { id: string; dist: number }[], yaVisibles: number): Set<string> {
  const libres = Math.max(0, MURMULLO.maxTextos - yaVisibles);
  return new Set(
    [...candidatos]
      .filter((c) => c.dist <= MURMULLO.leeTiles)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, libres)
      .map((c) => c.id),
  );
}

/** Cómo contesta alguien de la fiesta a un emote de al lado (o null si no contesta). Al baile, aplausos. */
export function respuestaA(emote: EmoteId): EmoteId | null {
  switch (emote) {
    case "dance":
    case "music":
      return "clap";
    case "wave":
      return "wave";
    case "heart":
      return "heart";
    case "laugh":
      return "laugh";
    case "party":
    case "star":
    case "clap":
      return "party";
    case "cry":
      return "heart";
    case "question":
      return "idea";
    default:
      return null;
  }
}
