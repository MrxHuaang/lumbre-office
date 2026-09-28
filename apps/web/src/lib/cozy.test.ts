import { isNightMinute } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { duskAt } from "./cozy";

describe("atardecer (hora del juego)", () => {
  it("no hay atardecer de día ni de noche", () => {
    expect(duskAt(12)).toBe(0);
    expect(duskAt(16, 59)).toBe(0);
    expect(duskAt(2)).toBe(0);
    expect(duskAt(21)).toBe(0);
  });

  it("se dora de a poco entre las 17 y las 19", () => {
    expect(duskAt(17)).toBe(0);
    expect(duskAt(18)).toBeCloseTo(0.5);
    expect(duskAt(17, 30)).toBeLessThan(duskAt(18, 30));
    expect(duskAt(18, 59)).toBeGreaterThan(0.99);
  });

  it("la noche del reloj empieza justo cuando termina el atardecer", () => {
    expect(isNightMinute(18 * 60 + 59)).toBe(false);
    expect(duskAt(19)).toBe(0);
    expect(isNightMinute(19 * 60)).toBe(true);
  });
});
