// Los personajes fijos del juego. El personal del casino del sótano: crupier de la ruleta, dealer del
// blackjack, cajera y portero; y la astrónoma del observatorio. No se mueven ni se les compra nada: los
// dibuja el cliente como chibis en su puesto. Los del casino reaccionan a lo que ya llega de las mesas (la
// ronda que abre, el número que cae, la banca que gana o pierde) y a la gente que entra o se arrima a la
// caja; la astrónoma saluda a quien se le arrima y, con E, habla del cielo según la hora del juego y el
// clima. Sus tiles no se caminan (ver `npcTiles` en sotano.ts y observatorio.ts).
import type { Look } from "./look";
import { colorOf } from "./casino";
import { NIGHT_FROM, NIGHT_UNTIL } from "./clock";
import type { Weather } from "./weather";

// El pescador del puesto de pesca del lago está en pesca-tienda.ts (mismo formato).
// La recepcionista del recibidor está en recepcion.ts.
export type NpcRole = "crupier" | "dealer" | "cajera" | "portero" | "astronoma" | "pescador" | "recepcionista" | "casera";

export interface GameNpc {
  id: string;
  role: NpcRole;
  name: string;
  /** Tono de la voz en la tira de conversación (0 grave .. 1 agudo): el "blip" de cada letra. */
  voz?: number;
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

/** El personal del casino (el nombre viejo de la ficha de un personaje fijo). */
export type CasinoNpc = GameNpc;

export const CASINO_NPCS: readonly GameNpc[] = [
  {
    id: "crupier",
    role: "crupier",
    name: "Don Chucho Ruletas",
    voz: 0.32,
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
    voz: 0.62,
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
    idle: ["Siéntese, que hay puesto.", "¿Una manito, sumercé?", "Aquí se juega limpio, ¿sí o qué?", "Veintiuno o nada, ¿cierto?"],
  },
  {
    id: "cajera",
    role: "cajera",
    name: "Doña Marleny",
    voz: 0.7,
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
    voz: 0.12,
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

/** La astrónoma del observatorio: bata, cuello de tortuga azul noche, gafas redondas y boina. */
export const OBSERVATORIO_NPCS: readonly GameNpc[] = [
  {
    id: "astronoma",
    role: "astronoma",
    name: "Profe Celeste",
    voz: 0.66,
    // Bajo el mural del cielo, junto a la estantería baja (delante está su punto `astronomer`).
    area: "observatorio",
    tile: { x: 8, y: 1 },
    facing: "down",
    solid: true,
    look: {
      skin: "#d9a066",
      hair: "#b8b2ac",
      shirt: "#263262",
      pants: "#3a3040",
      accent: "#34447c",
      top: "turtleneck",
      outfit: "lab-coat",
      face: "round-glasses",
      head: "beret",
      neck: "scarf",
      hairStyle: "bun",
      eyes: "happy",
      blush: true,
      accessories: [],
      shoes: "boots",
      shoeColor: "#4a3020",
    },
    idle: [
      "Uy, qué rico este silencio pa' mirar el cielo.",
      "¿Sabía que la luz de algunas estrellas salió antes de que existiera la cabaña?",
      "Anote en el diario lo que vea, ¿oyó?",
      "Ese orrery lo armé con puntillas y paciencia.",
    ],
  },
];

/**
 * Doña Aurora, la casera: abuela paisa que cuida la cabaña desde que el cuidador anterior se fue sin avisar.
 * Vive en el recibidor de la planta baja, junto a la escalera (lejos del mostrador de la recepción), y guía
 * el capítulo 1 de la historia (historia.ts). Ruana de lana sobre el delantal, pañoleta y el pelo blanco
 * recogido en moño.
 */
export const HISTORIA_NPCS: readonly GameNpc[] = [
  {
    id: "aurora",
    role: "casera",
    name: "Doña Aurora",
    voz: 0.52,
    area: "planta-baja",
    tile: { x: 16, y: 16 },
    facing: "down",
    solid: true,
    look: {
      skin: "#c8946a",
      hair: "#ece8e2",
      shirt: "#7a2a36",
      pants: "#4a3a2e",
      accent: "#d8a94a",
      top: "sweater",
      outfit: "apron",
      neck: "scarf",
      hairStyle: "bun",
      eyes: "happy",
      blush: true,
      accessories: [],
      shoes: "boots",
      shoeColor: "#3a2a1e",
    },
    idle: [
      "Ay, mijo, ¿ya comió? Uno no trabaja bien con la barriga vacía.",
      "Esta casa cruje de noche. Yo digo que es la madera. Yo digo.",
      "El que cuidaba antes dejó todo tan ordenadito… menos una puerta.",
    ],
  },
];

/** Todos los personajes fijos (el casino, el observatorio y la casera). */
export const ALL_NPCS: readonly GameNpc[] = [...CASINO_NPCS, ...OBSERVATORIO_NPCS, ...HISTORIA_NPCS];

export const casinoNpc = (id: string) => CASINO_NPCS.find((n) => n.id === id);

/** Tiles del nivel donde está parado alguien del personal (no se caminan). */
export const npcSolidTiles = (area: string) => ALL_NPCS.filter((n) => n.area === area && n.solid).map((n) => n.tile);

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
  rouletteClose: ["¡No va más!", "Nada más, que ya gira.", "¡Ya no va más, señores!"],
  /** Lo que agrega después del número, a veces. */
  rouletteAfter: ["Uy, casi.", "Qué pena con los del negro.", "Pa' la próxima, parcero.", "¡Eso, eso!"],
  /** El dealer: abre la ronda, reparte y termina. */
  blackjackOpen: ["Hagan juego, señores.", "¿Quién se anima?", "Siéntense, que ya reparto."],
  blackjackDeal: ["Cartas van.", "Ahí le van.", "Suerte, pues."],
  bankWins: ["La casa gana, qué pena con usted.", "Otra vez será, mijo.", "Hoy la banca está de buenas."],
  bankLoses: ["Uy, casi… me ganaron.", "Bien jugado, sumercé.", "¡Qué suerte la suya!"],
  dealerBust: ["¡Me pasé! Qué oso.", "Ay, no. Me fui de largo.", "Me reventé, ¡a cobrar!"],
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

// ---------- La astrónoma ----------

export const ASTRONOMA = {
  /** Pausa mínima entre dos preguntas de la misma persona (el servidor la aplica). */
  cooldownMs: 2500,
  /** A qué distancia (tiles) saluda a quien se le arrima. */
  greetTiles: 2.4,
  /** Cuánto hay que alejarse (tiles) para que vuelva a saludar. */
  greetResetTiles: 5,
} as const;

/** Qué se ve del cielo: el momento del día del juego y el clima de afuera. */
export interface SkyContext {
  minuteOfDay: number;
  weather: Weather;
}

/** La hora dicha como en la calle: "las 9:40 de la noche", "la 1:05 de la madrugada", "las 12:00 del día". */
export function spokenHour(minuteOfDay: number): string {
  const m = ((Math.floor(minuteOfDay) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const h12 = h % 12 || 12;
  const part = h < 5 ? "de la madrugada" : h < 12 ? "de la mañana" : h < 13 ? "del día" : h < 19 ? "de la tarde" : "de la noche";
  return `${h12 === 1 ? "la" : "las"} ${h12}:${String(m % 60).padStart(2, "0")} ${part}`;
}

/** Saludos a quien se arrima (`{name}` = el nombre corto). */
export const ASTRONOMA_GREET = [
  "¡Quiubo, {name}! Qué bueno que vino al observatorio.",
  "Siga, {name}, que el cielo es de todos.",
  "¡Ay, qué bueno verlo, {name}! ¿Viene a mirar estrellas?",
  "Buenas, {name}. Hable pasito, que las estrellas se asustan… mentiras.",
  "¡Hola, {name}! Arrímese, que le cuento qué hay hoy en el cielo.",
] as const;

/**
 * Lo que dice del cielo según la hora del juego y el clima (`{hora}` = la hora dicha). De noche y
 * despejado, lo que se ve a esa hora; con nubes, lluvia, niebla o nieve, que así no se ve nada; de día,
 * que vuelvan de noche.
 */
export const ASTRONOMA_LINES = {
  tarde: [
    "Son {hora}: ya casi. Apenas se oculte el sol sale el lucero de la tarde.",
    "Espere un ratico, que a las siete se abre la cúpula y empieza la función.",
    "El atardecer es el mejor momento pa' limpiar las lentes. Quédese pa' la noche.",
  ],
  dia: [
    "Son {hora}: de día el telescopio descansa. Vuelva de noche.",
    "El sol también es una estrella, la más cercana… pero no la mire de frente, ¿oyó?",
    "De día no se ve ni una estrella. Vuelva después de las siete y le muestro Orión.",
    "Ahorita el cielo está muy azul pa' mirar estrellas. ¡Vuelva de noche, que vale la pena!",
  ],
  prima: [
    "Son {hora} y ya salieron las Tres Marías: el cinturón de Orión, mírelas en fila.",
    "¿Ve esa estrella bien brillante? Es Sirio, la más brillante de la noche.",
    "Orión viene subiendo por el oriente, con su espada y todo. ¡Qué belleza!",
    "Desde Colombia se ven las estrellas de los dos hemisferios: somos unos privilegiados.",
  ],
  noche: [
    "Son {hora}: ya se ve la Cruz del Sur, bajita, hacia el sur.",
    "Mire esa franja clarita: es la Vía Láctea, nuestra galaxia vista de canto.",
    "Esa lucecita que no titila es Júpiter. Por el telescopio se le ven las lunas.",
    "Escorpión se está asomando: busque la estrella rojiza, Antares, el corazón.",
  ],
  madrugada: [
    "Son {hora}: a esta hora pasan más estrellas fugaces. Arrímese al telescopio y pida un deseo.",
    "Las siete cabritas están arriba: las Pléyades, un racimo de estrellas bien juntas.",
    "La madrugada es la hora de los astrónomos serios… y de los trasnochados, como yo.",
  ],
  amanecer: [
    "Son {hora}: ese puntico brillante es el lucero de la mañana, que en verdad es Venus.",
    "Ya se van apagando las estrellas. Qué pesar, pero vuelven esta noche.",
    "Madrugó o trasnochó, ¿cierto? Alcanza a ver las últimas estrellas por el oriente.",
  ],
  nublado: [
    "Son {hora} y con este nublado no se ve ni el lucero. Toca esperar a que despeje.",
    "Las nubes nos taparon el cielo, qué embarrada. Mientras tanto, mire el orrery.",
  ],
  lluvia: [
    "Con este aguacero cerramos la cúpula, no se me vaya a mojar el telescopio.",
    "Llueve y llueve… aproveche y lea el diario de exploración mientras escampa.",
  ],
  tormenta: [
    "¡Uy, qué tormenta! Esos rayos también son un espectáculo, pero mejor desde aquí adentro.",
    "Con estos truenos ni se le ocurra subir a la cúpula, ¿oyó?",
  ],
  niebla: [
    "Con esta neblina no se ve ni la torre desde la placita. Esperemos que levante.",
    "Neblina cerrada: el cielo está ahí, pero escondido. Paciencia.",
  ],
  nieve: [
    "¡Está nevando! Qué cosa tan rara por estos lados. Así no se ve el cielo, pero qué bonito.",
    "Con la nieve el telescopio se congela. Tómese algo calientico mientras tanto.",
  ],
} as const satisfies Record<string, readonly string[]>;

export type SkyTopic = keyof typeof ASTRONOMA_LINES;

/** Qué parte de las frases toca según la hora y el clima. */
export function skyTopic(ctx: SkyContext): SkyTopic {
  const m = ((Math.floor(ctx.minuteOfDay) % 1440) + 1440) % 1440;
  if (ctx.weather !== "despejado") return ctx.weather;
  if (m >= NIGHT_FROM && m < 22 * 60) return "prima";
  if (m >= 22 * 60 || m < 2 * 60) return "noche";
  if (m < 5 * 60) return "madrugada";
  if (m < NIGHT_UNTIL) return "amanecer";
  if (m >= 17 * 60) return "tarde";
  return "dia";
}

/** Lo que contesta con E: una frase del cielo de ahora, fija para la semilla (todos ven la misma). */
export function astronomerLine(ctx: SkyContext, seed: number): string {
  return pickLine(ASTRONOMA_LINES[skyTopic(ctx)], seed).replace("{hora}", spokenHour(ctx.minuteOfDay));
}

/** El saludo a quien se arrima (`name` = el nombre corto), fijo para la semilla. */
export function astronomerGreeting(name: string, seed: number): string {
  return pickLine(ASTRONOMA_GREET, seed).replace("{name}", name);
}
