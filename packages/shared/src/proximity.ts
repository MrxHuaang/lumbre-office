import { PROXIMITY_RADIUS } from "./protocol";

export interface Positioned {
  x: number;
  y: number;
  /** Id de la zona actual, o null si está en un pasillo sin zona. */
  zoneId: string | null;
  /** ¿La zona actual aísla audio/chat del exterior? */
  zoneIsolated: boolean;
}

/**
 * ¿`a` y `b` pueden oírse (chat de proximidad y, desde la Fase 3, audio/video)?
 * - Si alguno está en una zona aislada (oficina, sala), solo se oyen si están en la MISMA zona,
 *   sin importar la distancia.
 * - Si no, se oyen dentro del radio de proximidad.
 */
export function canHear(a: Positioned, b: Positioned, radius = PROXIMITY_RADIUS): boolean {
  if (a.zoneIsolated || b.zoneIsolated) return a.zoneId !== null && a.zoneId === b.zoneId;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy <= radius * radius;
}
