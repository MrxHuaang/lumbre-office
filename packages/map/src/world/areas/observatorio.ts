import type { AreaDef, Rect } from "../types";
import { place } from "./place";
import { CONEXIONES, hacia } from "./conexiones";

// ---------- Observatorio ----------
// Adentro de la torre de piedra de la lomita del jardín: una sola sala de piedra y madera, llena de cosas
// hechas a mano. Al medio el orrery (el modelo del sistema solar que gira; con E muestra la hora y el
// clima como planetas), al fondo el telescopio de latón y la escalera de caracol que sube a la cúpula,
// las vitrinas con piedras y "fósiles" de planetas contra la pared oeste, el radar de señales, el
// escritorio con el diario de exploración, y en las paredes los mapas estelares y el mural del cielo.
// Se entra desde el jardín por la puerta de la pared sur.

const W = 14;
const H = 12;
const SALA: Rect = { x: 0, y: 0, w: W, h: 11 };

export const observatorio: AreaDef = {
  id: "observatorio",
  name: "Observatorio",
  width: W,
  height: H,
  rooms: [{ id: "observatorio", rect: SALA, floor: "planks", wallpaper: "stonework" }],
  doors: [{ edge: "h", x: 6, y: SALA.h, width: 2 }],
  thresholds: CONEXIONES.observatorio.entrada.tiles,
  zones: [{ id: "observatorio", name: "Observatorio", type: "common", rect: SALA, isolated: false }],
  features: [
    // Pared norte: un mapa estelar, el mural del cielo (con la torre y la lomita) y otro mapa.
    { kind: "star-chart", edge: "h", x: 1, y: 0, width: 2 },
    { kind: "mural", edge: "h", x: 4, y: 0, width: 4 },
    { kind: "porthole", edge: "h", x: 8, y: 0 },
    // Pared oeste: ventanas de ojo de buey y otro mapa estelar entre las vitrinas.
    { kind: "porthole", edge: "v", x: 0, y: 1 },
    { kind: "star-chart", edge: "v", x: 0, y: 4, width: 2 },
    { kind: "porthole", edge: "v", x: 0, y: 7 },
  ],
  furniture: [
    // Fondo: la escalera de caracol en la esquina noreste y el telescopio grande junto a ella.
    place("spiral-stairs", 12, 0),
    place("brass-telescope", 9, 1, "down"),
    place("celestial-globe", 11, 3),
    // Pared norte: el escritorio del diario bajo el mapa estelar y una estantería.
    place("log-desk", 1, 0, "down"),
    place("bookshelf", 3, 0, "down"),
    // Pared oeste: las vitrinas (piedras y fósiles de planetas) y un farolito.
    place("rock-case", 0, 2),
    place("fossil-case", 0, 5),
    place("lamp", 0, 8),
    // Al medio: el orrery sobre su alfombra redonda, con dos sillones para mirarlo girar.
    place("rug-round", 5, 4),
    place("orrery", 5, 4),
    place("armchair", 8, 5, "left"),
    place("armchair", 5, 7, "up"),
    // Contra la pared este: el radar de señales mirando a la sala.
    place("signal-radar", 13, 5, "left"),
    // Rincones: plantas, cajas de exploración y un taburete junto al radar.
    place("plant", 13, 8),
    place("crates", 13, 9),
    place("stool", 12, 7),
    place("plant", 1, 9),
  ],
  portals: [
    {
      id: "observatorio-salida",
      label: "Salir al jardín",
      tiles: CONEXIONES.observatorio.entrada.tiles,
      to: hacia("jardin", CONEXIONES.jardin.observatorio),
    },
  ],
  points: [
    { type: "telescope", name: "Telescopio", x: 10, y: 3 },
    { type: "orrery", name: "Orrery", x: 7, y: 4 },
    { type: "orrery", name: "Orrery", x: 5, y: 6 },
    { type: "signal_radar", name: "Radar de señales", x: 12, y: 6 },
    { type: "logbook", name: "Diario de exploración", x: 2, y: 1 },
  ],
};
