// Los niveles de la cabaña. Ver docs/plan-cabana.md para qué hace cada sala.
import type { AreaDef, Facing, Placement, WallFeature, WallpaperKind, ZoneDef } from "./types";

const place = (type: string, x: number, y: number, facing: Facing = "right"): Placement => ({ type, x, y, facing });

// ---------- Jardín ----------

const GARDEN_W = 32;
const GARDEN_H = 28;
/** La cabaña de dos plantas ocupa x 8..23, y 2..11; su puerta da al sendero. */
const CABIN = { x: 8, y: 2, w: 16, d: 10 };
const PATH_X = [15, 16];
const PORCH_Y = CABIN.y + CABIN.d;
const FENCE_FROM = 15;

const gardenFurniture: Placement[] = [
  place("cabin", CABIN.x, CABIN.y),
  ...[9, 10, 11, 12, 19, 20, 21, 22].map((x) => place("flowerbed", x, PORCH_Y, "down")),
  place("mailbox", 13, PORCH_Y + 2, "down"),
  place("notice-board", 18, PORCH_Y + 2, "down"),
  place("lamp-post", 14, 18),
  place("lamp-post", 17, 18),
  place("bench", 20, 16, "down"),
  place("tree", 2, 2),
  place("tree", 4, 8),
  place("tree", 2, 13),
  place("tree", 4, 20),
  place("tree", 27, 3),
  place("tree", 29, 9),
  place("tree", 26, 19),
  place("tree", 8, 24),
  place("tree", 23, 24),
  place("pine", 26, 1),
  place("pine", 5, 1),
  place("pine", 2, 24),
  place("pine", 29, 15),
  place("pine", 28, 23),
  place("bush", 7, 4),
  place("bush", 24, 4),
  place("bush", 7, 10),
  place("bush", 24, 10),
  place("bush", 11, 22),
  place("bush", 20, 22),
  ...Array.from({ length: GARDEN_W }, (_, x) => x)
    .filter((x) => !PATH_X.includes(x))
    .map((x) => place("fence", x, GARDEN_H - 1, "down")),
  ...Array.from({ length: GARDEN_H - 1 - FENCE_FROM }, (_, i) => place("fence", 0, FENCE_FROM + i)),
  ...Array.from({ length: GARDEN_H - 1 - FENCE_FROM }, (_, i) => place("fence", GARDEN_W - 1, FENCE_FROM + i)),
];

const jardin: AreaDef = {
  id: "jardin",
  name: "Jardín",
  width: GARDEN_W,
  height: GARDEN_H,
  outdoor: true,
  ground: (x, y) => (PATH_X.includes(x) && y >= PORCH_Y) || (y === PORCH_Y && x >= 14 && x <= 17) ? "path" : "grass",
  rooms: [],
  doors: [],
  zones: [{ id: "jardin", name: "Jardín", type: "common", rect: { x: 0, y: 0, w: GARDEN_W, h: GARDEN_H }, isolated: false }],
  features: [],
  furniture: gardenFurniture,
  portals: [
    {
      id: "jardin-casa",
      label: "Entrar a la cabaña",
      tiles: PATH_X.map((x) => ({ x, y: PORCH_Y })),
      to: { area: "planta-baja", x: 4, y: 15, facing: "up" },
    },
  ],
  points: [
    { type: "spawn", name: "Entrada del jardín", x: 15, y: 24 },
    { type: "task_board", name: "Tablón", x: 18, y: PORCH_Y + 3 },
    { type: "mailbox", name: "Buzón", x: 13, y: PORCH_Y + 3 },
  ],
};

// ---------- Planta baja ----------

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

// La cafetería (mitad norte, y 0..9) y la tienda (mitad sur, y 10..16) comparten el ala este. Del
// recibidor se entra a la tienda y de ahí, por la puerta del medio, a la cafetería.
const CAFE = { x: 9, y: 0, w: 12, h: 10 };
const SHOP = { x: 9, y: 10, w: 12, h: 7 };

// Dos filas de mesas con un pasillo delante de la barra (y = 3) y otro al medio (x 14..15) que lleva a la
// puerta de la tienda.
const tables = [cafeTable(1, 12, 5), cafeTable(2, 17, 5), cafeTable(3, 12, 8), cafeTable(4, 17, 8)];

const plantaBaja: AreaDef = {
  id: "planta-baja",
  name: "Planta baja",
  width: 21,
  height: 18,
  rooms: [
    { id: "reuniones", rect: { x: 0, y: 0, w: 9, h: 8 }, floor: "carpet", wallpaper: "blue" },
    { id: "cafeteria", rect: CAFE, floor: "tiles", wallpaper: "cream" },
    { id: "tienda", rect: SHOP, floor: "carpet", wallpaper: "rose" },
    { id: "recibidor", rect: { x: 0, y: 8, w: 9, h: 9 }, floor: "wood", wallpaper: "sage" },
  ],
  doors: [
    { edge: "h", x: 4, y: 8, width: 2 },
    { edge: "v", x: 9, y: 12, width: 2 },
    { edge: "h", x: 14, y: SHOP.y, width: 2 },
    { edge: "h", x: 4, y: 17, width: 2 },
  ],
  thresholds: [
    { x: 4, y: 17 },
    { x: 5, y: 17 },
  ],
  zones: [
    {
      id: "meeting-main",
      name: "Sala de reuniones",
      type: "meeting",
      rect: { x: 0, y: 0, w: 9, h: 8 },
      isolated: true,
      door: { x: 4, y: 8 },
    },
    { id: "cafeteria", name: "Cafetería", type: "common", rect: CAFE, isolated: false },
    { id: "tienda", name: "Tienda", type: "common", rect: SHOP, isolated: false },
    { id: "recibidor", name: "Recibidor", type: "common", rect: { x: 0, y: 8, w: 9, h: 10 }, isolated: false },
    ...tables.map((t) => t.zone),
  ],
  features: [
    { kind: "screen", edge: "h", x: 3, y: 0, width: 3 },
    { kind: "whiteboard", edge: "v", x: 0, y: 2, width: 3 },
    { kind: "menu", edge: "h", x: 10, y: 0, width: 3 },
    { kind: "clock", edge: "h", x: 13, y: 0 },
    { kind: "window", edge: "h", x: 15, y: 0, width: 2 },
    { kind: "picture", edge: "h", x: 20, y: 0 },
    { kind: "board", edge: "v", x: 0, y: 13, width: 2 },
    { kind: "picture", edge: "v", x: 0, y: 16 },
  ],
  furniture: [
    // Sala de reuniones: mesa larga frente a la pantalla.
    place("meeting-table", 3, 3, "down"),
    place("chair", 3, 2, "down"),
    place("chair", 4, 2, "down"),
    place("chair", 5, 2, "down"),
    place("chair", 3, 5, "up"),
    place("chair", 4, 5, "up"),
    place("chair", 5, 5, "up"),
    place("chair", 2, 3, "right"),
    place("chair", 2, 4, "right"),
    place("chair", 6, 3, "left"),
    place("chair", 6, 4, "left"),
    place("plant", 0, 0),
    place("plant", 8, 0),
    // Cafetería: barra, rincón de la chimenea y mesas.
    place("counter", 10, 1, "down"),
    place("counter-coffee", 11, 1, "down"),
    place("counter", 12, 1, "down"),
    place("pastry-case", 13, 1, "down"),
    place("counter", 14, 1, "down"),
    place("stool", 10, 2, "up"),
    place("stool", 12, 2, "up"),
    place("stool", 14, 2, "up"),
    place("rug-2x3", 17, 1, "down"),
    place("fireplace", 18, 0, "down"),
    place("armchair", 18, 2, "up"),
    place("armchair", 19, 2, "up"),
    ...tables.flatMap((t) => t.furniture),
    place("plant", 20, 4),
    // Tienda: estante y mostrador junto a la puerta del recibidor, la ropa y el probador al fondo, y un
    // sofá para esperar a quien se está probando algo.
    place("display-shelf", 9, 10, "down"),
    place("shop-counter", 11, 10, "down"),
    place("plant", 13, 10),
    place("clothes-rack", 17, 10, "down"),
    place("fitting-booth", 19, 10, "down"),
    place("clothes-rack", 17, 13, "right"),
    place("sofa", 9, 14, "right"),
    place("rug-round", 10, 14),
    place("lamp", 9, 16),
    place("plant", 20, 16),
    // Recibidor: escalera al piso 2, bajada al sótano (el casino) y alfombra de bienvenida.
    place("stairs-up", 0, 9),
    place("stairwell", 6, 9),
    place("rug-2x3", 3, 14, "down"),
    place("lamp", 8, 8),
    place("plant", 8, 16),
  ],
  portals: [
    {
      id: "planta-baja-salida",
      label: "Salir al jardín",
      tiles: [
        { x: 4, y: 17 },
        { x: 5, y: 17 },
      ],
      to: { area: "jardin", x: 15, y: 14, facing: "down" },
    },
    {
      id: "planta-baja-escalera",
      label: "Subir al piso 2",
      tiles: [
        { x: 0, y: 12 },
        { x: 1, y: 12 },
      ],
      to: { area: "piso-2", x: 9, y: 5, facing: "down" },
    },
    {
      id: "planta-baja-sotano",
      label: "Bajar al casino",
      tiles: [
        { x: 6, y: 12 },
        { x: 7, y: 12 },
      ],
      to: { area: "sotano", x: 2, y: 4, facing: "down" },
    },
  ],
  points: [
    { type: "screen", name: "Pantalla de la sala", x: 4, y: 0, zone: "meeting-main" },
    // Frente a la cafetera y a la vitrina, entre los taburetes: ahí se pide.
    { type: "cafe_counter", name: "Barra", x: 11, y: 2 },
    { type: "cafe_counter", name: "Barra", x: 13, y: 2 },
    // Frente al mostrador (comprar) y a la cortina del probador (probarse ropa).
    { type: "shop_counter", name: "Mostrador", x: 11, y: 11 },
    { type: "fitting_room", name: "Probador", x: 19, y: 12 },
  ],
};

// ---------- Piso 2: oficinas ----------
// Pasillo central (x 8..10) con la escalera al fondo y dos oficinas a cada lado. Las de atrás tienen
// ventana en la pared norte; las de la izquierda, en la pared oeste.

export const OFFICE_COUNT = 4;
const FLOOR2_W = 19;
const FLOOR2_D = 18;
const HALL = { x: 8, w: 3 };

interface OfficeSpec {
  rect: { x: number; y: number; w: number; h: number };
  /** Tile del pasillo justo afuera de la puerta (la puerta es el borde vertical que da al pasillo). */
  door: { x: number; y: number };
  wallpaper: WallpaperKind;
  furniture: Placement[];
  features: WallFeature[];
}

const OFFICES: OfficeSpec[] = [
  // Oficina 1: atrás a la izquierda (paredes altas al norte y al oeste).
  {
    rect: { x: 0, y: 0, w: 8, h: 9 },
    door: { x: 8, y: 6 },
    wallpaper: "cream",
    features: [
      { kind: "window", edge: "h", x: 3, y: 0, width: 2 },
      { kind: "window", edge: "v", x: 0, y: 5, width: 2 },
    ],
    furniture: [
      place("plant", 0, 0),
      place("desk-pc", 1, 0, "down"),
      place("chair", 1, 1, "up"),
      place("bookshelf", 5, 0, "down"),
      place("plant", 7, 0),
      place("rug-3x3", 2, 3),
      place("sofa", 1, 3, "right"),
      place("coffee-table", 2, 4),
      place("armchair", 4, 4, "left"),
      place("lamp", 0, 8),
      place("plant", 7, 8),
    ],
  },
  // Oficina 2: atrás a la derecha (pared alta al norte).
  {
    rect: { x: 11, y: 0, w: 8, h: 9 },
    door: { x: 10, y: 6 },
    wallpaper: "blue",
    features: [{ kind: "window", edge: "h", x: 14, y: 0, width: 2 }],
    furniture: [
      place("plant", 11, 0),
      place("bookshelf", 12, 0, "down"),
      place("desk-pc", 16, 0, "down"),
      place("chair", 16, 1, "up"),
      place("plant", 18, 0),
      place("rug-3x3", 14, 3),
      place("armchair", 14, 4, "right"),
      place("coffee-table", 15, 4),
      place("sofa", 17, 3, "left"),
      place("lamp", 18, 8),
      place("plant", 11, 8),
    ],
  },
  // Oficina 3: adelante a la izquierda (pared alta al oeste).
  {
    rect: { x: 0, y: 9, w: 8, h: 9 },
    door: { x: 8, y: 13 },
    wallpaper: "rose",
    features: [{ kind: "window", edge: "v", x: 0, y: 12, width: 2 }],
    furniture: [
      place("desk-pc", 0, 10, "right"),
      place("chair", 1, 10, "left"),
      place("plant", 0, 9),
      place("bookshelf", 0, 15, "right"),
      place("rug-3x3", 3, 12),
      place("armchair", 4, 12, "down"),
      place("coffee-table", 4, 13),
      place("sofa", 3, 15, "up"),
      place("plant", 7, 9),
      place("lamp", 7, 17),
    ],
  },
  // Oficina 4: adelante a la derecha (todas sus paredes son bajas: la más abierta).
  {
    rect: { x: 11, y: 9, w: 8, h: 9 },
    door: { x: 10, y: 13 },
    wallpaper: "sage",
    features: [],
    furniture: [
      place("bookshelf", 12, 9, "down"),
      place("desk-pc", 15, 9, "down"),
      place("chair", 15, 10, "up"),
      place("plant", 18, 9),
      place("rug-3x3", 14, 13),
      place("armchair", 15, 13, "down"),
      place("coffee-table", 15, 14),
      place("sofa", 14, 16, "up"),
      place("plant", 18, 17),
      place("lamp", 11, 17),
      place("plant", 11, 9),
    ],
  },
];

const piso2: AreaDef = {
  id: "piso-2",
  name: "Piso 2",
  width: FLOOR2_W,
  height: FLOOR2_D,
  rooms: [
    { id: "pasillo", rect: { x: HALL.x, y: 0, w: HALL.w, h: FLOOR2_D }, floor: "wood", wallpaper: "sage" },
    ...OFFICES.map((o, i) => ({ id: `office-${i + 1}`, rect: o.rect, floor: "carpet" as const, wallpaper: o.wallpaper })),
  ],
  // Cada puerta es el borde vertical entre el pasillo y la oficina (a la izquierda o a la derecha).
  doors: OFFICES.map((o) => ({ edge: "v" as const, x: o.door.x < o.rect.x ? o.rect.x : o.door.x, y: o.door.y })),
  zones: [
    ...OFFICES.map(
      (o, i): ZoneDef => ({
        id: `office-${i + 1}`,
        name: `Oficina ${i + 1}`,
        type: "office",
        rect: o.rect,
        isolated: true,
        slot: i + 1,
        door: o.door,
      }),
    ),
    { id: "pasillo", name: "Pasillo", type: "common", rect: { x: 0, y: 0, w: FLOOR2_W, h: FLOOR2_D }, isolated: false },
  ],
  features: [...OFFICES.flatMap((o) => o.features), { kind: "clock", edge: "h", x: 10, y: 0 }],
  furniture: [
    place("stairwell", HALL.x, 0),
    ...OFFICES.flatMap((o) => o.furniture),
    place("plant", 10, 17),
  ],
  portals: [
    {
      id: "piso-2-escalera",
      label: "Bajar a la planta baja",
      tiles: [
        { x: HALL.x, y: 3 },
        { x: HALL.x + 1, y: 3 },
      ],
      to: { area: "planta-baja", x: 1, y: 14, facing: "down" },
    },
  ],
  points: [],
};

// ---------- Sótano: el casino ----------
// Se baja por la escalera del recibidor. La ruleta al centro, el blackjack con cinco banquetas (tres del
// lado de las personas y una en cada punta; el crupier es automático, del otro lado), la caja al fondo
// y tragamonedas de adorno contra la pared.

const ROULETTE = { x: 5, y: 3 };
const BLACKJACK = { x: 11, y: 4 };

const sotano: AreaDef = {
  id: "sotano",
  name: "Sótano",
  width: 18,
  height: 13,
  rooms: [{ id: "casino", rect: { x: 0, y: 0, w: 18, h: 13 }, floor: "casino", wallpaper: "wine" }],
  doors: [],
  zones: [{ id: "casino", name: "Casino", type: "common", rect: { x: 0, y: 0, w: 18, h: 13 }, isolated: false }],
  features: [
    { kind: "clock", edge: "h", x: 8, y: 0 },
    { kind: "picture", edge: "h", x: 11, y: 0 },
    { kind: "picture", edge: "v", x: 0, y: 10 },
  ],
  furniture: [
    place("stairs-up", 1, 0),
    place("roulette-table", ROULETTE.x, ROULETTE.y),
    place("blackjack-table", BLACKJACK.x, BLACKJACK.y),
    // Banquetas del blackjack: tres frente a la mesa y una en cada punta, mirando a la mesa.
    place("stool", BLACKJACK.x + 2, BLACKJACK.y, "left"),
    place("stool", BLACKJACK.x + 2, BLACKJACK.y + 1, "left"),
    place("stool", BLACKJACK.x + 2, BLACKJACK.y + 2, "left"),
    place("stool", BLACKJACK.x + 1, BLACKJACK.y - 1, "down"),
    place("stool", BLACKJACK.x + 1, BLACKJACK.y + 3, "up"),
    place("casino-cashier", 14, 0, "down"),
    place("slot-machine", 0, 5),
    place("slot-machine", 0, 6),
    place("slot-machine", 0, 7),
    place("lamp", 4, 0),
    place("lamp", 17, 5),
    place("plant", 17, 0),
    place("plant", 17, 12),
    place("plant", 0, 12),
  ],
  portals: [
    {
      id: "sotano-escalera",
      label: "Subir a la planta baja",
      tiles: [
        { x: 1, y: 3 },
        { x: 2, y: 3 },
      ],
      to: { area: "planta-baja", x: 7, y: 13, facing: "down" },
    },
  ],
  points: [
    // Alrededor de la mesa de ruleta (desde cualquiera de esos lugares se apuesta).
    ...[
      [ROULETTE.x - 1, ROULETTE.y],
      [ROULETTE.x - 1, ROULETTE.y + 2],
      [ROULETTE.x + 2, ROULETTE.y],
      [ROULETTE.x + 2, ROULETTE.y + 2],
      [ROULETTE.x, ROULETTE.y + 3],
      [ROULETTE.x + 1, ROULETTE.y + 3],
      [ROULETTE.x, ROULETTE.y - 1],
      [ROULETTE.x + 1, ROULETTE.y - 1],
    ].map(([x, y]) => ({ type: "roulette" as const, name: "Ruleta", x: x!, y: y! })),
    { type: "casino_cashier", name: "Caja", x: 14, y: 1 },
    { type: "casino_cashier", name: "Caja", x: 15, y: 1 },
  ],
};

export const AREAS: AreaDef[] = [jardin, plantaBaja, piso2, sotano];
/** Donde aparece todo el mundo al entrar. */
export const SPAWN_AREA = "jardin";
