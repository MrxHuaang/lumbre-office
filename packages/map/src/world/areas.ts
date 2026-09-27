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
/** Huerto (fase 5): dos filas de cuatro parcelas al oeste del sendero, con un pasillo al medio. */
const PLOTS = [16, 18].flatMap((y) => [6, 7, 8, 9].map((x) => ({ x, y })));
/**
 * Estanque (fase 5) al este del sendero: agua que no se camina (una elipse con el borde ondulado) y un
 * muelle de dos tablas que entra desde la orilla sur.
 */
const POND = { cx: 25, cy: 16.5, rx: 4.3, ry: 2.9 };
const DOCK = { x: 24, y: 16, w: 2, h: 3 };
const isDock = (x: number, y: number) => x >= DOCK.x && x < DOCK.x + DOCK.w && y >= DOCK.y && y < DOCK.y + DOCK.h;
function isPond(x: number, y: number): boolean {
  const dx = (x + 0.5 - POND.cx) / POND.rx;
  const dy = (y + 0.5 - POND.cy) / POND.ry;
  return Math.hypot(dx, dy) <= 1 + 0.14 * Math.sin(3 * Math.atan2(dy, dx) + 1);
}

const gardenFurniture: Placement[] = [
  place("cabin", CABIN.x, CABIN.y),
  ...[9, 10, 11, 12, 19, 20, 21, 22].map((x) => place("flowerbed", x, PORCH_Y, "down")),
  place("mailbox", 13, PORCH_Y + 2, "down"),
  place("notice-board", 18, PORCH_Y + 2, "down"),
  place("lamp-post", 14, 18),
  place("lamp-post", 17, 18),
  place("bench", 20, 16, "down"),
  ...PLOTS.map((p) => place("garden-plot", p.x, p.y)),
  place("scarecrow", 10, 16, "down"),
  place("water-barrel", 10, 18),
  place("tree", 2, 2),
  place("tree", 4, 8),
  place("tree", 2, 13),
  place("tree", 4, 20),
  place("tree", 27, 3),
  place("tree", 29, 9),
  place("tree", 29, 20),
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
  ground: (x, y) => {
    if (isDock(x, y)) return "dock";
    if (isPond(x, y)) return "water";
    return (PATH_X.includes(x) && y >= PORCH_Y) || (y === PORCH_Y && x >= 14 && x <= 17) ? "path" : "grass";
  },
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
    // Una por parcela, en el mismo orden que PLOTS (el índice es el id de la parcela).
    ...PLOTS.map((p, i) => ({ type: "garden_plot" as const, name: `Parcela ${i + 1}`, x: p.x, y: p.y })),
    // La punta del muelle, mirando al agua.
    { type: "fishing_spot", name: "Muelle", x: DOCK.x, y: DOCK.y },
    { type: "fishing_spot", name: "Muelle", x: DOCK.x + 1, y: DOCK.y },
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

// ---------- Sótano: casino, club y cine ----------
// Se baja por la escalera del recibidor y se llega al casino (arriba a la izquierda): la ruleta y el
// blackjack al centro, tragamonedas contra las paredes del fondo, la caja, una mesa de póker, la fuente
// y un rincón con sofás. Una puerta lleva al club (arriba a la derecha: la barra, la cabina de DJ y el
// tubo) y otra al cine (abajo: la pantalla con telón en la pared oeste y filas de butacas).

const CASINO_ROOM = { x: 0, y: 0, w: 18, h: 12 };
const CLUB_ROOM = { x: 18, y: 0, w: 10, h: 12 };
const CINEMA_ROOM = { x: 0, y: 12, w: 16, h: 6 };
/** Arcade (fase 5): abajo a la derecha, con puertas al club y al cine. */
const ARCADE_ROOM = { x: 16, y: 12, w: 12, h: 6 };
/** Máquinas de arcade contra la pared del club (miran hacia el sur); se juega parado delante. */
const ARCADE_CABINETS = [17, 18, 22, 23, 24, 25].map((x) => ({ x, y: ARCADE_ROOM.y }));

const ROULETTE = { x: 5, y: 4 };
const BLACKJACK = { x: 11, y: 4 };
/**
 * Banquetas del blackjack en el orden de los asientos 1 a 5: una en la punta de arriba, tres frente a la
 * mesa y una en la punta de abajo (el crupier es automático, del otro lado).
 */
export const BLACKJACK_SEATS: readonly { x: number; y: number; facing: "left" | "down" | "up" }[] = [
  { x: BLACKJACK.x + 1, y: BLACKJACK.y - 1, facing: "down" },
  { x: BLACKJACK.x + 2, y: BLACKJACK.y, facing: "left" },
  { x: BLACKJACK.x + 2, y: BLACKJACK.y + 1, facing: "left" },
  { x: BLACKJACK.x + 2, y: BLACKJACK.y + 2, facing: "left" },
  { x: BLACKJACK.x + 1, y: BLACKJACK.y + 3, facing: "up" },
];
const POKER = { x: 3, y: 8 };
/** Tarima del club, de 3x3, con el tubo en el tile del medio. */
const STAGE = { x: 22, y: 5 };
/** Columnas de butacas del cine (miran a la pantalla, al oeste) y filas que ocupan. */
const CINEMA_COLUMNS = [4, 6, 8, 10];
const CINEMA_ROWS = [13, 14, 15, 16];

const sotano: AreaDef = {
  id: "sotano",
  name: "Sótano",
  width: 28,
  height: 18,
  rooms: [
    { id: "casino", rect: CASINO_ROOM, floor: "casino", wallpaper: "wine" },
    { id: "club", rect: CLUB_ROOM, floor: "dance", wallpaper: "violet" },
    { id: "cine", rect: CINEMA_ROOM, floor: "cinema", wallpaper: "navy" },
    { id: "arcade", rect: ARCADE_ROOM, floor: "arcade", wallpaper: "violet" },
  ],
  doors: [
    { edge: "v", x: CLUB_ROOM.x, y: 5, width: 2 },
    { edge: "h", x: 10, y: CINEMA_ROOM.y, width: 2 },
    { edge: "h", x: 19, y: ARCADE_ROOM.y, width: 2 },
    { edge: "v", x: ARCADE_ROOM.x, y: 14, width: 2 },
  ],
  zones: [
    { id: "casino", name: "Casino", type: "common", rect: CASINO_ROOM, isolated: false },
    { id: "club", name: "Club", type: "common", rect: CLUB_ROOM, isolated: true },
    { id: "cine", name: "Cine", type: "common", rect: CINEMA_ROOM, isolated: true },
    { id: "arcade", name: "Arcade", type: "common", rect: ARCADE_ROOM, isolated: false },
  ],
  features: [
    // Casino: letreros de neón sobre los tragamonedas, reloj y cuadros.
    { kind: "clock", edge: "h", x: 4, y: 0 },
    { kind: "neon", edge: "h", x: 6, y: 0, width: 4, text: "JACKPOT" },
    { kind: "picture", edge: "h", x: 11, y: 0 },
    { kind: "picture", edge: "h", x: 15, y: 0 },
    { kind: "neon", edge: "v", x: 0, y: 5, width: 4, text: "CASINO" },
    { kind: "picture", edge: "v", x: 0, y: 10 },
    // Club: el letrero sobre la cabina de DJ y afiches junto a la barra.
    { kind: "poster", edge: "h", x: 18, y: 0 },
    { kind: "neon", edge: "h", x: 23, y: 0, width: 4, text: "CLUB" },
    // Cine: la pantalla ocupa toda la pared oeste.
    { kind: "cinema-screen", edge: "v", x: 0, y: CINEMA_ROOM.y, width: CINEMA_ROOM.h },
  ],
  furniture: [
    // ---- Casino ----
    place("stairs-up", 1, 0),
    ...[6, 7, 8, 9].map((x) => place("slot-machine", x, 0, "down")),
    ...[5, 6, 7, 8].map((y) => place("slot-machine", 0, y)),
    place("lamp", 4, 0),
    place("lamp", 11, 0),
    place("casino-cashier", 13, 0, "down"),
    place("fortune-wheel", 16, 0, "down"),
    place("palm", 17, 0),
    place("roulette-table", ROULETTE.x, ROULETTE.y),
    place("blackjack-table", BLACKJACK.x, BLACKJACK.y),
    // Banquetas del blackjack (ver BLACKJACK_SEATS), mirando a la mesa.
    ...BLACKJACK_SEATS.map((s) => place("stool", s.x, s.y, s.facing)),
    // Póker de adorno, con banquetas a los dos lados para sentarse a conversar.
    place("poker-table", POKER.x, POKER.y),
    ...[0, 1, 2].map((dy) => place("stool", POKER.x - 1, POKER.y + dy, "right")),
    ...[0, 1, 2].map((dy) => place("stool", POKER.x + 2, POKER.y + dy, "left")),
    place("coin-fountain", 8, 8),
    // Rincón de sofás frente a frente con una mesita.
    place("lounge-sofa", 14, 8, "down"),
    place("cocktail-table", 14, 9),
    place("lounge-sofa", 14, 10, "up"),
    // Cordones a los lados de la puerta del club y afiches junto a la del cine.
    place("velvet-rope", 17, 4),
    place("velvet-rope", 17, 7),
    place("poster-stand", 9, 11, "down"),
    place("poster-stand", 12, 11, "down"),
    place("palm", 0, 11),
    place("palm", 17, 11),
    // ---- Club ----
    place("lamp-mushroom", 18, 0),
    place("bar-shelf", 19, 0, "down"),
    place("bar-shelf", 21, 0, "down"),
    ...[19, 20, 21, 22].map((x) => place("bar-counter", x, 1, "down")),
    ...[19, 20, 21, 22].map((x) => place("stool", x, 2, "up")),
    place("speaker", 23, 0, "down"),
    place("dj-booth", 24, 0, "down"),
    place("speaker", 26, 0, "down"),
    place("palm", 27, 0),
    place("pole-stage", STAGE.x, STAGE.y),
    place("dance-pole", STAGE.x + 1, STAGE.y + 1),
    // Sofás alrededor de la tarima.
    place("lounge-sofa", 19, 8),
    place("lounge-sofa", 26, 5, "left"),
    place("lounge-sofa", 22, 10, "up"),
    place("cocktail-table", 20, 8),
    place("cocktail-table", 26, 8),
    place("cocktail-table", 24, 10),
    place("speaker", 18, 11, "down"),
    place("speaker", 27, 11, "down"),
    // ---- Cine ----
    ...CINEMA_COLUMNS.flatMap((x) => CINEMA_ROWS.map((y) => place("cinema-seat", x, y, "left"))),
    place("speaker", 1, CINEMA_ROOM.y),
    place("speaker", 1, CINEMA_ROOM.y + CINEMA_ROOM.h - 1),
    place("projector", 13, 14, "left"),
    place("popcorn-machine", 15, CINEMA_ROOM.y, "down"),
    place("plant", 15, CINEMA_ROOM.y + CINEMA_ROOM.h - 1),
    // ---- Arcade ----
    ...ARCADE_CABINETS.map((c) => place("arcade-cabinet", c.x, c.y, "down")),
    place("claw-machine", 26, ARCADE_ROOM.y, "down"),
    place("claw-machine", 27, ARCADE_ROOM.y, "down"),
    place("plant", 16, ARCADE_ROOM.y),
    place("air-hockey", 20, 15, "down"),
    place("beanbag", 25, 16, "up"),
    place("beanbag", 26, 16, "up"),
    place("lamp-mushroom", 16, 17),
    place("lamp-mushroom", 27, 17),
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
    // Sobre la tarima, alrededor del tubo: ahí se baila.
    ...[
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [2, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ].map(([dx, dy]) => ({ type: "pole_stage" as const, name: "Escenario", x: STAGE.x + dx!, y: STAGE.y + dy! })),
    { type: "casino_cashier", name: "Caja", x: 13, y: 1 },
    { type: "casino_cashier", name: "Caja", x: 14, y: 1 },
    // Delante de cada máquina del arcade, en el orden de ARCADE_CABINETS.
    ...ARCADE_CABINETS.map((c, i) => ({ type: "arcade" as const, name: `Máquina ${i + 1}`, x: c.x, y: c.y + 1 })),
    // Junto al proyector: desde ahí se elige qué se ve en el cine.
    { type: "cinema", name: "Proyector", x: 14, y: 14 },
  ],
};

export const AREAS: AreaDef[] = [jardin, plantaBaja, piso2, sotano];
/** Donde aparece todo el mundo al entrar. */
export const SPAWN_AREA = "jardin";
