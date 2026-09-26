import { HUMANS } from "@hyvento/map/character";
import type { Accessory, HairStyle, HumanAvatar, Look } from "@hyvento/shared";
import { RISO } from "./riso";

/** Muestras sugeridas del editor de personaje (además hay un selector de color libre). */
export const SKIN_TONES = ["#ffdbac", "#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#5c3a21"];
export const HAIR_COLORS = ["#0d0d0d", "#3b2219", "#6b4423", "#b5651d", "#d4a017", "#e8e1d0", RISO.pink, RISO.blue];
/** Ropa y accesorios: las tintas RISO más neutros. */
export const INK_COLORS = [
  RISO.pink,
  RISO.blue,
  RISO.yellow,
  RISO.green,
  RISO.orange,
  RISO.violet,
  RISO.navy,
  "#3a3a4a",
  "#f3eee3",
  "#e76f51",
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
  const s = HUMANS[avatar] ?? HUMANS.ada!;
  return { skin: s.skin, hair: s.hair, shirt: s.shirt, pants: s.pants, accent: RISO.blue, hairStyle: "short", accessories: [] };
}
