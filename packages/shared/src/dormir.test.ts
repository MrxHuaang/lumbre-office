import { describe, expect, it } from "vitest";
import { cuentaDormidos, DORMIR, DORMIR_USABLES, horaDeDormir, saltaLaNoche, type Durmiente } from "./dormir";
import { USABLE_FURNITURE } from "./consumables";

const g = (dormido: boolean, extra: Partial<Durmiente> = {}): Durmiente => ({ dormido, enLlamada: false, enReunion: false, ...extra });

describe("dormir hace amanecer", () => {
  it("se duerme de noche del juego (19:00 a 06:59)", () => {
    expect(horaDeDormir(19 * 60)).toBe(true);
    expect(horaDeDormir(3 * 60)).toBe(true);
    expect(horaDeDormir(6 * 60 + 59)).toBe(true);
    expect(horaDeDormir(7 * 60)).toBe(false);
    expect(horaDeDormir(12 * 60)).toBe(false);
  });

  it("con pocos, tienen que dormir todos", () => {
    expect(saltaLaNoche([g(true)])).toBe(true);
    expect(saltaLaNoche([g(true), g(false)])).toBe(false);
    expect(saltaLaNoche([g(true), g(true), g(true)])).toBe(true);
    expect(saltaLaNoche([g(true), g(true), g(false)])).toBe(false);
  });

  it("con más de 3, basta la mitad", () => {
    expect(saltaLaNoche([g(true), g(true), g(false), g(false)])).toBe(true);
    expect(saltaLaNoche([g(true), g(false), g(false), g(false)])).toBe(false);
    expect(saltaLaNoche([g(true), g(true), g(true), g(false), g(false)])).toBe(true);
    expect(saltaLaNoche([g(true), g(true), g(false), g(false), g(false)])).toBe(false);
    expect(cuentaDormidos([g(true), g(false), g(false), g(false), g(false)])).toEqual({ dormidos: 1, total: 5, faltan: 2 });
  });

  it("nadie en llamada ni en reunión, ni siquiera despierto", () => {
    expect(saltaLaNoche([g(true), g(true), g(false, { enLlamada: true }), g(false)])).toBe(false);
    expect(saltaLaNoche([g(true, { enReunion: true })])).toBe(false);
  });

  it("sin nadie dormido no se salta nada", () => {
    expect(saltaLaNoche([])).toBe(false);
    expect(saltaLaNoche([g(false)])).toBe(false);
  });

  it("las camas se usan con E, solo de noche", () => {
    for (const t of DORMIR.camas) {
      expect(USABLE_FURNITURE[t]).toEqual(DORMIR_USABLES[t]);
      expect(USABLE_FURNITURE[t]?.action).toBe("sleep");
      expect(USABLE_FURNITURE[t]?.nightOnly).toBe(true);
    }
  });
});
