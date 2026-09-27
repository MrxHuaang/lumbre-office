import { describe, expect, it } from "vitest";
import { acceptEmote, EMOTE, EMOTE_IDS, EMOTES } from "./emotes";
import { describeBundle, GIFT, giftAllowedToday, GiftCreateBody, itemName, TRADE, tradeGap, TradeOfferMessage, tradeReach } from "./social";

describe("regalos", () => {
  it("lleva puntos, un objeto o las dos cosas", () => {
    expect(GiftCreateBody.safeParse({ toId: "u1", points: 10 }).success).toBe(true);
    expect(GiftCreateBody.safeParse({ toId: "u1", itemId: "plant", quantity: 2 }).success).toBe(true);
    expect(GiftCreateBody.safeParse({ toId: "u1", points: 5, itemId: "plant", quantity: 1, note: "¡Para ti!" }).success).toBe(true);
    expect(GiftCreateBody.safeParse({ toId: "u1" }).success).toBe(false);
    expect(GiftCreateBody.safeParse({ toId: "u1", itemId: "plant", quantity: 0 }).success).toBe(false);
    expect(GiftCreateBody.safeParse({ toId: "u1", quantity: 2 }).success).toBe(false);
  });

  it("respeta los topes de puntos, unidades y nota", () => {
    expect(GiftCreateBody.safeParse({ toId: "u1", points: GIFT.maxPoints + 1 }).success).toBe(false);
    expect(GiftCreateBody.safeParse({ toId: "u1", points: -5 }).success).toBe(false);
    expect(GiftCreateBody.safeParse({ toId: "u1", itemId: "plant", quantity: GIFT.maxQuantity + 1 }).success).toBe(false);
    expect(GiftCreateBody.safeParse({ toId: "u1", points: 1, note: "x".repeat(GIFT.noteMax + 1) }).success).toBe(false);
    // La nota se recorta: los espacios de los bordes no cuentan.
    expect(GiftCreateBody.parse({ toId: "u1", points: 1, note: `  ${"x".repeat(GIFT.noteMax)}  ` }).note).toHaveLength(GIFT.noteMax);
    expect(GiftCreateBody.safeParse({ toId: "u1", itemId: "../x", quantity: 1 }).success).toBe(false);
  });

  it("tope diario de regalos, de puntos y de muebles regalados", () => {
    expect(giftAllowedToday({ gifts: 0, points: 0, items: 0 }, 100)).toBe("ok");
    expect(giftAllowedToday({ gifts: GIFT.dailyGifts, points: 0, items: 0 }, 1)).toBe("gifts");
    expect(giftAllowedToday({ gifts: 1, points: GIFT.dailyPoints - 10, items: 0 }, 11)).toBe("points");
    expect(giftAllowedToday({ gifts: 1, points: GIFT.dailyPoints - 10, items: 0 }, 10)).toBe("ok");
    expect(giftAllowedToday({ gifts: 1, points: 0, items: GIFT.dailyItems - 2 }, 0, 3)).toBe("items");
    expect(giftAllowedToday({ gifts: 1, points: 0, items: GIFT.dailyItems - 2 }, 0, 2)).toBe("ok");
    // Ya pasado del tope de muebles, dar solo puntos sigue valiendo.
    expect(giftAllowedToday({ gifts: 1, points: 0, items: GIFT.dailyItems }, 5)).toBe("ok");
  });

  it("describe lo que trae", () => {
    expect(describeBundle(50, [])).toBe("50 puntos");
    expect(describeBundle(1, [{ itemId: "plant", quantity: 2 }])).toBe("1 punto y 2 × Planta");
    expect(describeBundle(0, [{ itemId: "sofa", quantity: 1 }, { itemId: "piano", quantity: 1 }])).toBe("Sofá y Piano");
    expect(describeBundle(0, [])).toBe("nada");
    expect(itemName("algo-nuevo")).toBe("algo-nuevo");
  });
});

describe("intercambios", () => {
  it("la oferta respeta los topes y no repite objetos", () => {
    expect(TradeOfferMessage.safeParse({ points: 10, items: [{ itemId: "plant", quantity: 2 }] }).success).toBe(true);
    expect(TradeOfferMessage.safeParse({ points: TRADE.maxPoints + 1, items: [] }).success).toBe(false);
    expect(TradeOfferMessage.safeParse({ points: 0, items: [{ itemId: "plant", quantity: 1 }, { itemId: "plant", quantity: 1 }] }).success).toBe(false);
    const many = Array.from({ length: TRADE.maxSlots + 1 }, (_, i) => ({ itemId: `item-${i}`, quantity: 1 }));
    expect(TradeOfferMessage.safeParse({ points: 0, items: many }).success).toBe(false);
    // Cada lado pone hasta TRADE.maxUnits muebles en total, aunque cada objeto quepa por separado.
    const units = (q: number[]) => ({ points: 0, items: q.map((quantity, i) => ({ itemId: `item-${i}`, quantity })) });
    expect(TradeOfferMessage.safeParse(units([5, 5])).success).toBe(true);
    expect(TradeOfferMessage.safeParse(units([5, 5, 1])).success).toBe(false);
  });

  it("los dos lados tienen que poner algo", () => {
    const nada = { points: 0, items: [] };
    expect(tradeGap(nada, nada)).toBe("empty");
    expect(tradeGap({ points: 1000, items: [] }, nada)).toBe("one-sided");
    expect(tradeGap(nada, { points: 0, items: [{ itemId: "sofa", quantity: 10 }] })).toBe("one-sided");
    expect(tradeGap({ points: 5, items: [] }, { points: 0, items: [{ itemId: "sofa", quantity: 1 }] })).toBe("ok");
  });

  it("hay que estar cerca y en el mismo nivel", () => {
    const a = { area: "jardin", x: 100, y: 100 };
    expect(tradeReach(a, { area: "jardin", x: 100 + TRADE.reachPx, y: 100 })).toBe(true);
    expect(tradeReach(a, { area: "jardin", x: 101 + TRADE.reachPx, y: 100 })).toBe(false);
    expect(tradeReach(a, { area: "planta-baja", x: 100, y: 100 })).toBe(false);
  });
});

describe("emotes", () => {
  it("son unos 16, con id y nombre únicos", () => {
    expect(EMOTES.length).toBeGreaterThanOrEqual(16);
    expect(new Set(EMOTE_IDS).size).toBe(EMOTES.length);
    expect(new Set(EMOTES.map((e) => e.name)).size).toBe(EMOTES.length);
  });

  it("pausa entre emotes y tope por ráfaga", () => {
    const times: number[] = [];
    expect(acceptEmote(times, 0)).toBe(true);
    expect(acceptEmote(times, EMOTE.cooldownMs - 1)).toBe(false);
    let t = 0;
    for (let i = 1; i < EMOTE.burst; i++) expect(acceptEmote(times, (t += EMOTE.cooldownMs))).toBe(true);
    expect(acceptEmote(times, (t += EMOTE.cooldownMs))).toBe(false); // llenó la ráfaga
    expect(acceptEmote(times, EMOTE.burstWindowMs + 1)).toBe(true); // el primero ya salió de la ventana
  });
});
