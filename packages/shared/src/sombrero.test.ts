import { describe, expect, it } from "vitest";
import { ALCOHOL_PER_SIP, CONSUMABLES, usesOf } from "./consumables";
import { BAR_MENU, CAFE_MENU, CINEMA_MENU, heldParts } from "./cafe";
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
  TRIP_KINDS,
  TRIP_PER_USE,
  TRIP_TEXT,
  isTripKind,
  tripSpeedMul,
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

  it("la mercancía nueva: ids que no se repiten con ninguna carta, precios enteros y efectos que existen", () => {
    const all = [...CAFE_MENU, ...BAR_MENU, ...CINEMA_MENU, ...SOMBRERO_MENU].map((i) => i.id);
    expect(new Set(all).size).toBe(all.length);
    for (const item of SOMBRERO_MENU) {
      expect(Number.isInteger(item.price) && item.price > 0, item.id).toBe(true);
      expect(item.blurb.length, item.id).toBeGreaterThan(10);
      expect(item.effect.length, item.id).toBeGreaterThan(5);
    }
    for (const id of ["popper", "tusi", "keta", "chicle-mambe", "aguapanela-trucada", "galleta-abuela"]) expect(SOMBRERO_ITEM_IDS).toContain(id);
    for (const [art, use] of Object.entries(TRIP_PER_USE)) {
      expect(isTripKind(use.kind), art).toBe(true);
      expect(use.ms, art).toBeGreaterThan(0);
      expect(use.ms, art).toBeLessThanOrEqual(TRIP.maxMs);
    }
    for (const kind of TRIP_KINDS) expect(TRIP_TEXT[kind], kind).toBeTruthy();
    // Los efectos nuevos: el tusi y la keta tienen el suyo; el popper se esnifa y dura poquito.
    expect(TRIP_PER_USE.tusi?.kind).toBe("tusi");
    expect(TRIP_PER_USE.keta?.kind).toBe("keta");
    expect(CONSUMABLES.popper?.action).toBe("sniff");
    expect(TRIP_PER_USE.popper!.ms).toBeLessThan(TRIP_PER_USE["perico-bolsa"]!.ms);
    expect(isTripKind("bazuco")).toBe(false);
  });

  it("trabado y con la keta se camina más despacio (la keta, más); lo demás no cambia el paso", () => {
    expect(tripSpeedMul("trabado")).toBe(TRIP.slowSpeedMul);
    expect(tripSpeedMul("keta")).toBe(TRIP.ketaSpeedMul);
    expect(TRIP.ketaSpeedMul).toBeLessThan(TRIP.slowSpeedMul);
    for (const kind of ["acelere", "colores", "yage", "tusi", "", null, undefined] as const) expect(tripSpeedMul(kind)).toBe(1);
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
