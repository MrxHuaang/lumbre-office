// El puesto de pesca de la orilla oeste del lago: una caseta con su mostrador y Don Evelio, el pescador
// pastuso que atiende. Vende cañas (la de bambú sigue siendo gratis y la de siempre; la de fibra de
// vidrio, la de carbono y la dorada se compran una vez y cada una hace más fácil el minijuego) y carnada
// (se gasta una por lance: pica antes y suben un poco los raros). Todo va a la mochila (`obj:<id>`). Aquí
// están los precios, los efectos, qué equipo se usa al lanzar, los mensajes y lo que dice Don Evelio
// según la hora del juego y el clima.
import { z } from "zod";
import type { BagObject } from "./bolsa";
import { FISHING_RODS, ROD_TUNING, isFishingRod, type FishingRod } from "./fishing-sim";
import type { Look } from "./look";
import { lineSeed, pickLine, type CasinoNpc } from "./npcs";
import type { Weather } from "./weather";

// ---------- Equipo ----------

/** Id del objeto de la mochila (y de su dibujo en items.ts) de cada caña que se compra. */
export const ROD_ITEM: Record<Exclude<FishingRod, "bambu">, string> = {
  fibra: "cana-fibra",
  carbono: "cana-carbono",
  dorada: "cana-dorada",
};

/** La caña de un objeto de la mochila ("cana-fibra" → "fibra"), o null si no es una caña. */
export function rodOfItem(art: string): FishingRod | null {
  const hit = Object.entries(ROD_ITEM).find(([, id]) => id === art);
  return hit && isFishingRod(hit[0]) ? hit[0] : null;
}

/** Nombre de cada caña (el bambú no se vende: es la de siempre). */
export const ROD_NAME: Record<FishingRod, string> = {
  bambu: "Caña de bambú",
  fibra: "Caña de fibra de vidrio",
  carbono: "Caña de carbono",
  dorada: "Caña dorada",
};

export const BAITS = ["carnada", "carnada-buena"] as const;
export type BaitId = (typeof BAITS)[number];
export const isBait = (id: string): id is BaitId => (BAITS as readonly string[]).includes(id);

/**
 * Lo que hace la carnada en un lance: la espera hasta la picada se multiplica por `biteMul` (pica antes)
 * y los raros, épicos, legendarios y míticos pesan `luck` veces más (ver `fishPool`).
 */
export const BAIT_TUNING: Record<BaitId, { biteMul: number; luck: number }> = {
  carnada: { biteMul: 0.6, luck: 1.3 },
  "carnada-buena": { biteMul: 0.45, luck: 1.8 },
};

/** Lo que se usa al lanzar: la caña y la carnada (null = sin carnada). */
export interface FishingGear {
  rod: FishingRod;
  bait: BaitId | null;
  /** Barra más larga por el oficio (Pesca nivel 5; ver OFICIO_PERKS en oficios.ts). */
  barBonus?: number;
}

/**
 * Con qué se pesca: siempre la mejor caña que se tenga (así nadie pesca con la peor por descuido). La
 * carnada, la de la mano si es una (para guardar la de la buena); si no, la mejor. Sin nada comprado, la
 * caña de bambú y sin carnada, como siempre. `count(art)` = unidades de ese objeto en la mochila.
 */
export function fishingGear(count: (art: string) => number, inHand = ""): FishingGear {
  const rod: FishingRod = [...FISHING_RODS].reverse().find((r) => r !== "bambu" && count(ROD_ITEM[r]) > 0) ?? "bambu";
  const bait: BaitId | null = isBait(inHand) && count(inHand) > 0 ? inHand : ([...BAITS].reverse().find((b) => count(b) > 0) ?? null);
  return { rod, bait };
}

/** Espera hasta la picada con esta carnada (ms, con el mínimo y el máximo del lance). */
export function biteWindowWith(bait: BaitId | null, biteMinMs: number, biteMaxMs: number): { min: number; max: number } {
  const mul = bait ? BAIT_TUNING[bait].biteMul : 1;
  return { min: Math.round(biteMinMs * mul), max: Math.round(biteMaxMs * mul) };
}

// ---------- Lo que vende ----------

export type PescaItemKind = "rod" | "bait";

export interface PescaItem {
  /** Id del objeto de la mochila (sin `obj:`) y de su dibujo en items.ts. */
  id: string;
  name: string;
  kind: PescaItemKind;
  price: number;
  /** Cuántas unidades da una compra (la carnada viene de a 10). */
  gives: number;
  blurb: string;
  /** Lo que hace, en corto (para el panel). */
  effect: string;
}

const pct = (x: number) => `${Math.round(Math.abs(x - 1) * 100)} %`;

export const PESCA_SHOP = [
  {
    id: ROD_ITEM.fibra,
    name: ROD_NAME.fibra,
    kind: "rod",
    price: 150,
    gives: 1,
    blurb: "Fibra de vidrio verde, liviana y flexible. Una vez comprada es suya para siempre.",
    effect: `Barra ${pct(ROD_TUNING.fibra.bar)} más larga y el pez ${pct(ROD_TUNING.fibra.move)} más lento.`,
  },
  {
    id: ROD_ITEM.carbono,
    name: ROD_NAME.carbono,
    kind: "rod",
    price: 400,
    gives: 1,
    blurb: "Azul noche con anillos dorados: la de los que saben. Se compra una vez.",
    effect: `Barra ${pct(ROD_TUNING.carbono.bar)} más larga y el pez ${pct(ROD_TUNING.carbono.move)} más lento.`,
  },
  {
    id: ROD_ITEM.dorada,
    name: ROD_NAME.dorada,
    kind: "rod",
    price: 1200,
    gives: 1,
    blurb: "La legendaria: dorada de punta a punta y con su brillito. Dicen que con ella se saca al Bigotón.",
    effect: `Barra ${pct(ROD_TUNING.dorada.bar)} más larga y el pez ${pct(ROD_TUNING.dorada.move)} más lento.`,
  },
  {
    id: "carnada",
    name: "Carnada",
    kind: "bait",
    price: 12,
    gives: 10,
    blurb: "Una lata de lombrices de tierra negra. Se gasta una por lance.",
    effect: `Pica ${pct(BAIT_TUNING.carnada.biteMul)} antes y salen más raros.`,
  },
  {
    id: "carnada-buena",
    name: "Carnada de la buena",
    kind: "bait",
    price: 35,
    gives: 10,
    blurb: "Camarón de río y masa con anís, receta de Don Evelio. Una por lance.",
    effect: `Pica ${pct(BAIT_TUNING["carnada-buena"].biteMul)} antes y salen muchos más raros.`,
  },
] as const satisfies readonly PescaItem[];

export type PescaItemId = (typeof PESCA_SHOP)[number]["id"];
export const PESCA_ITEM_IDS = PESCA_SHOP.map((i) => i.id) as [PescaItemId, ...PescaItemId[]];
export const pescaItem = (id: string): PescaItem | undefined => (PESCA_SHOP as readonly PescaItem[]).find((i) => i.id === id);
/** `refId` del cobro (motivo PURCHASE). */
export const pescaRefId = (id: PescaItemId) => `pesca:${id}`;

export const PESCA = {
  /** Pausa mínima entre dos compras de la misma persona (doble clic). */
  buyCooldownMs: 800,
  /** Tope de carnada de cada clase en la mochila (una pila). */
  baitMax: 99,
} as const;

/**
 * Lo del puesto en la mochila (se suma a `BAG_OBJECTS`): las cañas son herramientas de a una que no se
 * gastan; la carnada, una pila que baja con cada lance.
 */
export const PESCA_BAG_OBJECTS: Record<string, BagObject> = Object.fromEntries(
  PESCA_SHOP.map((i): [string, BagObject] =>
    i.kind === "rod"
      ? [i.id, { name: i.name, blurb: `${i.blurb} ${i.effect}`, kind: "herramienta", max: 1, durable: true }]
      : [i.id, { name: i.name, blurb: `${i.blurb} ${i.effect}`, kind: "objeto", max: PESCA.baitMax }],
  ),
);

// ---------- Mensajes ----------

/** Mensajes propios del puesto (sin tocar `MSG`). */
export const PESCA_MSG = {
  /** Cliente → servidor: comprar (`PescaBuyMessage`). */
  buy: "pesca:buy",
  /** Servidor → quien compró (`PescaBuyResult`). */
  result: "pesca:result",
  /** Servidor → los del nivel: alguien compró (para que Don Evelio le hable igual para todos). */
  sold: "pesca:sold",
} as const;

export const PescaBuyMessage = z.object({ item: z.enum(PESCA_ITEM_IDS) });
export type PescaBuyMessage = z.infer<typeof PescaBuyMessage>;

export type PescaBuyError = "far" | "funds" | "full" | "stack" | "owned" | "busy" | "failed";

export type PescaBuyResult = { ok: true; item: PescaItemId; balance: number } | { ok: false; item: PescaItemId; error: PescaBuyError };

/** Los motivos, en boca de Don Evelio (pastuso). */
export const PESCA_ERROR_TEXT: Record<PescaBuyError, string> = {
  far: "Arrímese al mostradorcito, mijo, que desde allá no le oigo, pues.",
  funds: "No le alcanza, longo. Pesque un ratico y vuelve, pues.",
  full: "No le cabe en la mochila, mijo: haga campito primero, pues.",
  stack: "Ya lleva toda la carnadita que cabe. Gástela primero, pues.",
  owned: "Esa cañita ya es suya, mijo. Una basta, ¿ve?",
  busy: "Con calmita, que no se me van los pescaditos, pues.",
  failed: "Chuta, se me enredó la cuenta. Intente otra vez, pues.",
};

/** Servidor → los del nivel (`PESCA_MSG.sold`). */
export interface PescaSoldEvent {
  sessionId: string;
  item: PescaItemId;
  /** Hora del servidor de la venta (la semilla de la frase: dos compras seguidas no dicen lo mismo). */
  at: number;
}

// ---------- Don Evelio ----------

/** Tile del nivel del jardín donde se para Don Evelio (detrás del mostrador; ver puesto-pesca.ts del mapa). */
const EVELIO_TILE = { x: 70, y: 77 };

/**
 * Don Evelio es de Pasto: ruana de lana pastusa café con franjas rojas sobre la ropa, su sombrero de
 * pescador, bigote canoso y botas de caucho.
 */
const EVELIO_LOOK: Look = {
  skin: "#c68642",
  hair: "#ece6da",
  shirt: "#7a4a2a",
  pants: "#5a4a34",
  accent: "#6f7d3c",
  hairStyle: "short",
  top2: "#b8402a",
  outfit: "ruana",
  bottom: "cargo",
  head: "bucket-hat",
  facialHair: "mustache",
  eyes: "happy",
  shoes: "rain-boots",
  shoeColor: "#4a6b34",
  accessories: [],
};

export const PESCA_NPC: CasinoNpc = {
  id: "evelio",
  role: "pescador",
  name: "Don Evelio",
  area: "jardin",
  tile: EVELIO_TILE,
  // Mira al lago (y a quien se arrima al mostrador).
  facing: "right",
  solid: true,
  look: EVELIO_LOOK,
  idle: [
    "¡Ve, mijo! A la final el que tiene paciencia saca el pescado, pues.",
    "Esto no es la laguna de la Cocha, pero bien bonito es, ¿no?",
    "¿Ya comió? Pescar con hambre no sale, pues.",
  ],
};

/** El momento del día para Don Evelio, según la hora del juego (0 a 23). */
export type PescaMood = "madrugada" | "manana" | "tarde" | "atardecer" | "noche";

export function pescaMood(hour: number): PescaMood {
  if (hour < 5) return "madrugada";
  if (hour < 12) return "manana";
  if (hour < 17) return "tarde";
  if (hour < 20) return "atardecer";
  return "noche";
}

/**
 * Lo que dice Don Evelio, con el habla de Pasto (cariñosa: "achichay" es frío, "ananay" qué bonito,
 * "atatay" qué feo, "longo" muchacho, "guagua" niño) y sus recuerdos de la laguna de la Cocha, el cuy, el
 * hervido y el Galeras.
 */
export const PESCA_LINES = {
  /** Lo que dice suelto, según la hora del juego. */
  madrugada: [
    "¡Achichay, qué frío! A esta hora pica la Madre de agua, dicen, pues.",
    "Madrugada fría como en las faldas del Galeras, mijo. El pescado anda juicioso.",
    "Shhh, longo, que el lago está dormidito, pues.",
  ],
  manana: [
    "Buenos días, mijo. El agüita está quietecita, bien bonito, pues.",
    "Un tintico calientito y la cañita al agua: así empieza el día, ¿ve?",
    "Tempranito pican las mojarritas, ¿sí sabía, pues?",
  ],
  tarde: [
    "¡Atatay, qué solazo! Los pescaditos se van al fondo, pues.",
    "Póngase el sombrerito, mijo, que el sol de la tarde pica más que el pescado.",
    "¿Ya almorzó? Un cuycito asado y a pescar, vea pues.",
  ],
  atardecer: [
    "¡Ananay, qué atardecer tan bonito! Tire la línea ahí no más, pues.",
    "Al caer el sol sale la guabina. Pilas, mijo.",
    "El pez sol poniente solo pica ahoritica, ¿ve?",
  ],
  noche: [
    "De noche salen los bagres bigotones, longo. Abríguese, pues.",
    "¡Achichay, ya entró el frío! Un hervidito caería bien bonito.",
    "La luna alumbra el lago como a la Cocha en diciembre, pues.",
  ],
  /** Lo que dice según el clima (manda sobre la hora). */
  lluvia: [
    "¡Ve, está lloviendo! A la final es mejor para pescar, pues.",
    "Con aguacero pica el renacuajo y el arcoíris. Aproveche, mijo.",
    "Chuta, qué aguacero. Póngase la ruanita y siga pescando, pues.",
  ],
  tormenta: [
    "¡Atatay, qué truenos! Pero con tormenta sale el Rey, pues.",
    "Chuta, qué tormenta. Los temblones están contentos, ¿ve?",
    "Cuidadito con los rayos, guagua. Pero el pescado bueno sale ahora.",
  ],
  niebla: [
    "Neblina como en Pasto, mijo: ni se ve la boyita, pues.",
    "Con esta neblina el pez hoja casi ni se nota, ¿ve?",
    "En la neblina hay que pescar al oído, vea pues.",
  ],
  nieve: [
    "¡Achichay, achichay! Ni en el Galeras hace este frío, pues.",
    "Nieve en el lago: esto no lo veía ni de guagua.",
    "Con este frío la carnadita buena es la que funciona, mijo.",
  ],
  /** Al que se arrima al mostrador (`{name}` = su nombre corto). */
  greet: [
    "¡Ve, {name}! ¿Qué le doy vendiendo, pues?",
    "Siga, {name}, siga no más. A la orden, pues.",
    "¿Qué más, {name}? Tengo carnadita fresquita.",
    "¡Ala, {name}! ¿Se va a tirar la línea un ratico?",
  ],
  /** Al vender, según qué se lleva. */
  soldRod: ["¡Ananay, qué cañita tan bonita! Me la cuida, pues.", "Con esa sí saca al Bigotón, mijo, ¿ve?", "Bien bonita la escogió. Esa no se revienta ni a la final."],
  soldBait: ["Carnadita fresquita, recién sacadita, pues.", "Una por lance, mijo, no me la bote.", "Con eso pican hasta los tímidos, vea pues."],
} as const;

/** Lo que dice suelto según la hora del juego y el clima (el clima raro manda), fijo para una semilla. */
export function pescaIdleLine(hour: number, weather: Weather | undefined, seed: number): string {
  const byWeather = weather === "lluvia" || weather === "tormenta" || weather === "niebla" || weather === "nieve" ? PESCA_LINES[weather] : null;
  return pickLine(byWeather ?? PESCA_LINES[pescaMood(hour)], seed);
}

/** El saludo al que se arrima: el saludo con su nombre y, detrás, un comentario de la hora o del clima. */
export function pescaGreetLine(name: string, hour: number, weather: Weather | undefined, seed: number): string {
  return `${pickLine(PESCA_LINES.greet, seed).replace("{name}", name)} ${pescaIdleLine(hour, weather, Math.floor(seed / 7))}`;
}

/** Lo que dice al vender (todos ven la misma: la semilla sale de quién compró, qué y cuándo). */
export function pescaSoldLine(sold: PescaSoldEvent): string {
  const kind = pescaItem(sold.item)?.kind;
  return pickLine(kind === "rod" ? PESCA_LINES.soldRod : PESCA_LINES.soldBait, lineSeed(`${sold.sessionId}:${sold.item}:${sold.at}`));
}
