import { HUMANS } from "@hyvento/map/art";
import {
  LOOK_BOTTOMS,
  LOOK_CLOTHES,
  LOOK_EYES,
  LOOK_EYES_FANTASY,
  LOOK_HAIR_FANTASY,
  LOOK_HAIR_NATURAL,
  LOOK_SHOES,
  LOOK_SKINS,
  normalizeLook,
  type BackItem,
  type Bottom,
  type EyeStyle,
  type FaceItem,
  type FacialHair,
  type FullLook,
  type HairStyle,
  type HeadItem,
  type HumanAvatar,
  type Look,
  type LookInput,
  type NeckItem,
  type Outfit,
  type Pattern,
  type Shoes,
  type Top,
} from "@hyvento/shared";

/**
 * Muestras sugeridas del editor de personaje (además hay un selector de color libre). Son las mismas
 * paletas que usa "Al azar" (`randomLook`), para que lo sugerido y lo que sale al azar combinen.
 */
export const SKIN_TONES: readonly string[] = LOOK_SKINS;
export const HAIR_COLORS: readonly string[] = [...LOOK_HAIR_NATURAL, ...LOOK_HAIR_FANTASY];
export const EYE_COLORS: readonly string[] = [...LOOK_EYES, ...LOOK_EYES_FANTASY];
/** Ropa y accesorios: la paleta cozy de la cabaña más algunos neutros. */
export const INK_COLORS: readonly string[] = LOOK_CLOTHES;
export const PANTS_COLORS: readonly string[] = LOOK_BOTTOMS;
export const SHOE_COLORS: readonly string[] = LOOK_SHOES;

export const HAIR_STYLE_LABEL: Record<HairStyle, string> = {
  short: "Corto",
  long: "Largo",
  curly: "Rizado",
  buzz: "Rapado",
  bun: "Moño",
  ponytail: "Cola de caballo",
  braids: "Trenzas",
  afro: "Afro",
  bangs: "Flequillo",
  pigtails: "Dos colitas",
  mohawk: "Cresta",
  bald: "Calvo",
  "side-part": "De lado",
  wavy: "Ondulado",
  spiky: "En punta",
  bob: "Bob",
  dreads: "Rastas",
  "top-knot": "Moño alto",
  mullet: "Mullet",
  undercut: "Rapado a los lados",
};

export const EYE_LABEL: Record<EyeStyle, string> = {
  normal: "Normales",
  happy: "Felices",
  sleepy: "Dormilones",
  big: "Grandes",
  wink: "Guiño",
  closed: "Cerrados",
};

export const FACIAL_HAIR_LABEL: Record<FacialHair, string> = {
  none: "Nada",
  beard: "Barba",
  mustache: "Bigote",
  goatee: "Candado",
  stubble: "De tres días",
};

export const TOP_LABEL: Record<Top, string> = {
  tshirt: "Camiseta",
  longsleeve: "Manga larga",
  hoodie: "Buzo con capucha",
  sweater: "Suéter",
  "shirt-tie": "Camisa y corbata",
  tank: "Esqueleto",
  polo: "Polo",
};

export const PATTERN_LABEL: Record<Pattern, string> = { solid: "Liso", stripes: "Rayas", dots: "Puntos" };

export const BOTTOM_LABEL: Record<Bottom, string> = { pants: "Pantalón", shorts: "Shorts", skirt: "Falda" };

export const SHOES_LABEL: Record<Shoes, string> = { sneakers: "Tenis", boots: "Botas", sandals: "Sandalias" };

export const HEAD_LABEL: Record<HeadItem, string> = {
  none: "Nada",
  cap: "Gorra",
  beanie: "Gorro de lana",
  "straw-hat": "Sombrero de paja",
  headphones: "Audífonos",
  bow: "Moño",
  crown: "Corona",
  flower: "Flor",
  bandana: "Pañoleta",
};

export const FACE_LABEL: Record<FaceItem, string> = {
  none: "Nada",
  glasses: "Gafas",
  "round-glasses": "Gafas redondas",
  sunglasses: "Gafas de sol",
  eyepatch: "Parche",
};

export const NECK_LABEL: Record<NeckItem, string> = {
  none: "Nada",
  scarf: "Bufanda",
  tie: "Corbata",
  bowtie: "Corbatín",
  necklace: "Collar",
};

export const BACK_LABEL: Record<BackItem, string> = { none: "Nada", backpack: "Morral", cape: "Capa" };

export const OUTFIT_LABEL: Record<Outfit, string> = {
  overalls: "Overol",
  dress: "Vestido",
  jacket: "Chaqueta",
  apron: "Delantal",
};

/** Lo que se pinta con el color de acento (nombre corto, para el título del selector de color). */
const ACCENT_HEAD: Partial<Record<HeadItem, string>> = { cap: "gorra", beanie: "gorro", headphones: "audífonos", bandana: "pañoleta" };
const ACCENT_NECK: Partial<Record<NeckItem, string>> = { scarf: "bufanda" };
const ACCENT_BACK: Partial<Record<BackItem, string>> = { backpack: "morral", cape: "capa" };
const ACCENT_OUTFIT: Partial<Record<Outfit, string>> = { jacket: "chaqueta" };

/** Lo que lleva puesto y usa el color de acento, en el orden de la cabeza a la espalda. */
export function accentUsers(look: FullLook): string[] {
  return [ACCENT_HEAD[look.head], ACCENT_NECK[look.neck], look.outfit && ACCENT_OUTFIT[look.outfit], ACCENT_BACK[look.back]].filter(
    (n): n is string => Boolean(n),
  );
}

/** Lo que usa el color secundario de la parte de arriba (`top2`). */
export function top2Users(look: FullLook): string[] {
  const parts: string[] = [];
  if (look.pattern === "stripes") parts.push("rayas");
  if (look.pattern === "dots") parts.push("puntos");
  if (look.top === "hoodie") parts.push("capucha");
  if (look.top === "shirt-tie") parts.push("corbata");
  return parts;
}

/** "A", "A y B", "A, B y C". */
export function joinEs(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}`;
}

/** Un look completo en el formato nuevo: los lugares explícitos, `accessories: []` y sin conjunto si no hay. */
export function lookFromFull(full: FullLook): Look {
  const { outfit, ...rest } = full;
  return outfit ? { ...rest, outfit, accessories: [] } : { ...rest, accessories: [] };
}

/** Lo que escribe el editor: el formato nuevo con todo decidido, aunque se haya abierto un look viejo. */
export function editableLook(look: LookInput): Look {
  return lookFromFull(normalizeLook(look));
}

/** Look equivalente a un personaje fijo, para empezar a editar desde él. */
export function presetLook(avatar: HumanAvatar): Look {
  const s = HUMANS[avatar] ?? HUMANS.ada;
  return editableLook({ ...s, accent: "#4660a0", top2: "#f7ebc8" });
}
