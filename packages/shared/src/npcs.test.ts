import { describe, expect, it } from "vitest";
import {
  ASTRONOMA_GREET,
  ASTRONOMA_LINES,
  astronomerGreeting,
  astronomerLine,
  CASINO_NPCS,
  lineSeed,
  npcSolidTiles,
  numberWords,
  OBSERVATORIO_NPCS,
  pickLine,
  rouletteCall,
  skyTopic,
  spokenHour,
} from "./npcs";
import { WEATHERS } from "./weather";
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

describe("la astrónoma del observatorio", () => {
  const at = (h: number, m = 0) => h * 60 + m;

  it("tiene look válido, frases sueltas y su tile en el observatorio", () => {
    expect(OBSERVATORIO_NPCS).toHaveLength(1);
    const [n] = OBSERVATORIO_NPCS;
    expect(Look.safeParse(n!.look).success).toBe(true);
    expect(n!.look.outfit).toBe("lab-coat");
    expect(n!.idle.length).toBeGreaterThan(0);
    expect(npcSolidTiles("observatorio")).toEqual([n!.tile]);
  });

  it("dice la hora como en la calle", () => {
    expect(spokenHour(at(21, 40))).toBe("las 9:40 de la noche");
    expect(spokenHour(at(1, 5))).toBe("la 1:05 de la madrugada");
    expect(spokenHour(at(12, 0))).toBe("las 12:00 del día");
    expect(spokenHour(at(0, 30))).toBe("las 12:30 de la madrugada");
    expect(spokenHour(at(8, 10))).toBe("las 8:10 de la mañana");
    expect(spokenHour(at(15, 20))).toBe("las 3:20 de la tarde");
  });

  it("de noche despejada habla de lo que se ve; de día, que vuelvan de noche; con mal clima, del clima", () => {
    expect(skyTopic({ minuteOfDay: at(20), weather: "despejado" })).toBe("prima");
    expect(skyTopic({ minuteOfDay: at(23, 30), weather: "despejado" })).toBe("noche");
    expect(skyTopic({ minuteOfDay: at(3), weather: "despejado" })).toBe("madrugada");
    expect(skyTopic({ minuteOfDay: at(6), weather: "despejado" })).toBe("amanecer");
    expect(skyTopic({ minuteOfDay: at(10), weather: "despejado" })).toBe("dia");
    expect(skyTopic({ minuteOfDay: at(18), weather: "despejado" })).toBe("tarde");
    for (const w of WEATHERS.filter((w) => w !== "despejado")) expect(skyTopic({ minuteOfDay: at(22), weather: w })).toBe(w);
    // Las de día le dicen que vuelva de noche o hablan del sol; ninguna nombra una constelación.
    for (let seed = 0; seed < ASTRONOMA_LINES.dia.length; seed++) {
      const line = astronomerLine({ minuteOfDay: at(10, 20), weather: "despejado" }, seed);
      expect(line).not.toMatch(/\{hora\}/);
      expect(ASTRONOMA_LINES.dia.map((l) => l.replace("{hora}", spokenHour(at(10, 20))))).toContain(line);
    }
    expect(ASTRONOMA_LINES.dia.some((l) => /vuelva de noche/i.test(l))).toBe(true);
    // Con la hora dentro: la frase la trae dicha.
    expect(astronomerLine({ minuteOfDay: at(21, 40), weather: "despejado" }, 0)).toContain("las 9:40 de la noche");
  });

  it("todos ven la misma frase con la misma semilla, y el saludo lleva el nombre", () => {
    const ctx = { minuteOfDay: at(2, 10), weather: "despejado" } as const;
    expect(astronomerLine(ctx, lineSeed("u-1:3"))).toBe(astronomerLine(ctx, lineSeed("u-1:3")));
    const hi = astronomerGreeting("Ana", lineSeed("s-1:0:20"));
    expect(hi).toContain("Ana");
    expect(ASTRONOMA_GREET.map((g) => g.replace("{name}", "Ana"))).toContain(hi);
    // Ninguna frase queda sin su lugar para la hora mal escrito.
    for (const lines of Object.values(ASTRONOMA_LINES)) for (const l of lines) expect(l.replace("{hora}", "")).not.toMatch(/[{}]/);
  });
});
