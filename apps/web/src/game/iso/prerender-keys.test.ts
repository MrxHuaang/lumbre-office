// El build pre-dibuja cada versión de los muebles con estas claves: si falta una que el juego pide, ese
// mueble se dibujaría en el navegador (más lento) sin que nadie lo note.
import { catalogItem, getWorld } from "@hyvento/map";
import { describe, expect, it } from "vitest";
import { allFurnitureVariants, areaDecorSignature, furnitureKey } from "./prerender-keys";

describe("arte pre-dibujado", () => {
  const keys = new Set(allFurnitureVariants().map((v) => furnitureKey(v.type, v.variant, v.night)));

  it("tiene cada mueble de cada nivel, de día y de noche, en la orientación que se usa", () => {
    for (const map of getWorld().areas.values())
      for (const f of map.furniture) {
        const item = catalogItem(f.type);
        const variant = (f.facing === "left" || f.facing === "up") && item.hasBack ? "back" : "front";
        for (const night of [false, true]) expect(keys.has(furnitureKey(f.type, variant, night)), `${map.id}: ${f.type}`).toBe(true);
      }
  });

  it("la firma de la decoración cambia con el piso de una sala", () => {
    const map = getWorld().areas.get("piso-2")!;
    const otro = { ...map, def: { ...map.def, rooms: map.def.rooms.map((r, i) => (i === 0 ? { ...r, floor: r.floor === "wood" ? "tile" : "wood" } : r)) } } as typeof map;
    expect(areaDecorSignature(otro)).not.toBe(areaDecorSignature(map));
  });
});
