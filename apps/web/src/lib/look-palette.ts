import { HUMANS } from "@hyvento/map/art";
import type { Accessory, HairStyle, HumanAvatar, Look } from "@hyvento/shared";

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

export const HAIR_STYLE_LABEL: Record<HairStyle, string> = {
  short: "Corto",
  long: "Largo",
  curly: "Rizado",
  buzz: "Rapado",
  bun: "Moño",
};

export const ACCESSORY_LABEL: Record<Accessory, string> = {
  glasses: "Gafas",
  cap: "Gorra",
  headphones: "Audífonos",
  beard: "Barba",
};

/** Look equivalente a un personaje fijo, para empezar a editar desde él. */
export function presetLook(avatar: HumanAvatar): Look {
  const s = HUMANS[avatar] ?? HUMANS.ada;
  return { skin: s.skin, hair: s.hair, shirt: s.shirt, pants: s.pants, accent: "#4660a0", hairStyle: s.hairStyle ?? "short", accessories: [] };
}
