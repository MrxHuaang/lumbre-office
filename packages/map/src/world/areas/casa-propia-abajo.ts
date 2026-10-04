import { casaAreaOf } from "@hyvento/shared";
import type { AreaDef, Rect, RoomDef, ZoneDef } from "../types";
import { place } from "./place";
import { CASA_CONEXIONES } from "./casa-propia-conexiones";

// ---------- La casa de cada persona: primer piso ----------
// Ver docs/plan-casas.md. Habitaciones separadas con paredes y puertas, como la planta baja de la cabaña.
// Arriba (contra la pared alta del norte, donde va lo colgado) la sala con la chimenea, el comedor, la
// cocina y la sala de fiestas con la barra y la bola de discoteca, que sale al patio por la puerta de
// atrás. Abajo, el recibidor con la puerta de entrada (contra la pared alta del oeste), el pasillo con la
// escalera, el baño social y el cuarto de juegos con el billar y la rana. La cocina y la barra funcionan
// como las de la cabaña (puntos `kitchen_stove` y `club_bar`: se cocina con la despensa propia y se piden
// los tragos de la carta del bar).

const W = 26;
const H = 14;
const SALA: Rect = { x: 0, y: 0, w: 9, h: 8 };
const COMEDOR: Rect = { x: 9, y: 0, w: 6, h: 8 };
const COCINA: Rect = { x: 15, y: 0, w: 6, h: 8 };
/** La sala de fiestas (exportada: las luces de la bola de discoteca se pintan sobre su piso). */
export const FIESTAS: Rect = { x: 21, y: 0, w: 5, h: 8 };
const RECIBIDOR: Rect = { x: 0, y: 8, w: 6, h: 6 };
const PASILLO: Rect = { x: 6, y: 8, w: 8, h: 6 };
const BANO: Rect = { x: 14, y: 8, w: 4, h: 6 };
const JUEGOS: Rect = { x: 18, y: 8, w: 8, h: 6 };

const ROOMS: [key: string, name: string, rect: Rect, floor: RoomDef["floor"], wallpaper: RoomDef["wallpaper"]][] = [
  ["sala", "Sala", SALA, "parquet", "paneling"],
  ["comedor", "Comedor", COMEDOR, "planks", "cream"],
  ["cocina", "Cocina", COCINA, "hydraulic", "tile"],
  ["fiestas", "Sala de fiestas", FIESTAS, "checker", "wine"],
  ["recibidor", "Recibidor", RECIBIDOR, "brick", "colonial"],
  ["pasillo", "Pasillo", PASILLO, "planks", "colonial"],
  ["bano", "Baño social", BANO, "mosaic", "tile"],
  ["juegos", "Cuarto de juegos", JUEGOS, "wood", "forest"],
];

/** El primer piso de la casa de `userId` (`casa:<userId>:abajo`). */
export function casaAbajo(userId: string): AreaDef {
  const id = casaAreaOf(userId, "abajo");
  // Ids únicos en todo el mundo: cada habitación y zona lleva el id del nivel.
  const rid = (key: string) => `${id}:${key}`;
  const zones: ZoneDef[] = ROOMS.map(([key, name, rect]) => ({ id: rid(key), name, type: "common", rect, isolated: false }));
  // El recibidor incluye el umbral de la puerta de entrada.
  zones[4] = { ...zones[4]!, rect: { ...RECIBIDOR, h: RECIBIDOR.h + 1 } };
  return {
    id,
    name: "Tu casa · primer piso",
    width: W + 1,
    height: H + 1,
    rooms: ROOMS.map(([key, , rect, floor, wallpaper]) => ({ id: rid(key), rect, floor, wallpaper })),
    doors: [
      { edge: "v", x: 9, y: 3, width: 2 }, // sala ↔ comedor
      { edge: "v", x: 15, y: 5, width: 2 }, // comedor ↔ cocina
      { edge: "v", x: 21, y: 5, width: 2 }, // cocina ↔ fiestas
      { edge: "h", x: 2, y: 8, width: 2 }, // sala ↔ recibidor
      { edge: "v", x: 6, y: 10, width: 2 }, // recibidor ↔ pasillo
      { edge: "h", x: 10, y: 8, width: 2 }, // pasillo ↔ comedor
      { edge: "v", x: 14, y: 11 }, // pasillo ↔ baño
      { edge: "h", x: 22, y: 8, width: 2 }, // fiestas ↔ juegos
      { edge: "h", x: 2, y: H, width: 2 }, // entrada
      { edge: "v", x: W, y: 4 }, // puerta de atrás, al patio
    ],
    thresholds: [...CASA_CONEXIONES.abajo.puerta.tiles, ...CASA_CONEXIONES.abajo.atras.tiles],
    zones,
    features: [
      // Sala: un cuadro, el reloj y la ventana al norte; retrato y paisaje al oeste.
      { kind: "picture", edge: "h", x: 1, y: 0 },
      { kind: "window", edge: "h", x: 6, y: 0, width: 2 },
      { kind: "clock", edge: "h", x: 8, y: 0 },
      { kind: "portrait", edge: "v", x: 0, y: 3 },
      { kind: "map", edge: "v", x: 0, y: 6 },
      // Comedor: el cuadro sobre el aparador y la ventana.
      { kind: "picture", edge: "h", x: 10, y: 0 },
      { kind: "window", edge: "h", x: 12, y: 0, width: 2 },
      // Cocina: repisas con frascos y la ventana sobre el lavaplatos.
      { kind: "shelf", edge: "h", x: 15, y: 0, width: 2 },
      { kind: "window", edge: "h", x: 18, y: 0 },
      { kind: "shelf", edge: "h", x: 19, y: 0, width: 2 },
      // Sala de fiestas: el neón sobre la barra.
      { kind: "neon", edge: "h", x: 22, y: 0, width: 3, text: "SALUD" },
      // Recibidor: el espejo y un cuadro al oeste.
      { kind: "picture", edge: "v", x: 0, y: 9 },
      { kind: "mirror", edge: "v", x: 0, y: 12 },
    ],
    furniture: [
      // ----- Sala: la chimenea al norte, los sillones y el sofá alrededor de la mesa de centro.
      place("bookcase-tall", 0, 0, "right"),
      place("reading-lamp", 1, 0),
      place("fireplace-stone", 3, 0, "down"),
      place("fiddle-fig", 6, 0),
      place("radio", 8, 0, "down"),
      place("rug-persian", 2, 2, "down"),
      place("armchair-wing", 2, 3, "right"),
      place("coffee-table", 4, 3),
      place("armchair-wing", 6, 3, "left"),
      place("sofa-leather", 3, 5, "up"),
      place("tv-retro", 0, 3, "right"),
      place("bookshelf-low", 0, 5, "right"),
      place("blanket-basket", 7, 6),
      place("side-table", 8, 2),
      place("lamp", 8, 6),
      // ----- Comedor: la mesa de cuatro con la lámpara colgada encima, el aparador y una mata.
      place("sideboard", 10, 0, "down"),
      place("mesa-comedor", 11, 3),
      place("lampara-colgante", 11, 3),
      place("chair", 10, 3, "right"),
      place("chair", 10, 4, "right"),
      place("chair", 13, 3, "left"),
      place("chair", 13, 4, "left"),
      place("kentia", 14, 0),
      place("monstera", 14, 7),
      // ----- Cocina: la estufa, el mesón y el lavaplatos al norte, la alacena y la despensa al este y la
      // mesa auxiliar con taburetes al medio.
      place("fridge", 15, 0, "down"),
      place("kitchen-counter", 16, 0, "down"),
      place("stove", 17, 0, "down"),
      place("kitchen-sink", 18, 0, "down"),
      place("kitchen-counter", 19, 0, "down"),
      place("dish-hutch", 20, 0, "left"),
      place("pantry-shelf", 20, 2, "left"),
      place("high-table", 17, 4),
      place("stool", 16, 4, "right"),
      place("stool", 18, 4, "left"),
      place("coffee-station", 15, 7),
      // ----- Sala de fiestas: la barra con sus banquitos, el equipo de sonido, los parlantes, la bola de
      // discoteca sobre la pista y un sofá para descansar.
      place("barra-casa", 22, 0, "down"),
      place("stool", 22, 1, "up"),
      place("stool", 24, 1, "up"),
      place("speaker", 21, 0),
      place("speaker", 25, 0),
      place("bola-disco", 23, 4),
      place("sofa", 21, 2, "right"),
      place("equipo-sonido", 25, 6, "left"),
      place("plant", 21, 7),
      // ----- Recibidor: perchero, banca con zapatera, paragüero, tapete y la mesita de la entrada.
      place("coat-rack", 0, 8),
      place("entry-bench", 0, 10, "right"),
      place("umbrella-stand", 0, 12),
      place("rug-round", 2, 10),
      place("entry-table", 5, 8),
      place("plant", 5, 13),
      // ----- Pasillo: la escalera al segundo piso, el reloj de pie, la consola y la alfombra.
      place("stairs-up", 7, 8),
      place("grandfather-clock", 9, 8),
      place("pothos", 12, 8),
      place("console-table", 13, 8, "left"),
      place("runner", 8, 12, "down"),
      place("kentia", 6, 13),
      // ----- Baño social.
      place("vanity", 15, 8, "down"),
      place("toilet", 17, 8, "left"),
      place("towel-rack", 17, 12),
      place("succulents", 16, 13),
      place("floor-mirror", 14, 13),
      // ----- Cuarto de juegos: el billar, la rana, la tele con consola y los puf, el estante de juegos.
      place("mesa-billar", 19, 9),
      place("juego-rana", 24, 13),
      place("puzzle-table", 25, 8, "left"),
      place("tv-retro", 25, 11, "left"),
      place("beanbag", 23, 11),
      place("beanbag", 23, 12),
      place("game-shelf", 18, 12, "right"),
      place("lamp-mushroom", 21, 13),
    ],
    portals: [
      {
        id: "casa-salir",
        label: "Salir al antejardín",
        tiles: CASA_CONEXIONES.abajo.puerta.tiles,
        to: { area: casaAreaOf(userId), ...CASA_CONEXIONES.afuera.puerta.llegada },
      },
      {
        id: "casa-salir-atras",
        label: "Salir al patio",
        tiles: CASA_CONEXIONES.abajo.atras.tiles,
        to: { area: casaAreaOf(userId), ...CASA_CONEXIONES.afuera.atras.llegada },
      },
      {
        id: "casa-subir",
        label: "Subir al segundo piso",
        tiles: CASA_CONEXIONES.abajo.escalera.tiles,
        to: { area: casaAreaOf(userId, "arriba"), ...CASA_CONEXIONES.arriba.escalera.llegada },
      },
    ],
    points: [
      // Frente a la estufa (se cocina con la despensa de cada quien, como en la cabaña) y frente a la barra.
      { type: "kitchen_stove", name: "Estufa", x: 17, y: 1, zone: rid("cocina") },
      { type: "club_bar", name: "Barra", x: 23, y: 1, zone: rid("fiestas") },
    ],
  };
}
