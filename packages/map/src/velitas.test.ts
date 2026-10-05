import { VELITAS } from "@hyvento/shared";
import { afterEach, describe, expect, it } from "vitest";
import { applyFestivalDecor, catalogItem, festivalDecorAreas, festivalDecorOf, findPath, getWorld, planDef, pointsOfType, setFestivalDecor } from "./index";
import { farolesOrigin, onWishDock, VELITA_TYPES, velitaBlock, velitaInReach, velitaTypeAt } from "./velitas";

/** El jardín sin decoración (getWorld se rearma al prender un festival). */
const jardin = getWorld().areas.get(VELITAS.area)!;
const ts = jardin.tileSize;

describe("Noche de velitas en el mapa", () => {
  it("todas las velitas y los faroles están en el catálogo; las velitas no bloquean", () => {
    for (const t of VELITA_TYPES) expect(catalogItem(t).solid, t).toBe(false);
    for (const t of [...VELITA_TYPES, "velitas-vasos", "farol-velitas", "farol-cubo"]) expect(catalogItem(t).light, t).toBeDefined();
  });

  it("no va fuera del jardín, sobre un mueble, un punto, un portal o el agua", () => {
    const spawn = pointsOfType(jardin, "spawn")[0]!;
    expect(velitaBlock(jardin, spawn.tileX, spawn.tileY)).toBe("punto");
    const portal = jardin.portals[0]!.tiles[0]!;
    expect(velitaBlock(jardin, portal.x, portal.y)).not.toBeNull();
    const f = jardin.furniture.find((x) => x.type === "mailbox")!;
    expect(velitaBlock(jardin, f.x, f.y)).not.toBeNull();
    expect(velitaBlock(jardin, -1, 4)).toBe("fuera");
    expect(velitaBlock(getWorld().areas.get("planta-baja")!, 10, 10)).toBe("fuera");
    // Al lado del punto de aparición, en la pradera, sí.
    expect(velitaBlock(jardin, spawn.tileX + 1, spawn.tileY)).toBeNull();
  });

  it("se alcanza solo cerquita", () => {
    expect(velitaInReach(jardin, 63.5 * ts, 40.5 * ts, 64, 40)).toBe(true);
    expect(velitaInReach(jardin, 63.5 * ts, 40.5 * ts, 66, 40)).toBe(false);
  });

  it("cada tile tiene su velita, la misma siempre", () => {
    expect(velitaTypeAt(3, 4)).toBe(velitaTypeAt(3, 4));
    expect(new Set(Array.from({ length: 60 }, (_, i) => velitaTypeAt(i, i * 7))).size).toBeGreaterThan(3);
  });

  it("el farol se suelta sobre el muelle, no en la orilla ni en la piscina", () => {
    const tip = pointsOfType(jardin, "fishing_spot").find((p) => p.name === "Muelle")!;
    expect(onWishDock(jardin, tip.x, tip.y)).toBe(true);
    expect(onWishDock(jardin, tip.x - 5 * ts, tip.y)).toBe(true);
    expect(onWishDock(jardin, 63.5 * ts, 40.5 * ts)).toBe(false);
    const pool = pointsOfType(jardin, "pool_steps")[0]!;
    expect(onWishDock(jardin, pool.x, pool.y)).toBe(false);
    expect(farolesOrigin(jardin)).not.toBeNull();
  });

  it("la decoración del festival entra entera, lo que bloquea no va sobre senderos y no tapa nada", () => {
    expect(festivalDecorAreas("velitas")).toEqual([VELITAS.area]);
    const def = planDef(VELITAS.area)!;
    const decor = festivalDecorOf("velitas", def, 0)!;
    // Ninguna pieza se salta (todas caen en piso libre).
    expect(applyFestivalDecor(def, decor).furniture.length - def.furniture.length).toBe(decor.furniture.length);
    for (const p of decor.furniture) {
      const where = `${p.type} ${p.x},${p.y}`;
      expect(velitaBlock(jardin, p.x, p.y), where).toBeNull();
      if (catalogItem(p.type).solid !== false) expect(jardin.floors[p.y * jardin.width + p.x], where).not.toBe("path");
    }
    // Desde la entrada se sigue llegando a todos los portales y puntos.
    const spawn = pointsOfType(jardin, "spawn")[0]!;
    const from = { x: spawn.tileX, y: spawn.tileY };
    const targets = [...jardin.portals.flatMap((p) => p.tiles), ...jardin.points.map((p) => ({ x: p.tileX, y: p.tileY }))];
    const before = targets.filter((t) => findPath(jardin, from, t));
    setFestivalDecor("velitas", 0);
    const decorated = getWorld().areas.get(VELITAS.area)!;
    expect(decorated.furniture.some((f) => f.type === "farol-velitas")).toBe(true);
    for (const t of before) expect(findPath(decorated, from, t), `${t.x},${t.y}`).not.toBeNull();
  });
});

afterEach(() => {
  setFestivalDecor(null);
});
