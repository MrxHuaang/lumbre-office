import { BAR_MENU, CAFE_MENU, CONSUMABLES, usesOf } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { drawFurniture } from "./furniture";
import { CAFE_ITEM_ART, drawHeldItem, drawMenuItem, heldEffect } from "./items";
import { lampLit, lampOff, tvScreenOff, tvScreenOn, vinylSpin } from "./usables";

const opaque = (c: { data: Uint8ClampedArray }) => {
  let n = 0;
  for (let i = 3; i < c.data.length; i += 4) if (c.data[i]) n++;
  return n;
};

describe("lo que se lleva en la mano", () => {
  it("todo lo que se puede consumir tiene dibujo, y todo lo de las cartas también", () => {
    for (const art of Object.keys(CONSUMABLES)) expect(CAFE_ITEM_ART, art).toContain(art);
    for (const item of [...CAFE_MENU, ...BAR_MENU]) {
      for (const part of item.holds) expect(CAFE_ITEM_ART, `${item.id}: ${part}`).toContain(part);
      expect(opaque(drawMenuItem(item.id)), item.id).toBeGreaterThan(8);
    }
  });

  it("caben en la mano del chibi (chiquitos, como el resto)", () => {
    for (const art of CAFE_ITEM_ART) {
      const c = drawHeldItem(art);
      expect(c.width, art).toBeLessThanOrEqual(10);
      expect(c.height, art).toBeLessThanOrEqual(10);
    }
  });

  it("lo que se come a cucharadas se va vaciando hasta dejar ver el plato o el vaso", () => {
    for (const art of Object.keys(CONSUMABLES).filter((a) => CONSUMABLES[a]!.action === "spoon")) {
      const full = drawHeldItem(art);
      const last = drawHeldItem(art, { left: 1 });
      // No se muerde: la silueta queda igual y cambia lo de adentro.
      expect([last.width, last.height], art).toEqual([full.width, full.height]);
      expect(full.data.some((v, i) => v !== last.data[i]), art).toBe(true);
    }
  });

  it("con cada uso cambia el dibujo (se vacía, se muerde o se acorta), sin desaparecer antes de tiempo", () => {
    for (const art of Object.keys(CONSUMABLES)) {
      const states = Array.from({ length: usesOf(art) }, (_, k) => drawHeldItem(art, { left: usesOf(art) - k }));
      for (const s of states) expect(opaque(s), art).toBeGreaterThan(6);
      const first = states[0]!;
      const last = states.at(-1)!;
      const changed = first.width !== last.width || first.data.some((v, i) => v !== last.data[i]);
      // La lata no muestra el líquido: se ve igual hasta el último sorbo (las tazas muestran la superficie).
      if (art === "coca-cola") continue;
      expect(changed, art).toBe(true);
    }
  });

  it("el cigarro se acorta y el humo sale siempre de la brasa", () => {
    const full = drawHeldItem("cigarro");
    const short = drawHeldItem("cigarro", { left: 1 });
    expect(short.width).toBeLessThan(full.width);
    const fx = heldEffect("cigarro", 1)!;
    expect(fx.fx).toBe("smoke");
    expect(fx.from[0]).toBe(short.width - 1);
  });

  it("inclinado para el sorbo sigue siendo el mismo vaso, corrido hacia un lado", () => {
    const up = drawHeldItem("cerveza");
    const tilted = drawHeldItem("cerveza", { tilt: 1 });
    expect(tilted.width).toBeGreaterThan(up.width);
  });
});

describe("capas de los muebles que se usan", () => {
  it("tienen el tamaño y el origen del dibujo del mueble (caen justo encima)", () => {
    const cases: [string, { canvas: { width: number; height: number }; ox: number; oy: number }][] = [
      ["tv-retro", tvScreenOff()],
      ["tv-retro", tvScreenOn(1)],
      ["lamp", lampLit()],
      ["lamp", lampOff()],
      ["record-player", vinylSpin(2)],
    ];
    for (const [type, layer] of cases) {
      const base = drawFurniture(type, "front");
      expect([layer.canvas.width, layer.canvas.height, layer.ox, layer.oy], type).toEqual([base.canvas.width, base.canvas.height, base.ox, base.oy]);
      expect(opaque(layer.canvas as never), type).toBeGreaterThan(0);
    }
  });
});
