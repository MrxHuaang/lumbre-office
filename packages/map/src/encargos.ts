// Dónde se entrega un encargo: junto al personaje que lo dio (su tile) o a su punto del mapa (el tablón,
// el mostrador de Don Evelio). Lo usan el servidor (valida la entrega) y el navegador (la "E" y las marcas),
// así los dos dicen lo mismo. Las reglas de los encargos están en @hyvento/shared (encargos.ts).
import { QUEST, QUEST_GIVER_IDS, questGiver, questGiverNpc, type QuestGiverId } from "@hyvento/shared";
import { nearPointOfType, pointsOfType, type OfficeMap } from "./index";

/** Dónde se para ese personaje en el nivel (px de mundo), o null si no está en este nivel o es el tablón. */
export function questGiverSpot(map: OfficeMap, giverId: string): { x: number; y: number } | null {
  const npc = questGiverNpc(giverId);
  if (!npc || npc.area !== map.id) return null;
  const ts = map.tileSize;
  return { x: (npc.tile.x + 0.5 + (npc.offset?.x ?? 0)) * ts, y: (npc.tile.y + 0.5 + (npc.offset?.y ?? 0)) * ts };
}

/** ¿Está (x, y) lo bastante cerca de quien da ese encargo para entregarlo? */
export function nearQuestGiver(map: OfficeMap, giverId: string, x: number, y: number): boolean {
  const giver = questGiver(giverId);
  if (!giver) return false;
  const spot = questGiverSpot(map, giverId);
  if (spot && Math.hypot(spot.x - x, spot.y - y) <= QUEST.reachTiles * map.tileSize) return true;
  return Boolean(giver.point && nearPointOfType(map, giver.point as Parameters<typeof nearPointOfType>[1], x, y));
}

/** Qué tan lejos está (x, y) de quien da ese encargo (su tile o su punto, lo más cerca). */
function giverDistance(map: OfficeMap, giverId: string, x: number, y: number): number {
  const spot = questGiverSpot(map, giverId);
  const point = questGiver(giverId)?.point;
  const spots = [...(spot ? [spot] : []), ...(point ? pointsOfType(map, point) : [])];
  return Math.min(Infinity, ...spots.map((p) => Math.hypot(p.x - x, p.y - y)));
}

/** Quienes dan encargos al alcance de (x, y), del más cercano al más lejano. */
export function questGiversNear(map: OfficeMap, x: number, y: number): QuestGiverId[] {
  return QUEST_GIVER_IDS.filter((id) => nearQuestGiver(map, id, x, y)).sort((a, b) => giverDistance(map, a, x, y) - giverDistance(map, b, x, y));
}
