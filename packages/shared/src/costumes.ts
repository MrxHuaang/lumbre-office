// Trajes completos: combinaciones fijas de ropa (con sus colores) para cada situación de la cabaña, que
// se ponen de una vez desde el editor o el vestidor. No agregan un dibujo aparte: son recetas de las
// mismas prendas del Look (partes de arriba y de abajo, conjuntos, zapatos y accesorios) más algunos
// detalles propios (el estampado de código, las cintas reflectivas…) que dibuja el chibi.
import { COSTUME_IDS, type CostumeId } from "./costume-ids";
import type { BackItem, Bottom, FaceItem, FullLook, HeadItem, NeckItem, Outfit, Pattern, Shoes, Top } from "./look";

export { COSTUME_IDS, type CostumeId };

/** Detalles que solo llevan los trajes (el dibujo está en packages/map/src/art/chibi/costumes.ts). */
export const COSTUME_DETAILS = [
  "pocket-pen",
  "pocket-square",
  "code-print",
  "chef-check",
  "sleeve-garters",
  "reflective",
  "space-patch",
  "bee-buddy",
  "seed-pouch",
  "paint-spots",
  "emblem",
  "stars",
  "confetti",
  "fangs",
  "pumpkin-face",
  "bones",
] as const;
export type CostumeDetail = (typeof COSTUME_DETAILS)[number];

/** Grupos de la grilla de trajes, en orden. */
export const COSTUME_CATEGORIES = [
  { id: "trabajo", label: "Trabajo" },
  { id: "campo", label: "Campo y mar" },
  { id: "ocio", label: "Ocio y deporte" },
  { id: "casa", label: "Casa y clima" },
  { id: "gala", label: "Fiesta y gala" },
  { id: "disfraz", label: "Disfraces" },
  { id: "brujas", label: "De la Noche de brujas" },
  { id: "carnaval", label: "Del Carnaval" },
  // Los de los oficios: se ganan subiendo de nivel (oficios.ts).
  { id: "oficios", label: "De los oficios" },
] as const;
export type CostumeCategory = (typeof COSTUME_CATEGORIES)[number]["id"];

/** Los colores de la ropa que fija un traje. */
export type CostumeColorSlot = "shirt" | "top2" | "pants" | "accent" | "shoeColor";

export interface Costume {
  label: string;
  category: CostumeCategory;
  top: Top;
  bottom: Bottom;
  outfit?: Outfit;
  shoes: Shoes;
  pattern?: Pattern;
  colors: Record<CostumeColorSlot, string>;
  /** Lo que se pone con "sombrero y accesorios" (lo que no dice, queda en nada). */
  gear?: { head?: HeadItem; face?: FaceItem; neck?: NeckItem; back?: BackItem };
  /** Guantes (tapan las manos). */
  gloves?: string;
  details?: readonly CostumeDetail[];
  /** El color que se deja cambiar (`costumeColor`): a qué colores del traje va y cómo se llama en el editor. */
  tint?: { slots: readonly CostumeColorSlot[]; label: string };
}

const WHITE = "#f3f1ec";
const BLACK = "#24212e";
const NAVY = "#263262";
const DENIM = "#4660a0";
const CHARCOAL = "#3a3a4a";
const LEATHER = "#5a331d";

export const COSTUMES: Record<CostumeId, Costume> = {
  // ---------- Trabajo ----------
  oficinista: {
    label: "Oficinista",
    category: "trabajo",
    top: "shirt-tie",
    bottom: "pants",
    shoes: "dress-shoes",
    colors: { shirt: WHITE, top2: "#c05a4a", pants: "#3d405b", accent: "#4660a0", shoeColor: "#3a2418" },
    details: ["pocket-pen"],
    tint: { slots: ["top2"], label: "Color de la corbata" },
  },
  ejecutivo: {
    label: "De traje",
    category: "trabajo",
    top: "shirt-tie",
    bottom: "pants",
    outfit: "blazer",
    shoes: "dress-shoes",
    colors: { shirt: WHITE, top2: "#6886c4", pants: "#22223b", accent: "#c05a4a", shoeColor: "#2b1b12" },
    details: ["pocket-square"],
    tint: { slots: ["pants"], label: "Color del traje" },
  },
  programador: {
    label: "Programador",
    category: "trabajo",
    top: "hoodie",
    bottom: "pants",
    shoes: "sneakers",
    colors: { shirt: CHARCOAL, top2: "#5ea247", pants: DENIM, accent: "#2a9d8f", shoeColor: "#c05a4a" },
    gear: { head: "headphones", face: "glasses" },
    details: ["code-print"],
    tint: { slots: ["shirt"], label: "Color del buzo" },
  },
  chef: {
    label: "Chef",
    category: "trabajo",
    top: "longsleeve",
    bottom: "pants",
    outfit: "chef-coat",
    shoes: "dress-shoes",
    colors: { shirt: WHITE, top2: WHITE, pants: CHARCOAL, accent: "#c05a4a", shoeColor: BLACK },
    gear: { head: "chef-hat", neck: "neckerchief" },
    details: ["chef-check"],
    tint: { slots: ["accent"], label: "Color del pañuelo" },
  },
  barista: {
    label: "Barista",
    category: "trabajo",
    top: "turtleneck",
    bottom: "pants",
    outfit: "apron",
    shoes: "sneakers",
    colors: { shirt: "#437a55", top2: "#437a55", pants: LEATHER, accent: "#6e3b22", shoeColor: "#3a2418" },
    gear: { head: "beret" },
    tint: { slots: ["shirt"], label: "Color del cuello alto" },
  },
  crupier: {
    label: "Crupier",
    category: "trabajo",
    top: "dress-shirt",
    bottom: "pants",
    outfit: "vest",
    shoes: "dress-shoes",
    colors: { shirt: WHITE, top2: WHITE, pants: BLACK, accent: "#c05a4a", shoeColor: BLACK },
    gear: { neck: "bowtie" },
    details: ["sleeve-garters"],
    tint: { slots: ["accent"], label: "Color del corbatín" },
  },
  medico: {
    label: "Médico",
    category: "trabajo",
    top: "dress-shirt",
    bottom: "pants",
    outfit: "lab-coat",
    shoes: "dress-shoes",
    colors: { shirt: "#9cb9da", top2: "#9cb9da", pants: "#3d405b", accent: "#4660a0", shoeColor: "#3a2418" },
    gear: { neck: "stethoscope" },
    details: ["pocket-pen"],
    tint: { slots: ["shirt"], label: "Color de la camisa" },
  },
  bombero: {
    label: "Bombero",
    category: "trabajo",
    top: "longsleeve",
    bottom: "pants",
    outfit: "coveralls",
    shoes: "rain-boots",
    colors: { shirt: "#c7a15a", top2: "#c7a15a", pants: "#c7a15a", accent: "#c0392b", shoeColor: BLACK },
    gear: { head: "fire-helmet", back: "air-tank" },
    gloves: "#3a3a4a",
    details: ["reflective"],
    tint: { slots: ["accent"], label: "Color del casco" },
  },
  obrero: {
    label: "Obra",
    category: "trabajo",
    top: "tshirt",
    bottom: "cargo",
    outfit: "hi-vis",
    shoes: "boots",
    colors: { shirt: "#6886c4", top2: "#6886c4", pants: "#264653", accent: "#e9c65a", shoeColor: "#8a5a2b" },
    gear: { head: "hard-hat" },
    gloves: "#cfa033",
    tint: { slots: ["accent"], label: "Color del casco" },
  },
  // ---------- Campo y mar ----------
  granjero: {
    label: "Granjero",
    category: "campo",
    top: "flannel",
    bottom: "pants",
    outfit: "overalls",
    shoes: "boots",
    colors: { shirt: "#c05a4a", top2: "#5a2a2a", pants: DENIM, accent: "#e0923e", shoeColor: LEATHER },
    gear: { head: "straw-hat", neck: "neckerchief" },
    tint: { slots: ["shirt"], label: "Color de la camisa" },
  },
  apicultor: {
    label: "Apicultor",
    category: "campo",
    top: "longsleeve",
    bottom: "pants",
    outfit: "coveralls",
    shoes: "rain-boots",
    colors: { shirt: WHITE, top2: WHITE, pants: "#ece8dc", accent: "#e9c65a", shoeColor: "#e8e1d0" },
    gear: { head: "bee-hat" },
    gloves: "#e6c77a",
    details: ["bee-buddy"],
  },
  jardinero: {
    label: "Jardinero",
    category: "campo",
    top: "tshirt",
    bottom: "cargo",
    shoes: "rain-boots",
    colors: { shirt: "#5ea247", top2: "#5ea247", pants: "#8a6f4e", accent: "#cdb08a", shoeColor: "#437a55" },
    gear: { head: "bucket-hat" },
    gloves: "#e0923e",
    details: ["seed-pouch"],
    tint: { slots: ["shirt"], label: "Color de la camiseta" },
  },
  pescador: {
    label: "Pescador",
    category: "campo",
    top: "sweater",
    bottom: "pants",
    outfit: "raincoat",
    shoes: "rain-boots",
    colors: { shirt: "#f2c440", top2: "#f2c440", pants: "#264653", accent: "#f2c440", shoeColor: "#2f5a40" },
    gear: { head: "rain-hat" },
    tint: { slots: ["shirt", "accent"], label: "Color del impermeable" },
  },
  marinero: {
    label: "Marinero",
    category: "campo",
    top: "sailor",
    bottom: "pants",
    shoes: "dress-shoes",
    colors: { shirt: WHITE, top2: NAVY, pants: NAVY, accent: NAVY, shoeColor: BLACK },
    gear: { head: "sailor-hat" },
    tint: { slots: ["top2", "pants"], label: "Color del cuello" },
  },
  // ---------- Ocio y deporte ----------
  deportista: {
    label: "Deportista",
    category: "ocio",
    top: "jersey",
    bottom: "shorts",
    shoes: "sneakers",
    colors: { shirt: "#c05a4a", top2: "#f7ebc8", pants: "#22223b", accent: "#f7ebc8", shoeColor: DENIM },
    gear: { head: "headband" },
    tint: { slots: ["shirt"], label: "Color de la camiseta" },
  },
  dj: {
    label: "DJ",
    category: "ocio",
    top: "graphic-tee",
    bottom: "joggers",
    shoes: "sneakers",
    colors: { shirt: BLACK, top2: "#ff5fd2", pants: CHARCOAL, accent: "#ff5fd2", shoeColor: "#f3e6c4" },
    gear: { head: "headphones", face: "sunglasses", neck: "chain" },
    tint: { slots: ["top2", "accent"], label: "Color del neón" },
  },
  cine: {
    label: "Cine",
    category: "ocio",
    top: "cardigan",
    bottom: "pants",
    shoes: "sneakers",
    colors: { shirt: "#cfa033", top2: WHITE, pants: "#3d405b", accent: "#c05a4a", shoeColor: "#c05a4a" },
    gear: { face: "3d-glasses" },
    tint: { slots: ["shirt"], label: "Color del cárdigan" },
  },
  playa: {
    label: "Playa",
    category: "ocio",
    top: "hawaiian",
    bottom: "shorts",
    shoes: "sandals",
    colors: { shirt: "#2a9d8f", top2: "#f28fad", pants: "#f7ebc8", accent: "#e0923e", shoeColor: "#8a5a2b" },
    gear: { face: "sunglasses" },
    tint: { slots: ["shirt"], label: "Color de la camisa" },
  },
  rockero: {
    label: "Rockero",
    category: "ocio",
    top: "graphic-tee",
    bottom: "pants",
    outfit: "jacket",
    shoes: "boots",
    colors: { shirt: BLACK, top2: "#c05a4a", pants: "#22223b", accent: "#2b2530", shoeColor: BLACK },
    gear: { neck: "chain", back: "guitar" },
    tint: { slots: ["top2"], label: "Color del estampado" },
  },
  artista: {
    label: "Artista",
    category: "ocio",
    top: "longsleeve",
    bottom: "pants",
    outfit: "apron",
    shoes: "sneakers",
    pattern: "stripes",
    colors: { shirt: WHITE, top2: NAVY, pants: BLACK, accent: "#c05a4a", shoeColor: BLACK },
    gear: { head: "beret" },
    details: ["paint-spots"],
    tint: { slots: ["accent"], label: "Color de la boina" },
  },
  // ---------- Casa y clima ----------
  pijama: {
    label: "Pijama",
    category: "casa",
    top: "longsleeve",
    bottom: "pants",
    outfit: "pajamas",
    shoes: "slippers",
    pattern: "dots",
    colors: { shirt: "#8fb0d8", top2: WHITE, pants: "#8fb0d8", accent: "#8fb0d8", shoeColor: "#dea7ad" },
    gear: { head: "nightcap" },
    tint: { slots: ["shirt", "accent"], label: "Color del pijama" },
  },
  invierno: {
    label: "Invierno",
    category: "casa",
    top: "sweater",
    bottom: "pants",
    outfit: "coat",
    shoes: "boots",
    colors: { shirt: "#c05a4a", top2: "#c05a4a", pants: "#264653", accent: "#4660a0", shoeColor: LEATHER },
    gear: { head: "pompom-beanie", neck: "scarf" },
    gloves: "#f3e6c4",
    tint: { slots: ["shirt"], label: "Color del abrigo" },
  },
  ruana: {
    label: "Ruana",
    category: "casa",
    top: "sweater",
    bottom: "pants",
    outfit: "ruana",
    shoes: "boots",
    colors: { shirt: "#8a7a68", top2: "#4a3226", pants: CHARCOAL, accent: "#f3e6c4", shoeColor: "#3a2418" },
    gear: { head: "vueltiao" },
    tint: { slots: ["shirt"], label: "Color de la ruana" },
  },
  // ---------- Fiesta y gala ----------
  smoking: {
    label: "Esmoquin",
    category: "gala",
    top: "dress-shirt",
    bottom: "pants",
    outfit: "blazer",
    shoes: "dress-shoes",
    colors: { shirt: WHITE, top2: WHITE, pants: BLACK, accent: BLACK, shoeColor: BLACK },
    gear: { neck: "bowtie" },
    details: ["pocket-square"],
    tint: { slots: ["accent"], label: "Color del corbatín" },
  },
  gala: {
    label: "Vestido de gala",
    category: "gala",
    top: "tank",
    bottom: "long-skirt",
    outfit: "gown",
    shoes: "heels",
    colors: { shirt: "#983a3c", top2: "#983a3c", pants: "#983a3c", accent: "#dcae3f", shoeColor: "#dcae3f" },
    gear: { head: "tiara", neck: "pearls" },
    tint: { slots: ["shirt"], label: "Color del vestido" },
  },
  fiesta: {
    label: "Fiesta",
    category: "gala",
    top: "tshirt",
    bottom: "shorts",
    shoes: "sneakers",
    pattern: "dots",
    colors: { shirt: "#6886c4", top2: "#f4d35e", pants: "#22223b", accent: "#ff5fd2", shoeColor: "#c05a4a" },
    gear: { head: "party-hat", face: "star-glasses" },
    details: ["confetti"],
    tint: { slots: ["accent"], label: "Color del gorro" },
  },
  realeza: {
    label: "Realeza",
    category: "gala",
    top: "dress-shirt",
    bottom: "pants",
    outfit: "robe",
    shoes: "dress-shoes",
    colors: { shirt: "#6e3a96", top2: "#f3e6c4", pants: "#22223b", accent: "#c05a4a", shoeColor: "#b98424" },
    gear: { head: "crown", back: "cape" },
    tint: { slots: ["accent"], label: "Color de la capa" },
  },
  // ---------- Disfraces ----------
  astronauta: {
    label: "Astronauta",
    category: "disfraz",
    top: "longsleeve",
    bottom: "pants",
    outfit: "coveralls",
    shoes: "rain-boots",
    colors: { shirt: "#e8e6e0", top2: "#e8e6e0", pants: "#e8e6e0", accent: "#e8e6e0", shoeColor: "#d8d6d0" },
    gear: { head: "space-helmet", back: "air-tank" },
    gloves: "#d8d6d0",
    details: ["space-patch"],
  },
  pirata: {
    label: "Pirata",
    category: "disfraz",
    top: "dress-shirt",
    bottom: "pants",
    outfit: "vest",
    shoes: "boots",
    colors: { shirt: "#f3e6c4", top2: "#f3e6c4", pants: LEATHER, accent: "#c05a4a", shoeColor: "#2b1b12" },
    gear: { head: "pirate-hat", face: "eyepatch" },
    tint: { slots: ["pants"], label: "Color del chaleco" },
  },
  superheroe: {
    label: "Superhéroe",
    category: "disfraz",
    top: "longsleeve",
    bottom: "pants",
    outfit: "coveralls",
    shoes: "boots",
    colors: { shirt: DENIM, top2: DENIM, pants: DENIM, accent: "#c05a4a", shoeColor: "#c05a4a" },
    gear: { face: "hero-mask", back: "cape" },
    gloves: "#c05a4a",
    details: ["emblem"],
    tint: { slots: ["pants"], label: "Color del traje" },
  },
  mago: {
    label: "Mago",
    category: "disfraz",
    top: "longsleeve",
    bottom: "pants",
    outfit: "robe",
    shoes: "boots",
    colors: { shirt: NAVY, top2: "#f3e6c4", pants: CHARCOAL, accent: NAVY, shoeColor: LEATHER },
    gear: { head: "wizard-hat" },
    details: ["stars"],
    tint: { slots: ["shirt", "accent"], label: "Color de la túnica" },
  },
  // ---------- De la Noche de brujas ----------
  bruja: {
    label: "Bruja",
    category: "brujas",
    top: "longsleeve",
    bottom: "long-skirt",
    outfit: "gown",
    shoes: "boots",
    colors: { shirt: "#5c4878", top2: "#f08a2a", pants: BLACK, accent: "#3e2f52", shoeColor: "#2b1b12" },
    gear: { head: "witch-hat" },
    tint: { slots: ["shirt"], label: "Color del vestido" },
  },
  vampiro: {
    label: "Vampiro",
    category: "brujas",
    top: "dress-shirt",
    bottom: "pants",
    outfit: "vest",
    shoes: "dress-shoes",
    colors: { shirt: WHITE, top2: WHITE, pants: BLACK, accent: "#a02a3a", shoeColor: BLACK },
    gear: { neck: "bowtie", back: "cape" },
    details: ["fangs"],
    tint: { slots: ["accent"], label: "Color de la capa" },
  },
  calabaza: {
    label: "Calabaza",
    category: "brujas",
    top: "sweater",
    bottom: "pants",
    outfit: "coveralls",
    shoes: "sneakers",
    colors: { shirt: "#e57e26", top2: "#e57e26", pants: "#e57e26", accent: "#4a7a3e", shoeColor: "#3a2418" },
    gear: { head: "beanie" },
    details: ["pumpkin-face"],
  },
  esqueleto: {
    label: "Esqueleto",
    category: "brujas",
    top: "longsleeve",
    bottom: "pants",
    outfit: "coveralls",
    shoes: "sneakers",
    colors: { shirt: BLACK, top2: BLACK, pants: BLACK, accent: BLACK, shoeColor: BLACK },
    gloves: "#f3f1ec",
    details: ["bones"],
  },
  // ---------- Del Carnaval de Negros y Blancos (el blanco y negro va en la ropa y el antifaz) ----------
  "comparsa-blanca": {
    label: "Comparsa blanca y negra",
    category: "carnaval",
    top: "dress-shirt",
    bottom: "pants",
    outfit: "vest",
    shoes: "boots",
    colors: { shirt: WHITE, top2: WHITE, pants: BLACK, accent: "#dcae3f", shoeColor: BLACK },
    gear: { face: "carnival-mask", neck: "bowtie" },
    tint: { slots: ["accent"], label: "Color del ribete" },
  },
  "arlequin-pastuso": {
    label: "Arlequín pastuso",
    category: "carnaval",
    top: "longsleeve",
    bottom: "pants",
    shoes: "sneakers",
    pattern: "stripes",
    colors: { shirt: WHITE, top2: BLACK, pants: BLACK, accent: "#c05a4a", shoeColor: WHITE },
    gear: { head: "party-hat", face: "carnival-mask" },
    details: ["confetti"],
    tint: { slots: ["accent"], label: "Color del gorro" },
  },
  "talco-ceniza": {
    label: "Talco y ceniza",
    category: "carnaval",
    top: "longsleeve",
    bottom: "long-skirt",
    outfit: "gown",
    shoes: "boots",
    pattern: "dots",
    colors: { shirt: BLACK, top2: WHITE, pants: WHITE, accent: "#f3f1ec", shoeColor: BLACK },
    gear: { face: "carnival-mask", neck: "scarf" },
    tint: { slots: ["shirt"], label: "Color del vestido" },
  },
  // El sombrero negro con flores de los que van al desfile en Pasto, con la ruana y el pañuelo.
  "sombrero-flores": {
    label: "Sombrero negro con flores",
    category: "carnaval",
    top: "longsleeve",
    bottom: "pants",
    outfit: "ruana",
    shoes: "boots",
    colors: { shirt: BLACK, top2: WHITE, pants: BLACK, accent: "#c8402a", shoeColor: BLACK },
    gear: { head: "flower-hat", neck: "neckerchief" },
    tint: { slots: ["shirt"], label: "Color de la ruana" },
  },
  // La máscara de papel maché subida a la frente para descansar entre una comparsa y otra.
  "mascara-levantada": {
    label: "Máscara levantada",
    category: "carnaval",
    top: "dress-shirt",
    bottom: "pants",
    outfit: "vest",
    shoes: "dress-shoes",
    pattern: "stripes",
    colors: { shirt: WHITE, top2: BLACK, pants: BLACK, accent: "#c05a4a", shoeColor: BLACK },
    gear: { head: "raised-mask", neck: "bowtie" },
    details: ["confetti"],
    tint: { slots: ["accent"], label: "Color del corbatín" },
  },
  // ---------- De los oficios (se desbloquean con el nivel, ver oficios.ts) ----------
  "pescador-lago": {
    label: "Pescador del lago",
    category: "oficios",
    top: "sweater",
    bottom: "cargo",
    outfit: "ruana",
    shoes: "rain-boots",
    colors: { shirt: "#7a4a2a", top2: "#b8402a", pants: "#5a4a34", accent: "#6f7d3c", shoeColor: "#4a6b34" },
    gear: { head: "bucket-hat" },
    tint: { slots: ["shirt"], label: "Color de la ruana" },
  },
  "lobo-lago": {
    label: "Lobo de lago",
    category: "oficios",
    top: "turtleneck",
    bottom: "pants",
    outfit: "raincoat",
    shoes: "rain-boots",
    colors: { shirt: NAVY, top2: NAVY, pants: "#2a3a40", accent: "#e0923e", shoeColor: "#2a2a30" },
    gear: { head: "rain-hat", neck: "neckerchief" },
    details: ["reflective"],
    tint: { slots: ["accent"], label: "Color de la pañoleta" },
  },
  hortelano: {
    label: "Hortelano",
    category: "oficios",
    top: "tshirt",
    bottom: "pants",
    outfit: "overalls",
    shoes: "boots",
    colors: { shirt: "#e8d8a8", top2: "#e8d8a8", pants: "#5a7a3e", accent: "#e0923e", shoeColor: LEATHER },
    gear: { head: "straw-hat" },
    gloves: "#b88a4a",
    tint: { slots: ["pants"], label: "Color del overol" },
  },
  "maestro-huerta": {
    label: "Maestro de la huerta",
    category: "oficios",
    top: "flannel",
    bottom: "cargo",
    outfit: "ruana",
    shoes: "boots",
    colors: { shirt: "#4f8a3a", top2: "#2f5a2a", pants: "#8a6f4e", accent: "#f2c440", shoeColor: LEATHER },
    gear: { head: "vueltiao" },
    details: ["seed-pouch"],
    tint: { slots: ["shirt"], label: "Color de la ruana" },
  },
  cocinero: {
    label: "Delantal de la casa",
    category: "oficios",
    top: "polo",
    bottom: "pants",
    outfit: "apron",
    shoes: "sneakers",
    colors: { shirt: "#f4ecdc", top2: "#c05a4a", pants: CHARCOAL, accent: "#c05a4a", shoeColor: BLACK },
    gear: { head: "bandana" },
    details: ["chef-check"],
    tint: { slots: ["accent", "top2"], label: "Color del delantal" },
  },
  "chef-mayor": {
    label: "Chef mayor",
    category: "oficios",
    top: "longsleeve",
    bottom: "pants",
    outfit: "chef-coat",
    shoes: "dress-shoes",
    colors: { shirt: WHITE, top2: "#dcae3f", pants: BLACK, accent: "#dcae3f", shoeColor: BLACK },
    gear: { head: "chef-hat", neck: "bowtie" },
    details: ["chef-check", "emblem"],
    tint: { slots: ["accent"], label: "Color del corbatín" },
  },
  anfitrion: {
    label: "Anfitrión",
    category: "oficios",
    top: "hawaiian",
    bottom: "shorts",
    shoes: "sandals",
    colors: { shirt: "#e0923e", top2: "#f4d35e", pants: "#e8d8b8", accent: "#ff7aa8", shoeColor: LEATHER },
    gear: { head: "flower", neck: "necklace" },
    tint: { slots: ["shirt"], label: "Color de la camisa" },
  },
  "alma-fiesta": {
    label: "Alma de la fiesta",
    category: "oficios",
    top: "dress-shirt",
    bottom: "pants",
    outfit: "blazer",
    shoes: "dress-shoes",
    colors: { shirt: "#b0467a", top2: WHITE, pants: BLACK, accent: "#f4d35e", shoeColor: BLACK },
    gear: { face: "star-glasses", neck: "bowtie" },
    details: ["confetti"],
    tint: { slots: ["shirt"], label: "Color del saco" },
  },
  explorador: {
    label: "Explorador",
    category: "oficios",
    top: "longsleeve",
    bottom: "cargo",
    shoes: "boots",
    colors: { shirt: "#c8b080", top2: "#c8b080", pants: "#6a5a3a", accent: "#8a4a2a", shoeColor: LEATHER },
    gear: { head: "bucket-hat", neck: "neckerchief", back: "backpack" },
    tint: { slots: ["shirt"], label: "Color de la camisa" },
  },
  cartografo: {
    label: "Cartógrafo",
    category: "oficios",
    top: "turtleneck",
    bottom: "pants",
    outfit: "coat",
    shoes: "boots",
    colors: { shirt: "#7a5aa8", top2: "#4a3a6a", pants: CHARCOAL, accent: "#c8a83a", shoeColor: LEATHER },
    gear: { face: "monocle", neck: "scarf" },
    details: ["stars"],
    tint: { slots: ["shirt"], label: "Color del abrigo" },
  },
};

/** Lo que se ve puesto: el look con el traje aplicado, los guantes y los detalles del traje. */
export interface WornLook extends FullLook {
  gloves: string | null;
  details: readonly CostumeDetail[];
}

/** El color que se deja cambiar de un traje (el que trae por defecto si no se eligió otro). */
export function costumeTint(costume: CostumeId, chosen: string | null): string | null {
  const c = COSTUMES[costume];
  if (!c.tint) return null;
  return chosen ?? c.colors[c.tint.slots[0]!];
}

/**
 * Aplica el traje: la ropa y sus colores reemplazan los del look y, con `costumeGear`, también la cabeza,
 * la cara, el cuello y la espalda. El cuerpo (piel, pelo, cara) sigue siendo el de la persona.
 */
export function wornLook(full: FullLook): WornLook {
  if (!full.costume) return { ...full, gloves: null, details: [] };
  const c = COSTUMES[full.costume];
  const colors = { ...c.colors };
  const tint = costumeTint(full.costume, full.costumeColor);
  if (c.tint && tint) for (const slot of c.tint.slots) colors[slot] = tint;
  const gear = full.costumeGear
    ? { head: c.gear?.head ?? "none", face: c.gear?.face ?? "none", neck: c.gear?.neck ?? "none", back: c.gear?.back ?? "none" }
    : { head: full.head, face: full.face, neck: full.neck, back: full.back };
  return {
    ...full,
    ...colors,
    ...gear,
    top: c.top,
    bottom: c.bottom,
    outfit: c.outfit ?? null,
    shoes: c.shoes,
    pattern: c.pattern ?? "solid",
    gloves: c.gloves ?? null,
    details: c.details ?? [],
  };
}
