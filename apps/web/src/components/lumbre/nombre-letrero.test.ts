import { describe, expect, it } from "vitest";
import { LETRERO_MAX, NOMBRE_EJEMPLO, nombreDeLetrero, pixelesDeLetrero } from "./nombre-letrero";

describe("letrero de la portada", () => {
  it("pasa a mayúsculas, quita tildes y deja la Ñ", () => {
    expect(nombreDeLetrero("  Equipo   Ñandú  ")).toBe("EQUIPO ÑANDU");
    expect(nombreDeLetrero("Café & Código")).toBe("CAFE & CODIGO");
  });

  it("descarta lo que no tiene letra y corta al largo del letrero", () => {
    expect(nombreDeLetrero("<script>")).toBe("SCRIPT");
    expect(nombreDeLetrero("🔥🔥")).toBe("");
    expect(nombreDeLetrero("a".repeat(40))).toHaveLength(LETRERO_MAX);
  });

  it("dibuja cada letra que acepta el nombre (ninguna queda como hueco)", () => {
    const todo = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ0123456789&.!-";
    for (const ch of todo) expect(pixelesDeLetrero(ch).pixeles.length, ch).toBeGreaterThan(0);
    expect(pixelesDeLetrero(nombreDeLetrero(NOMBRE_EJEMPLO)).w).toBeGreaterThan(0);
  });

  it("mide 4 por letra menos la última separación", () => {
    expect(pixelesDeLetrero("HYVENTO").w).toBe(7 * 4 - 1);
    expect(pixelesDeLetrero("").w).toBe(0);
  });
});
