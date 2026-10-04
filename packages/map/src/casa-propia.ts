// La casa de cada persona: sus tres niveles no están en el mundo (`getWorld()` tiene solo los de la
// cabaña), se arman desde la plantilla cuando hacen falta. Lo usan el servidor (que guarda las casas
// ocupadas y suelta las vacías) y el cliente (que arma la suya al entrar). Reglas en casa-propia.ts de
// @hyvento/shared.
import { parseCasaArea } from "@hyvento/shared";
import { buildArea, type OfficeMap } from "./world/build";
import { casaPropiaDefs } from "./world/areas/casa-propia";

/** Nombres de la plantilla para dibujarla sin abrir el juego (`pnpm --filter @hyvento/map render casa-afuera`). */
export const CASA_PLANTILLAS = { "casa-afuera": "afuera", "casa-abajo": "abajo", "casa-arriba": "arriba" } as const;

/** El nivel de la casa `areaId` (`casa:<userId>[:piso]`), recién armado; `undefined` si no es una casa. */
export function buildCasaPropia(areaId: string): OfficeMap | undefined {
  const ref = parseCasaArea(areaId);
  if (!ref) return undefined;
  return buildArea(casaPropiaDefs(ref.owner)[ref.piso]);
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
