import { describe, expect, it } from "vitest";
import { BirthdayField, birthdayKeysOn, eventDay, formatBirthday, isBirthdayOn, isKaraokeDay, isKaraokeTime, karaokeSearchUrl, parseBirthday } from "./events";

/** Hora de Bogotá (UTC-5) como timestamp. */
const bogota = (y: number, m: number, d: number, h: number, min = 0) => Date.UTC(y, m - 1, d, h + 5, min);

describe("cumpleaños", () => {
  it("se guarda como MM-DD y rechaza fechas que no existen", () => {
    expect(parseBirthday("09-27")).toEqual({ month: 9, day: 27 });
    expect(parseBirthday("02-29")).toEqual({ month: 2, day: 29 });
    expect(parseBirthday("04-31")).toBeNull();
    expect(parseBirthday("13-01")).toBeNull();
    expect(parseBirthday("9-27")).toBeNull();
    expect(BirthdayField.safeParse("12-25").success).toBe(true);
    expect(BirthdayField.safeParse(null).success).toBe(true);
    expect(BirthdayField.safeParse("02-30").success).toBe(false);
    expect(formatBirthday("09-27")).toBe("27 de septiembre");
  });

  it("el día cuenta en Bogotá: a las 23:00 de Bogotá todavía es el mismo día", () => {
    expect(isBirthdayOn("09-27", bogota(2026, 9, 27, 23, 30))).toBe(true);
    expect(isBirthdayOn("09-27", bogota(2026, 9, 28, 0, 1))).toBe(false);
    expect(isBirthdayOn(null, bogota(2026, 9, 27, 12))).toBe(false);
    expect(eventDay(bogota(2026, 9, 27, 0, 0))).toBe(eventDay(bogota(2026, 9, 27, 23, 59)));
  });

  it("quien nació un 29 de febrero celebra el 28 en los años no bisiestos", () => {
    expect(birthdayKeysOn(bogota(2027, 2, 28, 12))).toEqual(["02-28", "02-29"]);
    expect(birthdayKeysOn(bogota(2028, 2, 28, 12))).toEqual(["02-28"]);
    expect(isBirthdayOn("02-29", bogota(2028, 2, 29, 12))).toBe(true);
  });
});

describe("viernes de karaoke", () => {
  it("empieza el viernes a las 17:00 de Bogotá y dura hasta la medianoche", () => {
    // 2 de octubre de 2026: viernes.
    expect(isKaraokeTime(bogota(2026, 10, 2, 16, 59))).toBe(false);
    expect(isKaraokeTime(bogota(2026, 10, 2, 17, 0))).toBe(true);
    expect(isKaraokeTime(bogota(2026, 10, 2, 23, 59))).toBe(true);
    expect(isKaraokeTime(bogota(2026, 10, 3, 0, 0))).toBe(false);
    expect(isKaraokeTime(bogota(2026, 10, 1, 20, 0))).toBe(false);
    expect(isKaraokeDay(2026, 10, 2)).toBe(true);
    expect(isKaraokeDay(2026, 10, 3)).toBe(false);
  });

  it("la búsqueda de YouTube le suma «karaoke» a la canción", () => {
    expect(karaokeSearchUrl("  Vivir mi vida ")).toBe("https://www.youtube.com/results?search_query=Vivir%20mi%20vida%20karaoke");
  });
});
