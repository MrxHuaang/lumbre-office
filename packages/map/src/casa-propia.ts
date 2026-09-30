// La casa de cada persona: su nivel no está en el mundo (`getWorld()` tiene solo los de la cabaña), se
// arma desde la plantilla cuando hace falta. Lo usan el servidor (que guarda las casas ocupadas y suelta
// las vacías) y el cliente (que arma la suya al entrar). Reglas en casa-propia.ts de @hyvento/shared.
import { CASA_PROPIA, casaAreaOf, isCasaArea } from "@hyvento/shared";
import { buildArea, type OfficeMap, type Portal } from "./world/build";
import { casaPropiaDef } from "./world/areas/casa-propia";

/** Nombre de la plantilla para dibujarla sin abrir el juego (`pnpm --filter @hyvento/map render casa`). */
export const CASA_PLANTILLA = "casa";

/** El nivel de la casa `areaId` (`casa:<userId>`), recién armado; `undefined` si no es una casa. */
export function buildCasaPropia(areaId: string): OfficeMap | undefined {
  if (!isCasaArea(areaId) || areaId === CASA_PROPIA.own) return undefined;
  return buildArea(casaPropiaDef(areaId));
}

/**
 * Un nivel por id: los de la cabaña salen de `areas` y una casa se arma y se guarda ahí mismo (para no
 * rearmarla en cada consulta). `undefined` si el id no es de nada.
 */
export function levelMap(areas: Map<string, OfficeMap>, areaId: string): OfficeMap | undefined {
  const hit = areas.get(areaId);
  if (hit) return hit;
  const casa = buildCasaPropia(areaId);
  if (casa) areas.set(areaId, casa);
  return casa;
}

/** A qué nivel lleva un portal a quien lo cruza: la puerta del barrio lleva a la casa de cada quien. */
export function portalDestination(portal: Pick<Portal, "to">, userId: string): string {
  return portal.to.area === CASA_PROPIA.own ? casaAreaOf(userId) : portal.to.area;
}
