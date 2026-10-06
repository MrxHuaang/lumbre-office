import { describe, expect, it } from "vitest";
import { freq, PIEZAS_COSECHA, programaCuerdas } from "./musica";

const beats = (notas: readonly (readonly [string, number])[]) => notas.reduce((s, [, b]) => s + b, 0);

describe("la música del baile de la cosecha", () => {
  it("cada pieza cierra sus compases, en 3, con un acorde y un bajo por compás", () => {
    for (const [id, p] of Object.entries(PIEZAS_COSECHA)) {
      const largo = beats(p.melodia);
      expect(p.compas, id).toBe(3);
      expect(largo % p.compas, id).toBe(0);
      expect(p.acordes, id).toHaveLength(largo / p.compas);
      expect(p.bajos, id).toHaveLength(largo / p.compas);
      for (const [n] of p.melodia) if (n !== "-") expect(freq(n), `${id} ${n}`).toBeGreaterThan(0);
      for (const n of p.bajos) expect(freq(n), `${id} ${n}`).toBeLessThan(freq("E3") + 1);
    }
  });

  it("el bambuco entra a contratiempo y el bajo marca el uno y el «y» del dos", () => {
    const b = PIEZAS_COSECHA.bambuco;
    expect(b.melodia[0]).toEqual(["-", 2]);
    expect(b.bajoEn).toEqual([0, 1.5]);
    // Una vuelta cabe en unos 15 segundos.
    expect((beats(b.melodia) * 60) / b.bpm).toBeLessThanOrEqual(15);
    const prog = programaCuerdas(b);
    expect(prog.largo).toBe(beats(b.melodia));
    expect(prog.golpes.every((g, i) => i === 0 || g.at >= prog.golpes[i - 1]!.at)).toBe(true);
  });
});
