import { describe, expect, it } from "vitest";
import { BUS_STOPS, busStopName } from "./bus";

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
