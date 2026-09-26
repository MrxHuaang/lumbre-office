import { describe, expect, it } from "vitest";
import { canHear, type Positioned } from "./proximity";

const at = (x: number, y: number, zoneId: string | null = null, zoneIsolated = false): Positioned => ({
  x,
  y,
  zoneId,
  zoneIsolated,
});

describe("canHear", () => {
  it("en zonas abiertas depende de la distancia", () => {
    expect(canHear(at(0, 0, "lounge"), at(100, 0, "lounge"), 160)).toBe(true);
    expect(canHear(at(0, 0, "lounge"), at(200, 0, "lounge"), 160)).toBe(false);
    expect(canHear(at(0, 0), at(50, 50), 160)).toBe(true); // pasillo sin zona
  });

  it("dentro de una zona aislada se oyen todos, sin importar la distancia", () => {
    expect(canHear(at(0, 0, "meeting", true), at(900, 0, "meeting", true), 160)).toBe(true);
  });

  it("no se oye a través de la pared de una zona aislada aunque estén cerca", () => {
    expect(canHear(at(0, 0, "office-1", true), at(10, 0, "lounge"), 160)).toBe(false);
    expect(canHear(at(0, 0, "lounge"), at(10, 0, "office-1", true), 160)).toBe(false);
    expect(canHear(at(0, 0, "office-1", true), at(10, 0, "office-2", true), 160)).toBe(false);
  });
});
