// La granja del jardín: la parrilla con el horno de barro junto al patio, el gallinero con el corral de
// la cabra y el molino de agua del arroyo (dibujos en art/granja.ts; reglas en @hyvento/shared/granja y
// parrilla).
import type { CatalogItem } from "./catalog";

/** Brasa y fuego: luz naranja y corta. */
const EMBER = { color: "#ff9a4a" };

export const GRANJA_CATALOG = {
  // Parrilla: el horno abovedado (la boca con el fuego mira a +y), la parrilla de ladrillo con su
  // chimenea, la mesa de preparación y la pizarra del menú.
  "clay-oven": { name: "Horno de barro", size: [2, 2], light: { at: [16, 30, 8], ...EMBER, radius: 54 } },
  "brick-grill": { name: "Parrilla de ladrillo", size: [2, 1], light: { at: [16, 8, 14], ...EMBER, radius: 46 } },
  "prep-table": { name: "Mesa de preparación", size: [2, 1] },
  "menu-board": { name: "Pizarra del menú", size: [1, 1] },
  // Gallinero: la casita de tablas (el nido se abre por el costado +x), el comedero, el bebedero, el saco
  // de maíz y las pacas de heno; la cerca de palos del patio y el corral; el establo chico de la cabra y su
  // pesebre; el letrero con los nombres (se votan).
  "chicken-coop": { name: "Gallinero", size: [3, 3], fixed: true },
  "chicken-feeder": { name: "Comedero", size: [1, 1] },
  "water-trough": { name: "Bebedero", size: [1, 1] },
  "feed-sack": { name: "Saco de maíz", size: [1, 1] },
  "hay-bale": { name: "Paca de heno", size: [1, 1] },
  "stick-fence": { name: "Cerca de palos", size: [1, 1] },
  "goat-shed": { name: "Establo chico", size: [2, 2] },
  "hay-rack": { name: "Pesebre", size: [1, 1] },
  "farm-sign": { name: "Letrero del gallinero", size: [1, 1] },
  // Molino: el edificio de piedra y madera (la puerta mira a +x), la rueda que gira en el arroyo (+y del
  // molino, en el agua) y el puentecito de tablas que cruza el arroyo (se camina por encima: va plano).
  "water-mill": { name: "Molino de agua", size: [3, 3], fixed: true, light: { at: [48, 26, 22], color: "#ffd98a", radius: 50 } },
  "mill-wheel": { name: "Rueda del molino", size: [2, 1], fixed: true },
  footbridge: { name: "Puentecito", size: [2, 3], fixed: true, flat: true, solid: false },
  "flour-sacks": { name: "Sacos de harina", size: [1, 1] },
  millstone: { name: "Piedra de moler", size: [1, 1] },
} satisfies Record<string, CatalogItem>;
