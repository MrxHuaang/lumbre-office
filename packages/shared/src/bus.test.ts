import { describe, expect, it } from "vitest";
import { BUS_STOPS, BUS_TIMINGS, busEtaMs, busOffset, busStopName } from "./bus";

describe("paradas del Megabús", () => {
  it("cada parada tiene el nombre de la pantallita", () => {
    expect(busStopName("estacion")).toBe("Estación Hyvento");
    expect(busStopName("casa")).toBe("Casa");
  });

  it("no hay dos paradas con el mismo nombre", () => {
    const names = BUS_STOPS.map(busStopName);
    expect(new Set(names).size).toBe(BUS_STOPS.length);
  });
});

describe("la ruta vista desde la calle de una parada", () => {
  const t = BUS_TIMINGS;
  const off = (elapsed: number, from: "estacion" | "casa", to: "estacion" | "casa") => busOffset("route", elapsed, t, 40, 60, { from, to, at: "estacion" });

  it("a la casa: sale de la estación y no vuelve a aparecer", () => {
    expect(off(t.departMs / 2, "estacion", "casa")).toBeGreaterThan(0);
    expect(off(t.tripMs - 100, "estacion", "casa")).toBeNull();
  });

  it("de la casa: no sale de la estación, pero al final llega frenando", () => {
    expect(off(t.departMs / 2, "casa", "estacion")).toBeNull();
    expect(off(t.tripMs - 100, "casa", "estacion")!).toBeLessThan(0);
  });

  it("la pantalla de la estación no espera de vuelta un bus que se fue a la casa", () => {
    const now = 10_000;
    expect(busEtaMs("route", now - 1000, now + 120_000, now, t, "casa")).toBe(120_000 + t.approachMs);
    expect(busEtaMs("route", now - 1000, now + 120_000, now, t, "estacion")).toBe(t.tripMs - 1000);
  });
});

