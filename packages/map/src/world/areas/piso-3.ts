import type { AreaDef, BoardTableDef, Rect } from "../types";
import { place } from "./place";
import { CONEXIONES, hacia } from "./conexiones";

// ---------- Piso 3: biblioteca y descanso ----------
// Ver docs/plan-rediseno.md. Bajo el techo y más chico que los de abajo. El pasillo (y 11..13) cruza el
// piso y todas las salas se abren a él: arriba la biblioteca (con las estanterías altas contra las
// paredes del fondo) y la sala de estar; abajo el rincón de lectura (con el ventanal en la pared oeste),
// el rellano de la escalera (el mismo lugar que en los otros pisos), la sala de juegos de mesa y la
// terraza al aire libre, en la esquina sureste (sobre el techo del ala de abajo). Al final del pasillo,
// en la pared oeste, la puerta acolchada del estudio de grabación (un nivel aparte, `podcast`, más grande
// por dentro que el hueco de la puerta) con el cartel "EN EL AIRE" encima.

const W = 32;
const H = 21;
const BIBLIOTECA: Rect = { x: 0, y: 0, w: 18, h: 11 };
const ESTAR: Rect = { x: 18, y: 0, w: 14, h: 11 };
const PASILLO: Rect = { x: 0, y: 11, w: W, h: 3 };
const LECTURA: Rect = { x: 0, y: 14, w: 10, h: 7 };
const RELLANO: Rect = { x: 10, y: 14, w: 8, h: 7 };
const JUEGOS: Rect = { x: 18, y: 14, w: 7, h: 7 };
const TERRAZA: Rect = { x: 25, y: 14, w: 7, h: 7 };

/**
 * Mesas de juegos de mesa de la sala de juegos, cada una con dos sillas: la del oeste juega con
 * blancas (lado 0) y la del este con negras (lado 1). El servidor reconoce a los jugadores por estar
 * sentados en esas sillas; los espectadores miran desde los puntos "board_game" (al norte y al sur).
 */
export const BOARD_TABLES: readonly BoardTableDef[] = [
  {
    id: "ajedrez-1",
    game: "ajedrez",
    area: "piso-3",
    type: "chess-table",
    x: 19,
    y: 16,
    seats: [
      { x: 18, y: 16, facing: "right" },
      { x: 20, y: 16, facing: "left" },
    ],
  },
  {
    id: "damas-1",
    game: "damas",
    area: "piso-3",
    type: "checkers-table",
    x: 22,
    y: 18,
    seats: [
      { x: 21, y: 18, facing: "right" },
      { x: 23, y: 18, facing: "left" },
    ],
  },
];

export const piso3: AreaDef = {
  id: "piso-3",
  name: "Piso 3",
  width: W,
  height: H,
  rooms: [
    { id: "biblioteca", rect: BIBLIOTECA, floor: "parquet", wallpaper: "forest" },
    { id: "estar", rect: ESTAR, floor: "planks", wallpaper: "brick" },
    { id: "pasillo-3", rect: PASILLO, floor: "wood", wallpaper: "colonial" },
    { id: "lectura", rect: LECTURA, floor: "moquette", wallpaper: "stripes" },
    { id: "rellano-3", rect: RELLANO, floor: "parquet", wallpaper: "paneling" },
    { id: "juegos", rect: JUEGOS, floor: "checker", wallpaper: "sage" },
    { id: "terraza", rect: TERRAZA, floor: "terrace", wallpaper: "cream" },
  ],
  doors: [
    { edge: "h", x: 8, y: 11, width: 2 }, // biblioteca ↔ pasillo
    { edge: "h", x: 24, y: 11, width: 2 }, // sala de estar ↔ pasillo
    { edge: "h", x: 4, y: 14, width: 2 }, // rincón de lectura ↔ pasillo
    { edge: "h", x: 11, y: 14, width: 3 }, // rellano ↔ pasillo
    { edge: "h", x: 20, y: 14, width: 2 }, // sala de juegos ↔ pasillo
    { edge: "h", x: 26, y: 14, width: 2 }, // terraza ↔ pasillo
    // La terraza no tiene paredes hacia afuera: la cierran las barandas.
    { edge: "v", x: TERRAZA.x + TERRAZA.w, y: TERRAZA.y, width: TERRAZA.h },
    { edge: "h", x: TERRAZA.x, y: TERRAZA.y + TERRAZA.h, width: TERRAZA.w },
  ],
  zones: [
    // Rincón silencioso: lo que se habla en la biblioteca se queda en la biblioteca.
    { id: "biblioteca", name: "Biblioteca", type: "common", rect: BIBLIOTECA, isolated: true },
    { id: "estar", name: "Sala de estar", type: "common", rect: ESTAR, isolated: false },
    { id: "pasillo-3", name: "Pasillo", type: "common", rect: PASILLO, isolated: false },
    { id: "lectura", name: "Rincón de lectura", type: "common", rect: LECTURA, isolated: false },
    { id: "rellano-3", name: "Rellano", type: "common", rect: RELLANO, isolated: false },
    { id: "juegos", name: "Sala de juegos", type: "common", rect: JUEGOS, isolated: false },
    { id: "terraza", name: "Terraza", type: "common", rect: TERRAZA, isolated: false },
  ],
  features: [
    // Biblioteca: una ventana entre las estanterías del norte y otra al oeste.
    { kind: "window", edge: "h", x: 8, y: 0, width: 2 },
    { kind: "window", edge: "v", x: 0, y: 5 },
    // Sala de estar.
    { kind: "window", edge: "h", x: 19, y: 0, width: 2 },
    { kind: "portrait", edge: "h", x: 21, y: 0 },
    { kind: "picture", edge: "h", x: 28, y: 0 },
    { kind: "window", edge: "h", x: 29, y: 0, width: 2 },
    // Pasillo: la puerta del estudio de grabación con su cartel, en el muro del final.
    { kind: "studio-door", edge: "v", x: 0, y: 11, width: 3 },
    // Rincón de lectura: el ventanal de piso a techo en la pared oeste.
    { kind: "ventanal", edge: "v", x: 0, y: 15, width: 5 },
  ],
  furniture: [
    // ----- Biblioteca: estanterías altas contra el norte y el oeste, la escalerita, dos mesas largas con
    // lámparas verdes, cada una en su alfombra, y al sur sillones, el globo y el reloj.
    place("rug-persian", 2, 3, "down"),
    place("rug-persian", 10, 3, "down"),
    place("boston-fern", 0, 0),
    place("bookcase-tall", 1, 0, "down"),
    place("bookcase-tall", 3, 0, "down"),
    place("bookcase-tall", 5, 0, "down"),
    place("bookcase-tall", 10, 0, "down"),
    place("bookcase-tall", 12, 0, "down"),
    place("bookcase-tall", 14, 0, "down"),
    place("curio-cabinet", 16, 0, "down"),
    place("bookcase-tall", 0, 1, "right"),
    place("bookcase-tall", 0, 3, "right"),
    place("bookcase-tall", 0, 6, "right"),
    place("bookcase-tall", 0, 8, "right"),
    place("library-ladder", 4, 1, "down"),
    place("library-ladder", 1, 7, "right"),
    place("reading-table", 3, 4, "down"),
    place("reading-table", 11, 4, "down"),
    // Dos sillas por lado en cada mesa, alternadas: se lee con espacio (y se llega a cada una).
    ...[3, 5, 11, 13].map((x) => place("chair", x, 3, "down")),
    ...[4, 6, 12, 14].map((x) => place("chair", x, 6, "up")),
    place("kentia", 7, 0),
    place("globe", 3, 9),
    place("armchair-wing", 5, 9, "up"),
    place("side-table", 6, 9),
    place("armchair-wing", 7, 9, "up"),
    place("reading-lamp", 8, 9),
    place("grandfather-clock", 17, 4),
    // Dos escritorios con PC para quien no tiene oficina (sus Notas están en cualquier PC).
    place("desk-pc", 17, 5, "left"),
    place("office-chair-sage", 16, 5, "right"),
    place("desk-pc", 17, 7, "left"),
    place("office-chair-sage", 16, 7, "right"),
    place("bookshelf-low", 12, 9, "down"),
    place("armchair-wing", 15, 9, "up"),
    place("reading-lamp", 16, 9),
    place("fiddle-fig", 17, 9),
    // ----- Sala de estar: chimenea al norte, sofá y sillones alrededor, el tocadiscos y mantas.
    place("rug-persian", 22, 3, "down"),
    place("fireplace-stone", 24, 0, "down"),
    place("record-player", 18, 0),
    place("olive-tree", 23, 0),
    place("bookshelf-low", 27, 0, "down"),
    place("pothos", 31, 0),
    place("armchair-wing", 22, 4, "right"),
    place("coffee-table", 25, 5),
    place("armchair-wing", 28, 4, "left"),
    place("sofa-leather", 24, 7, "up"),
    place("blanket-basket", 27, 7),
    place("side-table", 23, 7),
    place("lamp", 21, 7),
    place("sideboard", 18, 5, "right"),
    place("guitar", 31, 10),
    place("armchair", 31, 5, "left"),
    place("reading-lamp", 31, 4),
    place("monstera", 18, 10),
    // Un rincón para escuchar discos al lado de la entrada, y la vitrina de los vinilos al este.
    place("rug-round", 19, 8),
    place("armchair-wing", 19, 8, "right"),
    place("side-table", 20, 8),
    place("beanbag", 20, 9, "up"),
    place("cat-bed", 22, 9),
    place("curio-cabinet", 31, 7, "left"),
    // ----- Pasillo.
    place("runner", 2, 12, "down"),
    place("runner", 14, 12, "down"),
    place("runner", 22, 12, "down"),
    place("snake-plant", 0, 11),
    place("kentia", 31, 11),
    place("grandfather-clock", 16, 11),
    place("plant", 11, 11),
    place("succulents", 29, 13),
    // ----- Rincón de lectura: sillón y pufs contra el ventanal, la hamaca, mantas y una lámpara de pie.
    place("rug-persian", 3, 16, "down"),
    place("rug-round", 1, 17),
    place("armchair-wing", 1, 16, "right"),
    place("reading-lamp", 1, 15),
    place("beanbag", 1, 19, "right"),
    place("side-table", 2, 16),
    place("beanbag", 3, 18, "left"),
    place("hammock", 6, 17, "right"),
    // La cama de Nube, el gato del piso 3.
    place("pet-bed", 9, 16),
    place("blanket-basket", 8, 20),
    place("bookshelf-low", 7, 14, "down"),
    place("orchid", 9, 14),
    place("fiddle-fig", 0, 14),
    place("lamp", 9, 20),
    // ----- Rellano: la escalera que baja al piso 2 y un banco para esperar.
    place("column-cactus", 10, 14),
    place("stairwell", 14, 14),
    place("bookshelf-low", 16, 14, "down"),
    place("entry-bench", 10, 18, "right"),
    place("reading-lamp", 10, 20),
    place("rug-3x3", 11, 18),
    place("pothos", 13, 20),
    place("side-table", 16, 20),
    place("armchair-wing", 17, 20, "up"),
    place("snake-plant", 17, 17),
    // ----- Sala de juegos de mesa: la mesa de ajedrez y la de damas (se juegan de verdad, ver
    // BOARD_TABLES), el puzle a medio armar y el estante de juegos.
    place("game-shelf", 22, 14, "down"),
    place("lamp", 24, 14),
    place("reading-lamp", 18, 14),
    place("rug-3x3", 18, 15),
    ...BOARD_TABLES.flatMap((t) => [place(t.type, t.x, t.y), ...t.seats.map((s) => place("chair", s.x, s.y, s.facing))]),
    place("puzzle-table", 18, 19, "right"),
    place("chair", 19, 19, "left"),
    place("chair", 19, 20, "left"),
    place("kentia", 24, 20),
    // ----- Terraza: barandas (con la esquina en un mueble), jardinera, tumbonas, la mesita y el telescopio
    // mirando al lago. Lo alto va atrás (al norte) para no tapar las tumbonas.
    ...Array.from({ length: TERRAZA.h - 1 }, (_, i) => place("railing", TERRAZA.x + TERRAZA.w - 1, TERRAZA.y + i, "right")),
    ...Array.from({ length: TERRAZA.w - 1 }, (_, i) => place("railing", TERRAZA.x + i, TERRAZA.y + TERRAZA.h - 1, "down")),
    place("railing-corner", TERRAZA.x + TERRAZA.w - 1, TERRAZA.y + TERRAZA.h - 1, "right"),
    place("monstera", 25, 14),
    place("balcony-planter", 28, 14, "down"),
    place("lamp-post", 30, 14),
    place("deck-chair", 25, 16, "right"),
    place("deck-chair", 25, 17, "right"),
    place("telescope", 30, 16),
    place("cafe-table", 29, 18),
    place("chair", 28, 18, "right"),
    place("chair", 30, 18, "left"),
    place("cactus", 25, 19),
    place("bonsai", 30, 19),
  ],
  portals: [
    {
      id: "piso-3-escalera",
      label: "Bajar al piso 2",
      tiles: CONEXIONES.piso3.escaleraAbajo.tiles,
      to: hacia("piso-2", CONEXIONES.piso2.escaleraArriba),
    },
    {
      id: "piso-3-estudio",
      label: "Entrar al estudio de grabación",
      tiles: CONEXIONES.piso3.estudio.tiles,
      to: hacia("podcast", CONEXIONES.podcast.puerta),
    },
  ],
  points: [
    // Al norte y al sur de cada mesa de juego: desde ahí se mira la partida.
    ...BOARD_TABLES.flatMap((t) =>
      [-1, 1].map((dy) => ({ type: "board_game" as const, name: t.game === "ajedrez" ? "Mesa de ajedrez" : "Mesa de damas", x: t.x, y: t.y + dy })),
    ),
  ],
};
