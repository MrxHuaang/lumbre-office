import { z } from "zod";

/**
 * Peinados. Los cinco primeros son gratis; los demás se compran en la tienda (fase 3b).
 * Ojo: agregar al final para no cambiar el orden de los existentes.
 */
export const HAIR_STYLES = ["short", "long", "curly", "buzz", "bun", "ponytail", "braids", "afro"] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];
export const FREE_HAIR_STYLES: readonly HairStyle[] = ["short", "long", "curly", "buzz", "bun"];

/**
 * Accesorios que se pueden combinar (la gorra, los audífonos, el gorro de lana y la bufanda usan el color
 * `accent`). Los cuatro primeros son gratis; los demás se compran.
 */
export const ACCESSORIES = ["glasses", "cap", "headphones", "beard", "straw-hat", "beanie", "scarf", "flower"] as const;
export type Accessory = (typeof ACCESSORIES)[number];
export const FREE_ACCESSORIES: readonly Accessory[] = ["glasses", "cap", "headphones", "beard"];
/** Lo que va en la cabeza: solo uno a la vez (si vienen varios, se queda el primero). */
export const HEADWEAR: readonly Accessory[] = ["cap", "straw-hat", "beanie"];

/**
 * Conjuntos que van encima de la camisa y el pantalón (todos se compran). Sin `outfit` se dibujan
 * camisa y pantalón como siempre.
 * - overalls: overol con el color `pants`, camisa debajo.
 * - dress: vestido con el color `shirt` (tapa el pantalón).
 * - jacket: chaqueta abierta con el color `accent` sobre la camisa.
 * - apron: delantal crema sobre la ropa.
 */
export const OUTFITS = ["overalls", "dress", "jacket", "apron"] as const;
export type Outfit = (typeof OUTFITS)[number];

const Color = z.string().regex(/^#[0-9a-f]{6}$/i, "Color inválido");

/**
 * Apariencia de un personaje personalizado. Si una persona no tiene `look`, se dibuja con uno
 * de los personajes fijos (`avatar`).
 */
export const Look = z.object({
  skin: Color,
  hair: Color,
  shirt: Color,
  pants: Color,
  accent: Color,
  hairStyle: z.enum(HAIR_STYLES),
  accessories: z
    .array(z.enum(ACCESSORIES))
    .max(ACCESSORIES.length)
    .transform((list) => {
      const unique = [...new Set(list)];
      const hat = unique.find((a) => HEADWEAR.includes(a));
      return unique.filter((a) => !HEADWEAR.includes(a) || a === hat);
    }),
  /** Opcional: los looks guardados antes de la tienda no lo tienen. */
  outfit: z.enum(OUTFITS).optional(),
});
export type Look = z.infer<typeof Look>;
