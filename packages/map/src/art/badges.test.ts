import { ACHIEVEMENTS, BADGE_ICONS } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { BADGE_SIZE, drawBadge, hasBadgeArt, sparkleSprite } from "./badges";

const colors = (c: { data: Uint8ClampedArray }) => {
  const set = new Set<string>();
  for (let i = 0; i < c.data.length; i += 4) if (c.data[i + 3]) set.add(`${c.data[i]},${c.data[i + 1]},${c.data[i + 2]}`);
  return set;
};

describe("insignias de los logros", () => {
  it("cada ícono del catálogo tiene dibujo y cada logro se dibuja del tamaño de la medalla", () => {
    for (const icon of BADGE_ICONS) expect(hasBadgeArt(icon), icon).toBe(true);
    for (const a of ACHIEVEMENTS) {
      const c = drawBadge(a.icon, a.rarity);
      expect([c.width, c.height], a.id).toEqual([BADGE_SIZE, BADGE_SIZE]);
    }
  });

  it("los dibujitos son distintos entre sí", () => {
    const seen = new Map<string, string>();
    for (const icon of BADGE_ICONS) {
      const key = Buffer.from(drawBadge(icon, "comun").data).toString("base64");
      expect(seen.get(key), `${icon} es igual a ${seen.get(key)}`).toBeUndefined();
      seen.set(key, icon);
    }
  });

  it("bloqueado es gris (sin los colores del dibujo) y el secreto cambia el dibujo", () => {
    const open = drawBadge("cat", "raro");
    const locked = drawBadge("cat", "raro", { locked: true });
    const secret = drawBadge("cat", "raro", { locked: true, secret: true });
    expect(colors(locked).size).toBeLessThan(colors(open).size);
    expect(Buffer.from(secret.data).equals(Buffer.from(locked.data))).toBe(false);
  });

  it("el destello es chiquito y tiene algo dibujado", () => {
    const s = sparkleSprite();
    expect(s.width).toBeLessThanOrEqual(8);
    expect(colors(s).size).toBeGreaterThan(1);
  });
});
