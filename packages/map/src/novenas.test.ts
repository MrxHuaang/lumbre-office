import { NOVENA } from "@hyvento/shared";
import { afterEach, describe, expect, it } from "vitest";
import { eventOverlays } from "./art/eventos";
import { drawFurniture } from "./art/furniture";
import { pesebreSprite } from "./art/novenas";
import { findPath, getWorld, isBlockedTile, NOVENAS_PIEZAS, planDef, setFestivalDecor } from "./index";
import { buildArea } from "./world/build";
import { catalogItem } from "./world/catalog";
import { buildEditedArea, checkWorldEdit, EMPTY_EDITS, type WorldEdits } from "./worldEdits";

const pixels = (n: number) => Array.from(pesebreSprite(n).canvas.data).join(",");

describe("las novenas en el mundo", () => {
  it("el pesebre crece con cada figura y está en un rincón libre del recibidor", () => {
    for (let n = 1; n <= 9; n++) expect(pixels(n), `figura ${n}`).not.toBe(pixels(n - 1));
    const map = buildArea(planDef(NOVENA.area)!);
    const { x, y, w, d } = NOVENA.pesebre;
    for (let tx = x; tx < x + w; tx++)
      for (let ty = y; ty < y + d; ty++) {
        expect(isBlockedTile(map, tx, ty), `${tx},${ty}`).toBe(false);
        expect(map.portals.some((p) => p.tiles.some((t) => t.x === tx && t.y === ty))).toBe(false);
      }
    expect(map.zones.find((z) => z.id === "recibidor")).toBeDefined();
  });

  it("el pesebre sale como capa solo con la novena", () => {
    expect(eventOverlays(NOVENA.area, { birthday: false, karaoke: false }).length).toBe(0);
    expect(eventOverlays(NOVENA.area, { birthday: false, karaoke: false, pesebre: 3 }).map((o) => o.key)).toEqual(["novena-pesebre-3"]);
    expect(eventOverlays("jardin", { birthday: false, karaoke: false, pesebre: 3 })).toEqual([]);
  });

  it("la decoración navideña tiene su dibujo y no estorba: no tapa nada ni corta el paso", () => {
    for (const area of new Set(NOVENAS_PIEZAS.map((d) => d.area))) {
      const def = planDef(area)!;
      let edits: WorldEdits = EMPTY_EDITS;
      for (const item of NOVENAS_PIEZAS.filter((d) => d.area === area)) {
        expect(catalogItem(item.type)).toBeDefined();
        expect(drawFurniture(item.type).canvas.width).toBeGreaterThan(0);
        const r = checkWorldEdit(def, edits, { action: "place", type: item.type, x: item.x, y: item.y, facing: item.facing });
        expect(r.ok, `${item.type} en ${area} ${item.x},${item.y}: ${r.ok ? "" : r.error}`).toBe(true);
        if (r.ok) edits = r.edits;
      }
      // Todo lo que se alcanzaba desde la entrada se sigue alcanzando (portales y puntos de interacción).
      const before = buildArea(def);
      const after = buildEditedArea(def, edits);
      const from = before.portals[0]!.tiles[0]!;
      const targets = [...before.portals.flatMap((p) => p.tiles), ...before.points.map((p) => ({ x: Math.floor(p.x / before.tileSize), y: Math.floor(p.y / before.tileSize) }))];
      for (const t of targets) if (findPath(before, from, t)) expect(findPath(after, from, t), `${area} ${t.x},${t.y}`).not.toBeNull();
    }
  });

  it("la decoración se pone con la de los festivales mientras corren las novenas, y se quita", () => {
    expect(setFestivalDecor("novenas", 300).sort()).toEqual(["jardin", "planta-baja"]);
    for (const p of NOVENAS_PIEZAS) {
      const map = getWorld().areas.get(p.area)!;
      expect(map.furniture.some((f) => f.type === p.type && f.x === p.x && f.y === p.y), `${p.type} ${p.x},${p.y}`).toBe(true);
    }
    setFestivalDecor(null);
    expect(getWorld().areas.get("planta-baja")!.furniture.some((f) => f.type === "arbol-navidad")).toBe(false);
  });
});

afterEach(() => {
  setFestivalDecor(null);
});
