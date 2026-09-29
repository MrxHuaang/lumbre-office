import { describe, expect, it } from "vitest";
import {
  estacionDelFondo,
  FONDO_IDS,
  FONDO_KEY,
  FONDO_POR_DEFECTO,
  FONDOS,
  fondoPorId,
  guardarFondo,
  isFondoId,
  leerFondo,
  parseFondo,
} from "./fondos";

/** Un localStorage de mentira (lo justo: leer y escribir). */
function memoria(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    datos,
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
  };
}

describe("lista de fondos", () => {
  it("tiene entre 6 y 9 fondos, sin ids repetidos y en el orden de FONDO_IDS", () => {
    expect(FONDOS.length).toBeGreaterThanOrEqual(6);
    expect(FONDOS.length).toBeLessThanOrEqual(9);
    expect(FONDOS.map((f) => f.id)).toEqual([...FONDO_IDS]);
    expect(new Set(FONDOS.map((f) => f.nombre)).size).toBe(FONDOS.length);
  });

  it("el de siempre (el cielo con la cabaña) es el primero y el por defecto", () => {
    expect(FONDO_POR_DEFECTO).toBe("cielo");
    expect(FONDOS[0]!.id).toBe(FONDO_POR_DEFECTO);
  });

  it("todos tienen nombre y descripción", () => {
    for (const f of FONDOS) {
      expect(f.nombre.trim()).not.toBe("");
      expect(f.descripcion.trim()).not.toBe("");
      expect(fondoPorId(f.id)).toBe(f);
    }
  });

  it("el de la estación sigue el mes de Bogotá", () => {
    expect(estacionDelFondo(Date.UTC(2026, 3, 15, 17))).toBe("primavera");
    expect(estacionDelFondo(Date.UTC(2026, 6, 15, 17))).toBe("verano");
    expect(estacionDelFondo(Date.UTC(2026, 9, 15, 17))).toBe("otono");
    expect(estacionDelFondo(Date.UTC(2026, 0, 15, 17))).toBe("invierno");
    // 1 de marzo a las 3 a. m. UTC todavía es febrero en Bogotá.
    expect(estacionDelFondo(Date.UTC(2026, 2, 1, 3))).toBe("invierno");
  });
});

describe("fondo guardado", () => {
  it("un id conocido se respeta; uno desconocido o vacío vuelve al por defecto", () => {
    expect(isFondoId("lago")).toBe(true);
    expect(parseFondo("lago")).toBe("lago");
    expect(parseFondo("fondo-que-ya-no-existe")).toBe(FONDO_POR_DEFECTO);
    expect(parseFondo("")).toBe(FONDO_POR_DEFECTO);
    expect(parseFondo(null)).toBe(FONDO_POR_DEFECTO);
    expect(parseFondo(undefined)).toBe(FONDO_POR_DEFECTO);
    expect(isFondoId(3)).toBe(false);
  });

  it("guarda y lee con la misma clave", () => {
    const s = memoria();
    expect(leerFondo(s)).toBe(FONDO_POR_DEFECTO);
    expect(guardarFondo(s, "noche")).toBe(true);
    expect(s.datos.get(FONDO_KEY)).toBe("noche");
    expect(leerFondo(s)).toBe("noche");
  });

  it("lo guardado con un id desconocido da el por defecto", () => {
    expect(leerFondo(memoria({ [FONDO_KEY]: "playa" }))).toBe(FONDO_POR_DEFECTO);
  });

  it("si el navegador no deja leer ni escribir (modo privado), no revienta", () => {
    const roto = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(leerFondo(roto)).toBe(FONDO_POR_DEFECTO);
    expect(guardarFondo(roto, "lago")).toBe(false);
    expect(leerFondo(null)).toBe(FONDO_POR_DEFECTO);
    expect(guardarFondo(undefined, "lago")).toBe(false);
  });
});
