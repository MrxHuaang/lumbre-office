import { describe, expect, it } from "vitest";
import { findPath, getWorld, isBlockedTile, pointsOfType, seatStandSpot, spawnPoint, zoneAt, type OfficeMap } from "./index";

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
  it("a la glorieta se entra por el frente, adentro se camina y la banca mira al centro", () => {
    const g = jardin.furniture.find((f) => f.type === "gazebo")!;
    expect(jardin.furniture.some((f) => f.type === "gazebo-roof" && f.x === g.x && f.y === g.y)).toBe(true);
    const start = { x: spawnPoint(jardin).tileX, y: spawnPoint(jardin).tileY };
    // El centro (2x2) y la entrada (+x) se caminan; se llega desde el portón.
    for (const [dx, dy] of [
      [1, 1],
      [2, 1],
      [1, 2],
      [2, 2],
      [3, 1],
      [3, 2],
    ] as const) {
      expect(isBlockedTile(jardin, g.x + dx, g.y + dy), `(${dx}, ${dy})`).toBe(false);
      expect(findPath(jardin, start, { x: g.x + dx, y: g.y + dy }), `(${dx}, ${dy})`).not.toBeNull();
    }
    const cx = (g.x + 2) * jardin.tileSize;
    const cy = (g.y + 2) * jardin.tileSize;
    const seats = [...jardin.seats.values()].filter((s) => s.type === "gazebo");
    expect(seats).toHaveLength(6);
    for (const seat of seats) {
      // Mira hacia el centro de la glorieta y, al pararse, queda adentro.
      const dir = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] }[seat.facing];
      expect((cx - seat.x) * dir[0]! + (cy - seat.y) * dir[1]!, `${seat.tileX},${seat.tileY}`).toBeGreaterThan(0);
      const spot = seatStandSpot(jardin, seat);
      expect(zoneAt(jardin, spot.x, spot.y)?.id, `${seat.tileX},${seat.tileY}`).toBe("glorieta");
    }
    expect(zoneAt(jardin, cx, cy)).toMatchObject({ id: "glorieta", isolated: true });
  });

  it("la fogata es una burbuja de charla con los cuatro troncos adentro", () => {
    // Los troncos de la fogata del observatorio tienen su propia burbuja.
    const all = [...jardin.seats.values()].filter((s) => s.type === "log-seat");
    const logs = all.filter((s) => zoneAt(jardin, s.x, s.y)?.id !== "fogata-observatorio");
    expect(all.length - logs.length).toBe(8);
    expect(logs.length).toBe(8);
    for (const s of logs) expect(zoneAt(jardin, s.x, s.y), `${s.tileX},${s.tileY}`).toMatchObject({ id: "fogata", isolated: true });
    const fire = jardin.furniture.find((f) => f.type === "fire-pit")!;
    expect(zoneAt(jardin, (fire.x + 1) * jardin.tileSize, (fire.y + 1) * jardin.tileSize)?.id).toBe("fogata");
  });

  it("hay una sola pérgola y ninguna terraza de tablas suelta (la terraza es la cubierta de la casa)", () => {
    expect(jardin.furniture.filter((f) => f.type === "pergola")).toHaveLength(1);
    expect(jardin.floors.some((k) => k === "deck")).toBe(false);
  });

  it("al invernadero se entra por la puerta y cada bancal tiene su punto y se alcanza desde el pasillo", () => {
    const g = jardin.furniture.find((f) => f.type === "greenhouse")!;
    expect(jardin.furniture.some((f) => f.type === "greenhouse-roof" && f.x === g.x && f.y === g.y)).toBe(true);
    const start = { x: spawnPoint(jardin).tileX, y: spawnPoint(jardin).tileY };
    // La puerta (al frente, tile x = 2) y el pasillo de adentro se caminan y se llega desde el portón.
    const inside = [[2, 3], [1, 1], [2, 1], [3, 1], [1, 2], [2, 2], [3, 2]] as const;
    for (const [dx, dy] of inside) {
      expect(isBlockedTile(jardin, g.x + dx, g.y + dy), `(${dx}, ${dy})`).toBe(false);
      expect(findPath(jardin, start, { x: g.x + dx, y: g.y + dy }), `(${dx}, ${dy})`).not.toBeNull();
    }
    // Afuera, los costados de la puerta están cerrados (se entra solo por ella).
    for (const dx of [0, 1, 3, 4]) expect(isBlockedTile(jardin, g.x + dx, g.y + 3), `frente ${dx}`).toBe(true);
    const beds = pointsOfType(jardin, "greenhouse_plot");
    expect(beds).toHaveLength(6);
    for (const b of beds) {
      expect(furnitureAt("greenhouse-bed", b.tileX, b.tileY), b.name).toBe(true);
      // Al lado o en diagonal (el del rincón): dentro del alcance de E.
      const near = inside.some(([dx, dy]) => Math.max(Math.abs(g.x + dx - b.tileX), Math.abs(g.y + dy - b.tileY)) === 1);
      expect(near, b.name).toBe(true);
    }
  });
});
