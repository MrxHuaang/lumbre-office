// La decoración temporal de los festivales (docs/plan-festivales.md): mientras corre un festival, algunos
// niveles llevan muebles y puntos de más (las calabazas y el laberinto de la Noche de brujas, los faroles
// de las velitas…). No toca el plano: se suma encima, después de los cambios del editor de la casa, igual
// en el servidor y en el navegador. Lo que caería encima de otro mueble, de un portal, de un punto o fuera
// del piso no se pone (así lo agregado con el editor gana y la decoración nunca tapa nada).
import type { FestivalId } from "@hyvento/shared";
import { furnitureTiles } from "./decor";
import { catalogItem } from "./world/catalog";
import { BRUJAS_DECOR } from "./world/festivales/brujas";
import { CARNAVAL_DECOR } from "./world/festivales/carnaval";
import { VELITAS_DECOR } from "./world/festivales/velitas";
import { FERIA_DECOR } from "./world/festivales/feria-flores";
import { COMETAS_DECOR } from "./world/festivales/cometas";
import { NOVENAS_DECOR } from "./world/festivales/novenas";
import { AMOR_DECOR } from "./world/festivales/amor-amistad";
import type { AreaDef, Placement, PointDef } from "./world/types";

/** Lo que un festival agrega a un nivel. */
export interface FestivalDecor {
  furniture: Placement[];
  /** Puntos de interacción del festival (el puesto, la calabaza dorada): van después de los del plano. */
  points?: PointDef[];
}

export interface FestivalDecorDef {
  /** Los niveles que decora (para rearmar solo esos al prenderlo y apagarlo). */
  areas: readonly string[];
  /**
   * La decoración de un nivel (o null). Recibe el plano del nivel (para mirar el piso) y el día del juego:
   * lo que cambia cada día (la calabaza dorada) sale de ahí, igual para todos.
   */
  build(def: AreaDef, day: number): FestivalDecor | null;
}

/** La decoración de cada festival que tiene. */
export const FESTIVAL_DECOR: Partial<Record<FestivalId, FestivalDecorDef>> = {
  brujas: BRUJAS_DECOR,
  carnaval: CARNAVAL_DECOR,
  velitas: VELITAS_DECOR,
  "feria-flores": FERIA_DECOR,
  cometas: COMETAS_DECOR,
  novenas: NOVENAS_DECOR,
  "amor-amistad": AMOR_DECOR,
};

/** Los niveles que decora un festival (ninguno si no tiene decoración). */
export const festivalDecorAreas = (id: string | null | undefined): readonly string[] => (id ? (FESTIVAL_DECOR[id as FestivalId]?.areas ?? []) : []);

/** La decoración de un festival en un nivel (con el plano de ese nivel), o null. */
export function festivalDecorOf(id: string | null | undefined, def: AreaDef, day: number): FestivalDecor | null {
  const d = id ? FESTIVAL_DECOR[id as FestivalId] : undefined;
  return d && d.areas.includes(def.id) ? d.build(def, day) : null;
}

const key = (x: number, y: number) => `${x},${y}`;

/** ¿El tile tiene piso donde poner algo? Afuera, lo jugable que no es agua; adentro, dentro de una habitación. */
function onFloor(def: AreaDef, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= def.width || y >= def.height) return false;
  if (def.outdoor) {
    const p = def.playable;
    if (p && (x < p.x || y < p.y || x >= p.x + p.w || y >= p.y + p.h)) return false;
    return (def.ground?.(x, y) ?? "grass") !== "water";
  }
  return def.rooms.some((r) => x >= r.rect.x && y >= r.rect.y && x < r.rect.x + r.rect.w && y < r.rect.y + r.rect.h);
}

/**
 * El nivel con la decoración del festival encima. Se salta cada pieza que se encime con un mueble (o con
 * otra pieza), que sea sólida sobre un portal, un punto o un NPC, o que quede fuera del piso.
 */
export function applyFestivalDecor(def: AreaDef, decor: FestivalDecor | null | undefined): AreaDef {
  if (!decor || (decor.furniture.length === 0 && !decor.points?.length)) return def;
  const taken = new Set<string>();
  for (const p of def.furniture) for (const t of furnitureTiles(p)) taken.add(key(t.x, t.y));
  const keepClear = new Set<string>();
  for (const portal of def.portals) for (const t of portal.tiles) keepClear.add(key(t.x, t.y));
  for (const p of [...def.points, ...(decor.points ?? [])]) keepClear.add(key(p.x, p.y));
  for (const t of def.npcTiles ?? []) keepClear.add(key(t.x, t.y));
  for (const t of def.thresholds ?? []) keepClear.add(key(t.x, t.y));

  const furniture: Placement[] = [];
  for (const p of decor.furniture) {
    const tiles = furnitureTiles(p);
    const solid = catalogItem(p.type).solid !== false;
    if (tiles.some((t) => !onFloor(def, t.x, t.y) || taken.has(key(t.x, t.y)) || (solid && keepClear.has(key(t.x, t.y))))) continue;
    for (const t of tiles) taken.add(key(t.x, t.y));
    furniture.push(p);
  }
  const points = (decor.points ?? []).filter((p) => onFloor(def, p.x, p.y) && !taken.has(key(p.x, p.y)));
  return { ...def, furniture: [...def.furniture, ...furniture], points: [...def.points, ...points] };
}
