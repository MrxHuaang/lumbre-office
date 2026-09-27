import { describe, expect, it } from "vitest";
import { getWorld, isBlockedTile, planDef, pointsOfType, setWorldEdits } from "./index";
import { checkWorldEdit, EMPTY_EDITS, parseWorldEdits, worldFurniture, type WorldEdits } from "./worldEdits";

const def = planDef("planta-baja")!;
const map = getWorld().areas.get("planta-baja")!;

/** Un tile libre del recibidor (sin mueble, portal ni punto) para poner cosas. */
function freeTile(): { x: number; y: number } {
  const points = new Set(map.points.map((p) => `${p.tileX},${p.tileY}`));
  const room = def.rooms.find((r) => r.id === "recibidor")!.rect;
  for (let y = room.y + 1; y < room.y + room.h - 1; y++)
    for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
      if (isBlockedTile(map, x, y) || points.has(`${x},${y}`)) continue;
      if (map.portals.some((p) => p.tiles.some((t) => t.x === x && t.y === y))) continue;
      if (map.furniture.some((f) => x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.d)) continue;
      return { x, y };
    }
  throw new Error("sin tile libre");
}

describe("editor de la casa", () => {
  it("poner, mover y quitar un mueble nuevo", () => {
    const t = freeTile();
    const put = checkWorldEdit(def, EMPTY_EDITS, { action: "place", type: "plant", x: t.x, y: t.y, facing: "right" }, [], "a1");
    expect(put.ok).toBe(true);
    if (!put.ok) return;
    expect(put.edits.added).toEqual([{ id: "a1", type: "plant", x: t.x, y: t.y, facing: "right" }]);
    const moved = checkWorldEdit(def, put.edits, { action: "move", key: "nuevo:a1", x: t.x, y: t.y, facing: "down" });
    expect(moved.ok && moved.edits.added[0]).toMatchObject({ id: "a1", facing: "down" });
    const gone = checkWorldEdit(def, put.edits, { action: "remove", key: "nuevo:a1" });
    expect(gone.ok && gone.edits).toEqual(EMPTY_EDITS);
  });

  it("quitar un mueble del plano lo anota y deja de estar en el nivel", () => {
    const plant = worldFurniture(def).find((f) => f.type === "plant")!;
    const r = checkWorldEdit(def, EMPTY_EDITS, { action: "remove", key: plant.key });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.edits.removed).toEqual([plant.key]);
    expect(worldFurniture(def, r.edits).some((f) => f.key === plant.key)).toBe(false);
  });

  it("no deja encimar, tapar portales o puntos, poner en una oficina ni mover las escaleras", () => {
    const sofa = map.furniture.find((f) => f.type !== "stairs-up" && f.type !== "stairwell" && !f.type.startsWith("rug"))!;
    expect(checkWorldEdit(def, EMPTY_EDITS, { action: "place", type: "plant", x: sofa.x, y: sofa.y, facing: "right" })).toEqual({ ok: false, error: "blocked" });
    const portal = map.portals[0]!.tiles[0]!;
    expect(checkWorldEdit(def, EMPTY_EDITS, { action: "place", type: "plant", x: portal.x, y: portal.y, facing: "right" })).toEqual({ ok: false, error: "portal" });
    const counter = pointsOfType(map, "cafe_counter")[0]!;
    expect(checkWorldEdit(def, EMPTY_EDITS, { action: "place", type: "plant", x: counter.tileX, y: counter.tileY, facing: "right" })).toEqual({ ok: false, error: "point" });
    const stairs = worldFurniture(def).find((f) => f.fixed)!;
    expect(checkWorldEdit(def, EMPTY_EDITS, { action: "remove", key: stairs.key })).toEqual({ ok: false, error: "fixed" });
    const piso2 = planDef("piso-2")!;
    const office = getWorld().areas.get("piso-2")!.zones.find((z) => z.type === "office")!;
    const ox = office.x / 32 + 2;
    const oy = office.y / 32 + 4;
    const r = checkWorldEdit(piso2, EMPTY_EDITS, { action: "place", type: "rug-round", x: ox, y: oy, facing: "right" });
    expect(r).toEqual({ ok: false, error: "office" });
    expect(checkWorldEdit(def, EMPTY_EDITS, { action: "place", type: "plant", x: -3, y: 2, facing: "right" })).toEqual({ ok: false, error: "outside" });
  });

  it("setWorldEdits cambia el nivel del mundo y parseWorldEdits descarta lo que viene mal", () => {
    const t = freeTile();
    const edits: WorldEdits = { removed: [], added: [{ id: "z", type: "plant", x: t.x, y: t.y, facing: "right" }] };
    const m = setWorldEdits("planta-baja", edits)!;
    expect(isBlockedTile(m, t.x, t.y)).toBe(true);
    setWorldEdits("planta-baja", EMPTY_EDITS);
    expect(isBlockedTile(getWorld().areas.get("planta-baja")!, t.x, t.y)).toBe(false);
    expect(parseWorldEdits({ removed: ["a", 3], added: [{ id: "x", type: "plant", x: 1, y: 2, facing: "arriba" }, { id: "y", type: "plant", x: 1, y: 2, facing: "up" }] })).toEqual({
      removed: ["a"],
      added: [{ id: "y", type: "plant", x: 1, y: 2, facing: "up" }],
    });
  });

  it("los muebles funcionales no se tocan, y un cambio viejo sobre ellos se ignora", () => {
    const sotano = planDef("sotano")!;
    const table = worldFurniture(sotano).find((f) => f.type === "blackjack-table")!;
    expect(table.fixed).toBe(true);
    expect(checkWorldEdit(sotano, EMPTY_EDITS, { action: "remove", key: table.key })).toEqual({ ok: false, error: "fixed" });
    // Guardado antes del bloqueo: la mesa quitada vuelve y la agregada no aparece.
    const old: WorldEdits = { removed: [table.key], added: [{ id: "m", type: "blackjack-table", x: 2, y: 2, facing: "right" }] };
    const list = worldFurniture(sotano, old);
    expect(list.some((f) => f.key === table.key)).toBe(true);
    expect(list.some((f) => f.key === "nuevo:m")).toBe(false);
  });
});
