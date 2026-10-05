import { describe, expect, it } from "vitest";
import { cineById } from "./cinematicas";
import { SEASONS } from "./estaciones";
import { FESTIVAL_IDS, FESTIVALES, festivalCineId, festivalEn, festivalesDe, festivalFase, festivalLine } from "./festivales";

describe("festivales", () => {
  it("todos están, una vez, dentro de su estación de 21 días y sin pisarse", () => {
    expect(FESTIVALES.map((f) => f.id).sort()).toEqual([...FESTIVAL_IDS].sort());
    for (const season of SEASONS) {
      const taken = new Set<number>();
      for (const f of festivalesDe(season)) {
        expect(f.dia, f.id).toBeGreaterThanOrEqual(1);
        expect(f.dia + f.dias - 1, f.id).toBeLessThanOrEqual(21);
        for (let d = f.dia; d < f.dia + f.dias; d++) {
          expect(taken.has(d), `${f.id} día ${d}`).toBe(false);
          taken.add(d);
        }
      }
    }
  });

  it("cada estación tiene al menos uno", () => {
    for (const season of SEASONS) expect(festivalesDe(season).length, season).toBeGreaterThan(0);
  });

  it("dice qué festival cae en cada día (los de varios días, todos sus días)", () => {
    expect(festivalEn("otono", 21)?.id).toBe("brujas");
    expect(festivalEn("otono", 20)).toBeNull();
    expect(festivalEn("invierno", 12)?.id).toBe("novenas");
    expect(festivalEn("invierno", 20)?.id).toBe("novenas");
    expect(festivalEn("invierno", 21)?.id).toBe("ano-viejo");
  });

  it("abre a las 9 y cierra a las 22 del juego", () => {
    expect(festivalFase(8 * 60 + 59)).toBe("previa");
    expect(festivalFase(9 * 60)).toBe("fiesta");
    expect(festivalFase(21 * 60 + 59)).toBe("fiesta");
    expect(festivalFase(22 * 60)).toBe("fin");
  });

  it("cada festival tiene su apertura, su cierre y su llegada tarde en el catálogo de cinemáticas", () => {
    for (const f of FESTIVALES) for (const m of ["apertura", "cierre", "llegada"] as const) expect(cineById(festivalCineId(f.id, m)), `${f.id} ${m}`).toBeDefined();
  });

  it("los momentos con hora caen dentro de la fiesta y su cinemática existe", () => {
    for (const f of FESTIVALES)
      for (const m of f.momentos ?? []) {
        expect(festivalFase(m.minuto), `${f.id} ${m.cine}`).toBe("fiesta");
        expect(cineById(m.cine), m.cine).toBeDefined();
      }
  });

  it("los NPC dicen frases del festival", () => {
    const brujas = FESTIVALES.find((f) => f.id === "brujas")!;
    expect(festivalLine(brujas, "aurora", 0)).toContain("sótano");
    expect(festivalLine(brujas, "nadie", 0)).toBeNull();
  });
});
