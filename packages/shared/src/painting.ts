// Pintura (app del PC): cuadros de pixel art de 16x16 con la paleta cozy. Cada cuadro se guarda en la
// tabla Painting y viaja por la mochila y el editor de decoración como el mueble `cuadro:<id>`: así se
// cuelga en la oficina con lo que ya existe (se pone, se mueve y se guarda como cualquier mueble).
import { z } from "zod";

export const PAINTING = {
  /** Lado del lienzo en píxeles. */
  size: 16,
  /** Cuadros guardados por persona (en la mochila o colgados). */
  maxPerUser: 24,
  titleMax: 40,
} as const;

/** Píxeles del lienzo: un dígito hexadecimal por píxel (índice de la paleta), fila por fila desde arriba. */
export const PAINTING_PIXELS = PAINTING.size * PAINTING.size;

/**
 * Paleta cozy de 16 colores (los tokens `--color-cozy-*` de la web y algunos tonos de la cabaña). El 0
 * es el lienzo en blanco (crema), así un cuadro nuevo es todo "0" y la goma pinta 0.
 */
export const PAINTING_PALETTE = [
  "#fdf0c8", // 0 lienzo (papel claro)
  "#2a2033", // 1 tinta
  "#5b2b0e", // 2 marco
  "#b3571a", // 3 madera
  "#e0923e", // 4 madera clara
  "#f5cf85", // 5 papel
  "#c9851c", // 6 dorado
  "#d93a2b", // 7 rojo
  "#a8262a", // 8 vino
  "#e59aa6", // 9 rosa
  "#8c6fb0", // a lila
  "#5d93cf", // b cielo
  "#a8d4f0", // c celeste
  "#4f8a3c", // d hoja
  "#8cc653", // e brote
  "#8f8a80", // f piedra
] as const;

/** Nombre de cada color para el selector (accesible). */
export const PAINTING_COLOR_NAMES = [
  "Lienzo",
  "Tinta",
  "Marco",
  "Madera",
  "Madera clara",
  "Papel",
  "Dorado",
  "Rojo",
  "Vino",
  "Rosa",
  "Lila",
  "Cielo",
  "Celeste",
  "Hoja",
  "Brote",
  "Piedra",
] as const;

export const BLANK_PAINTING = "0".repeat(PAINTING_PIXELS);

/** Prefijo del mueble de un cuadro en la mochila y en la oficina: `cuadro:<id>`. */
export const PAINTING_ITEM_PREFIX = "cuadro:";
/** El tipo del catálogo que dibuja el marco (el de todos los cuadros). */
export const PAINTING_BASE_TYPE = "cuadro";

/** Id de un cuadro: cuid de Prisma (letras minúsculas y números). */
const PAINTING_ID = /^[a-z0-9]{8,32}$/;

export const paintingItemId = (id: string) => `${PAINTING_ITEM_PREFIX}${id}`;

/** Id del cuadro de un mueble `cuadro:<id>` (o null si no es un cuadro válido). */
export function paintingIdOf(type: string): string | null {
  if (!type.startsWith(PAINTING_ITEM_PREFIX)) return null;
  const id = type.slice(PAINTING_ITEM_PREFIX.length);
  return PAINTING_ID.test(id) ? id : null;
}

/** Limpia el título: sin espacios de sobra y al largo máximo; vacío = "Sin título". */
export function cleanPaintingTitle(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim().slice(0, PAINTING.titleMax).trim();
  return t || "Sin título";
}

/** POST /api/paintings */
export const PaintingBody = z.object({
  title: z.string().max(PAINTING.titleMax * 2).default(""),
  pixels: z.string().regex(new RegExp(`^[0-9a-f]{${PAINTING_PIXELS}}$`), "El lienzo no es válido"),
});
export type PaintingBody = z.infer<typeof PaintingBody>;

/** ¿El lienzo está todo en blanco? (no se guarda un cuadro vacío). */
export const isBlankPainting = (pixels: string) => /^0+$/.test(pixels);

/** Un cuadro tal como lo ve la app (y cualquiera que lo mire colgado). */
export interface PaintingDTO {
  id: string;
  title: string;
  pixels: string;
  authorName: string;
  createdAt: string;
  /** Solo en la lista propia: si está en la mochila (se puede borrar) o colgado en la oficina. */
  inBackpack?: boolean;
}
