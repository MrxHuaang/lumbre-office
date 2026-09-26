import { z } from "zod";

/** Peinados disponibles para los personajes personalizados. */
export const HAIR_STYLES = ["short", "long", "curly", "buzz", "bun"] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

/** Accesorios que se pueden combinar (la gorra y los audífonos usan el color `accent`). */
export const ACCESSORIES = ["glasses", "cap", "headphones", "beard"] as const;
export type Accessory = (typeof ACCESSORIES)[number];

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
    .transform((list) => [...new Set(list)]),
});
export type Look = z.infer<typeof Look>;
