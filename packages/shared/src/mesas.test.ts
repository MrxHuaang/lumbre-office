import { describe, expect, it } from "vitest";
import {
  BACCARAT_BETS,
  baccaratHands,
  baccaratTotal,
  baccaratWinner,
  bankerDraws,
  dadosReturn,
  dealBaccarat,
  DADOS_TOTALS,
  drawMesa,
  HORSES,
  mesaPlayMs,
  mesaReturn,
  mesaSummary,
  MesaBetMessage,
  NO_CARD,
  packDice,
  raceOrder,
  raceProgress,
  unpackDice,
  validMesaBet,
  MESA,
} from "./mesas";

/** Cartas: palo 0, valor r (1 = as, 13 = rey). */
const card = (r: number) => r - 1;

/** Generador fijo (mulberry32) para simular muchas manos igual en cada corrida. */
function seeded(seed: number) {
  let a = seed;
  return (n: number) => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
}

describe("baccarat", () => {
  it("las figuras y el 10 valen cero y el total es la última cifra", () => {
    expect(baccaratTotal([card(13), card(9)])).toBe(9);
    expect(baccaratTotal([card(7), card(8)])).toBe(5);
    expect(baccaratTotal([card(1), card(10), card(12)])).toBe(1);
  });

  it("con un natural nadie pide tercera carta", () => {
    const deck = [card(9), card(3), card(13), card(2), card(5), card(5)];
    const r = dealBaccarat(() => deck.shift()!);
    expect(r.slice(4)).toEqual([NO_CARD, NO_CARD]);
    expect(baccaratWinner(r)).toBe("player");
  });

  it("el jugador pide con 5 o menos y la banca sigue la tabla de la tercera carta", () => {
    // Jugador 2+3 = 5 pide (un 8); banca 1+2 = 3 no pide si la tercera del jugador es un 8.
    const deck = [card(2), card(1), card(3), card(2), card(8), card(4)];
    const r = dealBaccarat(() => deck.shift()!);
    expect(r[4]).toBe(card(8));
    expect(r[5]).toBe(NO_CARD);
    expect(bankerDraws(6, 6)).toBe(true);
    expect(bankerDraws(6, null)).toBe(false);
    expect(bankerDraws(5, null)).toBe(true);
    expect(bankerDraws(4, 1)).toBe(false);
    expect(bankerDraws(2, 9)).toBe(true);
  });

  it("el empate devuelve lo apostado al jugador y a la banca y paga 8 a 1", () => {
    const tie = [card(3), card(4), card(4), card(3), NO_CARD, NO_CARD];
    // 3+4 = 7 contra 4+3 = 7: los dos se plantan.
    expect(baccaratWinner(tie)).toBe("tie");
    expect(mesaReturn("baccarat", "player", tie, 10)).toBe(10);
    expect(mesaReturn("baccarat", "banker", tie, 10)).toBe(10);
    expect(mesaReturn("baccarat", "tie", tie, 10)).toBe(90);
  });

  it("la banca que gana con 6 paga la mitad y la pareja paga 11 a 1", () => {
    const r = [card(2), card(3), card(2), card(3), card(1), NO_CARD];
    const { player, banker } = baccaratHands(r);
    expect(baccaratTotal(player)).toBe(5);
    expect(baccaratTotal(banker)).toBe(6);
    expect(mesaReturn("baccarat", "banker", r, 10)).toBe(15);
    expect(mesaReturn("baccarat", "pplayer", r, 10)).toBe(120);
    expect(mesaReturn("baccarat", "pbanker", r, 10)).toBe(120);
  });

  it("la casa gana algo con cada apuesta a la larga (sin pasarse)", () => {
    const rand = seeded(7);
    const hands = 120_000;
    const ret = Object.fromEntries(BACCARAT_BETS.map((b) => [b, 0])) as Record<string, number>;
    for (let i = 0; i < hands; i++) {
      const r = drawMesa("baccarat", rand);
      for (const b of BACCARAT_BETS) ret[b]! += mesaReturn("baccarat", b, r, 100);
    }
    for (const b of BACCARAT_BETS) {
      const rtp = ret[b]! / (hands * 100);
      expect(rtp, b).toBeLessThan(1);
      expect(rtp, b).toBeGreaterThan(b === "tie" || b.startsWith("p") && b !== "player" ? 0.8 : 0.97);
    }
  });
});

describe("dados", () => {
  const all: number[][] = [];
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) all.push([a, b, c]);
  const rtp = (bet: string) => all.reduce((s, d) => s + dadosReturn(bet, d, 1), 0) / all.length;

  it("todas las apuestas dejan ventaja a la casa, sin exagerar", () => {
    const bets = ["small", "big", "even", "odd", "triple", ...DADOS_TOTALS.map((t) => `t${t}`), ...[1, 2, 3, 4, 5, 6].map((n) => `d${n}`)];
    for (const bet of bets) {
      expect(validMesaBet("dados", bet), bet).toBe(true);
      expect(rtp(bet), bet).toBeLessThan(1);
      expect(rtp(bet), bet).toBeGreaterThan(0.75);
    }
  });

  it("chico y grande pierden con trío; el número paga por cada dado que lo muestra", () => {
    expect(dadosReturn("small", [3, 3, 3], 10)).toBe(0);
    expect(dadosReturn("small", [1, 2, 3], 10)).toBe(20);
    expect(dadosReturn("d4", [4, 4, 1], 10)).toBe(30);
    expect(dadosReturn("t10", [4, 4, 2], 10)).toBe(70);
    expect(dadosReturn("triple", [2, 2, 2], 10)).toBe(310);
    expect(unpackDice(packDice([6, 1, 3]))).toEqual([6, 1, 3]);
  });

  it("no acepta apuestas raras", () => {
    for (const bet of ["t3", "t18", "d0", "d7", "x", "t", "small2"]) expect(validMesaBet("dados", bet), bet).toBe(false);
  });
});

describe("caballitos", () => {
  it("cada caballito devuelve cerca del 90 % de lo apostado a la larga", () => {
    const total = HORSES.reduce((a, h) => a + h.weight, 0);
    expect(total).toBe(100);
    for (const h of HORSES) {
      const rtp = (h.weight / total) * h.returns;
      expect(rtp, h.name).toBeLessThan(0.95);
      expect(rtp, h.name).toBeGreaterThan(0.8);
    }
  });

  it("el orden de llegada tiene a los seis una vez y el ganador sale con su peso", () => {
    const rand = seeded(3);
    const wins = new Array(6).fill(0);
    for (let i = 0; i < 20_000; i++) {
      const o = raceOrder(rand);
      expect([...o].sort()).toEqual([0, 1, 2, 3, 4, 5]);
      wins[o[0]!]++;
    }
    HORSES.forEach((h, i) => expect(Math.abs(wins[i] / 20_000 - h.weight / 100), h.name).toBeLessThan(0.015));
    expect(mesaReturn("caballos", "h2", [2, 0, 1, 3, 4, 5], 10)).toBe(50);
    expect(mesaReturn("caballos", "h0", [2, 0, 1, 3, 4, 5], 10)).toBe(0);
  });

  it("en la animación cruzan la meta en el orden que dijo el servidor", () => {
    for (let round = 1; round < 40; round++) {
      const order = raceOrder(seeded(round));
      // Cuándo llega cada uno a la meta.
      const arrive = new Array(6).fill(Infinity);
      for (let t = 0; t <= MESA.raceMs; t += 20) {
        const p = raceProgress(order, round, t);
        p.forEach((x, h) => {
          if (x >= 1 && arrive[h] === Infinity) arrive[h] = t;
          expect(x).toBeGreaterThanOrEqual(0);
        });
      }
      for (let k = 1; k < 6; k++) expect(arrive[order[k]!]).toBeGreaterThan(arrive[order[k - 1]!]);
      expect(arrive[order[5]!]).toBeLessThanOrEqual(MESA.raceMs);
    }
  });
});

describe("mesas", () => {
  it("el mensaje valida la mesa y el monto", () => {
    expect(MesaBetMessage.safeParse({ table: "dados", bet: "big", amount: 5 }).success).toBe(true);
    expect(MesaBetMessage.safeParse({ table: "poker", bet: "big", amount: 5 }).success).toBe(false);
    expect(MesaBetMessage.safeParse({ table: "dados", bet: "big", amount: 51 }).success).toBe(false);
    expect(validMesaBet("caballos", "h5")).toBe(true);
    expect(validMesaBet("caballos", "h6")).toBe(false);
    expect(validMesaBet("baccarat", "banker")).toBe(true);
  });

  it("el resumen del historial y lo que dura cada juego", () => {
    expect(mesaSummary("dados", [2, 5, 6])).toBe(256);
    expect(mesaSummary("caballos", [4, 0, 1, 2, 3, 5])).toBe(4);
    const r = [card(9), card(3), card(13), card(2), NO_CARD, NO_CARD];
    expect(mesaPlayMs("baccarat", r)).toBe(4 * MESA.cardMs + MESA.cardTailMs);
  });
});
