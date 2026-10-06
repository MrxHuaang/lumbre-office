// La Feria de las flores (dibujos en art/feria-flores.ts): la decoración y los puestos que el festival pone
// en el jardín el día 15 de la primavera. Nada de esto está puesto en un nivel: lo coloca el festival
// (world/festivales/feria-flores.ts). Todo es fijo: lo de enfrente mira a +y, donde se para la gente.
import type { CatalogItem } from "./catalog";

export const FERIA_CATALOG = {
  // Arco de flores sobre el camino: 5 tiles a lo largo de x; se pasa por los tres del medio (a lo largo de y).
  "flower-arch": { name: "Arco de flores", size: [5, 1], fixed: true, seeThrough: true, blocks: [[0, 0], [4, 0]] },
  // El exhibidor de la votación: la silleta que se exhibe se dibuja encima como capa.
  "silleta-stand": { name: "Exhibidor de silletas", size: [1, 1], fixed: true },
  // Una silleta de adorno, ya armada (no se vota).
  "silleta-decor": { name: "Silleta", size: [1, 1], fixed: true },
  // Donde se arma la silleta con las flores de la mochila.
  "silletero-table": { name: "Mesa del silletero", size: [2, 1], fixed: true },
  // El puesto de las semillas de flores, con su toldo a rayas.
  "flower-stall": { name: "Puesto de las flores", size: [2, 1], fixed: true, seeThrough: true },
  // Farol de papel de colores colgado de su poste (el farol queda hacia +x).
  "feria-lantern": { name: "Farol de la feria", size: [1, 1], fixed: true, hasNight: true, light: { at: [12, 8, 25], color: "#ffc94a", radius: 44 } },
  "garland-pole": { name: "Poste de guirnaldas", size: [1, 1], fixed: true },
  "flower-bucket": { name: "Balde de flores", size: [1, 1], fixed: true },
} satisfies Record<string, CatalogItem>;
