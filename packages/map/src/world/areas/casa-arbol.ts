import type { AreaDef, Rect } from "../types";
import { place } from "./place";
import { CONEXIONES, hacia } from "./conexiones";

// ---------- Casa del árbol ----------
// La cabañita de arriba del roble del huerto de frutales (docs/planes/plan-estructuras.md, estructura 2): un
// cuarto de tablones para tres personas, que es una sala aislada (como la de reuniones, con su pizarra).
// El tronco lo atraviesa en el rincón del fondo; hay cojines alrededor de la mesita de tocón, la hamaca
// bajo la ventana a la copa, cajones con libros, la radio vieja, el globo y el farol de frasco. Se baja por la trampilla del piso.
// El cupo y el cierre ("Subir la escalera") los valida el servidor al usar el portal del jardín (ver
// CASA_ARBOL en @hyvento/shared).

const W = 7;
const H = 6;
const CUARTO: Rect = { x: 0, y: 0, w: W, h: H };

export const casaArbol: AreaDef = {
  id: "casa-arbol",
  name: "Casa del árbol",
  width: W,
  height: H,
  rooms: [{ id: "casa-arbol", rect: CUARTO, floor: "planks", wallpaper: "treehouse" }],
  doors: [],
  zones: [{ id: "casa-arbol", name: "Casa del árbol", type: "meeting", rect: CUARTO, isolated: true }],
  features: [
    // La ventana a la copa en la pared del fondo y banderines sobre la hamaca y en la pared oeste.
    { kind: "treehouse-window", edge: "h", x: 3, y: 0, width: 2 },
    { kind: "bunting", edge: "h", x: 5, y: 0, width: 2 },
    { kind: "bunting", edge: "v", x: 0, y: 2, width: 4 },
  ],
  furniture: [
    place("treehouse-trunk", 0, 0),
    place("treehouse-lantern", 0, 2),
    place("treehouse-crates", 0, 3),
    place("radio", 0, 5, "right"),
    // El globo en el rincón, junto al tronco.
    place("globe", 2, 0, "down"),
    // El catalejo bajo la ventana y la hamaca a lo largo de la pared del fondo.
    place("telescope", 4, 0, "down"),
    place("hammock", 5, 0, "down"),
    // Tapete trenzado con la mesita de tocón y tres cojines alrededor.
    place("treehouse-rug", 2, 2),
    place("treehouse-table", 3, 3),
    place("treehouse-cushion", 2, 3, "right"),
    place("treehouse-cushion-sage", 4, 3, "left"),
    place("treehouse-cushion", 3, 2, "down"),
    // La trampilla en el piso (el portal que baja), la cesta de mantas y las suculentas.
    place("treehouse-trapdoor", 5, 4),
    place("blanket-basket", 6, 2),
    place("succulents", 6, 5),
  ],
  portals: [
    {
      id: "casa-arbol-bajar",
      label: "Bajar al jardín",
      tiles: CONEXIONES.casaArbol.trampilla.tiles,
      to: hacia("jardin", CONEXIONES.jardin.casaArbol),
    },
  ],
  points: [],
};
