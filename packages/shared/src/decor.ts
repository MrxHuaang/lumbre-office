// Fase 3c: el editor de oficina. La persona dueña pone, mueve, gira y quita muebles de su mochila en su
// oficina, y elige piso y papel tapiz. Todo lo valida el servidor de juego.
import { z } from "zod";
import { DIRECTIONS } from "./protocol";

/** Pisos y papeles tapiz que se pueden elegir para una oficina (mismos nombres que en packages/map). */
export const OFFICE_FLOORS = ["carpet", "wood", "tiles", "stone", "planks", "checker", "hydraulic", "terrazzo", "brick", "moquette", "concrete", "planks-worn"] as const;
export type OfficeFloor = (typeof OFFICE_FLOORS)[number];
export const OFFICE_WALLPAPERS = ["cream", "blue", "rose", "sage", "stripes", "damask", "brick", "slats", "colonial", "cinderblock", "boards"] as const;
export type OfficeWallpaper = (typeof OFFICE_WALLPAPERS)[number];

/** Mueble puesto en una oficina (coordenadas en tiles del nivel, no de la oficina). */
export interface OfficeItemDTO {
  id: string;
  type: string;
  x: number;
  y: number;
  facing: (typeof DIRECTIONS)[number];
}

const Tile = z.number().int().min(0).max(255);
const ZoneId = z.string().min(1).max(64);

/**
 * Cliente → servidor (`MSG.officeEdit`). `place` saca un mueble de la mochila; `remove` lo devuelve;
 * `move` lo cambia de lugar o de orientación; `style` cambia piso o papel tapiz.
 */
export const OfficeEditMessage = z.discriminatedUnion("action", [
  z.object({ action: z.literal("place"), zoneId: ZoneId, type: z.string().min(1).max(64), x: Tile, y: Tile, facing: z.enum(DIRECTIONS) }),
  z.object({ action: z.literal("move"), zoneId: ZoneId, itemId: z.string().min(1).max(64), x: Tile, y: Tile, facing: z.enum(DIRECTIONS) }),
  z.object({ action: z.literal("remove"), zoneId: ZoneId, itemId: z.string().min(1).max(64) }),
  z.object({
    action: z.literal("style"),
    zoneId: ZoneId,
    floor: z.enum(OFFICE_FLOORS).optional(),
    wallpaper: z.enum(OFFICE_WALLPAPERS).optional(),
  }),
]);
export type OfficeEditMessage = z.infer<typeof OfficeEditMessage>;

/**
 * Por qué no se pudo:
 * - not-owner: no es tu oficina. - not-owned: no tienes ese mueble en la mochila.
 * - outside: se sale de la oficina. - blocked: choca con otro mueble o una pared.
 * - door: tapa la puerta o el camino de la puerta al escritorio. - occupied: hay alguien parado ahí.
 * - fixed: ese mueble no se mueve (el escritorio con PC y su silla). - unknown: mueble inexistente.
 */
export type OfficeEditError = "not-owner" | "not-owned" | "outside" | "blocked" | "door" | "occupied" | "fixed" | "unknown" | "failed";

/** Servidor → cliente (`MSG.officeEditResult`). */
export type OfficeEditResult = { ok: true } | { ok: false; error: OfficeEditError };
