import { describe, expect, it } from "vitest";
import {
  BAR_MENU,
  BarOrderMessage,
  CAFE_CATEGORIES,
  CAFE_MENU,
  CafeOrderMessage,
  MENUS,
  barRefId,
  cafeItem,
  cafeItemsIn,
  cafeRefId,
  heldParts,
  menuItem,
} from "./cafe";
import { FREE_HOLDS } from "./casa";
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

describe("carta colombiana", () => {
  it("tiene mucha variedad: cada sección con lo suyo y todo producto en una sección conocida", () => {
    expect(CAFE_MENU.length).toBeGreaterThanOrEqual(50);
    const known = new Set<string>(CAFE_CATEGORIES.map((c) => c.id));
    for (const item of CAFE_MENU) expect(known.has(item.category), item.id).toBe(true);
    for (const c of CAFE_CATEGORIES) expect(cafeItemsIn(c.id).length, c.id).toBeGreaterThan(0);
    expect(CAFE_CATEGORIES.reduce((n, c) => n + cafeItemsIn(c.id).length, 0)).toBe(CAFE_MENU.length);
    // Algunos clásicos que no pueden faltar.
    for (const id of ["perico", "jugo-lulo", "almojabana", "empanada", "arepa-huevo", "tamal", "cholado", "bocadillo"]) {
      expect(cafeItem(id), id).toBeDefined();
      expect(CafeOrderMessage.safeParse({ item: id }).success, id).toBe(true);
    }
  });

  it("los precios se quedan en el rango de la cafetería y cada producto dice algo", () => {
    for (const i of CAFE_MENU) {
      expect(i.price, i.id).toBeGreaterThanOrEqual(3);
      expect(i.price, i.id).toBeLessThanOrEqual(12);
      expect(i.blurb.length, i.id).toBeGreaterThan(8);
    }
  });

  it("lo del menú y lo gratis de la casa no comparten id (lo que se lleva en la mano se guarda por id)", () => {
    for (const i of CAFE_MENU) expect(Object.hasOwn(FREE_HOLDS, i.id), i.id).toBe(false);
  });
});

describe("combos", () => {
  it("cada combo lleva algo en cada mano y sale más barato que por separado", () => {
    const single = (part: string) => CAFE_MENU.find((i) => i.kind !== "combo" && i.holds.length === 1 && i.holds[0] === part)!.price;
    const combos = CAFE_MENU.filter((i) => i.kind === "combo");
    expect(combos.length).toBeGreaterThanOrEqual(6);
    for (const combo of combos) {
      expect(combo.holds, combo.id).toHaveLength(2);
      expect(combo.category, combo.id).toBe("combos");
      const separate = combo.holds.reduce((sum, part) => sum + single(part), 0);
      expect(combo.price, combo.id).toBeLessThan(separate);
    }
    expect(heldParts("onces")).toEqual(["tinto", "pandebono"]);
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
    // La barra nueva del club tiene grifos: un clic ahí también abre la carta.
    expect(MENUS.bar.furniture).toEqual(expect.arrayContaining(["bar-counter", "bar-shelf", "bar-taps"]));
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
