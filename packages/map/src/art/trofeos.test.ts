import { ACHIEVEMENTS, BADGE_ICONS, ACHIEVEMENT_RARITIES } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { getWorld, pointsOfType, zoneAt } from "../index";
import { drawFurniture } from "./furniture";
import { drawMiniBadge, hasMiniBadge, MINI_BADGE_SIZE } from "./insignias";
import type { PixelCanvas } from "./pixel";
import { trophyCase, trophyShelf, TROPHY_CASE_SLOTS } from "./trofeos";

const opaque = (c: PixelCanvas) => {
  let n = 0;
  for (let i = 3; i < c.data.length; i += 4) if (c.data[i]) n++;
  return n;
};
const differing = (a: PixelCanvas, b: PixelCanvas) => {
  let n = 0;
  for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) n++;
  return n;
};

describe("vitrina de trofeos", () => {
  it("con trofeos es la misma vitrina (mismo tamaño y origen) y cambia más con más logros", () => {
    const empty = trophyCase();
    const few = trophyCase(trophyShelf({ comun: 2 }));
    const many = trophyCase(trophyShelf({ legendario: 1, epico: 2, raro: 4, comun: 10 }));
    for (const s of [few, many]) {
      expect([s.canvas.width, s.canvas.height, s.ox, s.oy]).toEqual([empty.canvas.width, empty.canvas.height, empty.ox, empty.oy]);
    }
    expect(opaque(few.canvas)).toBe(opaque(empty.canvas));
    expect(differing(empty.canvas, few.canvas)).toBeGreaterThan(0);
    expect(differing(empty.canvas, many.canvas)).toBeGreaterThan(differing(empty.canvas, few.canvas));
    // El mueble del catálogo es la vitrina vacía.
    expect(differing(drawFurniture("trophy-case").canvas, empty.canvas)).toBe(0);
  });

  it("un trofeo por logro, lo más difícil primero, sin pasarse de la vitrina", () => {
    expect(trophyShelf({})).toEqual([]);
    expect(trophyShelf({ comun: 1, legendario: 1, raro: 2 })).toEqual(["legendario", "raro", "raro", "comun"]);
    expect(trophyShelf({ comun: 50 })).toHaveLength(TROPHY_CASE_SLOTS);
  });

  it("hay una vitrina con su punto en cada oficina del piso 2, adentro de la oficina", () => {
    const map = getWorld().areas.get("piso-2")!;
    const offices = map.zones.filter((z) => z.type === "office");
    const points = pointsOfType(map, "trophy_case");
    expect(points).toHaveLength(offices.length);
    for (const z of offices) {
      const p = points.find((q) => q.zone === z.id);
      expect(p, z.id).toBeDefined();
      expect(zoneAt(map, p!.x, p!.y)?.id).toBe(z.id);
      const cases = map.furniture.filter((f) => f.type === "trophy-case" && zoneAt(map, f.x * 32 + 16, f.y * 32 + 16)?.id === z.id);
      expect(cases, z.id).toHaveLength(1);
    }
  });
});

describe("insignia chica del nombre", () => {
  it("cada ícono de logro tiene su dibujo de 9x9 y cambia con la rareza", () => {
    for (const icon of BADGE_ICONS) expect(hasMiniBadge(icon), icon).toBe(true);
    for (const a of ACHIEVEMENTS) {
      const c = drawMiniBadge(a.icon, a.rarity);
      expect([c.width, c.height]).toEqual([MINI_BADGE_SIZE, MINI_BADGE_SIZE]);
    }
    const [r0, r1] = ACHIEVEMENT_RARITIES;
    expect(differing(drawMiniBadge("cup", r0), drawMiniBadge("cup", r1))).toBeGreaterThan(0);
    expect(differing(drawMiniBadge("cup", r0), drawMiniBadge("fish", r0))).toBeGreaterThan(0);
  });
});
