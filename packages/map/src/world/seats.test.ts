import { describe, expect, it } from "vitest";
import { getWorld } from "../index";
import { CATALOG, type CatalogItem } from "./catalog";
import { SIT_BACK_RAISE, SIT_WAIST_ROWS, seatBehind, seatBodyRows, seatLift, seatShift, seatZ } from "./seats";

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

  it("de espaldas tras un respaldo la hoja sube para que la cabeza asome; de frente, no", () => {
    expect(seatLift("chair", "up")).toBe(-SIT_BACK_RAISE);
    expect(seatLift("office-chair-blue", "left")).toBe(-SIT_BACK_RAISE);
    expect(seatLift("chair", "right")).toBe(seatLift("chair"));
    expect(seatLift("chair", "down")).toBe(seatLift("chair"));
  });

  it("sin respaldo, de espaldas no sube: el cuerpo se corta a la altura del asiento", () => {
    for (const type of ["stool", "picnic-bench", "log-seat", "treehouse-cushion", "hammock", "gazebo"]) {
      expect(seatLift(type, "left"), type).toBe(seatLift(type));
      expect(seatBodyRows(type, "left"), type).toBe(SIT_WAIST_ROWS);
      expect(seatBodyRows(type, "up"), type).toBe(SIT_WAIST_ROWS);
      expect(seatBodyRows(type, "right"), type).toBeNull();
      expect(seatBodyRows(type, "down"), type).toBeNull();
    }
    // Con respaldo lo tapa el mueble (el cuerpo va debajo y encima solo la cabeza): no se corta.
    expect(seatBodyRows("chair", "up")).toBeNull();
  });

  it("en las sillas de respaldo delgado: de espaldas contra el respaldo, de frente centrado", () => {
    const thin = ["chair", "office-chair", "office-chair-mustard", "office-chair-blue", "office-chair-rose", "office-chair-sage", "office-chair-broken", "bus-seat", "bus-seat-blue", "bench", "patio-chair"];
    for (const type of thin) {
      // De frente queda en el centro del cojín, como siempre.
      expect(seatShift(type, "right"), type).toEqual({ x: 0, y: 0 });
      expect(seatShift(type, "down"), type).toEqual({ x: 0, y: 0 });
    }
    // De espaldas el respaldo queda delante (derecha y abajo en pantalla mirando a -x).
    expect(seatShift("chair", "left")).toEqual({ x: 4, y: 2 });
    expect(seatShift("chair", "up")).toEqual({ x: -4, y: 2 });
    for (const type of thin.filter((t) => t !== "patio-chair")) {
      expect(seatShift(type, "left"), type).toEqual(seatShift("chair", "left"));
      expect(seatShift(type, "up"), type).toEqual(seatShift("chair", "up"));
    }
    expect(seatShift("patio-chair", "left")).toEqual({ x: 2, y: 1 });
    expect(seatShift("patio-chair", "up")).toEqual({ x: -2, y: 1 });
  });

  it("sin respaldo, de frente la altura no cambia: solo de espaldas se corta el cuerpo", () => {
    for (const type of ["stool", "picnic-bench", "log-seat", "entry-bench", "hammock", "treehouse-cushion", "treehouse-cushion-sage"]) {
      expect(seatLift(type, "right"), type).toBe(seatLift(type));
      expect(seatLift(type, "down"), type).toBe(seatLift(type));
      expect(seatShift(type, "right"), type).toEqual({ x: 0, y: 0 });
      expect(seatShift(type, "down"), type).toEqual({ x: 0, y: 0 });
    }
    expect(seatLift("stool", "right")).toBe(-3);
  });

  it("de frente todo asiento queda centrado en el tile, salvo la banca inset de la glorieta", () => {
    for (const [type, item] of Object.entries(CATALOG as Record<string, CatalogItem>)) {
      if (!item.seats?.length || type === "gazebo") continue;
      expect(seatShift(type, "right"), type).toEqual({ x: 0, y: 0 });
      expect(seatShift(type, "down"), type).toEqual({ x: 0, y: 0 });
    }
    // La glorieta, hacia el centro en todas las orientaciones (hacia +x es derecha y abajo).
    expect(seatShift("gazebo", "right")).toEqual({ x: 4, y: 2 });
    expect(seatShift("gazebo", "down")).toEqual({ x: -4, y: 2 });
    expect(seatShift("gazebo", "up")).toEqual({ x: 4, y: -2 });
  });

  it("de espaldas, en los muebles de respaldo grueso el cuerpo va hacia el cojín, a píxel entero", () => {
    expect(seatShift("stool", "up")).toEqual({ x: 0, y: 0 });
    // Hacia -x en pantalla es izquierda y arriba; hacia -y, derecha y arriba.
    expect(seatShift("sofa", "left")).toEqual({ x: -4, y: -2 });
    expect(seatShift("sofa", "up")).toEqual({ x: 4, y: -2 });
    expect(seatShift("armchair", "left")).toEqual({ x: -2, y: -1 });
    // Las butacas de cada grada del cine se corren igual que la del sótano.
    expect(seatShift("cinema-seat-3", "left")).toEqual(seatShift("cinema-seat", "left"));
    expect(seatShift("cinema-seat", "left")).toEqual({ x: -2, y: -1 });
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
