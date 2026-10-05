import { describe, expect, it } from "vitest";
import { windowToneAt, windowWeatherOf } from "./ventanas";

describe("ventanas con el clima y la luz del juego", () => {
  it("solo la lluvia, la tormenta y la nieve se ven en el vidrio", () => {
    expect(windowWeatherOf("lluvia")).toBe("rain");
    expect(windowWeatherOf("tormenta")).toBe("storm");
    expect(windowWeatherOf("nieve")).toBe("snow");
    for (const w of ["despejado", "nublado", "niebla"] as const) expect(windowWeatherOf(w)).toBeNull();
  });

  it("el tinte va al amanecer y al atardecer, nunca de noche", () => {
    expect(windowToneAt(6 * 60 + 59)).toBeNull();
    expect(windowToneAt(7 * 60)).toBe("dawn");
    expect(windowToneAt(12 * 60)).toBeNull();
    expect(windowToneAt(18 * 60)).toBe("dusk");
    expect(windowToneAt(19 * 60)).toBeNull();
  });
});
