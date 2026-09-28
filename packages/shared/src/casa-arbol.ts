// La casa del árbol del jardín: un nivel chico aparte (`casa-arbol`) para reuniones de uno a uno o para
// concentrarse. Se sube por la escalera de cuerda (un portal) y caben tres. Adentro, "Subir la escalera"
// la cierra: nadie más sube hasta que alguien la baje o se vacíe la casa (entonces se baja sola). Hay un
// modo foco opcional (pomodoro) que ven los de adentro. El servidor valida el cupo y el cierre al usar el
// portal; el cliente solo lo anticipa (para no fundirse a negro y rebotar).
import { z } from "zod";

export const CASA_ARBOL = {
  /** Nivel y zona de adentro (una sala aislada que ocupa todo el cuarto). */
  area: "casa-arbol",
  zone: "casa-arbol",
  /** Portal del jardín que sube (el pie de la escalera de cuerda). */
  portal: "jardin-casa-arbol",
  /** Cuántas personas caben arriba. */
  capacity: 3,
  /** Modo foco: bloque de concentración y el descanso que viene después. */
  focusMs: 25 * 60_000,
  breakMs: 5 * 60_000,
} as const;

/** Por qué no se puede subir: está llena o alguien recogió la escalera. */
export type CasaArbolBlock = "full" | "locked";

/**
 * ¿Puede subir alguien? `inside` = cuántas personas hay arriba (sin contar a quien quiere subir).
 * Con la escalera recogida no sube nadie; si no, hasta llenar el cupo.
 */
export function casaArbolBlock(inside: number, locked: boolean): CasaArbolBlock | null {
  if (locked) return "locked";
  if (inside >= CASA_ARBOL.capacity) return "full";
  return null;
}

export const CASA_ARBOL_BLOCK_TEXT: Record<CasaArbolBlock, string> = {
  full: "La casa del árbol está llena: caben tres. Espera a que baje alguien.",
  locked: "Ocupado: recogieron la escalera. Nadie sube hasta que la bajen.",
};

/** Fase del modo foco: "" apagado, "focus" concentración, "break" descanso. */
export type CasaArbolFocus = "" | "focus" | "break";

/** Lo que el servidor sincroniza de la casa del árbol (espejo de `TreeHouseState`). */
export interface CasaArbolView {
  /** La escalera está recogida (cerrada). */
  locked: boolean;
  /** Quién la recogió (se ve en el panel de adentro). */
  lockedBy: string;
  focus: CasaArbolFocus;
  /** Cuándo termina la fase del modo foco, en ms de la hora del servidor. */
  focusEndsAt: number;
}

/** Siguiente fase del modo foco al terminar la actual: al foco le sigue el descanso, y ahí se apaga. */
export function nextFocusPhase(phase: CasaArbolFocus): { phase: CasaArbolFocus; ms: number } {
  if (phase === "focus") return { phase: "break", ms: CASA_ARBOL.breakMs };
  return { phase: "", ms: 0 };
}

/** mm:ss que le quedan a la fase del modo foco (a la hora del servidor `now`). */
export function focusLeftText(endsAt: number, now: number): string {
  const s = Math.max(0, Math.ceil((endsAt - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Mensajes propios de la casa del árbol (fuera de MSG para no pisarse con otras ramas). */
export const CASA_ARBOL_MSG = {
  /** Cliente → servidor: recoger (`up: true`) o bajar la escalera (hay que estar arriba). */
  ladder: "arbol:ladder",
  /** Cliente → servidor: empezar el foco, pasar al descanso o apagar el modo foco. */
  focus: "arbol:focus",
  /** Servidor → quien quiso subir: por qué no pudo (`CasaArbolNotice`). */
  notice: "arbol:notice",
} as const;

export const CasaArbolLadderMessage = z.object({ up: z.boolean() });
export type CasaArbolLadderMessage = z.infer<typeof CasaArbolLadderMessage>;

export const CasaArbolFocusMessage = z.object({ action: z.enum(["start", "break", "stop"]) });
export type CasaArbolFocusMessage = z.infer<typeof CasaArbolFocusMessage>;

export interface CasaArbolNotice {
  code: CasaArbolBlock;
}
