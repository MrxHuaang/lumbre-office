// El escenario del jardín (anfiteatro): la tarima, donde hablan hasta dos personas para todo el público,
// y las gradas en semicírculo. Quien está en la tarima (o tiene la palabra) se oye y comparte pantalla
// con todo el anfiteatro (ver `hearing` en proximity.ts); en las gradas se oye además a los vecinos, bajito.
// Desde las gradas se aplaude y se levanta la mano: la fila de turnos la ve quien está en la tarima, que
// puede darle la palabra al primero. Todo lo valida el servidor (apps/server/src/rooms/escenario.ts).
import { z } from "zod";
import type { StageRole } from "./proximity";

export const ESCENARIO = {
  area: "jardin",
  /** Zona de la tarima (quien está ahí habla para todos) y de las gradas (el público). */
  stageZone: "escenario",
  seatsZone: "gradas",
  /** Punto frente a la escalerita de la tarima: "E · Subir al escenario". */
  stagePoint: "stage",
  /** Cuántos caben en la tarima a la vez. */
  maxOnStage: 2,
  /** Pausa entre dos aplausos de la misma persona. */
  clapCooldownMs: 1200,
  /** Se cuenta como ovación si aplauden al menos `ovationCrowd` personas en `crowdWindowMs`. */
  crowdWindowMs: 4000,
  ovationCrowd: 3,
  /** Pausa entre dos cambios de mano de la misma persona (subirla y bajarla en ráfaga). */
  handCooldownMs: 800,
} as const;

/** ¿Está en el anfiteatro (tarima o gradas)? */
export const inAmphitheater = (zoneId: string | null | undefined) => zoneId === ESCENARIO.stageZone || zoneId === ESCENARIO.seatsZone;

/**
 * Papel de alguien en el anfiteatro para la proximidad: en la tarima o con la palabra habla para todos;
 * en las gradas escucha. Fuera del anfiteatro, ninguno (undefined). Lo usan igual servidor y cliente.
 */
export function stageRole(zoneId: string | null | undefined, userId: string, floor: string): StageRole | undefined {
  if (zoneId === ESCENARIO.stageZone) return "speaker";
  if (zoneId === ESCENARIO.seatsZone) return floor !== "" && userId === floor ? "speaker" : "audience";
  return undefined;
}

export const ESCENARIO_MSG = {
  /** Cliente → servidor: subir a la tarima desde la escalerita o bajar (`StageMessage`). */
  stage: "escenario:stage",
  /** Cliente → servidor: levantar o bajar la mano en las gradas (`HandMessage`). */
  hand: "escenario:hand",
  /** Cliente → servidor, desde la tarima: dar la palabra a alguien de la fila o quitarla (`FloorMessage`). */
  floor: "escenario:floor",
  /** Cliente → servidor: aplaudir. */
  clap: "escenario:clap",
  /** Servidor → los del jardín: alguien aplaudió y cuántos aplauden a la vez (`ApplauseEvent`). */
  applause: "escenario:applause",
  /** Servidor → quien lo intentó: por qué no se pudo (`EscenarioNotice`). */
  notice: "escenario:notice",
} as const;

export const StageMessage = z.object({ on: z.boolean() });
export type StageMessage = z.infer<typeof StageMessage>;

export const HandMessage = z.object({ up: z.boolean() });
export type HandMessage = z.infer<typeof HandMessage>;

/** `userId` null quita la palabra; si no, se la da a esa persona (tiene que estar en las gradas). */
export const FloorMessage = z.object({ userId: z.string().min(1).max(64).nullable() });
export type FloorMessage = z.infer<typeof FloorMessage>;

export interface ApplauseEvent {
  sessionId: string;
  /** Cuántas personas distintas aplaudieron en la última ventana (incluida esta). */
  crowd: number;
}

export type EscenarioNoticeCode = "full" | "far" | "seated" | "notStage" | "notSeats" | "notSpeaker" | "notInSeats" | "onStage";

export interface EscenarioNotice {
  code: EscenarioNoticeCode;
}

export const ESCENARIO_NOTICES: Record<EscenarioNoticeCode, string> = {
  full: "La tarima está llena: caben dos a la vez.",
  far: "Acércate a la escalerita de la tarima.",
  seated: "Primero levántate del asiento.",
  notStage: "No estás en la tarima.",
  notSeats: "Para eso tienes que estar en las gradas.",
  notSpeaker: "Solo quien está en la tarima puede dar la palabra.",
  notInSeats: "Esa persona ya no está en las gradas.",
  onStage: "Ya estás en la tarima.",
};

/** Alguien de la fila de turnos (la mano levantada), en orden de llegada. */
export interface HandView {
  sessionId: string;
  userId: string;
  name: string;
  at: number;
}
