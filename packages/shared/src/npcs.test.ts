import { describe, expect, it } from "vitest";
import { CASINO_NPCS, lineSeed, npcSolidTiles, numberWords, pickLine, rouletteCall } from "./npcs";
import { Look } from "./look";

describe("personal del casino", () => {
  it("están el crupier, el dealer, la cajera y el portero, con looks válidos", () => {
    expect(CASINO_NPCS.map((n) => n.role).sort()).toEqual(["cajera", "crupier", "dealer", "portero"]);
    for (const n of CASINO_NPCS) {
      expect(Look.safeParse(n.look).success, n.id).toBe(true);
      expect(n.idle.length, n.id).toBeGreaterThan(0);
    }
    expect(npcSolidTiles("sotano")).toHaveLength(4);
  });

  it("el crupier canta el número en palabras con su color", () => {
    expect(rouletteCall(23)).toBe("¡Veintitrés rojo!");
    expect(rouletteCall(0)).toBe("¡Cero verde!");
    expect(rouletteCall(32)).toBe("¡Treinta y dos rojo!");
    expect(rouletteCall(30)).toBe("¡Treinta rojo!");
    expect(rouletteCall(17)).toBe("¡Diecisiete negro!");
    for (let n = 0; n <= 36; n++) expect(numberWords(n)).toMatch(/^[a-záéíóú ]+$/);
  });

  it("la frase sale igual para la misma semilla (todos ven la misma)", () => {
    const lines = ["a", "b", "c"];
    expect(pickLine(lines, lineSeed("u-1:12"))).toBe(pickLine(lines, lineSeed("u-1:12")));
    expect(lines).toContain(pickLine(lines, -7));
  });
});
