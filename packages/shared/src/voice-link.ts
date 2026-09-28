import { canHear, HEARING_HYSTERESIS, type Positioned } from "./proximity";
import { VOICE_RADIUS } from "./protocol";

/**
 * Cuándo estar conectado a LiveKit. LiveKit Cloud cobra por minuto de participante conectado, así que
 * la sala de video no se abre al entrar a la cabaña: solo cuando hay alguien cerca (o una llamada, o
 * mic/cámara/pantalla prendidos), y se suelta un rato después de quedar solo.
 */

/** Margen (px) más allá del radio de voz para conectarse antes de que la otra persona se oiga. */
export const VOICE_WAKE_MARGIN = 3 * 32;
/** Cuánto se sigue conectado después de quedar sin nadie cerca (sin mic/cámara/pantalla ni llamada). */
export const VOICE_IDLE_GRACE_MS = 60_000;

/**
 * ¿Hay alguien lo bastante cerca como para necesitar la sala de video? Mismas reglas que `canHear`
 * (mismo nivel; en zonas aisladas, la misma zona) con un radio algo más largo que el de la voz, y con
 * histéresis: quien ya estaba cerca (`wasNear`) cuenta hasta un poco más lejos, para no conectar y
 * desconectar en el borde.
 */
export function voiceNearby(
  me: Positioned,
  others: Iterable<Positioned>,
  wasNear: boolean,
  radius = VOICE_RADIUS,
): boolean {
  const reach = radius + VOICE_WAKE_MARGIN + (wasNear ? HEARING_HYSTERESIS : 0);
  for (const other of others) if (canHear(me, other, reach)) return true;
  return false;
}

export interface VoiceLink {
  /** ¿Hay que estar conectado a LiveKit? */
  linked: boolean;
  /** Desde cuándo (ms) no hace falta; null mientras haga falta o si ya se soltó. */
  idleSince: number | null;
}

export const VOICE_LINK_IDLE: VoiceLink = { linked: false, idleSince: null };

/**
 * Siguiente estado de la conexión: se pide apenas hace falta (`needed`) y se suelta cuando lleva
 * `grace` ms sin hacer falta. Si vuelve a hacer falta antes, el conteo se reinicia.
 */
export function nextVoiceLink(prev: VoiceLink, needed: boolean, now: number, grace = VOICE_IDLE_GRACE_MS): VoiceLink {
  if (needed) return prev.linked && prev.idleSince === null ? prev : { linked: true, idleSince: null };
  if (!prev.linked) return prev;
  const idleSince = prev.idleSince ?? now;
  if (now - idleSince >= grace) return VOICE_LINK_IDLE;
  return idleSince === prev.idleSince ? prev : { linked: true, idleSince };
}
