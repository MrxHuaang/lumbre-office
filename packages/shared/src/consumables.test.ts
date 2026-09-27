import { describe, expect, it } from "vitest";
import {
  CONSUMABLES,
  FurnitureUseMessage,
  UseHeldMessage,
  USABLE_FURNITURE,
  formatHeldLeft,
  furnitureKey,
  isSwitchedOn,
  parseHeldLeft,
  stepsTo,
  usesOf,
  type WallGrid,
} from "./consumables";

describe("consumibles", () => {
  it("cada cosa tiene al menos un uso y una acción conocida", () => {
    for (const [id, c] of Object.entries(CONSUMABLES)) {
      expect(c.uses, id).toBeGreaterThan(0);
      expect(["smoke", "sip", "bite"]).toContain(c.action);
    }
    expect(usesOf("desconocido")).toBe(1);
  });

  it("los usos que quedan viajan como texto", () => {
    expect(parseHeldLeft("")).toEqual([]);
    expect(parseHeldLeft("4,5")).toEqual([4, 5]);
    expect(parseHeldLeft("x,-2")).toEqual([0, 0]);
    expect(formatHeldLeft([3, 0])).toBe("3,0");
  });

  it("el mensaje de usar acepta nada o una mano válida", () => {
    expect(UseHeldMessage.safeParse(undefined).success).toBe(true);
    expect(UseHeldMessage.safeParse({ part: 1 }).success).toBe(true);
    expect(UseHeldMessage.safeParse({ part: 2 }).success).toBe(false);
  });
});

describe("muebles que se usan", () => {
  it("las lámparas arrancan prendidas y la tele apagada", () => {
    const none = new Map<string, boolean>();
    expect(isSwitchedOn(none, "piso-2", "lamp", 1, 2)).toBe(true);
    expect(isSwitchedOn(none, "piso-2", "tv-retro", 1, 2)).toBe(false);
    const switched = new Map([[furnitureKey("piso-2", "lamp", 1, 2), false]]);
    expect(isSwitchedOn(switched, "piso-2", "lamp", 1, 2)).toBe(false);
  });

  it("cada mueble tiene su ayuda y una pausa", () => {
    for (const [type, spec] of Object.entries(USABLE_FURNITURE)) {
      expect(spec.label.length, type).toBeGreaterThan(0);
      expect(spec.cooldownMs, type).toBeGreaterThan(0);
      if (spec.action === "toggle") expect(spec.labelOn, type).toBeTruthy();
    }
    expect(FurnitureUseMessage.safeParse({ type: "piano", x: 3, y: 4 }).success).toBe(true);
    expect(FurnitureUseMessage.safeParse({ type: "piano", x: -1, y: 4 }).success).toBe(false);
  });

  it("los pasos hasta un mueble no cruzan paredes: dan la vuelta por la puerta o no llegan", () => {
    // 6x4 con una pared vertical en x = 3 (entre las columnas 2 y 3), abierta solo en y = 3.
    const width = 6;
    const height = 4;
    const g: WallGrid = { width, height, wallH: new Uint8Array((height + 1) * width), wallV: new Uint8Array(height * (width + 1)) };
    for (let y = 0; y < 3; y++) (g.wallV as Uint8Array)[y * (width + 1) + 3] = 1;
    const lamp = { x: 3, y: 0, w: 1, d: 1 };
    expect(stepsTo(g, 3, 0, lamp, 3)).toBe(0);
    expect(stepsTo(g, 4, 1, lamp, 3)).toBe(2);
    // Del otro lado de la pared, pegado a la lámpara: el camino da la vuelta por la puerta (y = 3).
    expect(stepsTo(g, 2, 0, lamp, 3)).toBe(Infinity);
    expect(stepsTo(g, 2, 0, lamp, 10)).toBe(7);
    expect(stepsTo(g, -1, 0, lamp, 10)).toBe(Infinity);
  });
});
