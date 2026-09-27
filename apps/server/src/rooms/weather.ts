// El clima de afuera: el servidor lo sortea (reglas en @hyvento/shared/weather) y lo pone en el estado,
// así todos ven llover al mismo tiempo. Un temporizador de la sala lo vuelve a sortear cuando se acaba.
import { bogotaHour, nextWeather, weatherDurationMs, type Weather } from "@hyvento/shared";
import type { HeldClock } from "./consumables";

export interface WeatherDeps {
  clock: HeldClock;
  now: () => number;
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

  /** Pone un clima ya (comando de desarrollo) y vuelve a contar su duración desde ahora. */
  force(weather: Weather) {
    this.set(weather);
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
    this.set(nextWeather(this.current, bogotaHour(this.deps.now()), this.deps.random));
  }

  private set(weather: Weather) {
    const changed = weather !== this.current;
    this.current = weather;
    if (changed) this.deps.onChange(weather);
    this.schedule();
  }
}
