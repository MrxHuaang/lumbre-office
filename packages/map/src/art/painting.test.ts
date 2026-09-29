import { BLANK_PAINTING, PAINTING_PALETTE, paintingItemId } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { isPlaceable } from "../decor";
import { catalogItem } from "../world/catalog";
import { drawFurniture, hasDrawing } from "./furniture";
import { hex } from "./pixel";
import { paintingSprite } from "./painting";

const item = paintingItemId("clx0cuadro0001");

describe("cuadros de la Pintura", () => {
  it("cuadro:<id> es el mueble cuadro del catálogo (se pone con el editor de oficina)", () => {
    expect(catalogItem(item)).toBe(catalogItem("cuadro"));
    expect(isPlaceable(item)).toBe(true);
    expect(isPlaceable("cuadro:../x")).toBe(false);
    expect(hasDrawing(item)).toBe(true);
    expect(drawFurniture(item)).toBe(drawFurniture("cuadro"));
  });

  it("la capa con los píxeles mide lo mismo que el marco y tiene el mismo origen", () => {
    const frame = drawFurniture("cuadro");
    for (const s of [paintingSprite(BLANK_PAINTING), paintingSprite("7".repeat(256), true)]) {
      expect([s.canvas.width, s.canvas.height, s.ox, s.oy]).toEqual([frame.canvas.width, frame.canvas.height, frame.ox, frame.oy]);
    }
  });

  it("pinta el lienzo con los colores de la paleta", () => {
    const red = hex(PAINTING_PALETTE[7]);
    const has = (pixels: string) => {
      const d = paintingSprite(pixels).canvas.data;
      for (let i = 0; i < d.length; i += 4) if (d[i] === red[0] && d[i + 1] === red[1] && d[i + 2] === red[2]) return true;
      return false;
    };
    expect(has("7".repeat(256))).toBe(true);
    expect(has(BLANK_PAINTING)).toBe(false);
  });
});
