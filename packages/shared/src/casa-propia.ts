// La casa de cada persona (docs/planes/plan-casas.md): no es la cabaña ("Casa viva" en casa.ts), sino tres
// niveles por persona que salen de la misma plantilla (world/areas/casa-propia*.ts de @hyvento/map):
// afuera (`casa:<userId>`: la parada, el antejardín, el jardín y el patio), el primer piso
// (`casa:<userId>:abajo`) y el segundo (`casa:<userId>:arriba`). Como la proximidad solo cuenta dentro
// del mismo `area`, cada casa queda aislada sola. Quién entra lo decide el dueño (VIR-81/82), como en las
// oficinas: abierta, solo invitados (por defecto) o cerrada; a los invitados se les deja pasar invitándolos
// o abriéndoles cuando tocan el timbre, y el pase se pierde al salir de la casa. Lo valida el servidor en
// todos los caminos para cambiar de nivel (portales, bus, viaje rápido, `/ir`).
import { z } from "zod";

export const CASA_PROPIA = {
  /** Prefijo del `area` (y de las zonas) de cada casa: `casa:<userId>[:piso]`. */
  prefix: "casa:",
  /** Cómo se nombra una casa vista desde afuera (el perfil, las fotos): no dice de quién es. */
  label: "Casa de alguien",
  /** Id con el que las casas cuentan para los logros y el diario (una sola, no una por casa ni por piso). */
  statArea: "casa-propia",
} as const;

/** Los tres niveles de la casa: el de afuera (sin sufijo) y los dos pisos. */
export const CASA_PISOS = ["afuera", "abajo", "arriba"] as const;
export type CasaPiso = (typeof CASA_PISOS)[number];

export interface CasaRef {
  owner: string;
  piso: CasaPiso;
}

/** El `area` de un piso de la casa de alguien (sin piso: afuera, donde se baja del bus). */
export function casaAreaOf(userId: string, piso: CasaPiso = "afuera"): string {
  return piso === "afuera" ? `${CASA_PROPIA.prefix}${userId}` : `${CASA_PROPIA.prefix}${userId}:${piso}`;
}

/** De quién es y qué piso es un `area` de casa; `null` si no es una casa. Un userId nunca lleva ":". */
export function parseCasaArea(area: string): CasaRef | null {
  if (!area.startsWith(CASA_PROPIA.prefix)) return null;
  const [owner, piso, ...rest] = area.slice(CASA_PROPIA.prefix.length).split(":");
  if (!owner || rest.length) return null;
  if (piso === undefined) return { owner, piso: "afuera" };
  return piso === "abajo" || piso === "arriba" ? { owner, piso } : null;
}

/** ¿Es el `area` de una casa (cualquier piso)? */
export function isCasaArea(area: string): boolean {
  return parseCasaArea(area) !== null;
}

/** De quién es la casa (`null` si no es una casa). */
export function casaOwnerOf(area: string): string | null {
  return parseCasaArea(area)?.owner ?? null;
}

/** Id del nivel para los contadores (visitas, tiempo en cada nivel): todas las casas cuentan como una. */
export function statAreaOf(area: string): string {
  return isCasaArea(area) ? CASA_PROPIA.statArea : area;
}

/** Quién entra a la casa: cualquiera, solo los que el dueño deja pasar, o nadie más que él. */
export const CASA_MODOS = ["abierta", "invitados", "cerrada"] as const;
export type CasaModo = (typeof CASA_MODOS)[number];
export const isCasaModo = (v: string): v is CasaModo => (CASA_MODOS as readonly string[]).includes(v);
/** Como pidió el dueño (28-09): por defecto, solo invitados. */
export const CASA_MODO_DEFAULT: CasaModo = "invitados";

export const CASA_MODO_TEXT: Record<CasaModo, { label: string; hint: string }> = {
  abierta: { label: "Abierta", hint: "Entra quien quiera (en el Megabús)." },
  invitados: { label: "Solo invitados", hint: "Entran los que invitas y a quienes les abres cuando tocan el timbre." },
  cerrada: { label: "Cerrada", hint: "Solo tú. Los que estaban se van." },
};

/** Lo que dice quién puede entrar a una casa (el modo y a quiénes el dueño dejó pasar). */
export interface CasaAcceso {
  modo: CasaModo;
  guests: readonly string[];
}

/** Por qué no se puede entrar a una casa: es solo con invitación, o el dueño la cerró. */
export type CasaPropiaBlock = "ajena" | "cerrada";

/**
 * ¿Puede `userId` entrar a `area`? Solo importa si es una casa: el dueño siempre; los demás según el modo
 * (sin `acceso`, como una casa que nunca se abrió: solo invitados, sin invitados).
 */
export function casaPropiaBlock(area: string, userId: string, acceso?: CasaAcceso): CasaPropiaBlock | null {
  const ref = parseCasaArea(area);
  if (!ref || ref.owner === userId) return null;
  const modo = acceso?.modo ?? CASA_MODO_DEFAULT;
  if (modo === "cerrada") return "cerrada";
  if (modo === "abierta") return null;
  return acceso?.guests.includes(userId) ? null : "ajena";
}

export const CASA_PROPIA_BLOCK_TEXT: Record<CasaPropiaBlock, string> = {
  ajena: "A esa casa se entra con invitación: pide que te inviten o toca el timbre.",
  cerrada: "Esa casa está cerrada: hoy no recibe visitas.",
};

/** Mensajes propios de la casa (fuera de MSG para no pisarse con otras ramas; `casa:` ya es de Casa viva). */
export const CASA_PROPIA_MSG = {
  /** Servidor → quien quiso entrar o hacer algo: por qué no pudo, o qué pasó (`CasaPropiaNotice`). */
  notice: "casaPropia:notice",
  /** Dueño → servidor: cambiar quién entra (`CasaModoMessage`). */
  modo: "casaPropia:modo",
  /** Dueño → servidor: pedirle a alguien que se vaya (`CasaKickMessage`). */
  kick: "casaPropia:kick",
} as const;

export const CasaModoMessage = z.object({ modo: z.enum(CASA_MODOS) }).strict();
export const CasaKickMessage = z.object({ userId: z.string().min(1).max(64) }).strict();

/** Avisos de la casa: los rechazos de entrar y lo que le pasa a una visita. */
export type CasaPropiaNoticeCode = CasaPropiaBlock | "echado" | "cerro";

export interface CasaPropiaNotice {
  code: CasaPropiaNoticeCode;
  /** Quién (el dueño, en "echado" y "cerro"). */
  name?: string;
}

export function casaPropiaNoticeText(n: CasaPropiaNotice): string {
  switch (n.code) {
    case "echado":
      return `${n.name ?? "El dueño"} te pidió que te fueras de su casa: te llevó el Megabús a la estación.`;
    case "cerro":
      return `${n.name ?? "El dueño"} cerró su casa: te llevó el Megabús a la estación.`;
    default:
      return CASA_PROPIA_BLOCK_TEXT[n.code];
  }
}
