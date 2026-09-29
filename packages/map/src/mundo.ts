// Mundo lleno en el mapa: las pizarras colgadas en la pared de una sala que tiene pizarra compartida (una
// oficina o una sala de reuniones) se usan como un mueble más (tipo WALL_BOARD_TYPE), igual que las
// cortinas de las ventanas; el bote del muelle es un asiento; y lo que valida el servidor de los muebles
// nuevos (¿estás en el bote?, ¿junto a un telescopio de adorno?).
import { BOARD_ZONE_TYPES, DECOR_SCOPES, WALL_BOARD_TYPE } from "@hyvento/shared";
import type { OfficeMap, PlacedFurniture } from "./world/build";
import type { WallFeature } from "./world/types";

/** Lo que cuelga en la pared y es una pizarra de verdad (si la sala tiene una). */
const BOARDS = new Set<WallFeature["kind"]>(["whiteboard", "board", "diagram-board"]);

const boardCache = new WeakMap<OfficeMap, PlacedFurniture[]>();

/** Tipo de la zona que contiene el tile (la más chica, como `zoneAt`). */
function zoneTypeAt(map: OfficeMap, tx: number, ty: number): string | undefined {
  const ts = map.tileSize;
  const px = (tx + 0.5) * ts;
  const py = (ty + 0.5) * ts;
  let best: OfficeMap["zones"][number] | undefined;
  for (const z of map.zones)
    if (px >= z.x && px < z.x + z.width && py >= z.y && py < z.y + z.height && (!best || z.width * z.height < best.width * best.height)) best = z;
  return best?.type;
}

/**
 * Las pizarras de la pared de las salas con pizarra compartida, como muebles que ocupan la fila de tiles
 * pegada a la pared (norte: la de abajo; oeste: la de la derecha). Si la sala no tiene pizarra (un pasillo,
 * una sala común), no se ofrece nada.
 */
export function wallBoardsOf(map: OfficeMap): PlacedFurniture[] {
  let list = boardCache.get(map);
  if (list) return list;
  list = map.def.features
    .filter((f) => BOARDS.has(f.kind))
    .map((f): PlacedFurniture => {
      const len = f.width ?? 1;
      return f.edge === "h"
        ? { type: WALL_BOARD_TYPE, x: f.x, y: f.y, w: len, d: 1, facing: "down" }
        : { type: WALL_BOARD_TYPE, x: f.x, y: f.y, w: 1, d: len, facing: "right" };
    })
    .filter((b) => BOARD_ZONE_TYPES.includes(zoneTypeAt(map, b.x, b.y) ?? ""));
  boardCache.set(map, list);
  return list;
}

/** El bote del muelle: sentado en él se pesca con más suerte. */
export const ROWBOAT_TYPE = "rowboat";

/** ¿Está sentado (x, y exactos del asiento) en un bote? */
export function inRowboat(map: OfficeMap, x: number, y: number): boolean {
  const seat = map.seats.get(Math.floor(y / map.tileSize) * map.width + Math.floor(x / map.tileSize));
  return Boolean(seat && seat.type === ROWBOAT_TYPE && Math.abs(seat.x - x) <= 0.5 && Math.abs(seat.y - y) <= 0.5);
}

/** Los telescopios de adorno del nivel (terraza, casa del árbol, la placita del observatorio). */
export const decorScopesOf = (map: OfficeMap) => map.furniture.filter((f) => DECOR_SCOPES.includes(f.type));
