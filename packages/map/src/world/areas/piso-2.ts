import type { AreaDef, Placement, Rect, WallFeature, WallpaperKind, ZoneDef } from "../types";
import { place } from "./place";
import { CONEXIONES, hacia } from "./conexiones";

// ---------- Piso 2: el trabajo ----------
// Ver docs/plan-rediseno.md. El pasillo de oficinas cruza el piso de oeste a este (y 11..13) y todas
// las salas se abren a él. Arriba: las cabinas de llamada, la oficina 1, la sala de reuniones y la
// oficina 2 (con ventanas en la pared norte). Abajo: la oficina 3 (con ventana en la pared oeste), el
// rellano de las escaleras (el mismo lugar que en los otros pisos), la zona de descanso (con su balcón)
// y la oficina 4. La 4 no tiene pared alta (el frente es bajo, para ver adentro): lleva más plantas.

export const OFFICE_COUNT = 4;
const W = 40;
const H = 27;
const PASILLO: Rect = { x: 0, y: 11, w: W, h: 3 };

/** Silla de oficina de cada oficina: el tapiz combina con su papel mural. */
const OFFICE_CHAIR: Partial<Record<WallpaperKind, string>> = {
  cream: "office-chair-mustard",
  blue: "office-chair-blue",
  rose: "office-chair-rose",
  sage: "office-chair-sage",
};
const officeChair = (wallpaper: WallpaperKind) => OFFICE_CHAIR[wallpaper] ?? "office-chair";

interface OfficeSpec {
  rect: Rect;
  /** Tile del pasillo justo afuera de la puerta (la puerta es el borde horizontal que da al pasillo). */
  door: { x: number; y: number };
  wallpaper: WallpaperKind;
  furniture: Placement[];
  features: WallFeature[];
}

/**
 * Oficina de arriba (10x11, puerta al sur). Todo relativo a su esquina (ox, 0): el escritorio con PC
 * contra la ventana del norte, la estantería alta al lado y la zona de visitas hacia la puerta.
 */
function northOffice(ox: number, wallpaper: WallpaperKind, mirror = false): OfficeSpec {
  // Espejadas en x (la oficina 2 es la 1 al revés), para que cada una tenga su carácter.
  const X = (dx: number, w = 1) => (mirror ? ox + 9 - dx - (w - 1) : ox + dx);
  return {
    rect: { x: ox, y: 0, w: 10, h: 11 },
    door: { x: ox + 4, y: 11 },
    wallpaper,
    features: [
      { kind: "window", edge: "h", x: X(3, 2), y: 0, width: 2 },
      { kind: "whiteboard", edge: "h", x: X(7, 2), y: 0, width: 2 },
    ],
    furniture: [
      place("plant", X(0), 0),
      place("bookcase-tall", X(1, 2), 0, "down"),
      place("desk-pc", X(4, 2), 0, "down"),
      place(officeChair(wallpaper), X(4), 1, "up"),
      place("filing-cabinet", X(6), 0),
      place("printer", X(9), 0),
      place("reading-lamp", X(9), 3),
      place("rug-3x3", X(1, 3), 5),
      place("sofa", mirror ? ox + 9 : ox, 5, mirror ? "left" : "right"),
      place("coffee-table", X(2), 6),
      place("armchair", X(3), 5, mirror ? "right" : "left"),
      place("armchair", X(3), 7, mirror ? "right" : "left"),
      place("sideboard", mirror ? ox + 9 : ox, 8, mirror ? "left" : "right"),
      place("lamp", X(0), 10),
      place("plant", X(9), 10),
      place("monstera", X(9), 7),
    ],
  };
}

/** Oficina de abajo (10x10, puerta al norte), relativa a su esquina (ox, 14). La del oeste tiene ventana. */
function southOffice(ox: number, wallpaper: WallpaperKind, mirror = false): OfficeSpec {
  const X = (dx: number, w = 1) => (mirror ? ox + 9 - dx - (w - 1) : ox + dx);
  const oy = 14;
  return {
    rect: { x: ox, y: oy, w: 10, h: 10 },
    door: { x: ox + 4, y: oy - 1 },
    wallpaper,
    features:
      ox === 0
        ? [
            { kind: "window", edge: "v", x: 0, y: oy + 2, width: 2 },
            { kind: "picture", edge: "v", x: 0, y: oy + 6 },
          ]
        : [],
    furniture: [
      place("bookcase-tall", X(0, 2), oy, "down"),
      place("plant", X(2), oy),
      place("desk-pc", X(6, 2), oy, "down"),
      place(officeChair(wallpaper), X(6), oy + 1, "up"),
      place("filing-cabinet", X(8), oy),
      place("plant", X(9), oy + 3),
      place("rug-3x3", X(3, 3), oy + 5),
      place("sofa", X(2), oy + 5, mirror ? "left" : "right"),
      place("coffee-table", X(4), oy + 6),
      place("armchair", X(5), oy + 5, mirror ? "right" : "left"),
      place("armchair", X(5), oy + 7, mirror ? "right" : "left"),
      place("reading-lamp", X(0), oy + 5),
      place("bookshelf-low", X(0), oy + 8, mirror ? "left" : "right"),
      place("plant", X(9), oy + 9),
      place("lamp", X(8), oy + 9),
      place("monstera", X(9), oy + 6),
    ],
  };
}

const OFFICES: OfficeSpec[] = [northOffice(8, "cream"), northOffice(30, "blue", true), southOffice(0, "rose"), southOffice(30, "sage", true)];

const CABINA_1: Rect = { x: 0, y: 0, w: 4, h: 4 };
const CABINA_2: Rect = { x: 4, y: 0, w: 4, h: 4 };
const SALA_CABINAS: Rect = { x: 0, y: 4, w: 8, h: 7 };
const REUNIONES: Rect = { x: 18, y: 0, w: 12, h: 11 };
const RELLANO: Rect = { x: 10, y: 14, w: 10, h: 10 };
const DESCANSO: Rect = { x: 20, y: 14, w: 10, h: 10 };
const BALCON: Rect = { x: 21, y: 24, w: 8, h: 3 };

/** Cabina de llamada: dos sillones frente a frente, una mesita y paneles que apagan el ruido. */
function cabina(r: Rect): Placement[] {
  return [
    place("reading-lamp", r.x, r.y),
    place("plant", r.x + 3, r.y),
    place("armchair", r.x + 1, r.y + 2, "right"),
    place("cafe-table", r.x + 2, r.y + 2),
    place("armchair", r.x + 3, r.y + 2, "left"),
  ];
}

/** Baranda en el borde de afuera de un tile (el balcón): este, oeste o sur. */
const railing = (x: number, y: number, side: "e" | "w" | "s") => place("railing", x, y, side === "e" ? "right" : side === "w" ? "left" : "down");
/** Barandas alrededor de un balcón (lados y frente), con las esquinas en un solo mueble. */
function balconyRailings(r: Rect): Placement[] {
  const last = r.y + r.h - 1;
  return [
    ...Array.from({ length: r.h - 1 }, (_, i) => railing(r.x, r.y + i, "w")),
    ...Array.from({ length: r.h - 1 }, (_, i) => railing(r.x + r.w - 1, r.y + i, "e")),
    ...Array.from({ length: r.w - 2 }, (_, i) => railing(r.x + 1 + i, last, "s")),
    place("railing-corner", r.x, last, "left"),
    place("railing-corner", r.x + r.w - 1, last, "right"),
  ];
}

export const piso2: AreaDef = {
  id: "piso-2",
  name: "Piso 2",
  width: W,
  height: H,
  rooms: [
    { id: "pasillo", rect: PASILLO, floor: "wood", wallpaper: "sage" },
    { id: "cabina-1", rect: CABINA_1, floor: "carpet", wallpaper: "paneling" },
    { id: "cabina-2", rect: CABINA_2, floor: "carpet", wallpaper: "paneling" },
    { id: "sala-cabinas", rect: SALA_CABINAS, floor: "wood", wallpaper: "sage" },
    // Azul noche: la oficina 2, al lado, es azul claro, y así no se funden.
    { id: "reuniones", rect: REUNIONES, floor: "carpet", wallpaper: "navy" },
    { id: "rellano", rect: RELLANO, floor: "parquet", wallpaper: "paneling" },
    { id: "descanso", rect: DESCANSO, floor: "wood", wallpaper: "cream" },
    { id: "balcon", rect: BALCON, floor: "terrace", wallpaper: "cream" },
    ...OFFICES.map((o, i) => ({ id: `office-${i + 1}`, rect: o.rect, floor: "carpet" as const, wallpaper: o.wallpaper })),
  ],
  doors: [
    // Cada oficina: el borde horizontal entre el pasillo y la oficina (arriba o abajo del pasillo).
    ...OFFICES.map((o) => ({ edge: "h" as const, x: o.door.x, y: o.door.y < o.rect.y ? o.rect.y : o.door.y })),
    { edge: "h", x: 2, y: 4 }, // cabina 1
    { edge: "h", x: 5, y: 4 }, // cabina 2
    { edge: "h", x: 3, y: 11, width: 2 }, // sala de cabinas ↔ pasillo
    { edge: "h", x: 23, y: 11, width: 2 }, // sala de reuniones ↔ pasillo
    { edge: "h", x: 16, y: 14, width: 4 }, // rellano ↔ pasillo
    { edge: "h", x: 24, y: 14, width: 3 }, // zona de descanso ↔ pasillo
    { edge: "h", x: 24, y: 24, width: 2 }, // zona de descanso ↔ balcón
    // El balcón no tiene paredes hacia afuera: lo cierran las barandas.
    { edge: "v", x: BALCON.x, y: BALCON.y, width: BALCON.h },
    { edge: "v", x: BALCON.x + BALCON.w, y: BALCON.y, width: BALCON.h },
    { edge: "h", x: BALCON.x, y: BALCON.y + BALCON.h, width: BALCON.w },
  ],
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
    { id: "meeting-main", name: "Sala de reuniones", type: "meeting", rect: REUNIONES, isolated: true, door: { x: 23, y: 11 } },
    { id: "cabina-1", name: "Cabina 1", type: "table", rect: CABINA_1, isolated: true, door: { x: 2, y: 4 } },
    { id: "cabina-2", name: "Cabina 2", type: "table", rect: CABINA_2, isolated: true, door: { x: 5, y: 4 } },
    { id: "sala-cabinas", name: "Cabinas de llamada", type: "common", rect: SALA_CABINAS, isolated: false },
    { id: "pasillo", name: "Pasillo", type: "common", rect: PASILLO, isolated: false },
    { id: "rellano-2", name: "Rellano", type: "common", rect: RELLANO, isolated: false },
    { id: "descanso", name: "Zona de descanso", type: "common", rect: DESCANSO, isolated: false },
    { id: "balcon", name: "Balcón", type: "common", rect: BALCON, isolated: false },
  ],
  features: [
    ...OFFICES.flatMap((o) => o.features),
    { kind: "acoustic", edge: "h", x: 0, y: 0, width: 4 },
    { kind: "acoustic", edge: "v", x: 0, y: 0, width: 4 },
    { kind: "acoustic", edge: "h", x: 4, y: 0, width: 4 },
    { kind: "window", edge: "v", x: 0, y: 5, width: 2 },
    { kind: "board", edge: "v", x: 0, y: 8, width: 2 },
    // Sala de reuniones: la pantalla al centro de la pared norte, con ventanas a los lados.
    { kind: "window", edge: "h", x: 19, y: 0, width: 2 },
    { kind: "screen", edge: "h", x: 22, y: 0, width: 4 },
    { kind: "window", edge: "h", x: 27, y: 0, width: 2 },
    { kind: "window", edge: "v", x: 0, y: 12 },
  ],
  furniture: [
    ...OFFICES.flatMap((o) => o.furniture),
    // ----- Cabinas de llamada y su antesala.
    ...cabina(CABINA_1),
    ...cabina(CABINA_2),
    place("water-cooler", 0, 4),
    place("printer", 0, 7, "right"),
    place("filing-cabinet", 0, 9),
    place("filing-cabinet", 0, 10),
    place("sofa", 7, 6, "left"),
    place("coffee-table", 6, 6),
    place("plant", 7, 4),
    place("plant", 7, 10),
    // ----- Sala de reuniones: mesa larga que mira a la pantalla.
    place("sideboard", 23, 0, "down"),
    place("plant", 18, 0),
    place("plant", 29, 0),
    place("conference-table", 23, 3, "right"),
    // Tres sillas de oficina por lado (con aire entre una y otra) y dos en la cabecera: todas giran.
    ...[3, 5, 7].flatMap((y) => [place("office-chair", 22, y, "right"), place("office-chair", 25, y, "left")]),
    place("office-chair", 23, 8, "up"),
    place("office-chair", 24, 8, "up"),
    place("sideboard", 18, 4, "right"),
    place("water-cooler", 18, 8),
    place("plant", 29, 10),
    place("plant", 18, 10),
    // ----- Pasillo.
    place("runner", 2, 12, "down"),
    place("runner", 14, 12, "down"),
    place("runner", 26, 12, "down"),
    place("plant", 0, 11),
    place("plant", 17, 11),
    place("grandfather-clock", 29, 11),
    place("plant", 39, 11),
    place("plant", 20, 13),
    place("plant", 29, 13),
    // ----- Rellano: las escaleras (una sobre otra en todos los pisos: la de la izquierda baja a la planta
    // baja y la de la derecha sube al piso 3) y un rincón para esperar.
    place("plant", 10, 14),
    place("stairwell", 11, 14),
    place("grandfather-clock", 13, 14),
    place("stairs-up", 14, 14),
    place("rug-persian", 13, 18, "down"),
    place("armchair-wing", 14, 19, "down"),
    place("side-table", 15, 19),
    place("armchair-wing", 16, 19, "down"),
    place("reading-lamp", 17, 19),
    place("bookshelf-low", 10, 20, "right"),
    place("plant", 10, 23),
    place("plant", 19, 18),
    place("monstera", 19, 23),
    place("curio-cabinet", 14, 23, "down"),
    // ----- Zona de descanso: la kitchenette contra el oeste, mesa alta y sofás; sale al balcón.
    place("fridge", 20, 14),
    place("kitchen-sink", 20, 15),
    place("coffee-station", 20, 16),
    place("kitchen-counter", 20, 17),
    place("water-cooler", 20, 18),
    place("high-table", 22, 16),
    place("stool", 22, 17, "up"),
    place("stool", 23, 16, "left"),
    place("rug-3x3", 25, 19),
    place("sofa", 29, 19, "left"),
    place("coffee-table", 26, 20),
    place("armchair", 25, 20, "right"),
    place("beanbag", 26, 22, "up"),
    // Mesita para almorzar junto a la kitchenette.
    place("rug-round", 21, 20),
    place("cafe-table", 22, 21),
    place("chair", 21, 21, "right"),
    place("chair", 23, 21, "left"),
    place("plant", 29, 14),
    place("plant", 20, 23),
    place("lamp", 29, 23),
    place("cafe-sign", 28, 17),
    // Casa viva: la radio de la zona de descanso (se prende con E).
    place("radio", 28, 15),
    // ----- Balcón: barandas alrededor, la jardinera, una tumbona y una planta que no la tapa.
    // En la esquina este, la baranda se abre a la escalera exterior que baja al jardín.
    ...balconyRailings(BALCON).filter((r) => !(r.x === BALCON.x + BALCON.w - 1 && r.y === BALCON.y)),
    place("balcony-stair", BALCON.x + BALCON.w - 1, BALCON.y),
    place("balcony-planter", 22, 24, "down"),
    place("deck-chair", 22, 25, "left"),
    place("plant", 27, 25),
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
    {
      id: "piso-2-balcon",
      label: "Bajar al jardín por la escalera del balcón",
      tiles: CONEXIONES.piso2.terraza.tiles,
      to: hacia("jardin", CONEXIONES.jardin.escaleraTerraza),
    },
  ],
  points: [{ type: "screen", name: "Pantalla de la sala", x: 23, y: 0, zone: "meeting-main" }],
};
