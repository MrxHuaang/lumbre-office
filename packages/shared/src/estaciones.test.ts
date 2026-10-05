import { describe, expect, it } from "vitest";
import { CROPS, plantPlot, plotGrowth, plotReadyAt, reseasonPlot, waterPlot } from "./huerto";
import { SEASONS, bestSeasonOf, seasonGrowth, type Season } from "./estaciones";

const T = Date.UTC(2026, 8, 27, 15, 0);
const alice = { userId: "u-alice", name: "Alice" };

describe("estaciones", () => {

  it("cada cultivo tiene una temporada buena y el invernadero quita el castigo", () => {
    for (const c of CROPS) {
      const best = bestSeasonOf(c.id)!;
      expect(seasonGrowth(c.id, best), c.id).toBeGreaterThanOrEqual(1);
      for (const s of SEASONS) expect(seasonGrowth(c.id, s, { greenhouse: true }), `${c.id} ${s}`).toBeGreaterThanOrEqual(1);
    }
    expect(seasonGrowth("tomate", "invierno")).toBeLessThan(1);
    expect(seasonGrowth("tomate", "invierno", { greenhouse: true })).toBe(1);
    // Lo bueno de la temporada se queda bajo techo.
    expect(seasonGrowth("tomate", "verano", { greenhouse: true })).toBe(seasonGrowth("tomate", "verano"));
    // Un cultivo que no está en la tabla crece igual todo el año.
    expect(seasonGrowth("desconocido", "invierno")).toBe(1);
  });

  it("el huerto crece más rápido en temporada y más despacio fuera de ella", () => {
    const readyIn = (season: Season, greenhouse = false) => {
      const p = waterPlot({ ...plantPlot("tomate", alice, T, season), greenhouse }, T);
      return plotReadyAt(p) - T;
    };
    expect(readyIn("verano")).toBeLessThan(readyIn("invierno"));
    expect(readyIn("invierno", true)).toBeLessThan(readyIn("invierno"));
  });

  it("lo del invernadero no sufre el invierno (se sabe por el cultivo) y el verano le ayuda", () => {
    const uchuva = CROPS.find((c) => c.id === "uchuva")!;
    const inBed = (season: Season) => plotReadyAt(plantPlot("uchuva", alice, T, season)) - T;
    expect(seasonGrowth("uchuva", "invierno")).toBeLessThan(1);
    expect(inBed("invierno")).toBe(uchuva.growMs);
    expect(inBed("verano")).toBeLessThan(uchuva.growMs);
  });

  it("al cambiar de estación lo crecido se guarda y sigue con el ritmo nuevo (sin saltar para atrás)", () => {
    const p = waterPlot(plantPlot("tomate", alice, T, "verano"), T);
    const mid = T + 10 * 60_000;
    const grown = plotGrowth(p, mid);
    const winter = reseasonPlot(p, mid, "invierno")!;
    expect(winter.season).toBe("invierno");
    expect(plotGrowth(winter, mid)).toBeCloseTo(grown);
    expect(plotGrowth(winter, mid + 60_000) - grown).toBeCloseTo(60_000 * seasonGrowth("tomate", "invierno"));
    // La misma estación, o lo que ya está listo, no cambia.
    expect(reseasonPlot(p, mid, "verano")).toBeNull();
    expect(reseasonPlot(p, plotReadyAt(p), "invierno")).toBeNull();
  });

  it("sin estación (una parcela de antes) crece a ritmo 1", () => {
    const uchuva = CROPS.find((c) => c.id === "uchuva")!;
    expect(plotReadyAt(plantPlot("uchuva", alice, T)) - T).toBe(uchuva.growMs);
    expect(plotReadyAt(plantPlot("uchuva", alice, T, "verano")) - T).toBeLessThan(uchuva.growMs);
  });
});
