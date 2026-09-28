import { describe, expect, it } from "vitest";
import { getWorld } from "../index";
import { CATALOG, type CatalogItem } from "./catalog";
import { SIT_BACK_RAISE, seatBehind, seatLift, seatShift, seatZ } from "./seats";

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

  it("de espaldas la hoja sube para que la cadera quede sobre el asiento; de frente, no", () => {
    expect(seatLift("picnic-bench", "left")).toBe(seatLift("picnic-bench") - SIT_BACK_RAISE);
    expect(seatLift("chair", "up")).toBe(-SIT_BACK_RAISE);
    expect(seatLift("chair", "right")).toBe(seatLift("chair"));
    expect(seatLift("chair", "down")).toBe(seatLift("chair"));
  });

  it("en los muebles de cojín por delante el cuerpo se corre hacia donde mira, a píxel entero", () => {
    expect(seatShift("chair", "right")).toEqual({ x: 0, y: 0 });
    expect(seatShift("stool", "up")).toEqual({ x: 0, y: 0 });
    // Hacia +x en pantalla es derecha y abajo; hacia -y, derecha y arriba.
    expect(seatShift("sofa", "right")).toEqual({ x: 4, y: 2 });
    expect(seatShift("sofa", "left")).toEqual({ x: -4, y: -2 });
    expect(seatShift("sofa", "down")).toEqual({ x: -4, y: 2 });
    expect(seatShift("sofa", "up")).toEqual({ x: 4, y: -2 });
    // Las butacas de cada grada del cine se corren igual que la del sótano.
    expect(seatShift("cinema-seat-3", "right")).toEqual(seatShift("cinema-seat", "right"));
    for (const [type, item] of Object.entries(CATALOG as Record<string, CatalogItem>)) {
      if (!item.seats?.length) continue;
      for (const f of ["right", "left", "down", "up"] as const) {
        const { x, y } = seatShift(type, f);
        expect(Number.isInteger(x) && Number.isInteger(y), `${type} ${f}`).toBe(true);
        // Nunca tanto que el cuerpo se salga del tile (8 px de arte de medio tile a lo ancho).
        expect(Math.abs(x), `${type} ${f}`).toBeLessThanOrEqual(6);
      }
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
