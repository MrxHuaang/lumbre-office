import type { AreaDef, Placement, ZoneDef } from "../types";
import { place } from "./place";
import { CONEXIONES, hacia } from "./conexiones";

// ---------- Planta baja: lo social y lo comercial ----------
// Ver docs/plan-rediseno.md. Se entra por la puerta del recibidor, en la fachada sur (detrás del porche).
// Del recibidor salen el pasillo principal (y 11..13, de oeste a este) y las escaleras, que quedan contra
// su pared norte (una sobre otra en todos los pisos). El recibidor es angosto (lo justo para las escaleras,
// la puerta y un respiro) para que la tienda, los probadores y la cafetería tengan espacio. Cada sala se
// abre al pasillo o al recibidor, nunca a través de otra sala. Arriba del pasillo: salón, cafetería y
// cocina (detrás de la barra); abajo: guardarropa y baños (al oeste), recibidor y tienda.

/** Lado de la mesa donde va una silla: a la izquierda (-x), a la derecha (+x), arriba (-y) o abajo (+y). */
type Lado = "l" | "r" | "u" | "d";

/**
 * Mesa de café con dos o tres sillas (más aire para pasar que con cuatro) y su burbuja de audio. Cada
 * silla mira hacia la mesa.
 */
function cafeTable(n: number, x: number, y: number, lados: Lado[] = ["l", "r"]): { furniture: Placement[]; zone: ZoneDef } {
  const silla: Record<Lado, Placement> = {
    l: place("chair", x - 1, y, "right"),
    r: place("chair", x + 1, y, "left"),
    u: place("chair", x, y - 1, "down"),
    d: place("chair", x, y + 1, "up"),
  };
  return {
    furniture: [place("cafe-table", x, y), ...lados.map((l) => silla[l])],
    zone: {
      id: `mesa-${n}`,
      name: `Mesa ${n}`,
      type: "table",
      rect: { x: x - 1, y: y - 1, w: 3, h: 3 },
      isolated: true,
    },
  };
}

const SALON = { x: 0, y: 0, w: 13, h: 11 };
const CAFE = { x: 13, y: 0, w: 16, h: 11 };
const COCINA = { x: 29, y: 0, w: 11, h: 11 };
const PASILLO = { x: 0, y: 11, w: 40, h: 3 };
const GUARDARROPA = { x: 0, y: 14, w: 11, h: 6 };
const BANOS = { x: 0, y: 20, w: 11, h: 6 };
// Angosto: las escaleras (x 11..15) contra la pared norte y la puerta de entrada (x 17..18) al sur.
const RECIBIDOR = { x: 11, y: 14, w: 8, h: 12 };
const TIENDA = { x: 19, y: 14, w: 21, h: 12 };
// Los probadores: un ala con paredes bajas al fondo de la tienda (es parte de ella: se entra desde adentro).
const PROBADORES = { x: 33, y: 14, w: 7, h: 12 };

// Las mesas de la cafetería: una fila de cuatro, un paso (y = 7) y dos más abajo, a los lados de la
// entrada desde el pasillo (x 20..21), que deja libre el camino hasta la barra. Dos o tres sillas por
// mesa, para que se pase con aire entre ellas.
const tables = [
  cafeTable(1, 14, 5),
  cafeTable(2, 18, 5, ["l", "r", "d"]),
  cafeTable(3, 22, 5, ["l", "r", "d"]),
  cafeTable(4, 26, 5, ["u", "d"]),
  cafeTable(5, 15, 9, ["l", "r", "u"]),
  cafeTable(6, 26, 9),
];

export const plantaBaja: AreaDef = {
  id: "planta-baja",
  name: "Planta baja",
  width: 40,
  height: 27,
  rooms: [
    { id: "salon", rect: SALON, floor: "parquet", wallpaper: "damask" },
    { id: "cafeteria", rect: CAFE, floor: "hydraulic", wallpaper: "brick" },
    { id: "cocina", rect: COCINA, floor: "kitchen", wallpaper: "tile" },
    { id: "pasillo", rect: PASILLO, floor: "planks", wallpaper: "stripes" },
    { id: "guardarropa", rect: GUARDARROPA, floor: "checker", wallpaper: "paneling" },
    { id: "banos", rect: BANOS, floor: "mosaic", wallpaper: "tile" },
    { id: "recibidor", rect: RECIBIDOR, floor: "terrazzo", wallpaper: "paneling" },
    { id: "tienda", rect: TIENDA, floor: "carpet", wallpaper: "rose" },
    // Va después de la tienda: ocupa su fondo.
    { id: "probadores", rect: PROBADORES, floor: "planks", wallpaper: "rose" },
  ],
  doors: [
    { edge: "h", x: 9, y: 11, width: 2 }, // salón ↔ pasillo
    { edge: "h", x: 20, y: 11, width: 2 }, // cafetería ↔ pasillo
    { edge: "v", x: 29, y: 1 }, // detrás de la barra ↔ cocina
    { edge: "h", x: 17, y: 14, width: 2 }, // recibidor ↔ pasillo (en línea con la puerta de entrada)
    { edge: "v", x: 11, y: 18, width: 2 }, // recibidor ↔ guardarropa
    { edge: "v", x: 11, y: 22, width: 2 }, // recibidor ↔ baños
    { edge: "v", x: 19, y: 18, width: 2 }, // recibidor ↔ tienda
    { edge: "h", x: 26, y: 14, width: 2 }, // pasillo ↔ tienda
    { edge: "v", x: 33, y: 18, width: 2 }, // tienda ↔ probadores
    { edge: "h", x: 17, y: 26, width: 2 }, // entrada
  ],
  thresholds: CONEXIONES.plantaBaja.entrada.tiles,
  zones: [
    { id: "salon", name: "Salón", type: "common", rect: SALON, isolated: false },
    { id: "cafeteria", name: "Cafetería", type: "common", rect: CAFE, isolated: false },
    { id: "cocina", name: "Cocina", type: "common", rect: COCINA, isolated: false },
    { id: "pasillo-pb", name: "Pasillo", type: "common", rect: PASILLO, isolated: false },
    { id: "guardarropa", name: "Guardarropa", type: "common", rect: GUARDARROPA, isolated: false },
    { id: "banos", name: "Baños", type: "common", rect: BANOS, isolated: false },
    // Incluye el umbral de la puerta de entrada (y = 26).
    { id: "recibidor", name: "Recibidor", type: "common", rect: { ...RECIBIDOR, h: RECIBIDOR.h + 1 }, isolated: false },
    { id: "tienda", name: "Tienda", type: "common", rect: TIENDA, isolated: false },
    ...tables.map((t) => t.zone),
  ],
  features: [
    // Salón: ventanas al norte, cuadros al oeste.
    { kind: "window", edge: "h", x: 1, y: 0, width: 2 },
    { kind: "portrait", edge: "h", x: 3, y: 0 },
    { kind: "picture", edge: "h", x: 9, y: 0 },
    { kind: "window", edge: "h", x: 10, y: 0, width: 2 },
    { kind: "map", edge: "v", x: 0, y: 1, width: 2 },
    { kind: "picture", edge: "v", x: 0, y: 9 },
    // Cafetería: el ventanal del rincón, repisas y el menú sobre la barra (el tablón de fotos tapa x 16..18).
    { kind: "ventanal", edge: "h", x: 13, y: 0, width: 3 },
    { kind: "shelf", edge: "h", x: 19, y: 0, width: 2 },
    { kind: "menu", edge: "h", x: 21, y: 0, width: 3 },
    { kind: "clock", edge: "h", x: 24, y: 0 },
    { kind: "menu", edge: "h", x: 25, y: 0, width: 2 },
    { kind: "shelf", edge: "h", x: 27, y: 0, width: 2 },
    // Cocina: repisas con frascos y una ventana sobre el lavaplatos.
    { kind: "shelf", edge: "h", x: 29, y: 0, width: 3 },
    { kind: "window", edge: "h", x: 32, y: 0, width: 2 },
    { kind: "shelf", edge: "h", x: 34, y: 0, width: 2 },
    // La punta oeste del pasillo.
    { kind: "window", edge: "v", x: 0, y: 12 },
    // Guardarropa: repisa de sombreros y un espejo entre los percheros.
    { kind: "mirror", edge: "v", x: 0, y: 16 },
    { kind: "shelf", edge: "v", x: 0, y: 19 },
    // Baños: el espejo largo sobre los lavamanos.
    { kind: "mirror", edge: "v", x: 0, y: 21, width: 3 },
  ],
  furniture: [
    // ----- Salón: chimenea al norte con los sofás mirándola, piano y libros contra el oeste.
    place("rug-persian", 3, 3, "down"),
    place("fireplace-stone", 5, 0, "down"),
    place("fiddle-fig", 0, 0),
    place("bookshelf-low", 0, 1, "right"),
    place("reading-lamp", 4, 0),
    place("blanket-basket", 8, 0),
    place("cat-bed", 8, 2),
    // La cama de Canela, la gata que deambula por la casa (ver PETS en @hyvento/shared).
    place("pet-bed", 10, 2),
    place("armchair-wing", 3, 4, "right"),
    place("coffee-table", 6, 4),
    place("armchair-wing", 9, 4, "left"),
    place("sofa-leather", 5, 7, "up"),
    place("side-table", 4, 7),
    place("lamp", 8, 7),
    place("piano", 0, 5, "right"),
    place("guitar", 0, 8),
    place("sideboard", 11, 5, "down"),
    place("kentia", 12, 0),
    place("record-player", 12, 8),
    place("monstera", 12, 10),
    // ----- Cafetería. Rincón con ventanal (noroeste): mesita y dos sillones sobre una alfombra, y a su
    // lado el tablón de fotos contra la pared norte (se mira desde y = 1).
    place("rug-round", 14, 0),
    place("armchair", 14, 0, "right"),
    place("cafe-table", 15, 0),
    place("armchair", 15, 1, "up"),
    place("olive-tree", 13, 0),
    place("photo-board", 16, 0, "down"),
    // La barra: el estante contra la pared, el paso de quien atiende (y = 1) y el mesón (y = 2), con una
    // entrada por el oeste (19, 2) y la puerta de la cocina al fondo del paso.
    place("backbar", 19, 0, "down"),
    place("backbar", 21, 0, "down"),
    place("fridge", 23, 0, "down"),
    place("backbar", 24, 0, "down"),
    place("backbar", 26, 0, "down"),
    place("kitchen-counter", 28, 0, "down"),
    place("counter", 20, 2, "down"),
    place("counter-coffee", 21, 2, "down"),
    place("counter", 22, 2, "down"),
    place("counter", 23, 2, "down"),
    place("counter", 24, 2, "down"),
    place("pastry-case", 25, 2, "down"),
    place("counter", 26, 2, "down"),
    place("counter", 27, 2, "down"),
    place("counter", 28, 2, "down"),
    place("stool", 20, 3, "up"),
    place("stool", 23, 3, "up"),
    place("stool", 27, 3, "up"),
    ...tables.flatMap((t) => t.furniture),
    // Dos mesas altas para tomarse algo de pie, a los lados de la entrada, y plantas en los rincones.
    place("high-table", 18, 9),
    place("stool", 18, 8, "down"),
    place("stool", 19, 9, "left"),
    place("high-table", 23, 9),
    place("stool", 23, 8, "down"),
    place("stool", 22, 9, "right"),
    place("succulents", 13, 10),
    place("column-cactus", 28, 10),
    // ----- Cocina (detrás de la barra; de adorno): dos fogones y el lavaplatos al norte, otro lavaplatos
    // contra la pared de la barra, la isla al centro, los barriles de agua y la mesita del personal.
    place("kitchen-counter", 30, 0, "down"),
    place("stove", 31, 0, "down"),
    place("kitchen-counter", 32, 0, "down"),
    place("kitchen-sink", 33, 0, "down"),
    place("kitchen-counter", 34, 0, "down"),
    place("stove", 35, 0, "down"),
    place("fridge", 36, 0, "down"),
    place("pantry-shelf", 37, 0, "down"),
    place("pothos", 39, 0),
    // Casa viva: la radio de la cocina.
    place("radio", 39, 2),
    place("kitchen-counter", 29, 5, "right"),
    place("kitchen-sink", 29, 6, "right"),
    place("kitchen-counter", 29, 7, "right"),
    place("dish-hutch", 29, 9, "right"),
    place("water-barrel", 39, 4),
    place("water-barrel", 39, 5),
    place("kitchen-island", 32, 4, "down"),
    place("stool", 32, 6, "up"),
    place("stool", 34, 6, "up"),
    place("cafe-table", 37, 8),
    place("chair", 36, 8, "right"),
    place("chair", 38, 8, "left"),
    place("coffee-sacks", 39, 10),
    // ----- Pasillo.
    place("runner", 2, 12, "down"),
    place("runner", 11, 12, "down"),
    place("runner", 23, 12, "down"),
    place("runner", 31, 12, "down"),
    place("kentia", 0, 11),
    place("snake-plant", 0, 13),
    place("bookshelf-low", 3, 11, "down"),
    place("plant", 8, 11),
    place("entry-bench", 13, 11, "down"),
    place("boston-fern", 16, 11),
    place("cafe-sign", 22, 11),
    place("grandfather-clock", 25, 11),
    place("fiddle-fig", 29, 11),
    place("console-table", 35, 11, "down"),
    place("olive-tree", 39, 11),
    place("pothos", 39, 13),
    place("orchid", 24, 13),
    // ----- Guardarropa: percheros contra las paredes, el mostrador y una banca para cambiarse los zapatos.
    place("clothes-rack", 0, 14, "right"),
    place("clothes-rack", 0, 17, "right"),
    place("clothes-rack", 2, 14, "down"),
    place("clothes-rack", 5, 14, "down"),
    place("umbrella-stand", 8, 14),
    place("coat-rack", 9, 14),
    place("column-cactus", 10, 14),
    place("console-table", 5, 17, "down"),
    place("entry-bench", 2, 19, "down"),
    place("snake-plant", 9, 16),
    // ----- Baños (de adorno): los inodoros en cubículos contra la pared del guardarropa y los lavamanos
    // con el espejo contra la pared oeste; desde la puerta se ven los lavamanos.
    place("boston-fern", 0, 20),
    place("vanity", 0, 21, "right"),
    place("vanity", 0, 22, "right"),
    place("vanity", 0, 23, "right"),
    place("orchid", 0, 25),
    place("toilet-stall", 4, 20, "down"),
    place("toilet-stall", 5, 20, "down"),
    place("toilet-stall", 6, 20, "down"),
    place("toilet-stall", 7, 20, "down"),
    place("blanket-basket", 9, 20),
    place("umbrella-stand", 10, 25),
    // ----- Recibidor: las escaleras contra la pared norte (la de la izquierda sube al piso 2 y la de la
    // derecha baja al sótano), la recepción mirando a la puerta sobre la alfombra y el camino recto de la
    // puerta de entrada al pasillo (x 17..18).
    place("stairs-up", 11, 14),
    place("grandfather-clock", 13, 14),
    place("stairwell", 14, 14),
    place("kentia", 16, 14),
    place("rug-persian", 12, 20, "down"),
    place("reception-desk", 13, 21, "down"),
    place("lamp", 18, 22),
    place("entry-bench", 11, 24, "right"),
    place("monstera", 13, 25),
    place("umbrella-stand", 15, 25),
    place("coat-rack", 16, 25),
    // ----- Tienda: mostrador junto a la puerta del recibidor, estantes contra el pasillo y la pared oeste,
    // muebles de muestra (los que se venden) armados como salitas con pasillos entre ellas (x = 25, y = 17
    // e y = 21), el piano en el rincón y la ropa camino a los probadores.
    place("fiddle-fig", 19, 14),
    place("display-shelf", 20, 14, "down"),
    place("display-shelf", 23, 14, "down"),
    place("succulents", 25, 14),
    place("display-shelf", 28, 14, "down"),
    place("record-player", 30, 14),
    place("piano", 31, 14, "down"),
    place("shop-counter", 20, 15, "right"),
    place("display-shelf", 19, 21, "right"),
    place("display-shelf", 19, 23, "right"),
    place("olive-tree", 19, 25),
    // Salita 1: sofá, tele y alfombra de rayas.
    place("rug-stripes", 21, 18, "down"),
    place("sofa", 21, 18, "down"),
    place("lamp-mushroom", 24, 18),
    place("tv-retro", 22, 20, "up"),
    // Salita 2: sillón, estantería baja, globo y alfombra redonda.
    place("rug-round", 26, 18),
    place("armchair", 26, 18, "right"),
    place("side-table", 27, 18),
    place("globe", 28, 18),
    place("bookshelf-low", 26, 20, "down"),
    // Salita 3: pecera, pufs y bonsái.
    place("rug-2x3", 21, 22, "down"),
    place("aquarium", 21, 22, "down"),
    place("beanbag", 21, 24, "up"),
    place("beanbag", 22, 24, "up"),
    place("bonsai", 24, 22),
    // Salita 4: caballete, el gato y la guitarra.
    place("rug-3x3", 26, 22),
    place("easel", 26, 22),
    place("cat-bed", 27, 23),
    place("guitar", 28, 22),
    // La ropa: una fila de percheros camino a los probadores.
    place("clothes-rack", 30, 18, "down"),
    place("clothes-rack", 30, 20, "down"),
    place("clothes-rack", 30, 22, "down"),
    place("clothes-rack", 30, 24, "down"),
    place("pothos", 32, 25),
    // Probadores: tres cabinas contra el pasillo, un espejo de cuerpo entero y, abajo, una salita de madera
    // para esperar (alfombra redonda, sofá, mesita, lámpara y perchero).
    place("floor-mirror", 33, 14),
    place("fitting-booth", 34, 14, "down"),
    place("fitting-booth", 36, 14, "down"),
    place("fitting-booth", 38, 14, "down"),
    place("rug-round", 35, 20),
    place("sofa", 39, 20, "left"),
    place("side-table", 39, 22),
    place("snake-plant", 39, 25),
    place("lamp", 34, 25),
    place("coat-rack", 36, 25),
  ],
  portals: [
    {
      id: "planta-baja-salida",
      label: "Salir al jardín",
      tiles: CONEXIONES.plantaBaja.entrada.tiles,
      to: hacia("jardin", CONEXIONES.jardin.casa),
    },
    {
      id: "planta-baja-escalera",
      label: "Subir al piso 2",
      tiles: CONEXIONES.plantaBaja.escaleraArriba.tiles,
      to: hacia("piso-2", CONEXIONES.piso2.escaleraAbajo),
    },
    {
      id: "planta-baja-sotano",
      label: "Bajar al sótano",
      tiles: CONEXIONES.plantaBaja.escaleraSotano.tiles,
      to: hacia("sotano", CONEXIONES.sotano.escalera),
    },
  ],
  points: [
    // Frente a la cafetera y a la vitrina, entre los taburetes: ahí se pide.
    { type: "cafe_counter", name: "Barra", x: 21, y: 3 },
    { type: "cafe_counter", name: "Barra", x: 25, y: 3 },
    // Frente al tablón de fotos (ver la galería).
    { type: "photo_board", name: "Tablón de fotos", x: 17, y: 1 },
    // Frente al mostrador (comprar) y a la cortina del probador del medio (probarse ropa).
    { type: "shop_counter", name: "Mostrador", x: 21, y: 16 },
    { type: "fitting_room", name: "Probador", x: 37, y: 16 },
  ],
};
