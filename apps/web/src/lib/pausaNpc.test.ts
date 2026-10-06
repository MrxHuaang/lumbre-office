import { describe, expect, it } from "vitest";
import { PAUSA_NPC, RelojNpc } from "./pausaNpc";

describe("la gente de la fiesta se queda quieta al hablarle", () => {
  it("sin hablar va con el reloj del juego", () => {
    const r = new RelojNpc();
    for (let m = 600; m < 610; m += 0.5) expect(r.minuto(m, false)).toBe(m);
  });

  it("con la tira abierta no avanza y al cerrarla se pone al día sin saltos", () => {
    const r = new RelojNpc();
    r.minuto(600, false);
    expect(r.minuto(605, true)).toBe(600);
    expect(r.minuto(610, true)).toBe(600);
    let antes = r.minuto(610, false);
    for (let m = 610.5; m <= 640; m += 0.5) {
      const ahora = r.minuto(m, false);
      // Avanza siempre, nunca más de lo que caminaría a 1,5 veces su paso.
      expect(ahora).toBeGreaterThan(antes);
      expect(ahora - antes).toBeLessThanOrEqual(0.5 * (1 + PAUSA_NPC.recupera) + 1e-9);
      antes = ahora;
    }
    expect(r.atraso()).toBe(0);
  });

  it("nunca se queda más atrás que el tope (el servidor lo acepta hasta ahí)", () => {
    const r = new RelojNpc();
    r.minuto(600, false);
    for (let m = 600; m < 600 + PAUSA_NPC.max * 3; m += 1) r.minuto(m, true);
    expect(r.atraso()).toBeLessThanOrEqual(PAUSA_NPC.max);
  });

  it("al empezar otro día va con todos", () => {
    const r = new RelojNpc();
    r.minuto(1430, false);
    r.minuto(1439, true);
    expect(r.minuto(2, false)).toBe(2);
  });
});
