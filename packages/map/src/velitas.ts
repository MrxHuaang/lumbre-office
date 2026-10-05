// La Noche de velitas en el mapa (reglas en velitas.ts de @hyvento/shared): dónde se puede prender una
// velita, cuál se dibuja en cada tile, desde dónde se suelta el farol de deseos y la decoración fija del
// festival. Lo usan la sala (valida) y el navegador (anticipa y dibuja), así los dos dicen lo mismo.
import { VELITAS } from "@hyvento/shared";
import { catalogItem } from "./world/catalog";
import { isBlockedTile, type OfficeMap } from "./world/build";
import type { Facing } from "./world/types";

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

// ---------- La decoración fija del festival ----------

export interface FestivalDecor {
  area: string;
  type: string;
  x: number;
  y: number;
  facing: Facing;
}

const d = (type: string, x: number, y: number): FestivalDecor => ({ area: VELITAS.area, type, x, y, facing: "right" });

/**
 * Lo que el festival pone en el jardín mientras dura (tiles del nivel): faroles de colores a los lados del
 * camino del portón, velitas en grupos en la explanada del porche, el camino del lago y el muelle, y
 * faroles en el patio. Son datos: los pone el mecanismo de decoración temporal de los festivales (el de la
 * Noche de brujas) cuando esté; mientras tanto, un test revisa que no estorben.
 */
export const VELITAS_DECOR: readonly FestivalDecor[] = [
  // La explanada frente al porche: un grupito de velitas a cada lado.
  d("velitas-vasos", 58, 30),
  d("velitas-vasos", 67, 30),
  // El camino del porche al portón (x 61..63): faroles de colores en estaca a los dos lados, cada tanto.
  ...[34, 50, 58, 66].flatMap((y) => [d("farol-velitas", 59, y), d("farol-velitas", 65, y)]),
  // Entre farol y farol, velitas en vasitos a la orilla del camino.
  ...[38, 54, 62].flatMap((y) => [d("velitas-vasos", 60, y), d("velitas-vasos", 64, y)]),
  // El camino al lago: faroles cubito a la orilla.
  ...[
    [70, 50],
    [73, 54],
    [77, 62],
    [77, 68],
  ].map(([x, y]) => d("farol-cubo", x!, y!)),
  // El muelle: velitas sueltas a la orilla de las tablas (no bloquean: se pasa al lado).
  ...[77, 79, 81].map((x) => d("velita", x, 75)),
  // El patio: un farol a cada punta del sendero de piedra.
  d("farol-velitas", 80, 21),
  d("farol-velitas", 92, 21),
];
