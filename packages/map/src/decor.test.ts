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

// Oficina 2 (x 30..39, y 0..10; puerta afuera en (34, 11), adentro (34, 10)). Muebles del mapa en orden:
// map-0 planta (39,0) · map-1 estantería alta (37,0) · fijo-0 escritorio con PC (34,0) · fijo-1 silla (35,1) ·
// map-2 archivador (33,0) · map-3 impresora (30,0) · map-4 lámpara de lectura (30,3) · map-5 alfombra (36,5) ·
// map-6 sofá (39,5) · map-7 mesa (37,6) · map-8 sillón (36,5) · map-9 sillón (36,7) · map-10 aparador (39,8) ·
// map-11 lámpara (39,10) · map-12 planta (30,10) · map-13 monstera (30,7).
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
      ["fijo-0", "desk-pc", 34, 0],
      ["fijo-1", "office-chair-blue", 35, 1],
    ]);
    const defaults = defaultOfficeItems(def, "office-2");
    expect(defaults).toHaveLength(14);
    expect(defaults.map((f) => f.id)).toEqual(Array.from({ length: 14 }, (_, i) => `map-${i}`));
    expect(defaults.some((f) => f.type === "desk-pc")).toBe(false);
  });

  it("una oficina decorada lleva solo sus muebles (y los fijos); las demás no cambian", () => {
    // Lo guardado va relativo a la oficina: la 2 empieza en (30, 0), así que (2, 6) es el tile (32, 6).
    const map = decorateArea(def, { "office-2": { items: [{ id: "a", type: "plant", x: 2, y: 6, facing: "right" }] } });
    const inOffice2 = (f: { x: number; y: number }) => f.x >= 30 && f.y < 11;
    expect(map.furniture.filter(inOffice2).map((f) => f.type).sort()).toEqual(["desk-pc", "office-chair-blue", "plant"]);
    expect(isBlockedTile(map, 32, 6)).toBe(true);
    expect(isBlockedTile(map, 37, 0)).toBe(false); // la estantería del mapa ya no está
    expect([...map.seats.values()].filter((s) => s.computer && inOffice2({ x: s.tileX, y: s.tileY }))).toHaveLength(1);
    const others = (m: OfficeMap) => m.furniture.filter((f) => !inOffice2(f));
    expect(others(map)).toEqual(others(piso2));
  });

  it("piso y papel tapiz cambian solo en esa oficina, y se ignoran los que no existen", () => {
    const map = decorateArea(def, { "office-2": { items: null, floor: "wood", wallpaper: "rose" } });
    expect(map.floors[4 * map.width + 33]).toBe("wood");
    expect(map.floors[4 * map.width + 10]).toBe("carpet"); // oficina 1
    expect(map.def.rooms.find((r) => r.id === "office-2")).toMatchObject({ floor: "wood", wallpaper: "rose" });
    expect(map.def.rooms.find((r) => r.id === "office-1")?.wallpaper).toBe("cream");
    const bad = decorateArea(def, { "office-2": { items: null, floor: "grass", wallpaper: "neon" } });
    expect(bad.def.rooms.find((r) => r.id === "office-2")).toMatchObject({ floor: "carpet", wallpaper: "blue" });
  });

  it("los muebles guardados que ya no valen se ignoran en vez de romper el nivel", () => {
    const junk: OfficeItemDTO[] = [
      { id: "1", type: "nave-espacial", x: 3, y: 4, facing: "right" },
      { id: "2", type: "plant", x: -20, y: 4, facing: "right" }, // en otra oficina (la 1)
      { id: "3", type: "stairs-up", x: 2, y: 4, facing: "right" },
    ];
    const map = decorateArea(def, { "office-2": { items: junk } });
    expect(isBlockedTile(map, 33, 4)).toBe(false);
    expect(isBlockedTile(map, 10, 4)).toBe(false);
  });
});

describe("validar cambios", () => {
  it("poner un mueble en un lugar libre", () => {
    const r = edit(place("plant", 32, 6));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.items).toHaveLength(15);
    // Se guarda relativo a la oficina (empieza en x = 30).
    expect(r.items.at(-1)).toEqual({ id: "nuevo", type: "plant", x: 2, y: 6, facing: "right" });
  });

  it("fuera de la oficina no", () => {
    expect(edit(place("plant", 29, 6))).toEqual({ ok: false, error: "outside" }); // la sala de reuniones
    expect(edit(place("sofa", 32, 10, "right"))).toEqual({ ok: false, error: "outside" }); // 1x2: se sale por abajo
    expect(edit(place("sofa", 32, 9, "right")).ok).toBe(true);
  });

  it("encima de otro mueble no, pero una alfombra sí va debajo (y no sobre otra alfombra)", () => {
    expect(edit(place("plant", 34, 0))).toEqual({ ok: false, error: "blocked" }); // el escritorio
    expect(edit(place("plant", 37, 6))).toEqual({ ok: false, error: "blocked" }); // la mesa de centro
    expect(edit(place("rug-round", 37, 0)).ok).toBe(true); // bajo la estantería
    expect(edit(place("rug-round", 35, 6))).toEqual({ ok: false, error: "blocked" }); // sobre la alfombra grande
    expect(edit(place("plant", 38, 5)).ok).toBe(true); // sobre la alfombra
  });

  it("lo sólido no tapa la puerta; una alfombra sí puede ir ahí", () => {
    expect(edit(place("plant", 34, 10))).toEqual({ ok: false, error: "door" });
    expect(edit(place("rug-round", 34, 9)).ok).toBe(true);
  });

  it("tiene que quedar camino de la puerta al escritorio con PC", () => {
    const decor = applyAll([place("plant", 34, 1), place("plant", 36, 1)]);
    // Ya solo queda libre (35, 2), detrás de la silla: taparlo deja el PC sin lugar para sentarse.
    expect(edit(place("plant", 35, 2), decor)).toEqual({ ok: false, error: "door" });
  });

  it("no se pone nada donde hay alguien parado, aunque apenas pise el tile", () => {
    expect(edit(place("plant", 32, 6), {}, [{ x: c(32), y: c(6) }])).toEqual({ ok: false, error: "occupied" });
    expect(feetTiles(33 * 32 + 3, c(6)).map((t) => t.x)).toContain(32);
    expect(edit(place("plant", 32, 6), {}, [{ x: 33 * 32 + 3, y: c(6) }])).toEqual({ ok: false, error: "occupied" });
    expect(edit(place("plant", 32, 6), {}, [{ x: c(34), y: c(6) }]).ok).toBe(true);
    expect(edit(place("rug-round", 31, 6), {}, [{ x: c(32), y: c(6) }]).ok).toBe(true); // una alfombra no molesta
  });

  it("no encierra a nadie", () => {
    const decor = applyAll([place("plant", 38, 1)]);
    // Alguien en la esquina (39, 1): con otra planta en (39, 2) no podría salir.
    expect(edit(place("plant", 39, 2), decor, [{ x: c(39), y: c(1) }])).toEqual({ ok: false, error: "door" });
    expect(edit(place("plant", 39, 2), decor).ok).toBe(true);
  });

  it("mover y girar; con alguien sentado, no", () => {
    // El sofá (map-6) en (39, 5) mirando a la izquierda: llevarlo arriba y girarlo.
    const r = edit({ action: "move", itemId: "map-6", x: 38, y: 3, facing: "down" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.items.find((f) => f.id === "map-6")).toEqual({ id: "map-6", type: "sofa", x: 8, y: 3, facing: "down" });
    expect(edit({ action: "move", itemId: "map-6", x: 32, y: 6, facing: "right" }).ok).toBe(true);
    expect(edit({ action: "move", itemId: "map-6", x: 34, y: 0, facing: "right" })).toEqual({ ok: false, error: "blocked" });
    // Alguien sentado en el sillón (map-8): no se mueve ni se quita.
    const seated = [{ x: c(36), y: c(5) }];
    expect(edit({ action: "move", itemId: "map-8", x: 32, y: 6, facing: "right" }, {}, seated)).toEqual({ ok: false, error: "occupied" });
    expect(edit({ action: "remove", itemId: "map-8" }, {}, seated)).toEqual({ ok: false, error: "occupied" });
  });

  it("quitar deja el resto igual", () => {
    const r = edit({ action: "remove", itemId: "map-0" });
    expect(r.ok && r.items.map((f) => f.id)).toEqual(Array.from({ length: 13 }, (_, i) => `map-${i + 1}`));
  });

  it("el escritorio con PC y su silla no se mueven ni se quitan; lo desconocido tampoco", () => {
    expect(edit({ action: "move", itemId: "fijo-0", x: 32, y: 6, facing: "right" })).toEqual({ ok: false, error: "fixed" });
    expect(edit({ action: "remove", itemId: "fijo-1" })).toEqual({ ok: false, error: "fixed" });
    expect(edit({ action: "remove", itemId: "no-existe" })).toEqual({ ok: false, error: "unknown" });
    expect(edit(place("desk-pc", 32, 6))).toEqual({ ok: false, error: "unknown" });
    expect(edit(place("hair:braids", 32, 6))).toEqual({ ok: false, error: "unknown" });
    // Claves del prototipo del catálogo: no son muebles (antes rompían con un TypeError).
    for (const type of ["constructor", "toString", "hasOwnProperty", "__proto__"]) {
      expect(edit(place(type, 32, 6))).toEqual({ ok: false, error: "unknown" });
    }
    // Un mueble guardado con un tipo así se ignora al rearmar el nivel.
    const junk = { "office-2": { items: [{ id: "x", type: "constructor", x: 2, y: 6, facing: "right" as const }] } };
    expect(officeFurniture(def, "office-2", junk["office-2"]).some((f) => f.id === "x")).toBe(false);
    expect(() => decorateArea(def, junk)).not.toThrow();
    // En una oficina ya decorada los ids del mapa ya no existen.
    expect(edit({ action: "remove", itemId: "map-0" }, { "office-2": { items: [] } })).toEqual({ ok: false, error: "unknown" });
    expect(applyDecorEdit({ def, decor: {}, zoneId: "pasillo" }, place("plant", 9, 9))).toEqual({ ok: false, error: "unknown" });
  });
});
