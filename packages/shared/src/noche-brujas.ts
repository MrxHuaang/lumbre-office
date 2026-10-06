// La Noche de brujas jugable (VIR-157, docs/plan-festivales.md): el festival del día 21 del otoño. Aquí las
// reglas puras: el dulce o truco (a los NPC y tocando puertas con la canasta en la mano), la calabaza dorada
// del laberinto de maíz (una por persona por festival), el puesto del festival y sus cinemáticas. Los
// objetos están en brujas.ts; la decoración y el laberinto, en packages/map (festivales/brujas.ts); lo
// decide la sala (apps/server/src/rooms/nocheBrujas.ts).
import { z } from "zod";
import { DULCES, type Dulce } from "./brujas";
import type { CineDef } from "./cinematicas";
import { festivalById, festivalLine } from "./festivales";
import { ALL_NPCS, pickLine, type GameNpc } from "./npcs";
import { PESCA_NPC } from "./pesca-tienda";
import { RECEPCION_NPC } from "./recepcion";

export const BRUJAS = {
  id: "brujas",
  /** Distancia (tiles) a un NPC para pedirle dulce o truco: algunos atienden detrás de un mostrador. */
  npcReachTiles: 2.6,
  /** Distancia (tiles) a la puerta de una oficina para que el toque cuente como dulce o truco. */
  doorReachTiles: 2,
  /** De cada 100 pedidos, cuántos son truco en vez de dulce. */
  trickChance: 30,
  /** Pausa entre dos pedidos de dulce o truco de la misma persona (y entre dos compras). */
  cooldownMs: 1200,
} as const;

/** ¿Se puede jugar ya? Solo con el festival abierto (de las 9:00 a las 22:00 del juego). */
export const brujasActiva = (festival: string, fase: string) => festival === BRUJAS.id && fase === "fiesta";

export const BRUJAS_MSG = {
  /** Cliente → servidor: pedirle dulce o truco a un NPC (`{ npc }`). Las puertas van por `MSG.knock`. */
  trick: "brujas:truco",
  /** Servidor → quien pidió: lo que le tocó (`TrickResult`). */
  trickResult: "brujas:truco:resultado",
  /** Cliente → servidor: tomar la calabaza dorada (junto a ella, en el laberinto). */
  pumpkin: "brujas:calabaza",
  pumpkinResult: "brujas:calabaza:resultado",
  /** Cliente → servidor: comprar en el puesto del festival (`{ item }`). */
  buy: "brujas:comprar",
  buyResult: "brujas:comprar:resultado",
} as const;

// ---------- Dulce o truco ----------

/** Los NPC a los que se les pide (todos los que hay en la cabaña). */
export const BRUJAS_NPCS: readonly GameNpc[] = [...ALL_NPCS, PESCA_NPC, RECEPCION_NPC];
export const brujasNpc = (id: string) => BRUJAS_NPCS.find((n) => n.id === id);

export const TrickMessage = z.object({ npc: z.string().min(1).max(40) });

/** Los trucos: cada uno es una cinemática corta (`brujasTrucoCine`). */
export const TRUCOS = ["fantasma", "trueno", "arana", "carcajada"] as const;
export type Truco = (typeof TRUCOS)[number];

export type TrickOutcome = { kind: "dulce"; dulce: Dulce } | { kind: "truco"; truco: Truco };

/** Lo que toca con dos tiradas del azar: `roll` en 0..99 (truco o dulce) y `pick` para elegir cuál. */
export function trickOutcome(roll: number, pick: number): TrickOutcome {
  if (roll < BRUJAS.trickChance) return { kind: "truco", truco: TRUCOS[Math.abs(pick) % TRUCOS.length]! };
  return { kind: "dulce", dulce: DULCES[Math.abs(pick) % DULCES.length]! };
}

/** A quién se le pidió, para no repetir en el día: un NPC, la puerta de una oficina o el timbre de una casa. */
export const trickKey = (kind: "npc" | "puerta" | "casa", id: string) => `${kind}:${id}`;

export type TrickError = "off" | "basket" | "far" | "done" | "full" | "busy";

export type TrickResult =
  | {
      ok: true;
      /** Quién dio (el nombre del NPC o del dueño de la puerta). */
      from: string;
      /** El id del NPC, si fue uno (para su retrato y su burbuja). */
      npc?: string;
      outcome: TrickOutcome;
      /** Lo que dice el NPC (una frase de brujas). */
      line?: string;
    }
  | { ok: false; error: TrickError; from?: string };

export const TRICK_ERROR_TEXT: Record<TrickError, string> = {
  off: "El dulce o truco es solo en la Noche de brujas.",
  basket: "Lleva la canasta de dulce o truco en la mano.",
  far: "Arrímate un poco más.",
  done: "Aquí ya pediste hoy. ¡Prueba en otra puerta!",
  full: "No te cabe el dulce en la mochila.",
  busy: "Un momentico…",
};

/** Lo que dicen los NPC que no tienen frase de brujas (o cuando la de la fiesta ya salió). */
const GENERIC_LINES = [
  "¡Uy, qué disfraz tan bueno! Tenga, mijo.",
  "¿Dulce o truco? Dulce, dulce, que el truco me da miedo.",
  "Coja uno, pero no le cuente a nadie que yo doy de los buenos.",
  "Esta noche hasta las escobas andan volando.",
] as const;

/** Lo que dice un NPC al darte dulce (la frase de brujas de su ficha, o una de las de siempre). */
export function trickLine(npc: string, seed: number): string {
  const f = festivalById(BRUJAS.id);
  return (f && seed % 3 !== 2 ? festivalLine(f, npc, seed) : null) ?? pickLine(GENERIC_LINES, seed);
}

/** Cómo se dice el resultado en el aviso ("Doña Aurora te dio un bombón"). */
export function trickText(r: Extract<TrickResult, { ok: true }>, dulceName: (id: string) => string): string {
  if (r.outcome.kind === "truco") return `¡Truco! ${r.from} te asustó.`;
  return `${r.from} te dio: ${dulceName(r.outcome.dulce)}.`;
}

// ---------- La calabaza dorada ----------

/** Clave de `UserStat` (máximo 1) de la calabaza dorada de un año del juego: una por persona por festival. */
export const pumpkinStatKey = (año: number) => `festival:${BRUJAS.id}:${año}:calabaza`;

export type PumpkinError = "off" | "far" | "done" | "full" | "busy";
export type PumpkinResult = { ok: true } | { ok: false; error: PumpkinError };

export const PUMPKIN_ERROR_TEXT: Record<PumpkinError, string> = {
  off: "La calabaza dorada solo aparece en la Noche de brujas.",
  far: "Arrímate a la calabaza.",
  done: "Tu calabaza dorada de este año ya la tienes. ¡Que otro la encuentre!",
  full: "No te cabe la calabaza en la mochila.",
  busy: "Un momentico…",
};

// ---------- El puesto del festival ----------

/** El sombrero de bruja de recuerdo (va en la mano; el de verdad se pone en el vestidor, gratis). */
export const SOMBRERO_BRUJA = "sombrero-bruja";

export interface BrujasShopItem {
  /** Id del objeto de la mochila (sin `obj:`) y de su dibujo en items.ts. */
  id: string;
  name: string;
  price: number;
  /** Cuántas unidades da una compra. */
  gives: number;
}

export const BRUJAS_SHOP = [
  { id: "chocolatina-brujas", name: "Chocolatina de brujas", price: 8, gives: 1 },
  { id: "chupeta", name: "Colombina", price: 6, gives: 1 },
  { id: "bombon", name: "Bombón de chocolate", price: 8, gives: 1 },
  { id: "gomitas", name: "Gomitas", price: 10, gives: 1 },
  { id: "masmelo", name: "Masmelo", price: 6, gives: 1 },
  { id: SOMBRERO_BRUJA, name: "Sombrero de bruja", price: 80, gives: 1 },
] as const satisfies readonly BrujasShopItem[];

export type BrujasShopId = (typeof BRUJAS_SHOP)[number]["id"];
export const brujasShopItem = (id: string): BrujasShopItem | undefined => BRUJAS_SHOP.find((i) => i.id === id);
/** El `refId` de la compra (`PURCHASE`). */
export const brujasRefId = (id: string) => `festival:${BRUJAS.id}:${id}`;

export const BrujasBuyMessage = z.object({ item: z.enum(BRUJAS_SHOP.map((i) => i.id) as [BrujasShopId, ...BrujasShopId[]]) });

export type BrujasBuyError = "off" | "far" | "funds" | "full" | "stack" | "owned" | "busy" | "failed";
export type BrujasBuyResult = { ok: true; item: string; balance: number } | { ok: false; item: string; error: BrujasBuyError };

export const BRUJAS_BUY_ERROR_TEXT: Record<BrujasBuyError, string> = {
  off: "El puesto abre solo en la Noche de brujas.",
  far: "Arrímate al puesto del caldero.",
  funds: "No te alcanzan los puntos.",
  full: "La mochila está llena.",
  stack: "Ya llevas muchos de esos.",
  owned: "Ese sombrero ya es tuyo.",
  busy: "Un momentico…",
  failed: "No se pudo comprar. Intenta de nuevo.",
};

// ---------- Las cinemáticas ----------

export const BRUJAS_CINE = {
  calabaza: "brujas-calabaza",
  truco: (t: Truco) => `brujas-truco-${t}`,
} as const;

/** Las cinemáticas cortas de la Noche de brujas (se suman al catálogo de cinemáticas). */
export const BRUJAS_CINEMATICAS: readonly CineDef[] = [
  {
    id: BRUJAS_CINE.calabaza,
    kind: "momento",
    steps: [
      { op: "flash", color: "oro", ms: 450 },
      { op: "sound", sound: "magia" },
      { op: "fx", fx: "estrellas", who: "yo" },
      { op: "emote", who: "yo", emote: "star" },
      { op: "title", text: "¡La calabaza dorada!", sub: "La encontraste en el laberinto", ms: 2800 },
    ],
  },
  {
    id: BRUJAS_CINE.truco("fantasma"),
    kind: "momento",
    steps: [
      { op: "fade", to: "black", ms: 250 },
      { op: "sound", sound: "brisa" },
      { op: "fade", to: "clear", ms: 250 },
      { op: "emote", who: "yo", emote: "surprise" },
      { op: "title", text: "¡Buuuu!", sub: "Truco: un fantasma te pasó por el lado", ms: 2200 },
    ],
  },
  {
    id: BRUJAS_CINE.truco("trueno"),
    kind: "momento",
    steps: [
      { op: "flash", color: "blanco", ms: 220 },
      { op: "sound", sound: "trueno" },
      { op: "shake", ms: 450, strength: 0.006 },
      { op: "emote", who: "yo", emote: "surprise" },
      { op: "title", text: "¡Truco!", sub: "Un trueno justo encima de tu cabeza", ms: 2200 },
    ],
  },
  {
    id: BRUJAS_CINE.truco("arana"),
    kind: "momento",
    steps: [
      { op: "shake", ms: 300, strength: 0.003 },
      { op: "emote", who: "yo", emote: "cry" },
      { op: "title", text: "¡Truco!", sub: "Te cayó una araña de lana en el hombro", ms: 2200 },
    ],
  },
  {
    id: BRUJAS_CINE.truco("carcajada"),
    kind: "momento",
    steps: [
      { op: "flash", color: "rosa", ms: 300 },
      { op: "sound", sound: "magia" },
      { op: "emote", who: "yo", emote: "question" },
      { op: "title", text: "¡Jijijiji!", sub: "Truco: una carcajada de bruja y ni un dulce", ms: 2200 },
    ],
  },
];
