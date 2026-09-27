import { FISH } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { BAR, drawFish, drawFishingBar, FISH_H, FISH_W, hasFishArt } from "./fish";

const opaque = (c: { data: Uint8ClampedArray }) => {
  let n = 0;
  for (let i = 3; i < c.data.length; i += 4) if (c.data[i]! > 0) n++;
  return n;
};

describe("arte de la pesca", () => {
  it("cada pez y cada basura del catálogo tiene su dibujo", () => {
    for (const f of FISH) {
      expect(hasFishArt(f.id), f.id).toBe(true);
      const c = drawFish(f.id, f.rarity);
      expect([c.width, c.height]).toEqual([FISH_W, FISH_H]);
      expect(opaque(c), f.id).toBeGreaterThan(40);
    }
  });

  it("los dibujos son distintos entre sí", () => {
    const seen = new Map<string, string>();
    for (const f of FISH) {
      const key = Buffer.from(drawFish(f.id, f.rarity).data).toString("base64");
      expect(seen.get(key), `${f.id} es igual a ${seen.get(key)}`).toBeUndefined();
      seen.set(key, f.id);
    }
  });

  it("la silueta tiene la misma forma y un solo tono", () => {
    const f = FISH[0]!;
    const s = drawFish(f.id, f.rarity, { silhouette: true });
    const colors = new Set<string>();
    for (let i = 0; i < s.data.length; i += 4) if (s.data[i + 3]) colors.add(`${s.data[i]},${s.data[i + 1]},${s.data[i + 2]}`);
    expect(colors.size).toBe(1);
  });

  it("el minijuego se dibuja del tamaño del marco", () => {
    const c = drawFishingBar({ track: 568, fishSize: 36, barPos: 400, barHeight: 150, fishPos: 450, fishInBar: true, meter: 0.5, rarity: "raro", t: 3, holding: true });
    expect([c.width, c.height]).toEqual([BAR.w, BAR.h]);
  });
});
