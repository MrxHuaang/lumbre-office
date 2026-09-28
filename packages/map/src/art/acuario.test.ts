import { FISH, isTrash } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { miniFish, MINI_FISH_H, MINI_FISH_W } from "./acuario";
import { doorNotesArt } from "./door-notes";

const opaque = (d: Uint8ClampedArray) => {
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i]! >= 200) n++;
  return n;
};

describe("arte del acuario y de las notas", () => {
  it("cada pez del lago tiene su versión chica (con aleteo) y cabe en su tamaño", () => {
    for (const f of FISH.filter((f) => !isTrash(f))) {
      for (const frame of [0, 1]) {
        const c = miniFish(f.id, f.rarity, frame);
        expect([c.width, c.height]).toEqual([MINI_FISH_W, MINI_FISH_H]);
        expect(opaque(c.data), `${f.id}:${frame}`).toBeGreaterThan(12);
      }
    }
  });

  it("en la puerta se ven más post-its cuantas más notas hay (hasta tres)", () => {
    const sizes = [1, 2, 3, 7].map((n) => opaque(doorNotesArt(n).canvas.data));
    expect(sizes[0]).toBeLessThan(sizes[1]!);
    expect(sizes[1]).toBeLessThan(sizes[2]!);
    expect(sizes[3]).toBe(sizes[2]);
  });
});
