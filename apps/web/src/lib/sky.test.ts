import { describe, expect, it } from "vitest";
import { SKY_COLORS, SKY_H, SKY_W, skyBody, skyPixels } from "./sky";

describe("cielo del reloj del HUD", () => {
  it("el sol cruza de día y la luna de noche, de izquierda a derecha", () => {
    expect(skyBody(12 * 60).kind).toBe("sun");
    expect(skyBody(23 * 60).kind).toBe("moon");
    expect(skyBody(2 * 60).kind).toBe("moon");
    expect(skyBody(8 * 60).x).toBeLessThan(skyBody(16 * 60).x);
    expect(skyBody(20 * 60).x).toBeLessThan(skyBody(3 * 60).x);
  });

  it("más alto a mediodía que al salir", () => {
    expect(skyBody(12 * 60).y).toBeLessThan(skyBody(6 * 60).y);
    expect(skyBody(0).y).toBeLessThan(skyBody(19 * 60 + 30).y);
  });

  it("los píxeles quedan dentro de la ventanita y el color va con el momento", () => {
    for (const m of [0, 5 * 60, 7 * 60, 12 * 60, 17 * 60 + 30, 19 * 60, 23 * 60 + 59]) {
      for (const p of skyPixels(m)) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThan(SKY_W);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThan(SKY_H);
      }
    }
    expect(skyPixels(12 * 60)[0]!.color).toBe(SKY_COLORS.dia.top);
    expect(skyPixels(22 * 60)[0]!.color).toBe(SKY_COLORS.noche.top);
    expect(skyPixels(18 * 60)[0]!.color).toBe(SKY_COLORS.atardecer.top);
  });
});
