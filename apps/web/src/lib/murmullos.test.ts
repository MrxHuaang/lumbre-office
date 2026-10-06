import { describe, expect, it } from "vitest";
import { conTexto, MURMULLO, respuestaA, slotMurmullo, tocaMurmullo, turnoDeCorrillo } from "./murmullos";

describe("los murmullos de la gente de la fiesta", () => {
  it("como mucho dos textos en pantalla, los más cercanos y solo a 3 tiles o menos", () => {
    const c = [
      { id: "a", dist: 2.5 },
      { id: "b", dist: 0.8 },
      { id: "c", dist: 1.5 },
      { id: "d", dist: 4 },
    ];
    expect([...conTexto(c, 0)].sort()).toEqual(["b", "c"]);
    expect([...conTexto(c, 1)]).toEqual(["b"]);
    expect(conTexto(c, 2).size).toBe(0);
    expect(conTexto([{ id: "lejos", dist: MURMULLO.leeTiles + 0.1 }], 0).size).toBe(0);
  });

  it("no hablan todos a la vez: cada uno en su vuelta, y en el corrillo por turnos", () => {
    const slots = Array.from({ length: 30 }, (_, i) => i);
    for (const hash of [0, 7, 1234, 99991]) {
      const n = slots.filter((s) => tocaMurmullo(hash, s)).length;
      expect(n).toBeGreaterThan(4);
      expect(n).toBeLessThan(12);
    }
    expect(slotMurmullo(0)).toBe(slotMurmullo(100));
    expect(turnoDeCorrillo(0, 3)).toBe(0);
    expect(turnoDeCorrillo(MURMULLO.turnoMs, 3)).toBe(1);
    expect(turnoDeCorrillo(MURMULLO.turnoMs * 3, 3)).toBe(0);
    expect(turnoDeCorrillo(5000, 0)).toBe(0);
  });

  it("al baile contestan con aplausos; al saludo, con un saludo", () => {
    expect(respuestaA("dance")).toBe("clap");
    expect(respuestaA("wave")).toBe("wave");
    expect(respuestaA("sleep")).toBeNull();
  });
});
