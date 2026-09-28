import { describe, expect, it } from "vitest";
import { ALCOHOL_PER_SIP, CONSUMABLES, usesOf } from "./consumables";
import { heldParts } from "./cafe";
import {
  addTrip,
  isSombreroHour,
  nextHideout,
  SOMBRERO_HIDEOUTS,
  SOMBRERO_ITEM_IDS,
  SOMBRERO_MENU,
  SombreroBuyMessage,
  sombreroOut,
  TRIP,
  TRIP_PER_USE,
} from "./sombrero";

describe("el Man del Sombrero", () => {
  it("sale en sus franjas del reloj del juego y no fuera de ellas", () => {
    expect(isSombreroHour(2 * 60)).toBe(true);
    expect(isSombreroHour(3 * 60 + 59)).toBe(true);
    expect(isSombreroHour(4 * 60)).toBe(false);
    expect(isSombreroHour(13 * 60 + 15)).toBe(true);
    expect(isSombreroHour(14 * 60 + 30)).toBe(false);
    expect(isSombreroHour(22 * 60)).toBe(true);
    expect(isSombreroHour(10 * 60)).toBe(false);
  });

  it("con tormenta sale a cualquier hora", () => {
    expect(sombreroOut(10 * 60, "despejado")).toBe(false);
    expect(sombreroOut(10 * 60, "lluvia")).toBe(false);
    expect(sombreroOut(10 * 60, "tormenta")).toBe(true);
    expect(sombreroOut(22 * 60, "despejado")).toBe(true);
  });

  it("tiene entre 4 y 6 escondites, con ids distintos", () => {
    expect(SOMBRERO_HIDEOUTS.length).toBeGreaterThanOrEqual(4);
    expect(SOMBRERO_HIDEOUTS.length).toBeLessThanOrEqual(6);
    expect(new Set(SOMBRERO_HIDEOUTS.map((h) => h.id)).size).toBe(SOMBRERO_HIDEOUTS.length);
  });

  it("cada día elige un escondite distinto al de ayer", () => {
    const n = SOMBRERO_HIDEOUTS.length;
    for (let prev = 0; prev < n; prev++)
      for (let r = 0; r < n - 1; r++) {
        const next = nextHideout(prev, () => r);
        expect(next).not.toBe(prev);
        expect(next).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThan(n);
      }
    expect(nextHideout(-1, () => 3)).toBe(3);
  });

  it("todo lo de la carta se lleva en la mano, se usa y tiene un efecto o emborracha", () => {
    for (const item of SOMBRERO_MENU) {
      expect(heldParts(item.id), item.id).toEqual(item.holds);
      for (const art of item.holds) {
        expect(CONSUMABLES[art], art).toBeDefined();
        expect(usesOf(art)).toBeGreaterThan(0);
        expect(Boolean(TRIP_PER_USE[art]) || Boolean(ALCOHOL_PER_SIP[art]), art).toBe(true);
      }
      expect(item.price).toBeGreaterThan(0);
    }
    // El perico se esnifa; la bareta se fuma.
    expect(CONSUMABLES["perico-bolsa"]?.action).toBe("sniff");
    expect(CONSUMABLES.bareta?.action).toBe("smoke");
    // El chirrinchi pega más que el whisky del bar.
    expect(ALCOHOL_PER_SIP.chirrinchi).toBeGreaterThan(ALCOHOL_PER_SIP.whisky!);
    // No pisa el perico de la cafetería (el tinto con leche).
    expect(CONSUMABLES.perico?.action).toBe("sip");
  });

  it("el mensaje de compra solo acepta lo de su carta", () => {
    expect(SombreroBuyMessage.safeParse({ item: SOMBRERO_ITEM_IDS[0] }).success).toBe(true);
    expect(SombreroBuyMessage.safeParse({ item: "tinto" }).success).toBe(false);
  });

  it("el mismo efecto se suma hasta el tope y otro lo reemplaza", () => {
    const now = 1000;
    const a = addTrip(null, { kind: "trabado", ms: 60_000 }, now);
    expect(a).toEqual({ kind: "trabado", until: now + 60_000 });
    const b = addTrip(a, { kind: "trabado", ms: 60_000 }, now + 10_000);
    expect(b.until).toBe(now + 120_000);
    const capped = addTrip({ kind: "trabado", until: now + TRIP.maxMs }, { kind: "trabado", ms: 60_000 }, now);
    expect(capped.until).toBe(now + TRIP.maxMs);
    const other = addTrip(b, { kind: "colores", ms: 30_000 }, now + 20_000);
    expect(other).toEqual({ kind: "colores", until: now + 50_000 });
  });
});
