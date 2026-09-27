import { describe, expect, it } from "vitest";
import { getWorld, stepSurface, surfaceAt, type OfficeMap } from "./index";

const area = (id: string) => getWorld().areas.get(id) as OfficeMap;

describe("pasos según el piso", () => {
  it("afuera suena a pasto o tierra, adentro a madera, piedra o alfombra", () => {
    expect(stepSurface("grass")).toBe("grass");
    expect(stepSurface("path")).toBe("dirt");
    expect(stepSurface("parquet")).toBe("wood");
    expect(stepSurface("marble")).toBe("stone");
    expect(stepSurface("carpet")).toBe("soft");
    expect(stepSurface(null)).toBe("wood");
  });

  it("en el jardín casi todo lo que se camina es pasto o tierra", () => {
    const map = area("jardin");
    const counts: Record<string, number> = {};
    for (let ty = 0; ty < map.height; ty++)
      for (let tx = 0; tx < map.width; tx++) {
        const s = surfaceAt(map, (tx + 0.5) * map.tileSize, (ty + 0.5) * map.tileSize);
        counts[s] = (counts[s] ?? 0) + 1;
      }
    const outside = (counts.grass ?? 0) + (counts.dirt ?? 0);
    expect(outside / (map.width * map.height)).toBeGreaterThan(0.7);
  });

  it("adentro no hay pasto y fuera del nivel no se rompe", () => {
    const map = area("planta-baja");
    for (let ty = 0; ty < map.height; ty++)
      for (let tx = 0; tx < map.width; tx++) expect(surfaceAt(map, (tx + 0.5) * map.tileSize, (ty + 0.5) * map.tileSize)).not.toBe("grass");
    expect(surfaceAt(map, -50, -50)).toBe("wood");
  });
});
