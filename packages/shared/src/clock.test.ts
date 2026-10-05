import { describe, expect, it } from "vitest";
import {
  GAME_DAY_REAL_MS,
  addGameTime,
  clockStep,
  formatGameTime,
  gameTime,
  initialClock,
  GAME_EPOCH,
  parseGameClock,
  pauseClock,
  resumeClock,
  isGameNight,
  parseTimeCommand,
  setGameTime,
  skyPhase,
  type GameClockState,
} from "./clock";

const at = (minute: number): GameClockState => ({ anchorReal: 0, anchorMinute: minute });

describe("reloj del juego", () => {
  it("un día del juego dura una hora real", () => {
    const c = at(0);
    expect(GAME_DAY_REAL_MS).toBe(60 * 60_000);
    expect(gameTime(c, GAME_DAY_REAL_MS)).toMatchObject({ day: 1, minuteOfDay: 0 });
    // Una hora del juego son 2,5 minutos reales.
    expect(gameTime(c, 150_000 + 75_000)).toMatchObject({ day: 0, hour: 1, minute: 30 });
  });

  it("la noche va de 19:00 a 6:59", () => {
    expect(isGameNight(at(19 * 60), 0)).toBe(true);
    expect(isGameNight(at(6 * 60 + 59), 0)).toBe(true);
    expect(isGameNight(at(7 * 60), 0)).toBe(false);
    expect(isGameNight(at(18 * 60 + 59), 0)).toBe(false);
  });

  it("el reloj de siempre sigue contando desde el día 0 (reiniciar no lo vuelve a empezar)", () => {
    expect(gameTime(initialClock(), GAME_EPOCH)).toMatchObject({ day: 0, hour: 0, minute: 0 });
    // Una hora real después es el día 1; 90 minutos reales, el día 1 a las 12:00.
    expect(gameTime(initialClock(), GAME_EPOCH + 90 * 60_000)).toMatchObject({ day: 1, hour: 12, minute: 0 });
    expect(initialClock()).toEqual(initialClock());
  });

  it("lee un reloj guardado y descarta lo que no sirve", () => {
    expect(parseGameClock({ anchorReal: 5, anchorMinute: 90 })).toEqual({ anchorReal: 5, anchorMinute: 90 });
    expect(parseGameClock({ anchorReal: "5", anchorMinute: 90 })).toBeNull();
    expect(parseGameClock({ anchorReal: 5, anchorMinute: -1 })).toBeNull();
    expect(parseGameClock(null)).toBeNull();
    expect(parseGameClock({ anchorReal: 5, anchorMinute: 90, paused: true })).toEqual({ anchorReal: 5, anchorMinute: 90, paused: true });
  });

  it("en pausa no corre, y al reanudar sigue desde el minuto en que quedó", () => {
    const c = at(2 * 1440 + 10 * 60);
    const hour = GAME_DAY_REAL_MS / 24;
    const paused = pauseClock(c, hour); // 11:00
    expect(gameTime(paused, hour)).toMatchObject({ day: 2, hour: 11 });
    expect(gameTime(paused, 50 * hour)).toMatchObject({ day: 2, hour: 11 });
    const again = resumeClock(paused, 50 * hour);
    expect(again.paused).toBeUndefined();
    expect(gameTime(again, 50 * hour)).toMatchObject({ day: 2, hour: 11 });
    expect(gameTime(again, 51 * hour)).toMatchObject({ day: 2, hour: 12 });
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
