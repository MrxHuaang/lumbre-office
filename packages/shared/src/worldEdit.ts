// El editor de la casa (solo admins): quitar, mover, girar y agregar muebles en cualquier nivel. La
// lógica (qué se puede y cómo quedan los cambios) está en @hyvento/map (worldEdits.ts); acá, el mensaje.
import { z } from "zod";
import { DIRECTIONS } from "./protocol";

const Tile = z.number().int().min(-2).max(400);
const Area = z.string().min(1).max(40);
const Key = z.string().min(1).max(120);

/** Cliente → servidor (`MSG.worldEdit`): un cambio en el nivel `area`. */
export const WorldEditMessage = z.object({
  area: Area,
  op: z.discriminatedUnion("action", [
    z.object({ action: z.literal("place"), type: z.string().min(1).max(64), x: Tile, y: Tile, facing: z.enum(DIRECTIONS) }),
    z.object({ action: z.literal("move"), key: Key, x: Tile, y: Tile, facing: z.enum(DIRECTIONS) }),
    z.object({ action: z.literal("remove"), key: Key }),
  ]),
});
export type WorldEditMessage = z.infer<typeof WorldEditMessage>;

/** Servidor → cliente (`MSG.worldEditResult`). `error` es un WorldEditProblem de @hyvento/map, o "admin" / "failed". */
export type WorldEditResult = { ok: true } | { ok: false; error: string };

/**
 * Cliente → servidor (`MSG.worldEditLock`): entrar al editor de la casa (o salir). Solo una persona lo
 * tiene a la vez; el servidor responde con `WorldEditLockResult`.
 */
export const WorldEditLockMessage = z.object({ on: z.boolean() });
export type WorldEditLockMessage = z.infer<typeof WorldEditLockMessage>;

export type WorldEditLockResult = { ok: true } | { ok: false; error: "not-allowed" } | { ok: false; error: "busy"; by: string };
