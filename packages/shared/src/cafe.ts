// Fase 3a: el menú de la cafetería. Lo que pides en la barra lo llevas en la mano un rato y todos lo
// ven. Solo es decorativo: no da puntos ni ventajas.
import { z } from "zod";

export const CAFE_MENU = [
  { id: "tinto", name: "Tinto", price: 3, kind: "drink", blurb: "Café negro, pequeño y bien cargado." },
  { id: "cafe-leche", name: "Café con leche", price: 5, kind: "drink", blurb: "En taza grande, para la mañana." },
  { id: "aromatica", name: "Aromática", price: 4, kind: "drink", blurb: "Infusión de frutas y hierbabuena." },
  { id: "chocolate", name: "Chocolate con queso", price: 8, kind: "drink", blurb: "Caliente, con su tajada de queso." },
  { id: "pandebono", name: "Pandebono", price: 5, kind: "food", blurb: "Recién salido del horno." },
  { id: "bunuelo", name: "Buñuelo", price: 5, kind: "food", blurb: "Redondo, dorado y crocante." },
  { id: "torta", name: "Torta de tres leches", price: 12, kind: "food", blurb: "Para celebrar algo (o nada)." },
] as const;

export type CafeItem = (typeof CAFE_MENU)[number];
export type CafeItemId = CafeItem["id"];
export const CAFE_ITEM_IDS = CAFE_MENU.map((i) => i.id) as [CafeItemId, ...CafeItemId[]];

export function cafeItem(id: string): CafeItem | undefined {
  return CAFE_MENU.find((i) => i.id === id);
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
