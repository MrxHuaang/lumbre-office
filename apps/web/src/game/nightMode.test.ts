import { describe, expect, it } from "vitest";
import { toggledNight, withAutoNight, type NightState } from "./nightMode";

const day: NightState = { night: false, autoNight: false, nightOverride: null };

describe("noche del reloj y botón manual", () => {
  it("sin forzar, la noche sigue al reloj del juego", () => {
    const s = withAutoNight(day, true);
    expect(s).toEqual({ night: true, autoNight: true, nightOverride: null });
    expect(withAutoNight(s, false).night).toBe(false);
  });

  it("el botón fuerza lo contrario y otro clic vuelve al reloj", () => {
    const forced = toggledNight(day);
    expect(forced).toEqual({ night: true, autoNight: false, nightOverride: true });
    // El reloj sigue de día: la noche forzada se mantiene.
    expect(withAutoNight(forced, false).night).toBe(true);
    expect(toggledNight(forced)).toEqual({ night: false, autoNight: false, nightOverride: null });
  });

  it("el forzado se suelta cuando el reloj lo alcanza", () => {
    const at19 = withAutoNight(toggledNight(day), true);
    expect(at19).toEqual({ night: true, autoNight: true, nightOverride: null });
    // Y a las 7:00 amanece solo.
    expect(withAutoNight(at19, false).night).toBe(false);
  });

  it("forzar el día de noche también vale", () => {
    const forcedDay = toggledNight(withAutoNight(day, true));
    expect(forcedDay).toEqual({ night: false, autoNight: true, nightOverride: false });
    expect(withAutoNight(forcedDay, true).night).toBe(false);
    expect(withAutoNight(forcedDay, false)).toEqual({ night: false, autoNight: false, nightOverride: null });
  });
});
