// Fase 3b: la tienda. Qué muebles se venden y a cuánto; el id de cada uno es su tipo en el catálogo de
// packages/map (p. ej. "plant") y es también su id en el inventario. La ropa es toda gratis (vestidor).
import { z } from "zod";

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  blurb: string;
}

const furniture = (id: string, name: string, price: number, blurb: string): ShopItem => ({ id, name, price, blurb });

/** Muebles a la venta (para decorar tu oficina con el editor). */
export const SHOP_FURNITURE: readonly ShopItem[] = [
  furniture("cactus", "Cactus", 20, "No pide agua ni atención."),
  furniture("chair", "Silla", 20, "La de siempre, para una visita."),
  furniture("office-chair", "Silla de oficina", 60, "Con ruedas: da vueltas (R) y marea."),
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
  // Plantas de interior (las mismas que decoran la casa).
  furniture("succulents", "Suculentas", 25, "Tres rosetas y un cactus bolita."),
  furniture("snake-plant", "Lengua de suegra", 30, "Aguanta de todo, hasta el olvido."),
  furniture("column-cactus", "Cactus de columna", 35, "Tres columnas y una flor blanca."),
  furniture("pothos", "Pothos", 35, "Guías que cuelgan hasta el piso."),
  furniture("boston-fern", "Helecho en pedestal", 45, "Una fuente de frondas verdes."),
  furniture("kentia", "Palmera de salón", 50, "En maceta de talavera."),
  furniture("orchid", "Orquídea", 55, "Florecida, sobre su mesita."),
  furniture("fiddle-fig", "Ficus lira", 60, "Hojas grandes y brillantes."),
  furniture("olive-tree", "Olivo", 75, "Un rincón del Mediterráneo."),
  furniture("record-player", "Tocadiscos", 80, "Vinilos de los de antes."),
  furniture("sofa", "Sofá", 90, "Para dos."),
  furniture("guitar", "Guitarra", 90, "En su soporte, lista para tocar."),
  furniture("cat-bed", "Cama con gato", 120, "El gato viene incluido."),
  furniture("tv-retro", "Tele con consola", 150, "Para la hora del almuerzo."),
  furniture("aquarium", "Pecera", 180, "Con peces de colores; brilla de noche."),
  furniture("piano", "Piano", 250, "Vertical, de madera."),
];

export function shopItem(id: string): ShopItem | undefined {
  return SHOP_FURNITURE.find((i) => i.id === id);
}

/** `refId` de un movimiento de puntos por una compra en la tienda. */
export const shopRefId = (itemId: string) => `shop:${itemId}`;

/** Máximo de unidades de un mueble por compra. */
export const SHOP_MAX_QUANTITY = 10;

/** POST /api/shop/buy */
export const ShopBuyBody = z.object({
  itemId: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(SHOP_MAX_QUANTITY).default(1),
});
export type ShopBuyBody = z.infer<typeof ShopBuyBody>;

/** Lo que alguien tiene guardado (muebles sin poner). */
export interface InventoryEntry {
  itemId: string;
  quantity: number;
}
