import type { OfficeItemDTO } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import {
  applyDecorEdit,
  decorateArea,
  decorateAreaDef,
  defaultOfficeItems,
  feetTiles,
  getWorld,
  isBlockedTile,
  officeFurniture,
  type AreaDecor,
  type DecorEdit,
  type Facing,
  type OfficeMap,
} from "./index";

const piso2 = getWorld().areas.get("piso-2")!;
const def = piso2.def;
const c = (t: number) => t * 32 + 16;

/** Lo que importa de un nivel para comparar dos versiones. */
const snapshot = (m: OfficeMap) => ({
  blocked: [...m.blocked],
  wallH: [...m.wallH],
  wallV: [...m.wallV],
  floors: m.floors,
  furniture: m.furniture,
  seats: [...m.seats.entries()],
  rooms: m.def.rooms,
});

// Oficina 2 (x 11..18, y 0..8; puerta afuera en (10, 6), adentro (11, 6)). Muebles del mapa en orden:
// map-0 planta (11,0) · map-1 estantería (12,0) · fijo-0 escritorio con PC (16,0) · fijo-1 silla (16,1) ·
// map-2 planta (18,0) · map-3 alfombra (14,3) · map-4 sillón (14,4) · map-5 mesa (15,4) · map-6 sofá (17,3) ·
// map-7 lámpara (18,8) · map-8 planta (11,8).
const edit = (e: DecorEdit, decor: AreaDecor = {}, people: { x: number; y: number }[] = []) =>
  applyDecorEdit({ def, decor, zoneId: "office-2", people }, e);
const place = (type: string, x: number, y: number, facing: Facing = "right"): DecorEdit =>
  ({ action: "place", type, x, y, facing });

/** Aplica varios cambios seguidos (cada uno sobre el anterior) y devuelve la decoración final. */
function applyAll(edits: DecorEdit[]): AreaDecor {
  let decor: AreaDecor = {};
  edits.forEach((e, i) => {
    const r = applyDecorEdit({ def, decor, zoneId: "office-2" }, e, `n${i}`);
    if (!r.ok) throw new Error(`cambio ${i}: ${r.error}`);
    decor = { "office-2": { items: r.items } };
  });
  return decor;
}

describe("nivel decorado", () => {
  it("sin decoración (u oficinas sin decorar) el piso 2 queda idéntico", () => {
    expect(decorateAreaDef(def, {})).toBe(def);
    expect(snapshot(decorateArea(def, {}))).toEqual(snapshot(piso2));
    expect(snapshot(decorateArea(def, { "office-2": { items: null }, "office-4": { items: null } }))).toEqual(snapshot(piso2));
  });

  it("el escritorio con PC y su silla son fijos; el resto del mapa se puede mover", () => {
    const all = officeFurniture(def, "office-2");
    expect(all.filter((f) => f.fixed).map((f) => [f.id, f.type, f.x, f.y])).toEqual([
      ["fijo-0", "desk-pc", 16, 0],
      ["fijo-1", "chair", 16, 1],
    ]);
    const defaults = defaultOfficeItems(def, "office-2");
    expect(defaults).toHaveLength(9);
    expect(defaults.map((f) => f.id)).toEqual(Array.from({ length: 9 }, (_, i) => `map-${i}`));
    expect(defaults.some((f) => f.type === "desk-pc")).toBe(false);
  });

  it("una oficina decorada lleva solo sus muebles (y los fijos); las demás no cambian", () => {
    // Lo guardado va relativo a la oficina: la 2 empieza en (11, 0), así que (2, 6) es el tile (13, 6).
    const map = decorateArea(def, { "office-2": { items: [{ id: "a", type: "plant", x: 2, y: 6, facing: "right" }] } });
    const inOffice2 = map.furniture.filter((f) => f.x >= 11 && f.y < 9);
    expect(inOffice2.map((f) => f.type).sort()).toEqual(["chair", "desk-pc", "plant"]);
    expect(isBlockedTile(map, 13, 6)).toBe(true);
    expect(isBlockedTile(map, 12, 0)).toBe(false); // la estantería del mapa ya no está
    expect([...map.seats.values()].filter((s) => s.computer && s.tileX >= 11 && s.tileY < 9)).toHaveLength(1);
    const others = (m: OfficeMap) => m.furniture.filter((f) => !(f.x >= 11 && f.y < 9));
    expect(others(map)).toEqual(others(piso2));
  });

  it("piso y papel tapiz cambian solo en esa oficina, y se ignoran los que no existen", () => {
    const map = decorateArea(def, { "office-2": { items: null, floor: "wood", wallpaper: "rose" } });
    expect(map.floors[4 * map.width + 13]).toBe("wood");
    expect(map.floors[4 * map.width + 3]).toBe("carpet"); // oficina 1
    expect(map.def.rooms.find((r) => r.id === "office-2")).toMatchObject({ floor: "wood", wallpaper: "rose" });
    expect(map.def.rooms.find((r) => r.id === "office-1")?.wallpaper).toBe("cream");
    const bad = decorateArea(def, { "office-2": { items: null, floor: "grass", wallpaper: "neon" } });
    expect(bad.def.rooms.find((r) => r.id === "office-2")).toMatchObject({ floor: "carpet", wallpaper: "blue" });
  });

  it("los muebles guardados que ya no valen se ignoran en vez de romper el nivel", () => {
    const junk: OfficeItemDTO[] = [
      { id: "1", type: "nave-espacial", x: 13, y: 4, facing: "right" },
      { id: "2", type: "plant", x: 3, y: 4, facing: "right" }, // en otra oficina
      { id: "3", type: "stairs-up", x: 12, y: 4, facing: "right" },
    ];
    const map = decorateArea(def, { "office-2": { items: junk } });
    expect(isBlockedTile(map, 13, 4)).toBe(false);
    expect(isBlockedTile(map, 3, 4)).toBe(false);
  });
});

describe("validar cambios", () => {
  it("poner un mueble en un lugar libre", () => {
    const r = edit(place("plant", 13, 6));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.items).toHaveLength(10);
    // Se guarda relativo a la oficina (empieza en x = 11).
    expect(r.items.at(-1)).toEqual({ id: "nuevo", type: "plant", x: 2, y: 6, facing: "right" });
  });

  it("fuera de la oficina no", () => {
    expect(edit(place("plant", 10, 6))).toEqual({ ok: false, error: "outside" });
    expect(edit(place("sofa", 13, 8, "right"))).toEqual({ ok: false, error: "outside" }); // 1x2: se sale por abajo
    expect(edit(place("sofa", 13, 7, "right")).ok).toBe(true);
  });

  it("encima de otro mueble no, pero una alfombra sí va debajo (y no sobre otra alfombra)", () => {
    expect(edit(place("plant", 16, 0))).toEqual({ ok: false, error: "blocked" }); // el escritorio
    expect(edit(place("plant", 15, 4))).toEqual({ ok: false, error: "blocked" }); // la mesa de centro
    expect(edit(place("rug-round", 11, 0)).ok).toBe(true); // bajo la planta y la estantería
    expect(edit(place("rug-round", 13, 4))).toEqual({ ok: false, error: "blocked" }); // sobre la alfombra grande
    expect(edit(place("plant", 14, 3)).ok).toBe(true); // sobre la alfombra
  });

  it("lo sólido no tapa la puerta; una alfombra sí puede ir ahí", () => {
    expect(edit(place("plant", 11, 6))).toEqual({ ok: false, error: "door" });
    expect(edit(place("rug-round", 11, 6)).ok).toBe(true);
  });

  it("tiene que quedar camino de la puerta al escritorio con PC", () => {
    const decor = applyAll([place("plant", 15, 1), place("plant", 17, 1)]);
    // Ya solo queda libre (16, 2), detrás de la silla: taparlo deja el PC sin lugar para sentarse.
    expect(edit(place("plant", 16, 2), decor)).toEqual({ ok: false, error: "door" });
  });

  it("no se pone nada donde hay alguien parado, aunque apenas pise el tile", () => {
    expect(edit(place("plant", 13, 6), {}, [{ x: c(13), y: c(6) }])).toEqual({ ok: false, error: "occupied" });
    expect(feetTiles(14 * 32 + 3, c(6)).map((t) => t.x)).toContain(13);
    expect(edit(place("plant", 13, 6), {}, [{ x: 14 * 32 + 3, y: c(6) }])).toEqual({ ok: false, error: "occupied" });
    expect(edit(place("plant", 13, 6), {}, [{ x: c(15), y: c(6) }]).ok).toBe(true);
    expect(edit(place("rug-round", 12, 6), {}, [{ x: c(13), y: c(6) }]).ok).toBe(true); // una alfombra no molesta
  });

  it("no encierra a nadie", () => {
    const decor = applyAll([place("plant", 17, 1)]);
    // Alguien en la esquina (18, 1): con otra planta en (18, 2) no podría salir.
    expect(edit(place("plant", 18, 2), decor, [{ x: c(18), y: c(1) }])).toEqual({ ok: false, error: "door" });
    expect(edit(place("plant", 18, 2), decor).ok).toBe(true);
  });

  it("mover y girar; con alguien sentado, no", () => {
    // El sofá (map-6) en (17, 3) mirando a la izquierda: girarlo en su lugar.
    const r = edit({ action: "move", itemId: "map-6", x: 17, y: 3, facing: "down" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.items.find((f) => f.id === "map-6")).toEqual({ id: "map-6", type: "sofa", x: 6, y: 3, facing: "down" });
    expect(edit({ action: "move", itemId: "map-6", x: 12, y: 6, facing: "right" }).ok).toBe(true);
    expect(edit({ action: "move", itemId: "map-6", x: 16, y: 0, facing: "right" })).toEqual({ ok: false, error: "blocked" });
    // Alguien sentado en el sillón (map-4): no se mueve ni se quita.
    const seated = [{ x: c(14), y: c(4) }];
    expect(edit({ action: "move", itemId: "map-4", x: 12, y: 6, facing: "right" }, {}, seated)).toEqual({ ok: false, error: "occupied" });
    expect(edit({ action: "remove", itemId: "map-4" }, {}, seated)).toEqual({ ok: false, error: "occupied" });
  });

  it("quitar deja el resto igual", () => {
    const r = edit({ action: "remove", itemId: "map-0" });
    expect(r.ok && r.items.map((f) => f.id)).toEqual(Array.from({ length: 8 }, (_, i) => `map-${i + 1}`));
  });

  it("el escritorio con PC y su silla no se mueven ni se quitan; lo desconocido tampoco", () => {
    expect(edit({ action: "move", itemId: "fijo-0", x: 13, y: 6, facing: "right" })).toEqual({ ok: false, error: "fixed" });
    expect(edit({ action: "remove", itemId: "fijo-1" })).toEqual({ ok: false, error: "fixed" });
    expect(edit({ action: "remove", itemId: "no-existe" })).toEqual({ ok: false, error: "unknown" });
    expect(edit(place("desk-pc", 13, 6))).toEqual({ ok: false, error: "unknown" });
    expect(edit(place("hair:braids", 13, 6))).toEqual({ ok: false, error: "unknown" });
    // Claves del prototipo del catálogo: no son muebles (antes rompían con un TypeError).
    for (const type of ["constructor", "toString", "hasOwnProperty", "__proto__"]) {
      expect(edit(place(type, 13, 6))).toEqual({ ok: false, error: "unknown" });
    }
    // Un mueble guardado con un tipo así se ignora al rearmar el nivel.
    const junk = { "office-2": { items: [{ id: "x", type: "constructor", x: 13, y: 6, facing: "right" as const }] } };
    expect(officeFurniture(def, "office-2", junk["office-2"]).some((f) => f.id === "x")).toBe(false);
    expect(() => decorateArea(def, junk)).not.toThrow();
    // En una oficina ya decorada los ids del mapa ya no existen.
    expect(edit({ action: "remove", itemId: "map-0" }, { "office-2": { items: [] } })).toEqual({ ok: false, error: "unknown" });
    expect(applyDecorEdit({ def, decor: {}, zoneId: "pasillo" }, place("plant", 9, 9))).toEqual({ ok: false, error: "unknown" });
  });
});
