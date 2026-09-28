// Cómo suenan los pasos según el piso del tile (los sonidos se generan en el navegador, ver
// apps/web/src/game/sfx.ts). Acá solo se decide el timbre: pasto, tierra, madera, piedra o alfombra.
import type { OfficeMap } from "./world/build";
import type { FloorKind } from "./world/types";

export type StepSurface = "grass" | "dirt" | "wood" | "stone" | "soft";

/** Un `Record` completo: si se agrega un piso nuevo, el typecheck pide decidir cómo suena. */
const SURFACE: Record<FloorKind, StepSurface> = {
  grass: "grass",
  forest: "grass",
  path: "dirt",
  soil: "dirt",
  sand: "dirt",
  water: "dirt",
  wood: "wood",
  parquet: "wood",
  deck: "wood",
  dock: "wood",
  terrace: "wood",
  lounge: "wood",
  checker: "wood",
  planks: "wood",
  tiles: "stone",
  hydraulic: "stone",
  terrazzo: "stone",
  brick: "stone",
  concrete: "stone",
  road: "stone",
  rubber: "soft",
  "planks-worn": "wood",
  gravel: "dirt",
  slope: "grass",
  steps: "stone",
  stone: "stone",
  kitchen: "stone",
  mosaic: "stone",
  marble: "stone",
  bath: "stone",
  dance: "stone",
  carpet: "soft",
  moquette: "soft",
  doormat: "soft",
  casino: "soft",
  cinema: "soft",
  arcade: "soft",
};

/** Timbre de los pasos sobre un piso (sin piso conocido, madera: lo más común adentro). */
export function stepSurface(kind: FloorKind | null | undefined): StepSurface {
  return (kind && SURFACE[kind]) || "wood";
}

/** Timbre de los pasos en un punto del nivel (px de mundo). */
export function surfaceAt(map: OfficeMap, x: number, y: number): StepSurface {
  const tx = Math.floor(x / map.tileSize);
  const ty = Math.floor(y / map.tileSize);
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return map.def.outdoor ? "grass" : "wood";
  return stepSurface(map.floors[ty * map.width + tx]);
}
