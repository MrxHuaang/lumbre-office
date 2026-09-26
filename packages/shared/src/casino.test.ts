import { describe, expect, it } from "vitest";
import { colorOf, remainingToday, RouletteBetMessage, rouletteBetLabel, roulettePayout, rouletteWins, WHEEL_ORDER, type RouletteBetSpec } from "./casino";

const every = (bet: RouletteBetSpec) => Array.from({ length: 37 }, (_, n) => n).filter((n) => rouletteWins(bet, n));

describe("ruleta europea", () => {
  it("la rueda tiene los 37 números una sola vez y 18 rojos", () => {
    expect([...WHEEL_ORDER].sort((a, b) => a - b)).toEqual(Array.from({ length: 37 }, (_, n) => n));
    expect(WHEEL_ORDER.filter((n) => colorOf(n) === "red")).toHaveLength(18);
    expect(colorOf(0)).toBe("green");
  });

  it("cada apuesta gana con los números que debe y el cero solo lo gana el pleno al cero", () => {
    expect(every({ kind: "red" })).toHaveLength(18);
    expect(every({ kind: "even" })).not.toContain(0);
    expect(every({ kind: "dozen", d: 2 })).toEqual(Array.from({ length: 12 }, (_, i) => 13 + i));
    expect(every({ kind: "column", c: 1 })).toEqual([1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]);
    expect(every({ kind: "number", n: 0 })).toEqual([0]);
    expect(every({ kind: "low" })).toHaveLength(18);
  });

  it("la casa tiene ventaja de 1/37 en todas las apuestas", () => {
    const bets: RouletteBetSpec[] = [{ kind: "number", n: 7 }, { kind: "red" }, { kind: "dozen", d: 3 }, { kind: "column", c: 2 }, { kind: "odd" }];
    for (const bet of bets) {
      const returned = every(bet).length * (roulettePayout(bet) + 1);
      expect(returned, rouletteBetLabel(bet)).toBe(36);
    }
  });

  it("el límite cuenta lo perdido hoy (incluidas las apuestas abiertas) y lo ganado lo recupera", () => {
    expect(remainingToday(150, 0)).toBe(150);
    expect(remainingToday(150, -120)).toBe(30);
    expect(remainingToday(150, -200)).toBe(0);
    expect(remainingToday(150, 40)).toBe(190);
  });

  it("las apuestas fuera de rango no pasan", () => {
    expect(RouletteBetMessage.safeParse({ bet: { kind: "number", n: 37 }, amount: 5 }).success).toBe(false);
    expect(RouletteBetMessage.safeParse({ bet: { kind: "red" }, amount: 0 }).success).toBe(false);
    expect(RouletteBetMessage.safeParse({ bet: { kind: "dozen", d: 2 }, amount: 10 }).success).toBe(true);
  });
});
