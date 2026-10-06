// La casa del árbol del jardín (docs/planes/plan-estructuras.md, estructura 2): el árbol con la cabañita, la
// escalera de cuerda y lo de adentro (el nivel `casa-arbol`). Dibujos en art/casa-arbol.ts (el árbol, que
// tiene versión de noche, y la escalera en art/casa-arbol-exterior.ts).
import type { CatalogItem } from "./catalog";

/** Luz cálida de vela o de farol. */
const CANDLE = { color: "#ffc27a" };

export const CASA_ARBOL_CATALOG = {
  // El árbol entero con la cabañita arriba: todo el pie es tronco, raíces y postes (no se pasa por debajo).
  // La luz es la de la ventanita del frente.
  treehouse: { name: "Casa del árbol", size: [4, 4], fixed: true, hasNight: true, light: { at: [43, 47, 76], ...CANDLE, radius: 60 } },
  // La escalera de cuerda: cuelga del hueco de la plataforma hasta el pasto del tile de adelante, que es el
  // portal. Va dentro del pie del árbol (no bloquea nada por su cuenta).
  "treehouse-ladder": { name: "Escalera de cuerda", size: [1, 1], fixed: true, solid: false },
  // ----- Adentro.
  // El tronco que atraviesa el cuarto, en el rincón del fondo.
  "treehouse-trunk": { name: "Tronco del árbol", size: [2, 2], fixed: true },
  // La trampilla del piso con la escalera que baja: se pisa (es el portal de salida).
  "treehouse-trapdoor": { name: "Trampilla", size: [1, 1], fixed: true, solid: false, flat: true },
  "treehouse-cushion": { name: "Cojín", size: [1, 1], seats: [[0, 0]] },
  "treehouse-cushion-sage": { name: "Cojín verde", size: [1, 1], seats: [[0, 0]] },
  // La mesita baja con la tetera, las tazas y el temporizador de tomate del modo foco.
  "treehouse-table": { name: "Mesita baja", size: [1, 1] },
  "treehouse-crates": { name: "Cajones con libros", size: [1, 2] },
  "treehouse-lantern": { name: "Farol de frasco", size: [1, 1], light: { at: [8, 8, 12], ...CANDLE, radius: 46 } },
  "treehouse-rug": { name: "Tapete trenzado", size: [3, 3], solid: false, flat: true },
} satisfies Record<string, CatalogItem>;
