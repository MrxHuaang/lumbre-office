import type { AreaDef, Rect } from "../types";
import { place } from "./place";
import { CONEXIONES, hacia } from "./conexiones";

// ---------- Garaje ----------
// El edificio chico al lado de la torre, en el jardín. Adentro, el taller (zona común, en L) y en la
// esquina noreste una oficina aislada, como las del piso 2, que se asigna en /admin y su dueño puede
// decorar. Todo descuidado a propósito: concreto con manchas de aceite, bloque sin pintar, herramientas
// tiradas, llantas, cajas, telarañas y un carro tapado frente al portón enrollable (pared oeste).
// Se entra desde el jardín por la puerta de la pared sur del taller.

const W = 16;
const H = 11;
/** El taller cubre todo; la oficina va encima (la última habitación que cubre un tile gana). */
const TALLER: Rect = { x: 0, y: 0, w: W, h: 10 };
const OFICINA: Rect = { x: 10, y: 0, w: 6, h: 6 };
/** Tile del taller justo afuera de la puerta de la oficina (la puerta es su pared oeste). */
const PUERTA_OFICINA = { x: OFICINA.x - 1, y: 3 };

export const garaje: AreaDef = {
  id: "garaje",
  name: "Garaje",
  width: W,
  height: H,
  rooms: [
    { id: "taller", rect: TALLER, floor: "planks-worn", wallpaper: "boards" },
    // La oficina, el rincón acogedor: tablas claras y la misma madera de las paredes.
    { id: "office-5", rect: OFICINA, floor: "planks", wallpaper: "boards" },
  ],
  doors: [
    { edge: "v", x: OFICINA.x, y: PUERTA_OFICINA.y }, // taller ↔ oficina
    { edge: "h", x: 6, y: TALLER.h, width: 2 }, // salida al jardín
  ],
  thresholds: CONEXIONES.garaje.entrada.tiles,
  zones: [
    { id: "taller", name: "Taller", type: "common", rect: TALLER, isolated: false },
    { id: "office-5", name: "Oficina del garaje", type: "office", rect: OFICINA, isolated: true, slot: 5, door: PUERTA_OFICINA },
  ],
  features: [
    // Taller: el tablero de herramientas sobre el banco, la ventana empolvada y una telaraña en el rincón.
    { kind: "cobweb", edge: "h", x: 0, y: 0 },
    { kind: "pegboard", edge: "h", x: 3, y: 0, width: 3 },
    { kind: "dusty-window", edge: "h", x: 7, y: 0, width: 2 },
    // El portón de tablas por dentro, en la pared oeste (el carro tapado quedó frente a él).
    { kind: "barn-door", edge: "v", x: 0, y: 3, width: 4 },
    // Oficina: el calendario viejo y una ventana de verdad, con cortinas.
    { kind: "calendar", edge: "h", x: 11, y: 0 },
    { kind: "window", edge: "h", x: 14, y: 0, width: 2 },
  ],
  furniture: [
    // ----- Taller, contra la pared norte: escoba, estante, el banco bajo el tablero, la radio, la caja de
    // herramientas y el compresor bajo la ventana, y en el rincón la hielera de madera.
    place("broom-corner", 0, 0),
    place("metal-shelf", 1, 0, "down"),
    place("workbench", 3, 0, "down"),
    place("radio", 6, 0, "down"),
    place("tool-chest", 7, 0, "down"),
    place("compressor", 8, 0),
    place("icebox", 9, 0, "down"),
    // Pared oeste: llantas, cajas, el carro tapado frente al portón y el estante de madera.
    place("tire-stack", 0, 1),
    place("cardboard-boxes", 0, 2),
    place("tarp-car", 0, 4, "down"),
    place("metal-shelf", 0, 7),
    place("cardboard-boxes", 0, 9),
    place("paint-cans", 1, 9),
    // Al medio, lo que quedó tirado.
    place("tire-stack", 5, 6),
    place("oil-drum", 3, 7),
    place("work-light", 6, 4),
    place("work-light", 3, 5, "left"),
    place("paint-cans", 6, 8),
    // Bajo la oficina (el tramo este del taller): solo cosas bajas, que no tapen la oficina.
    place("paint-cans", 15, 6),
    place("tire-stack", 15, 8),
    place("cardboard-boxes", 15, 9),
    place("paint-cans", 12, 9, "down"),
    place("cardboard-boxes", 10, 9),
    // ----- Oficina del garaje: el escritorio con el computador viejo y la silla rota contra la pared
    // norte, el ventilador, el archivador abollado, la planta seca, el tapete gastado, un sillón viejo y
    // la lámpara de pie que la vuelve un rincón tibio.
    place("worn-rug", 11, 2),
    place("floor-fan", 11, 0, "down"),
    place("desk-crt", 12, 0, "down"),
    // El teléfono sobre el escritorio (como en las oficinas del piso 2): el dueño también llama desde aquí.
    place("desk-phone", 13, 0, "down"),
    place("office-chair-broken", 12, 1, "up"),
    place("filing-dented", 14, 0, "down"),
    place("dead-plant", 15, 0),
    // La vitrina de trofeos (como en las oficinas del piso 2), contra la pared este.
    place("trophy-case", 15, 2, "left"),
    place("cardboard-boxes", 15, 5, "down"),
    place("armchair", 14, 5, "up"),
    place("lamp", 15, 4),
    place("cardboard-boxes", 10, 5),
  ],
  portals: [
    {
      id: "garaje-salida",
      label: "Salir al jardín",
      tiles: CONEXIONES.garaje.entrada.tiles,
      to: hacia("jardin", CONEXIONES.jardin.garaje),
    },
  ],
  points: [
    // Delante de la vitrina de trofeos de la oficina.
    { type: "trophy_case", name: "Vitrina de trofeos", x: 14, y: 2, zone: "office-5" },
  ],
};
