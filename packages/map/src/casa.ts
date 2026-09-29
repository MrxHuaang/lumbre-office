// Casa viva: lo que se usa en cada nivel, además de los muebles del catálogo. Las cortinas son las
// ventanas de las paredes altas: se tratan como un "mueble" más (tipo CURTAIN_TYPE) que ocupa la fila
// de tiles pegada a la ventana, así valen las mismas reglas de alcance que para el resto.
import { CURTAIN_TYPE, usableSpec } from "@hyvento/shared";
import type { OfficeMap, PlacedFurniture } from "./world/build";
import type { WallFeature } from "./world/types";
import { wallBoardsOf } from "./mundo";

/** Ventanas con cortinas (las del ventanal también se cierran). */
const CURTAINED = new Set<WallFeature["kind"]>(["window", "ventanal"]);

const curtainCache = new WeakMap<OfficeMap, PlacedFurniture[]>();

/**
 * Las cortinas de un nivel, como muebles que ocupan los tiles del cuarto pegados a cada ventana (en la
 * pared norte, la fila de abajo; en la oeste, la columna de la derecha). `facing` dice en qué pared está:
 * "down" = norte, "right" = oeste.
 */
export function curtainsOf(map: OfficeMap): PlacedFurniture[] {
  let list = curtainCache.get(map);
  if (list) return list;
  list = map.def.features
    .filter((f) => CURTAINED.has(f.kind))
    .map((f): PlacedFurniture => {
      const len = f.width ?? 1;
      return f.edge === "h"
        ? { type: CURTAIN_TYPE, x: f.x, y: f.y, w: len, d: 1, facing: "down" }
        : { type: CURTAIN_TYPE, x: f.x, y: f.y, w: 1, d: len, facing: "right" };
    });
  curtainCache.set(map, list);
  return list;
}

/** La ventana de una cortina (para dibujarla). */
export function curtainFeature(map: OfficeMap, c: PlacedFurniture): WallFeature | undefined {
  const edge = c.facing === "down" ? "h" : "v";
  return map.def.features.find((f) => CURTAINED.has(f.kind) && f.edge === edge && f.x === c.x && f.y === c.y);
}

const usableCache = new WeakMap<OfficeMap, PlacedFurniture[]>();

/** Todo lo que se usa en el nivel: los muebles con acción, las cortinas y las pizarras de la pared. */
export function usablesOf(map: OfficeMap): PlacedFurniture[] {
  let list = usableCache.get(map);
  if (!list) {
    list = [...map.furniture.filter((f) => usableSpec(f.type)), ...curtainsOf(map), ...wallBoardsOf(map)];
    usableCache.set(map, list);
  }
  return list;
}
