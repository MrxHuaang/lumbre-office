import { HUMANS } from "@hyvento/map/art";
import type {
  Accessory,
  BackItem,
  Bottom,
  EyeStyle,
  FaceItem,
  FacialHair,
  HairStyle,
  HeadItem,
  HumanAvatar,
  Look,
  NeckItem,
  Outfit,
  Pattern,
  Shoes,
  Top,
} from "@hyvento/shared";

/** Muestras sugeridas del editor de personaje (además hay un selector de color libre). */
export const SKIN_TONES = ["#ffdbac", "#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#5c3a21"];
export const HAIR_COLORS = ["#0d0d0d", "#3b2219", "#6b4423", "#b5651d", "#d4a017", "#e8e1d0", "#c9674e", "#6886c4"];
/** Ropa y accesorios: la paleta cozy de la cabaña más algunos neutros. */
export const INK_COLORS = [
  "#c05a4a",
  "#e0923e",
  "#dcae3f",
  "#5ea247",
  "#437a55",
  "#4660a0",
  "#6886c4",
  "#a45a6c",
  "#7a4a7e",
  "#5a331d",
  "#3a3a4a",
  "#f7ebc8",
];

/**
 * Lo que se elige al entrar y desde "Mi personaje". El resto (y los conjuntos) se estrena en el
 * probador de la tienda, que es el vestidor; es todo gratis.
 */
export const BASIC_HAIR_STYLES: readonly HairStyle[] = ["short", "long", "curly", "buzz", "bun"];
export const BASIC_ACCESSORIES: readonly Accessory[] = ["glasses", "cap", "headphones", "beard"];

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

export const NECK_LABEL: Record<NeckItem, string> = { none: "Nada", scarf: "Bufanda", tie: "Corbata", bowtie: "Corbatín", necklace: "Collar" };

export const BACK_LABEL: Record<BackItem, string> = { none: "Nada", backpack: "Morral", cape: "Capa" };

export const ACCESSORY_LABEL: Record<Accessory, string> = {
  glasses: "Gafas",
  cap: "Gorra",
  headphones: "Audífonos",
  beard: "Barba",
  "straw-hat": "Sombrero de paja",
  beanie: "Gorro de lana",
  scarf: "Bufanda",
  flower: "Flor en el pelo",
};

export const OUTFIT_LABEL: Record<Outfit, string> = {
  overalls: "Overol",
  dress: "Vestido",
  jacket: "Chaqueta",
  apron: "Delantal",
};

/** Lo que se pinta con el color de acento (nombre corto, para el título del selector de color). */
export const ACCENT_ACCESSORIES: Partial<Record<Accessory, string>> = {
  cap: "gorra",
  headphones: "audífonos",
  beanie: "gorro",
  scarf: "bufanda",
};
export const ACCENT_OUTFITS: Partial<Record<Outfit, string>> = { jacket: "chaqueta" };

/** "A", "A y B", "A, B y C". */
export function joinEs(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}`;
}

/** Look equivalente a un personaje fijo, para empezar a editar desde él. */
export function presetLook(avatar: HumanAvatar): Look {
  const s = HUMANS[avatar] ?? HUMANS.ada;
  return { skin: s.skin, hair: s.hair, shirt: s.shirt, pants: s.pants, accent: "#4660a0", hairStyle: s.hairStyle ?? "short", accessories: [] };
}
