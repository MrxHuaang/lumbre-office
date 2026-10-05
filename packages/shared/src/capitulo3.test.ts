import { describe, expect, it } from "vitest";
import { STAT_KEYS, achievementById } from "./achievements";
import { BAG_OBJECTS, bagItemInfo } from "./bolsa";
import { AGUA_BRILLA, CARNADA_E_RECIPE, CAPITULO3_CINEMATICAS, EVELIO_INSISTE, LAGO_CINE, LAGO_PASOS, LETTER_CH3, OBJETOS_LAGO, aguaBrilla, celesteAhora } from "./capitulo3";
import { cineById, cineProblems } from "./cinematicas";
import { CocinaNoticeCode, CookMessage, RECIPES, STORY_RECIPES, cocinaNoticeText, isDish, recipeById } from "./cocina";
import { CONSUMABLES } from "./consumables";
import { QUEST_GIVERS, questById } from "./encargos";
import { CAPITULO_2, CAPITULO_3, CAPITULOS, STORY_ASKS, lettersFor } from "./historia";
import { WEATHERS } from "./weather";

const at = (h: number, m = 0) => h * 60 + m;

describe("capítulo 3: La llavecita del lago", () => {
  it("lo abre terminar el 2, son cinco pasos encadenados repartidos entre Celeste, Evelio y Aurora", () => {
    expect(CAPITULOS[2]).toBe(CAPITULO_3);
    expect(CAPITULO_3.opensWith).toBe(CAPITULO_2.flag);
    expect(CAPITULO_3.flag).toBe(STAT_KEYS.storyCh3);
    expect(CAPITULO_3.steps.map((q) => q.id)).toEqual(Object.values(LAGO_PASOS));
    expect(CAPITULO_3.steps.map((q) => q.giver)).toEqual(["celeste", "evelio", "evelio", "evelio", "aurora"]);
    for (const [i, q] of CAPITULO_3.steps.entries()) {
      expect(QUEST_GIVERS[q.giver], q.id).toBeTruthy();
      expect(q.kind).toBe("story");
      expect(q.next).toBe(CAPITULO_3.steps[i + 1]?.id);
      expect(CAPITULO_3.lessons[q.id], q.id).toBeTruthy();
      expect(CAPITULO_3.targets?.[q.id], q.id).toBeTruthy();
      expect(questById(q.id), q.id).toBeDefined();
      // La llave no se entrega: se queda con quien la sacó (abre el capítulo 4).
      expect(q.deliver, q.id).toBeUndefined();
    }
    expect(achievementById(CAPITULO_3.achievement!)?.stat).toBe(STAT_KEYS.storyCh3);
    expect(achievementById("pescador-de-secretos")?.name).toBe("Pescador de secretos");
  });

  it("la carta 3 llega al terminarlo y manda a la puerta del fondo del sótano", () => {
    expect(LETTER_CH3.from).toBe("E.");
    expect(LETTER_CH3.body).toMatch(/sótano/);
    expect(LETTER_CH3.body).toMatch(/baños/);
    expect(lettersFor({ [STAT_KEYS.storyCh1]: 1, [STAT_KEYS.storyCh2]: 1, [STAT_KEYS.storyCh3]: 1 }).map((l) => l.id)).toEqual(["carta-1", "carta-2", "carta-3"]);
  });

  it("lo que se pregunta: Celeste, Evelio y la llave a Aurora (los otros pasos se cumplen jugando)", () => {
    expect(Object.keys(CAPITULO_3.asks!)).toEqual([LAGO_PASOS.celeste, LAGO_PASOS.evelio, LAGO_PASOS.aurora]);
    for (const [id, label] of Object.entries(CAPITULO_3.asks!)) expect(STORY_ASKS[id]).toBe(label);
  });

  it("la carnada y la llave son objetos de historia de la mochila (no se comen, una sola)", () => {
    for (const id of Object.values(OBJETOS_LAGO)) {
      expect(BAG_OBJECTS[id]?.story, id).toBe(true);
      expect(bagItemInfo(`obj:${id}`).max, id).toBe(1);
      expect(bagItemInfo(`obj:${id}`).use, id).toBeNull();
      expect(CONSUMABLES[id], id).toBeUndefined();
    }
  });
});

describe("el agua que brilla", () => {
  it("brilla de las 9 de la noche a las 3 de la mañana del juego, con el cielo limpio", () => {
    expect(aguaBrilla(at(21), "despejado")).toBe(true);
    expect(aguaBrilla(at(23, 30), "despejado")).toBe(true);
    expect(aguaBrilla(at(0), "nublado")).toBe(true);
    expect(aguaBrilla(at(2, 59), "despejado")).toBe(true);
    expect(aguaBrilla(at(3), "despejado")).toBe(false);
    expect(aguaBrilla(at(20, 59), "despejado")).toBe(false);
    expect(aguaBrilla(at(12), "despejado")).toBe(false);
    // De noche pero con el cielo tapado (o mojado), no.
    for (const w of AGUA_BRILLA.sinBrillo) expect(aguaBrilla(at(23), w), w).toBe(false);
  });

  it("cada noche tiene su rato: algún clima la deja brillar y fuera de la hora ninguno", () => {
    expect(WEATHERS.some((w) => aguaBrilla(at(22), w))).toBe(true);
    for (const w of WEATHERS) expect(aguaBrilla(at(15), w), w).toBe(false);
    // Vueltas del reloj: el minuto se toma módulo el día.
    expect(aguaBrilla(at(22) + 1440, "despejado")).toBe(true);
  });

  it("Celeste dice si brilla esa noche", () => {
    expect(celesteAhora(true)).not.toBe(celesteAhora(false));
  });
});

describe("la carnada de E.", () => {
  it("es una receta de la historia: con lo del huerto y la miel, sin puntos ni energía, solo con su paso", () => {
    expect(STORY_RECIPES).toContain(CARNADA_E_RECIPE);
    expect(RECIPES).not.toContain(CARNADA_E_RECIPE);
    expect(recipeById(OBJETOS_LAGO.carnada)).toBe(CARNADA_E_RECIPE);
    expect(isDish(OBJETOS_LAGO.carnada)).toBe(false);
    expect(CARNADA_E_RECIPE.effect.kind).toBe("story");
    expect(CARNADA_E_RECIPE.story).toEqual([LAGO_PASOS.carnada, LAGO_PASOS.pescar]);
    expect(CARNADA_E_RECIPE.needs).toEqual({ mazorca: 1, miel: 1, fresa: 1 });
    // Ninguna otra receta pide justo lo mismo.
    for (const r of RECIPES) expect(r.needs).not.toEqual(CARNADA_E_RECIPE.needs);
    expect(CookMessage.safeParse({ recipe: OBJETOS_LAGO.carnada }).success).toBe(true);
  });

  it("los avisos nuevos de la estufa tienen texto", () => {
    expect(CocinaNoticeCode.options).toContain("story");
    expect(CocinaNoticeCode.options).toContain("have");
    expect(cocinaNoticeText({ code: "have", item: OBJETOS_LAGO.carnada })).toMatch(/Carnada de E\./);
    expect(cocinaNoticeText({ code: "cooked", item: OBJETOS_LAGO.carnada })).toMatch(/mochila/);
  });
});

describe("las cinemáticas del capítulo", () => {
  it("están en el catálogo y sin problemas", () => {
    for (const def of CAPITULO3_CINEMATICAS) {
      expect(cineById(def.id), def.id).toBe(def);
      expect(cineProblems(def), def.id).toEqual([]);
    }
    expect(Object.values(LAGO_CINE).every((id) => cineById(id))).toBe(true);
  });

  it("Evelio se hace el loco y la primera opción (la que vale si se salta) es insistirle con la carta", () => {
    const loco = cineById(LAGO_CINE.evelioLoco)!;
    const choice = loco.steps.find((s) => s.op === "choice");
    expect(choice?.op === "choice" && choice.options[0]?.id).toBe(EVELIO_INSISTE);
    expect(loco.steps.filter((s) => s.op === "say" && s.who === "evelio").length).toBeGreaterThanOrEqual(3);
  });
});
