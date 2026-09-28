import { describe, expect, it } from "vitest";
import {
  BAR_CATEGORIES,
  BAR_MENU,
  BarOrderMessage,
  CAFE_CATEGORIES,
  CAFE_MENU,
  CINEMA_MENU,
  CafeOrderMessage,
  CinemaOrderMessage,
  MENUS,
  barItemsIn,
  barRefId,
  cafeItem,
  cafeItemsIn,
  cafeRefId,
  heldParts,
  menuItem,
} from "./cafe";
import { FREE_HOLDS } from "./casa";
import { ALCOHOL_PER_SIP, CONSUMABLES } from "./consumables";

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
    expect(heldParts("sancocho")).toEqual([]);
  });
});

describe("carta del bar del club", () => {
  it("ids únicos entre las dos cartas y precios enteros positivos", () => {
    const all = [...CAFE_MENU, ...BAR_MENU, ...CINEMA_MENU];
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

  it("la carta del bar va por secciones, todas con algo, y lo colombiano está", () => {
    const ids = BAR_MENU.map((i) => i.id);
    for (const id of ["aguardiente", "ron-viejo", "refajo", "michelada", "canelazo", "coco-loco", "chicha", "pola-dorada", "mojito", "cuba-libre", "lulada-ron", "tequila"])
      expect(ids, id).toContain(id);
    for (const i of BAR_MENU) expect(BAR_CATEGORIES.map((c) => c.id), i.id).toContain(i.category);
    for (const c of BAR_CATEGORIES) expect(barItemsIn(c.id).length, c.id).toBeGreaterThan(0);
    expect(barItemsIn("combos").every((i) => i.kind === "combo")).toBe(true);
    expect(barItemsIn("humo").every((i) => i.kind === "smoke")).toBe(true);
  });

  it("todos los tragos emborrachan, según lo fuertes que son", () => {
    for (const item of BAR_MENU.filter((i) => i.kind === "drink"))
      for (const part of item.holds) expect(ALCOHOL_PER_SIP[part], part).toBeGreaterThan(0);
    // Por sorbo: el guaro y el tequila pegan más que la pola; el refajo y la chicha, menos que la cerveza.
    const sip = (id: string) => ALCOHOL_PER_SIP[id]!;
    expect(sip("aguardiente")).toBeGreaterThan(sip("pola-dorada"));
    expect(sip("tequila")).toBeGreaterThan(sip("cerveza"));
    expect(sip("refajo")).toBeLessThan(sip("cerveza"));
    expect(sip("chicha")).toBeLessThan(sip("cerveza"));
    // Nada de la cafetería ni del cine emborracha.
    for (const item of [...CAFE_MENU, ...CINEMA_MENU]) for (const part of item.holds) expect(ALCOHOL_PER_SIP[part], part).toBeUndefined();
  });

  it("todo lo que se lleva en la mano se puede usar", () => {
    for (const item of [...CAFE_MENU, ...BAR_MENU, ...CINEMA_MENU]) for (const part of item.holds) expect(CONSUMABLES[part], part).toBeDefined();
  });
});

describe("confitería del cine", () => {
  it("se pide junto a la máquina de crispetas, con su propio mensaje, y el combo sale más barato", () => {
    expect(MENUS.cine.point).toBe("cinema_snacks");
    expect(MENUS.cine.furniture).toContain("popcorn-machine");
    expect(menuItem("crispetas")?.menu).toBe("cine");
    expect(CinemaOrderMessage.safeParse({ item: "combo-cine" }).success).toBe(true);
    expect(CinemaOrderMessage.safeParse({ item: "whisky" }).success).toBe(false);
    expect(heldParts("combo-cine")).toEqual(["crispetas", "coca-cola"]);
    const price = (id: string) => CINEMA_MENU.find((i) => i.id === id)!.price;
    expect(price("combo-cine")).toBeLessThan(price("crispetas") + price("gaseosa-cine"));
    for (const i of CINEMA_MENU) expect(Number.isInteger(i.price) && i.price > 0, i.id).toBe(true);
  });
});
