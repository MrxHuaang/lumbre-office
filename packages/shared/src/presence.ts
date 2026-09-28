// Estados automáticos: "Ausente" cuando el navegador lleva rato sin uso y "En reunión" en la sala de
// reuniones con alguien más. Lo manual manda: "No molestar" y "Ausente" elegidos a mano no se pisan.
import type { ManualStatus, PresenceStatus } from "./protocol";

export const AUTO_AWAY = {
  /** Sin mouse ni teclado con la pestaña a la vista: pasa a "Ausente". */
  idleMs: 10 * 60_000,
  /** Con la pestaña oculta (otra pestaña, ventana minimizada) basta menos. */
  hiddenMs: 5 * 60_000,
  /** Cada cuánto el navegador revisa el temporizador. */
  checkMs: 15_000,
} as const;

/**
 * El estado que se ve, a partir del elegido a mano y de lo automático. Orden: "No molestar" y "Ausente"
 * a mano > "En reunión" (estar con gente cuenta aunque no toques el mouse) > "Ausente" automático > el
 * manual. Por eso al volver o al salir de la reunión se recupera solo lo de antes.
 */
export function effectiveStatus(p: { manual: ManualStatus; idle: boolean; meeting: boolean }): PresenceStatus {
  if (p.manual === "dnd" || p.manual === "away") return p.manual;
  if (p.meeting) return "meeting";
  if (p.idle) return "away";
  return p.manual;
}

/**
 * Temporizador de inactividad del navegador, sin tocar el DOM (se prueba con relojes falsos). El cliente
 * le pasa la actividad y la visibilidad; `check` dice si cambió de activo a inactivo o al revés.
 */
export class IdleTimer {
  private lastInput: number;
  private hiddenSince: number | null = null;
  idle = false;

  constructor(
    now: number,
    private readonly opts: { idleMs: number; hiddenMs: number } = AUTO_AWAY,
  ) {
    this.lastInput = now;
  }

  /** Mouse o teclado. Devuelve true si con esto dejó de estar inactivo. */
  activity(now: number): boolean {
    this.lastInput = now;
    return this.check(now);
  }

  /** La pestaña se ocultó o volvió; volver a verla cuenta como actividad. */
  visibility(hidden: boolean, now: number): boolean {
    if (hidden) {
      this.hiddenSince ??= now;
      return this.check(now);
    }
    this.hiddenSince = null;
    return this.activity(now);
  }

  /** Recalcula; true si el estado (idle) cambió. */
  check(now: number): boolean {
    const idle =
      (this.hiddenSince !== null && now - this.hiddenSince >= this.opts.hiddenMs) || now - this.lastInput >= this.opts.idleMs;
    if (idle === this.idle) return false;
    this.idle = idle;
    return true;
  }
}
