// Personaje al azar (botón "Al azar" del editor) y las paletas sugeridas de cada parte. Los colores
// combinan (piel natural, pelo natural y a veces de fantasía, ropa de la paleta cozy de la cabaña) y
// no sale nada que se vea roto: dos corbatas, un sombrero aplastando una cresta, una flor en una
// cabeza calva, la ropa del mismo color que el pantalón, unos zapatos que se funden con la pierna…
import {
  BACK_ITEMS,
  BOTTOMS,
  EYE_STYLES,
  FACE_ITEMS,
  FACIAL_HAIR,
  HAIR_STYLES,
  HEAD_ITEMS,
  isSwimwear,
  NECK_ITEMS,
  OUTFITS,
  PATTERNS,
  SHOES,
  SWIMWEAR,
  TOPS,
  type Bottom,
  type HairStyle,
  type HeadItem,
  type Look,
  type NeckItem,
  type Outfit,
  type Shoes,
  type Top,
} from "./look";

/** Tonos de piel. */
export const LOOK_SKINS = ["#ffe3c4", "#ffdbac", "#f1c27d", "#e0ac69", "#c68642", "#a86b3c", "#8d5524", "#5c3a21"] as const;
/** Pelo natural: negros, castaños, pelirrojos, rubios y canas. */
export const LOOK_HAIR_NATURAL = [
  "#0d0d0d",
  "#2b1b12",
  "#3b2219",
  "#6b4423",
  "#8a5a2b",
  "#b5651d",
  "#c9674e",
  "#d4a017",
  "#e6c77a",
  "#e8e1d0",
  "#8f8f99",
] as const;
/** Pelo de fantasía (sale de vez en cuando). */
export const LOOK_HAIR_FANTASY = ["#6886c4", "#5ec4c4", "#5ea247", "#f28fad", "#a45a6c", "#7a4a7e"] as const;
/** Ojos naturales y un par de fantasía. */
export const LOOK_EYES = ["#2b1b3a", "#4a2a1c", "#6b4423", "#437a55", "#4660a0", "#5f7384"] as const;
export const LOOK_EYES_FANTASY = ["#7a4a7e", "#c05a4a"] as const;
/** Ropa y accesorios: la paleta cozy de la cabaña más algunos neutros. */
export const LOOK_CLOTHES = [
  "#c05a4a",
  "#e76f51",
  "#e0923e",
  "#dcae3f",
  "#5ea247",
  "#437a55",
  "#2a9d8f",
  "#4660a0",
  "#6886c4",
  "#a45a6c",
  "#7a4a7e",
  "#5a331d",
  "#3a3a4a",
  "#f7ebc8",
] as const;
/** Parte de abajo: mezclilla, oscuros y tierra, y algunos colores que no pelean con la ropa. */
export const LOOK_BOTTOMS = [
  "#264653",
  "#1d3557",
  "#4660a0",
  "#22223b",
  "#3d405b",
  "#3a3a4a",
  "#4a4e69",
  "#5a331d",
  "#8a6f4e",
  "#437a55",
  "#a45a6c",
  "#f7ebc8",
] as const;
/** Zapatos: cueros, oscuros, crema y un par de colores. */
export const LOOK_SHOES = ["#3a2418", "#5a331d", "#8a5a2b", "#2b2b35", "#f3e6c4", "#c05a4a", "#4660a0"] as const;

/** Números en [0, 1), como Math.random. */
export type Random = () => number;

/** Azar con semilla (mulberry32): mismo número → mismo personaje (para los tests). */
export function seededRandom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Peinados altos: un sombrero o una gorra los aplastaría. */
export const TALL_HAIR: readonly HairStyle[] = ["mohawk", "afro", "top-knot", "spiky"];
/** Lo de la cabeza que tapa (o aplasta) el peinado. */
export const HATS: readonly HeadItem[] = ["cap", "beanie", "straw-hat", "crown", "bandana"];
/** Lo que se prende en el pelo: sin pelo no tiene dónde ir. */
export const HAIR_CLIPS: readonly HeadItem[] = ["bow", "flower"];
/** Corbatas de cuello: no van con la camisa que ya trae corbata, ni con esqueleto o capucha. */
export const NECK_TIES: readonly NeckItem[] = ["tie", "bowtie"];
export const NO_TIE_TOPS: readonly Top[] = ["shirt-tie", "tank", "hoodie"];
/** Conjuntos que no son traje de baño. */
export const EVERYDAY_OUTFITS: readonly Outfit[] = OUTFITS.filter((o) => !isSwimwear(o));
/** Con traje de baño (el pecho al aire) en el cuello solo va el collar. */
export const SWIM_NECK_ITEMS: readonly NeckItem[] = ["none", "necklace"];

/** Lo que se puede poner en la cabeza con cierto peinado. */
export function headItemsFor(hairStyle: HairStyle): HeadItem[] {
  return HEAD_ITEMS.filter(
    (h) => !(TALL_HAIR.includes(hairStyle) && HATS.includes(h)) && !(hairStyle === "bald" && HAIR_CLIPS.includes(h)),
  );
}

/** Lo que se puede poner en el cuello con cierta parte de arriba (y, si hay, cierto conjunto). */
export function neckItemsFor(top: Top, outfit?: Outfit): NeckItem[] {
  if (isSwimwear(outfit)) return [...SWIM_NECK_ITEMS];
  return NECK_ITEMS.filter((n) => !(NO_TIE_TOPS.includes(top) && NECK_TIES.includes(n)));
}

/**
 * ¿Los zapatos quedan junto a la piel? Con shorts, falda, vestido o traje de baño se ve la pierna encima del
 * zapato y con sandalias, el pie; solo el pantalón largo (sin vestido ni traje de baño) con zapatos cerrados
 * los separa de la piel.
 */
export function shoesTouchSkin(look: { bottom: Bottom; shoes: Shoes; outfit?: Outfit | undefined }): boolean {
  return look.bottom !== "pants" || look.outfit === "dress" || isSwimwear(look.outfit) || look.shoes === "sandals";
}

/** Distancia entre dos colores (0 = iguales), para que dos partes vecinas no se confundan. */
export function colorDistance(a: string, b: string): number {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  return Math.hypot(r1! - r2!, g1! - g2!, b1! - b2!);
}
/** Menos que esto se ve como el mismo color en el chibi. */
export const MIN_COLOR_DISTANCE = 70;

const pick = <T>(r: Random, list: readonly T[]): T => list[Math.floor(r() * list.length)]!;
const chance = (r: Random, p: number) => r() < p;
/** Uno de la lista con probabilidad `none` de "nada" (el primero, que siempre es "none"). */
const maybe = <T>(r: Random, list: readonly T[], none: number): T => (chance(r, none) ? list[0]! : pick(r, list.slice(1)));

/** Un color de la lista que se distinga de todos los de `avoid` (si no hay, el más lejano). */
function pickApart(r: Random, list: readonly string[], avoid: string[]): string {
  const ok = list.filter((c) => avoid.every((a) => colorDistance(c, a) >= MIN_COLOR_DISTANCE));
  if (ok.length) return pick(r, ok);
  const far = (c: string) => Math.min(...avoid.map((a) => colorDistance(c, a)));
  return [...list].sort((a, b) => far(b) - far(a))[0]!;
}

/** Un personaje al azar en el formato nuevo (con los lugares y `accessories: []`). */
export function randomLook(r: Random = Math.random): Look {
  const skin = pick(r, LOOK_SKINS);
  const hair = chance(r, 0.12) ? pick(r, LOOK_HAIR_FANTASY) : pickApart(r, LOOK_HAIR_NATURAL, [skin]);
  // Calvo sale poco: casi todos quieren pelo.
  const hairStyle: HairStyle = chance(r, 0.04)
    ? "bald"
    : pick(
        r,
        HAIR_STYLES.filter((h) => h !== "bald"),
      );
  const eyes = chance(r, 0.4) ? "normal" : pick(r, EYE_STYLES);
  const eyeColor = chance(r, 0.08) ? pick(r, LOOK_EYES_FANTASY) : pick(r, LOOK_EYES);

  const top = pick(r, TOPS);
  // Conjunto en uno de cada cuatro; el traje de baño casi nunca (al pulsar "Al azar" no debe salir seguido).
  const outfit = chance(r, 0.02) ? pick(r, SWIMWEAR) : chance(r, 0.25) ? pick(r, EVERYDAY_OUTFITS) : undefined;
  // El traje de baño va sobre la piel: su color (el de arriba o, el bañador, el de abajo) se distingue de ella.
  const shirt = outfit === "swimsuit" || outfit === "bikini" ? pickApart(r, LOOK_CLOTHES, [skin]) : pick(r, LOOK_CLOTHES);
  const pants = pickApart(r, LOOK_BOTTOMS, outfit === "trunks" ? [shirt, skin] : [shirt]);
  const top2 = pickApart(r, LOOK_CLOTHES, [shirt]);
  const accent = pickApart(r, LOOK_CLOTHES, [shirt, pants, skin]);
  const pattern = chance(r, 0.6)
    ? "solid"
    : pick(
        r,
        PATTERNS.filter((p) => p !== "solid"),
      );
  const bottom = pick(r, BOTTOMS);
  const shoes = pick(r, SHOES);
  // El zapato no se puede fundir con lo que tiene al lado: el pantalón y, si se ve, la piel.
  const shoeColor = pickApart(r, LOOK_SHOES, shoesTouchSkin({ bottom, shoes, outfit }) ? [pants, skin] : [pants]);

  return {
    skin,
    hair,
    shirt,
    pants,
    accent,
    hairStyle,
    accessories: [],
    ...(outfit && { outfit }),
    eyes,
    eyeColor,
    facialHair: maybe(r, FACIAL_HAIR, 0.78),
    freckles: chance(r, 0.25),
    blush: chance(r, 0.65),
    top,
    top2,
    pattern,
    bottom,
    shoes,
    shoeColor,
    head: maybe(r, headItemsFor(hairStyle), 0.5),
    face: maybe(r, FACE_ITEMS, 0.7),
    neck: maybe(r, neckItemsFor(top, outfit), 0.65),
    back: maybe(r, BACK_ITEMS, 0.75),
  };
}
