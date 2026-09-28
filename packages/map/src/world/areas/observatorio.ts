import type { AreaDef, Rect } from "../types";
import { npcSolidTiles } from "@hyvento/shared";
import { place } from "./place";
import { CONEXIONES, hacia } from "./conexiones";

// ---------- Observatorio ----------
// Adentro de la torre de piedra del jardín: una sola sala de piedra y madera, llena de cosas hechas a
// mano. Al medio el orrery (el modelo del sistema solar que gira; con E muestra la hora y el clima como
// planetas), al fondo el telescopio de latón y la escalera de caracol que sube a la cúpula, las vitrinas
// con piedras y "fósiles" de planetas contra la pared oeste, el radar de señales, el escritorio con el
// diario de exploración, y en las paredes los mapas estelares y el mural del cielo. Bajo el mural atiende
// la astrónoma (ver OBSERVATORIO_NPCS en @hyvento/shared): su tile no se camina. Se entra desde el jardín
// por la puerta de la pared sur.

const W = 16;
const H = 14;
const SALA: Rect = { x: 0, y: 0, w: W, h: 13 };

export const observatorio: AreaDef = {
  id: "observatorio",
  name: "Observatorio",
  width: W,
  height: H,
  rooms: [{ id: "observatorio", rect: SALA, floor: "planks", wallpaper: "stonework" }],
  doors: [{ edge: "h", x: 7, y: SALA.h, width: 2 }],
  thresholds: CONEXIONES.observatorio.entrada.tiles,
  zones: [{ id: "observatorio", name: "Observatorio", type: "common", rect: SALA, isolated: false }],
  features: [
    // Pared norte: un mapa estelar, el mural del cielo (con la torre y su placita) y dos ojos de buey.
    { kind: "star-chart", edge: "h", x: 1, y: 0, width: 2 },
    { kind: "mural", edge: "h", x: 5, y: 0, width: 4 },
    { kind: "porthole", edge: "h", x: 10, y: 0 },
    { kind: "porthole", edge: "h", x: 12, y: 0 },
    // Pared oeste: ventanas de ojo de buey y otro mapa estelar entre las vitrinas.
    { kind: "porthole", edge: "v", x: 0, y: 1 },
    { kind: "star-chart", edge: "v", x: 0, y: 4, width: 2 },
    { kind: "porthole", edge: "v", x: 0, y: 7 },
    { kind: "porthole", edge: "v", x: 0, y: 10 },
  ],
  furniture: [
    // Fondo: la escalera de caracol en la esquina noreste y el telescopio grande junto a ella.
    place("spiral-stairs", 14, 0),
    place("brass-telescope", 11, 1, "down"),
    place("celestial-globe", 14, 3),
    // Pared norte: el escritorio del diario bajo el mapa estelar y una estantería.
    place("log-desk", 1, 0, "down"),
    place("bookshelf", 3, 0, "down"),
    // Bajo el mural, una estantería baja (al lado atiende la astrónoma); y en el rincón, la radio vieja
    // (la que capta el radar).
    place("bookshelf-low", 6, 0, "down"),
    place("radio", 10, 0, "down"),
    // Pared oeste: las vitrinas (piedras y fósiles de planetas) y dos farolitos.
    place("rock-case", 0, 2),
    place("fossil-case", 0, 5),
    place("lamp", 0, 8),
    place("bookshelf", 0, 9),
    // Al medio: el orrery sobre su alfombra redonda, con dos sillones para mirarlo girar.
    place("rug-round", 6, 6),
    place("orrery", 6, 6),
    place("armchair", 9, 7, "left"),
    place("armchair", 6, 9, "up"),
    // Contra la pared este: el radar de señales mirando a la sala.
    place("signal-radar", 15, 6, "left"),
    // Rincones: plantas, cajas de exploración, un taburete junto al radar y el caballete con un boceto.
    place("plant", 15, 9),
    place("crates", 15, 10),
    place("crates", 15, 11),
    place("stool", 14, 8),
    place("easel", 12, 4),
    place("plant", 1, 11),
    place("globe", 3, 11),
    place("plant", 11, 11),
  ],
  // La astrónoma, de pie bajo el mural (ver OBSERVATORIO_NPCS).
  npcTiles: npcSolidTiles("observatorio"),
  portals: [
    {
      id: "observatorio-salida",
      label: "Salir al jardín",
      tiles: CONEXIONES.observatorio.entrada.tiles,
      to: hacia("jardin", CONEXIONES.jardin.observatorio),
    },
  ],
  points: [
    { type: "telescope", name: "Telescopio", x: 12, y: 3 },
    { type: "orrery", name: "Orrery", x: 8, y: 6 },
    { type: "orrery", name: "Orrery", x: 6, y: 8 },
    { type: "signal_radar", name: "Radar de señales", x: 14, y: 7 },
    { type: "logbook", name: "Diario de exploración", x: 2, y: 1 },
    // Delante de la astrónoma: con E le pregunta por el cielo.
    { type: "astronomer", name: "Astrónoma", x: 8, y: 2 },
  ],
};
