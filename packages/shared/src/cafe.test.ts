import { describe, expect, it } from "vitest";
import { CAFE_MENU, CafeOrderMessage, cafeItem, cafeRefId } from "./cafe";

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
