// Cuánto alcohol lleva cada persona (sorbos del bar del club). Se guarda por userId: recargar la página no
// te deja sobrio. Solo se sincroniza la etapa (`Player.drunk`); un temporizador la baja cuando toca. Pasarse
// de `DRUNK.blackout` desmaya: la sala hace vomitar y, al terminar, te lleva a descansar.
import { ALCOHOL_PER_SIP, DRUNK, drunkDecay, drunkStage, msToNextDrunkStage, SOBER_PER_SIP, type DrunkStage } from "@hyvento/shared";
import type { HeldClock } from "./consumables";

interface Drunk {
  units: number;
  at: number;
  stage: DrunkStage;
  timer?: { clear(): void };
}

export interface DrunkHooks {
  /** Cambió la etapa de alguien: la sala la copia a sus `Player`. */
  onChange(userId: string, stage: DrunkStage): void;
  /** Se pasó de tragos: empieza el desmayo (vomita y se cae). */
  onBlackout(userId: string): void;
  /** Terminó el desmayo: se despierta (ya con la etapa de `DRUNK.wakeUnits`). */
  onWake(userId: string): void;
}

export class Drunkenness {
  private byUser = new Map<string, Drunk>();

  constructor(
    private readonly clock: HeldClock,
    private readonly now: () => number,
    private readonly hooks: DrunkHooks,
    /** Lo que dura el desmayo (los tests lo acortan). */
    private readonly faintMs: () => number = () => DRUNK.faintMs,
  ) {}

  stage(userId: string): DrunkStage {
    const d = this.byUser.get(userId);
    if (!d) return 0;
    return d.stage === 4 ? 4 : drunkStage(drunkDecay(d.units, this.now() - d.at));
  }

  fainted(userId: string) {
    return this.byUser.get(userId)?.stage === 4;
  }

  /** Un sorbo o una pitada de `art`: si lleva alcohol, suma; el agua (mundo lleno) baja un poco. Desmayado no se toma nada. */
  consumed(userId: string, art: string) {
    const sober = SOBER_PER_SIP[art];
    if (sober) return this.sober(userId, sober);
    const add = ALCOHOL_PER_SIP[art];
    if (!add || this.fainted(userId)) return;
    const now = this.now();
    const d = this.byUser.get(userId);
    const units = (d ? drunkDecay(d.units, now - d.at) : 0) + add;
    if (units < DRUNK.blackout) return this.set(userId, units, now, d);
    // Se pasó: desmayado hasta que se despierta (el alcohol no baja mientras tanto).
    d?.timer?.clear();
    const timer = this.clock.setTimeout(() => this.wake(userId), this.faintMs());
    this.byUser.set(userId, { units, at: now, stage: 4, timer });
    this.hooks.onChange(userId, 4);
    this.hooks.onBlackout(userId);
  }

  /**
   * Mareo sin alcohol (dar vueltas en la silla): suma `units` pero sin pasar de `cap`, que queda debajo de
   * "borracho", así que nunca desmaya. Si ya está más mareado que eso (por el bar), no cambia nada.
   * Devuelve la etapa con la que queda.
   */
  dizzy(userId: string, units: number, cap: number): DrunkStage {
    if (this.fainted(userId)) return 4;
    const now = this.now();
    const d = this.byUser.get(userId);
    const current = d ? drunkDecay(d.units, now - d.at) : 0;
    const limit = Math.min(cap, DRUNK.blackout - 0.01);
    if (current >= limit) return this.stage(userId);
    this.set(userId, Math.min(limit, current + units), now, d);
    return this.stage(userId);
  }

  /** Un sorbo de agua: baja `units` lo que lleva (sin bajar de 0); desmayado no hace nada. */
  private sober(userId: string, units: number) {
    const d = this.byUser.get(userId);
    if (!d || d.stage === 4) return;
    const now = this.now();
    this.set(userId, Math.max(0, drunkDecay(d.units, now - d.at) - units), now, d);
  }

  private wake(userId: string) {
    const d = this.byUser.get(userId);
    if (!d) return;
    this.set(userId, DRUNK.wakeUnits, this.now(), d);
    this.hooks.onWake(userId);
  }

  private set(userId: string, units: number, now: number, prev?: Drunk) {
    prev?.timer?.clear();
    const stage = drunkStage(units);
    if (stage === 0) {
      // Casi sobrio: se guarda sin temporizador (lo poco que queda baja al calcularlo).
      if (units > 0) this.byUser.set(userId, { units, at: now, stage });
      else this.byUser.delete(userId);
    } else {
      const next = msToNextDrunkStage(units);
      const timer = Number.isFinite(next) ? this.clock.setTimeout(() => this.settle(userId), next) : undefined;
      this.byUser.set(userId, { units, at: now, stage, timer });
    }
    if (stage !== (prev?.stage ?? 0)) this.hooks.onChange(userId, stage);
  }

  /** Pasó el tiempo: se recalcula lo que queda y se programa la próxima bajada. */
  private settle(userId: string) {
    const d = this.byUser.get(userId);
    if (!d) return;
    const now = this.now();
    const left = drunkDecay(d.units, now - d.at);
    // Ya sobrio: se olvida (lo poco que queda no se nota).
    this.set(userId, drunkStage(left) === 0 ? 0 : left, now, d);
  }

  dispose() {
    for (const d of this.byUser.values()) d.timer?.clear();
    this.byUser.clear();
  }
}
