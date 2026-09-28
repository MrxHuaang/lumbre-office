import { describe, expect, it } from "vitest";
import { STAT_KEYS, achievementById, profileTitle } from "./achievements";
import { COSTUMES } from "./costumes";
import { RECIPES } from "./cocina";
import { OFICIO_BADGES } from "./insignias";
import {
  LEVEL_XP,
  MAX_LEVEL,
  OFICIO,
  OFICIO_REWARDS,
  OFICIOS,
  canBuyExclusive,
  levelOf,
  levelProgress,
  lockedCostume,
  neighborLevel,
  oficioLevelStat,
  rewardsOf,
  statOficio,
  veteranXp,
} from "./oficios";
import { SHOP_FURNITURE } from "./shop";

describe("la curva de los oficios", () => {
  it("sube cada vez más: del 1 al 10, y el 10 cuesta meses de uso normal", () => {
    expect(LEVEL_XP).toHaveLength(MAX_LEVEL);
    expect(LEVEL_XP[0]).toBe(0);
    for (let l = 2; l < MAX_LEVEL; l++) expect(LEVEL_XP[l]! - LEVEL_XP[l - 1]!, `nivel ${l + 1}`).toBeGreaterThan(LEVEL_XP[l - 1]! - LEVEL_XP[l - 2]!);
    // Con ~60 de experiencia al día: el 2 el primer día, el 5 en semanas y el 10 en más de tres meses.
    expect(LEVEL_XP[1]).toBeLessThanOrEqual(100);
    expect(LEVEL_XP[4]! / 60).toBeGreaterThan(14);
    expect(LEVEL_XP[9]! / 60).toBeGreaterThan(90);
    // Ni con el tope diario de las acciones (y encargos) sale en menos de un mes.
    expect(LEVEL_XP[9]! / (OFICIO.dailyActionCap + 100)).toBeGreaterThan(25);
  });

  it("el nivel y lo que falta salen de la experiencia", () => {
    expect(levelOf(0)).toBe(1);
    expect(levelOf(LEVEL_XP[1]! - 1)).toBe(1);
    expect(levelOf(LEVEL_XP[1]!)).toBe(2);
    expect(levelOf(10 ** 9)).toBe(10);
    expect(levelProgress(LEVEL_XP[1]! + 5)).toMatchObject({ level: 2, into: 5, need: LEVEL_XP[2]! - LEVEL_XP[1]! - 5 });
    expect(levelProgress(10 ** 9)).toMatchObject({ level: 10, to: null, need: null });
    expect(neighborLevel({})).toBe(5);
    expect(neighborLevel({ pesca: 10, cocina: 3 })).toBe(10 + 3 + 3);
  });

  it("cada contador da experiencia a un solo oficio (y las visitas a exploración)", () => {
    expect(statOficio(STAT_KEYS.fishCaught)).toEqual({ oficio: "pesca", xp: 8 });
    expect(statOficio("visit:garaje")?.oficio).toBe("exploracion");
    expect(statOficio(STAT_KEYS.pointsPeak)).toBeNull();
  });

  it("los veteranos empiezan con lo de sus contadores, pero nunca más allá del nivel 7", () => {
    const start = veteranXp({ [STAT_KEYS.fishCaught]: 10, [STAT_KEYS.harvests]: 5, "visit:sotano": 1, "visit:garaje": 1, "bolsa:obj:tinto": 3 });
    expect(start.pesca).toBe(80);
    expect(start.huerta).toBe(40);
    expect(start.exploracion).toBe(60);
    expect(start.cocina).toBe(0);
    const huge = veteranXp({ [STAT_KEYS.fishCaught]: 1_000_000 });
    expect(levelOf(huge.pesca)).toBe(OFICIO.veteranMaxLevel);
  });
});

describe("lo que da cada nivel", () => {
  it("cada oficio tiene algo en el 2, 4, 5, 6, 8 y 10; la ventaja en el 5 y el título en el 10", () => {
    for (const o of OFICIOS) {
      const levels = rewardsOf(o).map((r) => r.level);
      expect(levels, o).toEqual([2, 4, 5, 6, 8, 10]);
      expect(rewardsOf(o).find((r) => r.level === 5)?.kind, o).toBe("perk");
      expect(rewardsOf(o).find((r) => r.level === 10)?.kind, o).toBe("title");
    }
  });

  it("los trajes existen, los muebles están en la tienda con el mismo nivel y la receta la pide", () => {
    for (const r of OFICIO_REWARDS) {
      if (r.kind === "costume") expect(COSTUMES[r.id as keyof typeof COSTUMES]?.category, r.id).toBe("oficios");
      if (r.kind === "furniture") expect(SHOP_FURNITURE.find((i) => i.id === r.id)?.requires, r.id).toEqual({ oficio: r.oficio, level: r.level });
      if (r.kind === "recipe") expect(RECIPES.find((x) => x.id === r.id)?.requires, r.id).toEqual({ oficio: r.oficio, level: r.level });
    }
    // Y al revés: nada de la tienda pide un oficio sin estar en la tabla.
    for (const i of SHOP_FURNITURE.filter((x) => x.requires)) expect(OFICIO_REWARDS.some((r) => r.kind === "furniture" && r.id === i.id), i.id).toBe(true);
  });

  it("un traje de oficio se guarda solo con el nivel; el resto de la ropa, siempre", () => {
    expect(lockedCostume({ costume: "pescador-lago" }, {})?.level).toBe(2);
    expect(lockedCostume({ costume: "pescador-lago" }, { pesca: 2 })).toBeNull();
    expect(lockedCostume({ costume: "chef" }, {})).toBeNull();
    expect(lockedCostume(null, {})).toBeNull();
    const lamp = SHOP_FURNITURE.find((i) => i.id === "dock-lamp")!;
    expect(canBuyExclusive(lamp, { pesca: 3 })).toBe(false);
    expect(canBuyExclusive(lamp, { pesca: 4 })).toBe(true);
    expect(canBuyExclusive(SHOP_FURNITURE[0]!, {})).toBe(true);
  });

  it("el nivel 10: logro legendario, insignia y título del perfil", () => {
    for (const o of OFICIOS) {
      const a = achievementById(OFICIO_BADGES[o])!;
      expect(a, o).toBeTruthy();
      expect(a.rarity).toBe("legendario");
      expect(a.stat).toBe(oficioLevelStat(o));
      expect(a.min).toBe(10);
    }
    expect(profileTitle({ [oficioLevelStat("pesca")]: 10, [STAT_KEYS.dances]: 999 })).toBe("Leyenda del lago");
    expect(profileTitle({ [oficioLevelStat("pesca")]: 9 })).not.toBe("Leyenda del lago");
  });
});
