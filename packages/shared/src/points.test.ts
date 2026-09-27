import { describe, expect, it } from "vitest";
import { claimedToday, dailyReward, dayStart, nextStreak, POINTS } from "./points";

// 2026-09-26 23:30 en Bogotá = 2026-09-27 04:30 UTC.
const bogota = (iso: string) => new Date(`${iso}-05:00`).getTime();

describe("días de Bogotá", () => {
  it("el día cambia a la medianoche de Bogotá, no a la de UTC", () => {
    expect(dayStart(bogota("2026-09-26T23:30:00"))).toBe(bogota("2026-09-26T00:00:00"));
    expect(dayStart(bogota("2026-09-27T00:10:00"))).toBe(bogota("2026-09-27T00:00:00"));
  });

  it("sabe si ya se reclamó hoy", () => {
    const now = bogota("2026-09-26T20:00:00");
    expect(claimedToday(new Date(bogota("2026-09-26T08:00:00")), now)).toBe(true);
    expect(claimedToday(new Date(bogota("2026-09-25T23:59:00")), now)).toBe(false);
    expect(claimedToday(null, now)).toBe(false);
  });
});

describe("racha del buzón", () => {
  const now = bogota("2026-09-26T09:00:00");
  it("sigue si el último reclamo fue ayer y se corta si pasó más de un día", () => {
    expect(nextStreak(null, 0, now)).toBe(1);
    expect(nextStreak(new Date(bogota("2026-09-25T22:00:00")), 3, now)).toBe(4);
    expect(nextStreak(new Date(bogota("2026-09-24T10:00:00")), 3, now)).toBe(1);
  });

  it("la recompensa sube con la racha hasta un tope", () => {
    expect(dailyReward(1)).toBe(POINTS.dailyBase);
    expect(dailyReward(2)).toBe(POINTS.dailyBase + POINTS.dailyStreakBonus);
    expect(dailyReward(100)).toBe(dailyReward(POINTS.dailyStreakMaxDays));
  });
});
