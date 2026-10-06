import { describe, expect, it } from "vitest";
import { bagItemInfo, objItemId } from "./bolsa";
import { cineById, cineProblems } from "./cinematicas";
import { INGREDIENTS } from "./cocina";
import { CONSUMABLES } from "./consumables";
import { bestSeasonOf } from "./estaciones";
import {
  DESFILE_SILLETAS,
  FERIA,
  FERIA_CINE,
  FERIA_CINEMATICAS,
  FERIA_SHOP,
  FeriaBuyMessage,
  SilletaStandMessage,
  feriaActiva,
  feriaGanadora,
  feriaRefId,
  feriaShopItem,
  missingFlowers,
  standKey,
} from "./feria-flores";
import { festivalById } from "./festivales";
import { FLOWER_CROPS, SHED_ITEMS, cropOfSeeds, isFlowerProduct, seedsOf } from "./huerto";
import { SILLETA, silletaCodeOf, silletaFlowerCount, silletaFlowers, silletaId, silletaName, validSilletaCode } from "./silleta";

describe("las flores del huerto", () => {
  it("son cuatro, de primavera, de a ramito y sin semillas en el cobertizo", () => {
    expect(FLOWER_CROPS.map((c) => c.id)).toEqual(["clavel", "astromelia", "girasol", "hortensia"]);
    for (const c of FLOWER_CROPS) {
      expect(bestSeasonOf(c.id), c.id).toBe("primavera");
      expect(c.yield, c.id).toBeGreaterThan(1);
      expect(isFlowerProduct(c.product)).toBe(true);
      expect(SHED_ITEMS).not.toContain(seedsOf(c.id));
      expect(cropOfSeeds(seedsOf(c.id))?.id).toBe(c.id);
      // Caben en una feria (13 horas del juego = 32,5 minutos reales), aun sin regar del todo.
      expect(c.growMs).toBeLessThanOrEqual(20 * 60_000);
      // No se comen ni van a la despensa: son para las silletas.
      expect(CONSUMABLES[c.product]).toBeUndefined();
      expect(INGREDIENTS).not.toContain(c.product);
      expect(bagItemInfo(objItemId(c.product))).toMatchObject({ kind: "cosecha", use: null });
    }
    expect(isFlowerProduct("tomate")).toBe(false);
  });
});

describe("la silleta", () => {
  it("el código va en el id: una letra por casilla y un mínimo de flores", () => {
    expect(SILLETA.cells).toBe(SILLETA.cols * SILLETA.rows);
    const code = "cccc-gg-hhaa";
    expect(validSilletaCode(code)).toBe(true);
    expect(silletaFlowerCount(code)).toBe(10);
    expect(silletaFlowers(code)).toEqual({ clavel: 4, girasol: 2, hortensia: 2, astromelia: 2 });
    expect(silletaCodeOf(silletaId(code))).toBe(code);
    expect(silletaCodeOf(objItemId(silletaId(code)))).toBe(code);
    // Con muy pocas flores, letras raras o del largo que no es, no es una silleta.
    expect(validSilletaCode("ccc---------")).toBe(false);
    expect(validSilletaCode("cccczzzzcccc")).toBe(false);
    expect(validSilletaCode("cccc")).toBe(false);
    expect(silletaCodeOf("silleta:ccc---------")).toBeNull();
    expect(silletaCodeOf("tinto")).toBeNull();
  });

  it("se nombra por la flor que manda y en la mochila es un objeto con su propio dibujo", () => {
    expect(silletaName("cccccccc----")).toBe("Silleta de claveles");
    expect(silletaName("ccgghhaa----")).toBe("Silleta de colores");
    const info = bagItemInfo(objItemId(silletaId("ggggghhh----")));
    expect(info).toMatchObject({ name: "Silleta de girasoles", kind: "objeto", furniture: false, use: null, max: SILLETA.stackMax, art: "silleta:ggggghhh----" });
  });

  it("dice qué flores faltan con lo que hay en la mochila", () => {
    const have = (f: string) => ({ clavel: 4, girasol: 1 })[f] ?? 0;
    expect(missingFlowers("cccc-gg-----", have)).toEqual({ girasol: 1 });
    expect(missingFlowers("cccc--------", have)).toEqual({});
    expect(missingFlowers("aaaa--------", have)).toEqual({ astromelia: 4 });
  });

  it("las del desfile son silletas de verdad", () => {
    for (const code of DESFILE_SILLETAS) expect(validSilletaCode(code), code).toBe(true);
  });
});

describe("la feria", () => {
  it("abre solo con su festival en plena fiesta (el día 15 de la primavera)", () => {
    expect(festivalById(FERIA.id)).toMatchObject({ estacion: "primavera", dia: 15 });
    expect(feriaActiva(FERIA.id, "fiesta")).toBe(true);
    expect(feriaActiva(FERIA.id, "previa")).toBe(false);
    expect(feriaActiva("brujas", "fiesta")).toBe(false);
  });

  it("gana la más votada; en un empate, la que se exhibió primero; sin votos no hay ganadora", () => {
    expect(feriaGanadora([])).toBeNull();
    expect(feriaGanadora([{ votes: 0, at: 1 }])).toBeNull();
    const a = { id: "a", votes: 2, at: 5 };
    const b = { id: "b", votes: 3, at: 9 };
    const c = { id: "c", votes: 3, at: 7 };
    expect(feriaGanadora([a, b])?.id).toBe("b");
    expect(feriaGanadora([a, b, c])?.id).toBe("c");
  });

  it("el puesto vende las semillas de cada flor (y nada más)", () => {
    expect(FERIA_SHOP.map((i) => i.id)).toEqual(FLOWER_CROPS.map((c) => seedsOf(c.id)));
    for (const i of FERIA_SHOP) {
      expect(i.price).toBeGreaterThan(0);
      expect(feriaShopItem(i.id)).toBe(i);
      expect(FeriaBuyMessage.safeParse({ item: i.id }).success).toBe(true);
    }
    expect(FeriaBuyMessage.safeParse({ item: "semillas-tomate" }).success).toBe(false);
    expect(feriaRefId("semillas-clavel")).toBe("festival:feria-flores:semillas-clavel");
    expect(SilletaStandMessage.safeParse({ stand: standKey(77, 48) }).success).toBe(true);
    expect(SilletaStandMessage.safeParse({ stand: "a,b" }).success).toBe(false);
  });

  it("sus cinemáticas están en el catálogo y no tienen problemas", () => {
    for (const def of FERIA_CINEMATICAS) {
      expect(cineById(def.id)).toBe(def);
      expect(cineProblems(def), def.id).toEqual([]);
    }
    expect(Object.values(FERIA_CINE).every((id) => cineById(id))).toBe(true);
  });
});
