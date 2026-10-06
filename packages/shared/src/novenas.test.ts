import { describe, expect, it } from "vitest";
import { AGUINALDO, AGUINALDO_JUEGOS, aguinaldoCabe, aguinaldoFinText, dijoSiONo, SI_NO_PREGUNTAS } from "./aguinaldos";
import { cineById, cineProblems } from "./cinematicas";
import { festivalById } from "./festivales";
import { atNovena, figuraDelDia, figurasVisibles, horaDeNovena, NOVENA, NOVENA_CINEMATICAS, nearPesebre, novenaCineId, novenaDia, PESEBRE_CINE, PESEBRE_FIGURAS } from "./novenas";

const TS = 32;
const tile = (x: number, y: number) => ({ area: "planta-baja", x: (x + 0.5) * TS, y: (y + 0.5) * TS });

describe("las novenas", () => {
  it("son los mismos nueve días del festival, con una figura por día y el Niño de último", () => {
    const f = festivalById("novenas")!;
    expect(f.dia).toBe(NOVENA.primerDia);
    expect(f.dias).toBe(NOVENA.dias);
    expect(PESEBRE_FIGURAS).toHaveLength(9);
    expect(figuraDelDia(1).id).toBe("establo");
    expect(figuraDelDia(9).id).toBe("nino");
    expect(novenaDia(11)).toBe(0);
    expect(novenaDia(12)).toBe(1);
    expect(novenaDia(20)).toBe(9);
    expect(novenaDia(21)).toBe(0);
  });

  it("el pesebre tiene las figuras de los días pasados y la de hoy solo si ya la pusieron", () => {
    expect(figurasVisibles(1, false)).toBe(0);
    expect(figurasVisibles(1, true)).toBe(1);
    expect(figurasVisibles(5, false)).toBe(4);
    expect(figurasVisibles(9, true)).toBe(9);
  });

  it("la mano alcanza el pesebre de al lado; la novena se reza más lejos, pero en el mismo nivel", () => {
    const { x, y } = NOVENA.pesebre;
    expect(nearPesebre(tile(x, y - 1), TS)).toBe(true);
    expect(nearPesebre(tile(x + 4, y - 3), TS)).toBe(false);
    expect(atNovena(tile(x + 4, y - 3), TS)).toBe(true);
    expect(atNovena({ ...tile(x, y), area: "jardin" }, TS)).toBe(false);
  });

  it("la novena es de 20:00 a 21:00 del juego", () => {
    expect(horaDeNovena(19 * 60 + 59)).toBe(false);
    expect(horaDeNovena(20 * 60)).toBe(true);
    expect(horaDeNovena(20 * 60 + 59)).toBe(true);
    expect(horaDeNovena(21 * 60)).toBe(false);
  });

  it("las cinemáticas están en el catálogo y están bien armadas", () => {
    expect(cineById(PESEBRE_CINE)).toBeDefined();
    for (let d = 1; d <= 9; d++) expect(cineById(novenaCineId(d))?.kind).toBe("historia");
    for (const def of NOVENA_CINEMATICAS) expect(cineProblems(def), def.id).toEqual([]);
  });
});

describe("los aguinaldos", () => {
  it("pierde quien dice sí o no, con o sin tilde y aunque lo estire", () => {
    for (const t of ["Sí", "si señor", "NO", "Nooo, qué va", "¡siii!", "nop", "Claro que sí."]) expect(dijoSiONo(t), t).not.toBeNull();
    for (const t of ["Claro", "obvio", "nosotros sino", "Tal vez", "sinónimo de nada", "nunca jamás", ""]) expect(dijoSiONo(t), t).toBeNull();
  });

  it("hay preguntas de sobra y dos juegos", () => {
    expect(AGUINALDO_JUEGOS).toEqual(["pajita", "si-no"]);
    expect(SI_NO_PREGUNTAS.length).toBeGreaterThanOrEqual(AGUINALDO.rondas * 2);
    expect(new Set(SI_NO_PREGUNTAS).size).toBe(SI_NO_PREGUNTAS.length);
  });

  it("el aguinaldo tiene tope diario", () => {
    expect(aguinaldoCabe(0, AGUINALDO.puntos)).toBe(true);
    expect(aguinaldoCabe(AGUINALDO.topeDiario - AGUINALDO.puntos + 1, AGUINALDO.puntos)).toBe(false);
  });

  it("el final se lee distinto para quien gana y quien pierde", () => {
    const fin = { id: "x", juego: "si-no" as const, motivo: "dijo" as const, palabra: "si", ganador: { sessionId: "a", name: "Ana" }, perdedor: { sessionId: "b", name: "Beto" }, pagado: 5 };
    expect(aguinaldoFinText(fin, "a")).toContain("ganaste");
    expect(aguinaldoFinText(fin, "b")).toContain("perdiste");
    expect(aguinaldoFinText({ ...fin, motivo: "empate", ganador: null, perdedor: null, pagado: 0 }, "a")).toContain("empate");
  });
});
