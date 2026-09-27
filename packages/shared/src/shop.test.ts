import { describe, expect, it } from "vitest";
import { Look } from "./look";
import { SHOP_FURNITURE, shopItem, ShopBuyBody } from "./shop";

const base = { skin: "#ffdbac", hair: "#3b2219", shirt: "#e76f51", pants: "#264653", accent: "#e0923e" };

describe("tienda", () => {
  it("cada mueble tiene id único y precio entero positivo", () => {
    expect(new Set(SHOP_FURNITURE.map((i) => i.id)).size).toBe(SHOP_FURNITURE.length);
    for (const i of SHOP_FURNITURE) expect(Number.isInteger(i.price) && i.price > 0, i.id).toBe(true);
    expect(shopItem("piano")?.price).toBe(250);
    expect(shopItem("hair:braids")).toBeUndefined(); // la ropa es gratis: no se vende
  });

  it("la compra pide al menos una unidad", () => {
    expect(ShopBuyBody.parse({ itemId: "plant" }).quantity).toBe(1);
    expect(ShopBuyBody.safeParse({ itemId: "plant", quantity: 0 }).success).toBe(false);
  });
});

describe("look", () => {
  it("solo un sombrero a la vez y los looks viejos siguen siendo válidos", () => {
    expect(Look.parse({ ...base, hairStyle: "short", accessories: ["beanie", "cap", "glasses"] }).accessories).toEqual(["beanie", "glasses"]);
    expect(Look.safeParse({ ...base, hairStyle: "short", accessories: [] }).success).toBe(true);
    expect(Look.parse({ ...base, hairStyle: "braids", accessories: ["scarf"], outfit: "dress" }).outfit).toBe("dress");
  });
});
