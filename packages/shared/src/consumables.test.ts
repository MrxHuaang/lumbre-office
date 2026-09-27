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
  usesOf,
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
});
