// La Noche de velitas (dibujos en art/velitas.ts): lo que se prende en el jardín el día 7 del invierno. Las
// velitas no bloquean (son chiquitas: se pasa al lado y no tapan caminos); el farol de la estaca sí. Nada
// de esto está puesto en un nivel: las velitas las pone cada quien (ver velitas.ts) y los faroles, la
// decoración del festival (`VELITAS_DECOR`).
import type { CatalogItem } from "./catalog";

/** Luz de vela: amarilla y cálida; cada vasito tiñe la suya con su papel. */
const FLAME = "#ffc45a";

export const VELITAS_CATALOG = {
  velita: { name: "Velita", size: [1, 1], solid: false, hasNight: true, light: { at: [8, 8, 8], color: FLAME, radius: 18 } },
  "velita-vaso-rojo": { name: "Velita en vasito rojo", size: [1, 1], solid: false, hasNight: true, light: { at: [8, 8, 5], color: "#ff9a6a", radius: 22 } },
  "velita-vaso-amarillo": { name: "Velita en vasito amarillo", size: [1, 1], solid: false, hasNight: true, light: { at: [8, 8, 5], color: "#ffd36a", radius: 22 } },
  "velita-vaso-verde": { name: "Velita en vasito verde", size: [1, 1], solid: false, hasNight: true, light: { at: [8, 8, 5], color: "#c8f08a", radius: 22 } },
  "velita-vaso-azul": { name: "Velita en vasito azul", size: [1, 1], solid: false, hasNight: true, light: { at: [8, 8, 5], color: "#9ad0ff", radius: 22 } },
  "velita-vaso-morado": { name: "Velita en vasito morado", size: [1, 1], solid: false, hasNight: true, light: { at: [8, 8, 5], color: "#e0a8ff", radius: 22 } },
  "velitas-vasos": { name: "Velitas en vasitos", size: [1, 1], solid: false, hasNight: true, light: { at: [8, 8, 5], color: FLAME, radius: 34 } },
  // El farol de colores en su estaca (el papel queda a media altura de una persona).
  "farol-velitas": { name: "Farol de colores", size: [1, 1], hasNight: true, light: { at: [8, 8, 19], color: "#ffcf7a", radius: 42 } },
  // El farol cubito del piso: bajito, se pasa al lado.
  "farol-cubo": { name: "Farol de papel", size: [1, 1], solid: false, hasNight: true, light: { at: [8, 8, 6], color: "#ffb860", radius: 30 } },
} satisfies Record<string, CatalogItem>;
