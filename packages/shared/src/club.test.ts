import { describe, expect, it } from "vitest";
import { ARCADE_GAMES, ARCADE_MACHINES, ArcadeFinishMessage, arcadeGameOf, plausibleScore, weekStart } from "./arcade";
import { beatAt, CLUB_TRACKS, ClubDjMessage, ClubDanceMessage, isPlaying, loopMs, trackElapsed } from "./club";
import { dayStart } from "./points";

describe("club", () => {
  it("las pistas tienen ids únicos y un tempo razonable", () => {
    expect(new Set(CLUB_TRACKS.map((t) => t.id)).size).toBe(CLUB_TRACKS.length);
    for (const t of CLUB_TRACKS) {
      expect(t.bpm).toBeGreaterThanOrEqual(60);
      expect(t.bpm).toBeLessThanOrEqual(140);
      expect(loopMs(t)).toBeGreaterThan(10_000);
    }
  });

  it("el tiempo de la pista sale de la hora del servidor y en pausa se queda quieto", () => {
    const s = { track: "house", startedAt: 10_000, paused: false, pausedAt: 0 };
    expect(trackElapsed(s, 12_000)).toBe(2000);
    // 124 bpm: 2 s son 4,13 tiempos.
    expect(beatAt(s, 12_000)).toBeCloseTo((2000 * 124) / 60_000);
    expect(isPlaying(s)).toBe(true);
    const paused = { ...s, paused: true, pausedAt: 500 };
    expect(trackElapsed(paused, 99_000)).toBe(500);
    expect(isPlaying(paused)).toBe(false);
    expect(trackElapsed({ ...s, track: "" }, 12_000)).toBeNull();
    expect(beatAt({ ...s, track: "no-existe" }, 12_000)).toBeNull();
  });

  it("los mensajes rechazan pistas y pasos que no existen", () => {
    expect(ClubDjMessage.safeParse({ action: "play", track: "lofi" }).success).toBe(true);
    expect(ClubDjMessage.safeParse({ action: "play", track: "metal" }).success).toBe(false);
    expect(ClubDjMessage.safeParse({ action: "pause" }).success).toBe(true);
    expect(ClubDanceMessage.safeParse({ move: "robot" }).success).toBe(true);
    expect(ClubDanceMessage.safeParse({ move: null }).success).toBe(true);
    expect(ClubDanceMessage.safeParse({ move: "twerk" }).success).toBe(false);
  });
});

describe("arcade", () => {
  it("cada máquina tiene un juego conocido o está fuera de servicio", () => {
    for (const g of ARCADE_MACHINES) if (g) expect(ARCADE_GAMES).toContain(g);
    // Las tres primeras, un juego distinto cada una.
    expect(new Set(ARCADE_MACHINES.slice(0, 3)).size).toBe(3);
    expect(arcadeGameOf(99)).toBeNull();
  });

  it("el puntaje tiene que caber en el tiempo jugado", () => {
    expect(plausibleScore("snake", 0, 0)).toBe(true);
    expect(plausibleScore("snake", 1, 0)).toBe(false);
    // Culebrita: un movimiento cada 70 ms como mucho.
    expect(plausibleScore("snake", 142, 10_000)).toBe(true);
    expect(plausibleScore("snake", 143, 10_000)).toBe(false);
    // Aleteo: el primer tubo a los 2,3 s y después uno cada 1,6 s.
    expect(plausibleScore("flappy", 5, 10_000)).toBe(true);
    expect(plausibleScore("flappy", 6, 10_000)).toBe(false);
    expect(plausibleScore("breakout", 26, 10_000)).toBe(true);
    expect(plausibleScore("breakout", 27, 10_000)).toBe(false);
    expect(plausibleScore("breakout", -1, 10_000)).toBe(false);
    expect(plausibleScore("breakout", 1.5, 10_000)).toBe(false);
    expect(ArcadeFinishMessage.safeParse({ token: "t", score: 10, steps: 600, inputs: [16, 33] }).success).toBe(true);
    expect(ArcadeFinishMessage.safeParse({ token: "t", score: 10 }).success).toBe(false);
    expect(ArcadeFinishMessage.safeParse({ token: "t", score: 10.5, steps: 600, inputs: [] }).success).toBe(false);
    expect(ArcadeFinishMessage.safeParse({ token: "t", score: 1, steps: 600, inputs: [-3] }).success).toBe(false);
  });

  it("la semana empieza el lunes a la medianoche de Bogotá", () => {
    // Miércoles 16 de septiembre de 2026, 15:00 en Bogotá (20:00 UTC).
    const wed = Date.UTC(2026, 8, 16, 20);
    // Lunes 14 a las 00:00 de Bogotá = 05:00 UTC.
    expect(weekStart(wed)).toBe(Date.UTC(2026, 8, 14, 5));
    // El lunes mismo, apenas pasada la medianoche, ya es la semana nueva; el domingo en la noche, la anterior.
    expect(weekStart(Date.UTC(2026, 8, 14, 5, 1))).toBe(Date.UTC(2026, 8, 14, 5));
    expect(weekStart(Date.UTC(2026, 8, 14, 4, 59))).toBe(Date.UTC(2026, 8, 7, 5));
    expect(weekStart(wed)).toBeLessThanOrEqual(dayStart(wed));
  });
});
