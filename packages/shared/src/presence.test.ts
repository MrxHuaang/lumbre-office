import { describe, expect, it } from "vitest";
import { effectiveStatus, IdleTimer } from "./presence";

const opts = { idleMs: 1000, hiddenMs: 300 };

describe("temporizador de ausente", () => {
  it("pasa a inactivo tras el tiempo sin mouse ni teclado y vuelve con la actividad", () => {
    const t = new IdleTimer(0, opts);
    expect(t.check(999)).toBe(false);
    expect(t.idle).toBe(false);
    expect(t.check(1000)).toBe(true);
    expect(t.idle).toBe(true);
    expect(t.check(5000)).toBe(false); // sigue inactivo: no avisa de nuevo
    expect(t.activity(5001)).toBe(true);
    expect(t.idle).toBe(false);
  });

  it("la actividad reinicia la cuenta", () => {
    const t = new IdleTimer(0, opts);
    t.activity(800);
    expect(t.check(1500)).toBe(false);
    expect(t.check(1800)).toBe(true);
  });

  it("con la pestaña oculta basta menos, y volver a verla cuenta como actividad", () => {
    const t = new IdleTimer(0, opts);
    expect(t.visibility(true, 100)).toBe(false);
    expect(t.check(399)).toBe(false);
    expect(t.check(400)).toBe(true);
    expect(t.idle).toBe(true);
    expect(t.visibility(false, 2000)).toBe(true);
    expect(t.idle).toBe(false);
    // Ocultarla otra vez empieza la cuenta de cero.
    t.visibility(true, 3000);
    expect(t.check(3200)).toBe(false);
  });
});

describe("estado que se ve", () => {
  it("el ausente automático se quita solo y respeta el manual", () => {
    expect(effectiveStatus({ manual: "busy", idle: true, meeting: false })).toBe("away");
    expect(effectiveStatus({ manual: "busy", idle: false, meeting: false })).toBe("busy");
    expect(effectiveStatus({ manual: "away", idle: false, meeting: false })).toBe("away");
  });

  it("no molestar gana a todo; la reunión, al ausente automático", () => {
    expect(effectiveStatus({ manual: "dnd", idle: true, meeting: true })).toBe("dnd");
    expect(effectiveStatus({ manual: "available", idle: true, meeting: true })).toBe("meeting");
    expect(effectiveStatus({ manual: "away", idle: false, meeting: true })).toBe("away");
  });
});
