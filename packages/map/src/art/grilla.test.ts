import { describe, expect, it } from "vitest";
import { drawFurniture } from "./furniture";
import { gridSprite, rampLegend } from "./grilla";
import { C } from "./palette";
import { catalogItem } from "../world/catalog";

/** Lo que ya está dibujado a mano en grillas (VIR-177). */
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
  // Tanda 2: lo que quedaba del jardín y los muebles comunes de las salas.
  "mushrooms",
  "rock-small",
  "rock-medium",
  "rock-mossy",
  "flat-rock",
  "stump",
  "lily-pad",
  "stick-fence",
  "lamp-post",
  "garden-lantern",
  "dock-lamp",
  "chair",
  "stool",
  "armchair",
  "beanbag",
  "counter",
  "counter-coffee",
  "bar-counter",
  "speaker",
  "projector",
  // Tanda 3: las mesitas y las lámparas de las salas.
  "side-table",
  "coffee-table",
  "cafe-table",
  "lamp",
  "lamp-mushroom",
];

describe("grillas a mano", () => {
  it("la luz de noche de los faroles cae sobre su vidrio", () => {
    for (const t of ["lamp-post", "garden-lantern", "dock-lamp", "lamp", "lamp-mushroom"]) {
      const s = drawFurniture(t);
      const [x, y, z] = catalogItem(t).light!.at;
      const px = Math.round(s.ox + x - y);
      const py = Math.round(s.oy + (x + y) / 2 - z);
      // A dos píxeles del foco hay dibujo (el farol), no aire.
      let hit = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) if (s.canvas.data[((py + dy) * s.canvas.width + px + dx) * 4 + 3]) hit++;
      expect(hit, t).toBeGreaterThan(8);
    }
  });

  it("una letra sin color es un error, no un píxel que se pierde callado", () => {
    expect(() => gridSprite(["0z"], rampLegend(C.leaf), 0, 0)).toThrow(/z/);
  });

  it("el espejo voltea la grilla y su origen", () => {
    const s = gridSprite(["01."], rampLegend(C.leaf), 1, 0, true);
    expect(s.ox).toBe(2);
    expect(s.canvas.data[3]).toBe(0);
    expect(s.canvas.data[2 * 4 + 3]).toBe(255);
  });

  it("cada pieza a mano tiene su pie dentro del dibujo y algo pintado junto a él", () => {
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
      expect(near, t).toBeGreaterThan(3);
    }
  });
});
