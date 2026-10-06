import { describe, expect, it } from "vitest";
import { anchoPlaca, elegirNombres, NOMBRES } from "./nombresGente";

const c = (id: string, sx: number, sy: number, d: number) => ({ id, sx, sy, d, ancho: anchoPlaca(id) });

describe("los nombres de la gente de la fiesta", () => {
  it("dos placas que se montarían: solo la del más cercano", () => {
    const s = elegirNombres([c("Doña Carmenza", 100, 200, 3), c("Don Aurelio", 104, 192, 2)]);
    expect([...s]).toEqual(["Don Aurelio"]);
  });

  it("las que no se tocan salen todas, hasta el tope, y de lejos ninguna", () => {
    const cerca = [0, 1, 2, 3, 4, 5].map((i) => c(`Vecino ${i}`, i * 200, 0, 1 + i * 0.5));
    expect(elegirNombres(cerca).size).toBe(Math.min(NOMBRES.max, cerca.filter((x) => x.d <= NOMBRES.tiles).length));
    expect(elegirNombres([c("Lejos", 0, 0, NOMBRES.tiles + 1)]).size).toBe(0);
  });

  it("uno encima del otro pero bien separados en alto, salen los dos", () => {
    expect(elegirNombres([c("Arriba", 0, 0, 1), c("Abajo", 0, 40, 2)]).size).toBe(2);
  });

  it("ninguna se monta sobre mi placa, y la mía no cuenta en el tope", () => {
    const yo = { id: "yo", sx: 100, sy: 100, d: 0, ancho: 100 };
    const s = elegirNombres([c("Juancho", 110, 106, 1), c("Nicolás", 300, 100, 2)], NOMBRES, [yo]);
    expect([...s]).toEqual(["Nicolás"]);
  });
});
