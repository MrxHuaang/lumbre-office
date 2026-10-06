// Dormir en una cama hace amanecer (VIR-144). De noche del juego, E en una cama acuesta al personaje
// (`Player.sleeping`); moverse lo despierta. Cuando duermen los que tienen que dormir (todos los
// conectados o, con más de 3, al menos la mitad) y nadie está en una llamada ni en una reunión, el
// servidor pasa el reloj a las 06:00 por el mismo camino de `/time set`. La regla y los textos viven aquí
// (con tests); las camas de la cabaña (VIR-124) usan lo mismo cuando lleguen.
import type { UsableSpec } from "./consumables";
import { isNightMinute } from "./clock";

export const DORMIR = {
  /** Los muebles donde se duerme. */
  camas: ["cama-doble", "cama-sencilla"] as readonly string[],
  /** A qué hora amanece (minuto del día del juego). */
  amanecer: 6 * 60,
  /** Con más de esta gente conectada basta con que duerma la mitad. */
  pocos: 3,
  /** Cuánto dura el fundido a negro en pantalla al amanecer (ms). */
  fundidoMs: 1800,
} as const;

export type DormirAction = "sleep";

/** La cama se usa con E: la ayuda solo sale de noche. */
export const DORMIR_USABLES: Record<string, UsableSpec> = Object.fromEntries(
  DORMIR.camas.map((t) => [t, { action: "sleep", label: "Acostarse a dormir", cooldownMs: 1500, nightOnly: true, reachTiles: 1.8 } satisfies UsableSpec]),
);

/** ¿Es hora de dormir? (la noche del reloj del juego, 19:00 a 06:59). */
export const horaDeDormir = (minuteOfDay: number) => isNightMinute(minuteOfDay);

/** Lo que importa de cada persona conectada para saltar la noche. */
export interface Durmiente {
  dormido: boolean;
  /** En una llamada (del teléfono o del celular). */
  enLlamada: boolean;
  /** En la sala de reuniones con alguien más ("En reunión"). */
  enReunion: boolean;
}

/** Cuántos duermen y cuántos hacen falta (para el "Durmiendo 2/4" de la pantalla). */
export function cuentaDormidos(gente: readonly Durmiente[]): { dormidos: number; total: number; faltan: number } {
  const total = gente.length;
  const dormidos = gente.filter((g) => g.dormido).length;
  const necesarios = total > DORMIR.pocos ? Math.ceil(total / 2) : total;
  return { dormidos, total, faltan: Math.max(0, necesarios - dormidos) };
}

/**
 * ¿Se salta la noche? Duermen todos los conectados o, con más de `DORMIR.pocos`, al menos la mitad; y nadie
 * (dormido o despierto) está en una llamada ni en una reunión: no se le cambia la hora a quien trabaja.
 */
export function saltaLaNoche(gente: readonly Durmiente[]): boolean {
  if (!gente.length) return false;
  if (gente.some((g) => g.enLlamada || g.enReunion)) return false;
  const { dormidos, faltan } = cuentaDormidos(gente);
  return dormidos > 0 && faltan === 0;
}

export const DORMIR_MSG = {
  /** Servidor → todos: cuántos duermen (`DormirEstado`), cuando cambia. */
  estado: "dormir:estado",
  /** Servidor → todos: amaneció (fundido y aviso). */
  amanecio: "dormir:amanecio",
  /** Servidor → quien intentó acostarse, si no se pudo (`DormirAviso`). */
  aviso: "dormir:aviso",
} as const;

export interface DormirEstado {
  dormidos: number;
  total: number;
}

export type DormirAvisoCode = "dia" | "ocupado";

export const DORMIR_AVISO_TEXT: Record<DormirAvisoCode, string> = {
  dia: "Todavía es de día: a la cama se va de noche.",
  ocupado: "En esa cama ya hay alguien durmiendo.",
};

/** El letrero de la pantalla mientras alguien duerme. */
export const durmiendoTexto = (e: DormirEstado) => `Durmiendo ${e.dormidos}/${e.total}`;

export const AMANECIO_TEXTO = "Amaneció. Buenos días.";
