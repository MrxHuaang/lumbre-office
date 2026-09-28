import type { AreaDef, Rect } from "../types";
import { place } from "./place";
import { CONEXIONES, hacia } from "./conexiones";

// ---------- Estudio de grabación ----------
// Se entra por la puerta acolchada del final del pasillo del piso 3: por dentro es mucho más grande que
// el hueco de la puerta. Un estudio de podcast cálido (madera, tela, lámparas) con lo nerd del equipo:
// la mesa grande con ocho puestos (micrófono de brazo y audífonos en cada uno), la consola de mezcla en
// la cabecera ("E · Grabar"), el escritorio del código, el sofá y los pufs del rincón, y en las paredes
// del fondo el cartel "EN EL AIRE", la ventana de estrellas y los afiches (el espacio, el viaje de los
// planetitas de madera, el mapa de los tres carriles, programación). Todo el estudio es una sala aislada;
// las reglas de la grabación (el permiso de todos, el cupo, la puerta cerrada mientras se graba) están
// en PODCAST de @hyvento/shared y las valida el servidor.

const W = 12;
const H = 11;
const ESTUDIO: Rect = { x: 0, y: 0, w: W, h: 10 };
/** La mesa grande (4x2) y sus ocho sillas, cuatro por lado. */
const MESA = { x: 4, y: 4 };

export const podcast: AreaDef = {
  id: "podcast",
  name: "Estudio de grabación",
  width: W,
  height: H,
  rooms: [{ id: "podcast", rect: ESTUDIO, floor: "planks", wallpaper: "estudio" }],
  doors: [{ edge: "h", x: 9, y: ESTUDIO.h, width: 2 }],
  thresholds: CONEXIONES.podcast.puerta.tiles,
  zones: [{ id: "podcast", name: "Estudio de grabación", type: "meeting", rect: ESTUDIO, isolated: true }],
  features: [
    // Pared norte: afiches del espacio, el cartel, la ventana de estrellas y lo de programación (la
    // pizarra queda sobre el escritorio del código).
    { kind: "acoustic", edge: "h", x: 0, y: 0 },
    { kind: "poster-planets", edge: "h", x: 1, y: 0 },
    { kind: "onair-sign", edge: "h", x: 2, y: 0, width: 3 },
    { kind: "star-window", edge: "h", x: 5, y: 0, width: 2 },
    { kind: "poster-hello", edge: "h", x: 7, y: 0, width: 2 },
    { kind: "diagram-board", edge: "h", x: 9, y: 0, width: 2 },
    { kind: "poster-duck", edge: "h", x: 11, y: 0 },
    // Pared oeste: el mapa de los tres carriles con el escudo, el diario de exploración y la fogata de
    // los planetitas de madera, la nebulosa, el mapa estelar y el cohete.
    { kind: "acoustic", edge: "v", x: 0, y: 0 },
    { kind: "lanes-map", edge: "v", x: 0, y: 1, width: 2 },
    { kind: "sword-shield", edge: "v", x: 0, y: 3 },
    { kind: "explore-log", edge: "v", x: 0, y: 4, width: 2 },
    { kind: "poster-campfire", edge: "v", x: 0, y: 6 },
    { kind: "poster-nebula", edge: "v", x: 0, y: 7 },
    { kind: "star-map", edge: "v", x: 0, y: 8 },
    { kind: "poster-rocket", edge: "v", x: 0, y: 9 },
  ],
  furniture: [
    // ----- La mesa: la alfombra de estrellas, la mesa, las ocho sillas y la consola en la cabecera este,
    // con los cables que van a la pared.
    place("podcast-rug", MESA.x - 1, MESA.y - 1),
    place("podcast-table", MESA.x, MESA.y),
    ...[0, 1, 2, 3].flatMap((i) => [place("chair", MESA.x + i, MESA.y - 1, "down"), place("chair", MESA.x + i, MESA.y + 2, "up")]),
    place("podcast-console", MESA.x + 4, MESA.y),
    place("podcast-cables", MESA.x + 5, MESA.y + 1),
    // ----- Contra la pared norte: la repisa de los planetas bajo el cartel y el escritorio del código
    // (con su silla) bajo la pizarra.
    place("podcast-rocket", 0, 0),
    place("podcast-shelf", 2, 0, "down"),
    place("podcast-code-desk", 9, 0, "down"),
    place("office-chair-sage", 9, 1, "up"),
    // ----- El rincón del cristal (delante del mapa de los carriles) y las plantas.
    place("podcast-crystal", 1, 2),
    place("monstera", 11, 1),
    place("kentia", 11, 9),
    place("snake-plant", 6, 9),
    // ----- Lámparas cálidas y la guitarra apoyada en la pared este.
    place("lamp", 11, 3),
    place("lamp", 4, 9),
    place("guitar", 11, 6),
    // ----- El rincón del sofá (suroeste): el sofá mirando a la mesa, dos pufs y la lámpara de lectura.
    place("rug-round", 0, 7),
    place("sofa-leather", 1, 9, "up"),
    place("beanbag", 0, 7, "right"),
    place("beanbag", 1, 7, "down"),
    place("reading-lamp", 0, 9),
    place("side-table", 0, 8),
    // El tocadiscos junto a la puerta, para la música de fondo entre grabaciones.
    place("record-player", 8, 9),
  ],
  portals: [
    {
      id: "podcast-salida",
      label: "Salir al pasillo del piso 3",
      tiles: CONEXIONES.podcast.puerta.tiles,
      to: hacia("piso-3", CONEXIONES.piso3.estudio),
    },
  ],
  points: [
    // Parado junto a la consola, en la cabecera de la mesa.
    { type: "podcast", name: "Consola de grabación", x: MESA.x + 5, y: MESA.y, zone: "podcast" },
  ],
};
