// El Man del Sombrero: un NPC escondido que solo sale a ciertas horas del juego (o con tormenta) y vende
// "mercancía" de contrabando con temática colombiana. Es un juego para adultos del equipo: todo es
// ficticio y los efectos son cómicos y visuales (nada de información real). El servidor decide si está y
// dónde (ver apps/server/src/rooms/sombrero.ts); acá van las reglas puras, la carta y los efectos.
import { z } from "zod";
import type { ConsumeAction } from "./consumables";
import type { Weather } from "./weather";
import type { Look } from "./look";

export const SOMBRERO_NAME = "El Man del Sombrero";

/** Cómo se ve: gabán gris largo, sombrero de fieltro, bigote y la cara en sombra. */
export const SOMBRERO_LOOK: Look = {
  skin: "#b98a62",
  hair: "#2a2320",
  shirt: "#3a3a40",
  pants: "#34343c",
  accent: "#7d7f86",
  hairStyle: "short",
  accessories: [],
  outfit: "trenchcoat",
  head: "fedora",
  facialHair: "mustache",
  eyes: "sleepy",
  eyeColor: "#1a1a1a",
  blush: false,
  shoes: "boots",
  shoeColor: "#2a2420",
};

/** Franjas del reloj del juego en las que sale (minuto del día, desde incluido y hasta sin incluir). */
export const SOMBRERO_HOURS: readonly (readonly [number, number])[] = [
  [2 * 60, 4 * 60],
  [13 * 60, 14 * 60 + 30],
  [21 * 60, 23 * 60],
];

/** ¿Es una de sus horas? */
export const isSombreroHour = (minuteOfDay: number) => SOMBRERO_HOURS.some(([from, to]) => minuteOfDay >= from && minuteOfDay < to);

/** ¿Anda por ahí? En sus horas, o cuando hay tormenta (nadie se fija en nada). */
export const sombreroOut = (minuteOfDay: number, weather: Weather) => weather === "tormenta" || isSombreroHour(minuteOfDay);

export interface Hideout {
  id: string;
  /** Nivel y tile donde se para (tiles del nivel: en el jardín ya lleva el margen de bosque de 10). */
  area: string;
  x: number;
  y: number;
  facing: "down" | "left" | "right" | "up";
  /** Cómo se le dice al lugar (para los avisos y las pistas). */
  place: string;
}

/**
 * Sus escondites: rincones poco transitados pero alcanzables. Cada día del juego elige uno distinto al del
 * día anterior. En el jardín solo donde no van las estructuras nuevas (ver docs/plan-estructuras.md).
 */
export const SOMBRERO_HIDEOUTS: readonly Hideout[] = [
  // Jardín (zona jugable + 10): detrás del huerto contra el bosque del noroeste.
  { id: "huerto", area: "jardin", x: 14, y: 11, facing: "down", place: "detrás del huerto" },
  // Jardín: el rincón del noreste, pasado el patio, contra el bosque.
  { id: "noreste", area: "jardin", x: 80, y: 12, facing: "down", place: "en el rincón del noreste" },
  // Jardín: entre los árboles, a medio camino entre la fogata y el camino al portón.
  { id: "arboles", area: "jardin", x: 40, y: 47, facing: "right", place: "entre los árboles del centro" },
  // Jardín: junto al árbol del camino al lago.
  { id: "lago", area: "jardin", x: 57, y: 32, facing: "down", place: "junto al camino del lago" },
  // Garaje: entre el estante y las cajas, en el rincón oscuro del taller.
  { id: "garaje", area: "garaje", x: 1, y: 8, facing: "right", place: "en el rincón del garaje" },
  // Sótano: detrás de la palmera del vestíbulo.
  { id: "vestibulo", area: "sotano", x: 19, y: 16, facing: "right", place: "detrás de la palmera del vestíbulo" },
];

/**
 * El escondite del día nuevo: al azar entre todos menos el de ayer (`prev`, -1 si no hubo). `random(n)`
 * devuelve un entero en [0, n).
 */
export function nextHideout(prev: number, random: (n: number) => number): number {
  const n = SOMBRERO_HIDEOUTS.length;
  if (prev < 0 || prev >= n) return random(n);
  return (prev + 1 + random(n - 1)) % n;
}

export const SOMBRERO = {
  /** Desde qué distancia (tiles) se le habla y se le compra. */
  reachTiles: 1.6,
  /** Pausa mínima entre dos compras de la misma persona (doble clic). */
  buyCooldownMs: 1500,
} as const;

// ---------- Efectos ----------

/**
 * Lo que le hace a uno la mercancía (se ve en la pantalla de quien la tomó y, algo, en su personaje):
 * - trabado: camina más lento, bruma verdosa, risitas y antojo; los ojos entrecerrados.
 * - acelere: tiembla, habla rápido (burbujas cortas) y con los ojos bien abiertos.
 * - colores: los colores giran y el mundo ondula (hongos y cartón).
 * - yage: visión de patrones que dan vueltas y mareo.
 */
export const TRIP_KINDS = ["trabado", "acelere", "colores", "yage"] as const;
export type TripKind = (typeof TRIP_KINDS)[number];
export const isTripKind = (x: unknown): x is TripKind => typeof x === "string" && (TRIP_KINDS as readonly string[]).includes(x);

export const TRIP_TEXT: Record<TripKind, string> = {
  trabado: "Trabado",
  acelere: "Acelerado",
  colores: "Viendo colores",
  yage: "En la pinta del yagé",
};

export const TRIP = {
  /** Cuánto se camina trabado (el servidor lo valida: más lento sí, más rápido nunca). */
  slowSpeedMul: 0.7,
  /** Lo más que dura un efecto sumando usos. */
  maxMs: 6 * 60_000,
} as const;

/** Qué efecto da cada uso de algo (y cuánto suma). Lo que no está acá no hace nada raro. */
export const TRIP_PER_USE: Record<string, { kind: TripKind; ms: number }> = {
  bareta: { kind: "trabado", ms: 60_000 },
  "brownie-magico": { kind: "trabado", ms: 90_000 },
  "perico-bolsa": { kind: "acelere", ms: 60_000 },
  "hongos-quindio": { kind: "colores", ms: 100_000 },
  carton: { kind: "colores", ms: 150_000 },
  yage: { kind: "yage", ms: 120_000 },
};

/**
 * Lo que queda después de un uso: si es el mismo efecto se suma (hasta `TRIP.maxMs`), si es otro lo
 * reemplaza (se pasa de una cosa a la otra). `current` es lo que llevaba y hasta cuándo.
 */
export function addTrip(current: { kind: TripKind; until: number } | null, use: { kind: TripKind; ms: number }, now: number, maxMs: number = TRIP.maxMs) {
  const base = current && current.kind === use.kind && current.until > now ? current.until : now;
  return { kind: use.kind, until: Math.min(now + maxMs, base + use.ms) };
}

// ---------- La carta ----------

/**
 * Lo que vende. Cada `holds` tiene su dibujo en packages/map/src/art/items.ts y su forma de usarse abajo.
 * Los licores de contrabando usan la borrachera de siempre (más fuerte: ver ALCOHOL_PER_SIP).
 */
export const SOMBRERO_MENU = [
  {
    id: "bareta",
    name: "Bareta de la Sierra",
    price: 20,
    holds: ["bareta"],
    blurb: "Enrolladita a mano en la Sierra Nevada. Huele a monte y da risa.",
    effect: "Trabado: camina despacio y le da antojo.",
  },
  {
    id: "brownie-magico",
    name: "Brownie mágico",
    price: 25,
    holds: ["brownie-magico"],
    blurb: "Receta de la abuela, pero no le cuente a la abuela.",
    effect: "Trabado, más fuerte y de efecto lento.",
  },
  {
    id: "perico-bolsa",
    name: "Perico en bolsita",
    price: 35,
    holds: ["perico-bolsa"],
    blurb: "Del que no es café con leche. Lo pone a hablar hasta por los codos.",
    effect: "Acelere: tiembla, habla rapidito y no parpadea.",
  },
  {
    id: "hongos-quindio",
    name: "Hongos del Quindío",
    price: 30,
    holds: ["hongos-quindio"],
    blurb: "Recogidos en potrero, con el rocío de la mañana.",
    effect: "Los colores dan vueltas y la cabaña ondula.",
  },
  {
    id: "carton",
    name: "Cartoncito",
    price: 40,
    holds: ["carton"],
    blurb: "Un cuadrito con una mariposa amarilla. Macondo en la lengua.",
    effect: "Colores que giran, largo rato.",
  },
  {
    id: "yage",
    name: "Yagé del Putumayo",
    price: 45,
    holds: ["yage"],
    blurb: "En totumita, con la bendición del taita incluida.",
    effect: "Visiones de patrones y un mareo berraco.",
  },
  {
    id: "chirrinchi",
    name: "Chirrinchi",
    price: 18,
    holds: ["chirrinchi"],
    blurb: "Tapetusa de alambique casero. Quema bajando.",
    effect: "Emborracha el doble de rápido que el whisky.",
  },
  {
    id: "viche",
    name: "Viche del Pacífico",
    price: 22,
    holds: ["viche"],
    blurb: "Destilado de caña de Guapi, en botellita reciclada. Pa' levantar muertos.",
    effect: "Emborracha rápido, con sabor a fiesta.",
  },
] as const;

export type SombreroItem = (typeof SOMBRERO_MENU)[number];
export type SombreroItemId = SombreroItem["id"];
export const SOMBRERO_ITEM_IDS = SOMBRERO_MENU.map((i) => i.id) as [SombreroItemId, ...SombreroItemId[]];

export function sombreroItem(id: string): SombreroItem | undefined {
  return SOMBRERO_MENU.find((i) => i.id === id);
}

/** Cómo se consume cada cosa de la carta (se suman a CONSUMABLES). El perico se esnifa. */
export const SOMBRERO_CONSUMABLES: Record<string, { action: ConsumeAction; uses: number }> = {
  bareta: { action: "smoke", uses: 4 },
  "brownie-magico": { action: "bite", uses: 3 },
  "perico-bolsa": { action: "sniff", uses: 3 },
  "hongos-quindio": { action: "bite", uses: 2 },
  // Mitad y mitad: se pone en la lengua dos veces.
  carton: { action: "bite", uses: 2 },
  yage: { action: "sip", uses: 2 },
  chirrinchi: { action: "sip", uses: 3 },
  viche: { action: "sip", uses: 4 },
};

/** Tragos de más por sorbo de los licores de contrabando (ver ALCOHOL_PER_SIP). */
export const SOMBRERO_ALCOHOL: Record<string, number> = { chirrinchi: 2.4, viche: 1.6 };

/** `refId` de un movimiento de puntos por una compra al Man del Sombrero. */
export const sombreroRefId = (item: SombreroItemId) => `sombrero:${item}`;

// ---------- Mensajes ----------

/** Cliente → servidor (`MSG.sombreroBuy`): comprarle algo (hay que estar junto a él, y que esté). */
export const SombreroBuyMessage = z.object({ item: z.enum(SOMBRERO_ITEM_IDS) });
export type SombreroBuyMessage = z.infer<typeof SombreroBuyMessage>;

/** Servidor → quien compró (`MSG.sombreroResult`). */
export type SombreroBuyResult =
  | { ok: true; item: SombreroItemId; balance: number }
  | { ok: false; item: SombreroItemId; error: "gone" | "far" | "funds" | "busy" | "failed" };

export const SOMBRERO_ERROR_TEXT: Record<Extract<SombreroBuyResult, { ok: false }>["error"], string> = {
  gone: "El Man del Sombrero ya se fue… como si nunca hubiera estado.",
  far: "Arrímese más, que esto no se grita.",
  funds: "No le alcanza, parcero. Sin plata no hay mercancía.",
  busy: "Calmado, calmado. De a uno.",
  failed: "Algo salió mal. Vuelva a intentar (pero disimule).",
};

// ---------- Lo que dice ----------

/** Al abrir el menú. */
export const SOMBRERO_GREETING = "Psst… ¿qué necesita, parcero?";
/** Van rotando mientras se mira la carta. */
export const SOMBRERO_LINES = [
  "Hable pasito, que las paredes oyen.",
  "Todo es de la mejor, calidad de exportación.",
  "Aquí no hay factura, mijo.",
  "Si pregunta alguien, usted vino por un tinto.",
  "Mire bien, que después no hay devoluciones.",
  "Ojo con el celador, que es sapo.",
  "Esto lo traje por la trocha, pa' usted.",
];
/** Al comprar. */
export const SOMBRERO_THANKS = ["Eso es lo suyo. Pilas pues.", "Guárdelo bien, que se lo quitan.", "Hágale, disfrute. Y disimule."];
/** Al cerrar el menú. */
export const SOMBRERO_FAREWELL = "Yo no lo vi, usted no me vio.";
/** Lo que susurra cuando alguien pasa cerca (en la burbuja, sobre la cabeza). */
export const SOMBRERO_WHISPERS = ["Psst… venga, venga.", "Psst… parcero.", "Psst… ¿busca algo?", "Pssst…"];
