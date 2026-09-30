// Los destinos del viaje rápido (reglas en `viaje.ts` de @hyvento/shared): cada nivel con su punto de
// llegada y cada sala o zona con su tile de entrada (la puerta, si tiene; si no, el medio). Y cómo buscar
// un lugar libre cerca de un punto sin pasar por las paredes. Los usan el servidor (valida y ubica) y el
// cliente (la paleta de comandos y el mapa de la cabaña): así los dos hablan de los mismos lugares.
import { spaKindOf, VIAJE, VIAJE_NO_AREAS, VIAJE_OCULTAS } from "@hyvento/shared";
import { BOARD_TABLES } from "./world/areas";
import { isBlockedTile, wallAbove, wallLeftOf, type OfficeMap, type Zone } from "./world/build";

export interface TravelDestination {
  /** "nivel:<area>" o "zona:<zoneId>". */
  id: string;
  kind: "area" | "zone";
  area: string;
  zoneId: string | null;
  /** Nombre del lugar ("Cafetería") y del nivel donde queda ("Planta baja"). */
  name: string;
  areaName: string;
  /** Tipo de la zona ("office", "meeting", "common"…), o "" para un nivel. */
  zoneType: string;
  /** Tile de entrada (en tiles del nivel): ahí se busca dónde aparecer. */
  tile: { x: number; y: number };
}

/** Zonas que no son destino: la tarima del escenario (dos como mucho; se sube por su escalerita). */
const SKIP_ZONES = new Set(["escenario"]);
/** Las "mesas" de adentro (mesas de la cafetería, cabinas) son parte de su sala; las de afuera sí son lugares. */
const tableIsPlace = (map: OfficeMap) => map.outdoor;

const tileOfPx = (map: OfficeMap, px: number) => Math.floor(px / map.tileSize);

/** Dónde se llega a un nivel: el punto de entrada del jardín o la bajada del primer portal que lleva ahí. */
function arrivalOf(map: OfficeMap, areas: OfficeMap[]): { x: number; y: number } {
  const spawn = map.points.find((p) => p.type === "spawn");
  if (spawn) return { x: spawn.tileX, y: spawn.tileY };
  for (const other of areas) for (const portal of other.portals) if (portal.to.area === map.id) return { x: portal.to.x, y: portal.to.y };
  return { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
}

/** Tile de entrada de una zona: afuera de su puerta, o el medio. */
function entryOf(map: OfficeMap, zone: Zone): { x: number; y: number } {
  if (zone.door) return { x: tileOfPx(map, zone.door.x), y: tileOfPx(map, zone.door.y) };
  return { x: tileOfPx(map, zone.x + zone.width / 2), y: tileOfPx(map, zone.y + zone.height / 2) };
}

/** Los destinos salen del plano (zonas, puntos y portales: el editor de la casa solo mueve muebles). */
const cache = new Map<string, TravelDestination[]>();

/**
 * Todos los destinos, nivel por nivel en el orden del mundo: primero el nivel y después sus salas. Las
 * zonas que son el nivel entero (el estudio, la casa del árbol) quedan solo como nivel.
 */
export function travelDestinations(areas: Iterable<OfficeMap>): TravelDestination[] {
  const list = [...areas];
  const key = list.map((m) => `${m.id}:${m.width}x${m.height}`).join(",");
  const hit = cache.get(key);
  if (hit) return hit;
  const out: TravelDestination[] = [];
  for (const map of list) {
    if (VIAJE_NO_AREAS.includes(map.id) || VIAJE_OCULTAS.includes(map.id)) continue;
    out.push({ id: `nivel:${map.id}`, kind: "area", area: map.id, zoneId: null, name: map.name, areaName: map.name, zoneType: "", tile: arrivalOf(map, list) });
    for (const zone of map.zones) {
      if (SKIP_ZONES.has(zone.id) || zone.name === map.name) continue;
      if (zone.type === "table" && !tableIsPlace(map)) continue;
      out.push({ id: `zona:${zone.id}`, kind: "zone", area: map.id, zoneId: zone.id, name: zone.name, areaName: map.name, zoneType: zone.type, tile: entryOf(map, zone) });
    }
  }
  cache.set(key, out);
  return out;
}

export function travelDestination(areas: Iterable<OfficeMap>, id: string): TravelDestination | undefined {
  return travelDestinations(areas).find((d) => d.id === id);
}

/** ¿Hay una pared entre el tile a y su vecino b? */
function crosses(map: OfficeMap, ax: number, ay: number, bx: number, by: number): boolean {
  if (bx === ax + 1) return wallLeftOf(map, bx, by) !== 0;
  if (bx === ax - 1) return wallLeftOf(map, ax, ay) !== 0;
  if (by === ay + 1) return wallAbove(map, bx, by) !== 0;
  return wallAbove(map, ax, ay) !== 0;
}

/**
 * El centro de tile libre más cercano a (x, y) (px de mundo), buscando de a anillos sin atravesar paredes
 * (así no se aparece del otro lado del muro, en otra sala). Pasa por encima de muebles pero solo acepta
 * tiles que se pisan y que `ok` deja (quien llama suma lo suyo: nadie parado ahí, oficinas cerradas…).
 */
export function nearestFreeSpot(
  map: OfficeMap,
  x: number,
  y: number,
  ok: (x: number, y: number) => boolean,
  maxTiles: number = VIAJE.searchTiles,
): { x: number; y: number } | null {
  const ts = map.tileSize;
  const sx = Math.max(0, Math.min(map.width - 1, Math.floor(x / ts)));
  const sy = Math.max(0, Math.min(map.height - 1, Math.floor(y / ts)));
  const seen = new Set<number>([sy * map.width + sx]);
  let frontier = [{ x: sx, y: sy }];
  for (let r = 0; r <= maxTiles && frontier.length; r++) {
    // En cada anillo, el más cercano al punto pedido.
    const found = frontier
      .filter((t) => !isBlockedTile(map, t.x, t.y) && ok((t.x + 0.5) * ts, (t.y + 0.5) * ts))
      .sort((a, b) => Math.hypot((a.x + 0.5) * ts - x, (a.y + 0.5) * ts - y) - Math.hypot((b.x + 0.5) * ts - x, (b.y + 0.5) * ts - y))[0];
    if (found) return { x: (found.x + 0.5) * ts, y: (found.y + 0.5) * ts };
    const next: { x: number; y: number }[] = [];
    for (const t of frontier)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = t.x + dx;
        const ny = t.y + dy;
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
        const i = ny * map.width + nx;
        if (seen.has(i) || crosses(map, t.x, t.y, nx, ny)) continue;
        seen.add(i);
        next.push({ x: nx, y: ny });
      }
    frontier = next;
  }
  return null;
}

/**
 * ¿Es un asiento del que no se viaja? Las mesas del casino (su sala entera), las sillas del ajedrez y las
 * damas (hay una partida) y la tina y la sauna (se sale mojado, por su borde). Los demás asientos (una
 * silla, un sofá) no frenan: al viajar uno se levanta.
 */
export function isGameSeat(map: OfficeMap, x: number, y: number, seatType: string | undefined): boolean {
  if (!seatType) return false;
  if (spaKindOf(seatType)) return true;
  const ts = map.tileSize;
  const tx = Math.floor(x / ts);
  const ty = Math.floor(y / ts);
  if (BOARD_TABLES.some((t) => t.area === map.id && t.seats.some((s) => s.x === tx && s.y === ty))) return true;
  return map.zones.some((z) => z.id === "casino" && x >= z.x && x < z.x + z.width && y >= z.y && y < z.y + z.height);
}
