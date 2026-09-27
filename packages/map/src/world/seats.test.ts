import { describe, expect, it } from "vitest";
import { getWorld } from "../index";
import { CATALOG, type CatalogItem } from "./catalog";
import { seatBehind, seatLift, seatZ } from "./seats";

describe("asientos", () => {
  it("cada asiento tiene una altura razonable y la silla es la base", () => {
    expect(seatLift("chair")).toBe(0);
    expect(seatLift("log-seat")).toBeGreaterThan(0);
    expect(seatLift("stool")).toBeLessThan(0);
    for (const [type, item] of Object.entries(CATALOG as Record<string, CatalogItem>)) {
      if (!item.seats?.length) continue;
      expect(seatZ(type), type).toBeGreaterThanOrEqual(5);
      expect(seatZ(type), type).toBeLessThanOrEqual(20);
    }
  });

  it("de espaldas solo tapa el respaldo, y cada asiento sabe de qué mueble es", () => {
    expect(seatBehind("chair", "left")).toBe(true);
    expect(seatBehind("chair", "right")).toBe(false);
    expect(seatBehind("log-seat", "up")).toBe(false);
    const jardin = getWorld().areas.get("jardin")!;
    const log = [...jardin.seats.values()].find((s) => s.type === "log-seat")!;
    const f = jardin.furniture.find((p) => p.type === "log-seat" && log.tileX >= p.x && log.tileX < p.x + p.w && log.tileY >= p.y && log.tileY < p.y + p.d)!;
    expect({ cx: log.cx, cy: log.cy }).toEqual({ cx: (f.x + f.w / 2) * jardin.tileSize, cy: (f.y + f.d / 2) * jardin.tileSize });
  });
});
