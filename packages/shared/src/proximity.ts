import { PROXIMITY_RADIUS, VOICE_RADIUS } from "./protocol";

/**
 * Papel en el escenario del jardín (ver escenario.ts): quien habla (en la tarima o con la palabra) o
 * quien escucha en las gradas. Fuera del anfiteatro, ninguno.
 */
export type StageRole = "speaker" | "audience";

export interface Positioned {
  /** Nivel de la cabaña ("jardin", "planta-baja", ...): solo se oye a quien está en el mismo. */
  area?: string;
  x: number;
  y: number;
  /** Id de la zona actual, o null si está en un pasillo sin zona. */
  zoneId: string | null;
  /** ¿La zona actual aísla audio/chat del exterior? */
  zoneIsolated: boolean;
  /** En el anfiteatro del jardín: si habla o escucha (ver `stageRole`). */
  stage?: StageRole;
  /**
   * Id de la llamada en la que está hablando (solo contestada; ver comunicacion.ts): todos los de la
   * misma llamada se oyen entre sí, en cualquier nivel y a cualquier distancia.
   */
  call?: string;
  /** Un admin hablándole a toda la cabaña (papel "broadcast"): lo oyen todos, encima de salas y reuniones. */
  broadcast?: boolean;
}

/** En las gradas se oye a los vecinos de asiento: hasta esta distancia (px, dos tiles y medio)… */
export const STAGE_NEIGHBOR_RADIUS = 2.5 * 32;
/** …y bajito, para que no tapen a quien está en la tarima. */
export const STAGE_NEIGHBOR_VOLUME = 0.3;

/**
 * ¿`a` y `b` pueden oírse (chat de proximidad y audio/video)?
 * - En niveles distintos nunca se oyen.
 * - En el anfiteatro (tarima y gradas) el chat llega a todo el anfiteatro y a nadie de afuera.
 * - Si alguno está en una zona aislada (oficina, sala), solo se oyen si están en la MISMA zona,
 *   sin importar la distancia.
 * - Si no, se oyen dentro del radio de proximidad.
 */
export function canHear(a: Positioned, b: Positioned, radius = PROXIMITY_RADIUS): boolean {
  if ((a.area ?? "") !== (b.area ?? "")) return false;
  if (a.stage || b.stage) return Boolean(a.stage && b.stage);
  if (a.zoneIsolated || b.zoneIsolated) return a.zoneId !== null && a.zoneId === b.zoneId;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy <= radius * radius;
}

/** Margen extra (px) para dejar de oír a alguien: evita que el audio parpadee en el borde del radio. */
export const HEARING_HYSTERESIS = 32;
/** Volumen mínimo en el borde del radio (zonas abiertas). */
const MIN_VOLUME = 0.15;

/**
 * Calcula a quién oye `me` y con qué volumen (0–1), para el audio/video por proximidad (con su propio
 * radio, más largo que el del chat de texto).
 * - En el anfiteatro: a quien habla (tarima o con la palabra), a volumen completo desde cualquier
 *   lugar del anfiteatro; a los del público solo si están al lado, bajito. Nada de afuera.
 * - En zonas aisladas (oficina, sala): todos los de la misma zona, a volumen completo.
 * - En zonas abiertas: dentro del radio, con volumen decreciente; quien ya se oía se sigue oyendo
 *   hasta `radius + HEARING_HYSTERESIS`.
 * - `inCall`: con quien estoy hablando por teléfono (lo dice el servidor en `Player.callWith`) se oye
 *   siempre a volumen completo, en cualquier nivel y a cualquier distancia; el resto sigue igual.
 * - En una llamada grupal (`call`), los de la misma llamada se oyen igual: a volumen completo y en todas partes.
 * - Quien anuncia por voz a toda la cabaña (`broadcast`) se oye siempre, a volumen completo, aunque
 *   esté en otro nivel, en una reunión o en una sala aislada. Es de una sola vía: el que anuncia oye
 *   a los demás con las reglas de siempre (por eso `listeners` no es simétrico).
 */
export function hearing(
  me: Positioned,
  others: Map<string, Positioned>,
  previous: ReadonlySet<string> = new Set(),
  radius = VOICE_RADIUS,
  inCall: ReadonlySet<string> = new Set(),
): Map<string, number> {
  const result = new Map<string, number>();
  for (const [id, other] of others) {
    if (inCall.has(id) || other.broadcast || (me.call && other.call === me.call)) {
      result.set(id, 1);
      continue;
    }
    if ((me.area ?? "") !== (other.area ?? "")) continue;
    if (me.stage || other.stage) {
      if (!me.stage || !other.stage) continue;
      if (other.stage === "speaker") {
        result.set(id, 1);
        continue;
      }
      const limit = previous.has(id) ? STAGE_NEIGHBOR_RADIUS + HEARING_HYSTERESIS / 2 : STAGE_NEIGHBOR_RADIUS;
      if (Math.hypot(me.x - other.x, me.y - other.y) <= limit) result.set(id, STAGE_NEIGHBOR_VOLUME);
      continue;
    }
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

/**
 * Quiénes me oyen (los que pueden suscribirse a mis pistas en LiveKit): la misma regla vista desde el
 * otro lado. No siempre es simétrica: el público oye a quien está en la tarima, pero la tarima solo
 * oye al público que tiene al lado.
 */
export function listeners(me: Positioned, myId: string, others: Map<string, Positioned>, previous: ReadonlySet<string> = new Set()): string[] {
  const out: string[] = [];
  const self = new Map([[myId, me]]);
  for (const [id, other] of others) if (hearing(other, self, previous.has(id) ? new Set([myId]) : new Set()).has(myId)) out.push(id);
  return out;
}
