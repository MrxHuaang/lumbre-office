import { getWorld } from "@hyvento/map";
import { GREENHOUSE_PLOT_BASE, cropById, plantPlot, plotReadyAt, waterPlot, type PlotState, type Weather } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { Huerto } from "../src/rooms/huerto";
import { WeatherCycle } from "../src/rooms/weather";

// Las estaciones en el servidor: solo nieva en invierno y la lluvia riega sola el huerto de afuera.

const jardin = getWorld().areas.get("jardin")!;
const alice = { userId: "u-alice", name: "Alice" };

/** Un huerto con parcelas en un Map, sin base ni mano (solo para regar). */
function garden() {
  const plots = new Map<string, PlotState>();
  const saved: number[] = [];
  const huerto = new Huerto<PlotState>({
    plots,
    create: () => ({}) as PlotState,
    repo: () => ({ loadGarden: async () => [], saveGardenPlot: async (id) => void saved.push(id) }),
    held: { get: () => undefined, spend: () => null, fill: () => false },
    bag: { fits: () => "ok", add: async () => "ok" },
    award: async () => 0,
  });
  return { plots, huerto, saved };
}

/** Temporizadores a mano: `advance` dispara los que vencen. */
function fakeTime(start: number) {
  let now = start;
  const timers: { at: number; fn: () => void; dead: boolean }[] = [];
  return {
    now: () => now,
    clock: {
      setTimeout(fn: () => void, ms: number) {
        const t = { at: now + ms, fn, dead: false };
        timers.push(t);
        return { clear: () => void (t.dead = true) };
      },
    },
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const next = timers.filter((t) => !t.dead && t.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        next.dead = true;
        now = next.at;
        next.fn();
      }
      now = end;
    },
  };
}

/** Generador determinista simple (LCG). */
function lcg(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function weatherOver(start: number, hours: number) {
  const time = fakeTime(start);
  const seen = new Set<Weather>();
  const cycle = new WeatherCycle({ clock: time.clock, now: time.now, random: lcg(4), onChange: (w) => seen.add(w) }, "nublado");
  cycle.start();
  time.advance(hours * 3_600_000);
  cycle.dispose();
  return seen;
}

describe("estaciones en la sala", () => {
  it("en diciembre puede nevar; en septiembre, nunca", () => {
    expect(weatherOver(Date.UTC(2026, 11, 10, 17), 72).has("nieve")).toBe(true);
    expect(weatherOver(Date.UTC(2026, 8, 10, 17), 72).has("nieve")).toBe(false);
  });

  it("la lluvia riega las parcelas que se están secando (no las del invernadero ni las listas)", async () => {
    const { plots, huerto, saved } = garden();
    const t = Date.UTC(2026, 8, 27, 15, 0);
    const papa = cropById("papa")!;
    plots.set("0", plantPlot("papa", alice, t - 60_000));
    plots.set("1", { ...plantPlot("papa", alice, t - 60_000), greenhouse: true });
    // Recién regada: todavía húmeda, no hace falta.
    plots.set("2", waterPlot(plantPlot("papa", alice, t - 1000), t - 1000));
    // Lista para cosechar.
    plots.set("3", { ...plantPlot("papa", alice, t - papa.growMs), growthMs: papa.growMs });
    // Un bancal del invernadero (ids desde GREENHOUSE_PLOT_BASE): tiene techo.
    plots.set(String(GREENHOUSE_PLOT_BASE), plantPlot("uchuva", alice, t - 60_000));
    expect(huerto.rain(jardin, t)).toBe(1);
    expect(plots.get(String(GREENHOUSE_PLOT_BASE))!.wateredUntil).toBe(0);
    expect(plots.get("0")!.wateredUntil).toBeGreaterThan(t);
    expect(plots.get("1")!.wateredUntil).toBe(0);
    expect(plots.get("2")!.wateredUntil).toBeLessThan(t + papa.growMs);
    expect(plotReadyAt(plots.get("3")!)).toBeLessThanOrEqual(t);
    await huerto.flush();
    expect(saved).toEqual([0]);
  });
});
