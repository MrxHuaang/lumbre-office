// La piscina del jardín (detrás de la cabaña): el deck con la pileta, el trampolín, las reposeras, las
// sombrillas, la ducha y el toallero. Dibujos en art/agua.ts (la piscina, con su versión de noche, se
// registra en outdoor.ts).
import type { CatalogItem } from "./catalog";

/** El deck de la piscina (tiles) y la pileta de piedra adentro (tiles locales del deck). */
export const POOL_SIZE: [number, number] = [15, 13];
export const POOL_BASIN = { x: 3, y: 3, w: 9, d: 6 };
/** Escaleritas de piedra que bajan al agua: rincón suroeste y rincón noreste de la pileta (tiles locales). */
export const POOL_STEPS: readonly [number, number][] = [
  [POOL_BASIN.x, POOL_BASIN.y + POOL_BASIN.d - 1],
  [POOL_BASIN.x + POOL_BASIN.w - 1, POOL_BASIN.y],
];

const basinTiles: [number, number][] = [];
for (let y = POOL_BASIN.y; y < POOL_BASIN.y + POOL_BASIN.d; y++) for (let x = POOL_BASIN.x; x < POOL_BASIN.x + POOL_BASIN.w; x++) basinTiles.push([x, y]);

export const AGUA_CATALOG = {
  // La piscina entera va plana (se camina el deck); la pileta bloquea el paso a pie y ahí solo se nada.
  // De noche la iluminan las luces de adentro del agua.
  pool: { name: "Piscina", size: POOL_SIZE, fixed: true, flat: true, hasNight: true, blocks: basinTiles, swim: true, light: { at: [120, 96, 2], color: "#7fe0e8", radius: 76 } },
  // El trampolín va en el borde, con el tablón sobre el agua hacia +x.
  "diving-board": { name: "Trampolín", size: [1, 1] },
  // Reposera: el respaldo en el tile del asiento y las piernas hacia +x.
  "sun-lounger": { name: "Asoleadora", size: [2, 1], seats: [[0, 0]], hasBack: true },
  parasol: { name: "Sombrilla", size: [1, 1] },
  "garden-shower": { name: "Ducha de jardín", size: [1, 1] },
  "towel-rack": { name: "Toallero", size: [1, 1] },
} satisfies Record<string, CatalogItem>;
