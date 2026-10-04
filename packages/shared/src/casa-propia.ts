// La casa de cada persona (docs/plan-casas.md): no es la cabaña ("Casa viva" en casa.ts), sino tres
// niveles por persona que salen de la misma plantilla (world/areas/casa-propia*.ts de @hyvento/map):
// afuera (`casa:<userId>`: la parada, el antejardín, el jardín y el patio), el primer piso
// (`casa:<userId>:abajo`) y el segundo (`casa:<userId>:arriba`). Como la proximidad solo cuenta dentro
// del mismo `area`, cada casa queda aislada sola. Hasta que haya visitas (VIR-81/82) solo entra el dueño:
// lo valida el servidor en todos los caminos para cambiar de nivel (portales, bus, viaje rápido, `/ir`).

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

/** Por qué no se puede entrar a una casa: es de otra persona (todavía no hay visitas). */
export type CasaPropiaBlock = "ajena";

/** ¿Puede `userId` entrar a `area`? Solo importa si es una casa: ahí entra solo el dueño. */
export function casaPropiaBlock(area: string, userId: string): CasaPropiaBlock | null {
  const ref = parseCasaArea(area);
  if (!ref) return null;
  return ref.owner === userId ? null : "ajena";
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
