import { WEATHER, weatherDurationMs, type Weather } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { parseDevWeather } from "../src/rooms/devtools";
import { WeatherCycle } from "../src/rooms/weather";

/** Reloj falso: los temporizadores se disparan al avanzar la hora a mano. */
function fakeTime(start = Date.UTC(2026, 8, 27, 20, 0)) {
  let now = start;
  const timers: { at: number; fn: () => void; cleared: boolean }[] = [];
  return {
    now: () => now,
    pending: () => timers.filter((t) => !t.cleared).length,
    clock: {
      setTimeout(fn: () => void, ms: number) {
        const t = { at: now + ms, fn, cleared: false };
        timers.push(t);
        return { clear: () => void (t.cleared = true) };
      },
    },
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const next = timers.filter((t) => !t.cleared && t.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        next.cleared = true;
        now = next.at;
        next.fn();
      }
      now = end;
    },
  };
}

function setup(random: () => number, initial: Weather = "despejado", hour = () => 15) {
  const time = fakeTime();
  const changes: Weather[] = [];
  const cycle = new WeatherCycle({ clock: time.clock, hour, random, onChange: (w) => changes.push(w) }, initial);
  return { time, cycle, changes };
}

describe("clima en la sala", () => {
  it("avisa el clima inicial al arrancar", () => {
    const { cycle, changes } = setup(() => 0);
    cycle.start();
    expect(changes).toEqual(["despejado"]);
    expect(cycle.weather).toBe("despejado");
  });

  it("vuelve a sortear cuando se acaba el clima", () => {
    // Azar casi 1: desde despejado a las 15:00 sale niebla (el último con peso); desde niebla, niebla.
    const { cycle, changes, time } = setup(() => 0.999999);
    cycle.start();
    time.advance(weatherDurationMs("despejado", () => 0.999999) - 1);
    expect(changes).toEqual(["despejado"]);
    time.advance(1);
    expect(changes).toEqual(["despejado", "niebla"]);
    expect(cycle.weather).toBe("niebla");
  });

  it("si sale el mismo clima no avisa, pero sigue contando", () => {
    const { cycle, changes, time } = setup(() => 0);
    cycle.start();
    time.advance(WEATHER.minMs * 5);
    expect(changes).toEqual(["despejado"]);
    expect(time.pending()).toBe(1);
  });

  it("forzar un clima lo pone ya y reinicia la cuenta", () => {
    const { cycle, changes, time } = setup(() => 0);
    cycle.start();
    time.advance(WEATHER.minMs - 1000);
    cycle.force("tormenta");
    expect(changes).toEqual(["despejado", "tormenta"]);
    // El sorteo viejo ya no corre: la tormenta dura su propio tiempo (la mitad del mínimo con azar 0).
    time.advance(1000);
    expect(cycle.weather).toBe("tormenta");
    time.advance(WEATHER.minMs / 2);
    expect(cycle.weather).toBe("nublado");
  });

  it("la niebla sigue la hora del juego (no la real) al volver a sortear", () => {
    // Con azar 0.75 desde despejado: a las 15:00 del juego sale nublado; a las 6:00, niebla.
    let hour = 15;
    const { cycle, changes, time } = setup(() => 0.75, "despejado", () => hour);
    cycle.start();
    time.advance(weatherDurationMs("despejado", () => 0.75));
    expect(cycle.weather).toBe("nublado");
    const again = setup(() => 0.75, "despejado", () => hour);
    hour = 6;
    again.cycle.start();
    again.time.advance(weatherDurationMs("despejado", () => 0.75));
    expect(again.cycle.weather).toBe("niebla");
    expect(changes).toEqual(["despejado", "nublado"]);
  });

  it("al cerrar la sala no queda nada pendiente", () => {
    const { cycle, time } = setup(() => 0);
    cycle.start();
    cycle.dispose();
    expect(time.pending()).toBe(0);
  });

  it("el comando /clima", () => {
    expect(parseDevWeather("/clima lluvia")).toBe("lluvia");
    expect(parseDevWeather("  /clima TORMENTA ")).toBe("tormenta");
    expect(parseDevWeather("/clima granizo")).toHaveProperty("error");
    expect(parseDevWeather("/clima")).toHaveProperty("error");
    expect(parseDevWeather("hola")).toBeNull();
    expect(parseDevWeather("/climas")).toBeNull();
  });
});
