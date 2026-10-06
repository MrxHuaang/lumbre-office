// La silleta de la Feria de las flores (feria-flores.ts): un marco de madera con flores puestas en una
// grilla chica. No tiene tabla propia: lo que lleva va en el id del objeto de la mochila
// (`obj:silleta:<código>`), una letra por casilla, de arriba a la izquierda hacia abajo a la derecha. Así
// el dibujo sale del id en cualquier lado (la mano, la mochila, el exhibidor) sin pedir nada a la base.
// Este archivo no importa la mochila (bolsa.ts lo usa para nombrar el objeto).

/** La grilla del marco: columnas y filas. */
export const SILLETA = { cols: 4, rows: 3, cells: 12, minFlores: 4, stackMax: 5 } as const;

/** La letra de cada flor en el código (`-` = casilla vacía). */
export const SILLETA_LETRAS = { c: "clavel", a: "astromelia", g: "girasol", h: "hortensia" } as const;
export type SilletaLetra = keyof typeof SILLETA_LETRAS;
export const SILLETA_VACIA = "-";

const CODE_RE = new RegExp(`^[${Object.keys(SILLETA_LETRAS).join("")}${SILLETA_VACIA}]{${SILLETA.cells}}$`);

export const SILLETA_PREFIX = "silleta:";

/** El id (sin `obj:`) de una silleta con ese código. */
export const silletaId = (code: string) => `${SILLETA_PREFIX}${code}`;

/** ¿Es un código de silleta bien formado (y con flores suficientes)? */
export function validSilletaCode(code: string): boolean {
  return CODE_RE.test(code) && silletaFlowerCount(code) >= SILLETA.minFlores;
}

/** El código de una silleta (`silleta:<código>`, con o sin `obj:`), o null si no es una. */
export function silletaCodeOf(id: string): string | null {
  const bare = id.startsWith("obj:") ? id.slice(4) : id;
  if (!bare.startsWith(SILLETA_PREFIX)) return null;
  const code = bare.slice(SILLETA_PREFIX.length);
  return validSilletaCode(code) ? code : null;
}

/** Cuántas flores lleva. */
export const silletaFlowerCount = (code: string) => [...code].filter((ch) => ch !== SILLETA_VACIA).length;

/** Cuántas de cada flor (id del producto del huerto → unidades) se gastan para armarla. */
export function silletaFlowers(code: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ch of code) {
    const flower = SILLETA_LETRAS[ch as SilletaLetra];
    if (flower) out[flower] = (out[flower] ?? 0) + 1;
  }
  return out;
}

const PLURAL: Record<string, string> = { clavel: "claveles", astromelia: "astromelias", girasol: "girasoles", hortensia: "hortensias" };

/** "Silleta de claveles" (si una flor manda: más de la mitad) o "Silleta de colores". */
export function silletaName(code: string): string {
  const counts = Object.entries(silletaFlowers(code)).sort((a, b) => b[1] - a[1]);
  const [top, n] = counts[0] ?? ["", 0];
  return n * 2 > silletaFlowerCount(code) ? `Silleta de ${PLURAL[top] ?? top}` : "Silleta de colores";
}
