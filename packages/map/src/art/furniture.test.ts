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
      const item = catalogItem(type);
      const variants = item.hasBack ? (["front", "back"] as const) : (["front"] as const);
      for (const v of variants) {
        const s = drawFurniture(type, v);
        // Solo cuenta el cuerpo: la sombra (alfa 0.22–0.35) nunca llega a 200 y el contorno sí, así
        // un dibujo que fuera solo sombra no pasa.
        let opaque = 0;
        for (let i = 3; i < s.canvas.data.length; i += 4) if (s.canvas.data[i]! >= 200) opaque++;
        expect(opaque, `${type}:${v}`).toBeGreaterThan(100 * item.size[0] * item.size[1]);
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
