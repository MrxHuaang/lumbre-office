// Fase 3a: el menú de la cafetería (y, con el rediseño, la carta del bar del club). Lo que pides en la
// barra lo llevas en la mano un rato (los combos, una cosa en cada mano), todos lo ven y se usa con F
// (ver consumables.ts). Solo es decorativo: no da puntos ni ventajas.
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

/**
 * Rediseño: la carta del bar del club (sótano). Mismo sistema que la cafetería: se pide junto a la barra
 * (punto `club_bar`), se paga con puntos y queda en la mano. Los ids no se repiten con los de la cafetería
 * (lo que llevas en la mano se guarda por id, venga de donde venga).
 */
export const BAR_MENU = [
  { id: "cerveza", name: "Cerveza", price: 6, kind: "drink", holds: ["cerveza"], blurb: "Rubia, bien fría y con espuma." },
  { id: "vino", name: "Copa de vino", price: 9, kind: "drink", holds: ["vino"], blurb: "Tinto de la casa, en copa." },
  { id: "coctel", name: "Cóctel de la casa", price: 12, kind: "drink", holds: ["coctel"], blurb: "Con sombrillita y cereza." },
  { id: "whisky", name: "Whisky en las rocas", price: 14, kind: "drink", holds: ["whisky"], blurb: "Dos hielos, sin prisa." },
  { id: "cigarro-club", name: "Cigarro", price: 4, kind: "smoke", holds: ["cigarro"], blurb: "Para acompañar el trago." },
  { id: "habano", name: "Habano", price: 20, kind: "smoke", holds: ["habano"], blurb: "Grande, de hoja oscura. Dura bastante." },
  {
    id: "previa",
    name: "La previa: cerveza y cigarro",
    price: 8,
    kind: "combo",
    holds: ["cerveza", "cigarro"],
    blurb: "Una en cada mano (sale más barato).",
  },
  {
    id: "padrino",
    name: "El padrino: whisky y habano",
    price: 30,
    kind: "combo",
    holds: ["whisky", "habano"],
    blurb: "Para cerrar la noche como se debe.",
  },
] as const;

export type BarItem = (typeof BAR_MENU)[number];
export type BarItemId = BarItem["id"];
export const BAR_ITEM_IDS = BAR_MENU.map((i) => i.id) as [BarItemId, ...BarItemId[]];

export function barItem(id: string): BarItem | undefined {
  return BAR_MENU.find((i) => i.id === id);
}

/** Las dos cartas: dónde se pide cada una (tipo de punto del mapa) y con qué prefijo queda el movimiento. */
export const MENUS = {
  cafe: { point: "cafe_counter", items: CAFE_MENU },
  bar: { point: "club_bar", items: BAR_MENU },
} as const;
export type MenuId = keyof typeof MENUS;
export type MenuItem = CafeItem | BarItem;
export type MenuItemId = MenuItem["id"];

/** Un producto de cualquiera de las cartas, con la carta de la que sale. */
export function menuItem(id: string): (MenuItem & { menu: MenuId }) | undefined {
  const cafe = cafeItem(id);
  if (cafe) return { ...cafe, menu: "cafe" };
  const bar = barItem(id);
  return bar ? { ...bar, menu: "bar" } : undefined;
}

/** Lo que se ve en las manos por un pedido (vacío si el id no es de ninguna carta). */
export function heldParts(id: string): readonly string[] {
  return menuItem(id)?.holds ?? [];
}

export const CAFE = {
  /** Cuánto tiempo llevas en la mano lo que pediste. */
  heldMs: 30 * 60_000,
  /** Tiempo mínimo entre dos pedidos de la misma persona (evita dobles clics). */
  orderCooldownMs: 1500,
} as const;

/** `refId` de un movimiento de puntos por una compra en la cafetería. */
export const cafeRefId = (item: CafeItemId) => `cafe:${item}`;
/** `refId` de una compra en el bar del club. */
export const barRefId = (item: BarItemId) => `bar:${item}`;
/** `refId` de una compra en cualquiera de las dos barras ("cafe:tinto", "bar:whisky"). */
export const menuRefId = (item: MenuItemId) => `${menuItem(item)?.menu ?? "cafe"}:${item}`;

/** Cliente → servidor: pedir algo en la barra (hay que estar junto a ella). */
export const CafeOrderMessage = z.object({ item: z.enum(CAFE_ITEM_IDS) });
export type CafeOrderMessage = z.infer<typeof CafeOrderMessage>;

/** Cliente → servidor: pedir en la barra del club (hay que estar junto a ella). */
export const BarOrderMessage = z.object({ item: z.enum(BAR_ITEM_IDS) });
export type BarOrderMessage = z.infer<typeof BarOrderMessage>;

/** Servidor → cliente: resultado del pedido (en la cafetería o en el bar; `item` dice de cuál). */
export type CafeOrderResult =
  | { ok: true; item: MenuItemId; balance: number }
  | { ok: false; item: MenuItemId; error: "far" | "funds" | "busy" | "failed" };
