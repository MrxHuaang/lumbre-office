// Casa viva: los muebles chicos que se usan en todos los niveles (lámparas, libros, nevera, cafetera,
// radio, globo, chimeneas, plantas, cortinas, ajedrez, puzle, pizarra, baños y la fogata). Se suman a
// USABLE_FURNITURE (consumables.ts): mismo mensaje (`MSG.furnitureUse`), mismas reglas de alcance.
// El servidor valida y avisa; lo que ven todos queda en el estado (interruptores, contadores y
// cubículos ocupados) o llega como evento.
import type { ConsumeAction, UsableSpec } from "./consumables";

/**
 * Lo nuevo que se hace con un mueble (además de prender, tocar y acariciar):
 * - `read`: leer un libro de la estantería (un libro abierto en la mano y un globo con el título);
 * - `spin`: girar el globo terráqueo;
 * - `stoke`: avivar el fuego (más llama por un rato);
 * - `water`: regar una planta;
 * - `count`: ajedrez, puzle y pizarra: cada uso avanza un contador que ven todos (y vuelve a empezar);
 * - `take`: sacar algo gratis (la nevera, la cafetera): queda en la mano como consumible;
 * - `wash`: lavarse las manos;
 * - `stall`: entrar al cubículo del baño un rato (se ve ocupado);
 * - `roast`: asar un malvavisco en la fogata (queda en la mano, dorado).
 */
export type CasaAction = "read" | "spin" | "stoke" | "water" | "count" | "take" | "wash" | "stall" | "roast";

export const CASA = {
  /** Pausa entre dos cosas gratis (nevera, cafetera, malvavisco) de la misma persona. */
  freebieCooldownMs: 45_000,
  /** Cuánto se está en el cubículo del baño. */
  stallMs: 7_000,
  /** Cuánto tarda en dorarse el malvavisco (después queda en la mano). */
  roastMs: 3_600,
  /** Cuánto dura el fuego avivado. */
  stokeMs: 20_000,
  /** Cuánto se ve el libro abierto y el globo con el título. */
  readMs: 4_200,
  /** Cuánto dura lavarse las manos y regar. */
  washMs: 2_400,
  waterMs: 2_200,
  /** Hasta dónde se asa un malvavisco (tiles, desde los troncos de la fogata). */
  roastReachTiles: 2.2,
} as const;

/** Tope de cada contador: al llegar vuelve a 0 (partida nueva, puzle nuevo, pizarra borrada). */
export const COUNTER_MAX: Record<string, number> = {
  "chess-table": 12,
  "puzzle-table": 20,
  "cafe-sign": 6,
  easel: 6,
};

const lamp = (label: string): UsableSpec => ({
  action: "toggle",
  label: `Prender ${label}`,
  labelOn: `Apagar ${label}`,
  defaultOn: true,
  cooldownMs: 400,
  nightOnly: true,
});
const read: UsableSpec = { action: "read", label: "Leer un libro", cooldownMs: CASA.readMs };
const water: UsableSpec = { action: "water", label: "Regar la planta", cooldownMs: CASA.waterMs };
const wash: UsableSpec = { action: "wash", label: "Lavarse las manos", cooldownMs: CASA.washMs };
const stall: UsableSpec = { action: "stall", label: "Entrar al baño", cooldownMs: 1500 };
const stoke: UsableSpec = { action: "stoke", label: "Avivar el fuego", cooldownMs: 3000 };

/** Tipo de las cortinas: son las ventanas de las paredes (no un mueble del catálogo; ver `curtainsOf`). */
export const CURTAIN_TYPE = "cortina";

export const CASA_USABLES: Record<string, UsableSpec> = {
  // Lámparas y faroles de todo tipo (sin capa de encendida: de día no se ofrecen).
  "lamp-post": lamp("el farol"),
  "garden-lantern": lamp("el farolito"),
  "dock-lamp": lamp("el farol"),
  "wall-sconce": lamp("el aplique"),
  // Libros de las estanterías y la biblioteca.
  "bookcase-tall": read,
  "bookshelf-low": read,
  bookshelf: read,
  // Nevera y cafetera: algo gratis a la mano.
  fridge: { action: "take", label: "Abrir la nevera", cooldownMs: 1500, gives: ["jugo", "manzana", "banano"] },
  "coffee-station": { action: "take", label: "Servirse un tinto", cooldownMs: 1500, gives: ["tinto"] },
  // Radio: música, como el tocadiscos (arranca apagada).
  radio: { action: "toggle", label: "Prender la radio", labelOn: "Apagar la radio", defaultOn: false, cooldownMs: 800 },
  globe: { action: "spin", label: "Girar el globo", cooldownMs: 1800 },
  "fireplace-stone": stoke,
  fireplace: stoke,
  // Plantas en maceta.
  plant: water,
  monstera: water,
  bonsai: water,
  cactus: water,
  planter: water,
  "balcony-planter": water,
  // Las cortinas de las ventanas: prendida = cerrada.
  [CURTAIN_TYPE]: { action: "toggle", label: "Cerrar la cortina", labelOn: "Abrir la cortina", defaultOn: false, cooldownMs: 600 },
  // Juegos de mesa y pizarras: un contador que avanza para todos.
  "chess-table": { action: "count", label: "Mover una pieza", cooldownMs: 1200 },
  "puzzle-table": { action: "count", label: "Poner una pieza", cooldownMs: 1200 },
  "cafe-sign": { action: "count", label: "Garabatear en la pizarra", cooldownMs: 1500 },
  easel: { action: "count", label: "Pintar un poco", cooldownMs: 1500 },
  // Baños.
  "toilet-stall": stall,
  "bath-stall": stall,
  vanity: wash,
  "bath-sink": wash,
  "kitchen-sink": wash,
  // La fogata del jardín: se asa desde los troncos (un poco más lejos que el alcance normal).
  "fire-pit": { action: "roast", label: "Asar un malvavisco", cooldownMs: CASA.roastMs + 400, gives: ["malvavisco"], reachTiles: CASA.roastReachTiles },
};

/** Lo gratis que se lleva en la mano: cómo se usa y cuántas veces (se suma a CONSUMABLES). */
export const CASA_CONSUMABLES: Record<string, { action: ConsumeAction; uses: number }> = {
  jugo: { action: "sip", uses: 3 },
  manzana: { action: "bite", uses: 3 },
  banano: { action: "bite", uses: 3 },
  malvavisco: { action: "bite", uses: 2 },
};

/** Qué queda en la mano por algo gratis (el tinto sale de la carta de la cafetería). */
export const FREE_HOLDS: Record<string, readonly string[]> = {
  jugo: ["jugo"],
  manzana: ["manzana"],
  banano: ["banano"],
  malvavisco: ["malvavisco"],
};

/**
 * Lo que se lee en las estanterías: títulos inventados (el globo muestra uno, el mismo para todos). La
 * semilla del servidor elige cuál.
 */
export const BOOK_TITLES = [
  "El jardín de las tazas vacías",
  "Cien maneras de hacer café",
  "Manual del buen vecino",
  "La cabaña del bosque dormido",
  "Recetas de la abuela Inés",
  "Astronomía para días nublados",
  "El gato que quería ser faro",
  "Historia secreta de los calcetines",
  "Poemas para leer en pantuflas",
  "Guía de aves del jardín",
  "El último tren a Villa Musgo",
  "Cómo hablarle a las plantas",
  "Atlas de islas que no existen",
  "Pequeño tratado de siestas",
  "El misterio del reloj de pie",
  "Canciones para una tarde de lluvia",
] as const;

export const bookTitle = (seed: number) => BOOK_TITLES[Math.abs(Math.floor(seed)) % BOOK_TITLES.length]!;

/** Qué sale de la nevera (o de la cafetera) con esa semilla. */
export function pickGift(gives: readonly string[], seed: number): string {
  return gives[Math.abs(Math.floor(seed)) % gives.length]!;
}

/** Clave de un contador en el estado (`OfficeState.counters`), igual que la de los interruptores. */
export const counterMax = (type: string) => COUNTER_MAX[type] ?? 1;
