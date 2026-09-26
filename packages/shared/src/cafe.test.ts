import { describe, expect, it } from "vitest";
import { CAFE_MENU, CafeOrderMessage, cafeItem, cafeRefId, heldParts } from "./cafe";

describe("menú de la cafetería", () => {
  it("cada producto tiene id único y precio entero positivo", () => {
    expect(new Set(CAFE_MENU.map((i) => i.id)).size).toBe(CAFE_MENU.length);
    for (const i of CAFE_MENU) expect(Number.isInteger(i.price) && i.price > 0, i.id).toBe(true);
  });

  it("solo se pueden pedir productos del menú", () => {
    expect(CafeOrderMessage.safeParse({ item: "tinto" }).success).toBe(true);
    expect(CafeOrderMessage.safeParse({ item: "cerveza" }).success).toBe(false);
    expect(cafeItem("torta")?.price).toBe(12);
    expect(cafeRefId("tinto")).toBe("cafe:tinto");
  });
});

describe("combos", () => {
  it("el desayuno lleva algo en cada mano y sale más barato que por separado", () => {
    for (const id of ["desayuno-tinto", "desayuno-coca"]) {
      const combo = cafeItem(id)!;
      expect(combo.holds).toHaveLength(2);
      const separate = combo.holds.reduce((sum, part) => sum + cafeItem(part)!.price, 0);
      expect(combo.price, id).toBeLessThan(separate);
    }
    expect(heldParts("tinto")).toEqual(["tinto"]);
    expect(heldParts("cerveza")).toEqual([]);
  });
});
