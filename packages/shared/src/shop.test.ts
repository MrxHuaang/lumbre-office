import { describe, expect, it } from "vitest";
import { Look } from "./look";
import { missingClothing, paidClothingIn, SHOP_ITEMS, shopItem, ShopBuyBody } from "./shop";

const base = { skin: "#ffdbac", hair: "#3b2219", shirt: "#e76f51", pants: "#264653", accent: "#e0923e" };

describe("tienda", () => {
  it("cada artículo tiene id único y precio entero positivo", () => {
    expect(new Set(SHOP_ITEMS.map((i) => i.id)).size).toBe(SHOP_ITEMS.length);
    for (const i of SHOP_ITEMS) expect(Number.isInteger(i.price) && i.price > 0, i.id).toBe(true);
    expect(shopItem("piano")?.category).toBe("furniture");
  });

  it("la ropa gratis no se cobra y la de pago se detecta", () => {
    const free = Look.parse({ ...base, hairStyle: "bun", accessories: ["glasses", "cap"] });
    expect(paidClothingIn(free)).toEqual([]);
    const paid = Look.parse({ ...base, hairStyle: "braids", accessories: ["scarf"], outfit: "dress" });
    expect(paidClothingIn(paid)).toEqual(["hair:braids", "acc:scarf", "outfit:dress"]);
    expect(missingClothing(paid, ["acc:scarf"])).toEqual(["hair:braids", "outfit:dress"]);
  });

  it("solo un sombrero a la vez y los looks viejos siguen siendo válidos", () => {
    expect(Look.parse({ ...base, hairStyle: "short", accessories: ["beanie", "cap", "glasses"] }).accessories).toEqual(["beanie", "glasses"]);
    expect(Look.safeParse({ ...base, hairStyle: "short", accessories: [] }).success).toBe(true);
  });

  it("la compra pide al menos una unidad", () => {
    expect(ShopBuyBody.parse({ itemId: "plant" }).quantity).toBe(1);
    expect(ShopBuyBody.safeParse({ itemId: "plant", quantity: 0 }).success).toBe(false);
  });
});
