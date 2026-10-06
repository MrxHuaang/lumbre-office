import { describe, expect, it } from "vitest";
import { drawFurniture } from "./furniture";
import { gridSprite, rampLegend } from "./grilla";
import { C } from "./palette";

/** Lo del jardín que ya está dibujado a mano en grillas (VIR-177). */
const A_MANO = [
  "fence",
  "oak-1",
  "oak-2",
  "oak-3",
  "oak-big",
  "pine-1",
  "pine-2",
  "pine-3",
  "birch-1",
  "birch-2",
  "apple-tree",
  "peach-tree",
  "cherry-tree",
  "bush-round",
  "bush-berry",
  "bush-rose",
  "bush-hydrangea",
  "fern",
  "tall-grass",
  "wildflowers",
];

describe("grillas a mano", () => {
  it("una letra sin color es un error, no un píxel que se pierde callado", () => {
    expect(() => gridSprite(["0z"], rampLegend(C.leaf), 0, 0)).toThrow(/z/);
  });

  it("el espejo voltea la grilla y su origen", () => {
    const s = gridSprite(["01."], rampLegend(C.leaf), 1, 0, true);
    expect(s.ox).toBe(2);
    expect(s.canvas.data[3]).toBe(0);
    expect(s.canvas.data[2 * 4 + 3]).toBe(255);
  });

  it("cada pieza del jardín a mano tiene su pie dentro del dibujo y algo pintado junto a él", () => {
    for (const t of A_MANO) {
      const s = drawFurniture(t);
      const fx = s.ox;
      const fy = s.oy + 8;
      expect(fx, t).toBeGreaterThan(0);
      expect(fx, t).toBeLessThan(s.canvas.width);
      expect(fy, t).toBeLessThan(s.canvas.height);
      // A tres píxeles del pie hay dibujo (el tronco, la mata o la sombra): no quedó corrido de su tile.
      let near = 0;
      for (let y = fy - 3; y <= fy + 3; y++)
        for (let x = fx - 3; x <= fx + 3; x++) if (x >= 0 && y >= 0 && x < s.canvas.width && y < s.canvas.height && s.canvas.data[(y * s.canvas.width + x) * 4 + 3]) near++;
      expect(near, t).toBeGreaterThan(5);
    }
  });
});
