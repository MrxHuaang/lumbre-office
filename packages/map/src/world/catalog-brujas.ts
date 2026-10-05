// La Noche de brujas (dibujos en art/brujas.ts): la decoración que el festival pone en la cabaña y el
// jardín el último día del otoño. Nada de esto está puesto en un nivel: lo coloca el festival.
import type { CatalogItem } from "./catalog";

/** La vela de adentro de las ahuyamas y del farol: naranja cálido. */
const CANDLE = { color: "#ffb04a" };

export const BRUJAS_CATALOG = {
  // Ahuyamas talladas: la cara mira a +x (un poco hacia la cámara); de noche, prendidas por dentro.
  "carved-pumpkin": { name: "Calabaza tallada", size: [1, 1], hasNight: true, light: { at: [9, 9, 5], ...CANDLE, radius: 30 } },
  "carved-pumpkin-big": { name: "Calabaza tallada grande", size: [1, 1], hasNight: true, light: { at: [9, 9, 7], ...CANDLE, radius: 40 } },
  "pumpkin-pile": { name: "Pila de calabazas", size: [1, 1] },
  // El premio escondido en el laberinto (cambia de rincón cada día): brilla dorado de noche.
  "golden-pumpkin": { name: "Calabaza dorada", size: [1, 1], light: { at: [8, 8, 6], color: "#ffd84a", radius: 34 } },
  // Cabeza de ahuyama tallada (prendida de noche) y sombrero de bruja.
  "witch-scarecrow": { name: "Espantapájaros de brujas", size: [1, 1], hasNight: true, light: { at: [9, 9, 28], ...CANDLE, radius: 26 } },
  // Farol de papel colgado del brazo de un poste (el farol queda hacia +x).
  "paper-lantern": { name: "Farol de papel", size: [1, 1], hasNight: true, light: { at: [12, 8, 25], ...CANDLE, radius: 44 } },
  // En la esquina de atrás del tile (entre la pared del norte y la del oeste): se pasa por debajo.
  cobweb: { name: "Telaraña", size: [1, 1], solid: false },
  cauldron: { name: "Caldero", size: [1, 1], light: { at: [8, 8, 13], color: "#9be86a", radius: 34 } },
  // Cartón pintado de pie: el texto mira a +x y se lee derecho con right o left (con down/up sale al
  // espejo, como todo lo que se voltea).
  "cardboard-tombstone": { name: "Lápida de cartón", size: [1, 2] },
  "straw-bale": { name: "Fardo de paja", size: [1, 1] },
  // Las paredes del laberinto de maíz: cuatro variantes para alternar y que no se vea repetido.
  "corn-maze-1": { name: "Maizal", size: [1, 1] },
  "corn-maze-2": { name: "Maizal", size: [1, 1] },
  "corn-maze-3": { name: "Maizal", size: [1, 1] },
  "corn-maze-4": { name: "Maizal", size: [1, 1] },
  // El arco de la entrada con el letrero "LABERINTO": fijo, en dos versiones para que siempre se lea. En
  // `maze-arch` se pasa a lo largo de x (por el tile del medio, y = 1); en `maze-arch-y`, a lo largo de y.
  "maze-arch": { name: "Arco del laberinto", size: [1, 3], fixed: true, seeThrough: true, blocks: [[0, 0], [0, 2]] },
  "maze-arch-y": { name: "Arco del laberinto", size: [3, 1], fixed: true, seeThrough: true, blocks: [[0, 0], [2, 0]] },
} satisfies Record<string, CatalogItem>;
