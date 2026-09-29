import { CASA_PROPIA } from "@hyvento/shared";
import type { AreaDef, Rect } from "../types";
import { place } from "./place";
import { CONEXIONES, hacia } from "./conexiones";

// ---------- La casa de cada persona ----------
// La plantilla del nivel `casa:<userId>` (docs/plan-casas.md): un cuarto de tablas para empezar, con la
// cama contra la pared del oeste, la cocinita contra la del fondo, una mesita con silla junto a la
// ventana y el medio libre para decorar. No se registra en AREAS: servidor y cliente la arman para cada
// persona con `casaPropiaDef` (el id del nivel, de la zona y de la habitación es el `casa:<userId>`, así
// los ids siguen siendo únicos en todo el mundo). Se sale por la puerta del sur a la calle del barrio.
// Los cuartos extra (VIR-89) y las visitas (VIR-81/82) vienen después.

const W = 8;
const H = 7;
const CUARTO: Rect = { x: 0, y: 0, w: W, h: H - 1 };

const plantilla: AreaDef = {
  id: CASA_PROPIA.own,
  name: "Tu casa",
  width: W,
  height: H,
  rooms: [{ id: CASA_PROPIA.own, rect: CUARTO, floor: "planks", wallpaper: "cream" }],
  doors: [{ edge: "h", x: 3, y: CUARTO.h, width: 2 }],
  thresholds: CONEXIONES.casaPropia.puerta.tiles,
  zones: [{ id: CASA_PROPIA.own, name: "Tu casa", type: "common", rect: CUARTO, isolated: true }],
  features: [
    { kind: "window", edge: "h", x: 2, y: 0, width: 2 },
    { kind: "clock", edge: "h", x: 4, y: 0 },
    { kind: "picture", edge: "v", x: 0, y: 3 },
  ],
  furniture: [
    // El rincón de dormir: la mesita de noche, la cama con la cabecera contra la pared y un tapete.
    place("side-table", 0, 0),
    place("casa-cama", 0, 1, "right"),
    place("rug-round", 1, 2),
    place("lamp", 0, 4),
    // La cocinita contra la pared del fondo.
    place("kitchen-counter", 5, 0, "down"),
    place("stove", 6, 0, "down"),
    place("kitchen-sink", 7, 0, "down"),
    // Mesita con silla y una mata; el resto del cuarto queda libre para decorar.
    place("cafe-table", 6, 3),
    place("chair", 5, 3, "right"),
    place("plant", 4, 0),
    place("coat-rack", 0, 5),
  ],
  portals: [
    {
      id: "casa-propia-salir",
      label: "Salir a la calle",
      tiles: CONEXIONES.casaPropia.puerta.tiles,
      to: hacia(CASA_PROPIA.street, CONEXIONES.barrio.casa),
    },
  ],
  points: [],
};

/** El nivel de la casa `areaId` (`casa:<userId>`), armado desde la plantilla con sus ids propios. */
export function casaPropiaDef(areaId: string): AreaDef {
  return {
    ...plantilla,
    id: areaId,
    rooms: plantilla.rooms.map((r) => ({ ...r, id: areaId })),
    zones: plantilla.zones.map((z) => ({ ...z, id: areaId })),
  };
}
