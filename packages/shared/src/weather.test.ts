import { describe, expect, it } from "vitest";
import { bogotaHour } from "./fishing";
import {
  WEATHER,
  WEATHERS,
  initialWeather,
  isFogHour,
  isWeather,
  isWet,
  nextWeather,
  transitionWeights,
  weatherDurationMs,
  type Weather,
} from "./weather";

/** Azar fijo con una secuencia (se repite al acabarse). */
const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length]!;
};

/** Generador determinista simple (LCG) para los muestreos. */
function lcg(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

// Horas del reloj del juego.
const MORNING = 7;
const AFTERNOON = 15;

describe("clima", () => {
  it("la hora de Bogotá es UTC-5 y la niebla va con la hora del juego", () => {
    expect(bogotaHour(Date.UTC(2026, 8, 27, 12, 0))).toBe(7);
    expect(bogotaHour(Date.UTC(2026, 8, 27, 2, 30))).toBe(21); // 2:30 UTC = 21:30 del día anterior
    expect(isFogHour(MORNING)).toBe(true);
    expect(isFogHour(AFTERNOON)).toBe(false);
    expect(isFogHour(6)).toBe(true);
    expect(isFogHour(12)).toBe(false);
  });

  it("reconoce los climas", () => {
    for (const w of WEATHERS) expect(isWeather(w)).toBe(true);
    expect(isWeather("granizo")).toBe(false);
    expect(isWeather(3)).toBe(false);
    expect(isWet("lluvia")).toBe(true);
    expect(isWet("tormenta")).toBe(true);
    expect(isWet("niebla")).toBe(false);
  });

  it("el azar decide en orden de los pesos", () => {
    // 0 → el primero con peso (despejado), casi 1 → el último con peso.
    expect(nextWeather("despejado", 12, () => 0)).toBe("despejado");
    expect(nextWeather("despejado", 12, () => 0.999999)).toBe("niebla");
    // Desde la tormenta nunca se aclara de golpe ni sale niebla.
    expect(nextWeather("tormenta", 6, () => 0)).toBe("nublado");
    expect(nextWeather("tormenta", 6, () => 0.999999)).toBe("tormenta");
  });

  it("de despejado nunca salta a tormenta", () => {
    const r = lcg(7);
    for (let i = 0; i < 2000; i++) expect(nextWeather("despejado", 12, r)).not.toBe("tormenta");
  });

  it("la niebla es más probable temprano en la mañana", () => {
    expect(transitionWeights("despejado", 6).niebla).toBeGreaterThan(transitionWeights("despejado", 15).niebla);
    const count = (hour: number) => {
      const r = lcg(3);
      let fog = 0;
      for (let i = 0; i < 4000; i++) if (nextWeather("despejado", hour, r) === "niebla") fog++;
      return fog;
    };
    expect(count(6)).toBeGreaterThan(count(15) * 4);
  });

  it("la cadena pasa por todos los climas (la nieve, en invierno)", () => {
    const r = lcg(11);
    const seen = new Set<Weather>();
    let w: Weather = "despejado";
    for (let i = 0; i < 500; i++) {
      w = nextWeather(w, i % 24, r, "invierno");
      seen.add(w);
    }
    expect(seen.size).toBe(WEATHERS.length);
  });

  it("solo nieva en invierno, y si deja de ser invierno la nieve se va", () => {
    const r = lcg(5);
    for (const season of ["primavera", "verano", "otono"] as const) {
      for (let i = 0; i < 1500; i++) expect(nextWeather("nublado", 14, r, season)).not.toBe("nieve");
      expect(nextWeather("nieve", 14, () => 0.999999, season)).not.toBe("nieve");
    }
    expect(transitionWeights("nublado", 14, "invierno").nieve).toBeGreaterThan(0);
    // Sin estación (como antes), tampoco.
    expect(transitionWeights("nublado", 14).nieve).toBe(0);
    expect(isWet("nieve")).toBe(false);
  });

  it("en otoño llueve más que en verano", () => {
    const rainy = (season: "verano" | "otono") => {
      const r = lcg(9);
      let n = 0;
      for (let i = 0; i < 4000; i++) if (isWet(nextWeather("nublado", 14, r, season))) n++;
      return n;
    };
    expect(rainy("otono")).toBeGreaterThan(rainy("verano") * 1.3);
  });

  it("cada clima dura entre 10 y 25 minutos (la tormenta la mitad)", () => {
    expect(weatherDurationMs("despejado", () => 0)).toBe(WEATHER.minMs);
    expect(weatherDurationMs("lluvia", seq(0.999999))).toBeLessThanOrEqual(WEATHER.maxMs);
    expect(weatherDurationMs("tormenta", () => 0)).toBe(WEATHER.minMs / 2);
  });

  it("arranca con niebla de mañana", () => {
    expect(initialWeather(MORNING)).toBe("niebla");
    expect(initialWeather(AFTERNOON)).toBe(WEATHER.initial);
  });
});
