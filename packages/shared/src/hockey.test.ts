import { describe, expect, it } from "vitest";
import {
  aimMallet,
  botAim,
  clampToHalf,
  HOCKEY,
  HOCKEY_GOAL_X0,
  HOCKEY_MID,
  newHockeyWorld,
  stepHockey,
  type HockeyEvent,
  type HockeyWorld,
} from "./hockey";

/** Pasos hasta que haya un gol (o `max`): devuelve el lado que lo hizo y todos los eventos. */
function runUntilGoal(w: HockeyWorld, max: number, each?: (w: HockeyWorld) => void) {
  const all: HockeyEvent[] = [];
  for (let i = 0; i < max; i++) {
    each?.(w);
    const ev = stepHockey(w, true);
    all.push(...ev);
    const goal = ev.find((e) => typeof e === "object");
    if (goal) return { goal: goal.goal, steps: i + 1, all };
  }
  return { goal: null, steps: max, all };
}

describe("hockey: física", () => {
  it("el mazo no sale de su mitad ni de la cancha", () => {
    expect(clampToHalf(0, -10, 999)).toEqual({ x: HOCKEY.malletR, y: HOCKEY_MID - HOCKEY.malletR });
    expect(clampToHalf(1, 999, -5)).toEqual({ x: HOCKEY.width - HOCKEY.malletR, y: HOCKEY_MID + HOCKEY.malletR });
    const w = newHockeyWorld(0);
    aimMallet(w, 1, 5, 0); // quiere cruzar al campo rival
    for (let i = 0; i < 120; i++) stepHockey(w, false);
    expect(w.mallets[1].y).toBeCloseTo(HOCKEY_MID + HOCKEY.malletR);
    aimMallet(w, 1, Number.NaN, 3); // un número raro no lo mueve
    expect(w.mallets[1].tx).toBe(5);
  });

  it("el mazo no va más rápido que su velocidad máxima", () => {
    const w = newHockeyWorld(0);
    const start = { x: w.mallets[0].x, y: w.mallets[0].y };
    aimMallet(w, 0, HOCKEY.malletR, HOCKEY_MID - HOCKEY.malletR);
    stepHockey(w, false);
    const moved = Math.hypot(w.mallets[0].x - start.x, w.mallets[0].y - start.y);
    expect(moved).toBeLessThanOrEqual((HOCKEY.malletSpeed * HOCKEY.stepMs) / 1000 + 1e-9);
    // Y el de la máquina, más lento.
    const b = newHockeyWorld(0);
    aimMallet(b, 1, HOCKEY.width - HOCKEY.malletR, HOCKEY.length - HOCKEY.malletR);
    const from = { x: b.mallets[1].x, y: b.mallets[1].y };
    stepHockey(b, false, [HOCKEY.malletSpeed, HOCKEY.botSpeed]);
    expect(Math.hypot(b.mallets[1].x - from.x, b.mallets[1].y - from.y)).toBeLessThanOrEqual((HOCKEY.botSpeed * HOCKEY.stepMs) / 1000 + 1e-9);
  });

  it("el disco rebota en las bandas y en la punta fuera de la boca del arco", () => {
    const w = newHockeyWorld(0);
    w.puck = { x: 5, y: 20, vx: -80, vy: 0 };
    let steps = 0;
    while (!stepHockey(w, true).includes("wall") && steps < 30) steps++;
    expect(steps).toBeLessThan(30);
    expect(w.puck.x).toBeCloseTo(HOCKEY.puckR);
    expect(w.puck.vx).toBeGreaterThan(0);
    // Hacia la punta norte pero por el costado (fuera de la boca): rebota, no es gol.
    const p = newHockeyWorld(0);
    p.mallets[0].x = p.mallets[0].tx = HOCKEY.width - 3;
    p.puck = { x: HOCKEY_GOAL_X0 - 3, y: 10, vx: 0, vy: -90 };
    const r = runUntilGoal(p, 20);
    expect(r.goal).toBeNull();
    expect(p.puck.vy).toBeGreaterThan(0);
  });

  it("el disco que entra por la boca del arco es gol del otro lado", () => {
    const north = newHockeyWorld(0);
    north.mallets[0].x = north.mallets[0].tx = 3; // el arquero corrido
    north.puck = { x: HOCKEY.width / 2, y: 12, vx: 0, vy: -90 };
    expect(runUntilGoal(north, 60).goal).toBe(1);
    const south = newHockeyWorld(1);
    south.mallets[1].x = south.mallets[1].tx = 3;
    south.puck = { x: HOCKEY.width / 2, y: 30, vx: 0, vy: 90 };
    expect(runUntilGoal(south, 60).goal).toBe(0);
  });

  it("un mazo que avanza le pega al disco y lo manda al campo rival", () => {
    const w = newHockeyWorld(0);
    // El disco quieto en la mitad norte y el mazo del norte que va hacia él desde atrás.
    w.puck = { x: HOCKEY.width / 2, y: 14, vx: 0, vy: 0 };
    aimMallet(w, 0, HOCKEY.width / 2, 20);
    const r = runUntilGoal(w, 20);
    expect(r.all).toContain("hit");
    expect(w.puck.vy).toBeGreaterThan(20);
    expect(Math.hypot(w.puck.vx, w.puck.vy)).toBeLessThanOrEqual(HOCKEY.puckMax + 1e-9);
  });

  it("es determinista: la misma partida da exactamente lo mismo", () => {
    const play = () => {
      const w = newHockeyWorld(1);
      for (let i = 0; i < 600; i++) {
        const a = botAim(w, 0);
        aimMallet(w, 0, a.x, a.y);
        const b = botAim(w, 1);
        aimMallet(w, 1, b.x, b.y);
        const ev = stepHockey(w, true, [HOCKEY.botSpeed, HOCKEY.botSpeed]);
        if (ev.some((e) => typeof e === "object")) break;
      }
      return JSON.stringify(w);
    };
    expect(play()).toBe(play());
  });

  it("la máquina saca y le hace un gol a un arco vacío", () => {
    const w = newHockeyWorld(1);
    // El lado 0 no se mueve de un costado: la máquina (lado 1) tiene que pegarle y meterla.
    w.mallets[0].x = w.mallets[0].tx = 3;
    const r = runUntilGoal(w, 60 * 20, (x) => {
      const t = botAim(x, 1);
      aimMallet(x, 1, t.x, t.y);
    });
    expect(r.goal).toBe(1);
  });
});
