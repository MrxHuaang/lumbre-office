import { z } from "zod";
import { COSTUME_IDS, type CostumeId } from "./costume-ids";

// Apariencia de los personajes (todo gratis). Estilo Terraria: color por parte, muchos peinados, cara,
// ropa por capas y accesorios por lugar. Los campos nuevos son opcionales para que los looks guardados
// antes sigan valiendo; `normalizeLook` los completa con valores por defecto.
// Ojo con el orden de las listas: agregar siempre al final.

/** Peinados. */
export const HAIR_STYLES = [
  "short",
  "long",
  "curly",
  "buzz",
  "bun",
  "ponytail",
  "braids",
  "afro",
  "bangs",
  "pigtails",
  "mohawk",
  "bald",
  "side-part",
  "wavy",
  "spiky",
  "bob",
  "dreads",
  "top-knot",
  "mullet",
  "undercut",
] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

/** Forma de los ojos. */
export const EYE_STYLES = ["normal", "happy", "sleepy", "big", "wink", "closed"] as const;
export type EyeStyle = (typeof EYE_STYLES)[number];

/** Vello facial (del color del pelo). */
export const FACIAL_HAIR = ["none", "beard", "mustache", "goatee", "stubble"] as const;
export type FacialHair = (typeof FACIAL_HAIR)[number];

/** Parte de arriba (color `shirt`; `top2` es el color secundario: rayas, puntos, capucha, corbata…). */
export const TOPS = [
  "tshirt",
  "longsleeve",
  "hoodie",
  "sweater",
  "shirt-tie",
  "tank",
  "polo",
  "dress-shirt",
  "flannel",
  "turtleneck",
  "jersey",
  "hawaiian",
  "sailor",
  "cardigan",
  "graphic-tee",
] as const;
export type Top = (typeof TOPS)[number];
export const PATTERNS = ["solid", "stripes", "dots"] as const;
export type Pattern = (typeof PATTERNS)[number];

/** Parte de abajo (color `pants`). */
export const BOTTOMS = ["pants", "shorts", "skirt", "long-skirt", "cargo", "joggers"] as const;
export type Bottom = (typeof BOTTOMS)[number];

/** Zapatos (color `shoeColor`). */
export const SHOES = ["sneakers", "boots", "sandals", "dress-shoes", "rain-boots", "slippers", "heels"] as const;
export type Shoes = (typeof SHOES)[number];

/**
 * Conjuntos que van encima de la parte de arriba y la de abajo. Sin `outfit` se dibujan las dos.
 * - overalls: overol con el color `pants`, la parte de arriba debajo.
 * - dress: vestido con el color `shirt` (tapa la parte de abajo).
 * - jacket: chaqueta abierta con el color `accent`.
 * - apron: delantal crema.
 * - trunks: bañador de hombre con el color `pants` (franja y cordón con `accent`); pecho y brazos al aire.
 * - swimsuit: traje de baño entero con el color `shirt` (lleva el patrón); brazos y piernas al aire.
 * - bikini: parte de arriba y de abajo con el color `shirt` (lleva el patrón); barriga al aire.
 * - coveralls: mono entero con el color `pants` (tapa arriba y abajo; mangas largas).
 * - gown: vestido largo hasta el suelo con el color `shirt` (lleva el patrón), sin mangas.
 * - blazer: saco con solapas del color `pants` (de traje); la parte de arriba asoma en el escote.
 * - vest: chaleco del color `pants`; se ven las mangas y el escote de la parte de arriba.
 * - coat: abrigo acolchado del color `shirt`, hasta la cadera.
 * - raincoat: impermeable largo del color `shirt`, con botones.
 * - lab-coat: bata blanca abierta, hasta la rodilla.
 * - chef-coat: filipina blanca cruzada, con dos filas de botones.
 * - pajamas: pijama del color `shirt` (lleva el patrón) con ribetes del color `top2`.
 * - robe: bata cruzada del color `shirt` con cinturón, hasta la rodilla.
 * - ruana: ruana de lana del color `shirt` con franjas del color `top2`.
 * - hi-vis: chaleco reflectivo naranja.
 * - trenchcoat: gabán largo cerrado del color `accent`, con cinturón y el cuello alzado (el del Man del
 *   Sombrero); tapa la parte de arriba y llega a la rodilla.
 */
export const OUTFITS = [
  "overalls",
  "dress",
  "jacket",
  "apron",
  "trunks",
  "swimsuit",
  "bikini",
  "coveralls",
  "gown",
  "blazer",
  "vest",
  "coat",
  "raincoat",
  "lab-coat",
  "chef-coat",
  "pajamas",
  "robe",
  "ruana",
  "hi-vis",
  "trenchcoat",
] as const;
export type Outfit = (typeof OUTFITS)[number];

/** Trajes de baño: con ellos no se dibujan la parte de arriba ni la de abajo, se ve la piel. */
export const SWIMWEAR = ["trunks", "swimsuit", "bikini"] as const satisfies readonly Outfit[];
export type Swimwear = (typeof SWIMWEAR)[number];
export const isSwimwear = (outfit: Outfit | null | undefined): outfit is Swimwear =>
  (SWIMWEAR as readonly (Outfit | null | undefined)[]).includes(outfit);

/** Accesorios por lugar (uno por lugar). Los que llevan color usan `accent`. */
export const HEAD_ITEMS = [
  "none",
  "cap",
  "beanie",
  "straw-hat",
  "headphones",
  "bow",
  "crown",
  "flower",
  "bandana",
  "chef-hat",
  "top-hat",
  "fire-helmet",
  "hard-hat",
  "rain-hat",
  "sailor-hat",
  "bee-hat",
  "space-helmet",
  "party-hat",
  "beret",
  "bucket-hat",
  "vueltiao",
  "nightcap",
  "headband",
  "pompom-beanie",
  "tiara",
  "pirate-hat",
  "wizard-hat",
  // Sombrero de fieltro gris con cinta oscura (el del Man del Sombrero); color propio.
  "fedora",
  // Sombrero de bruja: ala ancha y la punta doblada, con la cinta naranja (el sombrero va en `accent`).
  "witch-hat",
  // Del Carnaval de Pasto: el sombrero negro de fieltro con flores en la cinta y cintas de colores atrás,
  // y la máscara de papel maché levantada sobre la frente (mitad blanca, mitad negra). Colores propios.
  "flower-hat",
  "raised-mask",
] as const;
export type HeadItem = (typeof HEAD_ITEMS)[number];
export const FACE_ITEMS = ["none", "glasses", "round-glasses", "sunglasses", "eyepatch", "3d-glasses", "hero-mask", "star-glasses", "monocle", "carnival-mask"] as const;
export type FaceItem = (typeof FACE_ITEMS)[number];
export const NECK_ITEMS = ["none", "scarf", "tie", "bowtie", "necklace", "lanyard", "neckerchief", "pearls", "chain", "stethoscope", "medal", "whistle"] as const;
export type NeckItem = (typeof NECK_ITEMS)[number];
export const BACK_ITEMS = ["none", "backpack", "cape", "air-tank", "wings", "guitar"] as const;
export type BackItem = (typeof BACK_ITEMS)[number];

/**
 * Formato viejo de accesorios (antes de los lugares). Se sigue aceptando al leer looks guardados;
 * `normalizeLook` lo traduce a `head`/`face`/`neck` y a `facialHair`. El editor nuevo no lo escribe.
 */
export const ACCESSORIES = ["glasses", "cap", "headphones", "beard", "straw-hat", "beanie", "scarf", "flower"] as const;
export type Accessory = (typeof ACCESSORIES)[number];
/** Lo que va en la cabeza en el formato viejo: solo uno a la vez (si vienen varios, se queda el primero). */
export const HEADWEAR: readonly Accessory[] = ["cap", "straw-hat", "beanie"];

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
  /** Formato viejo; ver ACCESSORIES. */
  accessories: z
    .array(z.enum(ACCESSORIES))
    .max(ACCESSORIES.length)
    .default([])
    .transform((list) => {
      const unique = [...new Set(list)];
      const hat = unique.find((a) => HEADWEAR.includes(a));
      return unique.filter((a) => !HEADWEAR.includes(a) || a === hat);
    }),
  outfit: z.enum(OUTFITS).optional(),
  eyes: z.enum(EYE_STYLES).optional(),
  eyeColor: Color.optional(),
  facialHair: z.enum(FACIAL_HAIR).optional(),
  freckles: z.boolean().optional(),
  blush: z.boolean().optional(),
  top: z.enum(TOPS).optional(),
  top2: Color.optional(),
  pattern: z.enum(PATTERNS).optional(),
  bottom: z.enum(BOTTOMS).optional(),
  shoes: z.enum(SHOES).optional(),
  shoeColor: Color.optional(),
  head: z.enum(HEAD_ITEMS).optional(),
  face: z.enum(FACE_ITEMS).optional(),
  neck: z.enum(NECK_ITEMS).optional(),
  back: z.enum(BACK_ITEMS).optional(),
  /**
   * Traje completo (ver costumes.ts): reemplaza de una vez la ropa y, con `costumeGear`, también lo de
   * la cabeza, la cara, el cuello y la espalda. Un traje que ya no existe se ignora (no invalida el look).
   */
  costume: z.enum(COSTUME_IDS).optional().catch(undefined),
  /** El color que se puede cambiar del traje (cada traje dice cuál es). */
  costumeColor: Color.optional().catch(undefined),
  /** Con el traje, su sombrero y sus accesorios (si es false, quedan los propios). */
  costumeGear: z.boolean().optional().catch(undefined),
});
export type Look = z.infer<typeof Look>;

/** Look con todo decidido: lo que dibuja el chibi. */
export interface FullLook {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  accent: string;
  hairStyle: HairStyle;
  outfit: Outfit | null;
  eyes: EyeStyle;
  eyeColor: string;
  facialHair: FacialHair;
  freckles: boolean;
  blush: boolean;
  top: Top;
  top2: string;
  pattern: Pattern;
  bottom: Bottom;
  shoes: Shoes;
  shoeColor: string;
  head: HeadItem;
  face: FaceItem;
  neck: NeckItem;
  back: BackItem;
  costume: CostumeId | null;
  costumeColor: string | null;
  costumeGear: boolean;
}

/** Valores por defecto de lo que no venga en el look (así se veían los personajes antes). */
export const LOOK_DEFAULTS = {
  eyes: "normal",
  eyeColor: "#2b1b3a",
  facialHair: "none",
  freckles: false,
  blush: true,
  // Manga larga: así se veían los personajes antes de la camiseta de manga corta (nadie cambia sin querer).
  top: "longsleeve",
  pattern: "solid",
  bottom: "pants",
  shoes: "sneakers",
  shoeColor: "#3a2418",
} as const satisfies Partial<FullLook>;

/** Lo mínimo para dibujar (personajes fijos, looks viejos): el resto se completa con los defectos. */
export type LookInput = Pick<Look, "skin" | "hair" | "shirt" | "pants"> & Partial<Omit<Look, "skin" | "hair" | "shirt" | "pants">>;

/**
 * Completa un look con los valores por defecto y traduce el formato viejo de accesorios: un lugar
 * elegido explícitamente gana sobre lo que diga `accessories`.
 */
export function normalizeLook(look: LookInput): FullLook {
  const legacy = new Set(look.accessories ?? []);
  const oldHead = (["cap", "straw-hat", "beanie", "headphones", "flower"] as const).find((a) => legacy.has(a));
  return {
    skin: look.skin,
    hair: look.hair,
    shirt: look.shirt,
    pants: look.pants,
    accent: look.accent ?? "#e0923e",
    hairStyle: look.hairStyle ?? "short",
    outfit: look.outfit ?? null,
    eyes: look.eyes ?? LOOK_DEFAULTS.eyes,
    eyeColor: look.eyeColor ?? LOOK_DEFAULTS.eyeColor,
    facialHair: look.facialHair ?? (legacy.has("beard") ? "beard" : LOOK_DEFAULTS.facialHair),
    freckles: look.freckles ?? LOOK_DEFAULTS.freckles,
    blush: look.blush ?? LOOK_DEFAULTS.blush,
    top: look.top ?? LOOK_DEFAULTS.top,
    top2: look.top2 ?? look.accent ?? "#e0923e",
    pattern: look.pattern ?? LOOK_DEFAULTS.pattern,
    bottom: look.bottom ?? LOOK_DEFAULTS.bottom,
    shoes: look.shoes ?? LOOK_DEFAULTS.shoes,
    shoeColor: look.shoeColor ?? LOOK_DEFAULTS.shoeColor,
    head: look.head ?? oldHead ?? "none",
    face: look.face ?? (legacy.has("glasses") ? "glasses" : "none"),
    neck: look.neck ?? (legacy.has("scarf") ? "scarf" : "none"),
    back: look.back ?? "none",
    costume: look.costume ?? null,
    costumeColor: look.costume ? (look.costumeColor ?? null) : null,
    costumeGear: look.costumeGear ?? true,
  };
}
