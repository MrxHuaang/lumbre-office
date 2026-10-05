import { describe, expect, it } from "vitest";
import { lakeGlint, LAKE_GLINT_KINDS } from "./art/lago-brillo";
import { lakeTiles } from "./lago";
import { getWorld, pointsOfType } from "./index";

describe("el lago del jardín (el agua que brilla)", () => {
  const jardin = getWorld().areas.get("jardin")!;

  it("es un pedazo grande de agua, y los puntos de pesca quedan a la orilla", () => {
    const lake = lakeTiles(jardin);
    expect(lake.length).toBeGreaterThan(100);
    for (const t of lake) expect(jardin.floors[t.y * jardin.width + t.x]).toBe("water");
    const tiles = new Set(lake.map((t) => `${t.x},${t.y}`));
    const ts = jardin.tileSize;
    for (const p of pointsOfType(jardin, "fishing_spot")) {
      const tx = Math.floor(p.x / ts);
      const ty = Math.floor(p.y / ts);
      let near = false;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) near ||= tiles.has(`${tx + dx},${ty + dy}`);
      expect(near, `${tx},${ty}`).toBe(true);
    }
  });

  it("un nivel sin agua no tiene lago", () => {
    expect(lakeTiles(getWorld().areas.get("piso-2")!)).toEqual([]);
  });

  it("los destellos son chiquitos y van creciendo", () => {
    const sizes = Array.from({ length: LAKE_GLINT_KINDS }, (_, k) => lakeGlint(k).width);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
    expect(Math.max(...sizes)).toBeLessThanOrEqual(7);
  });
});
