// Fase 3b: la tienda. Qué se vende, a cuánto, y cómo se llama cada cosa en el inventario.
// Muebles: el id es el tipo del catálogo de packages/map (p. ej. "plant"). Ropa: "hair:<peinado>",
// "acc:<accesorio>" u "outfit:<conjunto>" (ver look.ts).
import { z } from "zod";
import { FREE_ACCESSORIES, FREE_HAIR_STYLES, type Accessory, type HairStyle, type Look, type Outfit } from "./look";

export type ShopCategory = "furniture" | "clothing";

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  category: ShopCategory;
  blurb: string;
}

const furniture = (id: string, name: string, price: number, blurb: string): ShopItem => ({ id, name, price, category: "furniture", blurb });
const clothing = (id: string, name: string, price: number, blurb: string): ShopItem => ({ id, name, price, category: "clothing", blurb });

/** Muebles a la venta (para decorar tu oficina con el editor). */
export const SHOP_FURNITURE: readonly ShopItem[] = [
  furniture("cactus", "Cactus", 20, "No pide agua ni atención."),
  furniture("chair", "Silla", 20, "La de siempre, para una visita."),
  furniture("plant", "Planta", 25, "Un poco de verde en la esquina."),
  furniture("side-table", "Mesita", 25, "Para dejar el tinto."),
  furniture("coffee-table", "Mesa de centro", 30, "Para la zona de estar."),
  furniture("coat-rack", "Perchero", 30, "Para la chaqueta y el paraguas."),
  furniture("rug-2x3", "Alfombra verde", 35, "Mullida, de 2x3."),
  furniture("monstera", "Monstera", 40, "Hojas grandes y tropicales."),
  furniture("lamp", "Lámpara de pie", 40, "Luz cálida para la noche."),
  furniture("rug-round", "Alfombra redonda", 45, "Tejida a mano, de 2x2."),
  furniture("rug-stripes", "Alfombra de rayas", 45, "Colores de feria, de 2x3."),
  furniture("bookshelf-low", "Estantería baja", 45, "Libros y una planta encima."),
  furniture("armchair", "Sillón", 50, "Para leer un rato."),
  furniture("rug-3x3", "Alfombra grande", 50, "La clásica, de 3x3."),
  furniture("globe", "Globo terráqueo", 50, "Para planear el próximo viaje."),
  furniture("beanbag", "Puf", 55, "Para hundirse en él."),
  furniture("bookshelf", "Estantería", 60, "Alta y llena de libros."),
  furniture("lamp-mushroom", "Lámpara hongo", 60, "Brilla de noche como en el bosque."),
  furniture("easel", "Caballete", 65, "Con un paisaje a medio pintar."),
  furniture("bonsai", "Bonsái", 70, "Paciencia en una maceta."),
  furniture("record-player", "Tocadiscos", 80, "Vinilos de los de antes."),
  furniture("sofa", "Sofá", 90, "Para dos."),
  furniture("guitar", "Guitarra", 90, "En su soporte, lista para tocar."),
  furniture("cat-bed", "Cama con gato", 120, "El gato viene incluido."),
  furniture("tv-retro", "Tele con consola", 150, "Para la hora del almuerzo."),
  furniture("aquarium", "Pecera", 180, "Con peces de colores; brilla de noche."),
  furniture("piano", "Piano", 250, "Vertical, de madera."),
];

/** Ropa a la venta (se prueba y se compra en el probador). Lo gratis no aparece aquí. */
export const SHOP_CLOTHING: readonly ShopItem[] = [
  clothing("acc:flower", "Flor en el pelo", 30, "Una flor del huerto."),
  clothing("acc:scarf", "Bufanda", 40, "Del color de tu acento."),
  clothing("acc:beanie", "Gorro de lana", 50, "Para las mañanas frías."),
  clothing("hair:ponytail", "Cola de caballo", 60, "Práctica y con movimiento."),
  clothing("outfit:apron", "Delantal", 60, "Como el de la cafetería."),
  clothing("acc:straw-hat", "Sombrero de paja", 70, "Para el jardín."),
  clothing("hair:braids", "Trenzas", 80, "Dos trenzas largas."),
  clothing("hair:afro", "Afro", 80, "Grande y redondo."),
  clothing("outfit:overalls", "Overol", 120, "Con el color de tu pantalón."),
  clothing("outfit:dress", "Vestido", 120, "Con el color de tu camisa."),
  clothing("outfit:jacket", "Chaqueta", 150, "Con el color de tu acento."),
];

export const SHOP_ITEMS: readonly ShopItem[] = [...SHOP_FURNITURE, ...SHOP_CLOTHING];

export function shopItem(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.id === id);
}

/** Id de inventario de cada prenda. */
export const clothingId = {
  hair: (s: HairStyle) => `hair:${s}`,
  acc: (a: Accessory) => `acc:${a}`,
  outfit: (o: Outfit) => `outfit:${o}`,
};

/** Prendas de pago que usa un look (ids de inventario). */
export function paidClothingIn(look: Look): string[] {
  const ids: string[] = [];
  if (!FREE_HAIR_STYLES.includes(look.hairStyle)) ids.push(clothingId.hair(look.hairStyle));
  for (const a of look.accessories) if (!FREE_ACCESSORIES.includes(a)) ids.push(clothingId.acc(a));
  if (look.outfit) ids.push(clothingId.outfit(look.outfit));
  return ids;
}

/** Prendas de pago que usa el look y la persona no tiene (vacío = puede guardarlo). */
export function missingClothing(look: Look, owned: Iterable<string>): string[] {
  const have = new Set(owned);
  return paidClothingIn(look).filter((id) => !have.has(id));
}

/** `refId` de un movimiento de puntos por una compra en la tienda. */
export const shopRefId = (itemId: string) => `shop:${itemId}`;

/** Máximo de unidades de un mueble por compra (la ropa siempre es 1 y no se compra dos veces). */
export const SHOP_MAX_QUANTITY = 10;

/** POST /api/shop/buy */
export const ShopBuyBody = z.object({
  itemId: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(SHOP_MAX_QUANTITY).default(1),
});
export type ShopBuyBody = z.infer<typeof ShopBuyBody>;

/** Lo que alguien tiene guardado (muebles sin poner y ropa comprada). */
export interface InventoryEntry {
  itemId: string;
  quantity: number;
}
