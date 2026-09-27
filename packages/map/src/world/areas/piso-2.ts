import type { AreaDef, Placement, WallFeature, WallpaperKind, ZoneDef } from "../types";
import { place } from "./place";
import { CONEXIONES, hacia } from "./conexiones";

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

export const piso2: AreaDef = {
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
      tiles: CONEXIONES.piso2.escaleraAbajo.tiles,
      to: hacia("planta-baja", CONEXIONES.plantaBaja.escaleraArriba),
    },
    {
      id: "piso-2-escalera-arriba",
      label: "Subir al piso 3",
      tiles: CONEXIONES.piso2.escaleraArriba.tiles,
      to: hacia("piso-3", CONEXIONES.piso3.escaleraAbajo),
    },
  ],
  points: [],
};
