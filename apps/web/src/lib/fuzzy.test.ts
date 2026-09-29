import { describe, expect, it } from "vitest";
import { fold, fuzzyRank, fuzzyScore } from "./fuzzy";

describe("búsqueda difusa", () => {
  it("sin tildes ni mayúsculas", () => {
    expect(fold("Cafetería ÑANDÚ")).toBe("cafeteria nandu");
    expect(fuzzyScore("cafe", "Cafetería")).not.toBeNull();
  });

  it("las letras en orden, no necesariamente juntas", () => {
    expect(fuzzyScore("mchl", "Mochila")).not.toBeNull();
    expect(fuzzyScore("lhcm", "Mochila")).toBeNull();
    expect(fuzzyScore("xyz", "Mochila")).toBeNull();
    // Sin estirarse: letras sueltas de frases distintas no cuentan.
    expect(fuzzyScore("cafe", "Oficina 1 · viajar · sala · Piso 2 · Lugares")).toBeNull();
  });

  it("cada palabra por su lado, en cualquier orden", () => {
    expect(fuzzyScore("juan ofi", "Oficina de Juan")).not.toBeNull();
    expect(fuzzyScore("juan bar", "Oficina de Juan")).toBeNull();
  });

  it("lo que empieza igual gana, y lo corto antes que lo largo", () => {
    const items = ["Ir a la Biblioteca", "Mochila y estadísticas", "Mochila", "Moch en el medio: hamaca"];
    expect(fuzzyRank("moch", items, (s) => s)).toEqual(["Mochila", "Mochila y estadísticas", "Moch en el medio: hamaca"]);
    expect(fuzzyRank("bib", items, (s) => s)[0]).toBe("Ir a la Biblioteca");
  });

  it("con la búsqueda vacía queda todo en su orden", () => {
    expect(fuzzyRank("  ", ["b", "a"], (s) => s)).toEqual(["b", "a"]);
  });
});
