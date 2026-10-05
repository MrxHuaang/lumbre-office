import { casaAreaOf } from "@hyvento/shared";
import type { AreaDef, Placement, Rect, RoomDef, ZoneDef } from "../types";
import { place } from "./place";
import { CASA_CONEXIONES } from "./casa-propia-conexiones";

// ---------- La casa de cada persona: segundo piso ----------
// Ver docs/plan-casas.md. Arriba (contra la pared alta del norte) la alcoba con la cama doble, el baño con
// la tina (también se entra desde la alcoba), el estudio con el PC de Hyvento OS y el cuarto de música.
// Abajo, el cuarto de huéspedes (contra la pared alta del oeste), el pasillo con la escalera, el cuarto de
// los amigos (para quedarse después de la fiesta) y el balcón, que se abre desde el cuarto de música.

const W = 26;
const H = 14;
const ALCOBA: Rect = { x: 0, y: 0, w: 9, h: 8 };
const BANO: Rect = { x: 9, y: 0, w: 4, h: 8 };
const ESTUDIO: Rect = { x: 13, y: 0, w: 6, h: 8 };
const MUSICA: Rect = { x: 19, y: 0, w: 7, h: 8 };
const HUESPEDES: Rect = { x: 0, y: 8, w: 6, h: 6 };
const PASILLO: Rect = { x: 6, y: 8, w: 8, h: 6 };
const AMIGOS: Rect = { x: 14, y: 8, w: 6, h: 6 };
const BALCON: Rect = { x: 20, y: 8, w: 6, h: 6 };

const ROOMS: [key: string, name: string, rect: Rect, floor: RoomDef["floor"], wallpaper: RoomDef["wallpaper"]][] = [
  ["alcoba", "Alcoba", ALCOBA, "wood", "sage"],
  ["bano", "Baño", BANO, "mosaic", "tile"],
  ["estudio", "Estudio", ESTUDIO, "parquet", "slats"],
  ["musica", "Cuarto de música", MUSICA, "moquette", "damask"],
  ["huespedes", "Cuarto de huéspedes", HUESPEDES, "planks", "rose"],
  ["pasillo", "Pasillo", PASILLO, "planks", "colonial"],
  ["amigos", "Cuarto de los amigos", AMIGOS, "carpet", "blue"],
  ["balcon", "Balcón", BALCON, "terrace", "colonial"],
];

/** Baranda en el borde de afuera de un tile del balcón: este o sur (como el balcón del piso 2). */
const railing = (x: number, y: number, side: "e" | "s") => place("railing", x, y, side === "e" ? "right" : "down");

/** Las barandas del balcón: el costado este y el frente, con la esquina en un solo mueble. */
function balconyRailings(r: Rect): Placement[] {
  const last = r.y + r.h - 1;
  return [
    ...Array.from({ length: r.h - 1 }, (_, i) => railing(r.x + r.w - 1, r.y + i, "e")),
    ...Array.from({ length: r.w - 1 }, (_, i) => railing(r.x + i, last, "s")),
    place("railing-corner", r.x + r.w - 1, last, "right"),
  ];
}

/** El segundo piso de la casa de `userId` (`casa:<userId>:arriba`). */
export function casaArriba(userId: string): AreaDef {
  const id = casaAreaOf(userId, "arriba");
  const rid = (key: string) => `${id}:${key}`;
  const zones: ZoneDef[] = ROOMS.map(([key, name, rect]) => ({ id: rid(key), name, type: "common", rect, isolated: false }));
  return {
    id,
    name: "Tu casa · segundo piso",
    width: W,
    height: H,
    rooms: ROOMS.map(([key, , rect, floor, wallpaper]) => ({ id: rid(key), rect, floor, wallpaper })),
    doors: [
      { edge: "h", x: 6, y: 8 }, // alcoba ↔ pasillo
      { edge: "v", x: 9, y: 3 }, // alcoba ↔ baño
      { edge: "h", x: 10, y: 8 }, // baño ↔ pasillo
      { edge: "h", x: 13, y: 8 }, // estudio ↔ pasillo
      { edge: "v", x: 19, y: 4, width: 2 }, // estudio ↔ música
      { edge: "h", x: 22, y: 8, width: 2 }, // música ↔ balcón
      { edge: "v", x: 6, y: 11, width: 2 }, // pasillo ↔ huéspedes
      { edge: "v", x: 14, y: 10, width: 2 }, // pasillo ↔ amigos
    ],
    zones,
    features: [
      // Alcoba: un cuadro, la ventana sobre el tocador y un retrato al oeste.
      { kind: "picture", edge: "h", x: 1, y: 0 },
      { kind: "window", edge: "h", x: 5, y: 0, width: 2 },
      { kind: "portrait", edge: "v", x: 0, y: 5 },
      // Baño: el espejo sobre el lavamanos y la ventanita.
      { kind: "window", edge: "h", x: 11, y: 0 },
      { kind: "mirror", edge: "h", x: 9, y: 0 },
      // Estudio: la repisa y la ventana.
      { kind: "shelf", edge: "h", x: 13, y: 0 },
      { kind: "window", edge: "h", x: 16, y: 0 },
      // Cuarto de música: un afiche y la ventana.
      { kind: "poster", edge: "h", x: 22, y: 0 },
      { kind: "window", edge: "h", x: 24, y: 0, width: 2 },
      // Huéspedes: un cuadro y la ventana al oeste.
      { kind: "window", edge: "v", x: 0, y: 9 },
      { kind: "picture", edge: "v", x: 0, y: 12 },
    ],
    furniture: [
      // ----- Alcoba: la cama doble con la cabecera al oeste y sus mesitas, el baúl a los pies, el armario,
      // el tocador bajo la ventana, un sillón y la lámpara.
      place("side-table", 0, 1),
      place("cama-doble", 0, 2, "right"),
      place("side-table", 0, 4),
      place("rug-2x3", 2, 2),
      place("baul", 3, 2),
      place("armario", 3, 0, "down"),
      place("tocador", 6, 0, "down"),
      place("lamp", 8, 0),
      place("floor-mirror", 8, 1),
      place("armchair", 7, 5, "left"),
      place("cat-bed", 8, 7),
      place("pet-bed", 6, 6),
      place("snake-plant", 0, 7),
      place("blanket-basket", 1, 6),
      place("fiddle-fig", 8, 4),
      // ----- Baño: la tina contra la pared del fondo, el lavamanos, el inodoro y el toallero.
      place("tina-bano", 11, 0),
      place("vanity", 9, 6, "right"),
      place("toilet", 12, 6, "left"),
      place("towel-rack", 12, 3),
      place("succulents", 9, 0),
      // ----- Estudio: el escritorio con el PC (Hyvento OS) y su silla, la estantería, el sillón de leer.
      place("desk-pc", 14, 0, "down"),
      place("office-chair", 14, 1, "up"),
      place("bookcase-tall", 17, 0, "down"),
      place("rug-3x3", 14, 3),
      place("armchair-wing", 17, 2, "left"),
      place("reading-lamp", 18, 2),
      place("globe", 13, 5),
      place("filing-cabinet", 18, 7),
      // ----- Cuarto de música: el piano, la guitarra, el tocadiscos y donde sentarse a oír.
      place("piano", 20, 0, "down"),
      place("guitar", 23, 0),
      place("record-player", 24, 0),
      place("bookshelf-low", 25, 1, "left"),
      place("rug-round", 21, 3),
      place("beanbag", 22, 3),
      place("sofa", 25, 4, "left"),
      place("easel", 19, 7),
      // ----- Huéspedes: la cama sencilla, el baúl, el armario y una lámpara.
      place("cama-sencilla", 0, 9, "right"),
      place("side-table", 0, 10),
      place("baul", 2, 9),
      place("armario", 5, 8, "left"),
      place("rug-round", 1, 11),
      place("lamp", 0, 13),
      place("monstera", 5, 13),
      // ----- Pasillo: la escalera que baja, una mata y la alfombra.
      place("stairwell", 7, 8),
      place("kentia", 9, 8),
      place("grandfather-clock", 11, 8),
      place("runner", 8, 12, "down"),
      place("pothos", 6, 13),
      // ----- Cuarto de los amigos: dos camas sencillas, la mesita entre las dos, el armario y el tocador.
      place("cama-sencilla", 18, 8, "left"),
      place("side-table", 19, 10),
      place("cama-sencilla", 18, 11, "left"),
      place("tocador", 16, 8, "down"),
      place("armario", 14, 12, "right"),
      place("rug-2x3", 16, 10),
      place("beanbag", 16, 13),
      // ----- Balcón: las barandas, dos tumbonas, el telescopio y las jardineras.
      ...balconyRailings(BALCON),
      place("deck-chair", 20, 10),
      place("deck-chair", 20, 11),
      place("stargazer-scope", 24, 9),
      place("balcony-planter", 20, 12, "down"),
      place("patio-table", 23, 11),
      place("patio-chair", 22, 11, "right"),
    ],
    portals: [
      {
        id: "casa-bajar",
        label: "Bajar al primer piso",
        tiles: CASA_CONEXIONES.arriba.escalera.tiles,
        to: { area: casaAreaOf(userId, "abajo"), ...CASA_CONEXIONES.abajo.escalera.llegada },
      },
    ],
    // Frente a cada armario: E abre el vestidor (cambiarse de ropa como en el probador de la tienda).
    points: [
      { type: "wardrobe", name: "Armario", x: 3, y: 1, zone: rid("alcoba") },
      { type: "wardrobe", name: "Armario", x: 4, y: 9, zone: rid("huespedes") },
      { type: "wardrobe", name: "Armario", x: 15, y: 12, zone: rid("amigos") },
    ],
  };
}
