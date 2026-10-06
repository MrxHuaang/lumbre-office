import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  BADGE_ICONS,
  MAX_STATS,
  STAT_KEYS,
  STAT_PREFIX,
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_SCORE,
  COLLECTOR_TIERS,
  MAX_ACHIEVEMENT_SCORE,
  achievementById,
  achievementScore,
  nearestAchievements,
  achievementProgress,
  achievementsOfStat,
  bogotaDay,
  newlyUnlocked,
  oddHour,
  profileTitle,
  topByPrefix,
} from "./achievements";
import { bogotaHour } from "./fishing";

const KEYS = new Set<string>(Object.values(STAT_KEYS));
const PREFIXES = Object.values(STAT_PREFIX);

describe("catálogo de logros", () => {
  it("ids únicos, textos en su lugar y entre 60 y 140 logros (los festivales suman los suyos)", () => {
    expect(new Set(ACHIEVEMENTS.map((x) => x.id)).size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(60);
    expect(ACHIEVEMENTS.length).toBeLessThanOrEqual(140);
    for (const x of ACHIEVEMENTS) {
      expect(x.id, x.id).toMatch(/^[a-z0-9-]+$/);
      expect(x.name.length, x.id).toBeGreaterThan(2);
      expect(x.description.length, x.id).toBeLessThanOrEqual(70);
      expect(x.goal.length, x.id).toBeGreaterThan(5);
      expect(achievementById(x.id)).toBe(x);
    }
  });

  it("cada regla usa una clave conocida (o un prefijo) y un umbral entero positivo", () => {
    for (const x of ACHIEVEMENTS) {
      expect(KEYS.has(x.stat) || PREFIXES.some((p) => x.stat.startsWith(p)), `${x.id}: ${x.stat}`).toBe(true);
      expect(Number.isInteger(x.min) && x.min > 0, x.id).toBe(true);
      expect(BADGE_ICONS as readonly string[], x.id).toContain(x.icon);
    }
  });

  it("cada logro tiene su grupo y ningún grupo queda vacío", () => {
    for (const x of ACHIEVEMENTS) expect(ACHIEVEMENT_CATEGORIES as readonly string[], x.id).toContain(x.category);
    for (const c of ACHIEVEMENT_CATEGORIES) expect(ACHIEVEMENTS.filter((x) => x.category === c).length, c).toBeGreaterThanOrEqual(5);
  });

  it("los ids que ya están guardados en la base siguen existiendo", () => {
    for (const id of ["buenos-dias", "adicto-al-tinto", "primera-borrachera", "album-completo", "turista", "veterano", "mareo-voluntario", "paparazzi"])
      expect(achievementById(id), id).toBeDefined();
  });

  it("el último logro de logros se puede conseguir (hay de sobra en el catálogo)", () => {
    const collectors = achievementsOfStat(STAT_KEYS.achievementsUnlocked);
    expect(collectors.map((x) => x.min)).toEqual([...COLLECTOR_TIERS]);
    expect(Math.max(...COLLECTOR_TIERS)).toBeLessThan(ACHIEVEMENTS.length - collectors.length);
  });

  it("las funciones nuevas (mascotas, huerto, cocina, juegos, foco, teléfono, propinas) tienen logro", () => {
    for (const key of [
      STAT_KEYS.petCares,
      STAT_KEYS.petTreats,
      STAT_KEYS.plantings,
      STAT_KEYS.harvests,
      STAT_KEYS.dishesCooked,
      STAT_KEYS.arcadeGames,
      STAT_KEYS.arcadeRecords,
      STAT_KEYS.boardWins,
      STAT_KEYS.racesFinished,
      STAT_KEYS.focusBlocks,
      STAT_KEYS.phoneCalls,
      STAT_KEYS.tipsGiven,
      STAT_KEYS.tipsReceived,
    ])
      expect(achievementsOfStat(key).length, key).toBeGreaterThan(0);
  });

  it("hay de todas las rarezas y algunos secretos", () => {
    const rarities = new Set(ACHIEVEMENTS.map((x) => x.rarity));
    expect([...rarities].sort()).toEqual(["comun", "epico", "legendario", "raro"]);
    expect(ACHIEVEMENTS.filter((x) => x.secret).length).toBeGreaterThanOrEqual(3);
  });

  it("las claves de las otras ramas (fotos, brindis, silla) ya tienen su logro", () => {
    for (const key of [STAT_KEYS.photosTaken, STAT_KEYS.toasts, STAT_KEYS.chairSpins]) expect(achievementsOfStat(key).length, key).toBeGreaterThan(0);
  });

  it("las claves son únicas y las de máximo están entre las conocidas", () => {
    expect(KEYS.size).toBe(Object.values(STAT_KEYS).length);
    for (const k of MAX_STATS) expect(KEYS.has(k), k).toBe(true);
  });
});

describe("reglas", () => {
  it("se desbloquea al llegar al umbral, no antes, y no dos veces", () => {
    expect(newlyUnlocked({ [STAT_KEYS.blackouts]: 0 }, []).map((x) => x.id)).not.toContain("primera-borrachera");
    const first = newlyUnlocked({ [STAT_KEYS.blackouts]: 1 }, []).map((x) => x.id);
    expect(first).toContain("primera-borrachera");
    expect(first).not.toContain("higado-de-acero");
    expect(newlyUnlocked({ [STAT_KEYS.blackouts]: 10 }, new Set(["primera-borrachera"])).map((x) => x.id)).toEqual(["higado-de-acero"]);
  });

  it("el progreso va de 0 a 1", () => {
    const cats = achievementById("amigo-de-los-gatos")!;
    expect(achievementProgress(cats, {})).toBe(0);
    expect(achievementProgress(cats, { [STAT_KEYS.catPets]: 5 })).toBe(0.25);
    expect(achievementProgress(cats, { [STAT_KEYS.catPets]: 500 })).toBe(1);
  });

  it("el puntaje suma según la rareza e ignora ids viejos", () => {
    expect(achievementScore([])).toBe(0);
    expect(achievementScore(["buenos-dias", "no-existe"])).toBe(ACHIEVEMENT_SCORE.comun);
    expect(achievementScore(ACHIEVEMENTS.map((x) => x.id))).toBe(MAX_ACHIEVEMENT_SCORE);
  });

  it("lo más cercano: sin secretos, sin lo que ya tiene y de más avanzado a menos", () => {
    const stats = { [STAT_KEYS.catPets]: 15, [STAT_KEYS.fishCaught]: 10, [STAT_KEYS.blackouts]: 9 };
    const near = nearestAchievements(stats, new Set(["primera-picada"]), 5).map((r) => r.achievement.id);
    expect(near[0]).toBe("amigo-de-los-gatos");
    expect(near).toContain("pescador");
    expect(near).not.toContain("primera-picada");
    expect(near).not.toContain("higado-de-acero");
    expect(nearestAchievements({}, new Set())).toEqual([]);
  });

  it("los usos por tipo cuentan para el tinto", () => {
    expect(newlyUnlocked({ [`${STAT_PREFIX.use}tinto`]: 150 }, []).map((x) => x.id)).toContain("adicto-al-tinto");
  });
});

describe("título del perfil", () => {
  it("recién llegado sin nada, vecino tranquilo con horas y sin manías", () => {
    expect(profileTitle({})).toBe("Recién llegado");
    expect(profileTitle({ [STAT_KEYS.secondsOnline]: 10 * 3600 })).toBe("Vecino tranquilo");
  });

  it("gana el que más pasó su umbral", () => {
    expect(profileTitle({ [`${STAT_PREFIX.use}tinto`]: 80, [STAT_KEYS.catPets]: 31 })).toBe("Adicto al tinto");
    expect(profileTitle({ [`${STAT_PREFIX.use}tinto`]: 41, [STAT_KEYS.catPets]: 90 })).toBe("Susurrador de gatos");
    expect(profileTitle({ [`${STAT_PREFIX.secZone}biblioteca`]: 6 * 3600 })).toBe("Ermitaño de la biblioteca");
    expect(profileTitle({ [STAT_KEYS.dances]: 10, [STAT_KEYS.toasts]: 10, [STAT_KEYS.barOrders]: 15 })).toBe("Alma de la fiesta");
  });

  it("el más alto de un prefijo (nivel o zona favorita)", () => {
    const s = { [`${STAT_PREFIX.secArea}jardin`]: 30, [`${STAT_PREFIX.secArea}sotano`]: 90, other: 500 };
    expect(topByPrefix(s, STAT_PREFIX.secArea)).toEqual({ id: "sotano", value: 90 });
    expect(topByPrefix({}, STAT_PREFIX.secArea)).toBeNull();
  });
});

describe("horas de Bogotá", () => {
  it("UTC-5: las 11 UTC son las 6 de la mañana en Bogotá (madrugador)", () => {
    const t = Date.UTC(2026, 8, 27, 11, 30);
    expect(bogotaHour(t)).toBe(6);
    expect(oddHour(t)).toBe("early");
  });

  it("la 1 de la mañana es de búho y el mediodía no cuenta", () => {
    expect(oddHour(Date.UTC(2026, 8, 27, 6, 0))).toBe("owl");
    expect(oddHour(Date.UTC(2026, 8, 27, 17, 0))).toBeNull();
  });

  it("el día cambia a la medianoche de Bogotá", () => {
    expect(bogotaDay(Date.UTC(2026, 8, 28, 4, 59))).toBe(bogotaDay(Date.UTC(2026, 8, 27, 12, 0)));
    expect(bogotaDay(Date.UTC(2026, 8, 28, 5, 0))).toBe(bogotaDay(Date.UTC(2026, 8, 27, 12, 0)) + 1);
  });
});
