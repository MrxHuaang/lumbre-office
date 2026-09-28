import { describe, expect, it } from "vitest";
import { rarityCounts, validFeaturedBadge } from "./insignias";
import { decayedLove, petFoodIn, PET_BOND } from "./mascotas";

describe("insignia destacada", () => {
  it("solo un logro del catálogo que la persona ya tiene", () => {
    expect(validFeaturedBadge("primera-picada", ["primera-picada"])).toBe("primera-picada");
    expect(validFeaturedBadge("primera-picada", new Set(["pianista"]))).toBe("");
    expect(validFeaturedBadge("inventado", ["inventado"])).toBe("");
    expect(validFeaturedBadge(null, ["primera-picada"])).toBe("");
  });

  it("cuenta los logros por rareza (lo desconocido no cuenta)", () => {
    expect(rarityCounts(["primera-picada", "pescador-legendario", "suertudo", "nada"])).toEqual({ comun: 1, raro: 0, epico: 1, legendario: 1 });
  });
});

describe("comida y cariño de las mascotas", () => {
  it("la comida de la mano: lo que se muerde o va con cuchara, no bebidas ni habanos", () => {
    expect(petFoodIn("pandebono")).toEqual({ part: 0, art: "pandebono" });
    expect(petFoodIn("onces")).toEqual({ part: 1, art: "pandebono" });
    expect(petFoodIn("onces", [3, 0])).toBeNull();
    expect(petFoodIn("tinto")).toBeNull();
    expect(petFoodIn("manzana")).toEqual({ part: 0, art: "manzana" });
    expect(petFoodIn("")).toBeNull();
  });

  it("el cariño baja de a poco y nunca de cero", () => {
    expect(decayedLove(50, 3_600_000)).toBe(50 - PET_BOND.decayPerHour);
    expect(decayedLove(1, 100 * 3_600_000)).toBe(0);
    expect(decayedLove(10, -5)).toBe(10);
  });
});
