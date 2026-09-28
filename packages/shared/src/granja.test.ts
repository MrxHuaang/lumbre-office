import { describe, expect, it } from "vitest";
import { BAG_OBJECTS, bagItemInfo } from "./bolsa";
import { BAR_MENU, CAFE_MENU, heldParts } from "./cafe";
import { isFreeHold } from "./casa";
import { RECIPES } from "./cocina";
import { CONSUMABLES, usableSpec } from "./consumables";
import { careStreak, eggDayOf, FARM_ANIMALS, feedPointsFor, GALLINERO, GRANJA_USABLES, tallyVotes, voteOption, voteValue, winningName } from "./granja";
import { GRANJA_OBJECTS, GRILL_RECIPES, grillMissing, grillProgress, grillRate, PARRILLA, PARRILLA_CONSUMABLES, portionOf } from "./parrilla";
import { GAME_DAY_REAL_MS } from "./clock";

describe("gallinero", () => {
  it("la racha: sigue si fue ayer, vuelve a 1 si se saltó un día, y nada si hoy ya les dio", () => {
    expect(careStreak(undefined, undefined, 100)).toEqual({ since: 100, streak: 1 });
    expect(careStreak(99, 95, 100)).toEqual({ since: 95, streak: 6 });
    expect(careStreak(98, 95, 100)).toEqual({ since: 100, streak: 1 });
    expect(careStreak(100, 95, 100)).toBeNull();
    expect(feedPointsFor(1)).toBe(GALLINERO.feedPoints);
    expect(feedPointsFor(100)).toBe(GALLINERO.feedPoints + GALLINERO.streakBonusMax);
  });

  it("el voto es un número que solo sube (vale el último) y guarda la opción", () => {
    const t = Date.UTC(2026, 8, 28);
    const a = voteValue(3, t);
    const b = voteValue(1, t + 60_000);
    expect(b).toBeGreaterThan(a);
    expect(voteOption(a)).toBe(3);
    expect(voteOption(b)).toBe(1);
    // Cabe en el entero de UserStat por siglos.
    expect(voteValue(7, Date.UTC(2126, 0, 1))).toBeLessThan(2 ** 31);
  });

  it("gana el nombre más votado (en un empate, el primero de la lista)", () => {
    const hen = FARM_ANIMALS[0]!;
    const tally = tallyVotes([{ [hen.id]: 2 }, { [hen.id]: 2 }, { [hen.id]: 1 }, { dragón: 0 }]);
    expect(tally[hen.id]).toEqual([0, 1, 2, 0]);
    expect(winningName(hen, tally[hen.id])).toBe(hen.names[2]);
    expect(winningName(hen, [1, 1, 0, 0])).toBe(hen.names[0]);
    expect(winningName(hen, undefined)).toBe(hen.names[0]);
  });

  it("los huevos cambian de día al amanecer del juego", () => {
    const c = { anchorReal: 0, anchorMinute: 0 };
    const minute = GAME_DAY_REAL_MS / 1440;
    expect(eggDayOf(c, 5 * 60 * minute)).toBe(-1);
    expect(eggDayOf(c, 6 * 60 * minute)).toBe(0);
    expect(eggDayOf(c, (24 + 6) * 60 * minute)).toBe(1);
  });

  it("el comedero, el nido y el molino se usan con E", () => {
    for (const type of Object.keys(GRANJA_USABLES)) expect(usableSpec(type), type).toBeDefined();
  });
});

describe("parrilla", () => {
  it("más gente cocinando va más rápido, con tope", () => {
    expect(grillRate(1)).toBe(1);
    expect(grillRate(2)).toBe(1 + PARRILLA.boostPerCook);
    expect(grillRate(10)).toBe(grillRate(PARRILLA.maxCooks));
    const job = { progress: 0.5, rate: 2, at: 1000, cookMs: 10_000 };
    expect(grillProgress(job, 1000)).toBe(0.5);
    expect(grillProgress(job, 3500)).toBe(1);
    expect(grillProgress(job, 2000)).toBeCloseTo(0.7);
  });

  it("los ids no chocan con la cocina de la casa ni con las cartas", () => {
    const others = new Set([...RECIPES.map((r) => r.id), ...CAFE_MENU.map((i) => i.id), ...BAR_MENU.map((i) => i.id), ...CAFE_MENU.flatMap((i) => i.holds)]);
    for (const o of GRANJA_OBJECTS) expect(others.has(o.id), o.id).toBe(false);
  });

  it("cada plato se come con F por porciones y su porción también; todo está en la mochila con nombre", () => {
    for (const r of GRILL_RECIPES) {
      expect(CONSUMABLES[r.id]?.uses, r.id).toBe(r.portions);
      expect(CONSUMABLES[portionOf(r.id)]?.uses, r.id).toBeGreaterThanOrEqual(2);
      expect(isFreeHold(r.id)).toBe(true);
      expect(heldParts(r.id)).toEqual([r.id]);
      expect(bagItemInfo(`obj:${r.id}`).use).toBe("consume");
      expect(r.portions).toBeGreaterThanOrEqual(2);
    }
    for (const o of GRANJA_OBJECTS) expect(BAG_OBJECTS[o.id]?.name, o.id).toBe(o.name);
    expect(Object.keys(PARRILLA_CONSUMABLES)).toHaveLength(GRILL_RECIPES.length * 2);
  });

  it("lo que falta para una receta", () => {
    const pizza = GRILL_RECIPES.find((r) => r.id === "pizza-horno")!;
    expect(grillMissing(pizza, { harina: 1, huevo: 1, tomate: 1, queso: 1 })).toEqual({ harina: 1 });
    expect(grillMissing(pizza, { harina: 2, huevo: 1, tomate: 1, queso: 1 })).toEqual({});
  });
});
