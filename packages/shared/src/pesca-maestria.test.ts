import { describe, expect, it } from "vitest";
import { FishingSim, autoplay, replayFishing } from "./fishing-sim";
import { GROUP_FISHING, MAX_ROD_MASTERY, NIBBLES, ROD_MASTERY, castLuck, fishingTogether, masteryBar, nibbleTimes, rodMastery } from "./pesca-maestria";

describe("maestría de la caña", () => {
  it("sube de nivel con los peces y dice cuántos faltan", () => {
    expect(rodMastery(0)).toEqual({ level: 0, next: ROD_MASTERY.levels[0] });
    expect(rodMastery(ROD_MASTERY.levels[0]! - 1)).toEqual({ level: 0, next: 1 });
    expect(rodMastery(ROD_MASTERY.levels[0]!)).toEqual({ level: 1, next: ROD_MASTERY.levels[1]! - ROD_MASTERY.levels[0]! });
    expect(rodMastery(ROD_MASTERY.levels.at(-1)!)).toEqual({ level: MAX_ROD_MASTERY, next: null });
    expect(rodMastery(10_000).level).toBe(MAX_ROD_MASTERY);
  });

  it("cada nivel alarga la barra; sin nivel el minijuego queda igual que antes", () => {
    const setup = { seed: 42, difficulty: 70, behavior: "mixed" as const, treasure: false, rod: "fibra" as const };
    const base = new FishingSim(setup).barHeight;
    expect(new FishingSim({ ...setup, mastery: 0 }).barHeight).toBe(base);
    const bars = [1, 2, 3, 4, 5].map((mastery) => new FishingSim({ ...setup, mastery }).barHeight);
    for (let i = 0; i < bars.length; i++) expect(bars[i]!).toBeGreaterThanOrEqual(i === 0 ? base : bars[i - 1]!);
    expect(bars.at(-1)!).toBeGreaterThan(base);
    // Niveles raros (negativos o de más) no rompen nada.
    expect(masteryBar(-3)).toBe(0);
    expect(masteryBar(99)).toBe(masteryBar(MAX_ROD_MASTERY));
  });

  it("la partida con maestría se repite igual (el servidor valida con la misma barra)", () => {
    const setup = { seed: 9, difficulty: 85, behavior: "dart" as const, treasure: true, rod: "carbono" as const, mastery: 3 };
    const run = autoplay(setup);
    expect(replayFishing(setup, run.inputs, run.frames)).toMatchObject({ done: run.done, caught: run.caught, frame: run.frames });
  });
});

describe("pesca en grupo y suerte", () => {
  it("cuenta en el mismo nivel y hasta el radio", () => {
    const a = { area: "jardin", x: 0, y: 0 };
    expect(fishingTogether(a, { area: "jardin", x: GROUP_FISHING.radius, y: 0 })).toBe(true);
    expect(fishingTogether(a, { area: "jardin", x: GROUP_FISHING.radius + 1, y: 0 })).toBe(false);
    expect(fishingTogether(a, { area: "sotano", x: 0, y: 0 })).toBe(false);
  });

  it("la suerte multiplica carnada, compañía y maestría al máximo", () => {
    expect(castLuck({ bait: 1, group: false, mastery: 0 })).toBe(1);
    expect(castLuck({ bait: 1, group: true, mastery: 0 })).toBe(GROUP_FISHING.luck);
    expect(castLuck({ bait: 1, group: false, mastery: MAX_ROD_MASTERY - 1 })).toBe(1);
    expect(castLuck({ bait: 1.3, group: true, mastery: MAX_ROD_MASTERY })).toBeCloseTo(1.3 * GROUP_FISHING.luck * ROD_MASTERY.maxLevelLuck);
  });
});

describe("mordisqueos", () => {
  it("caen dentro de la espera, con margen, ordenados y hasta el máximo", () => {
    let k = 0;
    const random = (n: number) => (n === NIBBLES.max + 1 ? NIBBLES.max : [n - 1, 0][k++ % 2]!);
    const times = nibbleTimes(6_000, random);
    expect(times).toHaveLength(NIBBLES.max);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    for (const t of times) {
      expect(t).toBeGreaterThanOrEqual(NIBBLES.marginMs);
      expect(t).toBeLessThanOrEqual(6_000 - NIBBLES.marginMs);
    }
  });

  it("con una espera corta no hay", () => {
    expect(nibbleTimes(NIBBLES.minWaitMs - 1, () => NIBBLES.max)).toEqual([]);
  });
});
