import { describe, expect, it } from "vitest";
import {
  GAME_DAY_REAL_MS,
  addGameTime,
  clockStep,
  formatGameTime,
  gameTime,
  initialClock,
  isGameNight,
  parseTimeCommand,
  setGameTime,
  skyPhase,
  type GameClockState,
} from "./clock";

const at = (minute: number): GameClockState => ({ anchorReal: 0, anchorMinute: minute });

describe("reloj del juego", () => {
  it("un día del juego dura 24 minutos reales", () => {
    const c = at(0);
    expect(gameTime(c, GAME_DAY_REAL_MS)).toMatchObject({ day: 1, minuteOfDay: 0 });
    // Un segundo real es un minuto del juego.
    expect(gameTime(c, 90_000)).toMatchObject({ day: 0, hour: 1, minute: 30 });
  });

  it("la noche va de 19:00 a 6:59", () => {
    expect(isGameNight(at(19 * 60), 0)).toBe(true);
    expect(isGameNight(at(6 * 60 + 59), 0)).toBe(true);
    expect(isGameNight(at(7 * 60), 0)).toBe(false);
    expect(isGameNight(at(18 * 60 + 59), 0)).toBe(false);
  });

  it("arranca con la hora de Bogotá", () => {
    // 2026-09-27 15:00 UTC = 10:00 en Bogotá.
    const now = Date.UTC(2026, 8, 27, 15, 0);
    expect(gameTime(initialClock(now), now)).toMatchObject({ hour: 10, minute: 0 });
  });

  it("/time set va hacia adelante y no retrocede el día", () => {
    const c = at(3 * 1440 + 20 * 60); // día 3, 20:00
    const later = setGameTime(c, 0, 22 * 60);
    expect(gameTime(later, 0)).toMatchObject({ day: 3, hour: 22 });
    const tomorrow = setGameTime(c, 0, 7 * 60);
    expect(gameTime(tomorrow, 0)).toMatchObject({ day: 4, hour: 7 });
  });

  it("/time add adelanta y no acepta negativos", () => {
    const c = addGameTime(at(23 * 60), 0, 120);
    expect(gameTime(c, 0)).toMatchObject({ day: 1, hour: 1 });
    expect(gameTime(addGameTime(at(60), 0, -500), 0)).toMatchObject({ day: 0, hour: 1 });
  });

  it("formatea la hora", () => {
    expect(formatGameTime(7 * 60 + 5)).toBe("07:05");
    expect(formatGameTime(1440 + 61)).toBe("01:01");
  });
});

describe("parseTimeCommand", () => {
  it("entiende set, add y query", () => {
    expect(parseTimeCommand("/time set 18:30")).toEqual({ kind: "set", minuteOfDay: 18 * 60 + 30 });
    expect(parseTimeCommand("/time set 6")).toEqual({ kind: "set", minuteOfDay: 360 });
    expect(parseTimeCommand("/time set Noche")).toEqual({ kind: "set", minuteOfDay: 20 * 60 });
    expect(parseTimeCommand("/hora poner mediodía")).toEqual({ kind: "set", minuteOfDay: 12 * 60 });
    expect(parseTimeCommand("/time add 2h")).toEqual({ kind: "add", minutes: 120 });
    expect(parseTimeCommand("/time add 90")).toEqual({ kind: "add", minutes: 90 });
    expect(parseTimeCommand("/time")).toEqual({ kind: "query" });
  });

  it("rechaza lo que no es /time o está mal", () => {
    expect(parseTimeCommand("hola")).toBeNull();
    expect(parseTimeCommand("/time set 25:00")).toBeNull();
    expect(parseTimeCommand("/time set pronto")).toBeNull();
    expect(parseTimeCommand("/time add -3")).toBeNull();
    expect(parseTimeCommand("/time add")).toBeNull();
  });
});

describe("reloj del HUD", () => {
  it("avanza de a 10 minutos", () => {
    expect(formatGameTime(clockStep(18 * 60 + 47))).toBe("18:40");
    expect(clockStep(0)).toBe(0);
    expect(clockStep(9)).toBe(0);
    expect(clockStep(10)).toBe(10);
  });

  it("el cielo: amanecer, día, atardecer y noche (la noche es la del juego)", () => {
    expect(skyPhase(4 * 60 + 59)).toBe("noche");
    expect(skyPhase(5 * 60)).toBe("amanecer");
    expect(skyPhase(6 * 60 + 59)).toBe("amanecer");
    expect(skyPhase(7 * 60)).toBe("dia");
    expect(skyPhase(16 * 60 + 59)).toBe("dia");
    expect(skyPhase(17 * 60)).toBe("atardecer");
    expect(skyPhase(18 * 60 + 59)).toBe("atardecer");
    expect(skyPhase(19 * 60)).toBe("noche");
    expect(skyPhase(0)).toBe("noche");
  });
});
