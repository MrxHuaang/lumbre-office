import type { Facing, Placement } from "../types";

/** Un mueble del catálogo en (x, y), mirando a `facing`. */
export const place = (type: string, x: number, y: number, facing: Facing = "right"): Placement => ({ type, x, y, facing });
