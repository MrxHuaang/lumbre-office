import { describe, expect, it } from "vitest";
import {
  FISH,
  FISH_RARITIES,
  RARITY,
  bogotaHour,
  fishAvailable,
  fishById,
  fishPool,
  isBogotaDay,
  minReelMs,
  pickFish,
  rollSize,
} from "./fishing";
import { FishingSim, SIM_FRAME_MS, autoplay, barHeightFor, minReelFrames, replayFishing } from "./fishing-sim";

// 12:00 y 00:30 de Bogotá (UTC-5) del 26 de septiembre de 2026.
const NOON = Date.UTC(2026, 8, 26, 17, 0);
const MIDNIGHT = Date.UTC(2026, 8, 27, 5, 30);

describe("catálogo de peces", () => {
  it("más de 60 peces, cada uno con su rareza, tamaño, horario y dificultad dentro del rango", () => {
    const fish = FISH.filter((f) => f.rarity !== "basura");
    expect(fish.length).toBeGreaterThanOrEqual(60);
    expect(new Set(FISH.map((f) => f.id)).size).toBe(FISH.length);
    for (const f of FISH) {
      expect(f.id).toMatch(/^[a-z0-9-]+$/);
      expect(f.size[0]).toBeGreaterThan(0);
      expect(f.size[0]).toBeLessThanOrEqual(f.size[1]);
      expect(f.description.length).toBeGreaterThan(10);
      const [lo, hi] = RARITY[f.rarity].difficulty;
      expect(f.difficulty, f.id).toBeGreaterThanOrEqual(lo);
      expect(f.difficulty, f.id).toBeLessThanOrEqual(hi);
    }
    for (const r of FISH_RARITIES) expect(FISH.some((f) => f.rarity === r), r).toBe(true);
  });

  it("hay unos 5 legendarios (uno de noche), pocos míticos y la basura no da puntos", () => {
    const legends = FISH.filter((f) => f.rarity === "legendario");
    expect(legends.length).toBeGreaterThanOrEqual(4);
    expect(legends.length).toBeLessThanOrEqual(6);
    expect(legends.some((f) => f.time === "noche")).toBe(true);
    const myths = FISH.filter((f) => f.rarity === "mitico");
    expect(myths.length).toBeGreaterThanOrEqual(2);
    expect(myths.length).toBeLessThan(legends.length);
    expect(FISH.filter((f) => f.rarity === "basura").map((f) => f.id)).toEqual(expect.arrayContaining(["bota", "alga", "lata"]));
    expect(FISH.at(-1)!.id).toBe("lata");
    expect(RARITY.basura.points).toBe(0);
  });

  it("algunos peces piden lluvia, tormenta o niebla", () => {
    for (const w of ["lluvia", "tormenta", "niebla"] as const) expect(FISH.some((f) => f.weather === w), w).toBe(true);
  });

  it("a más rareza, más dificultad, más puntos y menos probabilidad", () => {
    const order = ["comun", "poco-comun", "raro", "epico", "legendario", "mitico"] as const;
    for (let i = 1; i < order.length; i++) {
      const a = RARITY[order[i - 1]!];
      const b = RARITY[order[i]!];
      expect(b.difficulty[0]).toBeGreaterThanOrEqual(a.difficulty[0]);
      expect(b.points).toBeGreaterThan(a.points);
      expect(b.weight).toBeLessThan(a.weight);
    }
  });
});

describe("horario de Bogotá", () => {
  it("calcula la hora de Bogotá", () => {
    expect(bogotaHour(NOON)).toBe(12);
    expect(bogotaHour(MIDNIGHT)).toBe(0);
    expect(isBogotaDay(NOON)).toBe(true);
    expect(isBogotaDay(MIDNIGHT)).toBe(false);
    expect(isBogotaDay(Date.UTC(2026, 8, 26, 11, 0))).toBe(true); // 6:00
    expect(isBogotaDay(Date.UTC(2026, 8, 26, 23, 0))).toBe(false); // 18:00
  });

  it("de día no pican los de noche y de noche no pican los de día", () => {
    const day = fishPool(NOON).map((p) => p.fish);
    const night = fishPool(MIDNIGHT).map((p) => p.fish);
    expect(day.some((f) => f.time === "noche")).toBe(false);
    expect(night.some((f) => f.time === "dia")).toBe(false);
    expect(day.some((f) => f.time === "siempre")).toBe(true);
    expect(fishAvailable(fishById("luminaria")!, MIDNIGHT)).toBe(true);
    expect(fishAvailable(fishById("luminaria")!, NOON)).toBe(false);
  });

  it("los del atardecer y los de la madrugada pican solo en su rato", () => {
    const at = (h: number) => Date.UTC(2026, 8, 26, h + 5, 30); // hora de Bogotá → UTC
    const guabina = fishById("guabina")!;
    const madre = fishById("madre-agua")!;
    expect(fishAvailable(guabina, at(17))).toBe(true);
    expect(fishAvailable(guabina, at(19))).toBe(true);
    expect(fishAvailable(guabina, at(12))).toBe(false);
    expect(fishAvailable(guabina, at(21))).toBe(false);
    expect(fishAvailable(madre, MIDNIGHT)).toBe(true);
    expect(fishAvailable(madre, at(3))).toBe(true);
    expect(fishAvailable(madre, at(5))).toBe(false);
    expect(fishAvailable(madre, NOON)).toBe(false);
  });
});

describe("clima", () => {
  it("los que piden clima solo pican con ese clima (la lluvia vale con tormenta)", () => {
    const rain = fishById("arcoiris")!;
    const storm = fishById("temblon")!;
    const fog = fishById("pez-niebla")!;
    expect(fishAvailable(rain, NOON)).toBe(false);
    expect(fishAvailable(rain, NOON, "despejado")).toBe(false);
    expect(fishAvailable(rain, NOON, "lluvia")).toBe(true);
    expect(fishAvailable(rain, NOON, "tormenta")).toBe(true);
    expect(fishAvailable(storm, NOON, "lluvia")).toBe(false);
    expect(fishAvailable(storm, NOON, "tormenta")).toBe(true);
    expect(fishAvailable(fog, NOON, "niebla")).toBe(true);
    expect(fishAvailable(fog, NOON, "nublado")).toBe(false);
  });

  it("con tormenta el lago tiene más especies que despejado", () => {
    const clear = fishPool(NOON, "despejado").map((p) => p.fish.id);
    const storm = fishPool(NOON, "tormenta").map((p) => p.fish.id);
    expect(storm.length).toBeGreaterThan(clear.length);
    expect(storm).toContain("rey-tormenta");
    expect(clear).not.toContain("rey-tormenta");
  });
});

describe("elección ponderada", () => {
  it("cada especie sale en proporción al peso de su rareza", () => {
    const pool = fishPool(NOON);
    const total = pool.reduce((a, p) => a + p.weight, 0);
    const counts = new Map<string, number>();
    // Recorre todos los valores posibles del azar: cada pez sale exactamente `peso` veces.
    for (let r = 0; r < total; r++) {
      const f = pickFish(NOON, () => r);
      counts.set(f.id, (counts.get(f.id) ?? 0) + 1);
    }
    for (const p of pool) expect(counts.get(p.fish.id), p.fish.id).toBe(p.weight);
    // Un legendario es mucho más raro que un común.
    const legend = pool.find((p) => p.fish.rarity === "legendario")!;
    const common = pool.find((p) => p.fish.rarity === "comun")!;
    expect(legend.weight * 20).toBeLessThan(common.weight);
  });

  it("de noche puede salir el legendario nocturno", () => {
    const pool = fishPool(MIDNIGHT);
    const total = pool.reduce((a, p) => a + p.weight, 0);
    const seen = new Set<string>();
    for (let r = 0; r < total; r++) seen.add(pickFish(MIDNIGHT, () => r).id);
    expect(seen.has("luminaria")).toBe(true);
    expect(seen.has("carpa-jade")).toBe(false);
  });

  it("el tamaño siempre queda dentro del rango del pez", () => {
    for (const f of FISH) {
      expect(rollSize(f, () => 0)).toBe(f.size[0]);
      expect(rollSize(f, (n) => n - 1)).toBe(f.size[1]);
      for (let i = 0; i < 20; i++) {
        const s = rollSize(f, (n) => Math.floor(Math.random() * n));
        expect(s).toBeGreaterThanOrEqual(f.size[0]);
        expect(s).toBeLessThanOrEqual(f.size[1]);
        expect(Number.isInteger(s)).toBe(true);
      }
    }
  });
});

describe("minijuego", () => {
  const setup = { seed: 1234, difficulty: 20, behavior: "mixed" as const, treasure: true };

  it("la barra es más corta y el medidor más lento en los peces difíciles", () => {
    expect(barHeightFor(110)).toBeLessThan(barHeightFor(15));
    expect(minReelFrames(110)).toBeGreaterThan(minReelFrames(15));
    expect(minReelMs(15)).toBeCloseTo(minReelFrames(15) * SIM_FRAME_MS);
    // Llenar el medidor lleva 5 segundos como mínimo.
    expect(minReelMs(0)).toBeGreaterThan(4500);
  });

  it("es determinista: repetir los mismos botones da el mismo final", () => {
    const run = autoplay(setup, { chaseTreasure: true });
    expect(run.done).toBe(true);
    expect(run.caught).toBe(true);
    const again = replayFishing(setup, run.inputs, run.frames);
    expect(again).toEqual({ done: true, caught: run.caught, treasure: run.treasure, frame: run.frames });
    expect(run.frames).toBeGreaterThanOrEqual(minReelFrames(setup.difficulty));
  });

  it("sin apretar nunca, el pez se escapa", () => {
    const sim = new FishingSim({ ...setup, behavior: "floater" });
    while (!sim.done) sim.step(false);
    expect(sim.caught).toBe(false);
  });

  it("rechaza botones desordenados o fuera de la partida", () => {
    expect(replayFishing(setup, [10, 5], 100)).toBeNull();
    expect(replayFishing(setup, [5, 5], 100)).toBeNull();
    expect(replayFishing(setup, [150], 100)).toBeNull();
    expect(replayFishing(setup, [], 0)).toBeNull();
  });

  it("todos los peces se pueden sacar (el jugador automático saca los comunes siempre)", () => {
    for (const f of FISH.filter((f) => f.rarity === "comun")) {
      const r = autoplay({ seed: 99, difficulty: f.difficulty, behavior: f.behavior, treasure: false });
      expect(r.caught, f.id).toBe(true);
    }
    for (const f of FISH.filter((f) => f.rarity === "legendario" || f.rarity === "mitico")) {
      let won = 0;
      for (let seed = 1; seed <= 30; seed++) if (autoplay({ seed: seed * 7919, difficulty: f.difficulty, behavior: f.behavior, treasure: false }).caught) won++;
      expect(won, f.id).toBeGreaterThan(0);
      expect(won, f.id).toBeLessThan(30);
    }
  });
});
