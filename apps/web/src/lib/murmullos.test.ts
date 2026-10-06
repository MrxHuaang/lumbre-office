import { describe, expect, it } from "vitest";
import { conTexto, cupoMurmullo, MURMULLO, respuestaA, slotMurmullo, tocaMurmullo, turnoDeCorrillo } from "./murmullos";

describe("el cupo de murmullos de todo el juego", () => {
  const cerca = { dist: 1, visibles: 0, tira: false };
  it("dos a la vez como mucho: el tercero solo se ve si contesta a algo mío (y se va el más viejo)", () => {
    expect(MURMULLO.maxTextos).toBe(2);
    expect(cupoMurmullo(cerca)).toBe("si");
    expect(cupoMurmullo({ ...cerca, visibles: 1 })).toBe("si");
    expect(cupoMurmullo({ ...cerca, visibles: 2 })).toBe("no");
    expect(cupoMurmullo({ ...cerca, visibles: 2, prioridad: true })).toBe("reemplaza");
  });

  it("de lejos o con la tira abierta, nada (ni lo que contesta); lo de una cinemática sí, sin pasar de dos", () => {
    expect(cupoMurmullo({ ...cerca, dist: MURMULLO.leeTiles + 0.5 })).toBe("no");
    expect(cupoMurmullo({ ...cerca, dist: MURMULLO.leeTiles + 0.5, prioridad: true })).toBe("no");
    expect(cupoMurmullo({ ...cerca, tira: true, prioridad: true })).toBe("no");
    expect(cupoMurmullo({ dist: 40, visibles: 0, tira: true, forzar: true })).toBe("si");
    expect(cupoMurmullo({ dist: 40, visibles: 2, tira: true, forzar: true })).toBe("reemplaza");
  });
});

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
