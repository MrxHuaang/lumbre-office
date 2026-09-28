// Casa viva: lo que pasa después de usar un mueble nuevo. Lo gratis (nevera, cafetera, el malvavisco
// de la fogata) va a la mochila (y a la mano si estaban libres); el cubículo del baño queda ocupado un rato y se libera solo (o al
// moverse, o al irse). Los contadores ya los avanzó FurnitureUses; aquí no hay nada más que hacer.
import { CASA } from "@hyvento/shared";
import type { FurnitureUseResult } from "./usables";

export interface CasaClock {
  setTimeout(fn: () => void, ms: number): { clear(): void };
}

/** Los cubículos ocupados: un MapSchema<string> en la sala (clave → userId), un Map en los tests. */
export interface Stalls {
  get(key: string): string | undefined;
  set(key: string, userId: string): unknown;
  delete(key: string): unknown;
  entries(): IterableIterator<[string, string]>;
}

export class CasaViva {
  private stallTimers = new Map<string, { clear(): void }>();
  private roastTimers = new Map<string, { clear(): void }>();

  constructor(
    private readonly stalls: Stalls,
    private readonly clock: CasaClock,
    /** Suma lo gratis a la mochila (Bag.add, con la mano si está libre). */
    private readonly give: (userId: string, item: string) => void,
    /** Cuánto se está en el cubículo (los tests lo acortan). */
    private readonly stallMs: () => number = () => CASA.stallMs,
  ) {}

  /** Quién está en ese cubículo. */
  occupant = (key: string) => this.stalls.get(key);

  /**
   * Después de un uso válido: dar lo gratis y ocupar el cubículo. `stillNear` dice, al terminar de asar
   * el malvavisco, si sigue junto a la fogata (si se fue o cambió de nivel, no lo recibe).
   */
  after(userId: string, result: FurnitureUseResult, stillNear: () => boolean = () => true) {
    if (!result.ok || result.kind !== "event") return;
    if (result.gives) {
      const { item, afterMs } = result.gives;
      if (afterMs <= 0) this.give(userId, item);
      else {
        // El malvavisco llega a la mano ya dorado, al terminar de asarse.
        this.roastTimers.get(userId)?.clear();
        this.roastTimers.set(
          userId,
          this.clock.setTimeout(() => {
            this.roastTimers.delete(userId);
            if (stillNear()) this.give(userId, item);
          }, afterMs),
        );
      }
    }
    if (result.stall) this.enterStall(result.stall, userId);
  }

  private enterStall(key: string, userId: string) {
    // Una persona está en un solo cubículo a la vez.
    this.leaveStall(userId);
    this.stalls.set(key, userId);
    this.stallTimers.set(
      key,
      this.clock.setTimeout(() => this.freeStall(key), this.stallMs()),
    );
  }

  private freeStall(key: string) {
    this.stallTimers.get(key)?.clear();
    this.stallTimers.delete(key);
    this.stalls.delete(key);
  }

  /** Sale del cubículo en que esté (se movió, se fue de la sala o cambió de nivel). */
  leaveStall(userId: string) {
    for (const [key, who] of [...this.stalls.entries()]) if (who === userId) this.freeStall(key);
  }

  /** Se fue de la sala: se libera su cubículo y se olvida el malvavisco a medio asar. */
  forget(userId: string) {
    this.leaveStall(userId);
    this.roastTimers.get(userId)?.clear();
    this.roastTimers.delete(userId);
  }

  /** ¿Está adentro de algún cubículo? */
  inStall(userId: string) {
    for (const [, who] of this.stalls.entries()) if (who === userId) return true;
    return false;
  }
}
