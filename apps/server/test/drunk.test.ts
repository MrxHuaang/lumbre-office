import { DRUNK, drunkDecay, drunkStage, msToNextDrunkStage, usesOf, type DrunkStage } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { Drunkenness } from "../src/rooms/drunk";

/** Reloj falso: la hora avanza a mano y los temporizadores se disparan cuando les toca. */
function fakeTime() {
  let now = 0;
  const timers: { at: number; fn: () => void; cleared: boolean }[] = [];
  return {
    now: () => now,
    clock: {
      setTimeout(fn: () => void, ms: number) {
        const t = { at: now + ms, fn, cleared: false };
        timers.push(t);
        return { clear: () => void (t.cleared = true) };
      },
    },
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const next = timers.filter((t) => !t.cleared && t.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        next.cleared = true;
        now = next.at;
        next.fn();
      }
      now = end;
    },
  };
}

function setup() {
  const time = fakeTime();
  const changes: DrunkStage[] = [];
  const events: string[] = [];
  const drunk = new Drunkenness(time.clock, time.now, {
    onChange: (_u, stage) => changes.push(stage),
    onBlackout: () => events.push("blackout"),
    onWake: () => events.push("wake"),
  });
  /** Tomarse `n` sorbos de algo, uno tras otro. */
  const sip = (art: string, n = 1) => {
    for (let k = 0; k < n; k++) drunk.consumed("u", art);
  };
  return { time, drunk, changes, events, sip };
}

describe("borrachera", () => {
  it("las etapas y la evaporación", () => {
    expect(drunkStage(0)).toBe(0);
    expect(drunkStage(DRUNK.stages[0])).toBe(1);
    expect(drunkStage(DRUNK.stages[2])).toBe(3);
    expect(drunkDecay(3, 60_000)).toBeCloseTo(3 - DRUNK.decayPerMinute);
    expect(drunkDecay(1, 10 * 60_000)).toBe(0);
    expect(msToNextDrunkStage(0)).toBe(Infinity);
  });

  it("el café no emborracha", () => {
    const { drunk, sip, changes } = setup();
    sip("tinto", 3);
    sip("cigarro", 5);
    expect(drunk.stage("u")).toBe(0);
    expect(changes).toEqual([]);
  });

  it("una cerveza entera alegra; un whisky y un cóctel encima emborrachan", () => {
    const { drunk, sip, changes, events } = setup();
    sip("cerveza", usesOf("cerveza"));
    expect(drunk.stage("u")).toBe(1);
    sip("whisky", usesOf("whisky"));
    sip("coctel", 1);
    expect(drunk.stage("u")).toBe(3);
    expect(changes).toEqual([1, 2, 3]);
    expect(events).toEqual([]);
  });

  it("se pasa solo en unos minutos, bajando de a una etapa", () => {
    const { drunk, sip, changes, time } = setup();
    sip("whisky", 7); // 8,4: borracho, sin llegar al desmayo
    expect(drunk.stage("u")).toBe(3);
    const toSober = ((8.4 - DRUNK.stages[0]) * 60_000) / DRUNK.decayPerMinute;
    time.advance(toSober - 1000);
    expect(drunk.stage("u")).toBe(1);
    time.advance(2000);
    expect(drunk.stage("u")).toBe(0);
    expect(changes).toEqual([1, 2, 3, 2, 1, 0]);
    // Ni tan poco ni para siempre: entre 3 y 6 minutos.
    expect(toSober).toBeGreaterThan(3 * 60_000);
    expect(toSober).toBeLessThan(6 * 60_000);
  });

  it("pasarse desmaya: no se toma nada más y se despierta mareado", () => {
    const { drunk, sip, changes, events, time } = setup();
    sip("whisky", 8); // 9,6: se pasa
    expect(drunk.stage("u")).toBe(4);
    expect(drunk.fainted("u")).toBe(true);
    expect(events).toEqual(["blackout"]);
    sip("whisky", 5); // desmayado no cuenta
    expect(events).toEqual(["blackout"]);
    time.advance(DRUNK.faintMs);
    expect(events).toEqual(["blackout", "wake"]);
    expect(drunk.fainted("u")).toBe(false);
    expect(drunk.stage("u")).toBe(drunkStage(DRUNK.wakeUnits));
    expect(changes.slice(-2)).toEqual([4, drunkStage(DRUNK.wakeUnits)]);
    // Y después se le pasa del todo.
    time.advance(10 * 60_000);
    expect(drunk.stage("u")).toBe(0);
  });
});
