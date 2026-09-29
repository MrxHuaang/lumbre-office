// Herramientas solo de desarrollo: con HYVENTO_DEV_TOOLS=1 en el .env local (y fuera de producción), el
// chat acepta "/ir <nivel> [tipo de punto]" para saltar a un nivel (o junto a un punto, por ejemplo
// "/ir sotano roulette"). Sirve para probar el mapa grande sin cruzarlo caminando. También "/clima <tipo>"
// fuerza un clima (despejado, nublado, lluvia, tormenta, niebla) y "/sombrero [escondite]" hace salir al
// Man del Sombrero ya (en el escondite de hoy o en ese) y lleva ahí a quien lo escribió. En producción no
// existe. "/ir casa" lleva a la casa propia (ver `parseCasaJump`).
import { CONEXIONES, pointsOfType, type OfficeMap } from "@hyvento/map";
import { casaAreaOf, casaOwnerOf, isWeather, SOMBRERO_HIDEOUTS, WEATHERS, type Weather } from "@hyvento/shared";

export function devToolsEnabled(): boolean {
  // Render no define NODE_ENV (y ponerlo en render.yaml dejaría a prisma fuera del install): se mira RENDER.
  return process.env.HYVENTO_DEV_TOOLS === "1" && process.env.NODE_ENV !== "production" && !process.env.RENDER;
}

export interface DevJump {
  area: string;
  /** Tile de destino (se busca un lugar libre cerca). */
  x: number;
  y: number;
}

/**
 * "/ir casa" (la casa de quien lo escribe) o "/ir casa:<userId>" (la de otro: la sala decide si se puede,
 * con la misma regla de la puerta del barrio). Llega frente a la puerta de adentro. null si no es eso.
 */
export function parseCasaJump(text: string, userId: string): DevJump | null {
  const m = /^\/ir\s+(casa(?::\S+)?)\s*$/.exec(text.trim());
  if (!m) return null;
  const area = m[1] === "casa" ? casaAreaOf(userId) : m[1]!;
  if (!casaOwnerOf(area)) return null;
  const llegada = CONEXIONES.casaPropia.puerta.llegada;
  return { area, x: llegada.x, y: llegada.y };
}

/**
 * Interpreta "/ir <nivel> [punto]". Devuelve null si el texto no es el comando; `error` si es el comando
 * pero no se entiende.
 */
export function parseDevJump(text: string, maps: ReadonlyMap<string, OfficeMap>): DevJump | { error: string } | null {
  const m = /^\/ir\s+(\S+)(?:\s+(\S+))?\s*$/.exec(text.trim());
  if (!m) return null;
  const map = maps.get(m[1]!);
  if (!map) return { error: `Niveles: ${[...maps.keys()].join(", ")}` };
  if (m[2]) {
    const p = pointsOfType(map, m[2])[0];
    if (!p) return { error: `No hay puntos "${m[2]}" en ${map.id}` };
    return { area: map.id, x: p.tileX, y: p.tileY };
  }
  // Donde se llega a ese nivel por algún portal (o su aparición).
  for (const other of maps.values())
    for (const portal of other.portals) if (portal.to.area === map.id) return { area: map.id, x: portal.to.x, y: portal.to.y };
  const spawn = pointsOfType(map, "spawn")[0];
  return spawn ? { area: map.id, x: spawn.tileX, y: spawn.tileY } : { error: "Ese nivel no tiene llegada" };
}

/**
 * Interpreta "/sombrero [escondite]": el índice del escondite pedido, `null` sin escondite (el de hoy), o
 * `error` si no existe. Devuelve `false` si el texto no es el comando.
 */
export function parseDevSombrero(text: string): { hideout: number | null } | { error: string } | false {
  const m = /^\/sombrero(?:\s+(\S+))?\s*$/.exec(text.trim());
  if (!m) return false;
  if (!m[1]) return { hideout: null };
  const i = SOMBRERO_HIDEOUTS.findIndex((h) => h.id === m[1]!.toLowerCase());
  return i >= 0 ? { hideout: i } : { error: `Escondites: ${SOMBRERO_HIDEOUTS.map((h) => h.id).join(", ")}` };
}

/** Interpreta "/clima <tipo>". Devuelve null si el texto no es el comando; `error` si el tipo no existe. */
export function parseDevWeather(text: string): Weather | { error: string } | null {
  const m = /^\/clima(?:\s+(\S+))?\s*$/.exec(text.trim());
  if (!m) return null;
  const w = m[1]?.toLowerCase();
  return isWeather(w) ? w : { error: `Climas: ${WEATHERS.join(", ")}` };
}
