import { describe, expect, it } from "vitest";
import { MAX_STATS, STAT_KEYS, STAT_PREFIX } from "./achievements";
import { BAG_OBJECTS } from "./bolsa";
import { HISTORIA_RELOJ } from "./capitulo2";
import { CAFE_MENU } from "./cafe";
import {
  QUEST_GIVERS,
  QUEST_SKILLS,
  QUESTS,
  STORY_PERIOD,
  claimWindow,
  currentQuests,
  dailyPeriod,
  dailyPool,
  isQuestStat,
  pickDaily,
  pickWeekly,
  questById,
  questCounts,
  questDeltas,
  questGiverNpc,
  questViews,
  weeklyPeriod,
  type QuestDef,
  type QuestSeasons,
} from "./encargos";
import { SEASONS } from "./estaciones";
import { GRANJA_STATS } from "./granja";
import { DAILY_CAPS, POINTS } from "./points";

const DAY = 86_400_000;
/** Lunes 28 de septiembre de 2026, 10:00 en Bogotá (otoño). */
const MON = Date.UTC(2026, 8, 28, 15, 0);
/** La estación del juego con que se reparte (la fija el servidor por período). */
const OTONO: QuestSeasons = { daily: "otono", weekly: "otono" };
// Los contadores de la historia (los suma la sala de cada capítulo) también valen.
const known = new Set<string>([...Object.values(STAT_KEYS), ...Object.values(GRANJA_STATS), ...Object.values(HISTORIA_RELOJ)]);

describe("el catálogo de encargos", () => {
  it("tiene unos 40, con ids únicos, textos cortos y quien los da existe", () => {
    expect(QUESTS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(QUESTS.map((q) => q.id)).size).toBe(QUESTS.length);
    for (const q of QUESTS) {
      expect(QUEST_GIVERS[q.giver], q.id).toBeTruthy();
      expect(q.title.length, q.id).toBeLessThanOrEqual(40);
      expect(q.text.length, q.id).toBeLessThanOrEqual(160);
      expect(q.goal, q.id).toBeGreaterThan(0);
      expect(QUEST_SKILLS, q.id).toContain(q.reward.skill);
      expect(q.reward.xp, q.id).toBeGreaterThan(0);
    }
    // Los NPC de los encargos son los que ya existen (el tablón no es una persona).
    for (const g of Object.values(QUEST_GIVERS)) if ("npc" in g) expect(questGiverNpc(g.id), g.id).toBeTruthy();
  });

  it("cada encargo sigue un contador que ya se suma (nada de máximos) y los objetos de premio existen", () => {
    const menu = new Set<string>(CAFE_MENU.map((m) => m.id));
    for (const q of QUESTS) {
      expect(isQuestStat(q.stat), q.id).toBe(true);
      expect(MAX_STATS.has(q.stat), q.id).toBe(false);
      const prefixed = [STAT_PREFIX.visit, STAT_PREFIX.use, STAT_PREFIX.order, STAT_PREFIX.secZone, STAT_PREFIX.secArea].some((p) => q.stat.startsWith(p));
      expect(known.has(q.stat) || prefixed, `${q.id}: ${q.stat}`).toBe(true);
      if (q.stat.startsWith(STAT_PREFIX.order)) expect(menu.has(q.stat.slice(STAT_PREFIX.order.length)), q.id).toBe(true);
      if (q.reward.item) expect(BAG_OBJECTS[q.reward.item.id], `${q.id}: ${q.reward.item.id}`).toBeTruthy();
    }
  });

  it("el peor día (los 3 diarios más caros y el semanal más caro) nunca pasa del tope de QUEST (100)", () => {
    expect(DAILY_CAPS.QUEST).toBe(POINTS.questDailyCap);
    expect(POINTS.questDailyCap).toBe(100);
    const worst = (defs: readonly QuestDef[]) => [...defs].sort((a, b) => b.reward.points - a.reward.points);
    const days = QUESTS.filter((q) => q.kind === "daily");
    const weeks = QUESTS.filter((q) => q.kind === "weekly");
    // Sobre todo el catálogo (sin mirar la estación ni el sorteo: lo más caro que podría tocar).
    const top = worst(days).slice(0, 3).reduce((t, q) => t + q.reward.points, 0) + worst(weeks)[0]!.reward.points;
    expect(top).toBeLessThanOrEqual(POINTS.questDailyCap);
    // Y en un año de días de verdad, con lo que le tocó a alguien.
    for (let i = 0; i < 365; i++) {
      const t = MON + i * DAY;
      const sum = currentQuests("u-alice", t, { daily: SEASONS[i % 4]!, weekly: SEASONS[(i >> 2) % 4]! }).reduce((s, q) => s + q.def.reward.points, 0);
      expect(sum, `día ${i}`).toBeLessThanOrEqual(POINTS.questDailyCap);
    }
  });
});

describe("a quién le toca qué", () => {
  it("3 diarios: el primero igual para todos ese día y dos propios, sin repetir", () => {
    const a = pickDaily("u-alice", MON, "otono");
    const b = pickDaily("u-bob", MON, "otono");
    expect(a.shared.id).toBe(b.shared.id);
    expect(a.own).toHaveLength(2);
    for (const who of ["u-alice", "u-bob", "u-carla", "u-dani"]) {
      const { shared, own } = pickDaily(who, MON, "otono");
      const ids = [shared.id, ...own.map((q) => q.id)];
      expect(new Set(ids).size).toBe(3);
      // Ni el mismo contador dos veces (serían tres veces lo mismo).
      expect(new Set([shared, ...own].map((q) => q.stat)).size).toBe(3);
      for (const q of [shared, ...own]) expect(q.kind).toBe("daily");
    }
    // Los propios cambian de persona en persona (con 4 personas, alguna diferencia tiene que haber).
    const owns = ["u-alice", "u-bob", "u-carla", "u-dani"].map((u) => pickDaily(u, MON, "otono").own.map((q) => q.id).join());
    expect(new Set(owns).size).toBeGreaterThan(1);
  });

  it("es determinista: el mismo día da lo mismo a cualquier hora, y otro día, otra cosa", () => {
    const morning = currentQuests("u-alice", MON - 4 * 3_600_000, OTONO);
    const night = currentQuests("u-alice", MON + 12 * 3_600_000, OTONO);
    expect(night.map((q) => q.def.id)).toEqual(morning.map((q) => q.def.id));
    const days = Array.from({ length: 7 }, (_, i) => pickDaily("u-alice", MON + i * DAY, "otono").shared.id);
    expect(new Set(days).size).toBeGreaterThan(1);
  });

  it("el semanal es uno solo, más grande, igual toda la semana (de lunes a domingo)", () => {
    const w = pickWeekly(MON, "otono");
    expect(w.kind).toBe("weekly");
    expect(pickWeekly(MON + 6 * DAY, "otono").id).toBe(w.id);
    expect(weeklyPeriod(MON)).toBe("w:2026-W40");
    expect(weeklyPeriod(MON + 6 * DAY)).toBe("w:2026-W40");
    expect(weeklyPeriod(MON + 7 * DAY)).toBe("w:2026-W41");
    const all = currentQuests("u-alice", MON, OTONO);
    expect(all).toHaveLength(4);
    expect(all.map((q) => q.period)).toEqual(["d:2026-09-28", "d:2026-09-28", "d:2026-09-28", "w:2026-W40"]);
    expect(all.map((q) => q.shared)).toEqual([true, false, false, true]);
  });

  it("el día cambia a la medianoche de Bogotá (no la de UTC)", () => {
    const lateNight = Date.UTC(2026, 8, 29, 4, 30); // 23:30 del lunes en Bogotá
    expect(dailyPeriod(lateNight)).toBe("d:2026-09-28");
    expect(dailyPeriod(lateNight + 3_600_000)).toBe("d:2026-09-29");
  });

  it("los de temporada salen solo en su estación", () => {
    const otono = dailyPool("otono").map((q) => q.id);
    expect(otono).toContain("tablon-otono");
    expect(otono).not.toContain("tablon-primavera");
    const primavera = dailyPool("primavera").map((q) => q.id);
    expect(primavera).toContain("tablon-primavera");
    expect(primavera).not.toContain("tablon-otono");
    // En muchos días y con cada estación, nunca sale uno fuera de la suya (el semanal, con la de la semana).
    for (let i = 0; i < 120; i++) {
      const t = MON + i * DAY;
      const seasons: QuestSeasons = { daily: SEASONS[i % 4]!, weekly: SEASONS[(i + 1) % 4]! };
      for (const q of currentQuests("u-alice", t, seasons)) {
        const allowed = q.def.when?.seasons;
        if (allowed) expect(allowed, `${q.def.id} el día ${i}`).toContain(q.def.kind === "weekly" ? seasons.weekly : seasons.daily);
      }
    }
  });
});

describe("avanzar y entregar", () => {
  const luna = questById("evelio-luna")!;
  const olla = questById("evelio-olla")!;
  const aguacero = questById("semana-aguacero")!;
  const active = (defs: QuestDef[]) => defs.map((def) => ({ def, period: def.kind === "weekly" ? weeklyPeriod(MON) : dailyPeriod(MON), shared: false }));

  it("solo avanza lo que sigue ese contador, y lo de noche o con lluvia solo cuenta entonces", () => {
    const list = active([luna, olla, aguacero, questById("tablon-sembrar")!]);
    expect(questDeltas(list, STAT_KEYS.fishCaught, 1, { night: false, weather: "despejado" }).map((d) => d.questId)).toEqual(["evelio-olla"]);
    expect(questDeltas(list, STAT_KEYS.fishCaught, 1, { night: true, weather: "lluvia" }).map((d) => d.questId)).toEqual(["evelio-luna", "evelio-olla", "semana-aguacero"]);
    // La web no sabe si es de noche: lo condicionado no avanza desde allá.
    expect(questDeltas(list, STAT_KEYS.fishCaught, 1, {}).map((d) => d.questId)).toEqual(["evelio-olla"]);
    expect(questDeltas(list, STAT_KEYS.plantings, 2, {})).toEqual([{ questId: "tablon-sembrar", period: dailyPeriod(MON), delta: 2, goal: 3 }]);
    expect(questDeltas(list, STAT_KEYS.plantings, 0, {})).toEqual([]);
    expect(questCounts(aguacero, { night: false, weather: "tormenta" })).toBe(true);
  });

  it("se entrega el de hoy, el de ayer con un día de gracia, y nada más viejo", () => {
    expect(claimWindow(dailyPeriod(MON), MON)).toBe("open");
    expect(claimWindow(dailyPeriod(MON), MON + DAY)).toBe("grace");
    expect(claimWindow(dailyPeriod(MON), MON + 2 * DAY)).toBe("closed");
    // El semanal: toda la semana, y el lunes siguiente de gracia.
    expect(claimWindow(weeklyPeriod(MON), MON + 6 * DAY)).toBe("open");
    expect(claimWindow(weeklyPeriod(MON), MON + 7 * DAY)).toBe("grace");
    expect(claimWindow(weeklyPeriod(MON), MON + 8 * DAY)).toBe("closed");
    expect(claimWindow(STORY_PERIOD, MON + 400 * DAY)).toBe("open");
    expect(claimWindow("x:raro", MON)).toBe("closed");
  });

  it("la libreta: lo de hoy con su progreso, lo de ayer cumplido sin entregar, y no lo vencido", () => {
    const now = MON + DAY;
    const today = currentQuests("u-alice", now, OTONO);
    const first = today[0]!;
    const views = questViews(
      today,
      [
        { questId: first.def.id, period: first.period, progress: 1, goal: first.def.goal, status: "ACTIVE" },
        { questId: "evelio-olla", period: dailyPeriod(MON), progress: 3, goal: 3, status: "DONE" },
        { questId: "tablon-sembrar", period: dailyPeriod(MON), progress: 1, goal: 3, status: "ACTIVE" },
        { questId: "tablon-cosecha", period: dailyPeriod(MON - DAY), progress: 3, goal: 3, status: "DONE" },
      ],
      now,
    );
    expect(views).toHaveLength(5);
    expect(views[0]).toMatchObject({ questId: first.def.id, progress: 1, shared: true, late: false });
    expect(views.slice(1, 4).every((v) => v.progress === 0 && v.status === "ACTIVE")).toBe(true);
    expect(views[4]).toMatchObject({ questId: "evelio-olla", status: "DONE", late: true });
  });
});
