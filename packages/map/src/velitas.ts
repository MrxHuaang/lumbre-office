// La Noche de velitas en el mapa (reglas en velitas.ts de @hyvento/shared): dónde se puede prender una
// velita, cuál se dibuja en cada tile y desde dónde se suelta el farol de deseos (la decoración fija del
// festival está en world/festivales/velitas.ts). Lo usan la sala (valida) y el navegador (anticipa y dibuja).
import { VELITAS } from "@hyvento/shared";
import { catalogItem } from "./world/catalog";
import { isBlockedTile, type OfficeMap } from "./world/build";

/** Por qué no va una velita en un tile (o null si se puede). */
export type VelitaBlock = "fuera" | "bloqueado" | "mueble" | "punto" | "portal" | "asiento";

/** Tiles que ocupa algún mueble del nivel (también los que no bloquean: una velita encima se vería rara). */
const furnitureTiles = new WeakMap<OfficeMap, Set<number>>();
function occupied(map: OfficeMap): Set<number> {
  let set = furnitureTiles.get(map);
  if (set) return set;
  set = new Set();
  for (const f of map.furniture) {
    // Lo plano (alfombras, el piso de una tarima) no estorba a una velita.
    if (catalogItem(f.type).flat) continue;
    for (let y = f.y; y < f.y + f.d; y++) for (let x = f.x; x < f.x + f.w; x++) set.add(y * map.width + x);
  }
  furnitureTiles.set(map, set);
  return set;
}

/**
 * ¿Se puede prender una velita en el tile (tx, ty)? Tiene que caminarse y no quedar sobre un mueble, un
 * punto donde se usa algo (el buzón, la escalera de la piscina), un portal ni un asiento. Las velitas no
 * bloquean el paso, así que no tapan caminos.
 */
export function velitaBlock(map: OfficeMap, tx: number, ty: number): VelitaBlock | null {
  if (map.id !== VELITAS.area || tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return "fuera";
  if (isBlockedTile(map, tx, ty) || map.floors[ty * map.width + tx] === "water") return "bloqueado";
  if (occupied(map).has(ty * map.width + tx)) return "mueble";
  if (map.points.some((p) => p.tileX === tx && p.tileY === ty)) return "punto";
  if (map.portals.some((p) => p.tiles.some((t) => t.x === tx && t.y === ty))) return "portal";
  if (map.seats.has(ty * map.width + tx)) return "asiento";
  return null;
}

/** ¿Alcanza a poner una velita en ese tile desde (x, y) (px de los pies)? */
export function velitaInReach(map: OfficeMap, x: number, y: number, tx: number, ty: number): boolean {
  const ts = map.tileSize;
  return Math.hypot((tx + 0.5) * ts - x, (ty + 0.5) * ts - y) <= VELITAS.reachTiles * ts;
}

/** Los dibujos de las velitas que pone la gente: varían por tile, para que el jardín no se vea repetido. */
export const VELITA_TYPES = ["velita-vaso-rojo", "velita-vaso-amarillo", "velita-vaso-verde", "velita-vaso-azul", "velita-vaso-morado", "velita"] as const;

/** La velita que se dibuja en ese tile (la misma para todos). */
export function velitaTypeAt(tx: number, ty: number): (typeof VELITA_TYPES)[number] {
  let h = (tx * 374761393 + ty * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return VELITA_TYPES[h % VELITA_TYPES.length]!;
}

/** Las puntas del muelle (los puntos de pesca "Muelle"). */
const dockTips = (map: OfficeMap) => map.points.filter((p) => p.type === "fishing_spot" && p.name === "Muelle");

/**
 * ¿Está sobre el muelle del lago, para soltar el farol de deseos? Sobre las tablas y a no más de
 * `VELITAS.muelleTiles` de la punta (el deck de la piscina y el puentecito también son tablas).
 */
export function onWishDock(map: OfficeMap, x: number, y: number): boolean {
  if (map.id !== VELITAS.area) return false;
  const ts = map.tileSize;
  const tx = Math.floor(x / ts);
  const ty = Math.floor(y / ts);
  if (map.floors[ty * map.width + tx] !== "dock") return false;
  return dockTips(map).some((p) => Math.hypot(p.x - x, p.y - y) <= VELITAS.muelleTiles * ts);
}

/** Dónde nacen los faroles de la suelta (px de mundo): sobre el agua, frente a la punta del muelle. */
export function farolesOrigin(map: OfficeMap): { x: number; y: number } | null {
  const tip = dockTips(map)[0];
  return tip ? { x: tip.x + map.tileSize * 2, y: tip.y } : null;
}
