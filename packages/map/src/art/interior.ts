// Los interiores rediseñados de la planta baja y los pisos 2 y 3.
import type { Variant } from "./kit";
import type { Sprite } from "./pixel";

/** Dibujos para registrar en DRAW de furniture.ts. */
export const INTERIOR_DRAW: Record<string, (v: Variant) => Sprite> = {};
