import { describe, expect, it } from "vitest";
import { trapStep } from "./focusTrap";

describe("trapStep", () => {
  it("sin nada enfocable, el foco se queda en la ventana", () => {
    expect(trapStep(0, -1, false)).toBe(-1);
    expect(trapStep(0, -1, true)).toBe(-1);
  });

  it("desde afuera (o la ventana misma) entra por el primero, o por el último con Shift", () => {
    expect(trapStep(3, -1, false)).toBe(0);
    expect(trapStep(3, -1, true)).toBe(2);
  });

  it("en los bordes da la vuelta", () => {
    expect(trapStep(3, 2, false)).toBe(0);
    expect(trapStep(3, 0, true)).toBe(2);
    expect(trapStep(1, 0, false)).toBe(0);
    expect(trapStep(1, 0, true)).toBe(0);
  });

  it("en el medio deja que el navegador siga solo", () => {
    expect(trapStep(3, 0, false)).toBeNull();
    expect(trapStep(3, 1, true)).toBeNull();
    expect(trapStep(3, 1, false)).toBeNull();
  });
});
