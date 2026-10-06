import { describe, expect, it } from "vitest";
import { MEZCLA, realce, Selector } from "./musica-mezcla";

describe("la mezcla de la música del desfile", () => {
  it("se queda con el grupo que suena aunque otro se oiga un poco más", () => {
    const s = new Selector();
    expect(s.elegir([{ clave: "a", vol: 0.6 }], 0)).toBe("a");
    expect(s.elegir([{ clave: "a", vol: 0.5 }, { clave: "b", vol: 0.7 }], 1000)).toBe("a");
    // Ni siquiera mucho más fuerte, si no ha pasado el rato mínimo.
    expect(s.elegir([{ clave: "a", vol: 0.3 }, { clave: "b", vol: 0.9 }], 5000)).toBe("a");
  });

  it("cambia si el otro se oye claramente más y ya pasó el rato, o si el de ahora ya casi no se oye", () => {
    const s = new Selector();
    s.elegir([{ clave: "a", vol: 0.6 }], 0);
    const t = MEZCLA.quedarseMs + 1;
    expect(s.elegir([{ clave: "a", vol: 0.5 }, { clave: "b", vol: 0.6 }], t)).toBe("a");
    expect(s.elegir([{ clave: "a", vol: 0.3 }, { clave: "b", vol: 0.3 * MEZCLA.ratio + 0.01 }], t)).toBe("b");
    // Recién cambiado, se queda con el nuevo aunque el de antes vuelva a subir.
    expect(s.elegir([{ clave: "a", vol: 0.9 }, { clave: "b", vol: 0.4 }], t + 1000)).toBe("b");
    // El de ahora se fue de la calle: cambia ya.
    expect(s.elegir([{ clave: "a", vol: 0.9 }, { clave: "b", vol: MEZCLA.piso / 2 }], t + 2000)).toBe("a");
  });

  it("en la pausa entre piezas pasa al que más se oye sin esperar", () => {
    const s = new Selector();
    s.elegir([{ clave: "a", vol: 0.6 }], 0);
    expect(s.elegir([{ clave: "a", vol: 0.5, enPausa: true }, { clave: "b", vol: 0.55 }], 2000)).toBe("b");
  });

  it("sin nadie que se oiga, calla", () => {
    const s = new Selector();
    expect(s.elegir([], 0)).toBeNull();
    expect(s.elegir([{ clave: "a", vol: 0 }], 10)).toBeNull();
  });

  it("lo lejano se oye más que antes, sin pasarse de 1", () => {
    expect(realce(0)).toBe(0);
    expect(realce(0.25)).toBeGreaterThan(0.5);
    expect(realce(1)).toBe(1);
    for (let v = 0.02; v <= 1; v += 0.02) expect(realce(v)).toBeGreaterThanOrEqual(realce(v - 0.02));
  });
});
