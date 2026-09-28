// La máquina de peluches del arcade (sótano). Cada intento cuesta puntos (se compra, motivo PURCHASE). El
// servidor arma la vitrina con una semilla (qué peluche va en cada puesto), el navegador mueve la garra y
// la suelta; el servidor mide cuánto tardó (ni antes de lo que tarda en bajar ni después de que se acaba el
// tiempo) y decide con su azar si agarra, según qué tan centrada cayó sobre un peluche. El premio va a la
// mochila (`obj:peluche-<animal>`) y se puede regalar como lo demás. Aquí van las reglas; la sala está en
// apps/server/src/rooms/garra.ts.
import { z } from "zod";
import type { BagObject } from "./bolsa";
import { PRINTED_SHEET } from "./mundo";

export type PlushRarity = "comun" | "raro" | "especial";

export interface Plush {
  /** Id del dibujo en items.ts (y del objeto de la mochila: `obj:<id>`). */
  id: string;
  name: string;
  blurb: string;
  rarity: PlushRarity;
  /** Peso al armar la vitrina (los raros salen menos). */
  weight: number;
}

export const PLUSHES: readonly Plush[] = [
  { id: "peluche-oso", name: "Osito de peluche", blurb: "Café, blandito y con moñito rojo. El clásico.", rarity: "comun", weight: 24 },
  { id: "peluche-gato", name: "Gatico de peluche", blurb: "Mira con desdén, como los de verdad.", rarity: "comun", weight: 22 },
  { id: "peluche-rana", name: "Ranita de peluche", blurb: "Verde, cachetona y siempre sonriendo.", rarity: "comun", weight: 20 },
  { id: "peluche-conejo", name: "Conejito de peluche", blurb: "Orejas largas para escuchar chismes.", rarity: "comun", weight: 18 },
  { id: "peluche-pulpo", name: "Pulpito de peluche", blurb: "Ocho brazos para abrazar a la vez.", rarity: "raro", weight: 9 },
  { id: "peluche-oveja", name: "Ovejita de peluche", blurb: "Esponjosa como nube de sabana.", rarity: "raro", weight: 8 },
  { id: "peluche-capibara", name: "Chigüiro de peluche", blurb: "El más tranquilo del llano. Nada lo afana.", rarity: "especial", weight: 3 },
];

export const PLUSH_IDS: readonly string[] = PLUSHES.map((p) => p.id);
export const plushById = (id: string) => PLUSHES.find((p) => p.id === id);
export const PLUSH_RARITY_TEXT: Record<PlushRarity, string> = { comun: "Común", raro: "Raro", especial: "Especial" };

export const GARRA = {
  /** Lo que cuesta un intento (puntos, PURCHASE). */
  price: 10,
  /** Puestos de la vitrina (de izquierda a derecha) y el ancho del recorrido de la garra (0..1). */
  slots: 5,
  /** Lo mínimo que tarda la garra en bajar desde que empieza el intento (ms): soltar antes no vale. */
  minMs: 1_200,
  /** Tiempo para soltar la garra: pasado esto, baja sola donde esté (y se valida igual). */
  maxMs: 20_000,
  /** Probabilidad de agarrar (en milésimas) cayendo justo encima de un peluche y a medio puesto de distancia. */
  gripCenterPerMil: 420,
  gripEdgePerMil: 60,
  /** Los raros y el especial se resbalan más (multiplica la probabilidad). */
  rarityGrip: { comun: 1, raro: 0.7, especial: 0.45 } satisfies Record<PlushRarity, number>,
  /** Pausa entre dos intentos de la misma persona. */
  cooldownMs: 1_500,
} as const;

/** Azar repetible con una semilla (el mismo que usa el arcade), para que la vitrina se vea igual en todos lados. */
function seededRand(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Qué peluche hay en cada puesto de la vitrina con esa semilla (los raros salen menos). */
export function clawLayout(seed: number): string[] {
  const rand = seededRand(seed);
  const total = PLUSHES.reduce((t, p) => t + p.weight, 0);
  return Array.from({ length: GARRA.slots }, () => {
    let r = rand() * total;
    for (const p of PLUSHES) {
      r -= p.weight;
      if (r < 0) return p.id;
    }
    return PLUSHES[0]!.id;
  });
}

/** Centro de cada puesto en el recorrido de la garra (0..1). */
export const clawSlotCenter = (i: number) => (i + 0.5) / GARRA.slots;

/**
 * Sobre qué puesto cae la garra soltada en `x` (0..1) y con qué probabilidad agarra (milésimas): justo en
 * el centro, la mejor; en el borde del puesto, casi nada.
 */
export function clawGrip(layout: readonly string[], x: number): { slot: number; plush: string; perMil: number } {
  const cx = Math.max(0, Math.min(1, x));
  const slot = Math.min(GARRA.slots - 1, Math.floor(cx * GARRA.slots));
  const plush = layout[slot] ?? PLUSHES[0]!.id;
  // 0 en el centro del puesto, 1 en su borde.
  const off = Math.min(1, Math.abs(cx - clawSlotCenter(slot)) * GARRA.slots * 2);
  const base = GARRA.gripCenterPerMil + (GARRA.gripEdgePerMil - GARRA.gripCenterPerMil) * off;
  const rarity = plushById(plush)?.rarity ?? "comun";
  return { slot, plush, perMil: Math.round(base * GARRA.rarityGrip[rarity]) };
}

// ---------- Mensajes ----------

export const GARRA_MSG = {
  /** Cliente → servidor: empezar un intento (hay que estar junto a una máquina; se cobra acá). */
  start: "garra:start",
  /** Cliente → servidor: soltar la garra en `x` (0..1) del intento `token`. */
  drop: "garra:drop",
  /** Servidor → quien juega: empezó (la semilla de la vitrina) o cómo terminó. */
  event: "garra:event",
} as const;

export const ClawDropMessage = z.object({ token: z.string().min(1).max(64), x: z.number().min(0).max(1) });
export type ClawDropMessage = z.infer<typeof ClawDropMessage>;

export type ClawError = "far" | "funds" | "busy" | "full" | "expired" | "failed";

export type ClawEvent =
  | { kind: "started"; token: string; seed: number; balance: number }
  | { kind: "result"; token: string; slot: number; plush: string; won: boolean; x: number }
  | { kind: "error"; error: ClawError };

export const CLAW_ERROR_TEXT: Record<ClawError, string> = {
  far: "Acércate a la máquina de peluches.",
  funds: `No te alcanzan los puntos: cada intento cuesta ${GARRA.price}.`,
  busy: "La garra todavía está volviendo. Un momentico.",
  full: "No te cabe un peluche más en la mochila: haz espacio.",
  expired: "Se acabó el intento. Mete otra moneda.",
  failed: "La máquina se trabó. Intenta de nuevo.",
};

/** Los peluches y la hoja impresa en la mochila (se suman a BAG_OBJECTS). */
export const MUNDO_BAG_OBJECTS: Record<string, BagObject> = {
  ...Object.fromEntries(PLUSHES.map((p) => [p.id, { name: p.name, blurb: p.blurb, kind: "objeto" as const, max: 20 }])),
  [PRINTED_SHEET]: { name: "Hoja impresa", blurb: "Tu nota, recién salida de la impresora. Todavía está tibia.", kind: "objeto", max: 20 },
};
