import { describe, expect, it } from "vitest";
import { duskAt, isNightNow } from "./cozy";

const at = (h: number, m = 0) => new Date(2026, 8, 28, h, m);

describe("atardecer", () => {
  it("no hay atardecer de día ni de noche", () => {
    expect(duskAt(at(12))).toBe(0);
    expect(duskAt(at(16, 59))).toBe(0);
    expect(duskAt(at(2))).toBe(0);
    expect(duskAt(at(21))).toBe(0);
  });

  it("se dora de a poco entre las 17 y las 19", () => {
    expect(duskAt(at(17))).toBe(0);
    expect(duskAt(at(18))).toBeCloseTo(0.5);
    expect(duskAt(at(17, 30))).toBeLessThan(duskAt(at(18, 30)));
    expect(duskAt(at(18, 59))).toBeGreaterThan(0.99);
  });

  it("la noche empieza justo cuando termina el atardecer", () => {
    expect(isNightNow(at(18, 59))).toBe(false);
    expect(isNightNow(at(19))).toBe(true);
  });
});
