import { PLUSHES, RECEPCION_NPC, SEASONS, SLOT_SYMBOLS, WALL_BOARD_TYPE } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { drawFurniture } from "./art/furniture";
import { drawHeldItem } from "./art/items";
import { scarecrow } from "./art/leisure";
import { slotSymbol } from "./art/tragamonedas";
import { getWorld, inRowboat, isBlockedTile, pointsOfType, usablesOf, wallBoardsOf, zoneAt } from "./index";

const world = getWorld();

describe("mundo lleno en el mapa", () => {
  it("la pizarra de la pared se usa solo en las salas con pizarra compartida (oficinas y salas de reuniones)", () => {
    const piso2 = world.areas.get("piso-2")!;
    const boards = wallBoardsOf(piso2);
    const ts = piso2.tileSize;
    // Las dos oficinas de arriba tienen pizarra en la pared norte; la de la sala de cabinas es común (no).
    expect(boards.length).toBe(2);
    for (const b of boards) expect(zoneAt(piso2, (b.x + 0.5) * ts, (b.y + 0.5) * ts)?.type).toBe("office");
    expect(usablesOf(piso2).filter((f) => f.type === WALL_BOARD_TYPE)).toHaveLength(2);
    // El estudio de grabación (una sala de reuniones) también.
    expect(wallBoardsOf(world.areas.get("podcast")!)).toHaveLength(1);
  });

  it("el bote del muelle es un asiento, y se sabe cuándo alguien está sentado en él", () => {
    const jardin = world.areas.get("jardin")!;
    const seats = [...jardin.seats.values()].filter((s) => s.type === "rowboat");
    expect(seats).toHaveLength(1);
    const s = seats[0]!;
    expect(inRowboat(jardin, s.x, s.y)).toBe(true);
    expect(inRowboat(jardin, s.x + 8, s.y)).toBe(false);
    // Hay dónde pararse junto al bote (sobre el muelle) para subirse.
    const around = [
      [s.tileX, s.tileY - 1],
      [s.tileX - 1, s.tileY],
      [s.tileX + 1, s.tileY],
    ];
    expect(around.some(([x, y]) => !isBlockedTile(jardin, x!, y!))).toBe(true);
  });

  it("Doña Gloria está detrás de la recepción (su tile no se pisa) y el punto queda delante del mostrador", () => {
    const pb = world.areas.get("planta-baja")!;
    expect(isBlockedTile(pb, RECEPCION_NPC.tile.x, RECEPCION_NPC.tile.y)).toBe(true);
    const [p] = pointsOfType(pb, "reception");
    expect(p).toBeDefined();
    expect(isBlockedTile(pb, p!.tileX, p!.tileY)).toBe(false);
    const desk = pb.furniture.find((f) => f.type === "reception-desk")!;
    expect(p!.tileY).toBe(desk.y + desk.d);
    expect(RECEPCION_NPC.tile.y).toBe(desk.y - 1);
  });

  it("cada peluche tiene su dibujo, chiquito y distinto de los demás", () => {
    const keys = PLUSHES.map((p) => {
      const c = drawHeldItem(p.id);
      expect(c.width, p.id).toBeLessThanOrEqual(10);
      expect(c.height, p.id).toBeLessThanOrEqual(10);
      return Array.from(c.data).join(",");
    });
    expect(new Set(keys).size).toBe(PLUSHES.length);
  });

  it("el espantapájaros se viste distinto en cada estación, del mismo tamaño que su dibujo (se cambia encima)", () => {
    const base = drawFurniture("scarecrow", "front");
    const keys = SEASONS.map((season) => {
      const s = scarecrow(season);
      expect([s.canvas.width, s.canvas.height, s.ox, s.oy], season).toEqual([base.canvas.width, base.canvas.height, base.ox, base.oy]);
      return Array.from(s.canvas.data).join(",");
    });
    expect(new Set(keys).size).toBe(SEASONS.length);
  });

  it("los símbolos del tragamonedas son todos distintos", () => {
    expect(new Set(SLOT_SYMBOLS.map((s) => Array.from(slotSymbol(s).data).join(","))).size).toBe(SLOT_SYMBOLS.length);
  });
});
