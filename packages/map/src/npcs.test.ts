import { CASINO_NPCS, OBSERVATORIO_NPCS, SOMBRERO_HIDEOUTS } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { canStandAt, getWorld, INTERACT_REACH_TILES, isBlockedTile, pointsOfType } from "./index";
import { findPath } from "./pathfinding";

// El personal del casino y la astrónoma no se caminan y el Man del Sombrero siempre queda donde se le
// puede llegar.

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

describe("la astrónoma del observatorio", () => {
  const map = getWorld().areas.get("observatorio")!;
  const [npc] = OBSERVATORIO_NPCS;

  it("está en el observatorio, en un tile libre de muebles que no se camina y no tapa ningún punto", () => {
    expect(OBSERVATORIO_NPCS).toHaveLength(1);
    expect(npc!.area).toBe("observatorio");
    const { x, y } = npc!.tile;
    expect(isBlockedTile(map, x, y)).toBe(true);
    // Lo que la bloquea es ella, no un mueble (su tile queda despejado para dibujarla).
    expect(map.furniture.some((f) => x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.d)).toBe(false);
    expect(map.points.some((p) => p.tileX === x && p.tileY === y)).toBe(false);
    expect(map.portals.some((p) => p.tiles.some((t) => t.x === x && t.y === y))).toBe(false);
  });

  it("se le habla desde el punto de delante, al que se llega desde la puerta", () => {
    const start = map.portals[0]!.tiles[0]!;
    const [point] = pointsOfType(map, "astronomer");
    expect(point).toBeDefined();
    expect(isBlockedTile(map, point!.tileX, point!.tileY)).toBe(false);
    expect(Math.hypot(point!.tileX - npc!.tile.x, point!.tileY - npc!.tile.y)).toBeLessThanOrEqual(INTERACT_REACH_TILES);
    expect(findPath(map, start, { x: point!.tileX, y: point!.tileY })).not.toBeNull();
    // No se pisa con los otros objetos con E (el telescopio, el orrery, el radar, el diario).
    const reach = INTERACT_REACH_TILES * map.tileSize * 2;
    for (const p of map.points.filter((p) => p.type !== "astronomer")) expect(Math.hypot(p.x - point!.x, p.y - point!.y), p.name).toBeGreaterThan(reach);
    // Y con ella parada ahí se sigue llegando a todo lo que se usa.
    for (const p of map.points) expect(findPath(map, start, { x: p.tileX, y: p.tileY }), p.name).not.toBeNull();
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

  it("en el jardín quedan fuera de las estructuras (la granja, el lago, el observatorio, el escenario…)", () => {
    // En coordenadas de la zona jugable (el nivel lleva 10 de margen): la parrilla, la loma del
    // observatorio, el lago, el molino y todo lo del sur, los frutales y el gallinero.
    const reserved = (x: number, y: number) =>
      (x >= 70 && x <= 83 && y >= 26 && y <= 35) ||
      (x >= 100 && y >= 15 && y <= 50) ||
      (x >= 66 && x <= 95 && y >= 50 && y <= 82) ||
      (x >= 84 && y >= 82) ||
      y >= 84 ||
      (x <= 20 && y >= 66 && y <= 82) ||
      (x <= 12 && y >= 31 && y <= 42);
    for (const h of SOMBRERO_HIDEOUTS.filter((h) => h.area === "jardin")) expect(reserved(h.x - 10, h.y - 10), h.id).toBe(false);
  });
});
