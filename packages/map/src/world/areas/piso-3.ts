import type { AreaDef } from "../types";
import { place } from "./place";

// ---------- Piso 3: biblioteca y descanso ----------
// Esqueleto del rediseño (ver docs/plan-rediseno.md): por ahora solo el rellano con la escalera que
// baja al piso 2. La distribución completa (biblioteca, sala de estar, rincón de lectura, juegos de
// mesa y terraza) la arma el rediseño de interiores.

export const piso3: AreaDef = {
  id: "piso-3",
  name: "Piso 3",
  width: 12,
  height: 10,
  rooms: [{ id: "rellano-3", rect: { x: 0, y: 0, w: 12, h: 10 }, floor: "wood", wallpaper: "cream" }],
  doors: [],
  zones: [{ id: "piso-3", name: "Piso 3", type: "common", rect: { x: 0, y: 0, w: 12, h: 10 }, isolated: false }],
  features: [{ kind: "window", edge: "h", x: 8, y: 0, width: 2 }],
  furniture: [place("stairwell", 5, 2), place("bookshelf", 0, 0), place("armchair", 10, 6, "left"), place("plant", 11, 9)],
  portals: [
    {
      id: "piso-3-escalera",
      label: "Bajar al piso 2",
      tiles: [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
      ],
      to: { area: "piso-2", x: 10, y: 16, facing: "up" },
    },
  ],
  points: [],
};
