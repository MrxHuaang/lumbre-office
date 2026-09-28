// La tina caliente y la sauna de barril de la orilla este del lago (dibujos en art/tina.ts). La tina y la
// sauna son asientos del catálogo: quien se sienta ahí "se mete" (el servidor da los puntos del descanso y
// al pararse queda mojado; ver packages/shared/src/tina.ts).
import type { CatalogItem } from "./catalog";

/** Altura del agua de la tina (px de arte sobre el deck): ahí queda la línea del agua de quien se mete. */
export const TUB_WATER_Z = 10;
/** Tamaño de la tina (tiles) y su centro en unidades de arte locales. */
export const TUB_SIZE: [number, number] = [3, 3];

/**
 * El rincón de la tina, en tiles relativos a la esquina del deck (x 0..9, y 0..8): lo usan el jardín para
 * ubicar todo y el arte del reflejo para saber dónde caen las luces.
 */
export const SPA = {
  deck: [10, 9] as [number, number],
  tub: [1, 2] as [number, number],
  sauna: [6, 0] as [number, number],
  /** El farolito del borde del lago (se refleja en el agua, como la luz de la tina). */
  shoreLanterns: [[0, 5]] as [number, number][],
  /** Los otros farolitos: al fondo del deck (detrás de la tina, sin tapar a nadie) y en la esquina del frente. */
  deckLanterns: [
    [2, 0],
    [9, 7],
  ] as [number, number][],
  /** El reflejo de las luces va en el agua, al oeste del deck: una franja de 2 tiles de ancho y 6 de largo. */
  reflection: [-2, 2] as [number, number],
  reflectionSize: [2, 6] as [number, number],
};

export const TINA_CATALOG = {
  // Tinaja redonda de madera con su estufa de leña adentro: se entra sentándose en uno de los cuatro
  // asientos (bajo el agua, mirando al centro). `soak`: se dibuja de medio cuerpo en el agua.
  "hot-tub": {
    name: "Tina caliente",
    size: TUB_SIZE,
    fixed: true,
    hasNight: true,
    soak: true,
    sortWhole: true,
    seats: [
      [1, 0, "down"],
      [0, 1, "right"],
      [2, 1, "left"],
      [1, 2, "up"],
    ],
    light: { at: [24, 24, 14], color: "#ffc77a", radius: 40 },
  },
  // La sauna de barril, acostada de norte a sur con la puerta al sur. La base (la cuna, el piso, la estufa
  // y la banca) va abajo y el barril es otra pieza (`sauna-shell`) que se transparenta con alguien adentro,
  // como el techo de la glorieta. Los dos asientos de la banca miran a la puerta.
  sauna: {
    name: "Sauna",
    size: [2, 3],
    fixed: true,
    hasNight: true,
    sortWhole: true,
    seats: [
      [0, 2, "down"],
      [1, 2, "down"],
    ],
    light: { at: [16, 50, 16], color: "#ffc77a", radius: 38 },
  },
  // El barril va en la fila de la banca (2 tiles al sur de la base): así se ordena delante de quien está
  // sentado adentro y, transparentado, se lo ve a través de las duelas.
  "sauna-shell": { name: "Barril de la sauna", size: [2, 1], fixed: true, solid: false, seeThrough: true, hasNight: true },
  // El deck de tablas (plano, debajo de todo; el piso de abajo es "dock", que suena a madera), con el
  // reflejo de las luces en el agua de al lado (de noche brilla).
  "spa-deck": { name: "Deck de la tina", size: SPA.deck, fixed: true, flat: true, solid: false, hasNight: true },
} satisfies Record<string, CatalogItem>;
