import type { AreaDef, Rect } from "../types";
import { place } from "./place";
import { CONEXIONES, hacia } from "./conexiones";

// ---------- Piso 3: biblioteca y descanso ----------
// Ver docs/plan-rediseno.md. Bajo el techo y más chico que los de abajo. El pasillo (y 11..13) cruza el
// piso y todas las salas se abren a él: arriba la biblioteca (con las estanterías altas contra las
// paredes del fondo), el rincón de lectura (con el ventanal) y la sala de estar; abajo el rellano de la
// escalera (el mismo lugar que en los otros pisos), la sala de juegos de mesa y la terraza al aire libre.

const W = 32;
const H = 21;
const BIBLIOTECA: Rect = { x: 0, y: 0, w: 15, h: 11 };
const LECTURA: Rect = { x: 15, y: 0, w: 7, h: 11 };
const ESTAR: Rect = { x: 22, y: 0, w: 10, h: 11 };
const PASILLO: Rect = { x: 0, y: 11, w: W, h: 3 };
const RELLANO: Rect = { x: 0, y: 14, w: 8, h: 7 };
const JUEGOS: Rect = { x: 8, y: 14, w: 12, h: 7 };
const TERRAZA: Rect = { x: 20, y: 14, w: 12, h: 7 };

export const piso3: AreaDef = {
  id: "piso-3",
  name: "Piso 3",
  width: W,
  height: H,
  rooms: [
    { id: "biblioteca", rect: BIBLIOTECA, floor: "parquet", wallpaper: "forest" },
    { id: "lectura", rect: LECTURA, floor: "wood", wallpaper: "cream" },
    { id: "estar", rect: ESTAR, floor: "parquet", wallpaper: "paneling" },
    { id: "pasillo-3", rect: PASILLO, floor: "wood", wallpaper: "sage" },
    { id: "rellano-3", rect: RELLANO, floor: "parquet", wallpaper: "paneling" },
    { id: "juegos", rect: JUEGOS, floor: "carpet", wallpaper: "sage" },
    { id: "terraza", rect: TERRAZA, floor: "terrace", wallpaper: "cream" },
  ],
  doors: [
    { edge: "h", x: 7, y: 11, width: 2 }, // biblioteca ↔ pasillo
    { edge: "h", x: 18, y: 11 }, // rincón de lectura ↔ pasillo
    { edge: "h", x: 26, y: 11, width: 2 }, // sala de estar ↔ pasillo
    { edge: "h", x: 5, y: 14, width: 3 }, // rellano ↔ pasillo
    { edge: "h", x: 13, y: 14, width: 2 }, // sala de juegos ↔ pasillo
    { edge: "h", x: 25, y: 14, width: 2 }, // terraza ↔ pasillo
    // La terraza no tiene paredes hacia afuera: la cierran las barandas.
    { edge: "v", x: TERRAZA.x + TERRAZA.w, y: TERRAZA.y, width: TERRAZA.h },
    { edge: "h", x: TERRAZA.x, y: TERRAZA.y + TERRAZA.h, width: TERRAZA.w },
  ],
  zones: [
    // Rincón silencioso: lo que se habla en la biblioteca se queda en la biblioteca.
    { id: "biblioteca", name: "Biblioteca", type: "common", rect: BIBLIOTECA, isolated: true },
    { id: "lectura", name: "Rincón de lectura", type: "common", rect: LECTURA, isolated: false },
    { id: "estar", name: "Sala de estar", type: "common", rect: ESTAR, isolated: false },
    { id: "pasillo-3", name: "Pasillo", type: "common", rect: PASILLO, isolated: false },
    { id: "rellano-3", name: "Rellano", type: "common", rect: RELLANO, isolated: false },
    { id: "juegos", name: "Sala de juegos", type: "common", rect: JUEGOS, isolated: false },
    { id: "terraza", name: "Terraza", type: "common", rect: TERRAZA, isolated: false },
  ],
  features: [
    // Biblioteca: una ventana entre las estanterías y el mapamundi.
    { kind: "window", edge: "h", x: 7, y: 0, width: 2 },
    { kind: "window", edge: "v", x: 0, y: 5 },
    // Rincón de lectura: el ventanal de piso a techo.
    { kind: "ventanal", edge: "h", x: 15, y: 0, width: 7 },
    // Sala de estar.
    { kind: "window", edge: "h", x: 23, y: 0, width: 2 },
    { kind: "portrait", edge: "h", x: 25, y: 0 },
    { kind: "picture", edge: "h", x: 29, y: 0 },
    { kind: "window", edge: "h", x: 30, y: 0, width: 2 },
    { kind: "window", edge: "v", x: 0, y: 12 },
    { kind: "picture", edge: "v", x: 0, y: 17 },
    { kind: "window", edge: "v", x: 0, y: 18, width: 2 },
  ],
  furniture: [
    // ----- Biblioteca: estanterías altas contra el norte y el oeste, la escalerita, dos mesas largas con
    // lámparas verdes y, al sur, sillones y el globo.
    place("rug-persian", 3, 3, "down"),
    place("rug-persian", 8, 3, "down"),
    place("plant", 0, 0),
    place("bookcase-tall", 1, 0, "down"),
    place("bookcase-tall", 3, 0, "down"),
    place("bookcase-tall", 5, 0, "down"),
    place("bookcase-tall", 9, 0, "down"),
    place("bookcase-tall", 11, 0, "down"),
    place("curio-cabinet", 13, 0, "down"),
    place("bookcase-tall", 0, 1, "right"),
    place("bookcase-tall", 0, 3, "right"),
    place("bookcase-tall", 0, 6, "right"),
    place("bookcase-tall", 0, 8, "right"),
    place("library-ladder", 4, 1, "down"),
    place("library-ladder", 1, 7, "right"),
    place("reading-table", 3, 4, "down"),
    place("reading-table", 9, 4, "down"),
    ...[3, 4, 5, 6, 9, 10, 11, 12].flatMap((x) => [place("chair", x, 3, "down"), place("chair", x, 6, "up")]),
    place("globe", 3, 9),
    place("armchair-wing", 5, 9, "up"),
    place("side-table", 6, 9),
    place("armchair-wing", 7, 9, "up"),
    place("reading-lamp", 8, 9),
    place("grandfather-clock", 14, 4),
    place("plant", 14, 10),
    place("bookshelf-low", 11, 9, "down"),
    // ----- Rincón de lectura: la hamaca frente al ventanal, puffs, mantas y una lámpara de pie.
    place("rug-round", 16, 4),
    place("hammock", 17, 1, "down"),
    place("beanbag", 16, 5, "up"),
    place("beanbag", 18, 5, "up"),
    place("blanket-basket", 20, 4),
    place("reading-lamp", 15, 4),
    place("bookshelf-low", 15, 8, "right"),
    place("plant", 21, 10),
    place("armchair", 20, 7, "left"),
    // ----- Sala de estar: chimenea al norte, sofá y sillones alrededor, el tocadiscos y mantas.
    place("rug-persian", 24, 3, "down"),
    place("fireplace-stone", 26, 0, "down"),
    place("record-player", 22, 0),
    place("plant", 31, 3),
    place("armchair-wing", 24, 4, "right"),
    place("coffee-table", 27, 5),
    place("armchair-wing", 30, 4, "left"),
    place("sofa-leather", 26, 7, "up"),
    place("blanket-basket", 29, 7),
    place("lamp", 23, 7),
    place("sideboard", 22, 8, "right"),
    place("guitar", 31, 10),
    // ----- Pasillo.
    place("runner", 9, 12, "down"),
    place("runner", 19, 12, "down"),
    place("plant", 0, 11),
    place("plant", 31, 11),
    place("grandfather-clock", 16, 11),
    // ----- Rellano: la escalera que baja al piso 2 y un banco junto a la ventana.
    place("stairwell", 3, 14),
    place("entry-bench", 0, 18, "right"),
    place("plant", 0, 20),
    place("plant", 7, 20),
    // ----- Sala de juegos de mesa: ajedrez, el puzle a medio armar, cartas y el estante de juegos.
    place("rug-3x3", 9, 15),
    place("chair", 9, 16, "right"),
    place("chess-table", 10, 16),
    place("chair", 11, 16, "left"),
    place("reading-lamp", 8, 14),
    place("game-shelf", 16, 14, "down"),
    place("puzzle-table", 15, 17, "right"),
    place("chair", 14, 17, "right"),
    place("chair", 14, 18, "right"),
    place("chair", 16, 17, "left"),
    place("chair", 16, 18, "left"),
    place("beanbag", 9, 19, "up"),
    place("beanbag", 11, 19, "up"),
    place("plant", 19, 20),
    place("lamp", 19, 14),
    // ----- Terraza: barandas, jardineras, tumbonas y el telescopio mirando al lago.
    ...Array.from({ length: TERRAZA.h }, (_, i) => place("railing", TERRAZA.x + TERRAZA.w - 1, TERRAZA.y + i, "right")),
    ...Array.from({ length: TERRAZA.w }, (_, i) => place("railing", TERRAZA.x + i, TERRAZA.y + TERRAZA.h - 1, "down")),
    place("planter", 20, 14, "down"),
    place("planter", 28, 14, "down"),
    place("telescope", 29, 16),
    place("deck-chair", 22, 17, "right"),
    place("deck-chair", 22, 18, "right"),
    place("cafe-table", 26, 18),
    place("chair", 25, 18, "right"),
    place("chair", 27, 18, "left"),
    place("plant", 20, 19),
    place("bonsai", 30, 19),
  ],
  portals: [
    {
      id: "piso-3-escalera",
      label: "Bajar al piso 2",
      tiles: CONEXIONES.piso3.escaleraAbajo.tiles,
      to: hacia("piso-2", CONEXIONES.piso2.escaleraArriba),
    },
  ],
  points: [],
};
