// El Megabús de la parada del jardín: la sala lleva solo la fase del bus, cuándo empezó y de dónde a dónde
// va (así todos lo ven igual), con el reloj de la sala. Pasa según el horario (cada 3 min reales en el
// horario laboral del juego, cada 10 de noche; ver BUS en @hyvento/shared). Si al cerrar las puertas queda
// gente adentro (en el nivel `megabus`) viaja `tripMs` hasta la parada "Casa", donde la sala baja a cada
// uno en su casa (`arriveHome`); si quedan a bordo los que van a la estación, vuelve con ellos y abre en la
// estación, y si no, se pierde hasta el próximo del horario. Si va vacío, sigue de largo. No se simula nada
// del recorrido: el cliente dibuja el bus con `busOffset` y la hora del servidor.
import { busHeadwayMs, doorsOpenAt, phaseMs, runMs, type BusPhase, type BusRoute, type BusTimings } from "@hyvento/shared";
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
  /** Cuántos de los de a bordo van a su casa (los demás van a la estación). */
  homeRiders: () => number;
  /** Llegó a la parada "Casa": la sala baja a cada uno en la suya y dice cuántos siguen a bordo. */
  arriveHome: () => number;
  /**
   * La calle ocupada (el desfile del Carnaval): mientras tanto no llega ningún bus, ni el del horario ni el
   * de refuerzo; esperan y salen apenas se libere.
   */
  held?: () => boolean;
  /** Cambió la fase: la sala la copia a su estado. */
  onChange: (s: { phase: BusPhase; since: number; nextAt: number; run: number } & BusRoute) => void;
}

/** Pausa mínima entre que un bus se pierde y llega el siguiente. */
const AFTER_LOOP_MS = 20_000;
/** Con la calle ocupada, cada cuánto se vuelve a mirar si ya se puede salir. */
const HELD_RETRY_MS = 2_000;

export class BusLine {
  phase: BusPhase = "away";
  since = 0;
  /** Cuándo empieza a llegar el próximo bus del horario (hora del servidor). */
  nextAt = 0;
  /** Número de pasada (cambia con cada llegada). */
  run = 0;
  /** De dónde a dónde va la ruta en curso (solo cuenta en "route"). */
  route: BusRoute = { from: "estacion", to: "estacion" };
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
      this.route = { from: "estacion", to: "estacion" };
      this.emit();
      this.schedule(phaseMs("route", this.deps.timings()) - (now - this.since));
      return;
    }
    if (this.phase === "away" && this.nextAt - now > this.deps.schedule().maxWaitMs) this.dispatch();
  }

  /**
   * El panel del director: que llegue un bus ya (de refuerzo). "ocupado" si ya viene, está en la parada o
   * va en ruta; "calle" si el desfile ocupa la calle (ahí no se le hace esperar a nadie).
   */
  callNow(): "ok" | "ocupado" | "calle" {
    if (this.phase !== "away") return "ocupado";
    if (this.deps.held?.()) return "calle";
    this.dispatch();
    return "ok";
  }

  /** Sale un bus ya (de refuerzo): el horario sigue igual después de él si alcanza. */
  dispatch() {
    if (this.phase !== "away") return;
    // Con la calle ocupada, el refuerzo espera: sale apenas se libere.
    if (this.deps.held?.()) {
      this.nextAt = Math.min(this.nextAt, this.deps.now());
      this.schedule(HELD_RETRY_MS);
      return;
    }
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

  private set(phase: BusPhase, route?: BusRoute) {
    if (route) this.route = route;
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
        if (this.deps.held?.()) return this.schedule(HELD_RETRY_MS);
        return this.arrive();
      case "arriving":
        return this.set("open");
      case "route":
        return this.endRoute();
      case "open":
        return this.set("closing");
      case "closing":
        // Con alguien que va a su casa, a la parada "Casa"; con solo los que van a la estación (no se
        // bajaron), la vuelta de siempre; vacío, sigue de largo.
        if (this.deps.homeRiders() > 0) return this.set("route", { from: "estacion", to: "casa" });
        return this.set(this.deps.riders() > 0 ? "route" : "leaving", { from: "estacion", to: "estacion" });
      case "leaving":
        return this.set("away");
    }
  }

  /** Termina una ruta: en la estación abre; en la casa baja a cada uno y vuelve con los que siguen. */
  private endRoute() {
    if (this.route.to === "estacion") return this.set("open");
    const left = this.deps.arriveHome();
    if (left > 0) return this.set("route", { from: "casa", to: "estacion" });
    this.set("away");
  }

  private emit() {
    this.deps.onChange({ phase: this.phase, since: this.since, nextAt: this.nextAt, run: this.run, ...this.route });
  }
}

