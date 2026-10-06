import { describe, expect, it } from "vitest";
import { heldParts } from "./cafe";
import { FREE_NAMES, isFreeHold } from "./casa";
import {
  COCINA_MSG,
  CookMessage,
  CocinaNoticeCode,
  INGREDIENTS,
  RECIPES,
  canCook,
  cocinaNoticeText,
  dishSpeedMul,
  isDish,
  isIngredient,
  ingredientName,
  missingFor,
  PANTRY_ITEMS,
  recipeInSeason,
  recipeById,
  takeIngredients,
} from "./cocina";
import { CONSUMABLES, PLAYER_SPEED, usesOf } from "./index";

describe("cocina", () => {
  it("las recetas usan solo lo del huerto y la miel, y cada plato se lleva en la mano", () => {
    for (const r of RECIPES) {
      // Las de temporada también usan lo de la granja (harina, queso, huevos), que la despensa cuenta.
      for (const item of Object.keys(r.needs)) expect(r.festival ? PANTRY_ITEMS.includes(item) : isIngredient(item), `${r.id}: ${item}`).toBe(true);
      expect(isDish(r.id)).toBe(true);
      expect(isFreeHold(r.id), r.id).toBe(true);
      expect(heldParts(r.id)).toEqual([r.id]);
      expect(FREE_NAMES[r.id]).toBe(r.name);
      expect(CONSUMABLES[r.id]?.uses, r.id).toBe(r.uses);
      expect(usesOf(r.id)).toBe(r.uses);
    }
    expect(INGREDIENTS).toContain("miel");
    expect(isIngredient("whisky")).toBe(false);
  });

  it("dice qué falta y descuenta lo que se usa", () => {
    const sopa = recipeById("sopa-verduras")!;
    expect(missingFor(sopa, { tomate: 1 })).toEqual({ papa: 1, cilantro: 1 });
    expect(canCook(sopa, { tomate: 1, papa: 1 })).toBe(false);
    const pantry = { tomate: 2, papa: 1, cilantro: 1, miel: 1 };
    expect(canCook(sopa, pantry)).toBe(true);
    expect(takeIngredients(sopa, pantry)).toEqual({ tomate: 1, miel: 1 });
  });

  it("la energía es moderada: nunca pasa la tolerancia de velocidad del servidor", () => {
    for (const r of RECIPES) {
      if (r.effect.kind !== "speed") continue;
      expect(dishSpeedMul(r.id)).toBeGreaterThan(1);
      // El servidor acepta hasta 1.6 veces la velocidad (latencia): la energía se queda bien debajo.
      expect(PLAYER_SPEED * dishSpeedMul(r.id)).toBeLessThan(PLAYER_SPEED * 1.5);
    }
    expect(dishSpeedMul("sopa-verduras")).toBe(1);
    expect(dishSpeedMul("tinto")).toBe(1);
  });

  it("valida los mensajes y tiene texto para cada aviso", () => {
    expect(CookMessage.safeParse({ recipe: "ajiaco" }).success).toBe(true);
    expect(CookMessage.safeParse({ recipe: "natilla-casera" }).success).toBe(true);
    expect(CookMessage.safeParse({ recipe: "whisky" }).success).toBe(false);
    for (const code of CocinaNoticeCode.options) expect(cocinaNoticeText({ code, item: "ajiaco", points: 3 }).length).toBeGreaterThan(5);
    expect(new Set(Object.values(COCINA_MSG)).size).toBe(Object.keys(COCINA_MSG).length);
  });

  it("la natilla y los buñuelos son de las novenas: fuera del festival no se cocinan", () => {
    const natilla = recipeById("natilla-casera")!;
    const bunuelos = recipeById("bunuelos-novena")!;
    for (const r of [natilla, bunuelos]) {
      expect(r.festival).toBe("novenas");
      expect(recipeInSeason(r, "novenas")).toBe(true);
      expect(recipeInSeason(r, "")).toBe(false);
      expect(recipeInSeason(r, "brujas")).toBe(false);
    }
    expect(recipeInSeason(recipeById("ajiaco")!, "")).toBe(true);
    for (const item of ["harina", "queso", "huevo"]) expect(PANTRY_ITEMS).toContain(item);
    expect(ingredientName("harina")).toBe("Harina de maíz");
  });
});
