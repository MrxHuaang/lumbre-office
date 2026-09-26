// Catálogo de muebles: solo lo que importa al juego (tamaño, colisión, asientos). El dibujo de cada
// uno vive en art/furniture.ts, así el servidor no carga arte.
import type { Facing } from "./types";

export interface CatalogItem {
  name: string;
  /** Tamaño en tiles mirando hacia "right" (+x): `w` a lo largo de x, `d` a lo largo de y. */
  size: [w: number, d: number];
  /** Bloquea el paso (por defecto sí). */
  solid?: boolean;
  /** Tiles de asiento en el marco local "right". Quien se sienta mira hacia el `facing` del mueble. */
  seats?: [number, number][];
  /** Escritorio con computador: la silla que lo mira permite prender el PC. */
  computer?: boolean;
  /** Tiene dibujo de espaldas (para mirar hacia "left"/"up"); si no, se usa el de frente. */
  hasBack?: boolean;
  /** Plano sobre el piso (alfombras): se dibuja debajo de todo. */
  flat?: boolean;
  /** No rota: su dibujo ya está en coordenadas del mundo (escaleras, la cabaña). */
  fixed?: boolean;
  /** Tiene dibujo nocturno propio (p. ej. ventanas encendidas). */
  hasNight?: boolean;
  /** Emite luz de noche: [x, y, z] del foco en unidades de arte relativas al mueble, y color. */
  light?: { at: [number, number, number]; color: string; radius: number };
}

export const CATALOG = {
  "desk-pc": { name: "Escritorio con PC", size: [1, 2], computer: true },
  chair: { name: "Silla", size: [1, 1], seats: [[0, 0]], hasBack: true },
  stool: { name: "Taburete", size: [1, 1], seats: [[0, 0]] },
  armchair: { name: "Sillón", size: [1, 1], seats: [[0, 0]], hasBack: true },
  sofa: { name: "Sofá", size: [1, 2], seats: [[0, 0], [0, 1]], hasBack: true },
  bench: { name: "Banca", size: [1, 2], seats: [[0, 0], [0, 1]], hasBack: true },
  bookshelf: { name: "Estantería", size: [1, 2] },
  plant: { name: "Planta", size: [1, 1] },
  lamp: { name: "Lámpara de pie", size: [1, 1], light: { at: [8, 8, 34], color: "#ffc76a", radius: 44 } },
  "coffee-table": { name: "Mesa de centro", size: [1, 1] },
  "cafe-table": { name: "Mesa de café", size: [1, 1] },
  "meeting-table": { name: "Mesa de reuniones", size: [2, 3] },
  counter: { name: "Barra", size: [1, 1] },
  "counter-coffee": { name: "Barra con cafetera", size: [1, 1] },
  "pastry-case": { name: "Vitrina de pasteles", size: [1, 1] },
  fireplace: { name: "Chimenea", size: [1, 2], light: { at: [6, 16, 8], color: "#ff9a4a", radius: 56 } },
  "rug-3x3": { name: "Alfombra", size: [3, 3], solid: false, flat: true },
  "rug-2x3": { name: "Alfombra", size: [2, 3], solid: false, flat: true },
  // Fase 3b: muebles de la tienda (el dibujo va en art/furniture.ts; mientras no exista se ve una caja).
  cactus: { name: "Cactus", size: [1, 1] },
  "side-table": { name: "Mesita", size: [1, 1] },
  "coat-rack": { name: "Perchero", size: [1, 1] },
  monstera: { name: "Monstera", size: [1, 1] },
  "rug-round": { name: "Alfombra redonda", size: [2, 2], solid: false, flat: true },
  "rug-stripes": { name: "Alfombra de rayas", size: [2, 3], solid: false, flat: true },
  "bookshelf-low": { name: "Estantería baja", size: [1, 2] },
  globe: { name: "Globo terráqueo", size: [1, 1] },
  beanbag: { name: "Puf", size: [1, 1], seats: [[0, 0]] },
  "lamp-mushroom": { name: "Lámpara hongo", size: [1, 1], light: { at: [8, 8, 14], color: "#ff9ad0", radius: 36 } },
  easel: { name: "Caballete", size: [1, 1] },
  bonsai: { name: "Bonsái", size: [1, 1] },
  "record-player": { name: "Tocadiscos", size: [1, 1] },
  guitar: { name: "Guitarra", size: [1, 1] },
  "cat-bed": { name: "Cama con gato", size: [1, 1] },
  "tv-retro": { name: "Tele con consola", size: [1, 1], hasBack: true },
  aquarium: { name: "Pecera", size: [1, 2], light: { at: [8, 16, 14], color: "#7fd4ff", radius: 40 } },
  piano: { name: "Piano", size: [1, 2], hasBack: true },
  // La tienda de la planta baja (no se venden).
  "shop-counter": { name: "Mostrador", size: [1, 2] },
  "clothes-rack": { name: "Perchero de ropa", size: [1, 2] },
  "display-shelf": { name: "Estante de la tienda", size: [1, 2] },
  "fitting-booth": { name: "Probador", size: [2, 2] },
  "stairs-up": { name: "Escalera", size: [2, 3], fixed: true },
  stairwell: { name: "Escalera", size: [2, 3], fixed: true },
  cabin: { name: "Cabaña", size: [16, 10], fixed: true, hasNight: true },
  tree: { name: "Árbol", size: [1, 1] },
  pine: { name: "Pino", size: [1, 1] },
  bush: { name: "Arbusto", size: [1, 1] },
  flowerbed: { name: "Flores", size: [1, 1] },
  mailbox: { name: "Buzón", size: [1, 1] },
  "notice-board": { name: "Tablón", size: [1, 1] },
  "lamp-post": { name: "Farol", size: [1, 1], light: { at: [8, 8, 40], color: "#ffd98a", radius: 52 } },
  fence: { name: "Cerca", size: [1, 1] },
} satisfies Record<string, CatalogItem>;

export type FurnitureType = keyof typeof CATALOG;

export function catalogItem(type: string): CatalogItem {
  const item = (CATALOG as Record<string, CatalogItem>)[type];
  if (!item) throw new Error(`Mueble desconocido: ${type}`);
  return item;
}

/** Tamaño ocupado en el mundo según hacia dónde mira ("down"/"up" intercambian ancho y fondo). */
export function footprint(item: CatalogItem, facing: Facing): [number, number] {
  const [w, d] = item.size;
  return item.fixed || facing === "right" || facing === "left" ? [w, d] : [d, w];
}

/**
 * Tile local (marco "right") → tile del mundo relativo a la esquina del mueble.
 * "left" es un giro de 180°; "down" es el espejo de "right" sobre la diagonal (en pantalla, un
 * volteo horizontal) y "up" el espejo de "left".
 */
export function localToWorld(item: CatalogItem, facing: Facing, lx: number, ly: number): [number, number] {
  const [w, d] = item.size;
  if (item.fixed) return [lx, ly];
  switch (facing) {
    case "right":
      return [lx, ly];
    case "left":
      return [w - 1 - lx, d - 1 - ly];
    case "down":
      return [ly, lx];
    case "up":
      return [d - 1 - ly, w - 1 - lx];
  }
}
