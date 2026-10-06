// La mochila, estilo Stardew: 3 filas de 12 casillas. Guarda los muebles de la tienda (id = el tipo del
// catálogo) y todo lo que se agarra: lo de la cafetería, el bar y el cine, lo gratis de la casa, lo que se
// cosecha, las semillas y la regadera (id `obj:<id>`, con <id> un dibujo de packages/map/src/art/items.ts).
// La barra de abajo muestra una fila; la casilla elegida es lo que se lleva en la mano (`Player.held`).
// El orden de las casillas lo guarda el servidor (UserStat con la clave `bolsa:<itemId>`).
import { z } from "zod";
import { BAR_MENU, CAFE_MENU, CINEMA_MENU, heldParts } from "./cafe";
import { FREE_NAMES } from "./casa";
import { RECIPES } from "./cocina";
import { GRANJA_BAG_OBJECTS } from "./parrilla";
import { PESCA_BAG_OBJECTS } from "./pesca-tienda";
import { MUNDO_BLURBS, PRINTED_SHEET, sheetNoteIdOf } from "./mundo";
import { MUNDO_BAG_OBJECTS } from "./garra";
import { BRUJAS_BAG_OBJECTS } from "./brujas";
import { CARNAVAL_BAG_OBJECTS } from "./carnaval-objetos";
import { VELITAS_BAG_OBJECTS } from "./velitas";
import { COMETAS_BAG_OBJECTS } from "./cometas";
import { COMETA, cometaCodeOf, cometaName } from "./cometa";
import { AMOR_BAG_OBJECTS } from "./amor-amistad";
import { CONSUMABLES } from "./consumables";
import { STORY_BAG_OBJECTS } from "./historia";
import { CROPS, EMPTY_CAN, HONEY, HUERTO, HUERTO_TOOLS, WATERING_CAN, seedsOf } from "./huerto";
import { paintingIdOf } from "./painting";
import { SILLETA, silletaCodeOf, silletaFlowerCount, silletaName } from "./silleta";
import { shopItem } from "./shop";
import { SOMBRERO_MENU, sombreroItem } from "./sombrero";
import type { ItemStack } from "./social";

/**
 * El celular de tapa. Lo tiene todo el mundo (el servidor lo da gratis al entrar si falta) y no se tira,
 * porque el chat vive en él. El navegador lo saca a la pantalla solo si está en la mochila.
 */
export const CELULAR = "celular";
export const CELULAR_ITEM = `obj:${CELULAR}`;

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
  /** Objeto de historia (una llave, una carta): no se tira, no se regala ni se intercambia (ver historia.ts). */
  story?: true;
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
  // La mercancía del Man del Sombrero (sin `kind` en su carta: se deduce de cómo se usa).
  for (const item of SOMBRERO_MENU) {
    const art = item.holds[0];
    if (art && !out[art]) out[art] = { name: item.name, blurb: item.blurb, kind: "objeto" };
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
  ...MUNDO_BLURBS,
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
      blurb: c.flower ? "Recién cortada del huerto: con flores se arma una silleta en la Feria de las flores." : `Cosechado en ${c.indoor ? "el invernadero" : "el huerto"}.`,
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
  // La granja del jardín: huevos, harina, queso y chorizo, y los platos de la parrilla (parrilla.ts).
  ...GRANJA_BAG_OBJECTS,
  // El puesto de pesca del lago: las cañas de fibra y de carbono y la carnada (pesca-tienda.ts).
  ...PESCA_BAG_OBJECTS,
  // El celular de tapa (components/phone): con C sale a la pantalla.
  [CELULAR]: {
    name: "Celular",
    blurb: "Tu celular de tapa: C lo saca. Ahí están el chat, tus contactos, la culebrita y más.",
    kind: "herramienta",
    max: 1,
    durable: true,
  },
  // Mundo lleno: los peluches de la máquina de garra y la hoja de la impresora (garra.ts).
  ...MUNDO_BAG_OBJECTS,
  // La Noche de brujas: los dulces, la canasta de dulce o truco y la calabaza dorada (brujas.ts).
  ...BRUJAS_BAG_OBJECTS,
  // El Carnaval: la maicena, las serpentinas y las máscaras de recuerdo (carnaval-objetos.ts).
  ...CARNAVAL_BAG_OBJECTS,
  // La Noche de velitas: las velitas y el farol de deseos (velitas.ts).
  ...VELITAS_BAG_OBJECTS,
  // El Festival de cometas: los materiales, el gancho, el raspao y la cometa del techo (cometas.ts).
  ...COMETAS_BAG_OBJECTS,
  // Amor y amistad: lo del puesto de chocolates y flores (amor-amistad.ts).
  ...AMOR_BAG_OBJECTS,
  // Los objetos de la historia, de todos los capítulos (historia.ts: `items` de cada uno).
  ...STORY_BAG_OBJECTS,
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
  /** Objeto de historia: no se tira, no se regala ni se intercambia. */
  story: boolean;
}

/** Cómo se muestra y se comporta cualquier cosa de la mochila (nunca falla: lo desconocido tiene nombre). */
export function bagItemInfo(itemId: string): BagItemInfo {
  const id = objIdOf(itemId);
  if (id === null) {
    // Un cuadro de la Pintura: se cuelga en la oficina como un mueble (su título lo trae /api/paintings).
    if (paintingIdOf(itemId))
      return { itemId, name: "Cuadro", blurb: "Lo pintaste en el PC: cuélgalo en tu oficina con Decorar.", kind: "mueble", max: Infinity, furniture: true, art: itemId, use: null, durable: true, story: false };
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
      story: false,
    };
  }
  // Una silleta de la Feria de las flores: lo que lleva va en el id, y su dibujo sale de ahí.
  const silleta = silletaCodeOf(id);
  if (silleta)
    return {
      itemId,
      name: silletaName(silleta),
      blurb: `Armada a mano con ${silletaFlowerCount(silleta)} flores. En la feria se exhibe en el patio y se vota.`,
      kind: "objeto",
      max: SILLETA.stackMax,
      furniture: false,
      art: id,
      use: null,
      durable: false,
      story: false,
    };
  // Una cometa del Festival de cometas: como la silleta, lo que lleva va en el id.
  const cometa = cometaCodeOf(id);
  if (cometa)
    return {
      itemId,
      name: cometaName(cometa),
      blurb: "Armada a mano en el taller de la loma. Con F se vuela en el voladero; en el festival también se inscribe en el concurso.",
      kind: "objeto",
      max: COMETA.stackMax,
      furniture: false,
      art: id,
      use: null,
      durable: false,
      story: false,
    };
  // La hoja de una nota (`hoja:<noteId>`) es la hoja impresa de siempre: mismo nombre, dibujo y tope.
  const base = sheetNoteIdOf(id) === null ? id : PRINTED_SHEET;
  const o = BAG_OBJECTS[base];
  return {
    itemId,
    name: o?.name ?? nameFromId(base),
    blurb: o?.blurb ?? "",
    kind: o?.kind ?? "objeto",
    max: o?.max ?? BAG.stackMax,
    furniture: false,
    art: base,
    use: Object.hasOwn(HUERTO_TOOLS, base) ? "tool" : Object.hasOwn(CONSUMABLES, base) ? "consume" : null,
    durable: Boolean(o?.durable),
    story: Boolean(o?.story),
  };
}

/** ¿Es un objeto de historia? (no se tira, no se regala ni se intercambia). */
export const isStoryItem = (itemId: string) => bagItemInfo(itemId).story;

/**
 * El nombre que se muestra de algo de la mochila: el título de la nota de una hoja, si el servidor lo mandó
 * (solo llega si quien tiene la hoja la escribió), o el de siempre.
 */
export function bagItemName(itemId: string, titles?: Readonly<Record<string, string>>): string {
  return titles?.[itemId] ?? bagItemInfo(itemId).name;
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
  const parts: readonly string[] = heldParts(menuOrFreeId).length ? heldParts(menuOrFreeId) : (sombreroItem(menuOrFreeId)?.holds ?? []);
  return parts.map(objItemId);
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
  /** Título de cada hoja impresa (itemId → título) de las notas de quien lleva la mochila; las demás no vienen. */
  titles?: Record<string, string>;
  /**
   * La eligió el servidor (al entrar, o porque llegó algo con las manos libres): el cliente la adopta.
   * Si no, el cliente sigue con la suya (así la rueda del mouse no salta con respuestas atrasadas).
   */
  pick?: true;
}

export type BagNoticeCode = "full" | "stack" | "furniture" | "keep" | "story";

export const BAG_NOTICES: Record<BagNoticeCode, string> = {
  full: "No te cabe en la mochila: haz espacio (tira algo o pon un mueble en tu oficina).",
  stack: "Ya llevas lo más que se puede de eso.",
  furniture: "Los muebles no se tiran: ponlos en tu oficina con Decorar.",
  keep: "El celular no se tira: ahí están el chat y tus contactos.",
  story: "Eso es de la historia: no se tira, lo vas a necesitar.",
};

export interface BagNotice {
  code: BagNoticeCode;
}
