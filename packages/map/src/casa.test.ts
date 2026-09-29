import { CURTAIN_TYPE, USABLE_FURNITURE, WALL_BOARD_TYPE } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { curtainFeature, curtainsOf, getWorld, usablesOf } from "./index";
import { CATALOG } from "./world/catalog";

describe("casa viva", () => {
  const world = getWorld();

  it("cada mueble que se usa existe en el catálogo (salvo las cortinas y las pizarras, que están en las paredes)", () => {
    for (const type of Object.keys(USABLE_FURNITURE)) if (type !== CURTAIN_TYPE && type !== WALL_BOARD_TYPE) expect(type in CATALOG, type).toBe(true);
  });

  it("cada ventana tiene su cortina, sin dos en la misma esquina, y se encuentra su ventana", () => {
    for (const map of world.areas.values()) {
      const curtains = curtainsOf(map);
      const keys = curtains.map((c) => `${c.x},${c.y}`);
      expect(new Set(keys).size, map.id).toBe(keys.length);
      for (const c of curtains) expect(curtainFeature(map, c), `${map.id} ${c.x},${c.y}`).toBeDefined();
    }
    expect(curtainsOf(world.areas.get("planta-baja")!).length).toBeGreaterThan(3);
  });

  it("en todos los niveles hay cosas que se usan", () => {
    // El Megabús no es parte de la casa: adentro solo hay asientos y barras.
    for (const map of world.areas.values()) if (map.id !== "megabus") expect(usablesOf(map).length, map.id).toBeGreaterThan(5);
  });
});
