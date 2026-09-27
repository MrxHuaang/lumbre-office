import type { AreaDef, Placement, ZoneDef } from "../types";
import { place } from "./place";

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

export const plantaBaja: AreaDef = {
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
