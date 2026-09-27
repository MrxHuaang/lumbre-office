import { describe, expect, it } from "vitest";
import { BIRD_FRAMES, BIRD_KINDS, SQUIRREL_FRAMES, drawBird, drawFirefly, drawSquirrel } from "./fauna";
import type { PixelCanvas } from "./pixel";
import { cloudShadow, fogBank, puddle, rainSplash, raindrop } from "./weather";

const opaque = (c: PixelCanvas) => {
  let n = 0;
  for (let i = 3; i < c.data.length; i += 4) if (c.data[i]) n++;
  return n;
};

describe("arte del clima y la fauna", () => {
  it("todos los cuadros de los pájaros y la ardilla tienen dibujo y son chiquitos", () => {
    for (const k of BIRD_KINDS)
      for (const f of BIRD_FRAMES) {
        const c = drawBird(k, f);
        expect(opaque(c)).toBeGreaterThan(12);
        expect(c.width).toBeLessThanOrEqual(12);
      }
    for (const f of SQUIRREL_FRAMES) expect(opaque(drawSquirrel(f))).toBeGreaterThan(15);
    expect(opaque(drawFirefly())).toBeGreaterThan(4);
  });

  it("las piezas del clima se dibujan", () => {
    expect(opaque(raindrop(6))).toBe(6);
    for (const f of [0, 1, 2] as const) expect(opaque(rainSplash(f))).toBeGreaterThan(2);
    expect(opaque(puddle(8, 1))).toBeGreaterThan(20);
    expect(opaque(cloudShadow(80, 40, 3))).toBeGreaterThan(400);
    expect(opaque(fogBank(80, 30, 3))).toBeGreaterThan(200);
  });

  it("es determinista por semilla", () => {
    expect(puddle(8, 5).data).toEqual(puddle(8, 5).data);
    expect(fogBank(40, 20, 2).data).not.toEqual(fogBank(40, 20, 9).data);
  });
});
