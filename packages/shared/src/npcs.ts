// El personal del casino del sótano: crupier de la ruleta, dealer del blackjack, cajera y portero. Son
// personajes fijos (no se mueven ni se les compra nada): los dibuja el cliente como chibis en su puesto y
// reaccionan a lo que ya llega de las mesas (la ronda que abre, el número que cae, la banca que gana o
// pierde) y a la gente que entra o se arrima a la caja. Sus tiles no se caminan (ver sotano.ts).
import type { Look } from "./look";
import { colorOf } from "./casino";

export type NpcRole = "crupier" | "dealer" | "cajera" | "portero";

export interface CasinoNpc {
  id: string;
  role: NpcRole;
  name: string;
  look: Look;
  area: string;
  /** Tile donde se para. `offset`: corrido dentro del tile (en tiles), para quedar detrás de un mueble. */
  tile: { x: number; y: number };
  offset?: { x: number; y: number };
  /** Hacia dónde mira (+x = right, +y = down). */
  facing: "down" | "left" | "right" | "up";
  /** Su tile bloquea el paso (todos, por ahora: están de pie en un tile libre). */
  solid: boolean;
  /** Lo que dice de vez en cuando, si hay alguien cerca. */
  idle: readonly string[];
}

/** Ropa de casino: camisa blanca, chaleco y corbatín del color de acento. */
const staff = (look: Omit<Look, "shirt" | "accessories" | "top" | "outfit" | "neck"> & Partial<Look>): Look => ({
  shirt: "#f4ecdc",
  top: "longsleeve",
  outfit: "vest",
  neck: "bowtie",
  accessories: [],
  ...look,
});

export const CASINO_NPCS: readonly CasinoNpc[] = [
  {
    id: "crupier",
    role: "crupier",
    name: "Don Chucho Ruletas",
    // En la cabecera del paño, al lado de la rueda (desde ahí la hace girar).
    area: "sotano",
    tile: { x: 7, y: 8 },
    facing: "down",
    solid: true,
    look: staff({
      skin: "#f1c27d",
      hair: "#a8a4a0",
      pants: "#2a2430",
      accent: "#7a1f2b",
      hairStyle: "side-part",
      facialHair: "mustache",
      shoes: "boots",
      shoeColor: "#1a1418",
    }),
    idle: [
      "¿Qué más, pues? Arrímese a la mesa.",
      "Hágale, que hoy es su día.",
      "La bolita no muerde, mijo.",
      "Al rojo, que está caliente.",
      "El que no arriesga no gana, ¿oyó?",
    ],
  },
  {
    id: "dealer",
    role: "dealer",
    name: "Yurani Blackjack",
    // Del lado de la banca, frente a los cinco puestos.
    area: "sotano",
    tile: { x: 11, y: 10 },
    facing: "right",
    solid: true,
    look: staff({
      skin: "#c68642",
      hair: "#1b1b1b",
      pants: "#2a2430",
      accent: "#2b2230",
      hairStyle: "bun",
      eyes: "happy",
      shoeColor: "#1a1418",
    }),
    idle: ["Siéntese, que hay puesto.", "¿Una manito, sumercé?", "Aquí se juega limpio, parcero.", "Veintiuno o nada, ¿cierto?"],
  },
  {
    id: "cajera",
    role: "cajera",
    name: "Doña Marleny",
    // Junto a la ventanilla de la caja, contra la pared (entre la caja y la rueda de la fortuna).
    area: "sotano",
    tile: { x: 14, y: 4 },
    facing: "down",
    solid: true,
    look: staff({
      skin: "#e0ac69",
      hair: "#5a2e1c",
      pants: "#2a2430",
      accent: "#7a1f2b",
      hairStyle: "curly",
      face: "round-glasses",
      shoeColor: "#1a1418",
    }),
    idle: ["Fichas a la orden, sumercé.", "Cuente la plata antes de irse, ¿oyó?", "Aquí todo se paga de contado, mi amor."],
  },
  {
    id: "portero",
    role: "portero",
    name: "Toño Tres Puertas",
    // En el vestíbulo, junto al cordón de la entrada del casino.
    area: "sotano",
    tile: { x: 18, y: 9 },
    facing: "right",
    solid: true,
    look: {
      skin: "#f1c27d",
      hair: "#d9b36a",
      shirt: "#2a2430",
      pants: "#1f1d24",
      accent: "#1f1d24",
      top: "longsleeve",
      outfit: "jacket",
      neck: "tie",
      face: "sunglasses",
      hairStyle: "buzz",
      accessories: [],
      shoes: "boots",
      shoeColor: "#141014",
    },
    idle: ["Juicio adentro, ¿listo?", "Aquí se viene es a ganar.", "Todo bien, todo bonito."],
  },
];

export const casinoNpc = (id: string) => CASINO_NPCS.find((n) => n.id === id);

/** Tiles del nivel donde está parado alguien del personal (no se caminan). */
export const npcSolidTiles = (area: string) => CASINO_NPCS.filter((n) => n.area === area && n.solid).map((n) => n.tile);

// ---------- Lo que dicen ----------

const UNITS = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const TENS: Record<number, string> = { 3: "treinta" };

/** Un número de la ruleta (0 a 36) en palabras: "veintitrés", "treinta y dos". */
export function numberWords(n: number): string {
  if (n < 30) return UNITS[n] ?? String(n);
  const tens = TENS[Math.floor(n / 10)] ?? String(n);
  return n % 10 === 0 ? tens : `${tens} y ${UNITS[n % 10]}`;
}

const COLOR_WORD = { red: "rojo", black: "negro", green: "verde" } as const;

/** Lo que canta el crupier cuando cae la bolita: "¡Veintitrés rojo!" (el cero, verde). */
export function rouletteCall(n: number): string {
  const words = numberWords(n);
  return `¡${words[0]!.toUpperCase()}${words.slice(1)} ${COLOR_WORD[colorOf(n)]}!`;
}

export const NPC_LINES = {
  /** El crupier, cuando abre la ronda y cuando cierra las apuestas. */
  rouletteOpen: ["¡Hagan sus apuestas!", "Apuesten, que la rueda no espera.", "¡Hagan juego, señores!"],
  rouletteClose: ["¡No va más!", "Nada más, que ya gira.", "¡Ya no va más, mijo!"],
  /** Lo que agrega después del número, a veces. */
  rouletteAfter: ["Uy, casi.", "Qué pena con los del negro.", "Pa' la próxima, parcero.", "¡Eso, eso!"],
  /** El dealer: abre la ronda, reparte y termina. */
  blackjackOpen: ["Hagan juego, señores.", "¿Quién se anima?", "Siéntense, que ya reparto."],
  blackjackDeal: ["Cartas van.", "Ahí le van.", "Suerte, pues."],
  bankWins: ["La casa gana, qué pena con usted.", "Otra vez será, mijo.", "Hoy la banca está de buenas."],
  bankLoses: ["Uy, casi… me ganaron.", "Bien jugado, parcero.", "¡Qué suerte la suya, sumercé!"],
  dealerBust: ["¡Me pasé! Qué oso.", "Ay, no. Me volé.", "Me reventé, ¡a cobrar!"],
  playerBlackjack: ["¡Blackjack! Qué suerte la de usted.", "¡Veintiuno de una! Hágale."],
  /** La cajera, a quien se arrima a la caja. */
  cashier: ["¿Le cambio, mi amor?", "¿Fichas? A la orden.", "¿Cuántas le doy, sumercé?", "Bien pueda, ¿qué le cambio?"],
  /** El portero, a quien entra al casino (`{name}` = el nombre corto de quien entra). */
  doorIn: ["Bienvenido, {name}. Siga, siga.", "Buenas, {name}. Suerte adentro.", "¿Qué más, {name}? Pase, pues.", "Siga, patrón, que la casa invita… a perder."],
  doorOut: ["Vuelva pronto, {name}.", "Que le vaya bien, {name}.", "Cuídese, pues."],
} as const;

/** Una frase de una lista, fija para una semilla (así todos ven la misma). */
export function pickLine(lines: readonly string[], seed: number): string {
  return lines[Math.abs(Math.floor(seed)) % lines.length]!;
}

/** Semilla estable a partir de un texto (el id de quien entra, el número de la ronda…). */
export function lineSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const NPC = {
  /** Pausa mínima entre dos frases del mismo personaje (salvo cantar el número). */
  quietMs: 7000,
  /** Cada cuánto, a lo más, dice algo suelto si hay alguien cerca (tiles). */
  idleEveryMs: 45_000,
  idleNearTiles: 5,
} as const;
