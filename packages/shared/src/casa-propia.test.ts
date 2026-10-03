import { describe, expect, it } from "vitest";
import { casaAreaOf, casaOwnerOf, casaPropiaBlock, isCasaArea, parseCasaArea, statAreaOf } from "./casa-propia";

describe("casa de cada persona", () => {
  it("arma y lee el area de cada piso", () => {
    expect(casaAreaOf("u1")).toBe("casa:u1");
    expect(casaAreaOf("u1", "abajo")).toBe("casa:u1:abajo");
    expect(casaAreaOf("u1", "arriba")).toBe("casa:u1:arriba");
    expect(parseCasaArea("casa:u1")).toEqual({ owner: "u1", piso: "afuera" });
    expect(parseCasaArea("casa:u1:abajo")).toEqual({ owner: "u1", piso: "abajo" });
    expect(parseCasaArea("casa:u1:arriba")).toEqual({ owner: "u1", piso: "arriba" });
  });

  it("no confunde otros niveles con una casa", () => {
    for (const area of ["jardin", "casa-arbol", "casa:", "casa:u1:sotano", "casa:u1:abajo:x", "planta-baja"]) {
      expect(isCasaArea(area)).toBe(false);
      expect(casaOwnerOf(area)).toBeNull();
    }
  });

  it("solo el dueño entra, a cualquier piso", () => {
    for (const piso of ["afuera", "abajo", "arriba"] as const) {
      expect(casaPropiaBlock(casaAreaOf("u1", piso), "u1")).toBeNull();
      expect(casaPropiaBlock(casaAreaOf("u1", piso), "u2")).toBe("ajena");
    }
    // Lo que no es una casa no lo frena esta regla.
    expect(casaPropiaBlock("jardin", "u2")).toBeNull();
  });

  it("todas las casas cuentan como un solo lugar", () => {
    expect(statAreaOf("casa:u1")).toBe("casa-propia");
    expect(statAreaOf("casa:u2:arriba")).toBe("casa-propia");
    expect(statAreaOf("jardin")).toBe("jardin");
  });
});
