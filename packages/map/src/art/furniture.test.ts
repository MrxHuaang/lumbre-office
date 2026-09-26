import { describe, expect, it } from "vitest";
import { CATALOG, catalogItem } from "../world/catalog";
import { drawFurniture, hasDrawing } from "./furniture";

const TYPES = Object.keys(CATALOG);

describe("arte de los muebles", () => {
  it("ningún mueble del catálogo usa la caja provisoria", () => {
    for (const type of TYPES) expect(hasDrawing(type), type).toBe(true);
  });

  it("cada mueble se dibuja (y de espaldas si el catálogo lo pide)", () => {
    for (const type of TYPES) {
      const variants = catalogItem(type).hasBack ? (["front", "back"] as const) : (["front"] as const);
      for (const v of variants) {
        const s = drawFurniture(type, v);
        let opaque = 0;
        for (let i = 3; i < s.canvas.data.length; i += 4) if (s.canvas.data[i]! > 0) opaque++;
        expect(opaque, `${type}:${v}`).toBeGreaterThan(40);
      }
    }
  });

  it("de espaldas se ve distinto que de frente", () => {
    for (const type of TYPES) {
      if (!catalogItem(type).hasBack) continue;
      const a = drawFurniture(type, "front").canvas.data;
      const b = drawFurniture(type, "back").canvas.data;
      expect(a.length === b.length && a.every((x, i) => x === b[i]), type).toBe(false);
    }
  });
});
