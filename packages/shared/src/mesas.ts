// Mesas de rondas compartidas del casino del sótano: el baccarat, los dados y la carrera de caballitos.
// Funcionan como la ruleta: todos apuestan a la vez, el servidor decide el resultado con el
// azar criptográfico y paga al terminar. Acá están las reglas, los pagos y los mensajes, para que
// servidor y cliente digan lo mismo.
import { z } from "zod";
import { CASINO, cardRank, type Card } from "./casino";

export const MESAS = ["baccarat", "dados", "caballos"] as const;
export type MesaId = (typeof MESAS)[number];

export const MESA_NAMES: Record<MesaId, string> = {
  baccarat: "Baccarat",
  dados: "Dados",
  caballos: "Carrera de caballitos",
};

/** Punto del mapa desde donde se apuesta en cada mesa (hay que estar cerca). */
export const MESA_POINT: Record<MesaId, "baccarat" | "sicbo" | "horse_race"> = {
  baccarat: "baccarat",
  dados: "sicbo",
  caballos: "horse_race",
};

export const MESA = {
  /** Tiempo para apostar y cuánto se muestra el resultado (lo que dura el juego depende de la mesa). */
  bettingMs: 20_000,
  resultMs: 5_000,
  /** Apuestas por persona y ronda (como en la ruleta). */
  maxBetsPerRound: 12,
  historySize: 12,
  /** Baccarat: cada carta que se reparte y la pausa final antes de pagar. */
  cardMs: 900,
  cardTailMs: 1_400,
  /** Dados: lo que dura la sacudida del cubilete. */
  diceMs: 3_600,
  /** Caballitos: lo que dura la carrera (el ganador cruza un poco antes del final). */
  raceMs: 11_000,
} as const;

export type MesaPhase = "betting" | "playing" | "result";

/** Por dentro, "sin carta" en las casillas del baccarat que no se usaron. */
export const NO_CARD = -2;

// ---------- Baccarat (Punto y Banca) ----------

export const BACCARAT_BETS = ["player", "banker", "tie", "pplayer", "pbanker"] as const;
export type BaccaratBet = (typeof BACCARAT_BETS)[number];

export const BACCARAT_LABEL: Record<BaccaratBet, string> = {
  player: "Jugador",
  banker: "Banca",
  tie: "Empate",
  pplayer: "Pareja del jugador",
  pbanker: "Pareja de la banca",
};

/** Valor de una carta en el baccarat: el as 1, del 2 al 9 lo que dicen y las figuras y el 10 nada. */
export const baccaratValue = (c: Card) => {
  const r = cardRank(c);
  return r >= 10 ? 0 : r;
};

/** Total de una mano (la última cifra de la suma). */
export const baccaratTotal = (cards: readonly Card[]) => cards.reduce((a, c) => a + (c >= 0 ? baccaratValue(c) : 0), 0) % 10;

/** ¿Pide la banca la tercera carta? `p3` = valor de la tercera del jugador, o null si se plantó. */
export function bankerDraws(bankerTotal: number, p3: number | null): boolean {
  if (p3 === null) return bankerTotal <= 5;
  if (bankerTotal <= 2) return true;
  if (bankerTotal === 3) return p3 !== 8;
  if (bankerTotal === 4) return p3 >= 2 && p3 <= 7;
  if (bankerTotal === 5) return p3 >= 4 && p3 <= 7;
  if (bankerTotal === 6) return p3 === 6 || p3 === 7;
  return false;
}

/**
 * Juega una mano con las reglas de siempre (el crupier es automático): `draw` saca cartas del sabot.
 * Devuelve las seis casillas en el orden en que se reparten: jugador, banca, jugador, banca, y las
 * terceras del jugador y la banca (NO_CARD si no hubo).
 */
export function dealBaccarat(draw: () => Card): number[] {
  const p = [draw()];
  const b = [draw()];
  p.push(draw());
  b.push(draw());
  const pt = baccaratTotal(p);
  const bt = baccaratTotal(b);
  let p3: Card = NO_CARD;
  let b3: Card = NO_CARD;
  // Con un "natural" (8 o 9) nadie pide.
  if (pt < 8 && bt < 8) {
    if (pt <= 5) p3 = draw();
    if (bankerDraws(bt, p3 === NO_CARD ? null : baccaratValue(p3))) b3 = draw();
  }
  return [p[0]!, b[0]!, p[1]!, b[1]!, p3, b3];
}

/** Las manos a partir de las seis casillas. */
export function baccaratHands(result: readonly number[]): { player: Card[]; banker: Card[] } {
  const [p1, b1, p2, b2, p3, b3] = result;
  return {
    player: [p1!, p2!, p3!].filter((c) => c !== undefined && c >= 0),
    banker: [b1!, b2!, b3!].filter((c) => c !== undefined && c >= 0),
  };
}

export type BaccaratWinner = "player" | "banker" | "tie";

export function baccaratWinner(result: readonly number[]): BaccaratWinner {
  const { player, banker } = baccaratHands(result);
  const p = baccaratTotal(player);
  const b = baccaratTotal(banker);
  return p > b ? "player" : b > p ? "banker" : "tie";
}

/** Orden de reparto de las cartas que sí salieron (para animarlas una por una). */
export const baccaratDealt = (result: readonly number[]) => result.filter((c) => c >= 0).length;

// ---------- Dados (Sic Bo: tres dados en un cubilete) ----------

/** Apuestas de los dados: chico, grande, par, impar, cualquier trío, un total (4 a 17) o un número (1 a 6). */
export const DADOS_TOTALS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17] as const;
/** Cuántas veces se gana cada total además de recuperar la apuesta. */
export const DADOS_TOTAL_PAYS: Record<number, number> = { 4: 60, 5: 30, 6: 17, 7: 12, 8: 8, 9: 6, 10: 6, 11: 6, 12: 6, 13: 8, 14: 12, 15: 17, 16: 30, 17: 60 };
export const DADOS_TRIPLE_PAYS = 30;

export const isTriple = (d: readonly number[]) => d.length === 3 && d[0] === d[1] && d[1] === d[2];
export const diceTotal = (d: readonly number[]) => d.reduce((a, b) => a + b, 0);

export function dadosLabel(bet: string): string {
  if (bet === "small") return "Chico (4 a 10)";
  if (bet === "big") return "Grande (11 a 17)";
  if (bet === "even") return "Par";
  if (bet === "odd") return "Impar";
  if (bet === "triple") return "Cualquier trío";
  if (bet.startsWith("t")) return `Suma ${bet.slice(1)}`;
  return `Al ${bet.slice(1)}`;
}

function validDados(bet: string): boolean {
  if (["small", "big", "even", "odd", "triple"].includes(bet)) return true;
  const m = /^([td])(\d{1,2})$/.exec(bet);
  if (!m) return false;
  const n = Number(m[2]);
  return m[1] === "t" ? n >= 4 && n <= 17 : n >= 1 && n <= 6;
}

/** Cuánto devuelve (apuesta incluida) una apuesta de dados que salió `dice`; 0 si pierde. */
export function dadosReturn(bet: string, dice: readonly number[], amount: number): number {
  const total = diceTotal(dice);
  const triple = isTriple(dice);
  // Chico, grande, par e impar pierden con un trío: ahí está la ventaja de la casa.
  if (bet === "small") return !triple && total <= 10 ? amount * 2 : 0;
  if (bet === "big") return !triple && total >= 11 ? amount * 2 : 0;
  if (bet === "even") return !triple && total % 2 === 0 ? amount * 2 : 0;
  if (bet === "odd") return !triple && total % 2 === 1 ? amount * 2 : 0;
  if (bet === "triple") return triple ? amount * (DADOS_TRIPLE_PAYS + 1) : 0;
  const n = Number(bet.slice(1));
  if (bet.startsWith("t")) return total === n ? amount * (DADOS_TOTAL_PAYS[n]! + 1) : 0;
  const hits = dice.filter((d) => d === n).length;
  return hits > 0 ? amount * (hits + 1) : 0;
}

/** Los dados en un número para el historial (435 = 4, 3 y 5) y al revés. */
export const packDice = (d: readonly number[]) => d[0]! * 100 + d[1]! * 10 + d[2]!;
export const unpackDice = (n: number) => [Math.floor(n / 100), Math.floor(n / 10) % 10, n % 10];

// ---------- Carrera de caballitos ----------

export interface Horse {
  name: string;
  /** Color de la chaqueta del jinete (en el panel y en la mesa). */
  color: string;
  /** Peso para sortear al ganador (de 100) y cuánto devuelve si gana (apuesta incluida). */
  weight: number;
  returns: number;
}

/** Los seis caballitos, del favorito al más difícil. La casa se queda con un 10 % a la larga. */
export const HORSES: readonly Horse[] = [
  { name: "Berraco", color: "#d8483f", weight: 30, returns: 3 },
  { name: "Tinto", color: "#e59a3a", weight: 22, returns: 4 },
  { name: "Arepa", color: "#3f76c9", weight: 18, returns: 5 },
  { name: "Bambuco", color: "#e7d25a", weight: 13, returns: 7 },
  { name: "Guayabo", color: "#54a563", weight: 10, returns: 9 },
  { name: "Pandebono", color: "#9a5cc2", weight: 7, returns: 12 },
];

/**
 * Orden de llegada de una carrera: el ganador sale sorteado con los pesos y los demás, al azar.
 * `rand(n)` = entero en [0, n).
 */
export function raceOrder(rand: (n: number) => number): number[] {
  const total = HORSES.reduce((a, h) => a + h.weight, 0);
  let roll = rand(total);
  let winner = 0;
  for (let i = 0; i < HORSES.length; i++) {
    roll -= HORSES[i]!.weight;
    if (roll < 0) {
      winner = i;
      break;
    }
  }
  const rest = HORSES.map((_, i) => i).filter((i) => i !== winner);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  return [winner, ...rest];
}

/** Azar determinista para animar la carrera igual en todos los clientes (a partir de la ronda). */
function hash(a: number, b: number): number {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Cuánto avanzó cada caballito (0 = la partida, 1 = la meta) a `t` ms de la largada, sabiendo el orden
 * de llegada. Cada uno lleva su ritmo con arranques y frenadas, pero cruza la meta en el orden que dijo
 * el servidor: el ganador al 88 % de la carrera y los demás detrás, con poca diferencia.
 */
export function raceProgress(order: readonly number[], round: number, t: number, raceMs: number = MESA.raceMs): number[] {
  const out = new Array<number>(HORSES.length).fill(0);
  const k = Math.max(0, t / raceMs);
  order.forEach((horse, place) => {
    // Hora (fracción de la carrera) en la que cruza la meta.
    const finish = 0.88 + place * 0.022;
    const s = Math.min(1, k / finish);
    // Ondas propias: los arranques y frenadas de cada uno (se apagan al llegar, así el orden se cumple).
    const w1 = hash(round, horse * 3 + 1) * Math.PI * 2;
    const w2 = hash(round, horse * 3 + 2) * Math.PI * 2;
    const amp = 0.05 + hash(round, horse * 3 + 3) * 0.05;
    const wobble = amp * Math.sin(s * Math.PI) * (Math.sin(s * 9 + w1) * 0.6 + Math.sin(s * 17 + w2) * 0.4);
    // Arranca despacio, corre y termina justo en 1.
    const base = s < 1 ? s * s * (3 - 2 * s) * 0.3 + s * 0.7 : 1;
    out[horse] = Math.max(0, Math.min(1, base + wobble * (1 - s)));
  });
  return out;
}

// ---------- Comunes ----------

/** ¿Es una apuesta válida en esa mesa? */
export function validMesaBet(table: MesaId, bet: string): boolean {
  if (table === "baccarat") return (BACCARAT_BETS as readonly string[]).includes(bet);
  if (table === "dados") return validDados(bet);
  const m = /^h([0-5])$/.exec(bet);
  return m !== null;
}

/** Puntos que devuelve una apuesta (apuesta incluida) con el resultado de la ronda; 0 si pierde. */
export function mesaReturn(table: MesaId, bet: string, result: readonly number[], amount: number): number {
  if (table === "dados") return dadosReturn(bet, result, amount);
  if (table === "caballos") {
    const horse = Number(bet.slice(1));
    return result[0] === horse ? amount * HORSES[horse]!.returns : 0;
  }
  const winner = baccaratWinner(result);
  const { player, banker } = baccaratHands(result);
  const pair = (h: Card[]) => h.length >= 2 && cardRank(h[0]!) === cardRank(h[1]!);
  switch (bet as BaccaratBet) {
    case "player":
      // Con empate, las apuestas al jugador y a la banca se devuelven.
      return winner === "player" ? amount * 2 : winner === "tie" ? amount : 0;
    case "banker":
      // La banca gana 1 a 1, salvo cuando gana con 6: ahí paga la mitad (sin comisión, cuentas enteras).
      if (winner === "tie") return amount;
      if (winner !== "banker") return 0;
      return baccaratTotal(banker) === 6 ? amount + Math.floor(amount / 2) : amount * 2;
    case "tie":
      return winner === "tie" ? amount * 9 : 0;
    case "pplayer":
      return pair(player) ? amount * 12 : 0;
    case "pbanker":
      return pair(banker) ? amount * 12 : 0;
  }
  return 0;
}

/** Nombre corto de una apuesta ("Banca", "Suma 11", "Tinto"…). */
export function mesaBetLabel(table: MesaId, bet: string): string {
  if (table === "baccarat") return BACCARAT_LABEL[bet as BaccaratBet] ?? bet;
  if (table === "dados") return dadosLabel(bet);
  return HORSES[Number(bet.slice(1))]?.name ?? bet;
}

/**
 * Sortea el resultado de una ronda con `rand(n)` (entero en [0, n)): las seis casillas del baccarat,
 * los tres dados o el orden de llegada de los caballitos.
 */
export function drawMesa(table: MesaId, rand: (n: number) => number): number[] {
  if (table === "baccarat") return dealBaccarat(() => rand(52));
  if (table === "dados") return [1 + rand(6), 1 + rand(6), 1 + rand(6)];
  return raceOrder(rand);
}

/** Lo que dura el juego de la ronda (repartir, sacudir el cubilete, correr). */
export function mesaPlayMs(table: MesaId, result: readonly number[]): number {
  if (table === "baccarat") return baccaratDealt(result) * MESA.cardMs + MESA.cardTailMs;
  if (table === "dados") return MESA.diceMs;
  return MESA.raceMs;
}

/** El resultado resumido en un número para el historial: ganador del baccarat (0 jugador, 1 banca, 2 empate), los dados o el caballito. */
export function mesaSummary(table: MesaId, result: readonly number[]): number {
  if (table === "baccarat") return ["player", "banker", "tie"].indexOf(baccaratWinner(result));
  if (table === "dados") return packDice(result);
  return result[0] ?? -1;
}

/** Texto del resultado para el aviso ("Ganó la banca 7 a 5", "Salió 4-4-2: suma 10", "Ganó Tinto"). */
export function mesaResultText(table: MesaId, result: readonly number[]): string {
  if (table === "baccarat") {
    const { player, banker } = baccaratHands(result);
    const p = baccaratTotal(player);
    const b = baccaratTotal(banker);
    const w = baccaratWinner(result);
    return w === "tie" ? `Empate a ${p}` : w === "player" ? `Ganó el jugador ${p} a ${b}` : `Ganó la banca ${b} a ${p}`;
  }
  if (table === "dados") return `Salió ${result.join("-")}${isTriple(result) ? ": ¡trío!" : `: suma ${diceTotal(result)}`}`;
  return `Ganó ${HORSES[result[0]!]?.name ?? "?"}`;
}

/** Cliente → servidor (`MSG.mesaBet`): una apuesta en una mesa (hay que estar junto a ella). */
export const MesaBetMessage = z.object({
  table: z.enum(MESAS),
  bet: z.string().min(1).max(12),
  amount: z.number().int().min(CASINO.minBet).max(CASINO.maxBet),
});
export type MesaBetMessage = z.infer<typeof MesaBetMessage>;

/** Servidor → cliente al cerrar una ronda en la que apostaste (`MSG.mesaSettled`). */
export interface MesaSettled {
  table: MesaId;
  round: number;
  result: number[];
  won: number;
  staked: number;
}
