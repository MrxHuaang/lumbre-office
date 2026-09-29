// La casa de cada persona (docs/plan-casas.md): no es la cabaña ("Casa viva" en casa.ts), sino un nivel
// por persona. Todos llegan a la misma calle del barrio, pero la puerta lleva a la casa de quien la cruza:
// el `area` es `casa:<userId>` y el nivel se arma desde una plantilla (world/areas/casa-propia.ts de
// @hyvento/map). Como la proximidad solo cuenta dentro del mismo `area`, cada casa queda aislada sola.
// Hasta que haya visitas (VIR-81/82) solo entra el dueño: lo valida el servidor en `handleTravel`.

export const CASA_PROPIA = {
  /** Prefijo del `area` (y de la zona) de cada casa: `casa:<userId>`. */
  prefix: "casa:",
  /**
   * Destino de la puerta del barrio: "la casa de quien entra". El servidor lo cambia por `casa:<userId>`
   * (un userId nunca lleva "@").
   */
  own: "casa:@",
  /** La calle con las fachadas, donde está la puerta. */
  street: "barrio",
  /** Portal de la puerta del barrio. */
  portal: "barrio-casa",
  /** Id con el que las casas cuentan para los logros y el diario (una sola, no una por casa). */
  statArea: "casa-propia",
} as const;

/** ¿Es el `area` (o la zona) de una casa? `casa:@` (el destino de la puerta) también cuenta. */
export function isCasaArea(area: string): boolean {
  return area.startsWith(CASA_PROPIA.prefix) && area.length > CASA_PROPIA.prefix.length;
}

/** El `area` de la casa de alguien. */
export function casaAreaOf(userId: string): string {
  return `${CASA_PROPIA.prefix}${userId}`;
}

/** De quién es la casa (`null` si no es una casa o es el destino genérico de la puerta). */
export function casaOwnerOf(area: string): string | null {
  if (!isCasaArea(area) || area === CASA_PROPIA.own) return null;
  return area.slice(CASA_PROPIA.prefix.length);
}

/** Id del nivel para los contadores (visitas, tiempo en cada nivel): todas las casas cuentan como una. */
export function statAreaOf(area: string): string {
  return isCasaArea(area) ? CASA_PROPIA.statArea : area;
}

/** Por qué no se puede entrar a una casa: es de otra persona (todavía no hay visitas). */
export type CasaPropiaBlock = "ajena";

/** ¿Puede `userId` entrar a `area`? Solo importa si es una casa: ahí entra solo el dueño. */
export function casaPropiaBlock(area: string, userId: string): CasaPropiaBlock | null {
  if (!isCasaArea(area) || area === CASA_PROPIA.own) return null;
  return casaOwnerOf(area) === userId ? null : "ajena";
}

export const CASA_PROPIA_BLOCK_TEXT: Record<CasaPropiaBlock, string> = {
  ajena: "Esa casa no es tuya: por ahora cada quien entra solo a la suya.",
};

/** Mensajes propios de la casa (fuera de MSG para no pisarse con otras ramas; `casa:` ya es de Casa viva). */
export const CASA_PROPIA_MSG = {
  /** Servidor → quien quiso entrar: por qué no pudo (`CasaPropiaNotice`). */
  notice: "casaPropia:notice",
} as const;

export interface CasaPropiaNotice {
  code: CasaPropiaBlock;
}
