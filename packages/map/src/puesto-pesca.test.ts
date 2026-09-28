import { PESCA_NPC, PESCA_SHOP, SOMBRERO_HIDEOUTS } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { drawHeldItem } from "./art/items";
import { findPath, getWorld, isBlockedTile, nearPointOfType, pointsOfType, spawnPoint, type OfficeMap } from "./index";
import { PUESTO_PESCA } from "./world/areas/puesto-pesca";

const jardin = getWorld().areas.get("jardin") as OfficeMap;
const floorAt = (x: number, y: number) => jardin.floors[y * jardin.width + x];
const STAND = ["pesca-caseta", "pesca-mostrador", "pesca-canas", "pesca-nevera"];
const standPieces = () => jardin.furniture.filter((f) => STAND.includes(f.type));
const standTiles = () => standPieces().flatMap((f) => Array.from({ length: f.w * f.d }, (_, k) => ({ x: f.x + (k % f.w), y: f.y + Math.floor(k / f.w) })));
const opaque = (c: { data: Uint8ClampedArray }) => {
  let n = 0;
  for (let i = 3; i < c.data.length; i += 4) if (c.data[i]) n++;
  return n;
};

describe("el puesto de pesca del lago", () => {
  it("la caseta, el mostrador, las cañas y la nevera están, y Don Evelio en el medio (su tile no se camina)", () => {
    expect(standPieces().map((f) => f.type).sort()).toEqual([...STAND].sort());
    const { x, y } = PESCA_NPC.tile;
    expect(PUESTO_PESCA.npc).toEqual(PESCA_NPC.tile);
    expect(isBlockedTile(jardin, x, y)).toBe(true);
    // Ningún mueble encima de él: se para en un tile libre, entre la caseta y el mostrador.
    expect(standTiles().some((t) => t.x === x && t.y === y)).toBe(false);
    expect(standTiles().some((t) => t.x === x - 1 && t.y === y)).toBe(true);
    expect(standTiles().some((t) => t.x === x + 1 && t.y === y)).toBe(true);
    expect(jardin.points.some((p) => p.tileX === x && p.tileY === y)).toBe(false);
  });

  it("se llega al mostrador desde la entrada del jardín, y desde ahí se le compra (el servidor mide lo mismo)", () => {
    const [shop, ...rest] = pointsOfType(jardin, "fishing_shop");
    expect(shop).toBeDefined();
    expect(rest).toHaveLength(0);
    expect(isBlockedTile(jardin, shop!.tileX, shop!.tileY)).toBe(false);
    const spawn = spawnPoint(jardin);
    expect(findPath(jardin, { x: spawn.tileX, y: spawn.tileY }, { x: shop!.tileX, y: shop!.tileY })).not.toBeNull();
    const ts = jardin.tileSize;
    expect(nearPointOfType(jardin, "fishing_shop", (shop!.tileX + 0.5) * ts, (shop!.tileY + 0.5) * ts)).toBe(true);
    // Desde la punta del muelle no se compra.
    const dock = pointsOfType(jardin, "fishing_spot")[0]!;
    expect(nearPointOfType(jardin, "fishing_shop", (dock.tileX + 0.5) * ts, (dock.tileY + 0.5) * ts)).toBe(false);
  });

  it("un senderito llega al mostrador, y el puesto no pisa senderos, el agua, el muelle, la playita ni los puntos de pesca", () => {
    const shop = pointsOfType(jardin, "fishing_shop")[0]!;
    expect(floorAt(shop.tileX, shop.tileY)).toBe("path");
    expect(floorAt(shop.tileX + 1, shop.tileY)).toBe("path");
    for (const t of [...standTiles(), PESCA_NPC.tile]) {
      expect(floorAt(t.x, t.y), `${t.x},${t.y}`).toBe("grass");
      expect(jardin.points.some((p) => p.tileX === t.x && p.tileY === t.y), `${t.x},${t.y}`).toBe(false);
    }
    // Todos los puntos de pesca siguen libres y con agua al lado (lejos del puesto).
    for (const s of pointsOfType(jardin, "fishing_spot")) {
      expect(isBlockedTile(jardin, s.tileX, s.tileY), s.name).toBe(false);
      expect(Math.hypot(s.tileX - PESCA_NPC.tile.x, s.tileY - PESCA_NPC.tile.y), s.name).toBeGreaterThan(4);
    }
  });

  it("los escondites del Man del Sombrero no quedan en el puesto", () => {
    const busy = new Set([...standTiles(), PESCA_NPC.tile, PUESTO_PESCA.punto].map((t) => `${t.x},${t.y}`));
    for (const h of SOMBRERO_HIDEOUTS.filter((h) => h.area === "jardin")) expect(busy.has(`${h.x},${h.y}`), h.id).toBe(false);
  });

  it("lo que vende tiene dibujo para la mano y la barra (chiquito, como lo demás)", () => {
    for (const i of PESCA_SHOP) {
      const c = drawHeldItem(i.id);
      expect(opaque(c), i.id).toBeGreaterThan(12);
      expect(Math.max(c.width, c.height), i.id).toBeLessThanOrEqual(10);
    }
  });
});
