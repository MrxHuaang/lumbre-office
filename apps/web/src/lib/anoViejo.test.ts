import { UVAS } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { campanadaActual, paradaSenalada } from "./anoViejo";

describe("el Año viejo en pantalla", () => {
  const c = { inicio: 10_000, intervalo: UVAS.intervaloMs, n: UVAS.n };

  it("cuenta las campanadas desde la primera y se apaga pasada la última", () => {
    expect(campanadaActual(null, 0)).toBeNull();
    expect(campanadaActual(c, 9_000)).toBe(0);
    expect(campanadaActual(c, 10_000)).toBe(1);
    expect(campanadaActual(c, 10_000 + UVAS.intervaloMs)).toBe(2);
    expect(campanadaActual(c, 10_000 + 11 * UVAS.intervaloMs)).toBe(12);
    expect(campanadaActual(c, 10_000 + 11 * UVAS.intervaloMs + UVAS.despuesMs + 1)).toBeNull();
  });

  it("señala la parada que sigue, o la salida si llevo la maleta sin haber arrancado", () => {
    expect(paradaSenalada(3, true)).toBe(3);
    expect(paradaSenalada(3, false)).toBe(3);
    expect(paradaSenalada(null, true)).toBe(0);
    expect(paradaSenalada(null, false)).toBeNull();
  });
});
