// Los tragamonedas del casino (sótano): tres rodillos con símbolos de la casa. Se apuesta como en la
// ruleta (con `casinoBetTx`: bloquea la fila, solo hace falta el saldo) y el premio se paga con motivo
// CASINO. El servidor saca los tres símbolos con `crypto.randomInt` (los tests lo fijan) y el navegador
// solo anima los rodillos hasta ese resultado. Con el casino cerrado desde /admin no se juega.
import { z } from "zod";

export const SLOT_SYMBOLS = ["tinto", "arepa", "mango", "campana", "estrella", "siete"] as const;
export type SlotSymbol = (typeof SLOT_SYMBOLS)[number];

export const SLOT_SYMBOL_NAMES: Record<SlotSymbol, string> = {
  tinto: "Tinto",
  arepa: "Arepa",
  mango: "Mango",
  campana: "Campana",
  estrella: "Estrella",
  siete: "Siete",
};

export const SLOTS = {
  /** Apuestas que se ofrecen (una por tirada). */
  bets: [1, 2, 5, 10, 25] as const,
  /** Peso de cada símbolo en cada rodillo (de 100): el siete sale poquito. */
  weights: { tinto: 30, arepa: 26, mango: 22, campana: 12, estrella: 7, siete: 3 } satisfies Record<SlotSymbol, number>,
  /** Tres iguales: la apuesta por esto (el premio incluye la apuesta). */
  three: { tinto: 4, arepa: 6, mango: 8, campana: 20, estrella: 60, siete: 250 } satisfies Record<SlotSymbol, number>,
  /** Dos iguales (cualquiera): se devuelve la apuesta. */
  pair: 1,
  /** Lo que dura el giro en el navegador (el servidor responde antes; es solo la animación). */
  spinMs: 1_900,
  /** Pausa mínima entre dos tiradas de la misma persona. */
  cooldownMs: 1_200,
} as const;

const TOTAL = SLOT_SYMBOLS.reduce((t, s) => t + SLOTS.weights[s], 0);

/** El símbolo que sale con un número al azar en [0, 100) (el peso de cada uno). */
export function slotSymbolAt(r: number): SlotSymbol {
  let n = Math.max(0, Math.min(TOTAL - 1, Math.floor(r)));
  for (const s of SLOT_SYMBOLS) {
    n -= SLOTS.weights[s];
    if (n < 0) return s;
  }
  return "tinto";
}

/** Tira los tres rodillos con el azar dado (`random(n)` = entero en [0, n)). */
export function spinReels(random: (n: number) => number): [SlotSymbol, SlotSymbol, SlotSymbol] {
  return [slotSymbolAt(random(TOTAL)), slotSymbolAt(random(TOTAL)), slotSymbolAt(random(TOTAL))];
}

export type SlotLine = "three" | "pair" | "none";

/** Cuánto paga una tirada (con la apuesta incluida; 0 si no ganó nada) y qué salió. */
export function slotPayout(reels: readonly SlotSymbol[], bet: number): { won: number; line: SlotLine; symbol: SlotSymbol | null } {
  const [a, b, c] = reels;
  if (a === b && b === c && a) return { won: bet * SLOTS.three[a], line: "three", symbol: a };
  const pair = a === b || a === c ? a : b === c ? b : null;
  if (pair) return { won: bet * SLOTS.pair, line: "pair", symbol: pair };
  return { won: 0, line: "none", symbol: null };
}

/** Lo que devuelve la máquina en promedio por cada punto apostado (la casa se queda con el resto). */
export function slotsReturn(): number {
  let ev = 0;
  for (const a of SLOT_SYMBOLS)
    for (const b of SLOT_SYMBOLS)
      for (const c of SLOT_SYMBOLS) {
        const p = (SLOTS.weights[a] * SLOTS.weights[b] * SLOTS.weights[c]) / TOTAL ** 3;
        ev += p * slotPayout([a, b, c], 1).won;
      }
  return ev;
}

// ---------- Mensajes ----------

export const SLOTS_MSG = {
  /** Cliente → servidor: una tirada (hay que estar junto a un tragamonedas). */
  spin: "slots:spin",
  /** Servidor → quien jugó: lo que salió (o por qué no). */
  result: "slots:result",
} as const;

export const SlotSpinMessage = z.object({ bet: z.number().int().refine((n) => (SLOTS.bets as readonly number[]).includes(n), "apuesta inválida") });
export type SlotSpinMessage = z.infer<typeof SlotSpinMessage>;

export type SlotError = "far" | "funds" | "disabled" | "busy" | "failed";

export type SlotResult =
  | { ok: true; reels: [SlotSymbol, SlotSymbol, SlotSymbol]; bet: number; won: number; line: SlotLine; balance: number }
  | { ok: false; error: SlotError };

export const SLOT_ERROR_TEXT: Record<SlotError, string> = {
  far: "Acércate al tragamonedas para jugar.",
  funds: "No te alcanzan los puntos.",
  disabled: "El casino está cerrado por ahora.",
  busy: "La palanca todavía está volviendo.",
  failed: "La máquina se trabó. Intenta de nuevo.",
};
