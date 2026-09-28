import { CASINO_NPCS, SOMBRERO_HIDEOUTS } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { canStandAt, getWorld, isBlockedTile } from "./index";
import { findPath } from "./pathfinding";

// El personal del casino no se camina y el Man del Sombrero siempre queda donde se le puede llegar.

describe("personal del casino en el sótano", () => {
  const map = getWorld().areas.get("sotano")!;

  it("sus tiles no se caminan y no tapan ningún punto del mapa", () => {
    for (const n of CASINO_NPCS) {
      expect(isBlockedTile(map, n.tile.x, n.tile.y), n.id).toBe(true);
      expect(map.points.some((p) => p.tileX === n.tile.x && p.tileY === n.tile.y), n.id).toBe(false);
    }
  });

  it("desde la escalera se llega a todos los puntos de la ruleta, la caja y los puestos del blackjack", () => {
    const start = map.portals[0]!.tiles[0]!;
    for (const p of map.points.filter((p) => p.type === "roulette" || p.type === "casino_cashier"))
      expect(findPath(map, start, { x: p.tileX, y: p.tileY }), `${p.type} (${p.tileX}, ${p.tileY})`).not.toBeNull();
    // A las banquetas (que bloquean) se llega por algún tile de al lado.
    for (const s of [...map.seats.values()].filter((s) => s.type === "stool")) {
      const beside = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => {
        const t = { x: s.tileX + dx!, y: s.tileY + dy! };
        return !isBlockedTile(map, t.x, t.y) && findPath(map, start, t) !== null;
      });
      expect(beside, `banqueta (${s.tileX}, ${s.tileY})`).toBe(true);
    }
  });
});

describe("escondites del Man del Sombrero", () => {
  it("cada uno es un tile donde uno se para y al que se llega desde la entrada del nivel", () => {
    for (const h of SOMBRERO_HIDEOUTS) {
      const map = getWorld().areas.get(h.area)!;
      expect(map, h.id).toBeDefined();
      const ts = map.tileSize;
      expect(canStandAt(map, h.x * ts + ts / 2, h.y * ts + ts / 2), h.id).toBe(true);
      const spawn = map.points.find((p) => p.type === "spawn");
      const start = spawn ? { x: spawn.tileX, y: spawn.tileY } : map.portals[0]!.tiles[0]!;
      expect(findPath(map, start, { x: h.x, y: h.y }), h.id).not.toBeNull();
    }
  });

  it("en el jardín quedan fuera de las franjas de las estructuras nuevas", () => {
    // En coordenadas de la zona jugable (el nivel lleva 10 de margen).
    const reserved = (x: number, y: number) =>
      (x >= 50 && y >= 17) || y >= 54 || (x <= 22 && y >= 40 && y <= 53) || (x <= 12 && y >= 23 && y <= 34);
    for (const h of SOMBRERO_HIDEOUTS.filter((h) => h.area === "jardin")) expect(reserved(h.x - 10, h.y - 10), h.id).toBe(false);
  });
});
