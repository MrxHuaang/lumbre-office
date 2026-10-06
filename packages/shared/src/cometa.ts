// La cometa del Festival de cometas (cometas.ts): se arma en el taller de la loma eligiendo la forma, dos
// colores de papel y el largo de la cola de trapitos. Como la silleta, no tiene tabla propia: lo que lleva
// va en el id del objeto de la mochila (`obj:cometa:<código>`), así su dibujo sale del id en la mano, en la
// mochila, en el cielo y en el concurso, sin pedirle nada a la base. Este archivo no importa la mochila
// (bolsa.ts lo usa para nombrar el objeto).

/** Las formas, con la letra que llevan en el código. */
export const COMETA_FORMAS = { r: "rombo", h: "hexagonal", p: "pajaro", z: "pez" } as const;
export type CometaFormaLetra = keyof typeof COMETA_FORMAS;
export type CometaForma = (typeof COMETA_FORMAS)[CometaFormaLetra];

/** Los colores del papel de seda, con su letra y su color. */
export const COMETA_COLORES = {
  r: { name: "rojo", hex: "#d8383a" },
  n: { name: "naranja", hex: "#ee8a2a" },
  a: { name: "amarillo", hex: "#f2cc3a" },
  v: { name: "verde", hex: "#4caa48" },
  z: { name: "azul", hex: "#3a7ad8" },
  m: { name: "morado", hex: "#8a4ac0" },
  s: { name: "rosado", hex: "#ee7aa8" },
  b: { name: "blanco", hex: "#f4f0e4" },
} as const;
export type CometaColorLetra = keyof typeof COMETA_COLORES;

/** Largo de la cola de trapitos: corta (sube rápido, se zarandea), media o larga (calmada, sube despacio). */
export const COMETA_COLAS = { "1": "corta", "2": "media", "3": "larga" } as const;
export type CometaColaLetra = keyof typeof COMETA_COLAS;

export const COMETA_PREFIX = "cometa:";
export const COMETA = { codeLength: 4, stackMax: 3 } as const;

const CODE_RE = new RegExp(`^[${Object.keys(COMETA_FORMAS).join("")}][${Object.keys(COMETA_COLORES).join("")}]{2}[123]$`);

export interface CometaPartes {
  forma: CometaForma;
  /** Color del papel de la cara de adelante y del de los bordes y la cola. */
  color1: CometaColorLetra;
  color2: CometaColorLetra;
  cola: 1 | 2 | 3;
}

/** ¿Es un código de cometa bien formado? */
export const validCometaCode = (code: string): boolean => CODE_RE.test(code);

/** El código de unas partes. */
export function cometaCode(p: { forma: CometaFormaLetra; color1: CometaColorLetra; color2: CometaColorLetra; cola: 1 | 2 | 3 }): string {
  return `${p.forma}${p.color1}${p.color2}${p.cola}`;
}

/** Las partes de un código (o null si no sirve). */
export function cometaPartes(code: string): CometaPartes | null {
  if (!validCometaCode(code)) return null;
  return {
    forma: COMETA_FORMAS[code[0] as CometaFormaLetra],
    color1: code[1] as CometaColorLetra,
    color2: code[2] as CometaColorLetra,
    cola: Number(code[3]) as 1 | 2 | 3,
  };
}

/** El id (sin `obj:`) de la cometa con ese código. */
export const cometaId = (code: string) => `${COMETA_PREFIX}${code}`;

/** El código de una cometa (`cometa:<código>`, con o sin `obj:`), o null si no es una. */
export function cometaCodeOf(id: string): string | null {
  const bare = id.startsWith("obj:") ? id.slice(4) : id;
  if (!bare.startsWith(COMETA_PREFIX)) return null;
  const code = bare.slice(COMETA_PREFIX.length);
  return validCometaCode(code) ? code : null;
}

const FORMA_NOMBRE: Record<CometaForma, string> = { rombo: "Cometa de rombo", hexagonal: "Cometa hexagonal", pajaro: "Cometa pájaro", pez: "Cometa pez" };

/** "Cometa pájaro roja y amarilla". */
export function cometaName(code: string): string {
  const p = cometaPartes(code);
  if (!p) return "Cometa";
  const c1 = COMETA_COLORES[p.color1].name;
  const c2 = COMETA_COLORES[p.color2].name;
  // Los colores concuerdan con "cometa" (femenino).
  const fem = (c: string) => (c.endsWith("o") ? `${c.slice(0, -1)}a` : c);
  return p.color1 === p.color2 ? `${FORMA_NOMBRE[p.forma]} ${fem(c1)}` : `${FORMA_NOMBRE[p.forma]} ${fem(c1)} y ${fem(c2)}`;
}

/** Los materiales que gasta armarla (ids de la mochila sin `obj:`): el papel, los palitos y la cabuya. */
export const MATERIAL = { papel: "papel-seda", palitos: "palitos-guadua", hilo: "carrete-cabuya" } as const;

export function cometaMateriales(code: string): Record<string, number> {
  const p = cometaPartes(code);
  if (!p) return {};
  // El rombo y el pez van con la cruz de siempre; la hexagonal y el pájaro llevan un palito más.
  const palitos = p.forma === "rombo" || p.forma === "pez" ? 2 : 3;
  return { [MATERIAL.papel]: 2, [MATERIAL.palitos]: palitos, [MATERIAL.hilo]: 1 };
}

/**
 * Cómo vuela cada forma y cada cola (ver cometa-vuelo.ts): `sube` multiplica lo que sube y `rafaga` lo que
 * le pegan las ráfagas al hilo. Las que suben más se zarandean más.
 */
export const FORMA_VUELO: Record<CometaForma, { sube: number; rafaga: number }> = {
  rombo: { sube: 1, rafaga: 0.92 },
  hexagonal: { sube: 1.1, rafaga: 1 },
  pajaro: { sube: 1.2, rafaga: 1.12 },
  pez: { sube: 0.94, rafaga: 0.86 },
};
export const COLA_VUELO: Record<1 | 2 | 3, { sube: number; rafaga: number }> = {
  1: { sube: 1.08, rafaga: 1.1 },
  2: { sube: 1, rafaga: 1 },
  3: { sube: 0.92, rafaga: 0.88 },
};
