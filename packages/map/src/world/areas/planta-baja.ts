import type { AreaDef, Placement, ZoneDef } from "../types";
import { place } from "./place";
import { CONEXIONES, hacia } from "./conexiones";

// ---------- Planta baja: lo social y lo comercial ----------
// Ver docs/plan-rediseno.md. Se entra por la puerta del recibidor (al sur). Del recibidor salen el
// pasillo principal (y 11..13, de oeste a este) y las escaleras; cada sala se abre al pasillo o al
// recibidor, nunca a través de otra sala. Arriba del pasillo: salón, cafetería y cocina (detrás de la
// barra); abajo: recibidor (con el guardarropa) y la tienda. Los baños quedan al fondo del pasillo.

/** Mesa de café con cuatro sillas alrededor y su burbuja de audio. */
function cafeTable(n: number, x: number, y: number): { furniture: Placement[]; zone: ZoneDef } {
  return {
    furniture: [
      place("cafe-table", x, y),
      place("chair", x - 1, y, "right"),
      place("chair", x + 1, y, "left"),
      place("chair", x, y - 1, "down"),
      place("chair", x, y + 1, "up"),
    ],
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
const BANOS = { x: 0, y: 11, w: 7, h: 3 };
const PASILLO = { x: 7, y: 11, w: 33, h: 3 };
const RECIBIDOR = { x: 0, y: 14, w: 13, h: 12 };
const GUARDARROPA = { x: 0, y: 21, w: 4, h: 5 };
const TIENDA = { x: 13, y: 14, w: 27, h: 12 };
// Los probadores: un rincón con paredes bajas al fondo de la tienda (es parte de ella: se entra desde adentro).
const PROBADORES = { x: 33, y: 14, w: 7, h: 12 };

// Las mesas de la cafetería: una fila de cuatro, un paso (y = 7) y dos más abajo, a los lados de la
// entrada desde el pasillo (x 20..21), que deja libre el camino hasta la barra.
const tables = [
  cafeTable(1, 14, 5),
  cafeTable(2, 18, 5),
  cafeTable(3, 22, 5),
  cafeTable(4, 26, 5),
  cafeTable(5, 15, 9),
  cafeTable(6, 25, 9),
];

export const plantaBaja: AreaDef = {
  id: "planta-baja",
  name: "Planta baja",
  width: 40,
  height: 27,
  rooms: [
    { id: "salon", rect: SALON, floor: "parquet", wallpaper: "sage" },
    { id: "cafeteria", rect: CAFE, floor: "tiles", wallpaper: "cream" },
    { id: "cocina", rect: COCINA, floor: "kitchen", wallpaper: "tile" },
    { id: "banos", rect: BANOS, floor: "mosaic", wallpaper: "tile" },
    { id: "pasillo", rect: PASILLO, floor: "wood", wallpaper: "sage" },
    { id: "recibidor", rect: RECIBIDOR, floor: "wood", wallpaper: "paneling" },
    // Va después del recibidor: ocupa su esquina suroeste.
    { id: "guardarropa", rect: GUARDARROPA, floor: "wood", wallpaper: "paneling" },
    { id: "tienda", rect: TIENDA, floor: "carpet", wallpaper: "rose" },
    // Va después de la tienda: ocupa su fondo.
    { id: "probadores", rect: PROBADORES, floor: "wood", wallpaper: "rose" },
  ],
  doors: [
    { edge: "h", x: 9, y: 11, width: 2 }, // salón ↔ pasillo
    { edge: "h", x: 20, y: 11, width: 2 }, // cafetería ↔ pasillo
    { edge: "v", x: 29, y: 1 }, // detrás de la barra ↔ cocina
    { edge: "v", x: 7, y: 12 }, // baños ↔ pasillo
    { edge: "h", x: 8, y: 14, width: 4 }, // recibidor ↔ pasillo
    { edge: "v", x: 13, y: 18, width: 2 }, // recibidor ↔ tienda
    { edge: "h", x: 26, y: 14, width: 2 }, // pasillo ↔ tienda
    { edge: "v", x: 4, y: 23, width: 2 }, // recibidor ↔ guardarropa
    { edge: "v", x: 33, y: 18, width: 2 }, // tienda ↔ probadores
    { edge: "h", x: 7, y: 26, width: 2 }, // entrada
  ],
  thresholds: CONEXIONES.plantaBaja.entrada.tiles,
  zones: [
    { id: "salon", name: "Salón", type: "common", rect: SALON, isolated: false },
    { id: "cafeteria", name: "Cafetería", type: "common", rect: CAFE, isolated: false },
    { id: "cocina", name: "Cocina", type: "common", rect: COCINA, isolated: false },
    { id: "banos", name: "Baños", type: "common", rect: BANOS, isolated: false },
    { id: "pasillo-pb", name: "Pasillo", type: "common", rect: PASILLO, isolated: false },
    // Incluye el umbral de la puerta de entrada (y = 26).
    { id: "recibidor", name: "Recibidor", type: "common", rect: { ...RECIBIDOR, h: RECIBIDOR.h + 1 }, isolated: false },
    { id: "guardarropa", name: "Guardarropa", type: "common", rect: GUARDARROPA, isolated: false },
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
    // Cafetería: el ventanal del rincón, repisas y el menú sobre la barra.
    { kind: "ventanal", edge: "h", x: 13, y: 0, width: 5 },
    { kind: "shelf", edge: "h", x: 19, y: 0, width: 2 },
    { kind: "menu", edge: "h", x: 21, y: 0, width: 3 },
    { kind: "clock", edge: "h", x: 24, y: 0 },
    { kind: "menu", edge: "h", x: 25, y: 0, width: 2 },
    { kind: "shelf", edge: "h", x: 27, y: 0, width: 2 },
    // Cocina: repisas con frascos y una ventana sobre el lavaplatos.
    { kind: "shelf", edge: "h", x: 29, y: 0, width: 3 },
    { kind: "window", edge: "h", x: 32, y: 0, width: 2 },
    { kind: "shelf", edge: "h", x: 34, y: 0, width: 2 },
    // Baños: espejo sobre los lavamanos.
    { kind: "mirror", edge: "v", x: 0, y: 11, width: 2 },
    // Recibidor y guardarropa.
    { kind: "window", edge: "v", x: 0, y: 17 },
    { kind: "board", edge: "v", x: 0, y: 18 },
    { kind: "portrait", edge: "v", x: 0, y: 19, width: 2 },
    { kind: "shelf", edge: "v", x: 0, y: 22, width: 3 },
  ],
  furniture: [
    // ----- Salón: chimenea al norte con los sofás mirándola, piano y libros contra el oeste.
    place("rug-persian", 3, 3, "down"),
    place("fireplace-stone", 5, 0, "down"),
    place("plant", 0, 0),
    place("bookshelf-low", 0, 1, "right"),
    place("reading-lamp", 4, 0),
    place("blanket-basket", 8, 0),
    place("cat-bed", 8, 2),
    place("armchair-wing", 3, 4, "right"),
    place("coffee-table", 6, 4),
    place("armchair-wing", 9, 4, "left"),
    place("sofa-leather", 5, 7, "up"),
    place("side-table", 4, 7),
    place("lamp", 8, 7),
    place("piano", 0, 5, "right"),
    place("guitar", 0, 8),
    place("sideboard", 11, 5, "down"),
    place("plant", 12, 0),
    place("record-player", 12, 8),
    place("monstera", 12, 10),
    // ----- Cafetería. Rincón con ventanal (noroeste).
    place("rug-round", 14, 1),
    place("armchair", 14, 1, "right"),
    place("cafe-table", 15, 1),
    place("armchair", 16, 1, "left"),
    place("armchair", 15, 2, "up"),
    place("plant", 13, 0),
    place("plant", 17, 0),
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
    place("plant", 18, 0),
    ...tables.flatMap((t) => t.furniture),
    place("cafe-sign", 22, 11),
    place("high-table", 18, 9),
    place("stool", 18, 8, "down"),
    place("stool", 19, 9, "left"),
    place("high-table", 23, 9),
    place("stool", 23, 8, "down"),
    place("stool", 22, 9, "right"),
    place("plant", 28, 10),
    // ----- Cocina (detrás de la barra; de adorno).
    place("kitchen-counter", 30, 0, "down"),
    place("stove", 31, 0, "down"),
    place("kitchen-counter", 32, 0, "down"),
    place("kitchen-sink", 33, 0, "down"),
    place("kitchen-counter", 34, 0, "down"),
    place("stove", 35, 0, "down"),
    place("fridge", 36, 0, "down"),
    place("pantry-shelf", 37, 0, "down"),
    place("plant", 39, 0),
    place("kitchen-counter", 29, 5, "right"),
    place("kitchen-sink", 29, 6, "right"),
    place("kitchen-counter", 29, 7, "right"),
    place("water-barrel", 39, 4),
    place("water-barrel", 39, 5),
    place("kitchen-island", 32, 4, "down"),
    place("stool", 32, 6, "up"),
    place("stool", 34, 6, "up"),
    place("cafe-table", 37, 8),
    place("chair", 36, 8, "right"),
    place("chair", 38, 8, "left"),
    // ----- Baños (de adorno).
    place("vanity", 0, 11, "right"),
    place("vanity", 0, 12, "right"),
    place("toilet", 3, 11, "down"),
    place("toilet", 5, 11, "down"),
    place("plant", 6, 13),
    // ----- Pasillo.
    place("runner", 9, 12, "down"),
    place("runner", 17, 12, "down"),
    place("runner", 25, 12, "down"),
    place("runner", 33, 12, "down"),
    place("plant", 7, 11),
    place("entry-bench", 13, 11, "down"),
    place("plant", 16, 11),
    place("grandfather-clock", 24, 11),
    place("plant", 29, 11),
    place("plant", 39, 11),
    // ----- Recibidor: escalera al piso 2 contra la pared oeste, bajada al sótano al lado, recepción
    // mirando a la puerta, y el guardarropa en la esquina.
    place("stairs-up", 0, 14),
    place("grandfather-clock", 2, 14),
    place("stairwell", 3, 14),
    place("rug-persian", 5, 18),
    place("console-table", 0, 19, "right"),
    place("reception-desk", 9, 17, "down"),
    place("plant", 12, 14),
    place("lamp", 12, 18),
    place("coat-rack", 9, 25),
    place("umbrella-stand", 6, 25),
    place("entry-bench", 5, 21, "right"),
    place("plant", 12, 25),
    // Guardarropa.
    place("clothes-rack", 0, 21, "right"),
    place("clothes-rack", 0, 24, "right"),
    place("coat-rack", 3, 21),
    place("umbrella-stand", 3, 25),
    // ----- Tienda: mostrador junto a la puerta del recibidor, estantes contra el pasillo, muebles de
    // muestra (los que se venden) armados como pequeñas salitas, la ropa y, al fondo, los probadores.
    place("shop-counter", 14, 15, "right"),
    place("plant", 13, 14),
    place("display-shelf", 16, 14, "down"),
    place("display-shelf", 19, 14, "down"),
    place("display-shelf", 22, 14, "down"),
    place("plant", 24, 14),
    place("display-shelf", 29, 14, "down"),
    place("plant", 31, 14),
    place("display-shelf", 14, 21, "right"),
    place("display-shelf", 14, 23, "right"),
    place("plant", 13, 25),
    // Salita 1: sofá, tele y alfombra de rayas.
    place("rug-stripes", 17, 17, "down"),
    place("sofa", 17, 17, "down"),
    place("tv-retro", 18, 20, "up"),
    place("lamp-mushroom", 20, 17),
    // Salita 2: sillón, estantería baja, globo y alfombra redonda.
    place("rug-round", 23, 17),
    place("armchair", 23, 17, "right"),
    place("side-table", 24, 17),
    place("globe", 25, 17),
    place("bookshelf-low", 23, 19, "down"),
    place("lamp", 22, 17),
    // Salita 3: pecera, puf y bonsái.
    place("rug-2x3", 17, 22, "down"),
    place("aquarium", 17, 22, "down"),
    place("beanbag", 17, 24, "up"),
    place("beanbag", 18, 24, "up"),
    place("bonsai", 20, 22),
    place("cactus", 20, 24),
    // Salita 4: caballete, el gato, la guitarra y el piano.
    place("rug-3x3", 23, 22),
    place("easel", 23, 22),
    place("cat-bed", 24, 23),
    place("guitar", 25, 22),
    place("monstera", 22, 25),
    place("piano", 26, 22, "down"),
    place("record-player", 28, 22),
    // La ropa.
    place("clothes-rack", 28, 17, "down"),
    place("clothes-rack", 30, 17, "down"),
    place("clothes-rack", 28, 19, "down"),
    place("clothes-rack", 30, 19, "down"),
    place("coat-rack", 32, 22),
    place("plant", 32, 25),
    // Probadores: tres cabinas contra el pasillo, un sofá para esperar y un espejo de cuerpo entero.
    place("fitting-booth", 34, 14, "down"),
    place("fitting-booth", 36, 14, "down"),
    place("fitting-booth", 38, 14, "down"),
    place("rug-round", 35, 20),
    place("sofa", 39, 20, "left"),
    place("side-table", 39, 22),
    place("plant", 39, 25),
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
    // Frente al mostrador (comprar) y a la cortina del probador del medio (probarse ropa).
    { type: "shop_counter", name: "Mostrador", x: 15, y: 16 },
    { type: "fitting_room", name: "Probador", x: 37, y: 16 },
  ],
};
