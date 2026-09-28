// La mochila, estilo Stardew: 3 filas de 12 casillas. Guarda los muebles de la tienda (id = el tipo del
// catálogo) y todo lo que se agarra: lo de la cafetería, el bar y el cine, lo gratis de la casa, lo que se
// cosecha, las semillas y la regadera (id `obj:<id>`, con <id> un dibujo de packages/map/src/art/items.ts).
// La barra de abajo muestra una fila; la casilla elegida es lo que se lleva en la mano (`Player.held`).
// El orden de las casillas lo guarda el servidor (UserStat con la clave `bolsa:<itemId>`).
import { z } from "zod";
import { BAR_MENU, CAFE_MENU, CINEMA_MENU, heldParts } from "./cafe";
import { FREE_NAMES } from "./casa";
import { RECIPES } from "./cocina";
import { CONSUMABLES } from "./consumables";
import { CROPS, EMPTY_CAN, HONEY, HUERTO, HUERTO_TOOLS, WATERING_CAN, seedsOf } from "./huerto";
import { shopItem } from "./shop";
import type { ItemStack } from "./social";

export const BAG = {
  cols: 12,
  rows: 3,
  slots: 36,
  /** Lo más que cabe de una misma cosa (una pila), si su entrada no dice otra cosa. */
  stackMax: 99,
} as const;

/** Los objetos que no son muebles van en InventoryItem con este prefijo. */
export const OBJ_PREFIX = "obj:";
export const objItemId = (id: string) => `${OBJ_PREFIX}${id}`;
/** El id del dibujo de un objeto de la mochila, o null si es un mueble. */
export const objIdOf = (itemId: string): string | null => (itemId.startsWith(OBJ_PREFIX) ? itemId.slice(OBJ_PREFIX.length) : null);

/** Clave de UserStat con la casilla (0..35) de cada cosa de la mochila. */
export const BAG_SLOT_PREFIX = "bolsa:";

// ---------- Registro de objetos ----------

export type BagKind = "bebida" | "comida" | "fumar" | "cosecha" | "semillas" | "herramienta" | "objeto";

export const BAG_KIND_LABEL: Record<BagKind | "mueble", string> = {
  bebida: "Bebida",
  comida: "Comida",
  fumar: "Para fumar",
  cosecha: "Cosecha",
  semillas: "Semillas",
  herramienta: "Herramienta",
  objeto: "Objeto",
  mueble: "Mueble",
};

export interface BagObject {
  name: string;
  blurb?: string;
  kind: BagKind;
  /** Lo más que se lleva de esto (si no, BAG.stackMax). */
  max?: number;
  /** No se gasta al usarlo (la regadera: se vacía, pero sigue en la mochila). */
  durable?: true;
}

const KIND_OF_MENU = { drink: "bebida", food: "comida", smoke: "fumar", combo: "comida" } as const satisfies Record<string, BagKind>;

/** Lo de las cartas: cada cosa que queda en la mano (los combos se guardan por partes). */
function fromMenus(): Record<string, BagObject> {
  const out: Record<string, BagObject> = {};
  for (const item of [...CAFE_MENU, ...BAR_MENU, ...CINEMA_MENU]) {
    const holds: readonly string[] = item.holds;
    // El nombre sale del producto suelto de la carta (el combo "onces" no nombra al tinto).
    if (holds.length !== 1 || out[holds[0]!]) continue;
    const art = holds[0]!;
    out[art] = { name: item.name, blurb: item.blurb, kind: KIND_OF_MENU[item.kind] };
  }
  return out;
}

const FREE_BLURB: Record<string, string> = {
  jugo: "De la nevera de la casa, bien frío.",
  aguapanela: "De la cafetera de la casa. Calientita.",
  manzana: "Roja y crocante, de la nevera.",
  banano: "Maduro, de la nevera.",
  malvavisco: "Dorado en la fogata del jardín.",
  [HONEY]: "De las colmenas del apiario.",
};

/** Lo gratis de la casa, lo del huerto y los platos (menos la regadera vacía: es la misma regadera sin agua). */
function fromHouseAndGarden(): Record<string, BagObject> {
  const out: Record<string, BagObject> = {};
  for (const [id, name] of Object.entries(FREE_NAMES)) {
    if (id === EMPTY_CAN || id === WATERING_CAN) continue;
    out[id] = { name, blurb: FREE_BLURB[id], kind: "comida" };
  }
  for (const c of CROPS) {
    out[c.product] = {
      name: c.productName,
      blurb: `Cosechado en ${c.indoor ? "el invernadero" : "el huerto"}.`,
      kind: c.product === "cafe-casa" ? "bebida" : "cosecha",
    };
    out[seedsOf(c.id)] = {
      name: `Semillas de ${c.name.toLowerCase()}`,
      blurb: `Cada bolsa siembra ${HUERTO.seedUses} ${c.indoor ? "bancales del invernadero" : "parcelas del huerto"}.`,
      kind: "semillas",
      max: 10,
    };
  }
  out[HONEY] = { name: FREE_NAMES[HONEY] ?? "Miel", blurb: FREE_BLURB[HONEY], kind: "comida" };
  // Los platos de la cocina (la estufa de la planta baja).
  for (const r of RECIPES) out[r.id] = { name: r.name, blurb: r.blurb, kind: r.action === "sip" ? "bebida" : "comida" };
  out[WATERING_CAN] = {
    name: "Regadera",
    blurb: `Se llena en el barril de agua o en el pozo y alcanza para ${HUERTO.canUses} riegos.`,
    kind: "herramienta",
    max: 1,
    durable: true,
  };
  return out;
}

/**
 * Todo lo que se guarda en la mochila y no es un mueble. Para sumar algo nuevo (huevos, harina, lo de la
 * parrilla, la mercancía de alguien): una entrada acá con su dibujo en items.ts; si se come o se toma,
 * también en CONSUMABLES (consumables.ts). Lo que no esté acá se muestra con un nombre sacado del id.
 */
export const BAG_OBJECTS: Record<string, BagObject> = {
  ...fromMenus(),
  ...fromHouseAndGarden(),
  // ---------- Lo que agreguen otras ramas va acá ----------
};

/** "huevo-criollo" → "Huevo criollo": el nombre de algo que no está en el registro. */
export function nameFromId(id: string): string {
  const s = id.replace(/^obj:/, "").replace(/[-_]+/g, " ").trim();
  return s ? s[0]!.toUpperCase() + s.slice(1) : "Objeto";
}

export interface BagItemInfo {
  itemId: string;
  name: string;
  blurb: string;
  kind: BagKind | "mueble";
  /** Lo más que se lleva de esto. */
  max: number;
  furniture: boolean;
  /** Id del dibujo (items.ts) de un objeto; el tipo del catálogo si es un mueble. */
  art: string;
  /** `consume`: se come, se toma o se fuma con F; `tool`: la usa el huerto (E); null: solo se lleva. */
  use: "consume" | "tool" | null;
  durable: boolean;
}

/** Cómo se muestra y se comporta cualquier cosa de la mochila (nunca falla: lo desconocido tiene nombre). */
export function bagItemInfo(itemId: string): BagItemInfo {
  const id = objIdOf(itemId);
  if (id === null) {
    const shop = shopItem(itemId);
    return {
      itemId,
      name: shop?.name ?? nameFromId(itemId),
      blurb: shop?.blurb ?? "",
      kind: "mueble",
      max: Infinity,
      furniture: true,
      art: itemId,
      use: null,
      durable: true,
    };
  }
  const o = BAG_OBJECTS[id];
  return {
    itemId,
    name: o?.name ?? nameFromId(id),
    blurb: o?.blurb ?? "",
    kind: o?.kind ?? "objeto",
    max: o?.max ?? BAG.stackMax,
    furniture: false,
    art: id,
    use: Object.hasOwn(HUERTO_TOOLS, id) ? "tool" : Object.hasOwn(CONSUMABLES, id) ? "consume" : null,
    durable: Boolean(o?.durable),
  };
}

/** Lo que se ve en las manos por algo que se lleva: lo de las cartas y la casa, o el objeto mismo. */
export function handParts(id: string): readonly string[] {
  if (!id) return [];
  const parts = heldParts(id);
  return parts.length ? parts : [id];
}

/**
 * Las cosas que suma a la mochila algo pedido en una carta o dado gratis: cada parte por separado (el
 * combo de las onces es un tinto y un pandebono).
 */
export function bagItemsOf(menuOrFreeId: string): string[] {
  return heldParts(menuOrFreeId).map(objItemId);
}

// ---------- Casillas ----------

/** Las 36 casillas: lo que hay en cada una (null = vacía). */
export type BagSlots = (ItemStack | null)[];

/**
 * Acomoda lo que hay en la mochila: cada cosa en su casilla guardada (si es válida y está libre) y lo
 * nuevo en la primera casilla libre (`assigned`, para guardarlo). Lo que no cabe queda en `overflow`
 * (nunca se pierde: se ve en el menú y se puede arrastrar a una casilla que se libere).
 */
export function arrangeBag(
  stacks: readonly ItemStack[],
  saved: Readonly<Record<string, number>>,
): { slots: BagSlots; overflow: ItemStack[]; assigned: Record<string, number> } {
  const slots: BagSlots = Array.from({ length: BAG.slots }, () => null);
  const rest: ItemStack[] = [];
  for (const s of stacks) {
    if (s.quantity <= 0) continue;
    const at = saved[s.itemId];
    if (at !== undefined && Number.isInteger(at) && at >= 0 && at < BAG.slots && !slots[at]) slots[at] = { ...s };
    else rest.push(s);
  }
  const assigned: Record<string, number> = {};
  const overflow: ItemStack[] = [];
  for (const s of rest) {
    const free = slots.indexOf(null);
    if (free < 0) {
      overflow.push({ ...s });
      continue;
    }
    slots[free] = { ...s };
    assigned[s.itemId] = free;
  }
  return { slots, overflow, assigned };
}

/** Fila (0..2) y columna (0..11) de una casilla. */
export const bagRow = (slot: number) => Math.floor(slot / BAG.cols);
export const bagCol = (slot: number) => slot % BAG.cols;

/** Tab: la misma columna en la fila siguiente (después de la última vuelve a la primera). */
export const nextBagRow = (slot: number, step: 1 | -1 = 1) => ((bagRow(slot) + step + BAG.rows) % BAG.rows) * BAG.cols + bagCol(slot);

/** Las teclas de la barra: 1–9, 0, - e = eligen las casillas 1 a 12 de la fila que se ve. */
export const BAG_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="] as const;

// ---------- Mensajes ----------

export const BAG_MSG = {
  /** Servidor → dueño: cómo está su mochila (`BagView`). */
  state: "bag:state",
  /** Cliente → servidor: elegir la casilla de la barra (`BagSelectMessage`). */
  select: "bag:select",
  /** Cliente → servidor: llevar algo a otra casilla (intercambia con lo que hubiera) (`BagMoveMessage`). */
  move: "bag:move",
  /** Cliente → servidor: tirar unidades de un objeto (`BagDropMessage`; los muebles no se tiran). */
  drop: "bag:drop",
  /** Servidor → quien lo intentó: por qué no (la mochila llena, el tope de una pila). */
  notice: "bag:notice",
} as const;

const Slot = z
  .number()
  .int()
  .min(0)
  .max(BAG.slots - 1);
// Como `ItemId` de social.ts (que importa este archivo para los nombres: así no hay ciclo).
const ItemId = z.string().regex(/^[a-z0-9][a-z0-9:_-]{0,63}$/, "Objeto inválido");

export const BagSelectMessage = z.object({ slot: Slot });
export type BagSelectMessage = z.infer<typeof BagSelectMessage>;

export const BagMoveMessage = z.object({ itemId: ItemId, to: Slot });
export type BagMoveMessage = z.infer<typeof BagMoveMessage>;

export const BagDropMessage = z.object({ itemId: ItemId, quantity: z.number().int().min(1).max(999) });
export type BagDropMessage = z.infer<typeof BagDropMessage>;

export interface BagView {
  slots: BagSlots;
  overflow: ItemStack[];
  /** La casilla elegida (lo que está en la mano). */
  selected: number;
  /**
   * La eligió el servidor (al entrar, o porque llegó algo con las manos libres): el cliente la adopta.
   * Si no, el cliente sigue con la suya (así la rueda del mouse no salta con respuestas atrasadas).
   */
  pick?: true;
}

export type BagNoticeCode = "full" | "stack" | "furniture";

export const BAG_NOTICES: Record<BagNoticeCode, string> = {
  full: "No te cabe en la mochila: haz espacio (tira algo o pon un mueble en tu oficina).",
  stack: "Ya llevas lo más que se puede de eso.",
  furniture: "Los muebles no se tiran: ponlos en tu oficina con Decorar.",
};

export interface BagNotice {
  code: BagNoticeCode;
}
