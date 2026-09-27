import { describe, expect, it } from "vitest";
import { BAR_MENU, BarOrderMessage, CAFE_MENU, CafeOrderMessage, MENUS, barRefId, cafeItem, cafeRefId, heldParts, menuItem } from "./cafe";
import { CONSUMABLES } from "./consumables";

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
    expect(heldParts("mojito")).toEqual([]);
  });
});

describe("carta del bar del club", () => {
  it("ids únicos entre las dos cartas y precios enteros positivos", () => {
    const all = [...CAFE_MENU, ...BAR_MENU];
    expect(new Set(all.map((i) => i.id)).size).toBe(all.length);
    for (const i of BAR_MENU) expect(Number.isInteger(i.price) && i.price > 0, i.id).toBe(true);
  });

  it("tiene tragos, cigarro y habano, y cada carta se pide en su barra", () => {
    const ids = BAR_MENU.map((i) => i.id);
    for (const id of ["cerveza", "vino", "whisky", "coctel", "cigarro-club", "habano"]) expect(ids).toContain(id);
    expect(BarOrderMessage.safeParse({ item: "whisky" }).success).toBe(true);
    expect(BarOrderMessage.safeParse({ item: "tinto" }).success).toBe(false);
    expect(CafeOrderMessage.safeParse({ item: "whisky" }).success).toBe(false);
    expect(menuItem("whisky")?.menu).toBe("bar");
    expect(menuItem("tinto")?.menu).toBe("cafe");
    expect(MENUS.bar.point).toBe("club_bar");
    expect(barRefId("habano")).toBe("bar:habano");
    expect(heldParts("padrino")).toEqual(["whisky", "habano"]);
  });

  it("los combos salen más baratos que por separado", () => {
    const single = (part: string) => BAR_MENU.find((i) => i.holds.length === 1 && i.holds[0] === part)?.price ?? 0;
    for (const combo of BAR_MENU.filter((i) => i.kind === "combo")) {
      const separate = combo.holds.reduce((sum, part) => sum + single(part), 0);
      expect(combo.price, combo.id).toBeLessThan(separate);
    }
  });

  it("todo lo que se lleva en la mano se puede usar", () => {
    for (const item of [...CAFE_MENU, ...BAR_MENU]) for (const part of item.holds) expect(CONSUMABLES[part], part).toBeDefined();
  });
});
