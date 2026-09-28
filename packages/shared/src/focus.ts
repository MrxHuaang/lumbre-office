// Modo foco: un pomodoro que lleva el servidor. Al empezar te pone en "No molestar", cierra la puerta de
// tu oficina (si estás en ella) y pone en la placa que estás concentrado; al completar el bloque da puntos
// (con tope diario). Si sales de la oficina donde empezaste o te vas de la cabaña, se cancela sin puntos.
import { z } from "zod";

export const FOCUS_PRESETS = {
  "25-5": { label: "25 / 5", workMin: 25, breakMin: 5 },
  "50-10": { label: "50 / 10", workMin: 50, breakMin: 10 },
} as const;
export type FocusPresetId = keyof typeof FOCUS_PRESETS;
export const FOCUS_PRESET_IDS = Object.keys(FOCUS_PRESETS) as FocusPresetId[];

/** "" = sin foco, "work" = concentrado, "break" = descanso después de un bloque. */
export type FocusPhase = "" | "work" | "break";

export const FOCUS = {
  /** Puntos por bloque de enfoque completado (motivo PRESENCE: es trabajo, y cuenta en su tope). */
  points: 5,
  /** Bloques con puntos por día (día de Bogotá). */
  dailyCap: 4,
  /** Lo que dice la placa de la puerta mientras dura el bloque. */
  note: "En foco · no molestar",
} as const;

export const focusMs = (preset: FocusPresetId, phase: "work" | "break") =>
  (phase === "work" ? FOCUS_PRESETS[preset].workMin : FOCUS_PRESETS[preset].breakMin) * 60_000;

/** `refId` de los puntos de un bloque: el prefijo del día sirve para contar el tope. */
export const focusRefPrefix = (day: number) => `foco:${day}:`;

/** Cliente → servidor (`MSG.focusStart`): empezar un bloque de enfoque. */
export const FocusStartMessage = z.object({ preset: z.enum(FOCUS_PRESET_IDS as [FocusPresetId, ...FocusPresetId[]]) });
export type FocusStartMessage = z.infer<typeof FocusStartMessage>;

/** Por qué terminó un pomodoro sin completarse. */
export type FocusCancelReason = "left" | "stopped";

/** Servidor → la persona: cómo va su pomodoro. */
export type FocusEvent =
  | { kind: "done"; points: number; capped: boolean }
  | { kind: "break-over" }
  | { kind: "cancelled"; reason: FocusCancelReason };

export const FOCUS_CANCEL_TEXT: Record<FocusCancelReason, string> = {
  left: "Saliste de tu oficina: el bloque de enfoque se canceló (sin puntos).",
  stopped: "Dejaste el bloque de enfoque.",
};
