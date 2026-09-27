import type { AreaDef, Placement, ZoneDef } from "../types";
import { place } from "./place";
import { CONEXIONES, hacia } from "./conexiones";

// ---------- Planta baja: lo social y lo comercial ----------
// Ver docs/plan-rediseno.md. Se entra por la puerta del recibidor, al centro de la fachada sur (detrás
// del porche). Del recibidor salen el pasillo principal (y 11..13, de oeste a este) y las escaleras, que
// quedan contra su pared norte (una sobre otra en todos los pisos). Cada sala se abre al pasillo o al
// recibidor, nunca a través de otra sala. Arriba del pasillo: salón, cafetería y cocina (detrás de la
// barra); abajo: guardarropa y baños (al oeste, junto al recibidor), recibidor y tienda.

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
const CAFE = { x: 13, y: 0, w: 20, h: 11 };
const COCINA = { x: 33, y: 0, w: 7, h: 11 };
const PASILLO = { x: 0, y: 11, w: 40, h: 3 };
const GUARDARROPA = { x: 0, y: 14, w: 10, h: 6 };
const BANOS = { x: 0, y: 20, w: 10, h: 6 };
const RECIBIDOR = { x: 10, y: 14, w: 14, h: 12 };
const TIENDA = { x: 24, y: 14, w: 16, h: 12 };
// Los probadores: un rincón con paredes bajas al fondo de la tienda (es parte de ella: se entra desde adentro).
const PROBADORES = { x: 33, y: 14, w: 7, h: 6 };

// Las mesas de la cafetería: seis mesas de dos o tres sillas, repartidas con aire entre ellas (y plantas
// en los rincones). La entrada desde el pasillo (x 20..21) deja libre el camino hasta la barra.
const tables = [
  cafeTable(1, 14, 5),
  cafeTable(2, 18, 5, ["l", "r", "d"]),
  cafeTable(3, 25, 6, ["u", "d"]),
  cafeTable(4, 30, 6, ["l", "r", "d"]),
  cafeTable(5, 15, 9),
  cafeTable(6, 27, 9, ["l", "r"]),
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
    { id: "pasillo", rect: PASILLO, floor: "wood", wallpaper: "sage" },
    { id: "guardarropa", rect: GUARDARROPA, floor: "wood", wallpaper: "paneling" },
    { id: "banos", rect: BANOS, floor: "mosaic", wallpaper: "tile" },
    { id: "recibidor", rect: RECIBIDOR, floor: "wood", wallpaper: "paneling" },
    { id: "tienda", rect: TIENDA, floor: "carpet", wallpaper: "rose" },
    // Va después de la tienda: ocupa su fondo.
    { id: "probadores", rect: PROBADORES, floor: "wood", wallpaper: "rose" },
  ],
  doors: [
    { edge: "h", x: 9, y: 11, width: 2 }, // salón ↔ pasillo
    { edge: "h", x: 20, y: 11, width: 2 }, // cafetería ↔ pasillo
    { edge: "v", x: 33, y: 1 }, // detrás de la barra ↔ cocina
    { edge: "h", x: 17, y: 14, width: 5 }, // recibidor ↔ pasillo
    { edge: "v", x: 10, y: 18, width: 2 }, // recibidor ↔ guardarropa
    { edge: "v", x: 10, y: 22, width: 2 }, // recibidor ↔ baños
    { edge: "v", x: 24, y: 19, width: 2 }, // recibidor ↔ tienda
    { edge: "h", x: 27, y: 14, width: 2 }, // pasillo ↔ tienda
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
    // Cafetería: el ventanal de los rincones, repisas y el menú sobre la barra.
    { kind: "ventanal", edge: "h", x: 13, y: 0, width: 8 },
    { kind: "picture", edge: "h", x: 21, y: 0 },
    { kind: "shelf", edge: "h", x: 23, y: 0, width: 2 },
    { kind: "menu", edge: "h", x: 25, y: 0, width: 3 },
    { kind: "clock", edge: "h", x: 28, y: 0 },
    { kind: "menu", edge: "h", x: 29, y: 0, width: 2 },
    { kind: "shelf", edge: "h", x: 31, y: 0, width: 2 },
    // Cocina: repisas con frascos y una ventana sobre el lavaplatos.
    { kind: "shelf", edge: "h", x: 33, y: 0 },
    { kind: "window", edge: "h", x: 35, y: 0, width: 2 },
    { kind: "shelf", edge: "h", x: 37, y: 0 },
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
    // ----- Cafetería. Dos rincones contra el ventanal (noroeste), cada uno con su mesita y tres sillones.
    place("rug-round", 14, 0),
    place("armchair", 14, 0, "right"),
    place("cafe-table", 15, 0),
    place("armchair", 16, 0, "left"),
    place("rug-round", 18, 0),
    place("armchair", 18, 0, "right"),
    place("cafe-table", 19, 0),
    place("bonsai", 20, 0),
    place("plant", 13, 0),
    place("plant", 17, 0),
    place("plant", 21, 0),
    place("lamp", 22, 0),
    // La barra: el estante contra la pared, el paso de quien atiende (y = 1) y el mesón (y = 2), con una
    // entrada por el oeste (23, 2) y la puerta de la cocina al fondo del paso.
    place("backbar", 23, 0, "down"),
    place("backbar", 25, 0, "down"),
    place("fridge", 27, 0, "down"),
    place("backbar", 28, 0, "down"),
    place("backbar", 30, 0, "down"),
    place("kitchen-counter", 32, 0, "down"),
    place("counter", 24, 2, "down"),
    place("counter-coffee", 25, 2, "down"),
    place("counter", 26, 2, "down"),
    place("counter", 27, 2, "down"),
    place("counter", 28, 2, "down"),
    place("pastry-case", 29, 2, "down"),
    place("counter", 30, 2, "down"),
    place("counter", 31, 2, "down"),
    place("counter", 32, 2, "down"),
    place("stool", 24, 3, "up"),
    place("stool", 27, 3, "up"),
    place("stool", 31, 3, "up"),
    ...tables.flatMap((t) => t.furniture),
    // Una mesa alta para tomarse algo de pie junto a la entrada, y plantas y detalles en los rincones.
    place("high-table", 23, 9),
    place("stool", 23, 8, "down"),
    place("stool", 24, 9, "left"),
    place("monstera", 13, 7),
    place("plant", 13, 10),
    place("plant", 19, 10),
    place("rug-round", 17, 5),
    place("plant", 32, 7),
    place("plant", 32, 10),
    place("lamp", 32, 8),
    // ----- Cocina (detrás de la barra; de adorno): fogones y lavaplatos al norte, despensa y alacena al
    // oeste, la isla al centro, la mesa de preparación y la mesita del personal.
    place("kitchen-counter", 33, 0, "down"),
    place("stove", 34, 0, "down"),
    place("kitchen-counter", 35, 0, "down"),
    place("kitchen-sink", 36, 0, "down"),
    place("kitchen-counter", 37, 0, "down"),
    place("fridge", 38, 0, "down"),
    place("coffee-sacks", 39, 0),
    place("pantry-shelf", 33, 3, "right"),
    place("dish-hutch", 33, 6, "right"),
    place("kitchen-island", 35, 3, "down"),
    place("stool", 35, 5, "up"),
    place("stool", 37, 5, "up"),
    place("coffee-sacks", 39, 3),
    place("coffee-sacks", 39, 4),
    place("prep-table", 35, 7, "down"),
    place("plant", 39, 7),
    place("cafe-table", 38, 9),
    place("chair", 37, 9, "right"),
    place("chair", 39, 9, "left"),
    place("kitchen-counter", 33, 9, "right"),
    // ----- Pasillo.
    place("runner", 2, 12, "down"),
    place("runner", 11, 12, "down"),
    place("runner", 23, 12, "down"),
    place("runner", 31, 12, "down"),
    place("plant", 0, 11),
    place("plant", 0, 13),
    place("bookshelf-low", 3, 11, "down"),
    place("plant", 8, 11),
    place("entry-bench", 13, 11, "down"),
    place("plant", 16, 11),
    place("cafe-sign", 22, 11),
    place("grandfather-clock", 25, 11),
    place("plant", 29, 11),
    place("console-table", 35, 11, "down"),
    place("plant", 39, 11),
    place("plant", 39, 13),
    place("plant", 24, 13),
    // ----- Guardarropa: percheros contra las paredes, el mostrador y una banca para cambiarse los zapatos.
    place("clothes-rack", 0, 14, "right"),
    place("clothes-rack", 0, 17, "right"),
    place("clothes-rack", 2, 14, "down"),
    place("clothes-rack", 5, 14, "down"),
    place("umbrella-stand", 8, 14),
    place("coat-rack", 9, 14),
    place("console-table", 5, 17, "down"),
    place("entry-bench", 2, 19, "down"),
    place("plant", 9, 16),
    // ----- Baños (de adorno): los inodoros en cubículos contra la pared del guardarropa y los lavamanos
    // con el espejo contra la pared oeste; desde la puerta se ven los lavamanos.
    place("plant", 0, 20),
    place("vanity", 0, 21, "right"),
    place("vanity", 0, 22, "right"),
    place("vanity", 0, 23, "right"),
    place("plant", 0, 25),
    place("toilet-stall", 4, 20, "down"),
    place("toilet-stall", 5, 20, "down"),
    place("toilet-stall", 6, 20, "down"),
    place("toilet-stall", 7, 20, "down"),
    place("blanket-basket", 9, 20),
    place("umbrella-stand", 9, 25),
    // ----- Recibidor: las escaleras contra la pared norte (la de la izquierda sube al piso 2 y la de la
    // derecha baja al sótano), la recepción mirando a la puerta y la alfombra en el camino.
    place("plant", 10, 14),
    place("stairs-up", 11, 14),
    place("grandfather-clock", 13, 14),
    place("stairwell", 14, 14),
    place("plant", 16, 14),
    place("lamp", 22, 14),
    place("plant", 23, 14),
    place("reception-desk", 20, 18, "down"),
    place("rug-persian", 13, 19, "down"),
    place("entry-table", 15, 20),
    place("console-table", 10, 20, "right"),
    place("entry-bench", 10, 24, "right"),
    place("monstera", 13, 25),
    place("umbrella-stand", 16, 25),
    place("coat-rack", 19, 25),
    place("lamp", 23, 22),
    place("plant", 23, 25),
    // ----- Tienda: mostrador junto a la puerta del pasillo, estantes, muebles de muestra (los que se
    // venden) armados como salitas entre dos pasillos (x = 25 e y = 21), la ropa y los probadores al fondo.
    place("plant", 24, 14),
    place("shop-counter", 25, 15, "right"),
    place("display-shelf", 29, 14, "down"),
    place("display-shelf", 31, 14, "down"),
    place("display-shelf", 24, 22, "right"),
    place("plant", 24, 25),
    // Salita 1: sofá, tele y alfombra de rayas.
    place("rug-stripes", 26, 18, "down"),
    place("sofa", 26, 18, "down"),
    place("tv-retro", 27, 20, "up"),
    place("lamp-mushroom", 28, 18),
    // Salita 2: sillón, estantería baja, globo y alfombra redonda.
    place("rug-round", 29, 18),
    place("armchair", 29, 18, "right"),
    place("side-table", 30, 18),
    place("globe", 31, 18),
    place("bookshelf-low", 29, 20, "down"),
    place("lamp", 31, 20),
    // Salita 3: pecera, pufs y bonsái.
    place("rug-2x3", 26, 22, "down"),
    place("aquarium", 26, 22, "down"),
    place("beanbag", 26, 24, "up"),
    place("beanbag", 27, 24, "up"),
    place("bonsai", 28, 22),
    // Salita 4: caballete, el gato, la guitarra y el tocadiscos.
    place("rug-3x3", 29, 22),
    place("easel", 29, 22),
    place("cat-bed", 30, 23),
    place("guitar", 31, 22),
    place("record-player", 31, 24),
    // La ropa (debajo de los probadores).
    place("clothes-rack", 34, 21, "down"),
    place("clothes-rack", 37, 21, "down"),
    place("clothes-rack", 34, 23, "down"),
    place("clothes-rack", 37, 23, "down"),
    place("coat-rack", 39, 20),
    place("floor-mirror", 33, 25),
    place("plant", 39, 25),
    // Probadores: tres cabinas contra el pasillo, espejos de pie, una banca y un sofá para esperar.
    place("plant", 33, 14),
    place("floor-mirror", 33, 15),
    place("fitting-booth", 34, 14, "down"),
    place("fitting-booth", 36, 14, "down"),
    place("fitting-booth", 38, 14, "down"),
    place("rug-round", 35, 17),
    place("entry-bench", 35, 19, "down"),
    place("sofa", 39, 17, "left"),
    place("side-table", 39, 19),
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
    { type: "cafe_counter", name: "Barra", x: 25, y: 3 },
    { type: "cafe_counter", name: "Barra", x: 29, y: 3 },
    // Frente al mostrador (comprar) y a la cortina del probador del medio (probarse ropa).
    { type: "shop_counter", name: "Mostrador", x: 26, y: 16 },
    { type: "fitting_room", name: "Probador", x: 37, y: 16 },
  ],
};
