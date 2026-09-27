import { describe, expect, it } from "vitest";
import { SoundGate } from "./soundGate";

describe("limitador de sonidos", () => {
  it("no repite el mismo sonido antes de la pausa mínima", () => {
    const g = new SoundGate();
    expect(g.allow("paso", 0, 100, 50)).toBe(true);
    expect(g.allow("paso", 60, 100, 50)).toBe(false);
    expect(g.allow("paso", 100, 100, 50)).toBe(true);
  });

  it("sonidos distintos no se bloquean entre sí", () => {
    const g = new SoundGate();
    expect(g.allow("paso", 0, 100, 50)).toBe(true);
    expect(g.allow("pop", 0, 100, 50)).toBe(true);
  });

  it("no deja sonar más voces que el tope y las libera al terminar", () => {
    const g = new SoundGate(3);
    for (let i = 0; i < 3; i++) expect(g.allow(`s${i}`, 0, 0, 200)).toBe(true);
    expect(g.allow("otro", 10, 0, 200)).toBe(false);
    expect(g.active(10)).toBe(3);
    expect(g.allow("otro", 200, 0, 200)).toBe(true);
    expect(g.active(200)).toBe(1);
  });

  it("un sonido rechazado por el tope no cuenta como sonado", () => {
    const g = new SoundGate(1);
    expect(g.allow("a", 0, 0, 100)).toBe(true);
    expect(g.allow("b", 50, 1000, 100)).toBe(false);
    expect(g.allow("b", 100, 1000, 100)).toBe(true);
  });
});
