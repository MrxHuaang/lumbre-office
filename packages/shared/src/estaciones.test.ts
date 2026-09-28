import { describe, expect, it } from "vitest";
import { CROPS, plantPlot, plotReadyAt, waterPlot } from "./huerto";
import { SEASONS, bestSeasonOf, bogotaMonth, seasonGrowth, seasonOf } from "./estaciones";

const at = (y: number, m: number, d: number, h = 15) => Date.UTC(y, m, d, h, 0);
const alice = { userId: "u-alice", name: "Alice" };

describe("estaciones", () => {
  it("el mes es el de Bogotá (UTC-5)", () => {
    expect(bogotaMonth(at(2026, 8, 27))).toBe(8);
    // 1 de diciembre a las 3:00 UTC todavía es 30 de noviembre en Bogotá.
    expect(bogotaMonth(Date.UTC(2026, 11, 1, 3, 0))).toBe(10);
    expect(bogotaMonth(Date.UTC(2026, 11, 1, 6, 0))).toBe(11);
  });

  it("cada mes cae en su estación", () => {
    const expected = ["invierno", "invierno", "primavera", "primavera", "primavera", "verano", "verano", "verano", "otono", "otono", "otono", "invierno"];
    for (let m = 0; m < 12; m++) expect(seasonOf(at(2026, m, 15)), `mes ${m}`).toBe(expected[m]);
    // El cambio es a la medianoche de Bogotá.
    expect(seasonOf(Date.UTC(2026, 11, 1, 4, 59))).toBe("otono");
    expect(seasonOf(Date.UTC(2026, 11, 1, 5, 0))).toBe("invierno");
  });

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
    const summer = at(2026, 6, 10);
    const winter = at(2026, 0, 10);
    const readyIn = (t: number, greenhouse = false) => {
      const p = waterPlot({ ...plantPlot("tomate", alice, t), greenhouse }, t);
      return plotReadyAt(p) - t;
    };
    expect(readyIn(summer)).toBeLessThan(readyIn(winter));
    expect(readyIn(winter, true)).toBeLessThan(readyIn(winter));
  });
});
