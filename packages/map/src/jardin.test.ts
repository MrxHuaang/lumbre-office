import { describe, expect, it } from "vitest";
import { findPath, getWorld, isBlockedTile, pointsOfType, spawnPoint, type OfficeMap } from "./index";

const jardin = getWorld().areas.get("jardin") as OfficeMap;
const floorAt = (x: number, y: number) => jardin.floors[y * jardin.width + x];
const furnitureAt = (type: string, x: number, y: number) =>
  jardin.furniture.some((f) => f.type === type && x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.d);

describe("jardín", () => {
  it("todos los puntos quedan dentro de la zona jugable", () => {
    const p = jardin.def.playable!;
    expect(p).toBeDefined();
    for (const pt of jardin.points) {
      expect(pt.tileX >= p.x && pt.tileX < p.x + p.w, pt.name).toBe(true);
      expect(pt.tileY >= p.y && pt.tileY < p.y + p.h, pt.name).toBe(true);
    }
  });

  it("hay 20 parcelas, cada punto sobre su parcela y en orden (fila por fila)", () => {
    const plots = pointsOfType(jardin, "garden_plot");
    expect(plots).toHaveLength(20);
    // El índice del punto es el id de la parcela: no puede cambiar de orden sin que se note.
    const order = plots.map((p) => p.tileY * jardin.width + p.tileX);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (const p of plots) {
      expect(furnitureAt("garden-plot", p.tileX, p.tileY), p.name).toBe(true);
      expect(isBlockedTile(jardin, p.tileX, p.tileY), p.name).toBe(false);
    }
    // Una parcela por punto (ninguna repetida).
    expect(new Set(order).size).toBe(20);
    expect(jardin.furniture.filter((f) => f.type === "garden-plot")).toHaveLength(20);
  });

  it("se pesca junto al agua: en la punta del muelle y en la piedra plana de la orilla", () => {
    const spots = pointsOfType(jardin, "fishing_spot");
    expect(spots.length).toBeGreaterThanOrEqual(2);
    const start = { x: spawnPoint(jardin).tileX, y: spawnPoint(jardin).tileY };
    for (const s of spots) {
      expect(isBlockedTile(jardin, s.tileX, s.tileY), s.name).toBe(false);
      const water = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => floorAt(s.tileX + dx!, s.tileY + dy!) === "water");
      expect(water, `${s.name}: sin agua al lado`).toBe(true);
      expect(findPath(jardin, start, { x: s.tileX, y: s.tileY }), s.name).not.toBeNull();
    }
    expect(spots.some((s) => floorAt(s.tileX, s.tileY) === "dock")).toBe(true);
    expect(spots.some((s) => furnitureAt("flat-rock", s.tileX, s.tileY))).toBe(true);
  });

  it("se aparece junto al portón de la cerca", () => {
    const spawn = spawnPoint(jardin);
    const gate = jardin.furniture.find((f) => f.type === "garden-gate")!;
    expect(gate).toBeDefined();
    const dx = spawn.tileX - (gate.x + gate.w / 2);
    const dy = spawn.tileY - gate.y;
    expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(4);
  });

  it("no quedan tiles libres a los que no se llega (el islote, detrás de la casa)", () => {
    const p = jardin.def.playable!;
    const seen = new Set<number>();
    const sp = spawnPoint(jardin);
    const stack = [[sp.tileX, sp.tileY] as const];
    seen.add(sp.tileY * jardin.width + sp.tileX);
    while (stack.length) {
      const [x, y] = stack.pop()!;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const k = (y + dy) * jardin.width + x + dx;
        if (seen.has(k) || isBlockedTile(jardin, x + dx, y + dy)) continue;
        seen.add(k);
        stack.push([x + dx, y + dy]);
      }
    }
    const lost: string[] = [];
    for (let y = p.y; y < p.y + p.h; y++)
      for (let x = p.x; x < p.x + p.w; x++) if (!isBlockedTile(jardin, x, y) && !seen.has(y * jardin.width + x)) lost.push(`${x - p.x},${y - p.y}`);
    expect(lost).toEqual([]);
  });
});
