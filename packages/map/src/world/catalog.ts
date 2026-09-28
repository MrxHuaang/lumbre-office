// Catálogo de muebles: solo lo que importa al juego (tamaño, colisión, asientos). El dibujo de cada
// uno vive en art/ (furniture.ts los registra todos en DRAW), así el servidor no carga arte.
import { EXTERIOR_CATALOG } from "./catalog-exterior";
import { INTERIOR_CATALOG } from "./catalog-interior";
import { SOTANO_CATALOG } from "./catalog-sotano";
import { CASA_CATALOG } from "./catalog-casa";
import { PLANTAS_CATALOG } from "./catalog-plantas";
import { GARAJE_CATALOG } from "./catalog-garaje";
import { BUS_CATALOG } from "./catalog-bus";
import type { Facing } from "./types";

export interface CatalogItem {
  name: string;
  /** Tamaño en tiles mirando hacia "right" (+x): `w` a lo largo de x, `d` a lo largo de y. */
  size: [w: number, d: number];
  /** Bloquea el paso (por defecto sí). */
  solid?: boolean;
  /**
   * Tiles de asiento en el marco local "right". Quien se sienta mira hacia el `facing` del mueble, salvo
   * que el asiento traiga el suyo (solo en muebles `fixed`, como las bancas de la glorieta que miran al
   * centro): ese asiento además se ordena con su propio tile y no con el centro del mueble.
   */
  seats?: ([number, number] | [number, number, Facing])[];
  /**
   * Solo estos tiles (marco local "right") bloquean el paso; el resto del mueble se camina (la glorieta:
   * se entra por el frente y las bancas y los rincones quedan bloqueados). Sin esto, bloquea todo (si es
   * `solid`).
   */
  blocks?: [number, number][];
  /**
   * Techo o paredes de algo que se camina por dentro (glorieta, invernadero): el cliente lo transparenta
   * cuando hay alguien adentro, así que puede tapar lo que queda bajo él.
   */
  seeThrough?: boolean;
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
  /**
   * Altura de su superficie en unidades de arte (gradas, tarimas y lo que va encima). Quien se para o se
   * sienta ahí debería dibujarse así de más arriba (el cliente todavía no lo aplica).
   */
  lift?: number;
}

export const CATALOG = {
  "desk-pc": { name: "Escritorio con PC", size: [1, 2], computer: true },
  chair: { name: "Silla", size: [1, 1], seats: [[0, 0]], hasBack: true },
  // Sillas de oficina con ruedas (las únicas que giran, ver swivel.ts), una por color de tapiz.
  "office-chair": { name: "Silla de oficina", size: [1, 1], seats: [[0, 0]], hasBack: true },
  "office-chair-mustard": { name: "Silla de oficina", size: [1, 1], seats: [[0, 0]], hasBack: true },
  "office-chair-blue": { name: "Silla de oficina", size: [1, 1], seats: [[0, 0]], hasBack: true },
  "office-chair-rose": { name: "Silla de oficina", size: [1, 1], seats: [[0, 0]], hasBack: true },
  "office-chair-sage": { name: "Silla de oficina", size: [1, 1], seats: [[0, 0]], hasBack: true },
  // Carrera de sillas (pasillo del piso 2): líneas pintadas en el piso y la bandera de la salida.
  "race-line": { name: "Línea de carrera", size: [1, 3], solid: false, flat: true },
  "race-flag": { name: "Bandera de carrera", size: [1, 1] },
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
  // Fase 3b: muebles de la tienda (dibujos en art/decor.ts).
  cactus: { name: "Cactus", size: [1, 1] },
  "side-table": { name: "Mesita", size: [1, 1] },
  "coat-rack": { name: "Perchero", size: [1, 1] },
  monstera: { name: "Monstera", size: [1, 1] },
  "rug-round": { name: "Alfombra redonda", size: [2, 2], solid: false, flat: true },
  "rug-stripes": { name: "Alfombra de rayas", size: [2, 3], solid: false, flat: true },
  "bookshelf-low": { name: "Estantería baja", size: [1, 2] },
  globe: { name: "Globo terráqueo", size: [1, 1] },
  beanbag: { name: "Puf", size: [1, 1], seats: [[0, 0]], hasBack: true },
  "lamp-mushroom": { name: "Lámpara hongo", size: [1, 1], light: { at: [8, 8, 14], color: "#ff9ad0", radius: 36 } },
  easel: { name: "Caballete", size: [1, 1] },
  bonsai: { name: "Bonsái", size: [1, 1] },
  "record-player": { name: "Tocadiscos", size: [1, 1] },
  guitar: { name: "Guitarra", size: [1, 1] },
  "cat-bed": { name: "Cama con gato", size: [1, 1] },
  "tv-retro": { name: "Tele con consola", size: [1, 1], hasBack: true },
  aquarium: { name: "Pecera", size: [1, 2], light: { at: [8, 16, 18], color: "#7fd4ff", radius: 40 } },
  piano: { name: "Piano", size: [1, 2], hasBack: true },
  // La tienda de la planta baja (no se venden; dibujos en art/shop.ts). Sin dibujo de espaldas: el
  // frente (caja, cortina, ropa) queda hacia +x con right o left y hacia +y con down o up. Elegir la
  // orientación que deje el frente libre, no contra una pared.
  "shop-counter": { name: "Mostrador", size: [1, 2] },
  "clothes-rack": { name: "Perchero de ropa", size: [1, 2] },
  "display-shelf": { name: "Estante de la tienda", size: [1, 2] },
  "fitting-booth": { name: "Probador", size: [2, 2] },
  // Fase 4: el casino del sótano (dibujos en art/casino.ts).
  // La ruleta del rediseño: el paño (3x4) y la rueda aparte (2x2), en la cabecera del paño.
  "roulette-table": { name: "Mesa de ruleta", size: [3, 4] },
  // Sin luz propia: el brillo aditivo tapaba los números de la rueda (el casino ya tiene lámparas).
  "roulette-wheel": { name: "Rueda de la ruleta", size: [2, 2] },
  "blackjack-table": { name: "Mesa de blackjack", size: [2, 3] },
  "casino-cashier": { name: "Caja del casino", size: [1, 2] },
  "slot-machine": { name: "Tragamonedas", size: [1, 1], light: { at: [8, 8, 22], color: "#ff6fa0", radius: 30 } },
  // El escenario del tubo: la tarima es plana (se pisa) y el tubo, sólido, va en el tile del medio.
  "pole-stage": { name: "Escenario", size: [3, 3], solid: false, flat: true, light: { at: [24, 24, 2], color: "#ff5fd2", radius: 56 } },
  "dance-pole": { name: "Tubo", size: [1, 1], light: { at: [8, 8, 50], color: "#ff9ae6", radius: 34 } },
  // Más casino, el club (pole dance) y el cine del sótano (dibujos en art/casino.ts, art/club.ts y art/cinema.ts).
  "poker-table": { name: "Mesa de póker", size: [2, 3] },
  "coin-fountain": { name: "Fuente de monedas", size: [2, 2], light: { at: [16, 16, 24], color: "#8ef0f0", radius: 50 } },
  "velvet-rope": { name: "Cordón de terciopelo", size: [1, 1] },
  palm: { name: "Palmera", size: [1, 1] },
  "fortune-wheel": { name: "Rueda de la fortuna", size: [1, 1], light: { at: [10, 8, 18], color: "#ffd66a", radius: 34 } },
  "lounge-sofa": { name: "Sofá de terciopelo", size: [1, 2], seats: [[0, 0], [0, 1]], hasBack: true },
  "cocktail-table": { name: "Mesa de cóctel", size: [1, 1], light: { at: [6, 8, 21], color: "#ffb45a", radius: 22 } },
  "bar-counter": { name: "Barra del club", size: [1, 1] },
  "bar-shelf": { name: "Estante de botellas", size: [1, 2], light: { at: [6, 16, 22], color: "#ff5fd2", radius: 40 } },
  "dj-booth": { name: "Cabina de DJ", size: [1, 2], light: { at: [12, 16, 12], color: "#3fd0dd", radius: 46 } },
  speaker: { name: "Parlante", size: [1, 1] },
  "cinema-seat": { name: "Butaca de cine", size: [1, 1], seats: [[0, 0]], hasBack: true },
  "popcorn-machine": { name: "Máquina de crispetas", size: [1, 1], light: { at: [8, 8, 18], color: "#ffd66a", radius: 34 } },
  projector: { name: "Proyector", size: [1, 1], hasBack: true, light: { at: [14, 8, 15], color: "#cfe8ff", radius: 30 } },
  "poster-stand": { name: "Afiche de cartelera", size: [1, 1] },
  // Fase 5: el huerto del jardín y el arcade del sótano (dibujos en art/leisure.ts).
  // Se pisa (se cultiva parado encima, como en Stardew); lo que crece lo dibuja el cliente.
  "garden-plot": { name: "Parcela del huerto", size: [1, 1], solid: false, flat: true },
  scarecrow: { name: "Espantapájaros", size: [1, 1] },
  "water-barrel": { name: "Barril de agua", size: [1, 1] },
  "arcade-cabinet": { name: "Máquina de arcade", size: [1, 1], light: { at: [14, 8, 22], color: "#8ef0f0", radius: 30 } },
  "claw-machine": { name: "Máquina de peluches", size: [1, 1], light: { at: [8, 8, 24], color: "#ff9ae6", radius: 30 } },
  // Se juega de a dos (o contra la máquina) parado en cada punta: ver HOCKEY en @hyvento/shared.
  "air-hockey": { name: "Hockey de mesa", size: [2, 3], light: { at: [16, 24, 16], color: "#8ef0f0", radius: 48 } },
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
  // Rediseño (docs/plan-rediseno.md): cada parte en su archivo para no pisarse.
  ...EXTERIOR_CATALOG,
  ...INTERIOR_CATALOG,
  ...SOTANO_CATALOG,
  ...CASA_CATALOG,
  ...PLANTAS_CATALOG,
  ...GARAJE_CATALOG,
  ...BUS_CATALOG,
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
