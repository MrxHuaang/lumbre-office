import { describe, expect, it } from "vitest";
import {
  blackjackOutcome,
  blackjackReturn,
  casinoRankings,
  colorOf,
  dealerShouldHit,
  handValue,
  HIDDEN_CARD,
  RouletteBetMessage,
  rouletteBetLabel,
  roulettePayout,
  summarizeCasino,
  rouletteWins,
  WHEEL_ORDER,
  type RouletteBetSpec,
} from "./casino";

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

  it("las apuestas fuera de rango no pasan", () => {
    expect(RouletteBetMessage.safeParse({ bet: { kind: "number", n: 37 }, amount: 5 }).success).toBe(false);
    expect(RouletteBetMessage.safeParse({ bet: { kind: "red" }, amount: 0 }).success).toBe(false);
    expect(RouletteBetMessage.safeParse({ bet: { kind: "dozen", d: 2 }, amount: 10 }).success).toBe(true);
  });
});

describe("blackjack", () => {
  // Cartas por valor (palo picas): as = 0, 2 = 1, … 10 = 9, J = 10, Q = 11, K = 12.
  const c = (rank: number) => rank - 1;
  it("el as vale 11 o 1 según convenga", () => {
    expect(handValue([c(1), c(13)])).toEqual({ total: 21, soft: true });
    expect(handValue([c(1), c(9), c(5)])).toEqual({ total: 15, soft: false });
    expect(handValue([c(1), c(1), c(9)])).toEqual({ total: 21, soft: true });
    expect(handValue([c(10), HIDDEN_CARD])).toEqual({ total: 10, soft: false });
  });

  it("el crupier se planta con 17 (también blando) y pide con 16", () => {
    expect(dealerShouldHit([c(10), c(6)])).toBe(true);
    expect(dealerShouldHit([c(1), c(6)])).toBe(false);
    expect(dealerShouldHit([c(10), c(7)])).toBe(false);
  });

  it("resultados y pagos: blackjack 3:2, gana 1:1, empate devuelve, pasarse pierde aunque el crupier también se pase", () => {
    expect(blackjackOutcome([c(1), c(12)], [c(10), c(9)])).toBe("blackjack");
    expect(blackjackOutcome([c(1), c(12)], [c(1), c(13)])).toBe("push");
    expect(blackjackOutcome([c(10), c(8)], [c(10), c(7)])).toBe("win");
    expect(blackjackOutcome([c(10), c(7)], [c(10), c(7)])).toBe("push");
    expect(blackjackOutcome([c(10), c(9), c(5)], [c(10), c(6), c(9)])).toBe("lose");
    expect(blackjackOutcome([c(10), c(8)], [c(10), c(6), c(9)])).toBe("win");
    expect(blackjackReturn("blackjack", 10)).toBe(25);
    expect(blackjackReturn("blackjack", 5)).toBe(12);
    expect(blackjackReturn("win", 10)).toBe(20);
    expect(blackjackReturn("push", 10)).toBe(10);
    expect(blackjackReturn("lose", 10)).toBe(0);
  });
});

describe("estadísticas de la caja", () => {
  const rows = [
    { userId: "a", game: "ruleta", staked: 100, paid: 180, bets: 8, best: 72 },
    { userId: "a", game: "blackjack", staked: 40, paid: 0, bets: 2, best: 0 },
    { userId: "b", game: "ruleta", staked: 60, paid: 10, bets: 5, best: 10 },
    { userId: "c", game: "blackjack", staked: 20, paid: 20, bets: 1, best: 20 },
    { userId: "d", game: "", staked: 0, paid: 5, bets: 0, best: 5 },
  ];

  it("suma por persona, por juego y la casa", () => {
    const s = summarizeCasino(rows);
    expect(s.players.find((p) => p.userId === "a")).toEqual({ userId: "a", net: 40, staked: 140, paid: 180, bets: 10, best: 72 });
    expect(s.games).toEqual([
      { game: "ruleta", staked: 160, paid: 190, bets: 13, players: 2 },
      { game: "blackjack", staked: 60, paid: 20, bets: 3, players: 2 },
    ]);
    expect(s.total).toEqual({ staked: 220, paid: 215, house: 5, bets: 16, players: 3 });
  });

  it("rankings de ganancias, pérdidas y cobros más grandes", () => {
    const r = casinoRankings(summarizeCasino(rows).players);
    expect(r.winners.map((p) => p.userId)).toEqual(["a", "d"]);
    expect(r.losers.map((p) => p.userId)).toEqual(["b"]);
    expect(r.bigWins.map((p) => p.userId)).toEqual(["a", "c", "b", "d"]);
  });
});
