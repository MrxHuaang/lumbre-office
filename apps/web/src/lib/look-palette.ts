import { HUMANS } from "@hyvento/map/art";
import {
  isSwimwear,
  LOOK_BOTTOMS,
  LOOK_CLOTHES,
  LOOK_EYES,
  LOOK_EYES_FANTASY,
  LOOK_HAIR_FANTASY,
  LOOK_HAIR_NATURAL,
  LOOK_SHOES,
  LOOK_SKINS,
  normalizeLook,
  PATTERNS,
  TOPS,
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
  // "Moño" ya es un peinado.
  bow: "Lazo",
  crown: "Corona",
  flower: "Flor",
  bandana: "Pañoleta",
  fedora: "Sombrero de fieltro",
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
  // Van juntos bajo "Traje de baño" (ver LookPanel).
  trunks: "Bañador",
  swimsuit: "Entero",
  bikini: "Bikini",
  trenchcoat: "Gabán",
  vest: "Chaleco",
};

/**
 * Lo que se pinta con el color de acento, con su artículo (para el título del selector y la ayuda). Tiene
 * que coincidir con el dibujo del chibi (packages/map/src/art/chibi: head.ts, gear.ts y clothes.ts).
 */
const ACCENT_HEAD: Partial<Record<HeadItem, string>> = {
  cap: "la gorra",
  beanie: "el gorro",
  headphones: "los audífonos",
  bow: "el lazo",
  bandana: "la pañoleta",
};
const ACCENT_NECK: Partial<Record<NeckItem, string>> = {
  scarf: "la bufanda",
  tie: "la corbata",
  bowtie: "el corbatín",
  necklace: "el collar",
};
const ACCENT_OUTFIT: Partial<Record<Outfit, string>> = {
  jacket: "la chaqueta",
  trunks: "los detalles del bañador",
  trenchcoat: "el gabán",
  vest: "el chaleco",
};
const ACCENT_BACK: Partial<Record<BackItem, string>> = { backpack: "el morral", cape: "la capa" };

/** Lo que lleva puesto y usa el color de acento, en el orden de la cabeza a la espalda. */
export function accentUsers(look: FullLook): string[] {
  return [ACCENT_HEAD[look.head], ACCENT_NECK[look.neck], look.outfit && ACCENT_OUTFIT[look.outfit], ACCENT_BACK[look.back]].filter(
    (n): n is string => Boolean(n),
  );
}

/** Ayuda del color de acento cuando no hay nada puesto que lo use: todo lo que lo usa (sale de los mismos mapas). */
export const ACCENT_HINT = `Lo usan ${joinEs([ACCENT_HEAD, ACCENT_NECK, ACCENT_OUTFIT, ACCENT_BACK].flatMap((m) => Object.values(m)))}.`;

/** Detalles de cada parte de arriba con el color secundario. */
const TOP2_TOP: Partial<Record<Top, string[]>> = {
  hoodie: ["la capucha"],
  "shirt-tie": ["la corbata"],
  sweater: ["el cuello", "los puños"],
  polo: ["el cuello", "los puños"],
};

/**
 * Lo que usa el color secundario de la parte de arriba (`top2`), con su artículo: el patrón y los detalles
 * de la parte de arriba. El vestido tapa la capucha, la corbata y el cuello (las mangas siguen a la vista)
 * y la chaqueta tapa los puños con sus mangas. Con traje de baño no hay parte de arriba: el entero y el
 * bikini llevan el patrón y el bañador nada.
 */
export function top2Users(look: FullLook): string[] {
  const parts: string[] = [];
  // El bañador no lleva la parte de arriba y el gabán cerrado la tapa entera.
  if (look.outfit === "trunks" || look.outfit === "trenchcoat") return parts;
  if (look.pattern === "stripes") parts.push("las rayas");
  if (look.pattern === "dots") parts.push("los puntos");
  if (isSwimwear(look.outfit)) return parts;
  for (const part of TOP2_TOP[look.top] ?? []) {
    if (look.outfit === "dress" && part !== "los puños") continue;
    if (look.outfit === "jacket" && part === "los puños") continue;
    parts.push(part);
  }
  return parts;
}

/** Ayuda del color secundario cuando no se ve: qué estampado o parte de arriba lo mostraría con lo demás puesto. */
export function top2Hint(look: FullLook): string {
  const patterns = PATTERNS.filter((pattern) => top2Users({ ...look, pattern }).length > 0).map((p) => PATTERN_LABEL[p].toLowerCase());
  const tops = TOPS.filter((top) => top2Users({ ...look, top, pattern: "solid" }).length > 0).map((t) => TOP_LABEL[t].toLowerCase());
  if (!patterns.length) return "Con este conjunto no se ve.";
  return `Se ve con ${joinEs(patterns, "o")}${tops.length ? `, o con ${joinEs(tops, "o")}` : ""}.`;
}

/** Ayuda del color de ojos cuando no se ve (los ojos cerrados son solo pestaña; las gafas de sol los tapan). */
export function eyeColorHint(look: FullLook): string | undefined {
  if (look.eyes === "happy" || look.eyes === "closed") return "No se ve con estos ojos.";
  if (look.face === "sunglasses") return "Las gafas de sol lo tapan.";
  return undefined;
}

/** "Color de la gorra", "Color del cuello y los puños"… */
export function colorTitle(parts: string[]): string {
  const joined = joinEs(parts);
  return joined.startsWith("el ") ? `Color del ${joined.slice(3)}` : `Color de ${joined}`;
}

/** "A", "A y B", "A, B y C" (o con "o"). */
export function joinEs(parts: string[], last: "y" | "o" = "y"): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} ${last} ${parts.at(-1)}`;
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
