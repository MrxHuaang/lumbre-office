// Fase 4: el casino del sótano. Se apuesta con puntos (sin fichas). Todo lo decide el servidor: aquí
// solo están las reglas, los pagos y los mensajes, para que servidor y cliente digan lo mismo.
import { z } from "zod";

export const CASINO = {
  /** Apuesta mínima y máxima de una ficha (una apuesta de la ruleta, una mano de blackjack). */
  minBet: 1,
  maxBet: 50,
  /** Rankings y estadísticas de la caja: los últimos N días (o desde siempre). */
  rankingDays: 7,
  /** Personas en cada ranking de la caja. */
  rankingSize: 10,
  roulette: {
    /** Tiempo para apostar, lo que dura el giro y cuánto se muestra el resultado. */
    bettingMs: 20_000,
    spinMs: 6_000,
    resultMs: 5_000,
    /** Apuestas por persona y ronda. */
    maxBetsPerRound: 12,
    /** Últimos resultados que se muestran. */
    historySize: 12,
  },
} as const;

/** Por qué no se aceptó una apuesta. */
export const CASINO_ERRORS = ["far", "closed", "funds", "max-bets", "disabled", "failed", "seat", "turn"] as const;
export type CasinoError = (typeof CASINO_ERRORS)[number];

export const CASINO_ERROR_TEXT: Record<CasinoError, string> = {
  far: "Acércate a la mesa para apostar.",
  closed: "Ya no se puede apostar en esta ronda.",
  funds: "No te alcanzan los puntos.",
  "max-bets": "Ya hiciste todas las apuestas que se permiten en esta ronda.",
  disabled: "El casino está cerrado por ahora.",
  failed: "No se pudo hacer la apuesta. Intenta de nuevo.",
  seat: "Siéntate en una silla de la mesa de blackjack para jugar.",
  turn: "Todavía no es tu turno.",
};

/** `refId` de un movimiento de puntos del casino (p. ej. "ruleta:12"). */
export const casinoRefId = (game: CasinoGame, round: number) => `${game}:${round}`;

// ---------- Ruleta (europea: un solo cero) ----------

export const RED_NUMBERS: readonly number[] = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
/** Orden de los números en la rueda, en sentido horario desde el cero. */
export const WHEEL_ORDER: readonly number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

export function colorOf(n: number): "red" | "black" | "green" {
  if (n === 0) return "green";
  return RED_NUMBERS.includes(n) ? "red" : "black";
}

/** A qué se apuesta. */
export const RouletteBetSpec = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("number"), n: z.number().int().min(0).max(36) }),
  z.object({ kind: z.literal("red") }),
  z.object({ kind: z.literal("black") }),
  z.object({ kind: z.literal("even") }),
  z.object({ kind: z.literal("odd") }),
  z.object({ kind: z.literal("low") }),
  z.object({ kind: z.literal("high") }),
  z.object({
    kind: z.literal("dozen"),
    d: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  }),
  z.object({
    kind: z.literal("column"),
    c: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  }),
]);
export type RouletteBetSpec = z.infer<typeof RouletteBetSpec>;

/** ¿Gana esta apuesta si sale `n`? (El cero solo lo gana quien apostó al cero.) */
export function rouletteWins(bet: RouletteBetSpec, n: number): boolean {
  if (bet.kind === "number") return bet.n === n;
  if (n === 0) return false;
  switch (bet.kind) {
    case "red":
      return colorOf(n) === "red";
    case "black":
      return colorOf(n) === "black";
    case "even":
      return n % 2 === 0;
    case "odd":
      return n % 2 === 1;
    case "low":
      return n <= 18;
    case "high":
      return n >= 19;
    case "dozen":
      return Math.ceil(n / 12) === bet.d;
    case "column":
      return ((n - 1) % 3) + 1 === bet.c;
  }
}

/** Cuántas veces la apuesta se gana además de recuperarla (pleno 35, docena y columna 2, el resto 1). */
export function roulettePayout(bet: RouletteBetSpec): number {
  if (bet.kind === "number") return 35;
  if (bet.kind === "dozen" || bet.kind === "column") return 2;
  return 1;
}

/** Nombre corto de una apuesta ("Rojo", "Pleno 17", "2.ª docena"…). */
export function rouletteBetLabel(bet: RouletteBetSpec): string {
  switch (bet.kind) {
    case "number":
      return `Pleno ${bet.n}`;
    case "red":
      return "Rojo";
    case "black":
      return "Negro";
    case "even":
      return "Par";
    case "odd":
      return "Impar";
    case "low":
      return "1 a 18";
    case "high":
      return "19 a 36";
    case "dozen":
      return `${bet.d}.ª docena`;
    case "column":
      return `${bet.c}.ª columna`;
  }
}

export type RoulettePhase = "betting" | "spinning" | "result";

/** Cliente → servidor (`MSG.rouletteBet`): una apuesta (hay que estar junto a la mesa). */
export const RouletteBetMessage = z.object({
  bet: RouletteBetSpec,
  amount: z.number().int().min(CASINO.minBet).max(CASINO.maxBet),
});
export type RouletteBetMessage = z.infer<typeof RouletteBetMessage>;

/** Servidor → cliente (`MSG.casinoResult`): resultado de una apuesta o de una jugada. */
export type CasinoResult = { ok: true; balance: number } | { ok: false; error: CasinoError };

/** Servidor → cliente al terminar una ronda de ruleta (`MSG.rouletteSettled`): lo que ganaste. */
export interface RouletteSettled {
  round: number;
  result: number;
  /** Puntos devueltos (apuesta + ganancia) en esta ronda; 0 si no ganó nada. */
  won: number;
  /** Lo que apostó en la ronda. */
  staked: number;
}

/** Ajustes del casino que se cambian en /admin. */
export interface CasinoSettingsDTO {
  enabled: boolean;
}

export const CasinoSettingsBody = z.object({
  enabled: z.boolean(),
});

// ---------- Estadísticas y rankings de la caja ----------

export const CASINO_GAMES = ["ruleta", "blackjack", "baccarat", "dados", "caballos", "tragamonedas"] as const;
export type CasinoGame = (typeof CASINO_GAMES)[number];
export const CASINO_GAME_NAMES: Record<CasinoGame, string> = {
  ruleta: "Ruleta",
  blackjack: "Blackjack",
  baccarat: "Baccarat",
  dados: "Dados",
  caballos: "Caballitos",
  tragamonedas: "Tragamonedas",
};

/** Período de las estadísticas: los últimos `CASINO.rankingDays` días o desde siempre. */
export const CASINO_PERIODS = ["semana", "siempre"] as const;
export type CasinoPeriod = (typeof CASINO_PERIODS)[number];

/**
 * Movimientos del casino de una persona en un juego, ya sumados por la base: lo apostado (en positivo),
 * lo cobrado (premios y devoluciones), cuántas apuestas hizo y el cobro más grande de una vez.
 */
export interface CasinoRow {
  userId: string;
  game: string;
  staked: number;
  paid: number;
  bets: number;
  best: number;
}

export interface CasinoPlayerStats {
  userId: string;
  /** Cobrado menos apostado (negativo = va perdiendo). */
  net: number;
  staked: number;
  paid: number;
  bets: number;
  best: number;
}

export interface CasinoGameStats {
  game: CasinoGame;
  staked: number;
  paid: number;
  bets: number;
  players: number;
}

export interface CasinoSummary {
  players: CasinoPlayerStats[];
  games: CasinoGameStats[];
  /** Lo del casino entero: lo que se apostó, lo que se pagó y lo que se quedó la casa. */
  total: {
    staked: number;
    paid: number;
    house: number;
    bets: number;
    players: number;
  };
}

const gameOf = (g: string): CasinoGame | null => ((CASINO_GAMES as readonly string[]).includes(g) ? (g as CasinoGame) : null);

/**
 * Juegos que usan el libro del casino (motivo CASINO, sin tope) pero no son de la caja: el pozo del
 * hockey de mesa del arcade pasa de un jugador a otro y no cuenta en las estadísticas del casino.
 */
const NOT_CASINO = new Set(["hockey"]);

/** Junta las filas por persona y por juego (los movimientos sin juego conocido cuentan solo por persona). */
export function summarizeCasino(rows: readonly CasinoRow[]): CasinoSummary {
  const players = new Map<string, CasinoPlayerStats>();
  const games = new Map<CasinoGame, CasinoGameStats & { who: Set<string> }>();
  for (const r of rows) {
    if (NOT_CASINO.has(r.game)) continue;
    const p = players.get(r.userId) ?? {
      userId: r.userId,
      net: 0,
      staked: 0,
      paid: 0,
      bets: 0,
      best: 0,
    };
    p.staked += r.staked;
    p.paid += r.paid;
    p.net = p.paid - p.staked;
    p.bets += r.bets;
    p.best = Math.max(p.best, r.best);
    players.set(r.userId, p);
    const game = gameOf(r.game);
    if (!game) continue;
    const g = games.get(game) ?? {
      game,
      staked: 0,
      paid: 0,
      bets: 0,
      players: 0,
      who: new Set<string>(),
    };
    g.staked += r.staked;
    g.paid += r.paid;
    g.bets += r.bets;
    if (r.bets > 0) g.who.add(r.userId);
    g.players = g.who.size;
    games.set(game, g);
  }
  const list = [...players.values()];
  const staked = list.reduce((a, p) => a + p.staked, 0);
  const paid = list.reduce((a, p) => a + p.paid, 0);
  return {
    players: list,
    games: CASINO_GAMES.map((game) => {
      const g = games.get(game);
      return g
        ? {
            game,
            staked: g.staked,
            paid: g.paid,
            bets: g.bets,
            players: g.players,
          }
        : { game, staked: 0, paid: 0, bets: 0, players: 0 };
    }),
    total: {
      staked,
      paid,
      house: staked - paid,
      bets: list.reduce((a, p) => a + p.bets, 0),
      players: list.filter((p) => p.bets > 0).length,
    },
  };
}

/** Los tres rankings de la caja: quién más ganó, quién más perdió y los cobros más grandes de una vez. */
export function casinoRankings(players: readonly CasinoPlayerStats[], size: number = CASINO.rankingSize) {
  return {
    winners: players
      .filter((p) => p.net > 0)
      .sort((a, b) => b.net - a.net)
      .slice(0, size),
    losers: players
      .filter((p) => p.net < 0)
      .sort((a, b) => a.net - b.net)
      .slice(0, size),
    bigWins: players
      .filter((p) => p.best > 0)
      .sort((a, b) => b.best - a.best)
      .slice(0, size),
  };
}

// ---------- Blackjack ----------

export const BLACKJACK = {
  seats: 5,
  decks: 6,
  /** Con menos cartas que esto en el sabot, se baraja de nuevo antes de repartir. */
  reshuffleAt: 60,
  /** Tiempo para apostar (arranca con la primera apuesta), para cada turno y para mostrar el resultado. */
  bettingMs: 12_000,
  turnMs: 20_000,
  dealerStepMs: 700,
  resultMs: 5_000,
} as const;

/** Carta como número 0..51: palo = n / 13 (picas, corazones, diamantes, tréboles), valor = n % 13 + 1 (1 = as). */
export type Card = number;
/** Carta tapada del crupier (en el estado viaja así hasta que se destapa). */
export const HIDDEN_CARD = -1;

export const cardRank = (c: Card) => (c % 13) + 1;
export const cardSuit = (c: Card) => Math.floor(c / 13) as 0 | 1 | 2 | 3;
export const SUIT_NAMES = ["picas", "corazones", "diamantes", "tréboles"] as const;
export const RANK_LABEL = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
export const isRedSuit = (c: Card) => cardSuit(c) === 1 || cardSuit(c) === 2;

/** Valor de una mano: el as vale 11 si no se pasa (mano "blanda"), si no 1. */
export function handValue(cards: readonly Card[]): {
  total: number;
  soft: boolean;
} {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c === HIDDEN_CARD) continue;
    const r = cardRank(c);
    if (r === 1) aces++;
    total += r === 1 ? 1 : Math.min(r, 10);
  }
  const soft = aces > 0 && total + 10 <= 21;
  return { total: soft ? total + 10 : total, soft };
}

export const isBlackjack = (cards: readonly Card[]) => cards.length === 2 && handValue(cards).total === 21;

/** El crupier pide carta con menos de 17 y se planta con cualquier 17 (también el blando). */
export const dealerShouldHit = (cards: readonly Card[]) => handValue(cards).total < 17;

export type BlackjackOutcome = "blackjack" | "win" | "push" | "lose";

/** Resultado de una mano contra la del crupier (sin contar el seguro ni la división: no los hay). */
export function blackjackOutcome(player: readonly Card[], dealer: readonly Card[]): BlackjackOutcome {
  const p = handValue(player).total;
  const d = handValue(dealer).total;
  const pbj = isBlackjack(player);
  const dbj = isBlackjack(dealer);
  if (p > 21) return "lose";
  if (pbj && !dbj) return "blackjack";
  if (dbj && !pbj) return "lose";
  if (pbj && dbj) return "push";
  if (d > 21 || p > d) return "win";
  return p === d ? "push" : "lose";
}

/** Puntos devueltos (apuesta incluida) según el resultado: blackjack 3:2 (redondeado hacia abajo), gana 1:1, empate devuelve. */
export function blackjackReturn(outcome: BlackjackOutcome, bet: number): number {
  if (outcome === "blackjack") return bet + Math.floor((bet * 3) / 2);
  if (outcome === "win") return bet * 2;
  if (outcome === "push") return bet;
  return 0;
}

export type BlackjackPhase = "waiting" | "betting" | "playing" | "dealer" | "result";
export const BLACKJACK_ACTIONS = ["hit", "stand", "double"] as const;
export type BlackjackAction = (typeof BLACKJACK_ACTIONS)[number];

/** Cliente → servidor (`MSG.blackjackBet`): apostar en tu asiento (hay que estar sentado a la mesa). */
export const BlackjackBetMessage = z.object({
  amount: z.number().int().min(CASINO.minBet).max(CASINO.maxBet),
});
/** Servidor → cliente al terminar una mano de blackjack (`MSG.blackjackSettled`). */
export interface BlackjackSettled {
  round: number;
  outcome: BlackjackOutcome;
  won: number;
  staked: number;
}

/** Cliente → servidor (`MSG.blackjackAction`): jugada en tu turno. */
export const BlackjackActionMessage = z.object({
  action: z.enum(BLACKJACK_ACTIONS),
});
