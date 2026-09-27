// Brindis: con una bebida en la mano y alguien cerca con otra, se invita a brindar (B). Si en unos
// segundos los demás también brindan, chocan los vasos y cada uno toma un sorbo. Lo valida el servidor.
import { z } from "zod";
import { heldParts } from "./cafe";
import { CONSUMABLES } from "./consumables";

export const TOAST = {
  /** Hasta qué distancia (en tiles) se brinda con alguien. */
  reachTiles: 2,
  /** Lo que dura la invitación antes de vencerse. */
  windowMs: 6000,
  /** Cuando alguien se suma, lo que se espera por si llega otro más (sin pasarse de la ventana). */
  joinGraceMs: 1500,
  /** Pausa entre brindis de la misma persona. */
  cooldownMs: 20_000,
  /** Lo que dura la animación del choque de vasos (el sorbo viene después). */
  clinkMs: 1300,
} as const;

/** Tiempos del brindis que el servidor usa (los tests los acortan). */
export type ToastTimings = Record<"windowMs" | "joinGraceMs" | "cooldownMs", number>;

/**
 * La mano que lleva una bebida con sorbos (en los combos, la del tinto y no la del cigarro), o -1 si no
 * hay ninguna.
 */
export function drinkPart(item: string, left: readonly number[]): number {
  return heldParts(item).findIndex((art, i) => CONSUMABLES[art]?.action === "sip" && (left[i] ?? 0) > 0);
}

/** Cliente → servidor (`MSG.toast`): brindar (invitar, o sumarse a un brindis de al lado). */
export const ToastMessage = z.object({}).strict().optional();
export type ToastMessage = z.infer<typeof ToastMessage>;

/** Cada uno de los que chocan el vaso y el sorbo que se toma (como en `HeldUsedEvent`). */
export interface ToastSip {
  sessionId: string;
  part: number;
  /** Sorbos que le quedan a esa mano después de este (0 = se acabó). */
  left: number;
}

/**
 * Servidor → clientes del mismo nivel (`MSG.toastEvent`):
 * - `invite`: alguien levanta el vaso e invita; se vence en `expiresInMs`.
 * - `join`: otro se suma al brindis.
 * - `clink`: chocan los vasos (todos se miran), dicen "¡Salud!" y toman un sorbo.
 * - `solo`: nadie respondió: brinda solo, con un gesto gracioso.
 */
export type ToastEvent =
  | { kind: "invite"; id: string; sessionId: string; expiresInMs: number }
  | { kind: "join"; id: string; sessionId: string }
  | { kind: "clink"; id: string; sips: ToastSip[] }
  | { kind: "solo"; id: string; sessionId: string };

export type ToastError = "no-drink" | "alone" | "busy";

/** Servidor → quien brindó, si no se pudo (`MSG.toastResult`). */
export interface ToastResult {
  ok: false;
  error: ToastError;
}

export const TOAST_ERROR_TEXT: Record<ToastError, string> = {
  "no-drink": "Para brindar necesitas una bebida en la mano.",
  alone: "No hay nadie cerca con una bebida para brindar.",
  busy: "Espera un momento antes de brindar otra vez.",
};
