// Fase 3a: el menú de la cafetería. Lo que pides en la barra lo llevas en la mano un rato (los combos,
// una cosa en cada mano) y todos lo ven. Solo es decorativo: no da puntos ni ventajas.
import { z } from "zod";

/**
 * `holds`: lo que queda en las manos (los combos son dos cosas, una en cada mano). Cada id de `holds`
 * tiene su dibujo en packages/map/src/art/items.ts.
 */
export const CAFE_MENU = [
  { id: "tinto", name: "Tinto", price: 3, kind: "drink", holds: ["tinto"], blurb: "Café negro, pequeño y bien cargado." },
  { id: "cafe-leche", name: "Café con leche", price: 5, kind: "drink", holds: ["cafe-leche"], blurb: "En taza grande, para la mañana." },
  { id: "aromatica", name: "Aromática", price: 4, kind: "drink", holds: ["aromatica"], blurb: "Infusión de frutas y hierbabuena." },
  { id: "chocolate", name: "Chocolate con queso", price: 8, kind: "drink", holds: ["chocolate"], blurb: "Caliente, con su tajada de queso." },
  { id: "coca-cola", name: "Coca-Cola", price: 5, kind: "drink", holds: ["coca-cola"], blurb: "Bien fría, en lata." },
  { id: "pandebono", name: "Pandebono", price: 5, kind: "food", holds: ["pandebono"], blurb: "Recién salido del horno." },
  { id: "bunuelo", name: "Buñuelo", price: 5, kind: "food", holds: ["bunuelo"], blurb: "Redondo, dorado y crocante." },
  { id: "torta", name: "Torta de tres leches", price: 12, kind: "food", holds: ["torta"], blurb: "Para celebrar algo (o nada)." },
  { id: "cigarro", name: "Cigarro", price: 4, kind: "smoke", holds: ["cigarro"], blurb: "Para la pausa en el porche." },
  {
    id: "desayuno-tinto",
    name: "Desayuno: tinto y cigarro",
    price: 6,
    kind: "combo",
    holds: ["tinto", "cigarro"],
    blurb: "El desayuno de campeones (sale más barato).",
  },
  {
    id: "desayuno-coca",
    name: "Desayuno: Coca-Cola y cigarro",
    price: 8,
    kind: "combo",
    holds: ["coca-cola", "cigarro"],
    blurb: "La versión fría del desayuno (sale más barato).",
  },
] as const;

export type CafeItem = (typeof CAFE_MENU)[number];
export type CafeItemId = CafeItem["id"];
export const CAFE_ITEM_IDS = CAFE_MENU.map((i) => i.id) as [CafeItemId, ...CafeItemId[]];

export function cafeItem(id: string): CafeItem | undefined {
  return CAFE_MENU.find((i) => i.id === id);
}

/** Lo que se ve en las manos por un pedido (vacío si el id no es del menú). */
export function heldParts(id: string): readonly string[] {
  return cafeItem(id)?.holds ?? [];
}

export const CAFE = {
  /** Cuánto tiempo llevas en la mano lo que pediste. */
  heldMs: 30 * 60_000,
  /** Tiempo mínimo entre dos pedidos de la misma persona (evita dobles clics). */
  orderCooldownMs: 1500,
} as const;

/** `refId` de un movimiento de puntos por una compra en la cafetería. */
export const cafeRefId = (item: CafeItemId) => `cafe:${item}`;

/** Cliente → servidor: pedir algo en la barra (hay que estar junto a ella). */
export const CafeOrderMessage = z.object({ item: z.enum(CAFE_ITEM_IDS) });
export type CafeOrderMessage = z.infer<typeof CafeOrderMessage>;

/** Servidor → cliente: resultado del pedido. */
export type CafeOrderResult =
  | { ok: true; item: CafeItemId; balance: number }
  | { ok: false; item: CafeItemId; error: "far" | "funds" | "busy" | "failed" };
