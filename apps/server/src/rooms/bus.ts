// El Megabús de la parada del jardín: la sala lleva solo la fase del bus y cuándo empezó (así todos lo ven
// igual), con el reloj de la sala. Pasa según el horario (cada 3 min reales en el horario laboral del
// juego, cada 10 de noche; ver BUS en @hyvento/shared); si al cerrar las puertas queda gente adentro (en el
// nivel `megabus`) da una vuelta de `tripMs` y vuelve a la estación, y si no, sigue de largo. No se simula
// nada del recorrido: el cliente dibuja el bus con `busOffset` y la hora del servidor.
import { busHeadwayMs, doorsOpenAt, phaseMs, runMs, type BusPhase, type BusTimings } from "@hyvento/shared";
import type { HeldClock } from "./consumables";

export interface BusSchedule {
  firstInMs: number;
  maxWaitMs: number;
}

export interface BusDeps {
  clock: HeldClock;
  now: () => number;
  /** Minuto del día del reloj del juego (manda si es de día o de noche). */
  minuteOfDay: () => number;
  timings: () => BusTimings;
  schedule: () => BusSchedule;
  /** Cuántos van a bordo (en el nivel del bus). */
  riders: () => number;
  /** Cambió la fase: la sala la copia a su estado. */
  onChange: (s: { phase: BusPhase; since: number; nextAt: number; run: number }) => void;
}

/** Pausa mínima entre que un bus se pierde y llega el siguiente. */
const AFTER_LOOP_MS = 20_000;

export class BusLine {
  phase: BusPhase = "away";
  since = 0;
  /** Cuándo empieza a llegar el próximo bus del horario (hora del servidor). */
  nextAt = 0;
  /** Número de pasada (cambia con cada llegada). */
  run = 0;
  private timer?: { clear(): void };

  constructor(private readonly deps: BusDeps) {}

  start() {
    const now = this.deps.now();
    this.since = now;
    this.nextAt = now + this.deps.schedule().firstInMs;
    this.emit();
    this.wait();
  }

  dispose() {
    this.timer?.clear();
    this.timer = undefined;
  }

  /** ¿Las puertas están del todo abiertas (se sube y se baja)? */
  doorsOpen(): boolean {
    return doorsOpenAt(this.phase, this.deps.now() - this.since, this.deps.timings());
  }

  /**
   * Alguien quedó a bordo sin que el bus esté por llegar (entró "llegando en bus"): si el próximo tarda
   * más de `maxWaitMs`, sale uno de refuerzo ya; si el bus se estaba yendo vacío, se lo lleva de vuelta.
   */
  requestRide() {
    const now = this.deps.now();
    if (this.phase === "leaving") {
      // Sigue igual en la pantalla (el arranque de la vuelta es el mismo), pero ahora vuelve.
      this.phase = "route";
      this.emit();
      this.schedule(phaseMs("route", this.deps.timings()) - (now - this.since));
      return;
    }
    if (this.phase === "away" && this.nextAt - now > this.deps.schedule().maxWaitMs) this.dispatch();
  }

  /** Sale un bus ya (de refuerzo): el horario sigue igual después de él si alcanza. */
  dispatch() {
    if (this.phase !== "away") return;
    const keep = this.nextAt;
    this.arrive();
    const now = this.deps.now();
    if (keep > now + runMs(this.deps.timings())) this.nextAt = keep;
    this.emit();
  }

  private arrive() {
    const now = this.deps.now();
    this.run++;
    this.nextAt = now + busHeadwayMs(this.deps.minuteOfDay());
    this.set("arriving");
  }

  private set(phase: BusPhase) {
    this.phase = phase;
    this.since = this.deps.now();
    this.emit();
    if (phase === "away") this.wait();
    else this.schedule(phaseMs(phase, this.deps.timings()));
  }

  private schedule(ms: number) {
    this.timer?.clear();
    this.timer = this.deps.clock.setTimeout(() => this.next(), Math.max(0, ms));
  }

  /** Esperando el horario. Si ya pasó (el bus estuvo dando vueltas con gente), vuelve al rato, no en seguida. */
  private wait() {
    const now = this.deps.now();
    if (this.run > 0 && this.nextAt < now + AFTER_LOOP_MS) this.nextAt = now + AFTER_LOOP_MS;
    this.schedule(Math.max(0, this.nextAt - now));
  }

  private next() {
    switch (this.phase) {
      case "away":
        return this.arrive();
      case "arriving":
      case "route":
        return this.set("open");
      case "open":
        return this.set("closing");
      case "closing":
        return this.set(this.deps.riders() > 0 ? "route" : "leaving");
      case "leaving":
        return this.set("away");
    }
  }

  private emit() {
    this.deps.onChange({ phase: this.phase, since: this.since, nextAt: this.nextAt, run: this.run });
  }
}

