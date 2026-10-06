import { PIEZAS } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { freq, PIEZAS_MUSICA } from "./musica";

const beats = (notas: readonly (readonly [string, number])[]) => notas.reduce((s, [, b]) => s + b, 0);

describe("la música andina del Carnaval", () => {
  it("cada pieza cierra sus compases y tiene un acorde por compás", () => {
    for (const id of PIEZAS) {
      const p = PIEZAS_MUSICA[id];
      const largo = beats(p.melodia);
      expect(largo % p.compas, id).toBe(0);
      if (p.segunda) expect(beats(p.segunda), id).toBe(largo);
      expect(largo / p.compas, id).toBeGreaterThanOrEqual(p.acordes.length);
    }
  });

  it("La Guaneña: bambuco en 3, corta, en el registro de la quena y con su melodía de siempre", () => {
    const g = PIEZAS_MUSICA.guanena;
    expect(g.compas).toBe(3);
    // Corta: no más de 12 segundos por vuelta.
    expect((beats(g.melodia) * 60) / g.bpm).toBeLessThanOrEqual(12);
    expect(g.acordes).toHaveLength(beats(g.melodia) / 3);
    // De Sol4 a Sol5: lo que da una quena en Sol sin forzar.
    const notas = g.melodia.filter(([n]) => n !== "-").map(([n]) => n);
    for (const n of notas) {
      expect(freq(n), n).toBeGreaterThanOrEqual(freq("G4"));
      expect(freq(n), n).toBeLessThanOrEqual(freq("G5"));
    }
    // "do mi la la la la do' la sol sol sol sol, la sol mi la sol mi re do" (en Mi menor: la = Mi).
    expect(notas.slice(0, 20)).toEqual(["G4", "B4", "E5", "E5", "E5", "E5", "G5", "E5", "D5", "D5", "D5", "D5", "E5", "D5", "B4", "E5", "D5", "B4", "A4", "G4"]);
    // Y cierra en la tercera de Mi menor (Sol), con la dominante antes.
    expect(notas.at(-1)).toBe("G4");
    expect(g.acordes.at(-1)).toHaveLength(2);
  });
});
