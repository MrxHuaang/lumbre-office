// El clima de afuera: el servidor lo sortea (reglas en @hyvento/shared/weather) y lo pone en el estado,
// así todos ven llover al mismo tiempo. Un temporizador de la sala lo vuelve a sortear cuando se acaba
// (con la hora y la estación del calendario del juego: solo en invierno puede nevar).
import { nextWeather, weatherDurationMs, type Season, type Weather } from "@hyvento/shared";
import type { HeldClock } from "./consumables";

export interface WeatherDeps {
  clock: HeldClock;
  /** Hora del reloj del juego (0 a 23): la niebla es más probable temprano en la mañana del juego. */
  hour: () => number;
  /** La estación del calendario del juego. */
  season: () => Season;
  /** Número en [0, 1) (los tests lo fijan). */
  random: () => number;
  /** Cambió el clima: la sala lo copia a su estado. */
  onChange: (weather: Weather) => void;
}

export class WeatherCycle {
  private current: Weather;
  private timer?: { clear(): void };

  constructor(
    private readonly deps: WeatherDeps,
    initial: Weather,
  ) {
    this.current = initial;
  }

  get weather() {
    return this.current;
  }

  /** Arranca el ciclo con el clima actual (lo avisa una vez, para que el estado lo tenga). */
  start() {
    this.deps.onChange(this.current);
    this.schedule();
  }

  /** Fijado por el panel del director: no se sortea hasta que se suelte. */
  private holding = false;

  /**
   * Pone un clima ya y vuelve a contar su duración desde ahora. Con `holdMs` (panel del director) se queda
   * fijo ese rato, o hasta `release` si es `Infinity`.
   */
  force(weather: Weather, holdMs?: number) {
    if (holdMs === undefined) {
      this.holding = false;
      return this.set(weather);
    }
    this.holding = true;
    const changed = weather !== this.current;
    this.current = weather;
    if (changed) this.deps.onChange(weather);
    this.timer?.clear();
    this.timer = Number.isFinite(holdMs) ? this.deps.clock.setTimeout(() => this.release(), holdMs) : undefined;
  }

  /** ¿Lo fijó el director? */
  get held() {
    return this.holding;
  }

  /** Vuelve al clima natural: se sortea el siguiente ya. */
  release() {
    this.holding = false;
    this.roll();
  }

  dispose() {
    this.timer?.clear();
    this.timer = undefined;
  }

  private schedule() {
    this.timer?.clear();
    this.timer = this.deps.clock.setTimeout(() => this.roll(), weatherDurationMs(this.current, this.deps.random));
  }

  private roll() {
    this.set(nextWeather(this.current, this.deps.hour(), this.deps.random, this.deps.season()));
  }

  private set(weather: Weather) {
    const changed = weather !== this.current;
    this.current = weather;
    if (changed) this.deps.onChange(weather);
    this.schedule();
  }
}
