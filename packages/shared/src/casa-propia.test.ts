import { describe, expect, it } from "vitest";
import { CASA_PROPIA, casaAreaOf, casaOwnerOf, casaPropiaBlock, isCasaArea, statAreaOf } from "./casa-propia";

describe("casa propia", () => {
  it("cada casa es un nivel `casa:<userId>` y se sabe de quién es", () => {
    const area = casaAreaOf("u-ana");
    expect(area).toBe("casa:u-ana");
    expect(isCasaArea(area)).toBe(true);
    expect(casaOwnerOf(area)).toBe("u-ana");
  });

  it("los niveles de la cabaña no son casas (tampoco la casa del árbol ni el prefijo solo)", () => {
    for (const area of ["jardin", "casa-arbol", "barrio", "casa:"]) {
      expect(isCasaArea(area)).toBe(false);
      expect(casaOwnerOf(area)).toBeNull();
    }
  });

  it("el destino de la puerta es una casa pero no tiene dueño", () => {
    expect(isCasaArea(CASA_PROPIA.own)).toBe(true);
    expect(casaOwnerOf(CASA_PROPIA.own)).toBeNull();
  });

  it("solo el dueño entra a su casa; a los demás niveles no les cambia nada", () => {
    expect(casaPropiaBlock(casaAreaOf("u-ana"), "u-ana")).toBeNull();
    expect(casaPropiaBlock(casaAreaOf("u-ana"), "u-beto")).toBe("ajena");
    expect(casaPropiaBlock("jardin", "u-beto")).toBeNull();
    expect(casaPropiaBlock(CASA_PROPIA.own, "u-beto")).toBeNull();
  });

  it("todas las casas cuentan como un solo nivel para los logros", () => {
    expect(statAreaOf(casaAreaOf("u-ana"))).toBe(CASA_PROPIA.statArea);
    expect(statAreaOf(casaAreaOf("u-beto"))).toBe(CASA_PROPIA.statArea);
    expect(statAreaOf("sotano")).toBe("sotano");
    // "casa" ya es de Casa viva (la cabaña): la clave es otra.
    expect(CASA_PROPIA.statArea).not.toBe("casa");
  });
});
