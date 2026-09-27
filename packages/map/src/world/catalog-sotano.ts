// El sótano rediseñado: vestíbulo, bar del club y lo nuevo del entretenimiento (dibujos en art/sotano.ts).
import type { CatalogItem } from "./catalog";

/** Alto de cada grada del cine en unidades de arte: bajo, para que el avatar no se vea hundido. */
export const CINEMA_TIER_STEP = 2;

export const SOTANO_CATALOG = {
  // Vestíbulo: el guardarropa (percheros contra la pared y el mostrador), la estatua y las alfombras.
  "coat-rail": { name: "Perchero del guardarropa", size: [1, 2] },
  "coat-check": { name: "Mostrador del guardarropa", size: [1, 2] },
  "lobby-statue": { name: "Estatua dorada", size: [2, 2], light: { at: [16, 16, 34], color: "#ffd66a", radius: 44 } },
  "lobby-rug": { name: "Alfombra del vestíbulo", size: [6, 9], solid: false, flat: true },
  "hall-runner": { name: "Alfombra de pasillo", size: [12, 1], solid: false, flat: true },
  // Cuelga de la pared (lado -x del tile; con "down", de la pared norte): se camina por debajo.
  "wall-sconce": { name: "Aplique de pared", size: [1, 1], solid: false, light: { at: [5, 8, 33], color: "#ffc76a", radius: 36 } },
  // Club: el rincón de los habanos del bar y la pista de baile.
  "cigar-humidor": { name: "Humidor", size: [1, 1], light: { at: [8, 8, 20], color: "#ff9a4a", radius: 26 } },
  "cigar-case": { name: "Vitrina de habanos", size: [1, 1] },
  "bar-taps": { name: "Barra con grifos de cerveza", size: [1, 1] },
  "dance-floor": { name: "Pista de baile", size: [5, 5], solid: false, flat: true, light: { at: [40, 40, 2], color: "#8ef0f0", radius: 70 } },
  // Cine: gradas (se pisan) y las butacas que van encima de cada una, a la misma altura.
  "cinema-tier-1": { name: "Grada del cine", size: [2, 8], solid: false, flat: true, lift: CINEMA_TIER_STEP },
  "cinema-tier-2": { name: "Grada del cine", size: [2, 8], solid: false, flat: true, lift: CINEMA_TIER_STEP * 2 },
  "cinema-tier-3": { name: "Grada del cine", size: [3, 8], solid: false, flat: true, lift: CINEMA_TIER_STEP * 3 },
  "cinema-seat-1": { name: "Butaca de cine", size: [1, 1], seats: [[0, 0]], hasBack: true, lift: CINEMA_TIER_STEP },
  "cinema-seat-2": { name: "Butaca de cine", size: [1, 1], seats: [[0, 0]], hasBack: true, lift: CINEMA_TIER_STEP * 2 },
  "cinema-seat-3": { name: "Butaca de cine", size: [1, 1], seats: [[0, 0]], hasBack: true, lift: CINEMA_TIER_STEP * 3 },
  "cinema-stage": { name: "Tarima del cine", size: [2, 7], solid: false, flat: true, lift: 3 },
  // Baños (de adorno).
  "bath-stall": { name: "Cubículo del baño", size: [1, 1] },
  "bath-sink": { name: "Lavamanos", size: [1, 1] },
  // Arcade: los premios que se cambian por tickets.
  "prize-shelf": { name: "Estante de premios", size: [1, 2] },
  pinball: { name: "Pinball", size: [2, 1], light: { at: [4, 8, 28], color: "#ff9ae6", radius: 30 } },
  // Vestíbulo: el poste con una flecha de cada color hacia las salas.
  "lobby-sign": { name: "Letrero de las salas", size: [1, 1] },
} satisfies Record<string, CatalogItem>;
