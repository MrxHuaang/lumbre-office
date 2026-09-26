import { PROXIMITY_RADIUS } from "./protocol";

export interface Positioned {
  /** Nivel de la cabaña ("jardin", "planta-baja", ...): solo se oye a quien está en el mismo. */
  area?: string;
  x: number;
  y: number;
  /** Id de la zona actual, o null si está en un pasillo sin zona. */
  zoneId: string | null;
  /** ¿La zona actual aísla audio/chat del exterior? */
  zoneIsolated: boolean;
}

/**
 * ¿`a` y `b` pueden oírse (chat de proximidad y audio/video)?
 * - En niveles distintos nunca se oyen.
 * - Si alguno está en una zona aislada (oficina, sala), solo se oyen si están en la MISMA zona,
 *   sin importar la distancia.
 * - Si no, se oyen dentro del radio de proximidad.
 */
export function canHear(a: Positioned, b: Positioned, radius = PROXIMITY_RADIUS): boolean {
  if ((a.area ?? "") !== (b.area ?? "")) return false;
  if (a.zoneIsolated || b.zoneIsolated) return a.zoneId !== null && a.zoneId === b.zoneId;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy <= radius * radius;
}

/** Margen extra (px) para dejar de oír a alguien: evita que el audio parpadee en el borde del radio. */
export const HEARING_HYSTERESIS = 24;
/** Volumen mínimo en el borde del radio (zonas abiertas). */
const MIN_VOLUME = 0.15;

/**
 * Calcula a quién oye `me` y con qué volumen (0–1), para el audio/video por proximidad.
 * - En zonas aisladas (oficina, sala): todos los de la misma zona, a volumen completo.
 * - En zonas abiertas: dentro del radio, con volumen decreciente; quien ya se oía se sigue oyendo
 *   hasta `radius + HEARING_HYSTERESIS`.
 */
export function hearing(
  me: Positioned,
  others: Map<string, Positioned>,
  previous: ReadonlySet<string> = new Set(),
  radius = PROXIMITY_RADIUS,
): Map<string, number> {
  const result = new Map<string, number>();
  for (const [id, other] of others) {
    if ((me.area ?? "") !== (other.area ?? "")) continue;
    if (me.zoneIsolated || other.zoneIsolated) {
      if (canHear(me, other, radius)) result.set(id, 1);
      continue;
    }
    const limit = previous.has(id) ? radius + HEARING_HYSTERESIS : radius;
    const d = Math.hypot(me.x - other.x, me.y - other.y);
    if (d > limit) continue;
    const t = Math.min(1, d / radius);
    result.set(id, Math.max(MIN_VOLUME, 1 - t * t * (1 - MIN_VOLUME)));
  }
  return result;
}
